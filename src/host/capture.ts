/**
 * [INPUT]: 依赖 macOS CoreGraphics 窗口探针、系统 screencapture 与 Node 临时文件 API。
 * [OUTPUT]: 提供读取前限额、可取消的 PNG 截图与受 Connection 认证的精确 Fetch route。
 * [POS]: Host 截图适配层；不进入账户/会话目录，失败后清理临时像素文件。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { execFile } from 'node:child_process';
import { readFile, mkdtemp, rm, copyFile, chmod, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const MAX_PNG_BYTES = 64 * 1024 * 1024;

export async function captureMacWindow({ pid, helper, signal, exec = run, temp = () => mkdtemp(join(tmpdir(), 'pdsh-capture-')), read = readFile, size = stat, copy = copyFile, makeExecutable = chmod, remove = path => rm(path, { recursive: true, force: true }) }) {
  if (signal?.aborted) throw new Error('截图已取消');
  const directory = await temp();
  try {
    if (signal?.aborted) throw new Error('截图已取消');
    // npm pack 会将二进制模式降为 0644；只在私有临时目录复制并授予本用户执行权限。
    const probe = join(directory, 'window-id');
    await copy(helper, probe);
    await makeExecutable(probe, 0o700);
    const result = await exec(probe, [String(pid)], { timeout: 5000, maxBuffer: 4096, signal });
    const id = result.stdout.trim();
    if (!/^[1-9]\d{0,9}$/.test(id)) throw new Error('未找到唯一的 DSH 窗口');
    const path = join(directory, 'window.png');
    await exec('/usr/sbin/screencapture', ['-x', '-o', '-l', id, '-t', 'png', path], { timeout: 15000, maxBuffer: 4096, signal });
    if ((await size(path)).size > MAX_PNG_BYTES) throw new Error('PNG 截图过大');
    const bytes = await read(path, { signal });
    if (bytes.length > MAX_PNG_BYTES || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('未得到有效 PNG 截图');
    return bytes;
  } finally {
    await remove(directory);
  }
}

export function createCaptureRoute({ platform = process.platform, capture }) {
  return {
    path: '/api/pdsh/capture', methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      const headers = { 'cache-control': 'no-store' };
      if (platform !== 'darwin') return new Response('unsupported platform', { status: 501, headers });
      if (request.signal.aborted) return new Response('cancelled', { status: 499, headers });
      try {
        const bytes = await capture(request.signal);
        return new Response(new Uint8Array(bytes), { status: 200, headers: { ...headers, 'content-type': 'image/png', 'x-content-type-options': 'nosniff' } });
      } catch {
        return new Response('capture failed', { status: 503, headers });
      }
    },
  };
}
