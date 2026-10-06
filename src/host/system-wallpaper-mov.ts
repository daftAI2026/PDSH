/**
 * [INPUT]: 依赖shared远端Range预算、mov-aux的已知QuickTime扩展校验及调用方取得的固定Apple MOV分段。
 * [OUTPUT]: 提供固定ftyp+wide+mdat+尾moov布局解析、首sync sample定位及单sample MOV重建。
 * [POS]: 下载器与native helper之间的纯字节转换器；拒绝fragment、多轨、外部引用和未知sample表，不联网/读写文件。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { WALLPAPER_LIMITS } from '../shared/system-wallpaper-protocol.ts'
import {
  MovAuxiliaryValidationError,
  validateAuxiliarySampleTables,
  validateDataHandler,
  validateHevcSampleEntry,
  validateMediaHandler,
  validateTrackAperture,
} from './system-wallpaper-mov-aux.ts'
import type { MovAtomRange } from './system-wallpaper-mov-aux.ts'

export interface AppleWallpaperMovOptions {
  /** 远端总长度只参与Range地址检查，不按该值分配内存。 */
  readonly maxSourceLength?: number
  readonly maxMetadataBytes?: number
  readonly maxSampleBytes?: number
}

export interface AppleWallpaperMovLayout {
  readonly sourceLength: number
  readonly ftyp: Uint8Array
  readonly mdatBodyStart: number
  readonly mdatBodyEnd: number
  readonly moovOffset: number
  readonly moovLength: number
}

export interface AppleWallpaperFirstSamplePlan {
  readonly sourceOffset: number
  readonly sampleSize: number
  /** 输入必须正好是 sourceOffset/sourceSize 对应的字节；输出仅含一帧完整本地MOV。 */
  rebuild(sampleBytes: Uint8Array): Uint8Array
}

export type AppleWallpaperMovErrorCode = 'invalid-options' | 'budget-exceeded' | 'invalid-layout' | 'invalid-movie'

export class AppleWallpaperMovError extends Error {
  readonly code: AppleWallpaperMovErrorCode
  constructor(code: AppleWallpaperMovErrorCode) {
    super(code)
    this.name = 'AppleWallpaperMovError'
    this.code = code
  }
}

const MAX_TABLE_ENTRIES = 524_288
const MAX_SAMPLE_COUNT = 1_000_000
const MAX_NESTED_ATOMS = 131_072
const U32_MAX = 0xffff_ffff
const SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)

interface Limits {
  readonly maxSourceLength: number
  readonly maxMetadataBytes: number
  readonly maxSampleBytes: number
}

type Atom = MovAtomRange

interface TableData {
  readonly sampleCount: number
  readonly firstSampleSize: number
  readonly sampleSizeAt: (index: number) => number
}

interface ChunkEntry {
  readonly firstChunk: number
  readonly samplesPerChunk: number
  readonly sampleDescriptionIndex: number
}

interface ParsedTrack {
  readonly movieHeader: Atom
  readonly trackHeader: Atom
  readonly trackAperture: Atom
  readonly mediaHeader: Atom
  readonly handler: Atom
  readonly videoHeader: Atom
  readonly dataHandler: Atom
  readonly dataInfo: Atom
  readonly sampleDescription: Atom
  readonly sampleSize: TableData
  readonly chunkOffsets: readonly number[]
  readonly chunkType: 'stco' | 'co64'
  readonly chunkMap: readonly ChunkEntry[]
  readonly firstSampleDescriptionIndex: number
  readonly firstSampleDuration: number
  readonly compositionVersion: 0 | 1
  readonly movieTimescale: number
  readonly mediaTimescale: number
}

const DEFAULT_LIMITS = {
  maxSourceLength: WALLPAPER_LIMITS.maxVideoSourceLength,
  maxMetadataBytes: WALLPAPER_LIMITS.maxVideoMetadataBytes,
  maxSampleBytes: WALLPAPER_LIMITS.maxVideoSampleBytes,
} as const

function fail(code: AppleWallpaperMovErrorCode): never {
  throw new AppleWallpaperMovError(code)
}

function validateAux(validate: () => void): void {
  try {
    validate()
  } catch (error) {
    if (error instanceof MovAuxiliaryValidationError) fail('invalid-movie')
    throw error
  }
}

