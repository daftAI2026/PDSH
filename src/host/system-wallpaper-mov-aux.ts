/**
 * [INPUT]: 依赖MOV解析器已界定的atom范围、QuickTime tapt/data handler与固定Apple辅助sample atoms。
 * [OUTPUT]: 验证并保留track aperture/data handler，验证hvc1+hvcC/colr边界与可安全丢弃的旧样本辅助表。
 * [POS]: system-wallpaper-mov 的窄格式辅助校验；不解析通用容器、不读取文件或访问网络。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export interface MovAtomRange {
  readonly type: string
  readonly start: number
  readonly end: number
  readonly headerSize: number
  readonly payloadStart: number
}

export class MovAuxiliaryValidationError extends Error {
  constructor() {
    super('invalid-movie')
    this.name = 'MovAuxiliaryValidationError'
  }
}

export function validateTrackAperture(
  bytes: Uint8Array,
  tapt: MovAtomRange,
  children: readonly MovAtomRange[],
): void {
  if (tapt.end - tapt.start !== 68 || children.length !== 3) fail()
  const expected = ['clef', 'prof', 'enof']
  for (let index = 0; index < expected.length; index++) {
    const box = children[index]
    if (box.type !== expected[index] || box.end - box.start !== 20) fail()
    fullBox(bytes, box, 0, 0)
    if (readU32(bytes, box.payloadStart + 4, box.end) === 0 ||
        readU32(bytes, box.payloadStart + 8, box.end) === 0) fail()
  }
}

export function validateDataHandler(bytes: Uint8Array, box: MovAtomRange): void {
  if (box.type !== 'hdlr' || box.end - box.start !== 56) fail()
  fullBox(bytes, box, 0, 0)
  if (readType(bytes, box.payloadStart + 4, box.end) !== 'dhlr' ||
      readType(bytes, box.payloadStart + 8, box.end) !== 'alis') fail()
}

export function validateMediaHandler(bytes: Uint8Array, box: MovAtomRange): void {
  if (box.type !== 'hdlr' || box.end - box.start !== 49) fail()
  fullBox(bytes, box, 0, 0)
  if (readType(bytes, box.payloadStart + 4, box.end) !== 'mhlr' ||
      readType(bytes, box.payloadStart + 8, box.end) !== 'vide') fail()
}

export function validateHevcSampleEntry(
  bytes: Uint8Array,
  entry: MovAtomRange,
  children: readonly MovAtomRange[],
): void {
  if (entry.type !== 'hvc1' || children.length !== 2) fail()
  const [config, color] = children
  if (config.type !== 'hvcC' || config.end - config.payloadStart < 23 || bytes[config.payloadStart] !== 1) fail()
  if (color.type !== 'colr' || color.end - color.start !== 18 ||
      readType(bytes, color.payloadStart, color.end) !== 'nclc' || color.end - color.payloadStart !== 10) fail()
  const trailer = entry.end - 4
  if (children[children.length - 1].end !== trailer ||
      bytes[trailer] !== 0 || bytes[trailer + 1] !== 0 || bytes[trailer + 2] !== 0 || bytes[trailer + 3] !== 0) fail()
}

/** 仅白名单辅助表可丢弃；它们携带的是原电影的分组、偏移或依赖索引。 */
export function validateAuxiliarySampleTables(
  bytes: Uint8Array,
  children: readonly MovAtomRange[],
  sampleCount: number,
): void {
  const descriptions = children.filter(box => box.type === 'sgpd')
  if (descriptions.length !== 2) fail()
  const groups = new Set<string>()
  for (const box of descriptions) {
    fullBox(bytes, box, 1, 0)
    const groupingType = readType(bytes, box.payloadStart + 4, box.end)
    const defaultLength = readU32(bytes, box.payloadStart + 8, box.end)
    const entryCount = readU32(bytes, box.payloadStart + 12, box.end)
    const payloadLength = box.end - (box.payloadStart + 16)
    if (groupingType === 'tscl') {
      if (box.end - box.start !== 124 || defaultLength !== 20 || entryCount !== 5 || payloadLength !== 100) fail()
    } else if (groupingType === 'tsas') {
      if (box.end - box.start !== 28 || defaultLength !== 0 || entryCount !== 1 || payloadLength !== 4 ||
          readU32(bytes, box.payloadStart + 16, box.end) !== 0) fail()
    } else fail()
    if (groups.has(groupingType)) fail()
    groups.add(groupingType)
  }
  if (!groups.has('tscl') || !groups.has('tsas')) fail()

  const compositionGroups = children.filter(box => box.type === 'csgm')
  if (compositionGroups.length !== 2) fail()
  const compositionTypes = new Set<string>()
  for (const box of compositionGroups) {
    const groupingType = readType(bytes, box.payloadStart + 4, box.end)
    if ((groupingType !== 'tscl' && groupingType !== 'tsas') ||
        (box.end - box.start !== 68 && box.end - box.start !== 53) ||
        !versionFlags(bytes, box, 0, 0) || readU32(bytes, box.payloadStart + 8, box.end) !== 0 ||
        readU32(bytes, box.payloadStart + 12, box.end) !== 4 || compositionTypes.has(groupingType)) fail()
    compositionTypes.add(groupingType)
  }
  if (!compositionTypes.has('tscl') || !compositionTypes.has('tsas') ||
      compositionGroups[0].end - compositionGroups[0].start !== compositionGroups[1].end - compositionGroups[1].start) fail()

  const compositionShift = only(children, 'cslg')
  if (compositionShift.end - compositionShift.start !== 32 || !versionFlags(bytes, compositionShift, 0, 0)) fail()
  const dependencies = only(children, 'sdtp')
  if (dependencies.end - dependencies.start !== sampleCount + 12 ||
      !versionFlags(bytes, dependencies, 0, 0) || bytes[dependencies.payloadStart + 4] !== 0) fail()
}

function only(children: readonly MovAtomRange[], type: string): MovAtomRange {
  const values = children.filter(box => box.type === type)
  if (values.length !== 1) fail()
  return values[0]
}

function fullBox(bytes: Uint8Array, box: MovAtomRange, version: number, flags: number): void {
  if (box.end - box.payloadStart < 4 || !versionFlags(bytes, box, version, flags)) fail()
}

function versionFlags(bytes: Uint8Array, box: MovAtomRange, version: number, flags: number): boolean {
  if (box.end - box.payloadStart < 4) return false
  const actualFlags = (bytes[box.payloadStart + 1] << 16) |
    (bytes[box.payloadStart + 2] << 8) | bytes[box.payloadStart + 3]
  return bytes[box.payloadStart] === version && actualFlags === flags
}

function readType(bytes: Uint8Array, offset: number, end: number): string {
  if (offset < 0 || offset + 4 > end) fail()
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
}

function readU32(bytes: Uint8Array, offset: number, end: number): number {
  if (offset < 0 || offset + 4 > end) fail()
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset)
}

function fail(): never {
  throw new MovAuxiliaryValidationError()
}
