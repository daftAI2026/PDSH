/**
 * [INPUT]: 依赖版本实现协调器与内存模块、可控卸载 Promise。
 * [OUTPUT]: 验证同合同桥换实现、并发合并、v1/缺壁纸方法拒绝、失败不伪装旧版本及终态卸载。
 * [POS]: Host 热更新回归门；不启动 helper、不取像、不操作用户配置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createCaptureRuntimeLoader, CAPTURE_RUNTIME_CONTRACT } from '../src/host/capture-runtime-loader.ts'

function fixture() {
  let version = '0.3.6'
  let contract = CAPTURE_RUNTIME_CONTRACT
  let imports = 0
  const disposed: string[] = []
  const loader = createCaptureRuntimeLoader({
    locate: async () => ({ version, url: `file:///fixture/${version}.js` }),
    importModule: async () => {
      imports++
      const ownVersion = version
      return { version: ownVersion, contract, create: () => ({
        version: ownVersion, capture() {}, save() {}, wallpaper() {}, refreshCaptureEnabled() {},
        dispose: async () => { disposed.push(ownVersion) },
      }) }
    },
  })
  return { loader, disposed, get imports() { return imports },
    version(value: string) { version = value }, contract(value: string) { contract = value } }
}

test('新增 wallpaper ABI 后 v1 不能热换，声称 v2 的实例也须真正有该方法', async () => {
  let creates = 0;
  let contract = 'pdsh-capture-runtime-v1';
  const loader = createCaptureRuntimeLoader({
    locate: async () => ({ version: '0.4.0-rc.1', url: 'file:///fixture/wallpaper.js' }),
    importModule: async () => ({ version: '0.4.0-rc.1', contract, create: () => {
      creates++;
      return { version: '0.4.0-rc.1', capture() {}, save() {}, refreshCaptureEnabled() {}, async dispose() {} } as any;
    } }),
  });
  try {
    await assert.rejects(loader.current(), /incompatible/);
    assert.equal(creates, 0, '旧模块不能获得 v2 运行资格');
    contract = CAPTURE_RUNTIME_CONTRACT;
    await assert.rejects(loader.current(), /invalid|incompatible/);
    assert.equal(creates, 1, '仅版本号与协议标记相同不代表方法完整');
  } finally { await loader.dispose(); }
});

test('同一稳定桥在安装新版本后换成新后台，而非只重新创建旧实现', async () => {
  const h = fixture()
  const before = await h.loader.current()
  assert.equal(before.version, '0.3.6')
  assert.equal(await h.loader.current(), before)
  h.version('0.3.7')
  const after = await h.loader.current()
  assert.equal(after.version, '0.3.7')
  assert.notEqual(after, before)
  assert.deepEqual(h.disposed, ['0.3.6'])
  assert.equal(h.imports, 2)
  await h.loader.dispose()
  assert.deepEqual(h.disposed, ['0.3.6', '0.3.7'])
})

test('并发请求只加载一次，协议变化与版本假冒不回退到旧实现', async () => {
  const h = fixture()
  const [one, two] = await Promise.all([h.loader.current(), h.loader.current()])
  assert.equal(one, two)
  assert.equal(h.imports, 1)
  h.version('0.3.7'); h.contract('incompatible')
  await assert.rejects(h.loader.current(), /incompatible/)
  assert.deepEqual(h.disposed, [], '验证新模块以前不破坏当前实例')
  h.contract(CAPTURE_RUNTIME_CONTRACT)
  assert.equal((await h.loader.current()).version, '0.3.7')
  await h.loader.dispose()
})

test('加载过程中的 Bundle 卸载不可复活实现', async () => {
  let release!: (value: any) => void
  let created = 0
  const loader = createCaptureRuntimeLoader({
    locate: async () => ({ version: '0.3.6', url: 'file:///fixture.js' }),
    importModule: () => new Promise(resolve => { release = resolve }),
  })
  const task = loader.current()
  await new Promise(resolve => setImmediate(resolve))
  const rejection = assert.rejects(task, /disposed/)
  const disposal = loader.dispose()
  release({ version: '0.3.6', contract: CAPTURE_RUNTIME_CONTRACT,
    create: () => { created++; throw new Error('must not create') } })
  await Promise.all([disposal, rejection])
  assert.equal(created, 0)
  await assert.rejects(loader.current(), /disposed/)
})

test('新实现必须等旧后台真实结算后才开始构造', async () => {
  let version = '0.3.6'
  let finish!: () => void
  const events: string[] = []
  const loader = createCaptureRuntimeLoader({
    locate: async () => ({ version, url: `file:///fixture/${version}` }),
    importModule: async () => ({ version, contract: CAPTURE_RUNTIME_CONTRACT, create: () => {
      const own = version
      events.push(`create:${own}`)
      return { version: own, capture() {}, save() {}, wallpaper() {}, refreshCaptureEnabled() {}, dispose: () => {
        events.push(`dispose:${own}`)
        return new Promise<void>(resolve => { finish = resolve })
      } }
    } }),
  })
  await loader.current(); version = '0.3.7'
  const next = loader.current()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(events, ['create:0.3.6', 'dispose:0.3.6'])
  finish(); assert.equal((await next).version, '0.3.7')
  const disposal = loader.dispose(); finish(); await disposal
})