function resolveLimits(options?: AppleWallpaperMovOptions): Limits {
  if (options !== undefined && (options === null || typeof options !== 'object' || Array.isArray(options))) {
    return fail('invalid-options')
  }
  const limits = {
    maxSourceLength: options?.maxSourceLength ?? DEFAULT_LIMITS.maxSourceLength,
    maxMetadataBytes: options?.maxMetadataBytes ?? DEFAULT_LIMITS.maxMetadataBytes,
    maxSampleBytes: options?.maxSampleBytes ?? DEFAULT_LIMITS.maxSampleBytes,
  }
  const ceilings = DEFAULT_LIMITS
  for (const key of Object.keys(limits) as Array<keyof Limits>) {
    const value = limits[key]
    if (!Number.isSafeInteger(value) || value <= 0) return fail('invalid-options')
    if (value > ceilings[key]) return fail('invalid-options')
  }
  return limits
}

/** 只接受三固定视频共享的64B前缀；总length只做地址运算，不用于Buffer/Array分配。 */
export function parseAppleWallpaperMovHeader(
  prefix: Uint8Array,
  sourceLength: number,
  options?: AppleWallpaperMovOptions,
): AppleWallpaperMovLayout {
  const limits = resolveLimits(options)
  if (!(prefix instanceof Uint8Array) || prefix.byteLength !== WALLPAPER_LIMITS.videoHeaderBytes) fail('invalid-layout')
  if (!Number.isSafeInteger(sourceLength) || sourceLength <= prefix.byteLength) fail('invalid-layout')
  if (sourceLength > limits.maxSourceLength) fail('budget-exceeded')

  const ftyp = atomAt(prefix, 0, prefix.byteLength)
  if (ftyp.type !== 'ftyp' || ftyp.start !== 0 || ftyp.end !== 20) fail('invalid-layout')
  const wide = atomAt(prefix, ftyp.end, prefix.byteLength)
  if (wide.type !== 'wide' || wide.end !== 28) fail('invalid-layout')
  if (readType(prefix, 32, prefix.byteLength) !== 'mdat') fail('invalid-layout')
  const mdatSize = readU32(prefix, 28, prefix.byteLength)
  if (mdatSize <= 8) fail('invalid-layout')
  const mdatEnd = checkedAdd(28, mdatSize)
  if (mdatEnd >= sourceLength) fail('invalid-layout')
  const moovLength = sourceLength - mdatEnd
  if (moovLength < 8) fail('invalid-layout')
  if (moovLength > limits.maxMetadataBytes) fail('budget-exceeded')
  return {
    sourceLength,
    ftyp: prefix.slice(ftyp.start, ftyp.end),
    mdatBodyStart: 36,
    mdatBodyEnd: mdatEnd,
    moovOffset: mdatEnd,
    moovLength,
  }
}

/** 从有界moov表中定位首sample；可选edit list不会复制到输出，避免旧duration/PTS索引残留。 */
export function parseAppleWallpaperFirstSample(
  layout: AppleWallpaperMovLayout,
  moovBytes: Uint8Array,
  options?: AppleWallpaperMovOptions,
): AppleWallpaperFirstSamplePlan {
  const limits = resolveLimits(options)
  validateLayout(layout, limits)
  if (!(moovBytes instanceof Uint8Array) || moovBytes.byteLength !== layout.moovLength) fail('invalid-movie')
  if (moovBytes.byteLength > limits.maxMetadataBytes) fail('budget-exceeded')

  const root = atomAt(moovBytes, 0, moovBytes.byteLength)
  if (root.type !== 'moov' || root.end !== moovBytes.byteLength) fail('invalid-movie')
  const movieChildren = atoms(moovBytes, root.payloadStart, root.end)
  assertOnly(movieChildren, ['mvhd', 'trak', 'udta', 'meta', 'free'])
  const movieHeader = required(movieChildren, 'mvhd')
  const tracks = all(movieChildren, 'trak')
  if (tracks.length !== 1) fail('invalid-movie')
  const mvhdVersion = checkFullBox(moovBytes, movieHeader, [0, 1], 0)
  checkDurationField(moovBytes, movieHeader, mvhdVersion, mvhdVersion === 0 ? 16 : 24)
  const movieTimescale = readTimescale(moovBytes, movieHeader, mvhdVersion)
  const track = parseTrack(moovBytes, movieHeader, tracks[0], layout, movieTimescale, limits)
  if (track.sampleSize.firstSampleSize > limits.maxSampleBytes) fail('budget-exceeded')

  return {
    sourceOffset: track.chunkOffsets[0],
    sampleSize: track.sampleSize.firstSampleSize,
    rebuild(sampleBytes: Uint8Array): Uint8Array {
      if (!(sampleBytes instanceof Uint8Array) || sampleBytes.byteLength !== track.sampleSize.firstSampleSize) {
        fail('invalid-movie')
      }
      if (sampleBytes.byteLength > limits.maxSampleBytes) fail('budget-exceeded')
      const movieDuration = durationInMovieScale(
        BigInt(track.firstSampleDuration), track.movieTimescale, track.mediaTimescale,
      )
      const makeMovie = (chunkOffset: number): Uint8Array => rebuildMovie(
        moovBytes, track, movieDuration, chunkOffset,
      )
      const firstMoov = makeMovie(0)
      const sampleOffset = checkedAdd(layout.ftyp.byteLength, firstMoov.byteLength)
      const absoluteSampleOffset = checkedAdd(sampleOffset, 8)
      const rebuiltMoov = makeMovie(absoluteSampleOffset)
      const mdatSize = checkedAdd(sampleBytes.byteLength, 8)
      if (mdatSize > U32_MAX) fail('budget-exceeded')
      const outputSize = checkedAdd(checkedAdd(layout.ftyp.byteLength, rebuiltMoov.byteLength), mdatSize)
      const outputBudget = checkedAdd(checkedAdd(limits.maxMetadataBytes, limits.maxSampleBytes), WALLPAPER_LIMITS.videoHeaderBytes)
      if (outputSize > outputBudget) fail('budget-exceeded')
      const output = new Uint8Array(outputSize)
      output.set(layout.ftyp, 0)
      output.set(rebuiltMoov, layout.ftyp.byteLength)
      const mdatOffset = layout.ftyp.byteLength + rebuiltMoov.byteLength
      writeU32(output, mdatOffset, mdatSize)
      writeType(output, mdatOffset + 4, 'mdat')
      output.set(sampleBytes, mdatOffset + 8)
      return output
    },
  }
}

