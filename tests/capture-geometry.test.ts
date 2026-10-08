/**
 * [INPUT]: 依赖 shared capture geometry 的值校验器与固定 PNG 摘要语法。
 * [OUTPUT]: 验证闭集 DTO、物理像素边界、原生比例与 SHA-256 digest 围栏。
 * [POS]: Capture geometry 纯合同测试；不启动 Host、native helper、图像或 Gateway。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CAPTURE_GEOMETRY_QUERY_TIMEOUT_MS,
  isCaptureGeometry,
  isCapturePngSha256,
} from '../src/shared/capture-geometry.ts'

const geometry = { x: 8, y: 12, width: 640, height: 480, pointPixelScale: 1.5 }
const source = { width: 1280, height: 960, pointPixelScale: 1.5 }

test('接受 PNG 内相对物理像素视口与匹配的原生比例', () => {
  assert.equal(isCaptureGeometry(geometry), true)
  assert.equal(isCaptureGeometry(geometry, source), true)
})

test('拒绝额外字段、伪造对象、非整数边界、越界矩形和比例漂移', () => {
  const invalid = [
    { ...geometry, screenX: 20 },
    { ...geometry, x: -1 },
    { ...geometry, y: 0.5 },
    { ...geometry, width: 0 },
    { ...geometry, width: Number.MAX_SAFE_INTEGER },
    { ...geometry, pointPixelScale: Number.POSITIVE_INFINITY },
    Object.assign(Object.create({ inherited: true }), geometry),
  ]
  for (const value of invalid) assert.equal(isCaptureGeometry(value, source), false)
  assert.equal(isCaptureGeometry({ ...geometry, x: 900 }, source), false)
  assert.equal(isCaptureGeometry({ ...geometry, pointPixelScale: 2 }, source), false)
})

test('digest 只接受小写、固定 64 位十六进制 SHA-256', () => {
  assert.equal(isCapturePngSha256('a'.repeat(64)), true)
  assert.equal(isCapturePngSha256('A'.repeat(64)), false)
  assert.equal(isCapturePngSha256('a'.repeat(63)), false)
  assert.equal(isCapturePngSha256('a'.repeat(65_536)), false)
  assert.equal(isCapturePngSha256('g'.repeat(64)), false)
  assert.equal(isCapturePngSha256(new String('a'.repeat(64))), false)
})

test('几何查询上限固定为短时可选能力', () => {
  assert.equal(CAPTURE_GEOMETRY_QUERY_TIMEOUT_MS, 1_500)
})
