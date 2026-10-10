/**
 * [INPUT]: 依赖生产根换载、真实 Cordis Registry、Schemastery 与自有临时安装件。
 * [OUTPUT]: 验根版本换代、并发合并、失败恢复与卸载围栏；拒绝异包及符号链接入口。
 * [POS]: 根换载生命周期合同。Entry 夹具不代替 verify-host 的官方 Manager/Loader 升级门。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { refreshRuntimeRoot } from '../src/host/runtime-root-reload.ts'

async function fixture(body = '', metadata = { name: '@daftai/pdsh', version: '0.0.2' }) {
  const directory = await mkdtemp(join(tmpdir(), 'pdsh-root-contract-'))
  const root = join(directory, 'node_modules/@daftai/pdsh')
  await mkdir(root, { recursive: true })
  await symlink(resolve('node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  await writeFile(join(root, 'package.json'), JSON.stringify({ ...metadata, type: 'module' }))
  await writeFile(join(root, 'index.js'), `
    import z from '@deepseek-ai/schemastery';
    export const name = 'pdsh';
    export const Config = z.object({ enabled:z.boolean().default(true), history:z.array(z.string()).default([]) });
    export function apply() { ${body} }
    Object.defineProperty(apply,'pdshVersion',{value:'0.0.2'});
  `)
  const context = new Context()
  context.provide('profileContext', { dir: directory })
  let queue = Promise.resolve()
  context.provide('hmr', { runExclusive(operation) {
    const task = queue.then(operation)
    queue = task.catch(() => undefined)
    return task
  } })
  const previous = { name: 'pdsh', Config: z.object({ enabled: z.boolean().default(true) }), apply() {} }
  const carrier = context.plugin({ name: 'root-contract-carrier', apply() {} })
  await carrier.await()
  const pending = carrier.ctx.plugin(previous, { enabled: false })
  await pending.await()
  const fiber = pending.ctx.fiber
  const entry = { options: { id: 'pdsh', name: '@daftai/pdsh', config: { enabled: false } }, fiber }
  fiber.entry = entry as any
  return { root, directory, context, carrier, fiber, entry, previous,
    async close() { await context.fiber.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

test('真实 Registry 同进程换根，保留唯一 Entry 与配置，并发请求只换一次', async () => {
  const f = await fixture()
  try {
    const before = await readFile(join(f.root, 'package.json'))
    const raw = f.entry.options.config
    await Promise.all([refreshRuntimeRoot(f.fiber.ctx, '0.0.2'), refreshRuntimeRoot(f.fiber.ctx, '0.0.2')])
    const current = f.entry.fiber
    assert.notEqual(current, f.fiber)
    assert.equal(current.state, 2)
    assert.equal(current.runtime.callback.pdshVersion, '0.0.2')
    assert.ok(current.runtime.Config.dict.history)
    assert.equal(f.entry.options.config, raw)
    assert.equal(f.entry.options.config.enabled, false)
    assert.equal(Object.hasOwn(f.entry.options, 'disabled'), false)
    assert.equal(f.context.registry.get(f.previous), undefined)
    assert.equal([...f.context.registry.get(current.runtime.callback).fibers].length, 1)
    assert.deepEqual(await readFile(join(f.root, 'package.json')), before)
    await refreshRuntimeRoot(current.ctx, '0.0.2')
    assert.equal(f.entry.fiber, current, '当前根不重复换载')
  } finally { await f.close() }
})

test('新根启动失败恢复旧 Config 与业务，不把半更新当成功', async () => {
  const f = await fixture("throw Error('test-only-start-failure')")
  try {
    await assert.rejects(refreshRuntimeRoot(f.fiber.ctx, '0.0.2'), /runtime-root-unavailable/)
    assert.equal(f.entry.fiber.state, 2)
    assert.equal(f.entry.fiber.runtime.callback, f.previous.apply)
    assert.equal(f.entry.fiber.runtime.Config, f.previous.Config)
    assert.deepEqual(f.entry.options.config, { enabled: false })
    assert.equal(Object.hasOwn(f.entry.options, 'disabled'), false)
  } finally { await f.close() }
})

test('异包、错误版本和符号链接入口在撤销旧根之前拒绝', async () => {
  for (const metadata of [{ name: '@foreign/package', version: '0.0.2' }, { name: '@daftai/pdsh', version: '0.0.3' }]) {
    const f = await fixture('', metadata)
    try {
      await assert.rejects(refreshRuntimeRoot(f.fiber.ctx, '0.0.2'), /runtime-root-unavailable/)
      assert.equal(f.entry.fiber, f.fiber); assert.equal(f.fiber.state, 2)
    } finally { await f.close() }
  }
  const f = await fixture()
  try {
    await writeFile(join(f.directory, 'foreign.js'), '')
    await rm(join(f.root, 'index.js'))
    await symlink(join(f.directory, 'foreign.js'), join(f.root, 'index.js'))
    await assert.rejects(refreshRuntimeRoot(f.fiber.ctx, '0.0.2'), /runtime-root-unavailable/)
    assert.equal(f.entry.fiber, f.fiber); assert.equal(f.fiber.state, 2)
  } finally { await f.close() }
})

test('排队期间父级卸载不得重新激活插件', async () => {
  const f = await fixture()
  let enter, release
  const entered = new Promise<void>(resolve => { enter = resolve })
  const held = new Promise<void>(resolve => { release = resolve })
  f.context.set('hmr', { async runExclusive(operation) { enter(); await held; return operation() } })
  try {
    const pending = assert.rejects(refreshRuntimeRoot(f.fiber.ctx, '0.0.2'), /runtime-root-unavailable/)
    await entered
    await f.carrier.dispose()
    release()
    await pending
    assert.notEqual(f.entry.fiber.state, 2)
    assert.equal(f.context.registry.get(f.previous), undefined)
  } finally { release?.(); await f.close() }
})


test('根换代后等待基础服务初始化，再回复旧能力握手', async () => {
  const f = await fixture()
  let enter, release
  const entered = new Promise<void>(resolve => { enter = resolve })
  const held = new Promise<void>(resolve => { release = resolve })
  f.context.provide('pdshWindowCapture', { async implementationVersion() { enter(); await held; return '0.0.2' } })
  try {
    let settled = false
    const pending = refreshRuntimeRoot(f.fiber.ctx, '0.0.2').then(() => { settled = true })
    await entered
    assert.notEqual(f.entry.fiber, f.fiber)
    assert.equal(settled, false, '新根 ACTIVE 不代表惰性业务就绪')
    release()
    await pending
    assert.equal(settled, true)
    await f.entry.fiber.dispose()
    await assert.rejects(refreshRuntimeRoot(f.entry.fiber.ctx, '0.0.2'), /runtime-root-unavailable/)
  } finally { release?.(); await f.close() }
})

test('新根业务初始化失配时恢复旧根，并隐藏文件系统异常', async () => {
  const f = await fixture()
  f.context.provide('pdshWindowCapture', { async implementationVersion() { return 'wrong-version' } })
  try {
    await assert.rejects(refreshRuntimeRoot(f.fiber.ctx, '0.0.2'), { message: 'runtime-root-unavailable' })
    assert.equal(f.entry.fiber.runtime.callback, f.previous.apply)
    assert.equal(f.entry.fiber.state, 2)
    await rm(join(f.root, 'package.json'))
    await assert.rejects(refreshRuntimeRoot(f.entry.fiber.ctx, '0.0.2'), { message: 'runtime-root-unavailable' })
  } finally { await f.close() }
})
