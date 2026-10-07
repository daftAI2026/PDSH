/**
 * [INPUT]: 依赖版本实现协调器与内存模块、可控卸载 Promise。
 * [OUTPUT]: 验证基础换载、扩展独立退让、已发布 v2 兼容、真实结算与终态卸载。
 * [POS]: Host 热更新回归门；不启动 helper、不取像、不操作用户配置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createCaptureRuntimeLoader, CAPTURE_RUNTIME_CONTRACT, CAPTURE_WALLPAPER_CONTRACT } from '../src/host/capture-runtime-loader.ts'

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
      return { version: ownVersion, contract, wallpaperContract: CAPTURE_WALLPAPER_CONTRACT, create: () => ({
        version: ownVersion, capture() {}, save() {}, wallpaper() {}, refreshCaptureEnabled() {},
        dispose: async () => { disposed.push(ownVersion) },
      }) }
    },
  })
  return { loader, disposed, get imports() { return imports },
    version(value: string) { version = value }, contract(value: string) { contract = value } }
}

test('可选壁纸缺失或合同未知不阻断稳定截图与保存', async () => {
  let creates = 0;
  let version = '0.5.1';
  let wallpaperContract: string | undefined;
  const loader = createCaptureRuntimeLoader({
    locate: async () => ({ version, url: `file:///fixture/${version}.js` }),
    importModule: async () => ({ version, contract: CAPTURE_RUNTIME_CONTRACT, wallpaperContract, create: () => {
      creates++;
      return { version, capture() {}, save() {}, wallpaper() {}, refreshCaptureEnabled() {}, async dispose() {} };
    } }),
  });
  try {
    const base = await loader.current();
    assert.equal(creates, 1);
    assert.equal(loader.supportsWallpaper(base), false, '方法存在不代表扩展合同有效');
    version = '0.5.2'; wallpaperContract = 'unknown-wallpaper-contract';
    assert.equal(loader.supportsWallpaper(await loader.current()), false);
    version = '0.5.3'; wallpaperContract = CAPTURE_WALLPAPER_CONTRACT;
    assert.equal(loader.supportsWallpaper(await loader.current()), true);
    assert.equal(loader.supportsWallpaper(base), false, '旧 generation 不获得新扩展资格');
  } finally { await loader.dispose(); }
});

test('基础合同未知或缺少保存方法仍拒绝；已发布 v2 基础面保持兼容', async () => {
  let version = '0.5.0';
  let contract = 'pdsh-capture-runtime-v2';
  let save: (() => void) | undefined = () => {};
  const loader = createCaptureRuntimeLoader({
    locate: async () => ({ version, url: `file:///fixture/${version}.js` }),
    importModule: async () => ({ version, contract, create: () => ({
      version, capture() {}, save, wallpaper() {}, refreshCaptureEnabled() {}, async dispose() {},
    }) }),
  });
  try {
    assert.equal(loader.supportsWallpaper(await loader.current()), true);
    version = '0.5.1'; contract = 'unknown-base-contract';
    await assert.rejects(loader.current(), /incompatible capture runtime/);
    contract = CAPTURE_RUNTIME_CONTRACT; save = undefined;
    await assert.rejects(loader.current(), /incompatible capture runtime instance/);
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
