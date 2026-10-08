# [INPUT]: 本地 VS/Windows SDK、自有 PMv2 合成窗口夹具与真实 Windows helper。
# [OUTPUT]: 重建 staging helper，验 viewport/PNG 对位、关闭拒绝和异常进程结算。
# [POS]: Windows 原生合同入口；可用固定 RC5 SHA 证明旧 helper 缺失 viewport。
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
param([string]$HelperPath = '', [string]$BaselineHelperPath = '')
$ErrorActionPreference = 'Stop'

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
if (-not $HelperPath) {
  $staging = Join-Path ([System.IO.Path]::GetTempPath()) ('pdsh-native-build-' + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $staging | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $staging '.pdsh-native-build-owner'), '{"task":"pdsh-native-build","format":1}')
  $stagedHelper = Join-Path $staging 'window-capture-x64.exe'
  & (Join-Path $PSScriptRoot '..\native\windows\build.ps1') -OutputPath $stagedHelper
  if ($LASTEXITCODE -ne 0) { throw 'Windows helper staging build failed.' }
  $HelperPath = $stagedHelper
}
$helper = (Resolve-Path -LiteralPath $HelperPath).Path
$baseline = ''
if ($BaselineHelperPath) {
  $baseline = (Resolve-Path -LiteralPath $BaselineHelperPath).Path
  $baselineHash = (Get-FileHash -LiteralPath $baseline -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($baselineHash -cne 'c1f348d2cb640fbbbbe8f36d3fb6444cd807a007ffe151582f37264471b65edb') {
    throw 'Baseline helper does not match the frozen RC5 SHA-256.'
  }
}
$fixture = Join-Path $workspace 'DeepSeek Harness.exe'
$cppwinrt = Join-Path $env:WindowsSdkDir ('Include\' + $env:WindowsSDKVersion + 'cppwinrt')
Push-Location $workspace
try {
  & cl.exe /nologo /std:c++17 /EHsc /utf-8 /MT /DUNICODE /D_UNICODE ("/I$cppwinrt") ("/Fe$fixture") `
    (Join-Path $PSScriptRoot 'windows-capture-fixture.cpp') /link user32.lib gdi32.lib dwmapi.lib windowscodecs.lib ole32.lib windowsapp.lib d3d11.lib dxgi.lib runtimeobject.lib
  if ($LASTEXITCODE -ne 0) { throw 'Windows fixture compilation failed.' }
  if ($baseline) {
    Write-Output 'native-case=baseline-viewport-required'
    $baselineOutput = @(& $fixture $baseline 2>&1 | ForEach-Object { $_.ToString() })
    $baselineExit = $LASTEXITCODE
    $baselineOutput | ForEach-Object { Write-Output $_ }
    if ($baselineExit -ne 19 -or $baselineOutput -notcontains 'capture-png-valid=true viewport-missing=true' -or
        $baselineOutput -notcontains 'fixture-job-active=0') {
      throw 'Frozen RC5 helper did not produce the expected valid-PNG/missing-viewport red result.'
    }
    Write-Output 'baseline-red=confirmed'
  }
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
