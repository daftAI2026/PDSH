/**
 * [INPUT]: Windows ACL helper 与仅作用于本测试自有目录的 ACE 操作。
 * [OUTPUT]: 验证安全临时根、叶 ACL、祖先替换权限、创建窗口与非空目录保护边界。
 * [POS]: 原生临时路径合同；所有 fixture 位于本测试创建的 LocalAppData 子目录。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { assertWindowsPrivateOwnership, protectWindowsOwnedDirectory } from '../tools/windows-temp-ownership.ts'

const windowsOnly = { skip: process.platform !== 'win32' }
const TEST_ACE_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
try {
  $target = [Environment]::GetEnvironmentVariable('PDSH_WINDOWS_TEST_TARGET')
  $action = [Environment]::GetEnvironmentVariable('PDSH_WINDOWS_TEST_ACTION')
  $kind = [Environment]::GetEnvironmentVariable('PDSH_WINDOWS_TEST_ACE')
  if ([string]::IsNullOrWhiteSpace($target)) { throw 'missing target' }
  if ($action -eq 'remove') {
    & icacls.exe $target /remove:g '*S-1-1-0' /Q 2>&1 | Out-Null
  } elseif ($action -eq 'grant') {
    switch ($kind) {
      'inherit-only' { $ace = '*S-1-1-0:(CI)(IO)(WD)' }
      'effective' { $ace = '*S-1-1-0:(WD)' }
      'inherited-write' { $ace = '*S-1-1-0:(OI)(CI)(WD)' }
      'delete' { $ace = '*S-1-1-0:(D)' }
      'delete-child' { $ace = '*S-1-1-0:(DC)' }
      default { throw 'invalid ace kind' }
    }
    & icacls.exe $target /grant $ace /Q 2>&1 | Out-Null
  } else {
    throw 'invalid action'
  }
  if ($LASTEXITCODE -ne 0) { throw 'icacls failure' }
  [Console]::Out.WriteLine('PDSH_TEST_ACE_OK')
} catch {
  [Console]::Error.WriteLine('PDSH_TEST_ACE_FAILED')
  exit 2
}
`
const ACL_SDDL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
try {
  $target = [Environment]::GetEnvironmentVariable('PDSH_WINDOWS_TEST_TARGET')
  if ([string]::IsNullOrWhiteSpace($target)) { throw 'missing target' }
  $acl = Get-Acl -LiteralPath $target -ErrorAction Stop
  $descriptor = $acl.GetSecurityDescriptorSddlForm([System.Security.AccessControl.AccessControlSections]::All)
  [Console]::Out.WriteLine($descriptor)
} catch {
  [Console]::Error.WriteLine('PDSH_TEST_ACL_READ_FAILED')
  exit 2
}
`

let safeTempRoot: string | undefined
const originalTemp = process.env.TEMP
const originalTmp = process.env.TMP

function restoreEnvironment(name: 'TEMP' | 'TMP', value: string | undefined): void {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

test.before(() => {
  if (process.platform !== 'win32') return
  const localAppData = process.env.LOCALAPPDATA
  assert.ok(localAppData, 'Windows 测试需要 LOCALAPPDATA')
  process.env.TEMP = localAppData
  process.env.TMP = localAppData
  try {
    safeTempRoot = mkdtempSync(join(localAppData, 'pdsh-windows-owner-root-'))
    protectWindowsOwnedDirectory(safeTempRoot)
    process.env.TEMP = safeTempRoot
    process.env.TMP = safeTempRoot
  } catch (error) {
    restoreEnvironment('TEMP', originalTemp)
    restoreEnvironment('TMP', originalTmp)
    if (safeTempRoot) rmSync(safeTempRoot, { recursive: true, force: true })
    safeTempRoot = undefined
    throw error
  }
})

test.after(() => {
  if (process.platform !== 'win32' || !safeTempRoot) return
  restoreEnvironment('TEMP', originalTemp)
  restoreEnvironment('TMP', originalTmp)
  rmSync(safeTempRoot, { recursive: true, force: true })
})

function createOwnedTestDirectory(): string {
  return mkdtempSync(join(tmpdir(), 'pdsh-windows-owner-'))
}

function runTestAclAction(path: string, action: 'grant' | 'remove', kind = ''): string {
  try {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', TEST_ACE_SCRIPT], {
      env: {
        ...process.env,
        PDSH_WINDOWS_TEST_TARGET: path,
        PDSH_WINDOWS_TEST_ACTION: action,
        PDSH_WINDOWS_TEST_ACE: kind,
      },
      encoding: 'utf8',
      maxBuffer: 16 * 1024,
      timeout: 15_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(output.trim(), 'PDSH_TEST_ACE_OK', '测试 ACE 操作必须返回固定成功标记')
    return output
  } catch {
    assert.fail('测试无法操作自有临时目录 ACL')
  }
}

function addEveryoneAce(path: string, kind: 'inherit-only' | 'effective' | 'inherited-write' | 'delete' | 'delete-child'): void {
  runTestAclAction(path, 'grant', kind)
}

function removeEveryoneAces(path: string): void {
  runTestAclAction(path, 'remove')
}

function readAclSddl(path: string): string {
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ACL_SDDL_SCRIPT], {
      env: { ...process.env, PDSH_WINDOWS_TEST_TARGET: path },
      encoding: 'utf8',
      maxBuffer: 16 * 1024,
      timeout: 15_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    assert.fail('测试无法读取自有临时目录 ACL')
  }
}

test('accepts a protected self-owned temporary directory ACL', windowsOnly, () => {
  const directory = createOwnedTestDirectory()
  try {
    protectWindowsOwnedDirectory(directory)
    assert.doesNotThrow(() => assertWindowsPrivateOwnership(directory))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('ignores an Everyone InheritOnly allow that does not apply to the directory', windowsOnly, () => {
  const directory = createOwnedTestDirectory()
  try {
    protectWindowsOwnedDirectory(directory)
    addEveryoneAce(directory, 'inherit-only')
    assert.doesNotThrow(() => assertWindowsPrivateOwnership(directory))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('rejects an effective Everyone write allow on the leaf', windowsOnly, () => {
  const directory = createOwnedTestDirectory()
  try {
    protectWindowsOwnedDirectory(directory)
    addEveryoneAce(directory, 'effective')
    assert.throws(() => assertWindowsPrivateOwnership(directory), /Windows 临时目录 ACL 检查或保护失败/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('accepts a trusted regular .npmrc file', windowsOnly, () => {
  const directory = createOwnedTestDirectory()
  const file = join(directory, '.npmrc')
  try {
    writeFileSync(file, 'registry=https://registry.npmjs.org/\n')
    assert.doesNotThrow(() => assertWindowsPrivateOwnership(file))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('rejects an effective Everyone write allow on a regular file', windowsOnly, () => {
  const directory = createOwnedTestDirectory()
  const file = join(directory, 'fixture.npmrc')
  try {
    writeFileSync(file, 'registry=https://registry.npmjs.org/\n')
    assert.doesNotThrow(() => assertWindowsPrivateOwnership(file))
    addEveryoneAce(file, 'effective')
    assert.throws(() => assertWindowsPrivateOwnership(file), /Windows 临时目录 ACL 检查或保护失败/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('rejects inherited untrusted write before protecting a newly created directory', windowsOnly, () => {
  const parent = createOwnedTestDirectory()
  try {
    protectWindowsOwnedDirectory(parent)
    addEveryoneAce(parent, 'inherited-write')
    const directory = join(parent, 'new-child')
    mkdirSync(directory)
    assert.throws(() => protectWindowsOwnedDirectory(directory), /Windows 临时目录 ACL 检查或保护失败/)
    assert.throws(() => assertWindowsPrivateOwnership(directory), /Windows 临时目录 ACL 检查或保护失败/)
  } finally {
    removeEveryoneAces(parent)
    rmSync(parent, { recursive: true, force: true })
  }
})

test('rejects untrusted Delete and DeleteChild on ancestors for assert and protect', windowsOnly, () => {
  for (const kind of ['delete', 'delete-child'] as const) {
    const parent = createOwnedTestDirectory()
    try {
      protectWindowsOwnedDirectory(parent)
      const existingLeaf = join(parent, 'existing-child')
      mkdirSync(existingLeaf)
      protectWindowsOwnedDirectory(existingLeaf)
      addEveryoneAce(parent, kind)
      assert.throws(() => assertWindowsPrivateOwnership(existingLeaf), /Windows 临时目录 ACL 检查或保护失败/)

      const newLeaf = join(parent, 'new-child')
      mkdirSync(newLeaf)
      assert.throws(() => protectWindowsOwnedDirectory(newLeaf), /Windows 临时目录 ACL 检查或保护失败/)
    } finally {
      removeEveryoneAces(parent)
      rmSync(parent, { recursive: true, force: true })
    }
  }
})

test('does not change ACL when protection rejects a nonempty directory', windowsOnly, () => {
  const directory = createOwnedTestDirectory()
  try {
    writeFileSync(join(directory, 'fixture'), 'fixture')
    addEveryoneAce(directory, 'effective')
    const before = readAclSddl(directory)
    assert.throws(() => protectWindowsOwnedDirectory(directory), /Windows 临时目录 ACL 检查或保护失败/)
    assert.equal(readAclSddl(directory), before)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
