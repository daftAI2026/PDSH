/**
 * [INPUT]: 读取 Windows 文件或目录 owner、reparse 状态和 ACL，并保护新建空临时目录。
 * [OUTPUT]: 校验普通文件/目录叶子及完整祖先链；仅新建空目录可设置私有 ACL。
 * [POS]: tools 的 Windows 临时路径边界；叶子限当前用户/管理员，祖先拒绝不可信替换能力。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { execFileSync } from 'node:child_process'
import { lstatSync, realpathSync, readdirSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'

const WINDOWS_ACL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'

function Get-PdshDirectoryChain([string] $Target) {
  $fullPath = [System.IO.Path]::GetFullPath($Target)
  $leaf = Get-Item -LiteralPath $fullPath -Force -ErrorAction Stop
  if (($leaf.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'reparse point'
  }
  $chain = [System.Collections.Generic.List[object]]::new()
  $leafAcl = Get-Acl -LiteralPath $fullPath -ErrorAction Stop
  [void]$chain.Add(@{ Item = $leaf; Acl = $leafAcl })
  if ($leaf.PSIsContainer) {
    $cursor = [System.IO.DirectoryInfo]::new($fullPath).Parent
  } else {
    $cursor = [System.IO.FileInfo]::new($fullPath).Directory
  }
  while ($null -ne $cursor) {
    $item = Get-Item -LiteralPath $cursor.FullName -Force -ErrorAction Stop
    if (-not $item.PSIsContainer) { throw 'not a directory' }
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'reparse point'
    }
    $acl = Get-Acl -LiteralPath $cursor.FullName -ErrorAction Stop
    [void]$chain.Add(@{ Item = $item; Acl = $acl })
    $cursor = $cursor.Parent
  }
  if ($chain.Count -eq 0) { throw 'empty directory chain' }
  return $chain.ToArray()
}

function Get-PdshContext([string] $Target) {
  $chain = @(Get-PdshDirectoryChain $Target)
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  if ($null -eq $identity.User) { throw 'missing user sid' }
  $principal = [System.Security.Principal.WindowsPrincipal]::new($identity)
  $userSid = $identity.User.Value
  $adminSid = 'S-1-5-32-544'
  $systemSid = 'S-1-5-18'
  $trustedInstallerSid = 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464'
  $isAdmin = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
  $leafOwnerSid = $chain[0].Acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
  if (($leafOwnerSid -ne $userSid) -and (-not ($isAdmin -and ($leafOwnerSid -eq $adminSid)))) {
    throw 'untrusted leaf owner'
  }
  return @{
    Chain = $chain
    Item = $chain[0].Item
    Acl = $chain[0].Acl
    UserSid = $userSid
    AdminSid = $adminSid
    SystemSid = $systemSid
    TrustedInstallerSid = $trustedInstallerSid
  }
}

function Assert-PdshPrivateAcl($Context) {
  $leafTrustedSids = @($Context.UserSid, $Context.SystemSid, $Context.AdminSid, $Context.TrustedInstallerSid)
  $ancestorTrustedSids = @($Context.UserSid, $Context.SystemSid, $Context.AdminSid, $Context.TrustedInstallerSid)
  $writeMask = [uint32](0x00000002 -bor 0x00000004 -bor 0x00000010 -bor 0x00000100 -bor 0x00000040 -bor 0x00010000 -bor 0x00040000 -bor 0x00080000 -bor 0x10000000 -bor 0x40000000)
  $replacementMask = [uint32](0x00000040 -bor 0x00010000 -bor 0x00040000 -bor 0x00080000 -bor 0x10000000)

  foreach ($rule in $Context.Acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
    if ($rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) { continue }
    if (($rule.PropagationFlags -band [System.Security.AccessControl.PropagationFlags]::InheritOnly) -ne 0) { continue }
    $sid = $rule.IdentityReference.Value
    if ($leafTrustedSids -contains $sid) { continue }
    $rights = [uint32]$rule.FileSystemRights
    if (($rights -band $writeMask) -ne 0) { throw 'untrusted leaf write allow' }
  }

  for ($index = 1; $index -lt $Context.Chain.Count; $index++) {
    $ancestor = $Context.Chain[$index]
    $ownerSid = $ancestor.Acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
    if ($ancestorTrustedSids -notcontains $ownerSid) { throw 'untrusted ancestor owner' }
    foreach ($rule in $ancestor.Acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
      if ($rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) { continue }
      if (($rule.PropagationFlags -band [System.Security.AccessControl.PropagationFlags]::InheritOnly) -ne 0) { continue }
      $sid = $rule.IdentityReference.Value
      if ($ancestorTrustedSids -contains $sid) { continue }
      $rights = [uint32]$rule.FileSystemRights
      if (($rights -band $replacementMask) -ne 0) { throw 'untrusted ancestor replacement allow' }
    }
  }
}

function Set-PdshPrivateAcl($Context, [string] $Target) {
  if (@(Get-ChildItem -LiteralPath $Target -Force -ErrorAction Stop).Count -ne 0) {
    throw 'directory is not empty'
  }
  $acl = $Context.Acl
  $acl.SetAccessRuleProtection($true, $false)
  $oldRules = $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
  foreach ($rule in $oldRules) { [void]$acl.RemoveAccessRuleSpecific($rule) }

  $trustedSids = @($Context.UserSid, $Context.SystemSid, $Context.AdminSid)
  $inheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
  foreach ($sidText in $trustedSids) {
    $sid = [System.Security.Principal.SecurityIdentifier]::new($sidText)
    $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
      $sid,
      [System.Security.AccessControl.FileSystemRights]::FullControl,
      $inheritance,
      [System.Security.AccessControl.PropagationFlags]::None,
      [System.Security.AccessControl.AccessControlType]::Allow
    )
    [void]$acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $Target -AclObject $acl -ErrorAction Stop
}

try {
  $target = [Environment]::GetEnvironmentVariable('PDSH_WINDOWS_OWNERSHIP_TARGET')
  $action = [Environment]::GetEnvironmentVariable('PDSH_WINDOWS_OWNERSHIP_ACTION')
  if ([string]::IsNullOrWhiteSpace($target)) { throw 'missing target' }
  $context = Get-PdshContext $target
  if ($action -eq 'protect') {
    if (-not $context.Item.PSIsContainer) { throw 'not a directory' }
    Assert-PdshPrivateAcl $context
    Set-PdshPrivateAcl $context $target
    $context = Get-PdshContext $target
  } elseif ($action -ne 'assert') {
    throw 'invalid action'
  }
  Assert-PdshPrivateAcl $context
  [Console]::Out.WriteLine('PDSH_PRIVATE_OK')
} catch {
  [Console]::Error.WriteLine('PDSH_PRIVATE_REJECTED')
  exit 2
}
`

const FAILURE_MESSAGE = 'Windows 临时目录 ACL 检查或保护失败'

function runWindowsAclAction(path: string, action: 'assert' | 'protect'): void {
  if (process.platform !== 'win32') throw new Error('Windows ACL 操作仅支持 Windows')
  if (typeof path !== 'string' || path.trim().length === 0) throw new Error(FAILURE_MESSAGE)

  let output: string
  try {
    output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_ACL_SCRIPT], {
      env: {
        ...process.env,
        PDSH_WINDOWS_OWNERSHIP_TARGET: resolve(path),
        PDSH_WINDOWS_OWNERSHIP_ACTION: action,
      },
      encoding: 'utf8',
      maxBuffer: 32 * 1024,
      timeout: 15_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    throw new Error(FAILURE_MESSAGE)
  }
  if (output.trim() !== 'PDSH_PRIVATE_OK') throw new Error(FAILURE_MESSAGE)
}

export function assertWindowsPrivateOwnership(path: string): void {
  runWindowsAclAction(path, 'assert')
}

export function protectWindowsOwnedDirectory(path: string): void {
  if (process.platform !== 'win32') throw new Error('Windows ACL 操作仅支持 Windows')
  try {
    const entry = lstatSync(path)
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(FAILURE_MESSAGE)
    if (readdirSync(path).length !== 0) throw new Error(FAILURE_MESSAGE)
    const tempRoot = realpathSync.native(tmpdir())
    const actual = realpathSync.native(path)
    const rel = relative(tempRoot, actual)
    if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new Error(FAILURE_MESSAGE)
    }
  } catch {
    throw new Error(FAILURE_MESSAGE)
  }
  runWindowsAclAction(path, 'protect')
}
