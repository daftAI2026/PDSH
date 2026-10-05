/**
 * [INPUT]: 通过 fixtureRoot/package.json 解析精确 DSH Host 依赖；在隔离 consumerProfile 中接收归档/GitHub 来源与 PNPM 命令 JSON。
 * [OUTPUT]: 经官方 PluginManager 与 Typert Loader 验证安装及当前版本业务闭包字节、helper 执行位、设置和 service/descriptor 生命周期；不消费取像流或冒充 Remote/Desktop 验收。
 * [POS]: 仓库根目录的集成验收入口；只操作调用方指定且 owner/权限验证的临时 profile，不改写 DSH 用户 profile 或替代官方解析器。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import assert from 'node:assert/strict'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { validatePackedBundle } from './bundle-artifacts.ts'
import { pathToFileURL, fileURLToPath } from 'node:url'

const ROOT_BUNDLE = '@daftai/pdsh'
const FEATURE_FIELDS = ['maskIdentity', 'maskTitles', 'captureEnabled'] as const
type PackageManagerCommand = {
  command: string
  args?: string[]
  env?: Record<string, string>
}

function usage(): never {
  throw new Error('用法: node --experimental-strip-types verify-host.ts <fixtureRoot> <consumerProfile> <rootTgz|PDSH-GitHub-source> <pmCommandJSON> [green|historical-pnpm-red|historical-host-red]')
}

// +--- 临时目录不等于私有目录；验证 owner 与写权限，不擅自 chmod 调用方内容 ---+
function assertPrivateOwnership(path: string): void {
  const entry = lstatSync(path);
  assert.ok((typeof process.geteuid !== 'function' || entry.uid === process.geteuid()) && !(entry.mode & 0o022),
    `必须属于当前用户且不可由其他用户写入: ${path}`);
}

function assertTemporaryProfilePath(profile: string): void {
  const tempRoots = new Set([realpathSync.native(tmpdir())])
  if (existsSync('/tmp')) tempRoots.add(realpathSync.native('/tmp'))
  let existing = resolve(profile)
  while (!existsSync(existing)) {
    const parent = dirname(existing)
    assert.notEqual(parent, existing, 'consumerProfile 没有可验证的临时目录祖先')
    existing = parent
  }
  const existingReal = realpathSync.native(existing)
  const withinTemp = (path: string) => [...tempRoots].some((root) => {
    const rel = relative(root, path)
    return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
  })
  assert.ok(withinTemp(existingReal), `拒绝非 OS 临时目录 consumerProfile: ${profile}`)
  let ancestor = existingReal;
  while (!tempRoots.has(ancestor)) {
    assertPrivateOwnership(ancestor);
    ancestor = dirname(ancestor);
  }
  if (existsSync(profile)) {
    const entry = lstatSync(profile)
    assert.ok(!entry.isSymbolicLink(), 'consumerProfile 本身不得是符号链接')
    assert.ok(entry.isDirectory(), 'consumerProfile 必须是目录')
    assert.ok(withinTemp(realpathSync.native(profile)), `拒绝指向临时目录外的 profile 符号链接: ${profile}`)
  }
}

function assertOwnedTempDirectory(directory: string): void {
  const tempRoots = [realpathSync.native(tmpdir()), ...(existsSync('/tmp') ? [realpathSync.native('/tmp')] : [])]
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const entry = lstatSync(directory)
  assert.ok(entry.isDirectory() && !entry.isSymbolicLink(), `拒绝非目录或符号链接: ${directory}`)
  assertPrivateOwnership(directory)
  const actual = realpathSync.native(directory)
  assert.ok(tempRoots.some((root) => {
    const rel = relative(root, actual)
    return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
  }), `目录逃逸 OS 临时根: ${directory}`)
}

function readPackageManagerCommand(input: string, profile: string): PackageManagerCommand {
  const raw = input.startsWith('{') ? input : readFileSync(resolve(input), 'utf8')
  const value: unknown = JSON.parse(raw)
  assert.ok(value && typeof value === 'object', 'PNPM 命令必须是 JSON 对象')
  const command = value as Partial<PackageManagerCommand>
  assert.equal(typeof command.command, 'string', 'PNPM 命令缺少 command')
  assert.ok(isAbsolute(command.command!) && existsSync(command.command!), 'PNPM command 必须是可验证的绝对路径')
  assert.ok(command.args === undefined || (Array.isArray(command.args) && command.args.every((arg) => typeof arg === 'string')), 'PNPM args 必须全为字符串')
  assert.ok(command.env === undefined || (typeof command.env === 'object' && Object.values(command.env).every((item) => typeof item === 'string')), 'PNPM env 必须是字符串键值')
  const safeEnv = Object.fromEntries(Object.entries(command.env ?? {}).filter(([key]) => ['ELECTRON_RUN_AS_NODE', 'ELECTRON_NO_ATTACH_CONSOLE'].includes(key)))
  assert.ok(Object.keys(command.env ?? {}).every((key) => ['ELECTRON_RUN_AS_NODE', 'ELECTRON_NO_ATTACH_CONSOLE'].includes(key)), 'PNPM env 只允许 Electron as-Node 参数，隔离 token 与任意执行变量')
  const managerDir = join(profile, '.plugin-manager')
  assertOwnedTempDirectory(managerDir)
  const isolatedGlobalConfig = join(managerDir, 'global.npmrc')
  if (!existsSync(isolatedGlobalConfig)) writeFileSync(isolatedGlobalConfig, '', { mode: 0o600, flag: 'wx' })
  assertOwnedTempDirectory(join(managerDir, 'pnpm-store'))
  return {
    command: command.command!,
    args: [...(command.args ?? []), `--store-dir=${join(managerDir, 'pnpm-store')}`],
    env: {
      ...safeEnv,
      ELECTRON_RUN_AS_NODE: '1',
      npm_config_userconfig: join(profile, '.npmrc'),
      npm_config_globalconfig: isolatedGlobalConfig,
    },
  }
}

function managerRegistry(profile: string): string {
  const npmrc = join(profile, '.npmrc')
  if (!existsSync(npmrc)) return 'https://registry.npmjs.org/'
  const configured = readFileSync(npmrc, 'utf8').split(/\r?\n/)
    .map((line) => /^\s*registry\s*=\s*(\S+)/.exec(line)?.[1])
    .find(Boolean)
  return configured ?? 'https://registry.npmjs.org/'
}

function assertEmptyConsumer(profile: string): void {
  mkdirSync(profile, { recursive: true, mode: 0o700 })
  assertTemporaryProfilePath(profile)
  const allowedInitialFiles = new Set(['.npmrc', 'pnpm-workspace.yaml'])
  const existing = readdirSync(profile)
  assert.ok(!existing.includes('node_modules'), '初始 consumer 必须没有 node_modules')
  for (const name of existing) {
    assert.ok(allowedInitialFiles.has(name), `初始 consumer 只能有常规 .npmrc/pnpm-workspace.yaml；拒绝复用 ${name}`)
    const entry = lstatSync(join(profile, name))
    assert.ok(entry.isFile() && !entry.isSymbolicLink(), `初始文件必须是普通文件: ${name}`)
    assertPrivateOwnership(join(profile, name))
  }

  const npmrcPath = join(profile, '.npmrc')
  const npmrcText = existsSync(npmrcPath) ? readFileSync(npmrcPath, 'utf8') : ''
  for (const line of npmrcText.split(/\r?\n/)) {
    const value = line.trim()
    if (!value || value.startsWith('#')) continue
    const match = /^(registry|@daftai:registry)\s*=\s*(\S+)$/i.exec(value)
    assert.ok(match, 'isolated .npmrc 仅允许默认或 @daftai registry，不得注入认证、脚本或其他 PNPM 配置')
    const url = new URL(match[2])
    assert.ok(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, '.npmrc registry 必须是无凭据的 HTTP(S) URL')
  }

  const workspace = join(profile, 'pnpm-workspace.yaml')
  const workspacePolicy = 'packages:\n  - .\nnodeLinker: hoisted\nblockExoticSubdeps: true\nautoInstallPeers: false\n'
  const workspaceText = existsSync(workspace) ? readFileSync(workspace, 'utf8').replace(/\r\n/g, '\n') : workspacePolicy
  assert.equal(workspaceText.trimEnd(), workspacePolicy.trimEnd(), 'workspace 仅允许隔离 root、hoisted 与 blockExoticSubdeps:true 配置')

  if (!existsSync(npmrcPath)) writeFileSync(npmrcPath, '', { mode: 0o600, flag: 'wx' })
  if (!existsSync(workspace)) writeFileSync(workspace, workspacePolicy, { mode: 0o600, flag: 'wx' })
  const manifestPath = join(profile, 'package.json')
  writeFileSync(manifestPath, JSON.stringify({
    name: `pdsh-host-acceptance-${basename(profile)}`,
    private: true,
    type: 'module',
    dependencies: {},
    dsh: { profile: { bundles: [] } },
  }, null, 2) + '\n')
  const cordisPath = join(profile, 'cordis.yml')
  writeFileSync(cordisPath, '[]\n')
  const patchPath = join(profile, 'cordis.patch.yml')
  writeFileSync(patchPath, '[]\n')
  assertOwnedTempDirectory(join(profile, 'home'))
}

async function importHostModule(requireFromHost: NodeRequire, name: string): Promise<Record<string, any>> {
  const entry = requireFromHost.resolve(name)
  return await import(pathToFileURL(entry).href) as Record<string, any>
}

function activePdshRows(ctx: any): any[] {
  return [...ctx.loader.entries()].filter((entry: any) => entry.options.id === 'pdsh')
}

function assertSingleBundle(ctx: any): void {
  const entries = activePdshRows(ctx)
  assert.equal(entries.length, 1, 'Host 必须有且仅有一个 pdsh entry')
  assert.equal(entries[0].options.name, ROOT_BUNDLE, '必须保持 root 包名和配置地址')
  assert.equal(entries[0].fiber?.state, 2, 'root Host 未活动')
  const clientIds = ctx.clientModules.graph().entries.map((row: any) => row.id).filter((id: unknown) => typeof id === 'string' && id.startsWith('@daftai/pdsh'))
  assert.deepEqual(clientIds, [ROOT_BUNDLE], 'Client graph 必须只有 root Client')
  assert.ok(ctx.clientModules.clientPath(ROOT_BUNDLE), 'root Client 缺失')
}

/** 只等官方注册/撤回；不调用任何 product capture/save method。 */
async function waitWindowCapability(ctx: any, present: boolean): Promise<void> {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const states = [Boolean(ctx.get('pdshWindowCapture')), Boolean(ctx.typert.getPackage(ROOT_BUNDLE, 'host')),
      Boolean(ctx.typert.local.get('pdshNativeWindowCapture/capture')), Boolean(ctx.typert.local.get('pdshNativeWindowCapture/save'))]
    if (states.every(value => value === present)) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`Host service/Typert descriptors did not become ${present ? 'ready' : 'withdrawn'}`)
}

