# [INPUT]: 依赖 capture/owner/wallpaper 源、manifest、Visual Studio x64 工具链与 Windows SDK 18362+。
# [OUTPUT]: 生成 x64 helper；链接 WGC、WIC、BCrypt 并嵌入 asInvoker manifest，不启动 helper。
# [POS]: Windows x64 的唯一构建入口；VS环境由vswhere+vcvars64自动发现，UTF-8编译并静态链接CRT，不下载额外NuGet。
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
$ErrorActionPreference = 'Stop'

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
$output = Join-Path $module 'window-capture-x64.exe'
$temp = Join-Path $module '.build-x64'
if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
New-Item -ItemType Directory -Path $temp | Out-Null
try {
  Push-Location $temp
  $source = Join-Path $module 'window-capture.cpp'
  $clArgs = @(
    '/nologo', '/std:c++17', '/EHsc', '/W4', '/utf-8', '/MT', '/DUNICODE', '/D_UNICODE',
    '/D_WIN32_WINNT=0x0A00', '/DWINVER=0x0A00',
    "/I$cppwinrt", "/I$(Join-Path $sdk.FullName 'shared')",
    "/Fe$output", $source,
    (Join-Path $module 'window-owner.cpp'),
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
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}

if (-not (Test-Path -LiteralPath $output -PathType Leaf)) { throw 'Windows helper output was not produced.' }
Write-Output "Built Windows x64 helper: $output"