function validateLayout(layout: AppleWallpaperMovLayout, limits: Limits): void {
  if (!layout || typeof layout !== 'object' || !(layout.ftyp instanceof Uint8Array)) fail('invalid-layout')
  if (!Number.isSafeInteger(layout.sourceLength) || layout.sourceLength <= 0) fail('invalid-layout')
  if (layout.sourceLength > limits.maxSourceLength) fail('budget-exceeded')
  if (layout.ftyp.byteLength !== 20 || !Number.isSafeInteger(layout.mdatBodyStart) ||
      !Number.isSafeInteger(layout.mdatBodyEnd) || !Number.isSafeInteger(layout.moovOffset) ||
      !Number.isSafeInteger(layout.moovLength)) fail('invalid-layout')
  if (layout.mdatBodyStart !== 36 || layout.mdatBodyEnd !== layout.moovOffset ||
      BigInt(layout.moovOffset) + BigInt(layout.moovLength) !== BigInt(layout.sourceLength) ||
      layout.moovLength > limits.maxMetadataBytes || layout.mdatBodyEnd <= layout.mdatBodyStart) {
    fail(layout.moovLength > limits.maxMetadataBytes ? 'budget-exceeded' : 'invalid-layout')
  }
  const ftyp = atomAt(layout.ftyp, 0, layout.ftyp.byteLength)
  if (ftyp.type !== 'ftyp' || ftyp.end !== 20) fail('invalid-layout')
}

function parseTrack(
  bytes: Uint8Array,
  movieHeader: Atom,
  trak: Atom,
  layout: AppleWallpaperMovLayout,
  movieTimescale: number,
  limits: Limits,
): ParsedTrack {
  const trackChildren = atoms(bytes, trak.payloadStart, trak.end)
  assertOnly(trackChildren, ['tkhd', 'tapt', 'edts', 'mdia'])
  if (all(trackChildren, 'edts').length > 1) fail('invalid-movie')
  const trackHeader = required(trackChildren, 'tkhd')
  const trackAperture = required(trackChildren, 'tapt')
  validateAux(() => validateTrackAperture(bytes, trackAperture, atoms(bytes, trackAperture.payloadStart, trackAperture.end)))
  const media = required(trackChildren, 'mdia')
  const tkhdVersion = checkFullBox(bytes, trackHeader, [0, 1])
  const tkhdFlags = readFlags(bytes, trackHeader)
  if ((tkhdFlags & ~15) !== 0) fail('invalid-movie')
  checkDurationField(bytes, trackHeader, tkhdVersion, tkhdVersion === 0 ? 20 : 28)

  const mediaChildren = atoms(bytes, media.payloadStart, media.end)
  assertOnly(mediaChildren, ['mdhd', 'hdlr', 'minf'])
  const mediaHeader = required(mediaChildren, 'mdhd')
  const handler = required(mediaChildren, 'hdlr')
  const minf = required(mediaChildren, 'minf')
  const mdhdVersion = checkFullBox(bytes, mediaHeader, [0, 1], 0)
  const mediaTimescale = readTimescale(bytes, mediaHeader, mdhdVersion)
  checkDurationField(bytes, mediaHeader, mdhdVersion, mdhdVersion === 0 ? 16 : 24)
  validateAux(() => validateMediaHandler(bytes, handler))

  const minfChildren = atoms(bytes, minf.payloadStart, minf.end)
  assertOnly(minfChildren, ['vmhd', 'hdlr', 'dinf', 'stbl'])
  const videoHeader = required(minfChildren, 'vmhd')
  const dataHandler = required(minfChildren, 'hdlr')
  validateAux(() => validateDataHandler(bytes, dataHandler))
  const dataInfo = required(minfChildren, 'dinf')
  const sampleTable = required(minfChildren, 'stbl')
  checkFullBox(bytes, videoHeader, [0], 1)
  if (videoHeader.end - videoHeader.payloadStart < 12) fail('invalid-movie')
  const dataReferences = parseDataReferences(bytes, dataInfo)
  const tables = parseSampleTables(bytes, sampleTable, layout, dataReferences.length, limits)

  return {
    movieHeader,
    trackHeader,
    trackAperture,
    mediaHeader,
    handler,
    videoHeader,
    dataHandler,
    dataInfo,
    ...tables,
    movieTimescale,
    mediaTimescale,
  }
}

