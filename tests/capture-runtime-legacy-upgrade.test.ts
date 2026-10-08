/**
 * [INPUT]: 依赖固定旧壳、官方 Cordis/Registry、安装 payload、macOS/Windows x64 壁纸平台能力与 esbuild。
 * [OUTPUT]: 验证旧壳加载当前 payload、实际能力 Service 注册门控及 digest 记录撤权；状态遵循平台能力。
 * [POS]: 跨版本装配合同。空 Settings 不取像；真实注册不代替 Gateway 或 Desktop。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { mkdtemp, mkdir, readFile, rm, rmdir, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE_ROOT = join(PROJECT_ROOT, 'tests/runtime-upgrade-fixtures')
const CONTRACT_V1 = 'pdsh-capture-runtime-v1'
const WALLPAPER_CONTRACT_V1 = 'pdsh-wallpaper-runtime-v1'
const GEOMETRY_CONTRACT_V1 = 'pdsh-capture-geometry-v1'
const CURRENT_RUNTIME_CONTRACT = CONTRACT_V1
const NODE_IMPORTS = new Set(['node:fs/promises', 'node:path', 'node:url'])

const FIXTURE_SHA256 = {
  'typert.host.v0.4.0.js.fixture': 'b08e59ab54ed99e0adae9afa917ce600d07c61649be6c26c9382a9b653ce89cc',
  'capture-runtime-loader.v0.4.0.ts.fixture': '18eb9ab94eaf995965f841ea7371d891c6e49b1090f896daf749cae244e3472b',
  'components.v0.4.0.ts.fixture': '7cd9dca3b81a7b5e971a32f6ae2e4f4567a51ade3b3601026be4203d33112782',
  'capture-runtime.v0.4.0.js.gz.fixture': 'c4468ab23c3ebe7d7767d0fa8c06a8fe7a7d961df09f7d1486a37e6d545060ea',
  'capture-runtime.v0.4.0.js.fixture:uncompressed': 'e76b1fa87062cf08122b9aa8b938a980910211638dca0ef2ae3781aa045a66e6',
  'package.v0.4.0.json.fixture': '3a6cec56d6ca0b0fbff507995042f33f993996a29d3d1352adceff06f7bdd9ec',
  'capture-runtime-loader.v0.5.0.ts.fixture': '35eb77b3c7c8147d98a8e3f9d35c92d34de289104df0b8af6df00e79fc153221',
  'components.v0.5.0.ts.fixture': '7cd9dca3b81a7b5e971a32f6ae2e4f4567a51ade3b3601026be4203d33112782',
  'system-wallpaper-protocol.v0.5.0.ts.fixture': 'c9ed75ba548baf89965cc6935a73bc3fe4f1c14352d5d028b2e250d848de8b30',
} as const

type HistoricalLoader = {
  readonly CAPTURE_RUNTIME_CONTRACT: string
  createCaptureRuntimeLoader(options: { locate(): Promise<{ version: string; url: string }>; context?: unknown }): {
    current(): Promise<any>
    dispose(): Promise<void>
  }
  locateCaptureRuntime(packageLink: string): Promise<{ version: string; url: string }>
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function pinnedFixture(name: keyof typeof FIXTURE_SHA256): Promise<Buffer> {
  const raw = await readFile(join(FIXTURE_ROOT, name))
  const bytes = name.endsWith('.gz.fixture') ? raw : Buffer.from(raw.toString('utf8').replace(/\r\n/gu, '\n'))
  assert.equal(sha256(bytes), FIXTURE_SHA256[name], `${name} fixture changed`)
  return bytes
}

async function createDirectoryLink(target: string, linkPath: string): Promise<void> {
  await symlink(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
}

async function removeDirectoryLink(linkPath: string): Promise<void> {
  if (process.platform === 'win32') await rmdir(linkPath)
  else await unlink(linkPath)
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/^\s*import\s+(?:type\s+)?[^;\n]*?\sfrom\s+['"]([^'"]+)['"]/gm)]
    .map((match) => match[1])
    .sort()
}

async function compileHistoricalLoader(tag: 'v0.4.0' | 'v0.5.0', outputRoot: string): Promise<HistoricalLoader> {
  const loaderName = `capture-runtime-loader.${tag}.ts.fixture` as keyof typeof FIXTURE_SHA256
  const componentsName = `components.${tag}.ts.fixture` as keyof typeof FIXTURE_SHA256
  const loaderBytes = await pinnedFixture(loaderName)
  const componentsBytes = await pinnedFixture(componentsName)
  const wallpaperProtocolBytes = tag === 'v0.5.0'
    ? await pinnedFixture('system-wallpaper-protocol.v0.5.0.ts.fixture')
    : undefined
  const source = loaderBytes.toString('utf8')
  const dependencies = new Map<string, Buffer>([
    ['../shared/components.ts', componentsBytes],
    ...(wallpaperProtocolBytes ? [['../shared/system-wallpaper-protocol.ts', wallpaperProtocolBytes] as const] : []),
  ])
  const expectedImports = tag === 'v0.4.0'
    ? ['../shared/components.ts', 'node:fs/promises', 'node:path', 'node:url']
    : ['../shared/components.ts', '../shared/system-wallpaper-protocol.ts', 'node:fs/promises', 'node:path', 'node:url']
  assert.deepEqual(importSpecifiers(source), [...expectedImports].sort(), `${tag} import graph changed`)

  const result = await build({
    stdin: { contents: source, resolveDir: FIXTURE_ROOT, sourcefile: loaderName, loader: 'ts' },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
    logLevel: 'silent',
    define: { __PDSH_BUNDLE_NAME__: JSON.stringify('@daftai/pdsh') },
    plugins: [{
      name: 'strict-historical-dependencies',
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, (args) => {
          if (args.kind === 'import-statement' && NODE_IMPORTS.has(args.path)) {
            return { path: args.path, external: true }
          }
          if (args.kind === 'import-statement' && dependencies.has(args.path)) {
            return { path: args.path, namespace: 'historical-fixture' }
          }
          throw new Error(`unmatched ${tag} dependency: ${args.kind} ${args.path}`)
        })
        builder.onLoad({ filter: /.*/, namespace: 'historical-fixture' }, (args) => {
          const bytes = dependencies.get(args.path)
          if (!bytes) throw new Error(`unmatched ${tag} fixture: ${args.path}`)
          return { contents: bytes, loader: 'ts' }
        })
      },
    }],
  })
  const output = join(outputRoot, `legacy-loader-${tag}.mjs`)
  await writeFile(output, result.outputFiles[0].contents)
  return await import(pathToFileURL(output).href) as HistoricalLoader
}

