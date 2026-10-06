/**
 * [INPUT]: 依赖无外部资源的 QuickTime atom 编码；可选逻辑 source length 仅改变 mdat 地址范围。
 * [OUTPUT]: 提供 64B 头、moov、首 sample 与小型完整源电影，可模拟大于本地媒体预算的 Range 源。
 * [POS]: system-wallpaper MOV 解析器与下载器共用的人工测试夹具；不代表 Apple 素材或 native 解码证据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

function u16(value: number): Uint8Array {
  const bytes = new Uint8Array(2)
  new DataView(bytes.buffer).setUint16(0, value)
  return bytes
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value)
  return bytes
}

function u64(value: number): Uint8Array {
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value))
  return bytes
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.byteLength, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.byteLength
  }
  return result
}

function atom(type: string, payload = new Uint8Array()): Uint8Array {
  return concat(u32(payload.byteLength + 8), text(type), payload)
}

function fullBox(type: string, payload: Uint8Array, flags = 0, version = 0): Uint8Array {
  return atom(type, concat(new Uint8Array([version, flags >>> 16, flags >>> 8, flags]), payload))
}

function matrix(): Uint8Array {
  return concat(...[
    0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000,
  ].map(u32))
}

function makeMovieHeader(): Uint8Array {
  return fullBox('mvhd', concat(
    u32(0), u32(0), u32(1000), u32(100), u32(0x00010000), u16(0x0100),
    new Uint8Array(10), matrix(), new Uint8Array(24), u32(2),
  ))
}

function makeTrackHeader(): Uint8Array {
  return fullBox('tkhd', concat(
    u32(0), u32(0), u32(1), u32(0), u32(100),
    u16(0), u16(0), u16(0), u16(0), matrix(), u32(1920 << 16), u32(1080 << 16),
  ), 15)
}

function makeTrackAperture(): Uint8Array {
  const fields = concat(u32(1920), u32(1080))
  return atom('tapt', concat(
    fullBox('clef', fields), fullBox('prof', fields), fullBox('enof', fields),
  ))
}

function makeMediaHeader(version: 0 | 1): Uint8Array {
  const payload = version === 0
    ? concat(u32(0), u32(0), u32(90000), u32(9000), u16(0x55c4), u16(0))
    : concat(u64(0), u64(0), u32(90000), u64(9000), u16(0x55c4), u16(0))
  return fullBox('mdhd', payload, 0, version)
}

function makeHandler(): Uint8Array {
  return fullBox('hdlr', concat(text('mhlr'), text('vide'), new Uint8Array(12), new Uint8Array(17)))
}

function makeDataHandler(): Uint8Array {
  return fullBox('hdlr', concat(text('dhlr'), text('alis'), new Uint8Array(12), new Uint8Array(24)))
}

function makeVideoSampleEntry(): Uint8Array {
  const fixed = new Uint8Array(78)
  fixed[7] = 1 // 数据引用索引指向自包含dref的第一项。
  new DataView(fixed.buffer).setUint16(24, 1920)
  new DataView(fixed.buffer).setUint16(26, 1080)
  const codecConfiguration = new Uint8Array(208)
  codecConfiguration[0] = 1
  const hvcC = atom('hvcC', codecConfiguration)
  const colr = atom('colr', concat(text('nclc'), u16(12), u16(13), u16(1)))
  return atom('hvc1', concat(fixed, hvcC, colr, new Uint8Array(4)))
}

function makeSampleDescription(): Uint8Array {
  return fullBox('stsd', concat(u32(1), makeVideoSampleEntry()))
}

function makeDataInformation(): Uint8Array {
  const localAlias = fullBox('alis', new Uint8Array(), 1)
  return atom('dinf', fullBox('dref', concat(u32(1), localAlias)))
}

function makeSampleGroups(compositionGroupSize: 53 | 68): Uint8Array[] {
  const tsclEntries = new Uint8Array(100)
  const tscl = fullBox('sgpd', concat(text('tscl'), u32(20), u32(5), tsclEntries), 0, 1)
  const tsas = fullBox('sgpd', concat(text('tsas'), u32(0), u32(1), u32(0)), 0, 1)
  const compositionGroup = (groupingType: 'tscl' | 'tsas') => fullBox(
    'csgm', concat(text(groupingType), u32(0), u32(4), new Uint8Array(compositionGroupSize - 24)),
  )
  const cslg = fullBox('cslg', new Uint8Array(20))
  const sdtp = fullBox('sdtp', new Uint8Array(2))
  return [tscl, tsas, compositionGroup('tscl'), compositionGroup('tsas'), cslg, sdtp]
}

function makeSampleTable(compositionGroupSize: 53 | 68): Uint8Array {
  const sampleCount = 2
  const stts = fullBox('stts', concat(u32(2), u32(1), u32(3000), u32(1), u32(6000)))
  const ctts = fullBox('ctts', concat(u32(2), u32(1), u32(120), u32(1), u32(0)))
  const stss = fullBox('stss', concat(u32(1), u32(1)))
  const stsc = fullBox('stsc', concat(u32(1), u32(1), u32(sampleCount), u32(1)))
  const stsz = fullBox('stsz', concat(u32(0), u32(sampleCount), u32(6), u32(4)))
  const stco = fullBox('stco', concat(u32(1), u32(36)))
  return atom('stbl', concat(
    makeSampleDescription(), stts, ctts, stss, stsc, stsz, stco, ...makeSampleGroups(compositionGroupSize),
  ))
}

function makeMediaInformation(compositionGroupSize: 53 | 68): Uint8Array {
  const vmhd = fullBox('vmhd', concat(u16(0), new Uint8Array(6)), 1)
  return atom('minf', concat(vmhd, makeDataHandler(), makeDataInformation(), makeSampleTable(compositionGroupSize)))
}

function makeMedia(version: 0 | 1, compositionGroupSize: 53 | 68): Uint8Array {
  return atom('mdia', concat(makeMediaHeader(version), makeHandler(), makeMediaInformation(compositionGroupSize)))
}

function makeTrack(mdhdVersion: 0 | 1, compositionGroupSize: 53 | 68): Uint8Array {
  const editList = atom('edts', atom('elst', new Uint8Array(8)))
  return atom('trak', concat(
    makeTrackHeader(), makeTrackAperture(), editList, makeMedia(mdhdVersion, compositionGroupSize),
  ))
}

function makeMoov(mdhdVersion: 0 | 1, compositionGroupSize: 53 | 68): Uint8Array {
  return atom('moov', concat(makeMovieHeader(), makeTrack(mdhdVersion, compositionGroupSize)))
}

function writeAtomHeader(bytes: Uint8Array, offset: number, type: string, size: number): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  view.setUint32(offset, size)
  bytes.set(text(type), offset + 4)
}

export interface SystemWallpaperMovFixture {
  readonly headerPrefix: Uint8Array
  readonly moovBytes: Uint8Array
  readonly sourceFirstSampleBytes: Uint8Array
  readonly sourceTotalBytes: number
  readonly sourceFirstSampleOffset: number
  readonly sourceFirstSampleSize: number
  readonly moovOffset: number
  readonly movieBytes?: Uint8Array
}

export interface SystemWallpaperMovFixtureOptions {
  readonly compositionGroupSize?: 53 | 68
}

/**
 * 创建小型双 sample MOV；第一个 sample 为 sync，edit list 与非零 ctts 专供重建回归。
 * 较大 logical length 不分配完整源媒体，只扩展 mdat 地址范围供 Range 合同使用。
 */
