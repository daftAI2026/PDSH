/**
 * [INPUT]: 依赖版本化 CaptureRuntime、esbuild、可控 Windows 子进程和共享 Host 测试夹具。
 * [OUTPUT]: 验证 Windows 每次重读 native hash roster、拒绝陈旧 ID 并只加载图像协议。
 * [POS]: Windows 壁纸 Runtime 的生产路径合同；不冒充原生目录素材或 Desktop 验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import test from 'node:test'
import { TextDecoder } from 'node:util'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import type { NativeWallpaperSpawnOptions } from '../src/host/system-wallpaper-native.ts'
import { FakeChild, collect, minimalJpeg } from './system-wallpaper-host-fixtures.ts'

test('versioned CaptureRuntime authorizes Windows loads from a fresh native hash roster', async () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  const archDescriptor = Object.getOwnPropertyDescriptor(process, 'arch')
  const childProcess = createRequire(import.meta.url)('node:child_process') as { spawn: (...args: any[]) => unknown }
  const originalSpawn = childProcess.spawn
  const accepted = { captureEnabled: true }
  const id = `system-wallpaper-image-${'d'.repeat(64)}`
  const roster = [{ id, name: 'Windows · img0', available: true, downloadable: false }]
  const jpeg = minimalJpeg()
  const listBytes = Buffer.from(`${JSON.stringify({ status: 'listed', entries: roster })}\n`)
  const imageBytes = Buffer.concat([Buffer.from(`${JSON.stringify({
    status: 'loaded', id, sourceType: 'image', width: 2, height: 1, jpegBytes: jpeg.length,
  })}\n`), jpeg])
  const calls: Array<{ args: string[]; options: NativeWallpaperSpawnOptions }> = []
  const appleCatalogCalls = { value: 0 }
  const testHost = async () => {
    const compiled = await build({ entryPoints: ['src/host/capture-runtime.ts'], bundle: true, write: false,
      platform: 'node', format: 'cjs', target: 'es2022', logLevel: 'silent',
      plugins: [{
        name: 'apple-catalog-must-not-run-on-windows',
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /system-wallpaper-catalog\.ts$/ }, args => ({
            path: args.path,
            namespace: 'pdsh-windows-wallpaper-apple-catalog',
          }))
          pluginBuild.onLoad({ filter: /.*/, namespace: 'pdsh-windows-wallpaper-apple-catalog' }, () => ({
            contents: `export async function discoverSystemWallpaperSources() {
              globalThis.__appleWallpaperCatalogCalls.value++;
              throw new Error('Apple catalog must not run on Windows');
            }`,
            loader: 'js',
          }))
        },
      }],
      define: {
        __PDSH_BUNDLE_NAME__: JSON.stringify('@daftai/pdsh-rc'),
        __PDSH_VERSION__: JSON.stringify('0.4.0-rc.1'),
        'import.meta.url': JSON.stringify(new URL('../src/host/capture-runtime.ts', import.meta.url).href),
      } })
    const module = { exports: {} as Record<string, any> }
    Object.defineProperty(process, 'platform', { ...platformDescriptor, value: 'win32' })
    Object.defineProperty(process, 'arch', { ...archDescriptor, value: 'x64' })
    childProcess.spawn = (_file: string, args: string[], options: NativeWallpaperSpawnOptions) => {
      calls.push({ args: Array.from(args), options })
      const child = new FakeChild()
      const output = args[0] === '--wallpaper-list' ? listBytes : args[1] === id ? imageBytes : Buffer.alloc(0)
      queueMicrotask(() => {
        child.emit('spawn')
        child.stdout.end(output)
        child.stderr.end()
        setImmediate(() => child.emit('close', 0, null))
      })
      return child
    }
    syncBuiltinESMExports()
    runInNewContext(compiled.outputFiles[0]!.text, {
      module, exports: module.exports, AbortController, Buffer, URL, TextDecoder, process,
      setTimeout, clearTimeout, require: createRequire(import.meta.url),
      __appleWallpaperCatalogCalls: appleCatalogCalls,
    })
    const { CaptureRuntime } = module.exports
    const runtime = new CaptureRuntime({
      settings: { describe: () => [{ ns: 'pdsh-rc', value: accepted }] },
      logger: { info() {} },
    } as never)
    try {
      const listed = await collect(runtime.wallpaper({ kind: 'list' }, new AbortController().signal))
      assert.equal(JSON.stringify(listed), JSON.stringify([
        { type: 'catalog', entries: roster }, { type: 'terminal', status: 'listed' },
      ]))
      assert.equal(calls[0]?.args[0], '--wallpaper-list')
      assert.equal(calls[0]?.options.windowsHide, true)

      const staleId = `system-wallpaper-image-${'e'.repeat(64)}`
      const stale = await collect(runtime.wallpaper({ kind: 'load', id: staleId }, new AbortController().signal))
      assert.equal(JSON.stringify(stale), JSON.stringify([{ type: 'terminal', status: 'invalid-request' }]),
        'a caller ID absent from the just-read native roster never reaches image mode')
      assert.deepEqual(calls[1]?.args, ['--wallpaper-list'])

      const loaded = await collect(runtime.wallpaper({ kind: 'load', id }, new AbortController().signal))
      assert.equal(loaded[0]?.type, 'image')
      assert.equal(loaded[0]?.type === 'image' && loaded[0].sourceType, 'image')
      assert.equal(loaded.at(-1)?.type, 'terminal')
      assert.deepEqual(calls.slice(2).map(call => call.args), [['--wallpaper-list'], ['--wallpaper', id]])
      assert.ok(calls.every(call => call.options.windowsHide === true))
      assert.equal(appleCatalogCalls.value, 0, 'Windows catalog and load never call the Apple metadata provider')
    } finally {
      await runtime.dispose()
    }
  }
  try { await testHost() }
  finally {
    childProcess.spawn = originalSpawn
    syncBuiltinESMExports()
    if (platformDescriptor) Object.defineProperty(process, 'platform', platformDescriptor)
    if (archDescriptor) Object.defineProperty(process, 'arch', archDescriptor)
  }
})
