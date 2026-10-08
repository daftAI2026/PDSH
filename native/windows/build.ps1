# [INPUT]: Windows SDK、Visual Studio x64 工具链、capture/geometry/owner/wallpaper 原生源码。
# [OUTPUT]: 构建并嵌入 asInvoker manifest；显式 staging 输出须有固定 owner marker。
# [POS]: Windows x64 唯一构建入口；默认输出原位，显式输出只写自有临时 staging。
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
param([string]$OutputPath = '')
$ErrorActionPreference = 'Stop'

function Assert-NoReparseComponents([string]$Path) {
  $full = [System.IO.Path]::GetFullPath($Path)
  $root = [System.IO.Path]::GetPathRoot($full)
  $cursor = $root
  foreach ($component in $full.Substring($root.Length).Split([System.IO.Path]::DirectorySeparatorChar,
      [System.StringSplitOptions]::RemoveEmptyEntries)) {
    $cursor = Join-Path $cursor $component
    if (-not (Test-Path -LiteralPath $cursor)) { continue }
    $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Staged helper path contains a reparse point.'
    }
  }
}

function Import-VcEnvironment {
  $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  if (-not (Test-Path -LiteralPath $vswhere -PathType Leaf)) {
    throw 'Visual Studio Installer vswhere.exe is required to build the Windows helper.'
  }
  $vs = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if ($LASTEXITCODE -ne 0 -or -not $vs) { throw 'Visual Studio x64 C++ build tools were not found.' }
  $vcvars = Join-Path $vs 'VC\Auxiliary\Build\vcvars64.bat'
  if (-not (Test-Path -LiteralPath $vcvars -PathType Leaf)) { throw 'vcvars64.bat is missing.' }

  $output = & $env:ComSpec /d /s /c "`"$vcvars`" >nul && set"
  if ($LASTEXITCODE -ne 0) { throw 'vcvars64.bat failed to initialize the x64 compiler environment.' }
  foreach ($line in $output) {
    $separator = $line.IndexOf('=')
    if ($separator -le 0) { continue }
    $name = $line.Substring(0, $separator)
    $value = $line.Substring($separator + 1)
    Set-Item -Path "Env:$name" -Value $value
  }
}

Import-VcEnvironment
foreach ($tool in @('cl.exe', 'mt.exe')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is unavailable after VS environment setup." }
}

$sdkInclude = Join-Path $env:WindowsSdkDir 'Include'
if (-not (Test-Path -LiteralPath $sdkInclude -PathType Container)) { throw 'Windows SDK Include directory is missing.' }
$sdk = Get-ChildItem -LiteralPath $sdkInclude -Directory |
  Where-Object { try { [version]$_.Name -ge [version]'10.0.18362.0' } catch { $false } } |
  Sort-Object { [version]$_.Name } -Descending |
  Select-Object -First 1
if (-not $sdk) { throw 'Windows SDK 10.0.18362 or newer is required for CreateForWindow.' }
$cppwinrt = Join-Path $sdk.FullName 'cppwinrt'
if (-not (Test-Path -LiteralPath (Join-Path $cppwinrt 'winrt\base.h') -PathType Leaf)) {
  throw "C++/WinRT headers are missing from SDK $($sdk.Name). No extra package download is attempted."
}

$module = $PSScriptRoot
$stagedBuild = -not [string]::IsNullOrWhiteSpace($OutputPath)
if ($stagedBuild) {
  if ($OutputPath -notmatch '^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+\\)') {
    throw 'Staged helper output must be an absolute path.'
  }
  $output = [System.IO.Path]::GetFullPath($OutputPath)
  if ([System.IO.Path]::GetFileName($output) -cne 'window-capture-x64.exe') {
    throw 'Staged helper output must use the fixed helper filename.'
  }
  $stage = [System.IO.Path]::GetDirectoryName($output)
  $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\')
  $stageParent = [System.IO.Path]::GetDirectoryName($stage)
  $stageName = [System.IO.Path]::GetFileName($stage)
  if ([System.IO.Path]::GetFullPath($stageParent).TrimEnd('\') -ine $tempRoot -or
      $stageName -notmatch '^pdsh-native-build-[0-9a-f]{32}$') {
    throw 'Staged helper output must be in a fresh PDSH native build directory under the OS temp root.'
  }
  $stageItem = Get-Item -LiteralPath $stage -Force -ErrorAction Stop
  if (-not $stageItem.PSIsContainer -or ($stageItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Staged helper directory must be an ordinary owned directory.'
  }
  Assert-NoReparseComponents $stage
  $ownerMarker = Join-Path $stage '.pdsh-native-build-owner'
  Assert-NoReparseComponents $ownerMarker
  if (-not (Test-Path -LiteralPath $ownerMarker -PathType Leaf) -or
      [System.IO.File]::ReadAllText($ownerMarker) -cne '{"task":"pdsh-native-build","format":1}') {
    throw 'Staged helper directory lacks its exact ownership marker.'
  }
  if (Test-Path -LiteralPath $output) { throw 'Staged helper output already exists; refusing overwrite.' }
  $temp = Join-Path $stage ('.build-' + [Guid]::NewGuid().ToString('N'))
  if (Test-Path -LiteralPath $temp) { throw 'Unique staged build directory unexpectedly exists.' }
  New-Item -ItemType Directory -Path $temp | Out-Null
} else {
  $output = Join-Path $module 'window-capture-x64.exe'
  $temp = Join-Path $module '.build-x64'
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
  New-Item -ItemType Directory -Path $temp | Out-Null
}
try {
  Push-Location $temp
  $source = Join-Path $module 'window-capture.cpp'
  $clArgs = @(
    '/nologo', '/std:c++17', '/EHsc', '/W4', '/utf-8', '/MT', '/DUNICODE', '/D_UNICODE',
    '/D_WIN32_WINNT=0x0A00', '/DWINVER=0x0A00',
    "/I$cppwinrt", "/I$(Join-Path $sdk.FullName 'shared')",
    "/Fe$output", $source,
    (Join-Path $module 'window-owner.cpp'),
    (Join-Path $module 'window-geometry.cpp'),
    (Join-Path $module 'system-wallpaper.cpp'),
    '/link', '/SUBSYSTEM:CONSOLE', '/MACHINE:X64', 'windowsapp.lib', 'd3d11.lib', 'dxgi.lib',
    'windowscodecs.lib', 'bcrypt.lib', 'ole32.lib', 'runtimeobject.lib', 'dwmapi.lib', 'user32.lib', 'advapi32.lib'
  )
  & cl.exe @clArgs
  if ($LASTEXITCODE -ne 0) { throw "cl.exe failed with exit code $LASTEXITCODE." }

  $manifest = Join-Path $module 'window-capture.manifest'
  & mt.exe -nologo -manifest $manifest "-outputresource:$output;#1"
  if ($LASTEXITCODE -ne 0) { throw "mt.exe failed with exit code $LASTEXITCODE." }
} finally {
  Pop-Location
  if (-not $stagedBuild -and (Test-Path -LiteralPath $temp)) {
    Remove-Item -LiteralPath $temp -Recurse -Force
  }
}

if (-not (Test-Path -LiteralPath $output -PathType Leaf)) { throw 'Windows helper output was not produced.' }
Write-Output 'Built Windows x64 helper.'