export function createSystemWallpaperMovFixture(
  sourceTotalBytes?: number,
  mdhdVersion: 0 | 1 = 0,
  options: SystemWallpaperMovFixtureOptions = {},
): SystemWallpaperMovFixture {
  const ftyp = atom('ftyp', concat(text('qt  '), u32(0), text('qt  ')))
  const wide = atom('wide')
  const firstSample = new Uint8Array([0x11, 0x22, 0x33, 0x44, 0x55, 0x66])
  const secondSample = new Uint8Array([0x77, 0x88, 0x99, 0xaa])
  const compositionGroupSize = options.compositionGroupSize ?? 68
  if (compositionGroupSize !== 53 && compositionGroupSize !== 68) throw new RangeError('不支持的fixture辅助表长度')
  const moov = makeMoov(mdhdVersion, compositionGroupSize)
  const defaultTotal = 36 + firstSample.byteLength + secondSample.byteLength + moov.byteLength
  const total = sourceTotalBytes ?? defaultTotal
  if (!Number.isSafeInteger(total) || total < defaultTotal) throw new RangeError('fixture source too short')
  const moovOffset = total - moov.byteLength
  const mdatSize = moovOffset - 28
  if (!Number.isSafeInteger(mdatSize) || mdatSize > 0xffffffff) throw new RangeError('fixture mdat is not supported')

  const headerPrefix = new Uint8Array(64)
  headerPrefix.set(ftyp, 0)
  headerPrefix.set(wide, ftyp.byteLength)
  writeAtomHeader(headerPrefix, 28, 'mdat', mdatSize)
  headerPrefix.set(firstSample, 36)
  headerPrefix.set(secondSample, 36 + firstSample.byteLength)

  let movieBytes: Uint8Array | undefined
  if (total <= 1024 * 1024) {
    movieBytes = new Uint8Array(total)
    movieBytes.set(ftyp, 0)
    movieBytes.set(wide, ftyp.byteLength)
    writeAtomHeader(movieBytes, 28, 'mdat', mdatSize)
    movieBytes.set(firstSample, 36)
    movieBytes.set(secondSample, 36 + firstSample.byteLength)
    movieBytes.set(moov, moovOffset)
  }

  return {
    headerPrefix,
    moovBytes: moov.slice(),
    sourceFirstSampleBytes: firstSample,
    sourceTotalBytes: total,
    sourceFirstSampleOffset: 36,
    sourceFirstSampleSize: firstSample.byteLength,
    moovOffset,
    ...(movieBytes ? { movieBytes } : {}),
  }
}

export const SYSTEM_WALLPAPER_MOV_FIXTURE = createSystemWallpaperMovFixture()