async function currentCandidate(): Promise<{ manifest: any; payload: Buffer }> {
  const manifestBytes = await readFile(join(PROJECT_ROOT, 'package.json'))
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  assert.equal(manifest.name, '@daftai/pdsh', '只接受正式 stable 包候选')
  assert.equal(manifest.type, 'module', 'ESM payload 必须沿用 package.json 模式')
  const payload = await readFile(join(PROJECT_ROOT, 'lib/capture-runtime', `${manifest.version}.js`))
  assert.ok(payload.length > 0, '当前版本化 runtime payload 必须存在')
  return { manifest, payload }
}

async function writePackage(root: string, name: string, manifestBytes: Buffer, version: string, payload: Buffer): Promise<string> {
  const packageRoot = join(root, name)
  const runtimeRoot = join(packageRoot, 'lib/capture-runtime')
  await mkdir(runtimeRoot, { recursive: true })
  await writeFile(join(packageRoot, 'package.json'), manifestBytes)
  await writeFile(join(runtimeRoot, `${version}.js`), payload)
  await createDirectoryLink(join(PROJECT_ROOT, 'node_modules'), join(packageRoot, 'node_modules'))
  return packageRoot
}

async function withDeadline<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded 2000ms`)), 2000)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

test('已运行 v0.4.0 v1 壳用真实安装链接换载当前业务 payload', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdsh-legacy-v1-'))
  const packageLink = join(root, 'profile/node_modules/@daftai/pdsh')
  let loader: ReturnType<HistoricalLoader['createCaptureRuntimeLoader']> | undefined
  const events: string[] = []
  const settings = { describe: () => [] as Array<never> }
  const context = {
    settings,
    logger: { info: (message: string, ...args: unknown[]) => events.push([message, ...args].join(' ')) },
  }

  try {
    await mkdir(dirname(packageLink), { recursive: true })
    const legacy = await compileHistoricalLoader('v0.4.0', root)
    const oldPackageBytes = await pinnedFixture('package.v0.4.0.json.fixture')
    const oldManifest = JSON.parse(oldPackageBytes.toString('utf8'))
    const oldRuntimeCompressed = await pinnedFixture('capture-runtime.v0.4.0.js.gz.fixture')
    const oldPayload = gunzipSync(oldRuntimeCompressed)
    assert.equal(sha256(oldPayload), FIXTURE_SHA256['capture-runtime.v0.4.0.js.fixture:uncompressed'])
    const beforeRoot = await writePackage(root, 'published-v0.4.0', oldPackageBytes, oldManifest.version, oldPayload)
    await createDirectoryLink(beforeRoot, packageLink)

    loader = legacy.createCaptureRuntimeLoader({
      locate: () => legacy.locateCaptureRuntime(packageLink),
      context,
    })
    const before = await loader.current()
    assert.equal(before.version, oldManifest.version)
    assert.equal(typeof before.capture, 'function')
    assert.equal(typeof before.save, 'function')
    assert.equal(before.wallpaper, undefined, 'v0.4.0 payload must retain its published v1 shape')

    const candidate = await currentCandidate()
    const currentRoot = await writePackage(root, 'current-candidate', await readFile(join(PROJECT_ROOT, 'package.json')),
      candidate.manifest.version, candidate.payload)
    await removeDirectoryLink(packageLink)
    await createDirectoryLink(currentRoot, packageLink)

    const after = await loader.current()
    // +--- Host 版本 Remote 读取同一 Loader 的 current().version；本测不调用完整 Remote RPC。 ---+
    const actualRuntimeVersion = after.version
    assert.equal(actualRuntimeVersion, candidate.manifest.version, 'Loader must expose the installed payload version')
    assert.notEqual(after, before, 'old implementation instance must be replaced')
    assert.ok((before as { disposal?: Promise<void> }).disposal, 'previous runtime must settle before replacement')
    for (const method of ['capture', 'save', 'wallpaper', 'captureGeometry', 'refreshCaptureEnabled', 'dispose']) {
      assert.equal(typeof after[method], 'function', `current runtime missing ${method}`)
    }

    const installed = await legacy.locateCaptureRuntime(packageLink)
    const module = await import(installed.url) as {
      version: string
      contract: string
      wallpaperContract?: string
      geometryContract?: string
    }
    assert.equal(module.version, candidate.manifest.version)
    assert.equal(module.contract, CURRENT_RUNTIME_CONTRACT)
    assert.equal(module.wallpaperContract, WALLPAPER_CONTRACT_V1)
    assert.equal(module.geometryContract, GEOMETRY_CONTRACT_V1)
    assert.deepEqual(settings.describe(), [], 'upgrade must not create or mutate settings')
    assert.ok(events.some((event) => event.includes('service-mounted') && event.includes('false')),
      'empty Settings must keep the payload disabled')
    assert.equal(events.some((event) => /invocation|phase|native-result|terminal/.test(event)), false,
      'test must not start capture, save, wallpaper, or helper work')

    await withDeadline(loader.dispose(), 'legacy v1 dispose')
    assert.ok((after as { disposal?: Promise<void> }).disposal, 'final runtime must dispose')
    console.log(`PASS legacy-v1 upgrade: ${oldManifest.version} -> ${actualRuntimeVersion}; payload=${sha256(candidate.payload)}`)
  } finally {
    await loader?.dispose().catch(() => undefined)
    await rm(root, { recursive: true, force: true })
  }
})

test('已运行 v0.5.0 immutable v2 壳拒绝 v1 扩展候选', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'pdsh-legacy-v2-'))
  const packageLink = join(root, 'profile/node_modules/@daftai/pdsh')
  let loader: ReturnType<HistoricalLoader['createCaptureRuntimeLoader']> | undefined
  const events: string[] = []
  try {
    await mkdir(dirname(packageLink), { recursive: true })
    const v2 = await compileHistoricalLoader('v0.5.0', root)
    assert.equal(v2.CAPTURE_RUNTIME_CONTRACT, 'pdsh-capture-runtime-v2', 'fixture must remain the published v2 loader')
    const candidate = await currentCandidate()
    const candidateUrl = pathToFileURL(join(PROJECT_ROOT, 'lib/capture-runtime', `${candidate.manifest.version}.js`)).href
    const candidateModule = await import(candidateUrl) as { contract: string }
    if (candidateModule.contract !== CONTRACT_V1) {
      t.skip('当前 payload 尚不是 v1 候选；该负例将在 v1 payload 生成后生效')
      return
    }

    const candidateRoot = await writePackage(root, 'current-v1-candidate', await readFile(join(PROJECT_ROOT, 'package.json')),
      candidate.manifest.version, candidate.payload)
    await createDirectoryLink(candidateRoot, packageLink)
    loader = v2.createCaptureRuntimeLoader({
      locate: () => v2.locateCaptureRuntime(packageLink),
      context: { settings: { describe: () => [] }, logger: { info: (message: string) => events.push(message) } },
    })
    await assert.rejects(loader.current(), /incompatible capture runtime/)
    assert.deepEqual(events, [], 'v2 shell must reject before constructing the v1 runtime')
    assert.equal(candidate.manifest.version, JSON.parse((await readFile(join(PROJECT_ROOT, 'package.json'))).toString('utf8')).version)
    console.log(`PASS immutable-v2 limit: v0.5.0 shell rejects ${candidate.manifest.version} v1 candidate`)
  } finally {
    await loader?.dispose().catch(() => undefined)
    await rm(root, { recursive: true, force: true })
  }
})

test('旧 v1 壳换载时新增能力获得独立官方严格注册，换代与卸载精确撤销', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdsh-legacy-capabilities-'))
  const context = new Context()
  let loader: ReturnType<HistoricalLoader['createCaptureRuntimeLoader']> | undefined
  let releasePrevious: (() => void) | undefined
  try {
    await createDirectoryLink(join(PROJECT_ROOT, 'node_modules'), join(root, 'node_modules'))
    await context.plugin(TypertRegistry).await()
    context.provide('settings', { describe: () => [] })
    const fixedShell = context.plugin({ name: 'published-fixed-shell', inject: ['typert', 'settings'], apply() {} })
    await fixedShell.await()
    const facePath = join(root, 'published-typert.mjs')
    await writeFile(facePath, await pinnedFixture('typert.host.v0.4.0.js.fixture'))
    const { TYPERT: publishedFace } = await import(pathToFileURL(facePath).href)
    fixedShell.ctx.typert.register(publishedFace)
    assert.equal(context.get('typert').local.get('pdshNativeWindowCapture/wallpaper'), undefined,
      '旧生成面不能被测试偷偷增加新接口')

    const candidate = await currentCandidate()
    const packageLink = join(root, 'profile/node_modules/@daftai/pdsh')
    await mkdir(dirname(packageLink), { recursive: true })
    const candidateRoot = await writePackage(root, 'installed-first', await readFile(join(PROJECT_ROOT, 'package.json')),
      candidate.manifest.version, candidate.payload)
    await createDirectoryLink(candidateRoot, packageLink)
    const legacy = await compileHistoricalLoader('v0.4.0', root)
    loader = legacy.createCaptureRuntimeLoader({ locate: () => legacy.locateCaptureRuntime(packageLink), context: fixedShell.ctx })

    // +--- 官方服务注入事件才是就绪屏障；基础版本回复不承担扩展就绪语义。 ---+
    const readyService = () => new Promise<any>((resolve) => {
      fixedShell.ctx.inject(['pdshRuntimeCapabilities'], child => resolve(child.get('pdshRuntimeCapabilities')))
    })
    const firstReady = readyService()
    const first = await loader.current()
    assert.equal(first.version, candidate.manifest.version)
    assert.equal(typeof first.then, 'undefined', 'Loader 回复前须完成初始 thenable 屏障')
    assert.ok(context.get('pdshRuntimeCapabilities'), '基础回复时 Host 子能力已实际激活')
    const capabilities = await withDeadline(firstReady, '新增能力实际就绪')
    assert.equal(await capabilities.implementationVersion(), candidate.manifest.version)
    assert.equal(capabilities.wallpaperRegistered(), true)
    assert.equal(capabilities.captureGeometryRegistered(), true,
      '旧固定壳应能握手当前版本化几何扩展')
    const implementation = (capabilities as any).implementation as {
      geometryContract?: string
      captureGeometry?: (pngSha256: string) => Promise<unknown>
    }
    const savedContract = implementation.geometryContract
    const savedMethod = implementation.captureGeometry
    assert.ok(savedMethod)
    try {
      for (const marker of [undefined, 'unknown-capture-geometry-contract']) {
        implementation.geometryContract = marker
        assert.equal(capabilities.captureGeometryRegistered(), false,
          '实际 RuntimeCapabilitiesService 必须拒绝缺失或未知 marker')
        assert.equal(await capabilities.captureGeometry('a'.repeat(64)), null,
          'marker 无效时不得查询业务实例')
      }
      implementation.geometryContract = GEOMETRY_CONTRACT_V1
      implementation.captureGeometry = undefined
      assert.equal(capabilities.captureGeometryRegistered(), false,
        '实际 RuntimeCapabilitiesService 必须要求对应查询方法')
      assert.equal(await capabilities.captureGeometry('a'.repeat(64)), null,
        '查询方法缺失时安全返回 null')
    } finally {
      implementation.geometryContract = savedContract
      implementation.captureGeometry = savedMethod
    }
    assert.equal(capabilities.captureGeometryRegistered(), true,
      '恢复业务实例后，实际能力握手重新有效')
    const geometryEndpoint = 'pdshRuntimeCapabilities/captureGeometry'
    const geometryRegistered = context.get('typert').local.get(geometryEndpoint)
    assert.ok(geometryRegistered, '当前 payload 必须经官方 generator 注册几何查询')
    assert.equal(geometryRegistered.result.mode, 'strict')
    const geometryCodec = geometryRegistered.parameters.find(parameter => parameter.name === 'pngSha256')?.codec
    assert.ok(geometryCodec)
    assert.equal(geometryCodec.mode, 'strict')
    assert.doesNotThrow(() => geometryCodec.create().parse('a'.repeat(64)))
    assert.equal(await capabilities.captureGeometry('a'.repeat(64)), null,
      '关闭配置和未捕获帧不得伪造视口')
    assert.equal(await capabilities.captureGeometry('A'.repeat(64)), null,
      'Host 必须拒绝非 canonical digest')
    const endpoint = 'pdshRuntimeCapabilities/wallpaper'
    const registered = context.get('typert').local.get(endpoint)
    assert.ok(registered, '当前 payload 必须注册新增 endpoint')
    assert.equal(registered.result.mode, 'strict', '拒绝 marker-only SRC 退化')
    const requestCodec = registered.parameters.find(parameter => parameter.name === 'request')?.codec
    assert.ok(requestCodec)
    assert.equal(requestCodec.mode, 'strict')
    assert.doesNotThrow(() => requestCodec.create().parse({ kind: 'list' }))
    assert.throws(() => requestCodec.create().parse({ kind: 'load', id: 42 }))
    const wallpaperPlatformSupported = process.platform === 'darwin'
      || (process.platform === 'win32' && process.arch === 'x64')
    const disabledStatus = wallpaperPlatformSupported ? 'not-enabled' : 'unsupported-platform'
    assert.deepEqual(await Array.fromAsync(capabilities.wallpaper({ kind: 'list' }, new AbortController().signal)),
      [{ type: 'terminal', status: disabledStatus }], '平台能力与 accepted 设置共同决定关闭状态，不读系统媒体')
    const owner = '@daftai/pdsh-capabilities'
    assert.ok(context.get('typert').getPackage(owner, 'host'))
    assert.equal(context.get('typert').getPackage('@daftai/pdsh', 'host')?.model, publishedFace.model,
      '新能力不得改写旧壳缓存的真实贡献')

    // +--- 即使位置变化而版本未变，也须先结算旧 generation，再注册同一内部 owner。 ---+
    const disposeFirst = first.dispose.bind(first)
    let settling = false
    const held = new Promise<void>(resolve => { releasePrevious = resolve })
    first.dispose = async () => { settling = true; await held; await disposeFirst() }
    const secondRoot = await writePackage(root, 'installed-second', await readFile(join(PROJECT_ROOT, 'package.json')),
      candidate.manifest.version, candidate.payload)
    await removeDirectoryLink(packageLink)
    await createDirectoryLink(secondRoot, packageLink)
    const swapping = loader.current()
    while (!settling) await new Promise(resolve => setImmediate(resolve))
    assert.equal(context.get('typert').local.get(endpoint), registered, '旧结算未结束不能提前注册下一代')
    releasePrevious(); releasePrevious = undefined
    const second = await swapping
    assert.notEqual(second, first)
    const secondCapabilities = await withDeadline(readyService(), '第二代能力就绪')
    assert.equal(await secondCapabilities.implementationVersion(), candidate.manifest.version)
    assert.notEqual(context.get('typert').local.get(endpoint), registered, '版本化 payload 必须贡献本代生成对象')
    assert.equal(context.get('typert').listPackages({ package: owner }).length, 1)

    await withDeadline(loader.dispose(), '能力与旧操作卸载')
    assert.equal(context.get('typert').local.get(endpoint), undefined)
    assert.equal(context.get('typert').getPackage(owner, 'host'), undefined)
    assert.equal(context.get('pdshRuntimeCapabilities'), undefined)
    assert.ok(context.get('typert').local.get('pdshNativeWindowCapture/capture'), '子能力撤销不删除基础贡献')
    await fixedShell.dispose()
    assert.equal(context.get('typert').local.get('pdshNativeWindowCapture/capture'), undefined)
  } finally {
    releasePrevious?.()
    await loader?.dispose().catch(() => undefined)
    await context.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

test('Host keeps one digest-bound geometry record and clears it on disable or disposal', async () => {
  const context = new Context()
  let captureEnabled = true
  let runtime: any
  try {
    await context.plugin(TypertRegistry).await()
    context.provide('settings', { describe: () => [{ ns: 'pdsh', value: { captureEnabled } }] })
    const shell = context.plugin({ name: 'geometry-record-shell', inject: ['typert', 'settings'], apply() {} })
    await shell.await()
    const candidate = await currentCandidate()
    const module = await import(pathToFileURL(join(PROJECT_ROOT, 'lib/capture-runtime', `${candidate.manifest.version}.js`)).href)
    runtime = module.create(shell.ctx)
    assert.equal(await Promise.resolve(runtime), runtime)

    const digest = 'a'.repeat(64)
    const geometry = { x: 10, y: 12, width: 200, height: 100, pointPixelScale: 2 }
    runtime.captureGeometryRecord = { pngSha256: digest, geometry }
    assert.deepEqual(await runtime.captureGeometry(digest), geometry)
    assert.equal(await runtime.captureGeometry('b'.repeat(64)), null, 'other PNG digest cannot reuse the slot')
    assert.equal(await runtime.captureGeometry('A'.repeat(64)), null, 'invalid digest fails closed')

    captureEnabled = false
    runtime.refreshCaptureEnabled()
    assert.equal(runtime.captureGeometryRecord, undefined)
    captureEnabled = true
    assert.equal(await runtime.captureGeometry(digest), null, 're-enable never restores an old slot')

    runtime.captureGeometryRecord = { pngSha256: digest, geometry }
    const previousLease = runtime.captureGeometryLease = {}
    runtime.capture(new AbortController().signal)
    assert.notEqual(runtime.captureGeometryLease, previousLease, 'new request invalidates late completion')
    assert.equal(runtime.captureGeometryRecord, undefined)

    runtime.captureGeometryRecord = { pngSha256: digest, geometry }
    const disposal = runtime.dispose()
    assert.equal(runtime.captureGeometryRecord, undefined, 'disposal revokes synchronously')
    assert.equal(await runtime.captureGeometry(digest), null)
    await disposal
    console.log(`PASS geometry record lifecycle: payload=${sha256(candidate.payload)}`)
  } finally {
    await runtime?.dispose().catch(() => undefined)
    await context.fiber.dispose()
  }
})

async function capabilityShell(context: Context, enabled = false) {
  await context.plugin(TypertRegistry).await()
  context.provide('settings', { describe: () => enabled ? [{ ns: 'pdsh', value: { captureEnabled: true } }] : [] })
  const shell = context.plugin({ name: 'capability-lifetime-shell', inject: ['typert', 'settings'], apply() {} })
  await shell.await()
  const candidate = await currentCandidate()
  const module = await import(pathToFileURL(join(PROJECT_ROOT, 'lib/capture-runtime', `${candidate.manifest.version}.js`)).href)
  return { shell, module }
}

test('同步工厂的初始 thenable 等官方 Fiber，保留实例身份；父卸载等待业务结算', async () => {
  const context = new Context()
  let runtime: any
  try {
    const { shell, module } = await capabilityShell(context)
    runtime = module.create(shell.ctx)
    assert.equal(runtime instanceof Promise, false)
    assert.equal(typeof runtime.then, 'function')
    assert.equal(context.get('pdshRuntimeCapabilities'), undefined, '不能伪造同步 child ready')
    shell.ctx.effect(() => () => runtime.dispose(), 'test: settle owned runtime')
    const [first, second] = await Promise.all([Promise.resolve(runtime), Promise.resolve(runtime)])
    assert.equal(first, runtime)
    assert.equal(second, runtime)
    assert.equal(runtime.then, undefined, '就绪后的原实例不能递归 assimilate')
    assert.ok(context.get('pdshRuntimeCapabilities'))
    assert.equal(context.get('typert').local.get('pdshRuntimeCapabilities/wallpaper').result.mode, 'strict')
    await withDeadline(shell.dispose(), '父 Fiber 实际卸载')
    assert.equal(context.get('pdshRuntimeCapabilities'), undefined)
    assert.equal(context.get('typert').getPackage('@daftai/pdsh-capabilities', 'host'), undefined)
    assert.deepEqual(await Array.fromAsync(runtime.capture(new AbortController().signal)),
      [{ type: 'terminal', status: 'disposed' }])
  } finally {
    await runtime?.dispose()
    await context.fiber.dispose()
  }
})

test('可选能力启动失败不阻断基础，也不删除其他 owner 的贡献；启动中卸载不重激活', async () => {
  const context = new Context()
  let runtime: any
  try {
    const { shell, module } = await capabilityShell(context, true)
    const { TYPERT: occupied } = await import(new URL('../lib/runtime-capabilities/typert.host.js', import.meta.url).href)
    const off = shell.ctx.typert.register(occupied)
    runtime = module.create(shell.ctx)
    assert.equal(await withDeadline(Promise.resolve(runtime), '失败扩展结算'), runtime)
    assert.equal(context.get('pdshRuntimeCapabilities'), undefined)
    assert.equal(context.get('typert').local.get('pdshRuntimeCapabilities/wallpaper'), occupied.invocations.find(item => item.method === 'wallpaper'))
    const cancelled = new AbortController(); cancelled.abort()
    assert.deepEqual(await Array.fromAsync(runtime.capture(cancelled.signal)),
      [{ type: 'terminal', status: 'cancelled' }], '扩展失败不得撤回已启用的基础；预取消不启动 helper')
    await runtime.dispose()
    assert.ok(context.get('typert').getPackage('@daftai/pdsh-capabilities', 'host'))
    await off()

    runtime = module.create(shell.ctx)
    shell.ctx.effect(() => () => runtime.dispose(), 'test: dispose during startup')
    const starting = Promise.resolve(runtime)
    await withDeadline(shell.dispose(), '启动期间父卸载')
    await withDeadline(starting, '启动 Promise 结算')
    assert.equal(context.get('pdshRuntimeCapabilities'), undefined)
    assert.equal(context.get('typert').local.get('pdshRuntimeCapabilities/wallpaper'), undefined)
  } finally {
    await runtime?.dispose()
    await context.fiber.dispose()
  }
})
