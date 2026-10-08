/**
 * [INPUT]: 依赖 Client capture consumer、固定 PNG 合成器和 fake RemoteStreamHandle。
 * [OUTPUT]: 验证 PNG 帧序、CRC 与单次解码；可选几何绑定同图摘要，超时退让且取消阻止迟到查询。
 * [POS]: Client 本地图片边界合同；所有数据留在内存，不连接网络或落盘。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
import test from 'node:test';
import { consumeCaptureOnce } from '../src/client/capture/window-capture-stream.ts';
import { CAPTURE_LIMITS } from '../src/shared/window-capture-protocol.ts';
import { CAPTURE_GEOMETRY_QUERY_TIMEOUT_MS } from '../src/shared/capture-geometry.ts';

function pngChunk(type, body) {
  const name = Buffer.from(type);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length);
  const crcInput = Buffer.concat([name, body]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([header, name, body, checksum]);
}

function onePixelPng() {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const idat = deflateSync(Buffer.from([0, 0, 0, 0, 255]));
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

function handleOf(frames, { failAt, failAfterFrames = false } = {}) {
  let disposed = 0;
  const handle = {
    dispose() { disposed++; }, send() {}, end() {},
    async *[Symbol.asyncIterator]() {
      for (const frame of frames) {
        if (failAt === frame.type) throw new Error('carrier-private-detail');
        yield frame;
      }
      if (failAfterFrames) throw new Error('carrier-private-detail');
    },
  };
  return { handle, get disposed() { return disposed; } };
}

function successfulFrames(png) {
  const chunkCount = Math.ceil(png.length / CAPTURE_LIMITS.pngChunkBytes);
  const frames = [
    { type: 'phase', phase: 'capture-ready' },
    { type: 'image', scope: 'owned-window', width: 1, height: 1, pointPixelScale: 2, pngBytes: png.length, chunkCount },
  ];
  for (let index = 0; index < chunkCount; index++) {
    frames.push({ type: 'chunk', index, base64: png.subarray(index * CAPTURE_LIMITS.pngChunkBytes, (index + 1) * CAPTURE_LIMITS.pngChunkBytes).toString('base64') });
  }
  frames.push({ type: 'terminal', status: 'captured' });
  return frames;
}

test('可选几何绑定同张 PNG 摘要，异常扩展不丢基础照片', async () => {
  const png = onePixelPng();
  const geometry = { x: 0, y: 0, width: 1, height: 1, pointPixelScale: 2 };
  for (const value of [geometry, null, { ...geometry, x: 1 }, { ...geometry, screenX: 5 }]) {
    let reads = 0;
    const result = await consumeCaptureOnce(() => handleOf(successfulFrames(png)).handle, {
      crypto: webcrypto,
      readGeometry: async sha => { reads++; assert.equal(sha, createHash('sha256').update(png).digest('hex')); return value; },
      createObjectURL: () => 'blob:geometry', revokeObjectURL() {},
      decode: async (_url, expected) => expected,
    });
    assert.equal(reads, 1);
    assert.deepEqual(result.geometry, value === geometry ? geometry : undefined);
    result.release();
  }
  const result = await consumeCaptureOnce(() => handleOf(successfulFrames(png)).handle, {
    crypto: webcrypto, readGeometry: async () => { throw Error('private-carrier'); },
    createObjectURL: () => 'blob:geometry-unavailable', revokeObjectURL() {},
    decode: async (_url, expected) => expected,
  });
  assert.equal(result.geometry, undefined);
  result.release();
});

test('几何查询超时回退照片，取消及时归还且阻止迟到结果', async () => {
  const png = onePixelPng();
  for (const cancel of [false, true]) {
    const controller = new AbortController(); let querySignal, startQuery, resolveQuery, revoked = 0;
    const started = new Promise(resolve => { startQuery = resolve; });
    const pending = consumeCaptureOnce(() => handleOf(successfulFrames(png)).handle, {
      crypto: webcrypto, signal: controller.signal,
      readGeometry: (_sha, signal) => { querySignal = signal; startQuery(); return new Promise(resolve => { resolveQuery = resolve; }); },
      createObjectURL: () => 'blob:bounded-geometry', revokeObjectURL() { revoked++; },
      decode: async (_url, expected) => expected,
    });
    await started;
    if (cancel) {
      controller.abort(); await assert.rejects(pending, /cancelled/); assert.equal(revoked, 1);
    } else {
      const result = await Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(Error('unbounded query')), CAPTURE_GEOMETRY_QUERY_TIMEOUT_MS + 200))]);
      assert.equal(result.geometry, undefined); result.release();
    }
    assert.equal(querySignal.aborted, true);
    resolveQuery({ x: 0, y: 0, width: 1, height: 1, pointPixelScale: 2 });
  }
});

test('exactly one endpoint open; retain local URL only after envelope/CRC checks and decoder acceptance', async () => {
  const png = onePixelPng();
  const owned = handleOf(successfulFrames(png));
  let opens = 0, decoded = 0, allocated = 0, revoked = 0;
  const result = await consumeCaptureOnce(signal => {
    opens++;
    assert.ok(signal instanceof AbortSignal);
    return owned.handle;
  }, {
    signal: new AbortController().signal,
    createObjectURL: blob => { allocated++; assert.equal(blob.type, 'image/png'); return 'blob:local-only'; },
    revokeObjectURL: url => { revoked++; assert.equal(url, 'blob:local-only'); },
    decode: async (url, expected) => {
      decoded++; assert.equal(url, 'blob:local-only'); assert.deepEqual(expected, { width: 1, height: 1 });
      return { width: 1, height: 1 };
    },
  });
  assert.equal(opens, 1);
  assert.equal(decoded, 1);
  assert.equal(allocated, 1);
  assert.equal(owned.disposed, 1);
  assert.equal(result.url, 'blob:local-only');
  assert.equal(result.scope, 'owned-window');
  assert.equal(result.pointPixelScale,2);
  result.release();
  assert.equal(revoked, 1);
});

test('abort during a pending decoder promptly disposes carrier and local URL; late decode cannot deliver', async () => {
  const png = onePixelPng();
  const owned = handleOf(successfulFrames(png));
  const controller = new AbortController();
  let resolveDecode;
  let decoderStarted;
  const started = new Promise(resolve => { decoderStarted = resolve; });
  const pendingDecode = new Promise(resolve => { resolveDecode = resolve; });
  let revoked = 0;
  let delivered = false;
  const operation = consumeCaptureOnce(() => owned.handle, {
    signal: controller.signal,
    createObjectURL: () => 'blob:pending-decode',
    revokeObjectURL: url => { assert.equal(url, 'blob:pending-decode'); revoked++; },
    decode: () => { decoderStarted(); return pendingDecode; },
  }).then(value => { delivered = true; return { value }; }, error => ({ error }));

  try {
    await started;
    controller.abort();
    const promptlySettled = await Promise.race([
      operation.then(() => true),
      new Promise(resolve => setTimeout(() => resolve(false), 25)),
    ]);
    assert.equal(promptlySettled, true, 'abort-does-not-wait-for-image-decode');
    assert.equal(owned.disposed, 1, 'carrier-disposed-after-abort');
    assert.equal(revoked, 1, 'temporary-url-revoked-after-abort');
    const outcome = await operation;
    assert.equal(outcome.error?.code, 'cancelled');
    resolveDecode({ width: 1, height: 1 });
    await Promise.resolve();
    assert.equal(delivered, false, 'late-decode-cannot-deliver');
  } finally {
    resolveDecode({ width: 1, height: 1 });
    await operation;
  }
});

test('corrupt frame or PNG never survives and handle is disposed once', async () => {
  const png = onePixelPng();
  const frames = successfulFrames(png);
  const lastChunk = frames.find(frame => frame.type === 'chunk');
  lastChunk.base64 = Buffer.from([0, 0, 0]).toString('base64');
  const owned = handleOf(frames);
  let allocated = 0, decoded = 0;
  await assert.rejects(consumeCaptureOnce(() => owned.handle, {
    createObjectURL: () => { allocated++; return 'blob:bad'; },
    revokeObjectURL() {},
    decode: async () => { decoded++; return { width: 1, height: 1 }; },
  }), error => error.code === 'invalid-capture');
  assert.equal(allocated, 0);
  assert.equal(decoded, 0);
  assert.equal(owned.disposed, 1);
});

test('wrong chunk order and mismatched pixel metadata are rejected before decode', async () => {
  const png = onePixelPng();
  const frames = successfulFrames(png);
  frames[1].width = 2;
  const owned = handleOf(frames);
  let decoded = false;
  await assert.rejects(consumeCaptureOnce(() => owned.handle, {
    createObjectURL: () => 'blob:bad', revokeObjectURL() {}, decode: async () => { decoded = true; return { width: 1, height: 1 }; },
  }), error => error.code === 'invalid-capture');
  assert.equal(decoded, false);
  assert.equal(owned.disposed, 1);
});

test('carrier rejection is sanitized and never opens another generation', async () => {
  const owned = handleOf(successfulFrames(onePixelPng()), { failAt: 'image' });
  let opens = 0;
  await assert.rejects(consumeCaptureOnce(() => { opens++; return owned.handle; }), error => {
    assert.equal(error.code, 'stream-failed');
    assert.doesNotMatch(error.message, /private-detail/);
    return true;
  });
  assert.equal(opens, 1);
  assert.equal(owned.disposed, 1);
});

test('a captured terminal is not success until the Remote stream naturally ends', async () => {
  const frames = successfulFrames(onePixelPng());
  const withTail = handleOf([...frames, { type: 'phase', phase: 'capture-ready' }]);
  let allocated = 0;
  await assert.rejects(consumeCaptureOnce(() => withTail.handle, {
    createObjectURL: () => { allocated++; return 'blob:tail'; }, revokeObjectURL() {},
    decode: async () => ({ width: 1, height: 1 }),
  }), error => error.code === 'invalid-capture');
  assert.equal(allocated, 0);
  assert.equal(withTail.disposed, 1);
});

test('a carrier failure after captured terminal cannot be promoted to success', async () => {
  const owned = handleOf(successfulFrames(onePixelPng()), { failAfterFrames: true });
  let allocated = 0;
  await assert.rejects(consumeCaptureOnce(() => owned.handle, {
    createObjectURL: () => { allocated++; return 'blob:late-error'; }, revokeObjectURL() {},
    decode: async () => ({ width: 1, height: 1 }),
  }), error => error.code === 'stream-failed');
  assert.equal(allocated, 0);
  assert.equal(owned.disposed, 1);
});

test('service constants enforce fixed chunk, total-byte and frame ceilings', () => {
  assert.deepEqual(CAPTURE_LIMITS, { maxBytes: 128 * 1024 * 1024, pngChunkBytes: 32 * 1024, maxChunks: 4096, maxPixels: 16 * 1024 * 1024 });
});
