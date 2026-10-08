# [INPUT]: 依赖本地 VS/Windows SDK、合成窗口夹具和原生构建入口。
# [OUTPUT]: 重建助手并验真实 PNG、目标关闭拒绝、异常退出结算。指定 HelperPath 时验该产物。
# [POS]: Windows 原生合同入口；失败现场留在自有临时目录，不安装插件或访问 Desktop profile。
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
param([string]$HelperPath = '')
$ErrorActionPreference = 'Stop'

if (-not $HelperPath) {
  & (Join-Path $PSScriptRoot '..\native\windows\build.ps1')
  $HelperPath = Join-Path $PSScriptRoot '..\native\windows\window-capture-x64.exe'
}
$helper = (Resolve-Path -LiteralPath $HelperPath).Path
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path -LiteralPath $vswhere -PathType Leaf)) { throw 'Windows contract requires Visual Studio C++ build tools.' }
$vs = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vs) { throw 'Windows contract requires the x64 C++ toolchain.' }
$vcvars = Join-Path $vs 'VC\Auxiliary\Build\vcvars64.bat'
$compilerEnvironment = & $env:ComSpec /d /s /c "`"$vcvars`" >nul && set"
if ($LASTEXITCODE -ne 0) { throw 'Windows compiler initialization failed.' }
foreach ($line in $compilerEnvironment) {
  $separator = $line.IndexOf('=')
  if ($separator -gt 0) { Set-Item -Path ('Env:' + $line.Substring(0, $separator)) -Value $line.Substring($separator + 1) }
}

$workspace = Join-Path ([System.IO.Path]::GetTempPath()) ('pdsh-native-contract-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $workspace | Out-Null
[System.IO.File]::WriteAllText((Join-Path $workspace 'owner.json'), '{"task":"pdsh-native-contract"}')
$fixture = Join-Path $workspace 'DeepSeek Harness.exe'
$cppwinrt = Join-Path $env:WindowsSdkDir ('Include\' + $env:WindowsSDKVersion + 'cppwinrt')
Push-Location $workspace
try {
  & cl.exe /nologo /std:c++17 /EHsc /utf-8 /MT /DUNICODE /D_UNICODE ("/I$cppwinrt") ("/Fe$fixture") `
    (Join-Path $PSScriptRoot 'windows-capture-fixture.cpp') /link user32.lib gdi32.lib dwmapi.lib windowscodecs.lib ole32.lib windowsapp.lib d3d11.lib dxgi.lib runtimeobject.lib
  if ($LASTEXITCODE -ne 0) { throw 'Windows fixture compilation failed.' }
  $cases = @(
    @{ Name = 'capture'; Arguments = @() },
    @{ Name = 'closed-target'; Arguments = @('--closed-target') },
    @{ Name = 'abort-helper'; Arguments = @('--abort-helper') }
  )
  foreach ($case in $cases) {
    Write-Output ("native-case=" + $case.Name)
    $arguments = @($helper) + @($case.Arguments)
    & $fixture @arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
      throw "Windows native case '$($case.Name)' failed: exit=$exitCode. Fixture retained in its owned temporary directory."
    }
  }
} finally { Pop-Location }