function parseSampleTables(
  bytes: Uint8Array,
  sampleTable: Atom,
  layout: AppleWallpaperMovLayout,
  dataReferenceCount: number,
  limits: Limits,
): Omit<ParsedTrack, 'movieHeader' | 'trackHeader' | 'trackAperture' | 'mediaHeader' | 'handler' | 'videoHeader' | 'dataHandler' | 'dataInfo' | 'movieTimescale' | 'mediaTimescale'> {
  const children = atoms(bytes, sampleTable.payloadStart, sampleTable.end)
  assertOnly(children, ['stsd', 'stts', 'ctts', 'stss', 'stsc', 'stsz', 'stco', 'co64', 'sgpd', 'csgm', 'cslg', 'sdtp'])
  const sampleDescription = required(children, 'stsd')
  const sampleSizeAtom = required(children, 'stsz')
  const stts = required(children, 'stts')
  const stsc = required(children, 'stsc')
  const offsets = all(children, 'stco').concat(all(children, 'co64'))
  if (offsets.length !== 1) fail('invalid-movie')
  const chunkType = offsets[0].type as 'stco' | 'co64'

  const descriptions = parseSampleDescriptions(bytes, sampleDescription, dataReferenceCount)
  const sampleSize = parseSampleSizes(bytes, sampleSizeAtom)
  if (sampleSize.sampleCount > MAX_SAMPLE_COUNT) fail('budget-exceeded')
  validateAux(() => validateAuxiliarySampleTables(bytes, children, sampleSize.sampleCount))
  const chunkOffsets = parseChunkOffsets(bytes, offsets[0], layout)
  const chunkMap = parseChunkMap(bytes, stsc, chunkOffsets.length, descriptions.length)
  validateTimeToSample(bytes, stts, sampleSize.sampleCount)
  const composition = all(children, 'ctts')
  if (composition.length > 1) fail('invalid-movie')
  const compositionVersion: 0 | 1 = composition.length
    ? validateCompositionOffsets(bytes, composition[0], sampleSize.sampleCount)
    : 0
  const sync = all(children, 'stss')
  if (sync.length > 1) fail('invalid-movie')
  if (sync.length) validateSyncSamples(bytes, sync[0], sampleSize.sampleCount)
  const firstSampleDuration = readFirstSampleDuration(bytes, stts)
  const firstSampleDescriptionIndex = validateChunkCoverage(
    sampleSize, chunkOffsets, chunkMap, layout, descriptions.length,
  )
  if (sampleSize.firstSampleSize > limits.maxSampleBytes) fail('budget-exceeded')

  return {
    sampleDescription,
    sampleSize,
    chunkOffsets,
    chunkType,
    chunkMap,
    firstSampleDescriptionIndex,
    firstSampleDuration,
    compositionVersion,
  }
}

