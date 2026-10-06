/**
 * [INPUT]: 依赖纯 system-wallpaper MOV 布局解析器与独立人工 Range fixture。
 * [OUTPUT]: 验证有限单轨首sync sample提取、完整单sample MOV重建与畸形/超预算拒绝。
 * [POS]: 固定 Apple 视频下载前的 QuickTime 窄合同；人工fixture不冒充Apple素材或native解码验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AppleWallpaperMovError,
  parseAppleWallpaperMovHeader,
  parseAppleWallpaperFirstSample,
} from '../src/host/system-wallpaper-mov.ts'
import { createSystemWallpaperMovFixture } from './system-wallpaper-mov-fixture.ts'

interface AtomRange { readonly type: string; readonly start: number; readonly end: number; readonly header: number }

function atomAt(bytes: Uint8Array, start: number, end = bytes.byteLength): AtomRange {
  assert.ok(start + 8 <= end)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const size32 = view.getUint32(start)
  const type = new TextDecoder().decode(bytes.subarray(start + 4, start + 8))
  let size = size32
  let header = 8
  if (size32 === 1) {
    const extended = view.getBigUint64(start + 8)
    assert.ok(extended <= BigInt(Number.MAX_SAFE_INTEGER))
    size = Number(extended)
    header = 16
  }
  assert.ok(size >= header && start + size <= end)
  return { type, start, end: start + size, header }
}

function children(bytes: Uint8Array, parent: AtomRange): AtomRange[] {
  const result: AtomRange[] = []
  let cursor = parent.start + parent.header
  while (cursor < parent.end) {
    const child = atomAt(bytes, cursor, parent.end)
    result.push(child)
    cursor = child.end
  }
  assert.equal(cursor, parent.end)
  return result
}

function nestedChildren(bytes: Uint8Array, parent: AtomRange, fixedPayloadBytes: number, trailingBytes = 0): AtomRange[] {
  const result: AtomRange[] = []
  let cursor = parent.start + parent.header + fixedPayloadBytes
  const end = parent.end - trailingBytes
  while (cursor < end) {
    const child = atomAt(bytes, cursor, end)
    result.push(child)
    cursor = child.end
  }
  assert.equal(cursor, end)
  return result
}

function one(bytes: Uint8Array, parent: AtomRange, type: string): AtomRange {
  const found = children(bytes, parent).filter(child => child.type === type)
  assert.equal(found.length, 1, `${parent.type} must contain one ${type}`)
  return found[0]
}

function fullBox(bytes: Uint8Array, atom: AtomRange): { version: number; payload: number } {
  return { version: bytes[atom.start + atom.header], payload: atom.start + atom.header + 4 }
}

function setU32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(offset, value)
}

function u32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset)
}

function u64(bytes: Uint8Array, offset: number): bigint {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(offset)
}

function fixturePlan() {
  const fixture = createSystemWallpaperMovFixture()
  const layout = parseAppleWallpaperMovHeader(fixture.headerPrefix, fixture.sourceTotalBytes)
  const plan = parseAppleWallpaperFirstSample(layout, fixture.moovBytes)
  return { fixture, layout, plan }
}

function reframeMoov(bytes: Uint8Array, ...parts: Uint8Array[]): Uint8Array {
  const payload = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const result = new Uint8Array(payload + 8)
  setU32(result, 0, result.byteLength)
  result.set(new TextEncoder().encode('moov'), 4)
  let offset = 8
  for (const part of parts) { result.set(part, offset); offset += part.byteLength }
  return result
}

function sliceAtom(bytes: Uint8Array, atom: AtomRange): Uint8Array {
  return bytes.slice(atom.start, atom.end)
}

test('固定64B头只计算逻辑Range地址；mdat边界、尾部moov与ftyp原字节精确', () => {
  const fixture = createSystemWallpaperMovFixture(300 * 1024 * 1024)
  const layout = parseAppleWallpaperMovHeader(fixture.headerPrefix, fixture.sourceTotalBytes)
  assert.ok(fixture.sourceTotalBytes > 256 * 1024 * 1024, '大逻辑源长度不会分配整段媒体')
  assert.deepEqual([...layout.ftyp], [...fixture.headerPrefix.slice(0, 20)])
  assert.equal(layout.mdatBodyStart, 36)
  assert.equal(layout.mdatBodyEnd, fixture.moovOffset)
  assert.equal(layout.moovOffset, fixture.moovOffset)
  assert.equal(layout.moovLength, fixture.moovBytes.byteLength)
  assert.throws(() => parseAppleWallpaperMovHeader(fixture.headerPrefix, fixture.sourceTotalBytes, {
    maxSourceLength: 256 * 1024 * 1024,
  }), AppleWallpaperMovError)
});

test('首sample计划限于首sync视频样本，并重建所有单sample索引与零PTS', () => {
  const { fixture, layout, plan } = fixturePlan()
  assert.equal(plan.sourceOffset, fixture.sourceFirstSampleOffset)
  assert.equal(plan.sampleSize, fixture.sourceFirstSampleSize)
  const output = plan.rebuild(fixture.sourceFirstSampleBytes)
  const ftyp = atomAt(output, 0)
  assert.equal(ftyp.type, 'ftyp')
  assert.deepEqual([...output.slice(0, ftyp.end)], [...layout.ftyp])
  const outputAtoms = children(output, { type: 'root', start: 0, end: output.byteLength, header: 0 })
  assert.deepEqual(outputAtoms.map(atom => atom.type), ['ftyp', 'moov', 'mdat'])
  const moov = outputAtoms[1]
  const mdat = outputAtoms[2]
  assert.equal(mdat.end, output.byteLength)
  assert.deepEqual([...output.slice(mdat.start + 8, mdat.end)], [...fixture.sourceFirstSampleBytes])

  const movieHeader = one(output, moov, 'mvhd')
  const track = one(output, moov, 'trak')
  const trackChildren = children(output, track)
  assert.deepEqual(trackChildren.map(atom => atom.type), ['tkhd', 'tapt', 'mdia'], '移除edit list但保留track aperture')
  const trackHeader = one(output, track, 'tkhd')
  const sourceTrack = one(fixture.moovBytes, atomAt(fixture.moovBytes, 0), 'trak')
  const sourceAperture = one(fixture.moovBytes, sourceTrack, 'tapt')
  const outputAperture = one(output, track, 'tapt')
  assert.deepEqual([...sliceAtom(output, outputAperture)], [...sliceAtom(fixture.moovBytes, sourceAperture)])
  const media = one(output, track, 'mdia')
  const mediaHeader = one(output, media, 'mdhd')
  const outputMediaHandler = one(output, media, 'hdlr')
  const mediaInfo = one(output, media, 'minf')
  const outputDataHandler = one(output, mediaInfo, 'hdlr')
  const sourceMediaInfo = one(fixture.moovBytes, one(fixture.moovBytes, sourceTrack, 'mdia'), 'minf')
  const sourceDataHandler = one(fixture.moovBytes, sourceMediaInfo, 'hdlr')
  assert.deepEqual([...sliceAtom(output, outputDataHandler)], [...sliceAtom(fixture.moovBytes, sourceDataHandler)])
  const sourceMedia = one(fixture.moovBytes, sourceTrack, 'mdia')
  const sourceMediaHandler = one(fixture.moovBytes, sourceMedia, 'hdlr')
  assert.deepEqual([...sliceAtom(output, outputMediaHandler)], [...sliceAtom(fixture.moovBytes, sourceMediaHandler)])
  const sampleTable = one(output, mediaInfo, 'stbl')
  const sampleDescription = one(output, sampleTable, 'stsd')
  const stsdEntry = atomAt(output, fullBox(output, sampleDescription).payload + 4)
  const sourceSampleTable = one(fixture.moovBytes, sourceMediaInfo, 'stbl')
  const sourceSampleDescription = one(fixture.moovBytes, sourceSampleTable, 'stsd')
  const sourceEntry = atomAt(fixture.moovBytes, fullBox(fixture.moovBytes, sourceSampleDescription).payload + 4)
  assert.equal(stsdEntry.type, 'hvc1')
  assert.equal(stsdEntry.end - stsdEntry.start, 324)
  const codecAtoms = nestedChildren(output, stsdEntry, 78, 4)
  const sourceCodecAtoms = nestedChildren(fixture.moovBytes, sourceEntry, 78, 4)
  assert.ok(codecAtoms.some(atom => atom.type === 'hvcC'))
  assert.equal(codecAtoms.find(atom => atom.type === 'hvcC')?.end - codecAtoms.find(atom => atom.type === 'hvcC')!.start, 216)
  const outputColor = codecAtoms.find(atom => atom.type === 'colr')!
  const sourceColor = sourceCodecAtoms.find(atom => atom.type === 'colr')!
  assert.equal(new TextDecoder().decode(output.slice(outputColor.start + outputColor.header, outputColor.start + outputColor.header + 4)), 'nclc')
  assert.deepEqual([...sliceAtom(output, outputColor)], [...sliceAtom(fixture.moovBytes, sourceColor)],
    'QuickTime nclc primaries, transfer and matrix values survive byte-for-byte')
  for (const type of ['hvcC', 'colr']) {
    const current = codecAtoms.find(atom => atom.type === type)!
    const source = sourceCodecAtoms.find(atom => atom.type === type)!
    assert.deepEqual([...sliceAtom(output, current)], [...sliceAtom(fixture.moovBytes, source)])
  }
  assert.deepEqual([...output.slice(stsdEntry.end - 4, stsdEntry.end)], [0, 0, 0, 0], 'sample-entry terminator is preserved')
  assert.deepEqual(children(output, sampleTable).map(atom => atom.type),
    ['stsd', 'stts', 'ctts', 'stss', 'stsc', 'stsz', 'stco'], 'old group, timing and dependency tables are omitted')

  const sampleCount = (type: string): number => {
    const box = one(output, sampleTable, type)
    const full = fullBox(output, box)
    return u32(output, full.payload)
  }
  assert.equal(sampleCount('stts'), 1)
  assert.equal(sampleCount('ctts'), 1)
  assert.equal(sampleCount('stss'), 1)
  assert.equal(sampleCount('stsc'), 1)
  assert.equal(sampleCount('stco'), 1)

  const stts = one(output, sampleTable, 'stts')
  const sttsPayload = fullBox(output, stts).payload
  assert.equal(u32(output, sttsPayload + 4), 1)
  assert.equal(u32(output, sttsPayload + 8), 3000)
  const ctts = one(output, sampleTable, 'ctts')
  assert.equal(u32(output, fullBox(output, ctts).payload + 8), 0, '重建后的composition offset归零')
  const stss = one(output, sampleTable, 'stss')
  assert.equal(u32(output, fullBox(output, stss).payload + 4), 1)
  const stsc = one(output, sampleTable, 'stsc')
  const stscPayload = fullBox(output, stsc).payload
  assert.deepEqual([u32(output, stscPayload + 4), u32(output, stscPayload + 8), u32(output, stscPayload + 12)], [1, 1, 1])
  const stsz = one(output, sampleTable, 'stsz')
  const stszPayload = fullBox(output, stsz).payload
  assert.deepEqual([u32(output, stszPayload), u32(output, stszPayload + 4), u32(output, stszPayload + 8)], [0, 1, fixture.sourceFirstSampleSize])
  const stco = one(output, sampleTable, 'stco')
  const sampleOffset = u32(output, fullBox(output, stco).payload + 4)
  assert.equal(sampleOffset, mdat.start + 8)
  assert.ok(sampleOffset >= mdat.start + 8 && sampleOffset + fixture.sourceFirstSampleSize <= mdat.end,
    '保留的sample表引用必须完整落入成品mdat')

  const version0DurationOffset = (box: AtomRange, payloadOffset: number) => box.start + box.header + payloadOffset
  assert.equal(u32(output, version0DurationOffset(movieHeader, 16)), 34, 'mvhd按movie timescale重写')
  assert.equal(u32(output, version0DurationOffset(trackHeader, 20)), 34, 'tkhd按movie timescale重写')
  assert.equal(u32(output, version0DurationOffset(mediaHeader, 16)), 3000, 'mdhd按media timescale重写')
  const sourceTkhd = one(fixture.moovBytes, sourceTrack, 'tkhd')
  const matrixOffset = sourceTkhd.start + sourceTkhd.header + 4 + 4 + 4 + 4 + 4 + 4 + 2 + 2 + 2 + 2
  const outputMatrixOffset = trackHeader.start + trackHeader.header + 4 + 4 + 4 + 4 + 4 + 4 + 2 + 2 + 2 + 2
  assert.deepEqual([...output.slice(outputMatrixOffset, outputMatrixOffset + 36)],
    [...fixture.moovBytes.slice(matrixOffset, matrixOffset + 36)], 'track matrix原字节保留')
});

test('mdhd version 1 重写 duration 时保留 timescale', () => {
  const fixture = createSystemWallpaperMovFixture(undefined, 1)
  const layout = parseAppleWallpaperMovHeader(fixture.headerPrefix, fixture.sourceTotalBytes)
  const plan = parseAppleWallpaperFirstSample(layout, fixture.moovBytes)
  const output = plan.rebuild(fixture.sourceFirstSampleBytes)
  const sourceTrack = one(fixture.moovBytes, atomAt(fixture.moovBytes, 0), 'trak')
  const sourceMdhd = one(fixture.moovBytes, one(fixture.moovBytes, sourceTrack, 'mdia'), 'mdhd')
  const outputTrack = one(output, atomAt(output, 20), 'trak')
  const outputMdhd = one(output, one(output, outputTrack, 'mdia'), 'mdhd')
  const sourceFullBoxStart = sourceMdhd.start + sourceMdhd.header
  const outputFullBoxStart = outputMdhd.start + outputMdhd.header
  assert.equal(fixture.moovBytes[sourceFullBoxStart], 1)
  assert.equal(output[outputFullBoxStart], 1)
  assert.equal(u32(output, outputFullBoxStart + 20), 90000, 'version 1 timescale位于FullBox +20且保留')
  assert.equal(u64(output, outputFullBoxStart + 24), 3000n, 'version 1 duration位于FullBox +24')
});

test('两种已确认的Apple csgm长度均可解析并且不会传播旧样本索引', () => {
  const fixture = createSystemWallpaperMovFixture(undefined, 0, { compositionGroupSize: 53 })
  const layout = parseAppleWallpaperMovHeader(fixture.headerPrefix, fixture.sourceTotalBytes)
  const plan = parseAppleWallpaperFirstSample(layout, fixture.moovBytes)
  const output = plan.rebuild(fixture.sourceFirstSampleBytes)
  const sourceTrack = one(fixture.moovBytes, atomAt(fixture.moovBytes, 0), 'trak')
  const sourceTable = one(fixture.moovBytes,
    one(fixture.moovBytes, one(fixture.moovBytes, sourceTrack, 'mdia'), 'minf'), 'stbl')
  assert.deepEqual(children(fixture.moovBytes, sourceTable)
    .filter(atom => atom.type === 'csgm').map(atom => atom.end - atom.start), [53, 53])
  const outputTable = one(output,
    one(output, one(output, one(output, atomAt(output, 20), 'trak'), 'mdia'), 'minf'), 'stbl')
  assert.deepEqual(children(output, outputTable).map(atom => atom.type),
    ['stsd', 'stts', 'ctts', 'stss', 'stsc', 'stsz', 'stco'])
});

test('拒绝多轨、未知sample表、外部data reference、错误版本与表越界', () => {
  const fixture = createSystemWallpaperMovFixture()
  const original = fixture.moovBytes
  const root = atomAt(original, 0)
  const rootChildren = children(original, root)
  const mvhd = sliceAtom(original, one(original, root, 'mvhd'))
  const trak = sliceAtom(original, one(original, root, 'trak'))
  const multiTrack = reframeMoov(original, mvhd, trak, trak)
  const header = parseAppleWallpaperMovHeader(fixture.headerPrefix, fixture.sourceTotalBytes)
  assert.throws(() => parseAppleWallpaperFirstSample(header, multiTrack), AppleWallpaperMovError)

  const unknownTable = original.slice()
  const stbl = one(unknownTable, one(unknownTable, one(unknownTable, one(unknownTable, atomAt(unknownTable, 0), 'trak'), 'mdia'), 'minf'), 'stbl')
  const junk = new Uint8Array([0, 0, 0, 8, 0x73, 0x65, 0x6e, 0x63])
  const stblChildren = children(unknownTable, stbl).map(child => sliceAtom(unknownTable, child))
  const rebuiltStbl = reframeAtom(unknownTable, 'stbl', [...stblChildren, junk])
  // 重建完整父级树，使恶意子atom仍处于合法长度边界内。
  const unknownMovie = replaceNestedAtom(unknownTable, stbl, rebuiltStbl)
  assert.throws(() => parseAppleWallpaperFirstSample(header, unknownMovie), AppleWallpaperMovError)

  const external = original.slice()
  const externalDinf = one(external, one(external, one(external, one(external, atomAt(external, 0), 'trak'), 'mdia'), 'minf'), 'dinf')
  const externalDref = one(external, externalDinf, 'dref')
  const alias = atomAt(external, externalDref.start + externalDref.header + 8, externalDref.end)
  external[alias.start + 11] = 0
  assert.throws(() => parseAppleWallpaperFirstSample(header, external), AppleWallpaperMovError)
  const unknownReference = original.slice()
  unknownReference.set(new TextEncoder().encode('url '), alias.start + 4)
  assert.throws(() => parseAppleWallpaperFirstSample(header, unknownReference), AppleWallpaperMovError)

  const aliasWithExternalPayload = original.slice()
  const sourceDinf = one(aliasWithExternalPayload,
    one(aliasWithExternalPayload, one(aliasWithExternalPayload,
      one(aliasWithExternalPayload, atomAt(aliasWithExternalPayload, 0), 'trak'), 'mdia'), 'minf'), 'dinf')
  const sourceDref = one(aliasWithExternalPayload, sourceDinf, 'dref')
  const sourceAlias = atomAt(aliasWithExternalPayload, sourceDref.start + sourceDref.header + 8, sourceDref.end)
  setU32(aliasWithExternalPayload, sourceAlias.start, 16)
  assert.throws(() => parseAppleWallpaperFirstSample(header, aliasWithExternalPayload), AppleWallpaperMovError,
    'an alis payload beyond the exact self-contained entry cannot escape the dref boundary')

  const sampleTable = one(original, one(original, one(original, one(original, root, 'trak'), 'mdia'), 'minf'), 'stbl')
  const stsd = one(original, sampleTable, 'stsd')
  const sampleEntry = atomAt(original, fullBox(original, stsd).payload + 4, stsd.end)
  for (const descriptor of ['encv', 'avc1', 'hev1', 'zzzz']) {
    const unsupportedDescription = original.slice()
    unsupportedDescription.set(new TextEncoder().encode(descriptor), sampleEntry.start + 4)
    assert.throws(() => parseAppleWallpaperFirstSample(header, unsupportedDescription), AppleWallpaperMovError)
  }

  const media = one(original, one(original, root, 'trak'), 'mdia')
  const mediaHandler = one(original, media, 'hdlr')
  const dataHandler = one(original, one(original, media, 'minf'), 'hdlr')
  const trackAperture = one(original, one(original, root, 'trak'), 'tapt')
  const firstApertureField = atomAt(original, trackAperture.start + trackAperture.header, trackAperture.end)
  const entryChildren = nestedChildren(original, sampleEntry, 78, 4)
  const codecConfiguration = entryChildren.find(atom => atom.type === 'hvcC')!
  const colorDescription = entryChildren.find(atom => atom.type === 'colr')!
  const sgpd = children(original, sampleTable).find(atom => atom.type === 'sgpd')!
  const dependencyTable = one(original, sampleTable, 'sdtp')
  const malformedSources = [
    (bytes: Uint8Array) => { bytes[firstApertureField.start + 4] = 0x78 },
    (bytes: Uint8Array) => { bytes[mediaHandler.start + mediaHandler.header + 8] = 0x73 },
    (bytes: Uint8Array) => { bytes[dataHandler.start + dataHandler.header + 4] = 0x78 },
    (bytes: Uint8Array) => { bytes[codecConfiguration.start + codecConfiguration.header] = 0 },
    (bytes: Uint8Array) => { bytes[colorDescription.start + 4] = 0x6e },
    (bytes: Uint8Array) => { bytes[sampleEntry.end - 1] = 1 },
    (bytes: Uint8Array) => { bytes[sgpd.start + sgpd.header] = 0 },
    (bytes: Uint8Array) => { bytes[sgpd.start + sgpd.header + 4] = 0x73 },
    (bytes: Uint8Array) => { bytes[dependencyTable.start + dependencyTable.header + 4] = 1 },
  ]
  for (const [index, mutate] of malformedSources.entries()) {
    const malformed = original.slice()
    mutate(malformed)
    assert.throws(() => parseAppleWallpaperFirstSample(header, malformed), AppleWallpaperMovError,
      `malformed known auxiliary layout ${index} must fail closed`)
  }

  for (const mutate of [
    (bytes: Uint8Array) => { bytes[findAtom(bytes, 'stts').start + 8] = 1 },
    (bytes: Uint8Array) => setU32(bytes, findAtom(bytes, 'stss').start + 16, 2),
    (bytes: Uint8Array) => setU32(bytes, findAtom(bytes, 'stsc').start + 16, 2),
    (bytes: Uint8Array) => setU32(bytes, findAtom(bytes, 'stco').start + 16, header.mdatBodyEnd),
    (bytes: Uint8Array) => setU32(bytes, findAtom(bytes, 'mvhd').start, 0xffffffff),
  ]) {
    const malformed = original.slice()
    mutate(malformed)
    assert.throws(() => parseAppleWallpaperFirstSample(header, malformed), AppleWallpaperMovError)
  }
  assert.equal(rootChildren.length, 2)
});

test('有界元数据与sample预算为硬门，错误64B头及不安全逻辑长度不触发分配', () => {
  const fixture = createSystemWallpaperMovFixture()
  assert.throws(() => parseAppleWallpaperMovHeader(fixture.headerPrefix.slice(0, 63), fixture.sourceTotalBytes), AppleWallpaperMovError)
  assert.throws(() => parseAppleWallpaperMovHeader(fixture.headerPrefix, Number.MAX_SAFE_INTEGER + 1), AppleWallpaperMovError)
  assert.throws(() => parseAppleWallpaperMovHeader(fixture.headerPrefix, fixture.sourceTotalBytes, {
    maxMetadataBytes: 64,
  }), AppleWallpaperMovError)
  const layout = parseAppleWallpaperMovHeader(fixture.headerPrefix, fixture.sourceTotalBytes)
  assert.throws(() => parseAppleWallpaperFirstSample(layout, fixture.moovBytes, {
    maxSampleBytes: fixture.sourceFirstSampleSize - 1,
  }), AppleWallpaperMovError)
});

function findAtom(bytes: Uint8Array, type: string): AtomRange {
  const root = atomAt(bytes, 0)
  const visit = (parent: AtomRange): AtomRange | undefined => {
    for (const child of children(bytes, parent)) {
      if (child.type === type) return child
      if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(child.type)) {
        const nested = visit(child)
        if (nested) return nested
      }
    }
    return undefined
  }
  const found = root.type === type ? root : visit(root)
  assert.ok(found, `missing ${type}`)
  return found
}

function replaceNestedAtom(bytes: Uint8Array, target: AtomRange, replacement: Uint8Array): Uint8Array {
  const root = atomAt(bytes, 0)
  const rootChildren = children(bytes, root)
  const replace = (parent: AtomRange, targetRange: AtomRange): Uint8Array => {
    const parts = children(bytes, parent).map(child => {
      if (child.start === targetRange.start) return replacement
      if (['trak', 'mdia', 'minf'].includes(child.type)) return replace(child, targetRange)
      return sliceAtom(bytes, child)
    })
    return reframeAtom(bytes, parent.type, parts)
  }
  const rebuilt = rootChildren.map(child => child.start === target.start
    ? replacement
    : ['trak', 'mdia', 'minf'].includes(child.type) ? replace(child, target) : sliceAtom(bytes, child))
  return reframeAtom(bytes, 'moov', rebuilt)
}

function reframeAtom(_bytes: Uint8Array, type: string, parts: Uint8Array[]): Uint8Array {
  const payloadSize = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const result = new Uint8Array(payloadSize + 8)
  setU32(result, 0, result.byteLength)
  result.set(new TextEncoder().encode(type), 4)
  let offset = 8
  for (const part of parts) { result.set(part, offset); offset += part.byteLength }
  return result
}
