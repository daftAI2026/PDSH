/**
 * [INPUT]: 依赖 staging manifest 包身份、PDSH Host/shared TypeScript、固定 upstream protocol reference 与官方 WorkspaceTypertGenerator。
 * [OUTPUT]: 把官方模型生成的取像/保存/壁纸 descriptor、Remote client 类型/API 与 schemas 写入 package/lib；不手写 wire descriptor。
 * [POS]: 单 Bundle 的 build-only generator bridge；真实源在临时 packages/ workspace 内按路径复制，规避 Generator 的 realpath package boundary。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createHash } from 'node:crypto'
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
  const { name: packageName } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  if (!['@daftai/pdsh', '@daftai/pdsh-rc'].includes(packageName)) throw new Error('unsupported Typert package identity')
  await verifyProtocolReference(root)
  const workspace = await mkdtemp(join(tmpdir(), 'pdsh-typert-workspace-'))
  try {
    const packageRoot = join(workspace, 'packages', 'pdsh')
    const protocolRoot = join(workspace, 'packages', 'typert-protocol-reference')
    await mkdir(packageRoot, { recursive: true })
    await mkdir(join(workspace, 'packages'), { recursive: true })
    await copySourceFiles(root, packageRoot)
    await cp(join(root, 'tools/typert-protocol-reference'), protocolRoot, { recursive: true })
    await symlink(join(root, 'node_modules'), join(workspace, 'node_modules'), 'dir')
    await writeWorkspaceFiles(workspace, packageRoot, packageName)

    const artifacts = new WorkspaceTypertGenerator(workspace).generate([packageName], ['host'])
    if (artifacts.length !== 1 || artifacts[0].package !== packageName || artifacts[0].face !== 'host') {
      throw new Error('official Typert workspace must emit exactly one PDSH Host artifact')
    }
    const artifact = artifacts[0]
    if (!artifact.remote) throw new Error('official Typert workspace did not emit the Remote client artifact')
    assertRemoteContract(artifact.remote.dts, artifact.remote.js)

    const output = join(root, 'lib')
    await mkdir(output, { recursive: true })
    await Promise.all([
      writeFile(join(output, 'typert.host.js'), artifact.js),
      writeFile(join(output, 'typert.host.d.ts'), artifact.dts),
      writeFile(join(output, 'typert.remote-client.js'), artifact.remote.js),
      writeFile(join(output, 'typert.remote-client.d.ts'), artifact.remote.dts),
    ])
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

async function writeWorkspaceFiles(workspace: string, packageRoot: string, packageName: string): Promise<void> {
  const packageManifest = {
    name: packageName,
    version: '0.0.0-build-only',
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
      { path: 'packages/typert-protocol-reference/tsconfig.source-analysis.json' },
    ],
  }

  await Promise.all([
    writeFile(join(workspace, 'tsconfig.base.json'), JSON.stringify(baseConfig, null, 2)),
    writeFile(join(workspace, 'tsconfig.host.json'), JSON.stringify(aggregateConfig, null, 2)),
    writeFile(join(packageRoot, 'package.json'), JSON.stringify(packageManifest, null, 2)),
    writeFile(join(packageRoot, 'tsconfig.host.json'), JSON.stringify(hostConfig, null, 2)),
    writeFile(join(workspace, 'packages/typert-protocol-reference/tsconfig.source-analysis.json'), JSON.stringify(protocolConfig, null, 2)),
  ])
}

async function verifyProtocolReference(root: string): Promise<void> {
  const folder = join(root, 'tools/typert-protocol-reference')
  for (const [path, expected] of Object.entries(REFERENCE_FILES)) {
    const bytes = await readFile(join(folder, path))
    const actual = createHash('sha256').update(bytes).digest('hex')
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