function parseSampleDescriptions(bytes: Uint8Array, stsd: Atom, dataReferenceCount: number): Atom[] {
  checkFullBox(bytes, stsd, [0], 0)
  const entryCount = readU32(bytes, stsd.payloadStart + 4, stsd.end)
  if (entryCount !== 1) fail('invalid-movie')
  const entries = atoms(bytes, stsd.payloadStart + 8, stsd.end, entryCount)
  for (const entry of entries) {
    if (entry.end - entry.payloadStart < 8) fail('invalid-movie')
    const dataReferenceIndex = readU16(bytes, entry.payloadStart + 6, entry.end)
    if (dataReferenceIndex < 1 || dataReferenceIndex > dataReferenceCount) fail('invalid-movie')
    const codecBoxes = atoms(bytes, entry.payloadStart + 78, entry.end - 4)
    validateAux(() => validateHevcSampleEntry(bytes, entry, codecBoxes))
  }
  return entries
}

function parseDataReferences(bytes: Uint8Array, dinf: Atom): Atom[] {
  const children = atoms(bytes, dinf.payloadStart, dinf.end)
  assertOnly(children, ['dref', 'free'])
  const dref = required(children, 'dref')
  checkFullBox(bytes, dref, [0], 0)
  const count = readU32(bytes, dref.payloadStart + 4, dref.end)
  if (count !== 1) fail('invalid-movie')
  const entries = atoms(bytes, dref.payloadStart + 8, dref.end, count)
  for (const entry of entries) {
    if (entry.type !== 'alis') fail('invalid-movie')
    checkFullBox(bytes, entry, [0], 1)
    if (entry.end - entry.payloadStart !== 4) fail('invalid-movie')
  }
  return entries
}

function parseSampleSizes(bytes: Uint8Array, stsz: Atom): TableData {
  checkFullBox(bytes, stsz, [0], 0)
  const constantSize = readU32(bytes, stsz.payloadStart + 4, stsz.end)
  const sampleCount = readU32(bytes, stsz.payloadStart + 8, stsz.end)
  if (sampleCount < 1 || sampleCount > MAX_SAMPLE_COUNT) fail('budget-exceeded')
  if (constantSize > 0) {
    if (stsz.end - (stsz.payloadStart + 12) !== 0) fail('invalid-movie')
    return { sampleCount, firstSampleSize: constantSize, sampleSizeAt: () => constantSize }
  }
  const tableStart = stsz.payloadStart + 12
  if (stsz.end - tableStart !== sampleCount * 4) fail('invalid-movie')
  const firstSampleSize = readU32(bytes, tableStart, stsz.end)
  const sampleSizeAt = (index: number): number => readU32(bytes, tableStart + index * 4, stsz.end)
  for (let index = 0; index < sampleCount; index++) {
    if (sampleSizeAt(index) === 0) fail('invalid-movie')
  }
  return { sampleCount, firstSampleSize, sampleSizeAt }
}

function parseChunkOffsets(bytes: Uint8Array, box: Atom, layout: AppleWallpaperMovLayout): number[] {
  checkFullBox(bytes, box, [0], 0)
  const count = readU32(bytes, box.payloadStart + 4, box.end)
  if (count < 1 || count > MAX_TABLE_ENTRIES) fail('budget-exceeded')
  const entryBytes = box.type === 'co64' ? 8 : 4
  const start = box.payloadStart + 8
  if (box.end - start !== count * entryBytes) fail('invalid-movie')
  const offsets: number[] = []
  for (let index = 0; index < count; index++) {
    const offset = box.type === 'co64'
      ? readU64(bytes, start + index * 8, box.end)
      : readU32(bytes, start + index * 4, box.end)
    if (offset < layout.mdatBodyStart || offset >= layout.mdatBodyEnd) fail('invalid-movie')
    offsets.push(offset)
  }
  return offsets
}

function parseChunkMap(bytes: Uint8Array, stsc: Atom, chunkCount: number, descriptionCount: number): ChunkEntry[] {
  checkFullBox(bytes, stsc, [0], 0)
  const count = readU32(bytes, stsc.payloadStart + 4, stsc.end)
  if (count < 1 || count > MAX_TABLE_ENTRIES) fail('budget-exceeded')
  const start = stsc.payloadStart + 8
  if (stsc.end - start !== count * 12) fail('invalid-movie')
  const entries: ChunkEntry[] = []
  let previousChunk = 0
  for (let index = 0; index < count; index++) {
    const offset = start + index * 12
    const firstChunk = readU32(bytes, offset, stsc.end)
    const samplesPerChunk = readU32(bytes, offset + 4, stsc.end)
    const sampleDescriptionIndex = readU32(bytes, offset + 8, stsc.end)
    if (firstChunk <= previousChunk || firstChunk > chunkCount || samplesPerChunk < 1 ||
        sampleDescriptionIndex < 1 || sampleDescriptionIndex > descriptionCount) fail('invalid-movie')
    entries.push({ firstChunk, samplesPerChunk, sampleDescriptionIndex })
    previousChunk = firstChunk
  }
  if (entries[0].firstChunk !== 1) fail('invalid-movie')
  return entries
}

