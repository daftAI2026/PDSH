/**
 * [INPUT]: 依赖真实根源码、固定 Typert protocol 与官方 WorkspaceTypertGenerator。
 * [OUTPUT]: 验证跨平台临时 workspace、协议行尾身份与真实生成产物。
 * [POS]: 构建链平台合同；只在 OS 临时目录生成，不改仓库产品产物。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { generateTypertArtifacts } from '../tools/generate-typert.ts'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const SOURCE_PATHS = [
  'package.json',
  'tsconfig.json',
  'tsconfig.remote-types.json',
  'src/host',
  'src/shared',
  'tools/typert-protocol-reference',
]
const REFERENCE_FILES = [
  'src/index.ts',
  'src/json-value.ts',
  'src/owned-value.ts',
  'src/remote-error.ts',
  'src/types.ts',
  'package.json',
  'LICENSE',
]

test('official Typert generation works with CRLF checkout and platform-native workspace links', async t => {
  const root = await createStageRoot()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeReferencesWithCRLF(root)

  await generateTypertArtifacts(root)

  const host = await readFile(join(root, 'lib/typert.host.js'), 'utf8')
  const remote = await readFile(join(root, 'lib/typert.remote-client.js'), 'utf8')
  const capability = await readFile(join(root, 'lib/runtime-capabilities/typert.host.js'), 'utf8')
  assert.match(host, /pdshWindowCapture/)
  assert.match(remote, /pdshWindowCapture/)
  assert.match(capability, /pdshRuntimeCapabilities/)
  await readFile(join(root, 'lib/runtime-capabilities/typert.remote-client.d.ts'))
  await readFile(join(root, 'lib/runtime-capabilities/package.json'))
})

test('protocol SHA still rejects changed source after permitted line-ending normalization', async t => {
  const root = await createStageRoot()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeReferencesWithCRLF(root)
  const indexPath = join(root, 'tools/typert-protocol-reference/src/index.ts')
  const source = await readFile(indexPath, 'utf8')
  await writeFile(indexPath, `${source}// changed protocol source\r\n`)

  await assert.rejects(generateTypertArtifacts(root), /Typert protocol reference drift: src\/index\.ts/)
})

test('protocol SHA rejects unsupported carriage returns', async t => {
  const root = await createStageRoot()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeReferencesWithCRLF(root)
  const indexPath = join(root, 'tools/typert-protocol-reference/src/index.ts')
  const source = await readFile(indexPath, 'utf8')
  await writeFile(indexPath, `${source}\r`)

  await assert.rejects(generateTypertArtifacts(root), /uniform LF or CRLF line endings: src\/index\.ts/)
})

async function createStageRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pdsh-typert-platform-'))
  try {
    for (const path of SOURCE_PATHS) await cp(join(repositoryRoot, path), join(root, path), { recursive: true })
    await symlink(join(repositoryRoot, 'node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    return root
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}

async function writeReferencesWithCRLF(root: string): Promise<void> {
  const folder = join(root, 'tools/typert-protocol-reference')
  for (const path of REFERENCE_FILES) {
    const file = join(folder, path)
    const bytes = await readFile(file)
    const source = bytes.toString('utf8')
    assert.ok(Buffer.from(source, 'utf8').equals(bytes), `fixture must be UTF-8: ${path}`)
    const lf = source.replace(/\r\n/g, '\n')
    assert.doesNotMatch(lf, /\r/, `fixture must not contain bare CR: ${path}`)
    await writeFile(file, lf.replace(/\n/g, '\r\n'))
  }
}
