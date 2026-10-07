/**
 * [INPUT]: 依赖固定发布源码 fixture、esbuild 严格虚拟依赖与真实安装 payload 字节。
 * [OUTPUT]: 验证 v1 已运行壳换载当前候选，并证明已运行 v2 壳拒绝 v1 候选。
 * [POS]: 跨发布版本 Host Loader 合同；只用自有临时包和空 Settings，不调用完整 Remote RPC。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE_ROOT = join(PROJECT_ROOT, 'tests/runtime-upgrade-fixtures')
const CONTRACT_V1 = 'pdsh-capture-runtime-v1'
const WALLPAPER_CONTRACT_V1 = 'pdsh-wallpaper-runtime-v1'
const CURRENT_RUNTIME_CONTRACT = CONTRACT_V1
const NODE_IMPORTS = new Set(['node:fs/promises', 'node:path', 'node:url'])

const FIXTURE_SHA256 = {
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
  const bytes = await readFile(join(FIXTURE_ROOT, name))
  assert.equal(sha256(bytes), FIXTURE_SHA256[name], `${name} fixture changed`)
  return bytes
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
    await symlink(beforeRoot, packageLink, 'dir')

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
    await unlink(packageLink)
    await symlink(currentRoot, packageLink, 'dir')

    const after = await loader.current()
    // +--- Host 版本 Remote 读取同一 Loader 的 current().version；本测不调用完整 Remote RPC。 ---+
    const actualRuntimeVersion = after.version
    assert.equal(actualRuntimeVersion, candidate.manifest.version, 'Loader must expose the installed payload version')
    assert.notEqual(after, before, 'old implementation instance must be replaced')
    assert.ok((before as { disposal?: Promise<void> }).disposal, 'previous runtime must settle before replacement')
    for (const method of ['capture', 'save', 'wallpaper', 'refreshCaptureEnabled', 'dispose']) {
      assert.equal(typeof after[method], 'function', `current runtime missing ${method}`)
    }

    const installed = await legacy.locateCaptureRuntime(packageLink)
    const module = await import(installed.url) as { version: string; contract: string; wallpaperContract?: string }
    assert.equal(module.version, candidate.manifest.version)
    assert.equal(module.contract, CURRENT_RUNTIME_CONTRACT)
    assert.equal(module.wallpaperContract, WALLPAPER_CONTRACT_V1)
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
    await symlink(candidateRoot, packageLink, 'dir')
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
