/**
 * [INPUT]: 依赖根 manifest、基础壳/内部能力源码与固定官方 Generator/protocol。
 * [OUTPUT]: 同源生成基础面、内部能力面及真实内部 manifest。不改生成 owner。
 * [POS]: 单 Bundle 的构建边界。内部包作用域只供反射与类型，不增加安装依赖。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { WorkspaceTypertGenerator } from '@deepseek-ai/dsh-typert-generator'

const REFERENCE_FILES = {
  'src/index.ts': 'd44d7bd7811f975dd7937e818f43360a6d683e465e688002dfc0aa25c3f65a33',
  'src/json-value.ts': 'c5d58b60b7e085004041326055737f7e718e719f5df7b7df5b09d2fb147e57c0',
  'src/owned-value.ts': '096c583e2093cd814d0cef5bc3f8161f6aabfe8cfe97eff78c3a340c0c95a44d',
  'src/remote-error.ts': 'bb902ec537e1dfbc74885e77a01192e6532b50a959a5bc4cc55c1fbf52e0a368',
  'src/types.ts': '5ffb787a9d0751c7296723de83a4ec54abaf814bc41dbc7dd62d2de30cb32e94',
  'package.json': '847d7758d0c2ca9ee3b609eeecc73f179d685e226ed205d1d6bf22f5440a32fb',
  'LICENSE': 'ebb4f09972aee8608be255debaf78451a68e95c290f55c240dec2ecfa16ea6be',
} as const

/** Official generator resolves only real packages beneath workspace/packages. */
export async function generateTypertArtifacts(root = fileURLToPath(new URL('../', import.meta.url))): Promise<void> {
  const { name: packageName, version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  if (!['@daftai/pdsh', '@daftai/pdsh-rc'].includes(packageName)) throw new Error('unsupported Typert package identity')
  await verifyProtocolReference(root)
  const workspace = await mkdtemp(join(tmpdir(), 'pdsh-typert-workspace-'))
  try {
    const packageRoot = join(workspace, 'packages', 'pdsh')
    const capabilityRoot = join(workspace, 'packages', 'pdsh-capabilities')
    const capabilityName = `${packageName}-capabilities`
    const protocolRoot = join(workspace, 'packages', 'typert-protocol-reference')
    await mkdir(packageRoot, { recursive: true })
    await mkdir(join(workspace, 'packages'), { recursive: true })
    await copySourceFiles(root, packageRoot)
    await copySourceFiles(root, capabilityRoot)
    await cp(join(root, 'tools/typert-protocol-reference'), protocolRoot, { recursive: true })
    const symlinkType = process.platform === 'win32' ? 'junction' : 'dir'
    await symlink(join(root, 'node_modules'), join(workspace, 'node_modules'), symlinkType)
    await writeWorkspaceFiles(workspace, packageRoot, packageName, version, capabilityRoot, capabilityName)

    const artifacts = new WorkspaceTypertGenerator(workspace).generate([packageName, capabilityName], ['host'])
    if (artifacts.length !== 2 || artifacts.some(artifact => artifact.face !== 'host')) throw new Error('official Typert workspace must emit both package scopes')
    for (const [name, output] of [[packageName, join(root, 'lib')], [capabilityName, join(root, 'lib/runtime-capabilities')]]) {
      const artifact = artifacts.find(candidate => candidate.package === name)
      if (!artifact?.remote) throw new Error('official Typert workspace missing package scope or Remote artifact')
      if (name === packageName) assertRemoteContract(artifact.remote.dts, artifact.remote.js)
      else assertCapabilityContract(artifact.remote.dts, artifact.js, artifact.remote.js)
      await mkdir(output, { recursive: true })
      await Promise.all([
        writeFile(join(output, 'typert.host.js'), artifact.js),
        writeFile(join(output, 'typert.host.d.ts'), artifact.dts),
        writeFile(join(output, 'typert.remote-client.js'), artifact.remote.js),
        writeFile(join(output, 'typert.remote-client.d.ts'), artifact.remote.dts),
      ])
    }
    await writeFile(join(root, 'lib/runtime-capabilities/package.json'), JSON.stringify({
      name: capabilityName, version, private: true, type: 'module',
      exports: {
        '.': './typert.host.js',
        './typert': { types: './typert.host.d.ts', default: './typert.host.js' },
        './remote': { types: './typert.remote-client.d.ts', default: './typert.remote-client.js' },
        './types': { types: './types/shared/remote-types.d.ts' },
      },
    }, null, 2) + '\n')
    // +--- 两个反射作用域共用 DTO 源；内部 self-reference 必须有实际声明闭包。 ---+
    execFileSync(
      process.execPath,
      [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.remote-types.json'],
      { cwd: root, stdio: 'inherit' },
    )
    const declarationNames = ['capture-export', 'capture-geometry', 'remote-types', 'window-capture-protocol', 'window-save-protocol', 'system-wallpaper-protocol']
    await mkdir(join(root, 'lib/runtime-capabilities/types/shared'), { recursive: true })
    for (const name of declarationNames) await cp(join(root, `lib/types/shared/${name}.d.ts`), join(root, `lib/runtime-capabilities/types/shared/${name}.d.ts`))
    const protocol = '[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n'
    await writeFile(join(root, 'lib/runtime-capabilities/CLAUDE.md'), `# lib/runtime-capabilities/\n> L2 | 父级: ../CLAUDE.md\n\n- \`package.json\`: 根身份派生的真实 private 包作用域。版本由根 manifest 生成；不安装第二依赖。\n- \`typert.host.js\`: 官方能力反射面。版本化业务在自有子 Fiber 注册，不覆盖旧基础面。\n- \`typert.host.d.ts\`: 同次生成的 Host 面声明。\n- \`typert.remote-client.js\`: 官方能力 Remote 贡献，内联到唯一根 Client。\n- \`typert.remote-client.d.ts\`: 官方 Remote 声明，self-reference 指向同源 ./types。\n- \`types/\`: 从 shared 源复制的 TypeScript 声明闭包。\n\n${protocol}`)
    await writeFile(join(root, 'lib/runtime-capabilities/types/CLAUDE.md'), `# lib/runtime-capabilities/types/\n> L2 | 父级: ../CLAUDE.md\n\n- \`shared/\`: shared DTO 的同源声明闭包。只供内部反射包的类型自引用。\n\n${protocol}`)
    await writeFile(join(root, 'lib/runtime-capabilities/types/shared/CLAUDE.md'), `# lib/runtime-capabilities/types/shared/\n> L2 | 父级: ../CLAUDE.md\n\n${declarationNames.map(name => `- \`${name}.d.ts\`: src/shared/${name}.ts 的声明副本；由生成入口同步，不手工修改。`).join('\n')}\n\n${protocol}`)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

async function copySourceFiles(sourceRoot: string, packageRoot: string): Promise<void> {
  //+--- Copy only TS source; no generated JS, project maps, or parallel authored implementation. ---+
  for (const module of ['host', 'shared']) {
    await copyTypeTree(join(sourceRoot, 'src', module), join(packageRoot, 'src', module))
  }
}

async function copyTypeTree(source: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true })
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name)
    const to = join(destination, entry.name)
    if (entry.isDirectory()) await copyTypeTree(from, to)
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) await cp(from, to)
  }
}

async function writeWorkspaceFiles(workspace: string, packageRoot: string, packageName: string, version: string,
  capabilityRoot: string, capabilityName: string): Promise<void> {
  const packageManifest = {
    name: packageName,
    version,
    private: true,
    type: 'module',
    exports: {
      '.': './src/host/index.ts',
      './types': { types: './src/shared/remote-types.ts' },
      './typert': { types: './lib/typert.host.d.ts', default: './lib/typert.host.js' },
      './remote': { types: './lib/typert.remote-client.d.ts', default: './lib/typert.remote-client.js' },
      './package.json': './package.json',
    },
    files: ['lib/typert.host.js', 'lib/typert.host.d.ts', 'lib/typert.remote-client.js', 'lib/typert.remote-client.d.ts'],
  }
  const baseConfig = {
    compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler',
      strict: false, skipLibCheck: true, declaration: true, declarationMap: false,
      allowImportingTsExtensions: true, emitDeclarationOnly: true, composite: true,
      verbatimModuleSyntax: true, useDefineForClassFields: true, jsx: 'react-jsx',
      types: ['node'],
    },
  }
  const hostConfig = {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      composite: true, rootDir: 'src', outDir: 'lib/types',
      tsBuildInfoFile: 'lib/tsconfig.host.tsbuildinfo',
    },
    files: ['src/host/index.ts', 'src/shared/remote-types.ts'],
  }
  const protocolConfig = {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      composite: true, rootDir: 'src', outDir: 'lib/types',
      tsBuildInfoFile: 'lib/tsconfig.protocol.tsbuildinfo',
      lib: ['ES2022', 'ESNext.Disposable'],
    },
    files: Object.keys(REFERENCE_FILES).filter(path => path.startsWith('src/')),
  }
  const aggregateConfig = {
    extends: './tsconfig.base.json',
    files: [],
    compilerOptions: {
      paths: {
        '@deepseek-ai/dsh-typert-protocol': ['packages/typert-protocol-reference/src/index.ts'],
        '@deepseek-ai/dsh-typert-protocol/*': ['packages/typert-protocol-reference/src/*'],
      },
    },
    references: [
      { path: 'packages/pdsh/tsconfig.host.json' },
      { path: 'packages/pdsh-capabilities/tsconfig.host.json' },
      { path: 'packages/typert-protocol-reference/tsconfig.source-analysis.json' },
    ],
  }

  await Promise.all([
    writeFile(join(workspace, 'tsconfig.base.json'), JSON.stringify(baseConfig, null, 2)),
    writeFile(join(workspace, 'tsconfig.host.json'), JSON.stringify(aggregateConfig, null, 2)),
    writeFile(join(packageRoot, 'package.json'), JSON.stringify(packageManifest, null, 2)),
    writeFile(join(packageRoot, 'tsconfig.host.json'), JSON.stringify(hostConfig, null, 2)),
    writeFile(join(capabilityRoot, 'package.json'), JSON.stringify({
      ...packageManifest, name: capabilityName,
      exports: { ...packageManifest.exports, '.': './src/host/runtime-capabilities-service.ts' },
    }, null, 2)),
    writeFile(join(capabilityRoot, 'tsconfig.host.json'), JSON.stringify({
      ...hostConfig, files: ['src/host/runtime-capabilities-service.ts', 'src/shared/remote-types.ts'],
    }, null, 2)),
    writeFile(join(workspace, 'packages/typert-protocol-reference/tsconfig.source-analysis.json'), JSON.stringify(protocolConfig, null, 2)),
  ])
}

function assertCapabilityContract(dts: string, host: string, remote: string): void {
  if (!dts.includes('wallpaper: (request: WallpaperRequest, signal?: AbortSignal) => RemoteStreamHandle<WallpaperFrame, never>')
    || !dts.includes('implementationVersion: () => Promise<RemoteResult<string>>')
    || !dts.includes('captureGeometryRegistered: () => Promise<RemoteResult<boolean>>')
    || !dts.includes('captureGeometry: (pngSha256: string) => Promise<RemoteResult<CaptureGeometry | null>>')
    || !dts.includes('wallpaperRegistered: () => Promise<RemoteResult<boolean>>')) throw new Error('official runtime capability declarations drifted')
  for (const source of [host, remote]) {
    const namespaces = [...new Set([...source.matchAll(/namespace: '([^']+)'/g)].map(match => match[1]))]
    if (namespaces.length !== 1 || namespaces[0] !== 'pdshRuntimeCapabilities') throw new Error('runtime capabilities must use their own namespace')
    for (const method of ['implementationVersion', 'wallpaperRegistered', 'wallpaper', 'captureGeometryRegistered', 'captureGeometry']) {
      if (!source.includes(`method: '${method}'`)) throw new Error(`official runtime capability missing ${method}`)
    }
  }
}

async function verifyProtocolReference(root: string): Promise<void> {
  const folder = join(root, 'tools/typert-protocol-reference')
  for (const [path, expected] of Object.entries(REFERENCE_FILES)) {
    const bytes = await readFile(join(folder, path))
    const text = bytes.toString('utf8')
    if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error(`Typert protocol reference is not UTF-8: ${path}`)
    const lineEndings = new Set(text.match(/\r\n|\r|\n/g) ?? [])
    if (lineEndings.has('\r') || lineEndings.size > 1) {
      throw new Error(`Typert protocol reference must use uniform LF or CRLF line endings: ${path}`)
    }
    // +--- 规范化只消除 Git 行尾差异；固定 SHA 仍锁定全部源码字节。 ---+
    const actual = createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')
    if (actual !== expected) throw new Error(`Typert protocol reference drift: ${path}`)
  }
  const dependencyPath = join(root, 'node_modules/@deepseek-ai/dsh-typert-protocol/package.json')
  const installed = JSON.parse(await readFile(dependencyPath, 'utf8'))
  if (installed.name !== '@deepseek-ai/dsh-typert-protocol' || installed.version !== '0.2.0-rc.2') {
    throw new Error('PDSH Host must resolve the exact official Typert protocol runtime dependency')
  }
  const protocolStat = await lstat(join(root, 'node_modules/@deepseek-ai/dsh-typert-protocol'))
  if (!protocolStat.isSymbolicLink() && !protocolStat.isDirectory()) throw new Error('official protocol package is not a regular package path')
}

function assertRemoteContract(dts: string, js: string): void {
  const requiredTypeTokens = [
    'capture: (signal?: AbortSignal) => RemoteStreamHandle<CaptureFrame, never>',
    'save: (request: WindowSaveRequest, signal?: AbortSignal) => RemoteStreamHandle<WindowSaveFrame, WindowSaveInputFrame>',
    'wallpaper: (request: WallpaperRequest, signal?: AbortSignal) => RemoteStreamHandle<WallpaperFrame, never>',
  ]
  for (const token of requiredTypeTokens) {
    if (!dts.includes(token)) throw new Error(`official Typert Remote declaration missing contract: ${token}`)
  }
  if (!js.includes("method: 'save'") || !js.includes("method: 'wallpaper'") || !js.includes('uplink:')) {
    throw new Error('official Typert Remote descriptor must include a generated save uplink codec')
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await generateTypertArtifacts()
}
