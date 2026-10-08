/**
 * [INPUT]: 依赖真实 Node realpath/文件 URL/ESM、esbuild 身份注入与本测试独占临时包。
 * [OUTPUT]: 验证稳定/RC manifest 身份隔离、安装链接换载及包根外模块拒绝。
 * [POS]: 版本化 Host 业务闭包的包定位合同；不连接 Manager、不访问用户 profile、不运行 helper。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { mkdir, mkdtemp, rm, rmdir, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CAPTURE_RUNTIME_CONTRACT, CAPTURE_WALLPAPER_CONTRACT, createCaptureRuntimeLoader, locateCaptureRuntime } from '../src/host/capture-runtime-loader.ts'

async function createDirectoryLink(target: string, linkPath: string): Promise<void> {
  await symlink(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
}

async function removeDirectoryLink(linkPath: string): Promise<void> {
  if (process.platform === 'win32') await rmdir(linkPath)
  else await unlink(linkPath)
}

async function buildLocator(packageName: '@daftai/pdsh' | '@daftai/pdsh-rc') {
  const result = await build({ entryPoints: ['src/host/capture-runtime-loader.ts'], bundle: true, write: false,
    platform: 'node', format: 'cjs', target: 'es2022', logLevel: 'silent',
    define: { __PDSH_BUNDLE_NAME__: JSON.stringify(packageName) } })
  const module = { exports: {} as any }
  runInNewContext(result.outputFiles[0].text, {
    module, exports: module.exports, require: createRequire(import.meta.url),
  })
  return module.exports.locateCaptureRuntime as typeof locateCaptureRuntime
}

test('实际 ESM 和稳定安装链接能载入两个不同实现，非 createRequire 旧 store', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdsh runtime space-'))
  const link = join(root, 'installed')
  let loader: ReturnType<typeof createCaptureRuntimeLoader> | undefined
  try {
    for (const version of ['0.3.3-rc.1', '0.3.3-rc.2']) {
      const directory = join(root, version)
      await mkdir(join(directory, 'lib/capture-runtime'), {recursive:true})
      await writeFile(join(directory, 'package.json'), JSON.stringify({name:'@daftai/pdsh',version,type:'module'}))
      await writeFile(join(directory, `lib/capture-runtime/${version}.js`), `
        export const version = ${JSON.stringify(version)};
        export const contract = ${JSON.stringify(CAPTURE_RUNTIME_CONTRACT)};
        export const wallpaperContract = ${JSON.stringify(CAPTURE_WALLPAPER_CONTRACT)};
        export function create() {return {version, capture(){}, save(){}, wallpaper(){}, refreshCaptureEnabled(){}, async dispose(){}}}
      `)
    }
    await createDirectoryLink(join(root, '0.3.3-rc.1'), link)
    loader = createCaptureRuntimeLoader({locate:()=>locateCaptureRuntime(link)})
    const first = await loader.current()
    assert.equal(first.version, '0.3.3-rc.1')
    await removeDirectoryLink(link); await createDirectoryLink(join(root, '0.3.3-rc.2'), link)
    const second = await loader.current()
    assert.equal(second.version, '0.3.3-rc.2')
    assert.notEqual(first, second)
    await rm(join(root,'0.3.3-rc.2/lib/capture-runtime'), {recursive:true})
    await createDirectoryLink(join(root,'0.3.3-rc.1/lib/capture-runtime'), join(root,'0.3.3-rc.2/lib/capture-runtime'))
    await writeFile(join(root,'0.3.3-rc.1/lib/capture-runtime/0.3.3-rc.2.js'), 'export const version = "0.3.3-rc.2";')
    await assert.rejects(loader.current(), /invalid capture runtime location/)
    await writeFile(join(root,'0.3.3-rc.2/package.json'), JSON.stringify({name:'foreign',version:'0.3.3-rc.2'}))
    await assert.rejects(loader.current(), /invalid capture runtime package/)
  } finally { await loader?.dispose(); await rm(root,{recursive:true,force:true}) }
})

test('稳定与 RC locator 只接受自身构建身份对应的 package manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdsh runtime identity-'))
  try {
    const stableVersion = '0.3.5'
    const rcVersion = '0.3.5-rc.7'
    const stableRoot = join(root, 'stable')
    const rcRoot = join(root, 'candidate')
    for (const [packageRoot, name, version] of [
      [stableRoot, '@daftai/pdsh', stableVersion],
      [rcRoot, '@daftai/pdsh-rc', rcVersion],
    ] as const) {
      await mkdir(join(packageRoot, 'lib/capture-runtime'), { recursive: true })
      await writeFile(join(packageRoot, 'package.json'), JSON.stringify({ name, version, type: 'module' }))
      await writeFile(join(packageRoot, `lib/capture-runtime/${version}.js`), 'export {}')
    }

    const locateStable = await buildLocator('@daftai/pdsh')
    const locateRc = await buildLocator('@daftai/pdsh-rc')
    assert.equal((await locateStable(stableRoot)).version, stableVersion)
    assert.equal((await locateRc(rcRoot)).version, rcVersion)
    await assert.rejects(locateStable(rcRoot), /invalid capture runtime package/)
    await assert.rejects(locateRc(stableRoot), /invalid capture runtime package/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