function validateTimeToSample(bytes: Uint8Array, stts: Atom, sampleCount: number): void {
  checkFullBox(bytes, stts, [0], 0)
  const count = readU32(bytes, stts.payloadStart + 4, stts.end)
  if (count < 1 || count > MAX_TABLE_ENTRIES) fail('invalid-movie')
  const start = stts.payloadStart + 8
  if (stts.end - start !== count * 8) fail('invalid-movie')
  let samples = 0n
  for (let index = 0; index < count; index++) {
    const entry = start + index * 8
    const runCount = readU32(bytes, entry, stts.end)
    const delta = readU32(bytes, entry + 4, stts.end)
    if (runCount < 1 || delta < 1) fail('invalid-movie')
    samples += BigInt(runCount)
  }
  if (samples !== BigInt(sampleCount)) fail('invalid-movie')
}

function readFirstSampleDuration(bytes: Uint8Array, stts: Atom): number {
  return readU32(bytes, stts.payloadStart + 12, stts.end)
}

function validateCompositionOffsets(bytes: Uint8Array, ctts: Atom, sampleCount: number): 0 | 1 {
  const version = checkFullBox(bytes, ctts, [0, 1], 0)
  const count = readU32(bytes, ctts.payloadStart + 4, ctts.end)
  if (count < 1 || count > MAX_TABLE_ENTRIES) fail('invalid-movie')
  const start = ctts.payloadStart + 8
  if (ctts.end - start !== count * 8) fail('invalid-movie')
  let samples = 0n
  for (let index = 0; index < count; index++) {
    const entry = start + index * 8
    const runCount = readU32(bytes, entry, ctts.end)
    if (runCount < 1) fail('invalid-movie')
    samples += BigInt(runCount)
    if (version === 1) new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(entry + 4)
    else readU32(bytes, entry + 4, ctts.end)
  }
  if (samples !== BigInt(sampleCount)) fail('invalid-movie')
  return version as 0 | 1
}

function validateSyncSamples(bytes: Uint8Array, stss: Atom, sampleCount: number): void {
  checkFullBox(bytes, stss, [0], 0)
  const count = readU32(bytes, stss.payloadStart + 4, stss.end)
  if (count < 1 || count > Math.min(sampleCount, MAX_TABLE_ENTRIES)) fail('invalid-movie')
  const start = stss.payloadStart + 8
  if (stss.end - start !== count * 4) fail('invalid-movie')
  let previous = 0
  for (let index = 0; index < count; index++) {
    const sample = readU32(bytes, start + index * 4, stss.end)
    if (sample <= previous || sample > sampleCount) fail('invalid-movie')
    if (index === 0 && sample !== 1) fail('invalid-movie')
    previous = sample
  }
}

function validateChunkCoverage(
  sizes: TableData,
  offsets: readonly number[],
  map: readonly ChunkEntry[],
  layout: AppleWallpaperMovLayout,
  descriptionCount: number,
): number {
  let sampleIndex = 0
  let mapIndex = 0
  const ranges: Array<{ start: number; end: number }> = []
  for (let chunkIndex = 0; chunkIndex < offsets.length; chunkIndex++) {
    const chunkNumber = chunkIndex + 1
    while (mapIndex + 1 < map.length && map[mapIndex + 1].firstChunk <= chunkNumber) mapIndex++
    const entry = map[mapIndex]
    if (!entry || entry.firstChunk > chunkNumber || entry.sampleDescriptionIndex > descriptionCount) fail('invalid-movie')
    if (sampleIndex + entry.samplesPerChunk > sizes.sampleCount) fail('invalid-movie')
    let chunkBytes = 0n
    for (let sample = sampleIndex; sample < sampleIndex + entry.samplesPerChunk; sample++) {
      chunkBytes += BigInt(sizes.sampleSizeAt(sample))
    }
    const chunkStart = BigInt(offsets[chunkIndex])
    const chunkEnd = chunkStart + chunkBytes
    if (chunkEnd > BigInt(layout.mdatBodyEnd) || chunkStart < BigInt(layout.mdatBodyStart)) fail('invalid-movie')
    ranges.push({ start: offsets[chunkIndex], end: Number(chunkEnd) })
    sampleIndex += entry.samplesPerChunk
  }
  if (sampleIndex !== sizes.sampleCount || map[0].firstChunk !== 1) fail('invalid-movie')
  ranges.sort((left, right) => left.start - right.start)
  for (let index = 1; index < ranges.length; index++) {
    if (ranges[index - 1].end > ranges[index].start) fail('invalid-movie')
  }
  return map[0].sampleDescriptionIndex
}