function assertPnpm11(manager: PackageManagerCommand, profile: string): void {
  const hostEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:npm|pnpm)_config_/i.test(key)))
  const output = execFileSync(manager.command, [...manager.args!, '--version'], {
    cwd: profile,
    encoding: 'utf8',
    env: { ...hostEnv, ...manager.env },
    timeout: 10_000,
  }).trim()
  assert.match(output, /^11\.7\./, `验收必须运行 DSH 随附 PNPM 11.7，实际为 ${output}`)
  const fingerprint = (path: string) => ({ path: realpathSync.native(path), sha256: createHash('sha256').update(readFileSync(path)).digest('hex') })
  const entrypoint = manager.args?.find(arg => isAbsolute(arg) && existsSync(arg) && lstatSync(arg).isFile())
  console.log(`Host package manager: pnpm ${output}; tool proof=${JSON.stringify({command:fingerprint(manager.command), entrypoint:entrypoint ? fingerprint(entrypoint) : undefined})}`)
}

async function main(): Promise<void> {
  const [fixtureArg, profileArg, tgzArg, pmArg, expectedResult = 'green'] = process.argv.slice(2)
  if (!fixtureArg || !profileArg || !tgzArg || !pmArg) usage()
  assert.ok(['green', 'historical-pnpm-red', 'historical-host-red'].includes(expectedResult), 'expectation 必須是 green、historical-pnpm-red 或 historical-host-red')

  const fixtureRoot = resolve(fixtureArg)
  const consumerProfile = resolve(profileArg)
  const isGithub = /^(?:https:\/\/github\.com\/daftAI2026\/PDSH(?:#[\w./-]+)?|github:daftAI2026\/PDSH#[\w./-]+)$/.test(tgzArg)
  const installSource = isGithub ? tgzArg : resolve(tgzArg)
  assertTemporaryProfilePath(consumerProfile)
  const installAnchor = join(fixtureRoot, 'package.json')
  assert.ok(existsSync(installAnchor), `fixtureRoot 缺少 package.json: ${fixtureRoot}`)
  assert.ok(isGithub || existsSync(installSource), `root tarball 不存在: ${installSource}`)
  assertEmptyConsumer(consumerProfile)
  const registry = managerRegistry(consumerProfile)
  const packageManager = readPackageManagerCommand(pmArg, consumerProfile)
  assertPnpm11(packageManager, consumerProfile)
  const candidateRoot = fileURLToPath(new URL('.', import.meta.url))
  const candidate = JSON.parse(readFileSync(join(candidateRoot, 'package.json'), 'utf8'))
  const packedProof = expectedResult === 'green' && !isGithub ? validatePackedBundle(candidateRoot, installSource) : undefined
  if (packedProof) console.log(`Artifact proof: ${JSON.stringify(packedProof)}`)
  const requireFromHost = createRequire(installAnchor)

  // 使用 Host 安装树中的模块，不从当前项目 node_modules 偷渡 Host 版本。
  const [cordis, loaderModule, settingsModule, editorModule, boot, clientModules, registryModule, typertLoaderModule, managerModule] = await Promise.all([
    importHostModule(requireFromHost, '@deepseek-ai/cordis'),
    importHostModule(requireFromHost, '@deepseek-ai/cordis-plugin-loader'),
    importHostModule(requireFromHost, '@deepseek-ai/dsh-settings'),
    importHostModule(requireFromHost, '@deepseek-ai/dsh-config-editor'),
    importHostModule(requireFromHost, '@deepseek-ai/dsh-app-boot'),
    importHostModule(requireFromHost, '@deepseek-ai/dsh-client-modules'),
    importHostModule(requireFromHost, '@deepseek-ai/dsh-typert-registry'),
    importHostModule(requireFromHost, '@deepseek-ai/dsh-typert-loader'),
    importHostModule(requireFromHost, '@deepseek-ai/dsh-plugin-manager'),
  ])

  const Context = cordis.Context ?? cordis.default?.Context
  const Loader = loaderModule.default ?? loaderModule.Loader
  const Settings = settingsModule.default ?? settingsModule.SettingsForms
  const ConfigEditor = editorModule.default ?? editorModule.ConfigEditor
  const PluginPackages = boot.PluginPackages
  const ClientModuleRegistry = clientModules.ClientModuleRegistry
  const TypertRegistry = registryModule.default ?? registryModule.TypertRegistry
  const PluginManager = managerModule.PluginManager ?? managerModule.default
  assert.ok(Context && Loader && Settings && ConfigEditor && PluginPackages && ClientModuleRegistry && TypertRegistry && typertLoaderModule.apply && PluginManager,
    '精确 DSH fixture 缺少验收所需官方模块')

  const profileName = basename(consumerProfile)
  const profileContext = {
    dir: consumerProfile,
    name: profileName,
    overlays: [],
    home: join(consumerProfile, 'home'),
    installAnchor,
    patchPath: join(consumerProfile, 'cordis.patch.yml'),
    startedBundles: [],
    telemetryDisabledEnv: undefined,
    packageManager,
  }
  const baseUrl = pathToFileURL(join(consumerProfile, 'package.json')).href
  const ctx = new Context()
  ctx.baseUrl = baseUrl
  let queue = Promise.resolve()
  const hmrScheduleStub = {
    runExclusive<T>(operation: () => Promise<T> | T): Promise<T> {
      const run = queue.then(operation)
      queue = run.then(() => undefined, () => undefined)
      return run
    },
  }

  try {
    await ctx.plugin(TypertRegistry).await()
    ctx.provide('profileContext', profileContext)
    ctx.provide('hmr', hmrScheduleStub)

    const empty = boot.loadProfileDirectory('dsh', consumerProfile, installAnchor)
    assert.deepEqual(empty.layers, [], '起始 profile 意外加载了 Bundle layer')
    assert.deepEqual(empty.skippedBundles, [], '起始 profile 出现被跳过的 Bundle')
    const resolution = await boot.createRuntimeResolution({ installAnchor, home: profileContext.home, profile: empty })
    await ctx.plugin(PluginPackages, { resolution }).await()
    await ctx.plugin(Loader, { baseUrl }).await()
    await ctx.plugin(typertLoaderModule).await()
    await ctx.plugin(ConfigEditor).await()
    await ctx.plugin(Settings).await()
    await ctx.plugin(ClientModuleRegistry).await()
    await boot.mountRootInclude(ctx, join(consumerProfile, 'cordis.yml'), [], baseUrl)
    await ctx.loader.await()
    assert.equal(activePdshRows(ctx).length, 0, '安装前必须没有 PDSH Host 行')

    await ctx.plugin(PluginManager, {
      registry,
      fallbackRegistries: [],
      pnpmCommand: packageManager.command,
      idleTimeoutMs: 120_000,
      inspectTimeoutMs: 30_000,
    }).await()
    const manager = ctx.get('pluginManager')
    assert.ok(manager?.installBundle && manager?.listPlugins, '官方 PluginManager service 未注册')
    const installed = await manager.installBundle(installSource, { enabled: true })
  if (expectedResult === 'historical-pnpm-red') {
      assert.equal(installed.application, 'failed', '预期 PNPM 拒绝，但官方 Manager 报告未失败')
      assert.ok(installed.packageResult && installed.packageResult.exitCode !== 0, `预期在 PNPM 安装阶段失败: ${JSON.stringify(installed)}`)
      assert.match(installed.error?.diagnostic ?? '', /ERR_PNPM_EXOTIC_SUBDEP/, 'PNPM-red 必须由 blockExoticSubdeps 拒绝 Git 子依赖，不接受网络等其他失败')
      assert.equal(activePdshRows(ctx).length, 0, 'PNPM 拒绝后不应有 PDSH Host 行')
      console.log(`EXPECTED RED [PNPM install]: exit=${installed.packageResult.exitCode}; ${JSON.stringify(installed.error)}`)
      return
    }
    if (expectedResult === 'historical-host-red') {
      assert.equal(installed.application, 'failed', '预期 Host 激活失败，但官方 Manager 没有失败')
      assert.equal(installed.packageResult?.exitCode, 0, `预期 PNPM 成功后才在 Host 激活失败: ${JSON.stringify(installed)}`)
      assert.ok(installed.error, 'Host 激活拒绝必须由官方 Manager 观察到')
      const diagnostic = installed.error?.diagnostic ?? ''
      assert.match(diagnostic, /3 entries did not activate/, 'Host-red 必须恰是三条 PDSH entry 未激活')
      for (const id of ['pdsh', 'pdsh-titles', 'pdsh-capture']) assert.ok(diagnostic.includes(`${id} (@daftai/pdsh-${id === 'pdsh' ? 'identity' : id.slice(5)}): failed to import`), `Host-red 缺少 ${id} failed-to-import`)
      assert.equal(activePdshRows(ctx).filter((entry) => entry.fiber?.state === 2).length, 0, 'Host 激活失败的负例不得留下活动 PDSH entry')
      console.log(`EXPECTED RED [Host activation after PNPM success]: pnpm=${installed.packageResult.exitCode}; ${JSON.stringify(installed.error)}`)
      return
    }
    assert.equal(installed.application, 'applied', `官方 Manager 未应用 Bundle: ${JSON.stringify(installed)}`)
    assert.equal(installed.error, undefined, `官方 Manager 安装报告错误: ${JSON.stringify(installed.error)}`)
    assert.equal(installed.bundle, ROOT_BUNDLE, '官方 Manager 安装的不是目标 root Bundle')
    assert.equal(installed.packageResult?.exitCode, 0, '官方 Manager 内部 PNPM 未成功')
    await ctx.loader.await()
    assertSingleBundle(ctx)
    await waitWindowCapability(ctx, true)
    const installedRoot = join(consumerProfile, 'node_modules', ROOT_BUNDLE)
    assert.equal(lstatSync(join(installedRoot, 'native/window-capture')).mode & 0o777, 0o755, '官方安装必须保留 helper 执行位；摘要一致不能替代权限验证')
    const installedManifest = JSON.parse(readFileSync(join(installedRoot, 'package.json'), 'utf8'))
    assert.equal(installedManifest.version, candidate.version, '被测包版本不是当前候选')
    const runtimeHashes: Record<string, string> = {}
    // +--- manifest glob 是分发规则，不是磁盘文件；只展开已校验的两个固定成员模式。 ---+
    for (const file of candidate.files.flatMap((file: string) => {
      if (file === 'locale/*.json') return ['locale/zh.json', 'locale/en.json'];
      if (file === 'lib/capture-runtime/*.js') return [`lib/capture-runtime/${candidate.version}.js`];
      return [file];
    })) {
      const installedBytes = readFileSync(join(installedRoot, file))
      assert.deepEqual(installedBytes, readFileSync(join(candidateRoot, file)), `被测包 ${file} 不是当前候选字节`)
      runtimeHashes[file] = createHash('sha256').update(installedBytes).digest('hex')
    }
    let resolvedSha: string | undefined
    if (isGithub) {
      const lock = readFileSync(join(consumerProfile, 'pnpm-lock.yaml'), 'utf8')
      const shas = [...new Set([...lock.matchAll(/https:\/\/codeload\.github\.com\/daftAI2026\/PDSH\/tar\.gz\/([a-f0-9]{40})/g)].map(match => match[1]))]
      assert.equal(shas.length, 1, 'GitHub 安装必须只有一个可复核的解析 SHA')
      resolvedSha = shas[0]
      const requested = /#([a-f0-9]{40})$/.exec(installSource)?.[1]
      if (requested) assert.equal(resolvedSha, requested, '实际安装提交与请求 SHA 不同')
    }
    const proof = { source: installSource, version: installedManifest.version, resolvedSha, packedProof, runtimeHashes }
    writeFileSync(join(consumerProfile, '.plugin-manager', 'pdsh-acceptance-proof.json'), JSON.stringify(proof, null, 2) + '\n')
    console.log(`PASS source binding: ${JSON.stringify(proof)}`)
    const manifest = JSON.parse(readFileSync(join(consumerProfile, 'package.json'), 'utf8'))
    assert.deepEqual(Object.keys(manifest.dependencies ?? {}), [ROOT_BUNDLE], 'Profile 直接依赖只能有 root Bundle')
    assert.deepEqual(manifest.dsh?.profile?.bundles, [ROOT_BUNDLE], '只选择一个 Bundle')
    const rootBundles = (await manager.listBundles()).filter((bundle: any) => bundle.name === ROOT_BUNDLE)
    assert.equal(rootBundles.length, 1)
    assert.equal(rootBundles[0].installed, true)
    assert.equal(rootBundles[0].enabled, true)
    assert.deepEqual(rootBundles[0].rows.map((row: any) => row.moduleName), [ROOT_BUNDLE])
    const meta = ctx.pluginPackages.metaOf(ROOT_BUNDLE, baseUrl)
    assert.equal(meta?.title?.zh, 'DSH 私密模式')
    assert.ok(meta?.description?.zh?.trim())
    assert.equal(rootBundles[0].rows[0]?.meta?.title?.zh, 'DSH 私密模式')
    console.log('PASS official-install: single root Bundle/Host/Client/metadata')

    const service = ctx.get('pdshWindowCapture')[cordis.symbols.original]
    let refreshCount = 0
    const refresh = service.refreshCaptureEnabled.bind(service)
    service.refreshCaptureEnabled = () => { refreshCount++; refresh() }
    const defaults = ctx.settings.describe().find((row: any) => row.ns === 'pdsh')
    assert.ok(defaults, 'root settings missing')
    const originalFields = FEATURE_FIELDS.map(key => ({key, own:Object.hasOwn(defaults.user ?? {}, key), value:defaults.user?.[key]}))
    for (let mask = 0; mask < 8; mask++) {
      const enabled = FEATURE_FIELDS.map((_field, index) => Boolean(mask & (1 << index)))
      const section = ctx.settings.describe().find((row: any) => row.ns === 'pdsh')
      const priorEnabled = section.value.captureEnabled
      const priorRefresh = refreshCount
      await ctx.settings.mutate('pdsh', FEATURE_FIELDS.map((key, index) => ({op:'set', path:[key], value:enabled[index]})), section.revision)
      await ctx.loader.await()
      assertSingleBundle(ctx)
      const accepted = ctx.settings.describe().find((row: any) => row.ns === 'pdsh')
      assert.deepEqual(FEATURE_FIELDS.map(key => accepted.value[key]), enabled)
      await waitWindowCapability(ctx, true)
      assert.equal(ctx.get('pdshWindowCapture')[cordis.symbols.original], service, 'volatile settings must retain the same service')
      if (priorEnabled !== enabled[2]) assert.ok(refreshCount > priorRefresh, 'Config owner did not refresh capture lifetime')
      console.log(`PASS functional-toggle ${mask.toString(2).padStart(3, '0')}: service/descriptors retained; owner refresh=${refreshCount}`)
    }
    const last = ctx.settings.describe().find((row: any) => row.ns === 'pdsh')
    await ctx.settings.mutate('pdsh', originalFields.map(({key,own,value}) => own ? {op:'set',path:[key],value} : {op:'unset',path:[key]}), last.revision)
    await ctx.loader.await()
    assertSingleBundle(ctx)

    // 真实 SettingsForms → ConfigEditor 写入；按 revision fence 更改昵称，再还原用户层原值。
    const identity = ctx.settings.describe().find((row: any) => row.ns === 'pdsh')
    assert.ok(identity, 'Settings 未展示 identity 配置')
    const priorHadNickname = Object.hasOwn(identity.user ?? {}, 'nickname')
    const priorUserNickname = identity.user?.nickname
    const priorValueNickname = identity.value?.nickname
    const changedNickname = 'PDSH Host acceptance'
    await ctx.settings.mutate('pdsh', [{ op: 'set', path: ['nickname'], value: changedNickname }], identity.revision)
    const changed = ctx.settings.describe().find((row: any) => row.ns === 'pdsh')
    assert.ok(changed && changed.revision > identity.revision, '昵称写入没有推进 Settings revision')
    assert.equal(changed.value?.nickname, changedNickname, 'Settings/ConfigEditor 没有写入测试昵称')
    if (priorHadNickname) {
      await ctx.settings.mutate('pdsh', [{ op: 'set', path: ['nickname'], value: priorUserNickname }], changed.revision)
    } else {
      await ctx.settings.mutate('pdsh', [{ op: 'unset', path: ['nickname'] }], changed.revision)
    }
    const restored = ctx.settings.describe().find((row: any) => row.ns === 'pdsh')
    assert.ok(restored && restored.revision > changed.revision, '恢复昵称没有推进 Settings revision')
    assert.equal(restored.value?.nickname, priorValueNickname, '昵称恢复后与修改前不一致')
    assert.equal(Object.hasOwn(restored.user ?? {}, 'nickname'), priorHadNickname, '昵称恢复改变了原有 profile override 层')
    console.log(`PASS settings: ConfigEditor nickname write/revision/restore (${identity.revision} → ${changed.revision} → ${restored.revision})`)

    const disabledBundle = await manager.setBundleEnabled(ROOT_BUNDLE, false)
    assert.equal(disabledBundle.application, 'applied', '官方 Manager 未应用 Bundle disable')
    assert.equal(disabledBundle.error, undefined)
    await ctx.loader.await()
    assert.equal(activePdshRows(ctx).length, 0, 'Bundle disable 后仍有 PDSH Host entry')
    await waitWindowCapability(ctx, false)
    assert.equal(ctx.clientModules.graph().entries.filter((row: any) => row.id.startsWith('@daftai/pdsh')).length, 0, 'Bundle disable 后 PDSH Client registry 未清理')
    const reenabledBundle = await manager.setBundleEnabled(ROOT_BUNDLE, true)
    assert.equal(reenabledBundle.application, 'applied', '官方 Manager 未应用 Bundle re-enable')
    assert.equal(reenabledBundle.error, undefined)
    await ctx.loader.await()
    assertSingleBundle(ctx)
    await waitWindowCapability(ctx, true)
    console.log('PASS bundle lifecycle: official disable removed Host/Client/service/descriptors; re-enable restored single root capability (no pixels requested)')
    console.log(`PASS fixture: ${fixtureRoot}`)
    console.log(`PASS isolated profile: ${consumerProfile}`)
  } finally {
    await ctx.fiber.dispose()
  }
}

await main()
