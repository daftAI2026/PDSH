/**
 * [INPUT]: 依赖真实 Node realpath/文件 URL/ESM 与本测试独占临时包。
 * [OUTPUT]: 验证稳定安装链接更换后实际载入新闭包，拒绝错误包和跨越包根的模块目录。
 * [POS]: Host 路径定位回归；不连接 Manager、不访问用户 profile、不运行 helper。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCaptureRuntimeLoader, locateCaptureRuntime } from '../src/host/capture-runtime-loader.ts'

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
        export const contract = 'pdsh-capture-runtime-v1';
        export function create() {return {version, capture(){}, save(){}, refreshCaptureEnabled(){}, async dispose(){}}}
      `)
    }
    await symlink(join(root, '0.3.3-rc.1'), link, 'dir')
    loader = createCaptureRuntimeLoader({locate:()=>locateCaptureRuntime(link)})
    const first = await loader.current()
    assert.equal(first.version, '0.3.3-rc.1')
    await unlink(link); await symlink(join(root, '0.3.3-rc.2'), link, 'dir')
    const second = await loader.current()
    assert.equal(second.version, '0.3.3-rc.2')
    assert.notEqual(first, second)
    await rm(join(root,'0.3.3-rc.2/lib/capture-runtime'), {recursive:true})
    await symlink(join(root,'0.3.3-rc.1/lib/capture-runtime'), join(root,'0.3.3-rc.2/lib/capture-runtime'), 'dir')
    await writeFile(join(root,'0.3.3-rc.1/lib/capture-runtime/0.3.3-rc.2.js'), 'export const version = "0.3.3-rc.2";')
    await assert.rejects(loader.current(), /invalid capture runtime location/)
    await writeFile(join(root,'0.3.3-rc.2/package.json'), JSON.stringify({name:'foreign',version:'0.3.3-rc.2'}))
    await assert.rejects(loader.current(), /invalid capture runtime package/)
  } finally { await loader?.dispose(); await rm(root,{recursive:true,force:true}) }
})