function readTimescale(bytes: Uint8Array, box: Atom, version: number): number {
  const offset = box.payloadStart + (version === 0 ? 12 : 20)
  const scale = readU32(bytes, offset, box.end)
  if (scale === 0) fail('invalid-movie')
  return scale
}

function checkDurationField(bytes: Uint8Array, box: Atom, version: number, relativeOffset: number): void {
  const width = version === 0 ? 4 : 8
  if (box.end - (box.start + box.headerSize + relativeOffset) < width) fail('invalid-movie')
  if (version === 1) readU64(bytes, box.start + box.headerSize + relativeOffset, box.end)
  else readU32(bytes, box.start + box.headerSize + relativeOffset, box.end)
}

function checkFullBox(bytes: Uint8Array, box: Atom, versions: readonly number[], flags?: number): number {
  if (box.end - box.payloadStart < 4) fail('invalid-movie')
  const version = bytes[box.payloadStart]
  const actualFlags = readFlags(bytes, box)
  if (!versions.includes(version) || (flags !== undefined && actualFlags !== flags)) fail('invalid-movie')
  return version
}

function readFlags(bytes: Uint8Array, box: Atom): number {
  return (bytes[box.payloadStart + 1] << 16) |
    (bytes[box.payloadStart + 2] << 8) | bytes[box.payloadStart + 3]
}

function rebuildMovie(bytes: Uint8Array, track: ParsedTrack, movieDuration: bigint, chunkOffset: number): Uint8Array {
  const mvhdVersion = bytes[track.movieHeader.payloadStart]
  const tkhdVersion = bytes[track.trackHeader.payloadStart]
  const mdhdVersion = bytes[track.mediaHeader.payloadStart]
  const mvhd = rewriteDuration(bytes, track.movieHeader, mvhdVersion, mvhdVersion === 0 ? 16 : 24, movieDuration)
  const tkhd = rewriteDuration(bytes, track.trackHeader, tkhdVersion, tkhdVersion === 0 ? 20 : 28, movieDuration)
  const mdhd = rewriteDuration(bytes, track.mediaHeader, mdhdVersion, mdhdVersion === 0 ? 16 : 24,
    BigInt(track.firstSampleDuration))
  const stsd = raw(bytes, track.sampleDescription)
  const stts = makeFullBox('stts', concat(u32(1), u32(1), u32(track.firstSampleDuration)))
  const ctts = makeFullBox('ctts', concat(u32(1), u32(1), u32(0)), track.compositionVersion)
  const stss = makeFullBox('stss', concat(u32(1), u32(1)))
  const stsc = makeFullBox('stsc', concat(u32(1), u32(1), u32(1), u32(track.firstSampleDescriptionIndex)))
  const stsz = makeFullBox('stsz', concat(u32(0), u32(1), u32(track.sampleSize.firstSampleSize)))
  const chunkTable = track.chunkType === 'stco'
    ? makeFullBox('stco', concat(u32(1), u32(chunkOffset)))
    : makeFullBox('co64', concat(u32(1), u64(chunkOffset)))
  if (track.chunkType === 'stco' && chunkOffset > U32_MAX) fail('budget-exceeded')
  const stbl = makeAtom('stbl', concat(stsd, stts, ctts, stss, stsc, stsz, chunkTable))
  const minf = makeAtom('minf', concat(
    raw(bytes, track.videoHeader), raw(bytes, track.dataHandler), raw(bytes, track.dataInfo), stbl,
  ))
  const mdia = makeAtom('mdia', concat(mdhd, raw(bytes, track.handler), minf))
  const trak = makeAtom('trak', concat(tkhd, raw(bytes, track.trackAperture), mdia))
  return makeAtom('moov', concat(mvhd, trak))
}

function rewriteDuration(bytes: Uint8Array, box: Atom, version: number, relativeOffset: number, duration: bigint): Uint8Array {
  const result = raw(bytes, box)
  const offset = box.headerSize + relativeOffset
  if (version === 0) {
    if (duration > BigInt(U32_MAX)) fail('invalid-movie')
    new DataView(result.buffer, result.byteOffset, result.byteLength).setUint32(offset, Number(duration))
  } else {
    new DataView(result.buffer, result.byteOffset, result.byteLength).setBigUint64(offset, duration)
  }
  return result
}

function durationInMovieScale(duration: bigint, movieScale: number, mediaScale: number): bigint {
  return (duration * BigInt(movieScale) + BigInt(mediaScale) - 1n) / BigInt(mediaScale)
}

function raw(bytes: Uint8Array, atom: Atom): Uint8Array {
  return bytes.slice(atom.start, atom.end)
}

function required(atoms: readonly Atom[], type: string): Atom {
  const matches = all(atoms, type)
  if (matches.length !== 1) fail('invalid-movie')
  return matches[0]
}

function all(atoms: readonly Atom[], type: string): Atom[] {
  return atoms.filter(atom => atom.type === type)
}

function assertOnly(atoms: readonly Atom[], allowed: readonly string[]): void {
  for (const atom of atoms) if (!allowed.includes(atom.type)) fail('invalid-movie')
}

function atoms(bytes: Uint8Array, start: number, end: number, expectedCount?: number): Atom[] {
  const result: Atom[] = []
  let cursor = start
  while (cursor < end) {
    if (result.length >= MAX_NESTED_ATOMS) fail('budget-exceeded')
    const atom = atomAt(bytes, cursor, end)
    result.push(atom)
    cursor = atom.end
    if (expectedCount !== undefined && result.length > expectedCount) fail('invalid-movie')
  }
  if (cursor !== end || (expectedCount !== undefined && result.length !== expectedCount)) fail('invalid-movie')
  return result
}

function atomAt(bytes: Uint8Array, start: number, parentEnd: number): Atom {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(parentEnd) || start < 0 || parentEnd > bytes.byteLength ||
      start + 8 > parentEnd) fail('invalid-movie')
  const size32 = readU32(bytes, start, parentEnd)
  const type = readType(bytes, start + 4, parentEnd)
  let headerSize = 8
  let size: number
  if (size32 === 1) {
    if (start + 16 > parentEnd) fail('invalid-movie')
    size = readU64(bytes, start + 8, parentEnd)
    headerSize = 16
  } else {
    if (size32 === 0) fail('invalid-movie')
    size = size32
  }
  if (size < headerSize || start + size > parentEnd || !Number.isSafeInteger(start + size)) fail('invalid-movie')
  return { type, start, end: start + size, headerSize, payloadStart: start + headerSize }
}

function readType(bytes: Uint8Array, offset: number, end: number): string {
  if (offset < 0 || offset + 4 > end) fail('invalid-movie')
  let result = ''
  for (let index = 0; index < 4; index++) {
    const byte = bytes[offset + index]
    if (byte < 0x20 || byte > 0x7e) fail('invalid-movie')
    result += String.fromCharCode(byte)
  }
  return result
}

function readU16(bytes: Uint8Array, offset: number, end: number): number {
  if (offset < 0 || offset + 2 > end) fail('invalid-movie')
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset)
}

function readU32(bytes: Uint8Array, offset: number, end: number): number {
  if (offset < 0 || offset + 4 > end) fail('invalid-movie')
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset)
}

function readU64(bytes: Uint8Array, offset: number, end: number): number {
  if (offset < 0 || offset + 8 > end) fail('invalid-movie')
  const value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(offset)
  if (value > SAFE_BIGINT) fail('invalid-movie')
  return Number(value)
}

function checkedAdd(left: number, right: number): number {
  const result = left + right
  if (!Number.isSafeInteger(result) || result < 0) fail('budget-exceeded')
  return result
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => checkedAdd(sum, part.byteLength), 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.byteLength
  }
  return result
}

function u32(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0 || value > U32_MAX) fail('invalid-movie')
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value)
  return bytes
}

function u64(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) fail('invalid-movie')
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value))
  return bytes
}

function makeAtom(type: string, payload: Uint8Array): Uint8Array {
  const size = checkedAdd(payload.byteLength, 8)
  if (size > U32_MAX || type.length !== 4) fail('budget-exceeded')
  const result = new Uint8Array(size)
  writeU32(result, 0, size)
  writeTypeBytes(result, 4, type)
  result.set(payload, 8)
  return result
}

function makeFullBox(type: string, payload: Uint8Array, version = 0): Uint8Array {
  return makeAtom(type, concat(new Uint8Array([version, 0, 0, 0]), payload))
}

function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > U32_MAX || offset + 4 > bytes.byteLength) fail('invalid-movie')
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(offset, value)
}

function writeType(bytes: Uint8Array, offset: number, type: string): void {
  writeTypeBytes(bytes, offset, type)
}

function writeTypeBytes(bytes: Uint8Array, offset: number, type: string): void {
  if (type.length !== 4 || offset < 0 || offset + 4 > bytes.byteLength) fail('invalid-movie')
  for (let index = 0; index < 4; index++) bytes[offset + index] = type.charCodeAt(index)
}
