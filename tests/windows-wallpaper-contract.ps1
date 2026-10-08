# [INPUT]: 依赖本机 Windows 系统壁纸、已构建的 x64 helper、系统真实图像解码器。
# [OUTPUT]: 验证固定内置壁纸、ID 授权、WIC JPEG、输出边界与真实 helper 取消结算。
# [POS]: Windows 壁纸 helper 的真实系统资源回归入口；只在内存处理图像，不访问用户 profile。
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
[CmdletBinding()]
param(
  [string]$HelperPath = '',
  [string]$BaselineHelperPath = ''
)

$ErrorActionPreference = 'Stop'
$script:step = 'initialize'

$runnerSource = @'
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

public static class PdshWallpaperContractRunner
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetSystemWindowsDirectory(StringBuilder buffer, uint size);

    public sealed class Result
    {
        public int ExitCode;
        public byte[] Stdout;
        public byte[] Stderr;
        public bool TimedOut;
        public bool Oversized;
        public bool ObservedOutput;
        public bool Aborted;
        public bool Settled;
    }

    private sealed class ReadResult
    {
        public byte[] Bytes;
        public bool Oversized;
    }

    public static Result Run(string executable, string arguments, int timeoutMs, int stdoutLimit, int stderrLimit)
    {
        using (var process = new Process())
        {
            process.StartInfo = new ProcessStartInfo
            {
                FileName = executable,
                Arguments = arguments,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            try
            {
                if (!process.Start()) return new Result { ExitCode = -1, Stdout = new byte[0], Stderr = new byte[0] };
                process.StandardInput.Close();
                Task<ReadResult> stdout = Task.Run(() => ReadLimited(process.StandardOutput.BaseStream, stdoutLimit));
                Task<ReadResult> stderr = Task.Run(() => ReadLimited(process.StandardError.BaseStream, stderrLimit));
                if (!process.WaitForExit(timeoutMs))
                {
                    try { process.Kill(); } catch { }
                    process.WaitForExit(3000);
                    Task.WaitAll(new Task[] { stdout, stderr }, 3000);
                    return new Result { ExitCode = -1, Stdout = new byte[0], Stderr = new byte[0], TimedOut = true };
                }
                Task.WaitAll(new Task[] { stdout, stderr }, 3000);
                if (!stdout.IsCompleted || !stderr.IsCompleted)
                    return new Result { ExitCode = -1, Stdout = new byte[0], Stderr = new byte[0], TimedOut = true };
                ReadResult output = stdout.Result;
                ReadResult error = stderr.Result;
                return new Result
                {
                    ExitCode = process.ExitCode,
                    Stdout = output.Bytes,
                    Stderr = error.Bytes,
                    Oversized = output.Oversized || error.Oversized
                };
            }
            catch
            {
                try { if (!process.HasExited) process.Kill(); } catch { }
                return new Result { ExitCode = -1, Stdout = new byte[0], Stderr = new byte[0] };
            }
        }
    }

    public static Result AbortAfterOutput(string executable, string arguments, int threshold,
        int timeoutMs, int stdoutLimit, int stderrLimit)
    {
        using (var process = new Process())
        {
            process.StartInfo = new ProcessStartInfo
            {
                FileName = executable,
                Arguments = arguments,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            Task<ReadResult> stderr = null;
            Task<ReadResult> stdout = null;
            var releaseReader = new ManualResetEventSlim(false);
            try
            {
                if (!process.Start()) return new Result { ExitCode = -1, Stdout = new byte[0], Stderr = new byte[0] };
                process.StandardInput.Close();
                stderr = Task.Run(() => ReadLimited(process.StandardError.BaseStream, stderrLimit));
                var prefix = new TaskCompletionSource<int>();
                stdout = Task.Run(() => ReadForAbort(process.StandardOutput.BaseStream, threshold,
                    stdoutLimit, prefix, releaseReader));
                bool prefixReady = prefix.Task.Wait(timeoutMs);
                int outputPrefixBytes = prefixReady ? prefix.Task.Result : 0;
                bool observedOutput = outputPrefixBytes >= threshold;
                bool aborted = false;
                if (observedOutput)
                {
                    Thread.Sleep(10);
                    if (!process.HasExited)
                    {
                        try { process.Kill(); aborted = true; } catch { }
                    }
                }

                if (!process.HasExited && !aborted)
                {
                    try { process.Kill(); } catch { }
                }
                bool settled = process.WaitForExit(5000);
                if (!settled)
                {
                    try { process.Kill(); } catch { }
                    settled = process.WaitForExit(5000);
                }
                releaseReader.Set();
                if (stdout != null) Task.WaitAll(new Task[] { stdout, stderr }, 5000);
                else Task.WaitAll(new Task[] { stderr }, 5000);
                bool streamsSettled = stderr.IsCompleted && (stdout == null || stdout.IsCompleted);
                if (!settled || !streamsSettled)
                    return new Result { ExitCode = -1, Stdout = new byte[0], Stderr = new byte[0],
                        TimedOut = true, ObservedOutput = observedOutput, Aborted = aborted, Settled = settled };
                ReadResult output = stdout.Result;
                ReadResult error = stderr.Result;
                return new Result
                {
                    ExitCode = process.ExitCode,
                    Stdout = output.Bytes,
                    Stderr = error.Bytes,
                    Oversized = output.Oversized || error.Oversized,
                    ObservedOutput = observedOutput,
                    Aborted = aborted,
                    Settled = settled && process.HasExited
                };
            }
            catch
            {
                try { if (!process.HasExited) process.Kill(); } catch { }
                bool settled = false;
                try { settled = process.WaitForExit(5000); } catch { }
                releaseReader.Set();
                if (stderr != null) { try { stderr.Wait(5000); } catch { } }
                if (stdout != null) { try { stdout.Wait(5000); } catch { } }
                return new Result { ExitCode = -1, Stdout = new byte[0], Stderr = new byte[0],
                    TimedOut = !settled, Settled = settled && process.HasExited };
            }
            finally { releaseReader.Set(); releaseReader.Dispose(); }
        }
    }

    public static string WindowsDirectory()
    {
        var buffer = new StringBuilder(32768);
        uint length = GetSystemWindowsDirectory(buffer, (uint)buffer.Capacity);
        return length == 0 || length >= buffer.Capacity ? null : buffer.ToString();
    }

    private static ReadResult ReadLimited(Stream stream, int limit)
    {
        using (var memory = new MemoryStream())
        {
            byte[] buffer = new byte[8192];
            bool oversized = false;
            int count;
            while ((count = stream.Read(buffer, 0, buffer.Length)) != 0)
            {
                int remaining = limit + 1 - (int)memory.Length;
                if (remaining > 0) memory.Write(buffer, 0, Math.Min(count, remaining));
                if (memory.Length > limit || count > Math.Max(remaining, 0)) oversized = true;
            }
            return new ReadResult { Bytes = memory.ToArray(), Oversized = oversized };
        }
    }

    private static ReadResult ReadForAbort(Stream stream, int threshold, int limit,
        TaskCompletionSource<int> prefix, ManualResetEventSlim releaseReader)
    {
        using (var memory = new MemoryStream())
        {
            byte[] buffer = new byte[8192];
            bool oversized = false;
            try
            {
                while (memory.Length < threshold)
                {
                    int request = Math.Min(buffer.Length, threshold - (int)memory.Length);
                    int count = stream.Read(buffer, 0, request);
                    if (count == 0) break;
                    memory.Write(buffer, 0, count);
                }
                prefix.TrySetResult((int)memory.Length);
                releaseReader.Wait();
                int read;
                while ((read = stream.Read(buffer, 0, buffer.Length)) != 0)
                {
                    int remaining = limit + 1 - (int)memory.Length;
                    if (remaining > 0) memory.Write(buffer, 0, Math.Min(read, remaining));
                    if (memory.Length > limit || read > Math.Max(remaining, 0)) oversized = true;
                }
            }
            catch (Exception error)
            {
                prefix.TrySetException(error);
                throw;
            }
            return new ReadResult { Bytes = memory.ToArray(), Oversized = oversized };
        }
    }
}
'@

function Assert-Contract([bool]$Condition, [string]$FailureCode) {
  if (-not $Condition) { throw $FailureCode }
}

function Invoke-WallpaperHelper([string]$Arguments, [int]$OutputLimit = 8389632) {
  $result = [PdshWallpaperContractRunner]::Run($script:helper, $Arguments, 20000, $OutputLimit, 1024)
  Assert-Contract (-not $result.TimedOut) 'helper-timeout'
  Assert-Contract (-not $result.Oversized) 'helper-output-over-budget'
  return $result
}

function Get-SingleJsonLine([byte[]]$Bytes, [string]$FailureCode) {
  Assert-Contract ($Bytes.Length -ge 2 -and $Bytes[$Bytes.Length - 1] -eq 10) $FailureCode
  Assert-Contract ([Array]::IndexOf($Bytes, [byte]10) -eq ($Bytes.Length - 1)) $FailureCode
  Assert-Contract ($Bytes -notcontains [byte]13 -and $Bytes[0] -ne 0xEF) $FailureCode
  $encoding = [System.Text.UTF8Encoding]::new($false, $true)
  return $encoding.GetString($Bytes, 0, $Bytes.Length - 1) | ConvertFrom-Json
}

function Get-ClosedErrorStatus([byte[]]$Bytes) {
  $value = Get-SingleJsonLine $Bytes 'error-envelope-invalid'
  Assert-Contract ($value.PSObject.Properties.Name.Count -eq 1 -and $value.status -in @(
    'wallpaper-invalid-request', 'wallpaper-unavailable', 'wallpaper-read-failed',
    'wallpaper-decode-failed', 'wallpaper-jpeg-encode-failed', 'wallpaper-byte-budget-exceeded',
    'wallpaper-output-failed', 'wallpaper-helper-failed'
  )) 'error-code-invalid'
  return $value.status
}

function Assert-ClosedError([byte[]]$Bytes) {
  [void](Get-ClosedErrorStatus $Bytes)
}

function Test-JpegInMemory([byte[]]$Jpeg, [int]$ExpectedWidth, [int]$ExpectedHeight) {
  Assert-Contract ($Jpeg.Length -ge 4 -and $Jpeg.Length -le 8388608) 'jpeg-size-invalid'
  Assert-Contract ($Jpeg[0] -eq 0xFF -and $Jpeg[1] -eq 0xD8 -and
    $Jpeg[$Jpeg.Length - 2] -eq 0xFF -and $Jpeg[$Jpeg.Length - 1] -eq 0xD9) 'jpeg-envelope-invalid'
  $stream = [System.IO.MemoryStream]::new($Jpeg, $false)
  $image = $null
  try {
    $image = [System.Drawing.Image]::FromStream($stream, $true, $true)
    Assert-Contract ($image.RawFormat.Guid -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid) 'jpeg-decode-format-invalid'
    Assert-Contract ($image.Width -eq $ExpectedWidth -and $image.Height -eq $ExpectedHeight) 'jpeg-decode-dimensions-invalid'
    [void]$image.GetPixel([int]($ExpectedWidth / 2), [int]($ExpectedHeight / 2))
  } finally {
    if ($image) { $image.Dispose() }
    $stream.Dispose()
  }
}

function Get-ExpectedContentId([string]$Token) {
  Assert-Contract ($Token -in @('img0', 'img19')) 'source-token-invalid'
  $windowsDirectory = [PdshWallpaperContractRunner]::WindowsDirectory()
  Assert-Contract ($windowsDirectory -is [string] -and $windowsDirectory.Length -gt 0) 'system-root-unavailable'
  $sourcePath = Join-Path (Join-Path (Join-Path $windowsDirectory 'Web') 'Wallpaper\Windows') ($Token + '.jpg')
  $sourceBytes = [System.IO.File]::ReadAllBytes($sourcePath)
  Assert-Contract ($sourceBytes.Length -gt 0 -and $sourceBytes.Length -le 67108864) 'source-size-invalid'
  $hash = [System.Security.Cryptography.IncrementalHash]::CreateHash([System.Security.Cryptography.HashAlgorithmName]::SHA256)
  try {
    $domain = [System.Text.Encoding]::ASCII.GetBytes('PDSH/windows-system-wallpaper/v1' + [char]0)
    $tokenBytes = [System.Text.Encoding]::ASCII.GetBytes($Token)
    $separator = [byte[]]@(0)
    $hash.AppendData($domain)
    $hash.AppendData($tokenBytes)
    $hash.AppendData($separator)
    $hash.AppendData($sourceBytes)
    return 'system-wallpaper-image-' + [BitConverter]::ToString($hash.GetHashAndReset()).Replace('-', '').ToLowerInvariant()
  } finally {
    [Array]::Clear($sourceBytes, 0, $sourceBytes.Length)
    $hash.Dispose()
  }
}

try {
  $script:step = 'runner'
  Add-Type -TypeDefinition $runnerSource -Language CSharp | Out-Null
  $script:step = 'build'
  if (-not $HelperPath) {
    $build = Join-Path $PSScriptRoot '..\native\windows\build.ps1'
    & $build | Out-Null
    $HelperPath = Join-Path $PSScriptRoot '..\native\windows\window-capture-x64.exe'
  }
  $script:helper = (Resolve-Path -LiteralPath $HelperPath).Path
  $script:step = 'helper-path'
  Assert-Contract ((Get-Item -LiteralPath $script:helper).Length -gt 0) 'helper-missing'

  if ($BaselineHelperPath) {
    $script:step = 'baseline'
    $baseline = (Resolve-Path -LiteralPath $BaselineHelperPath).Path
    $old = [PdshWallpaperContractRunner]::Run($baseline, '--wallpaper-list', 10000, 4096, 1024)
    Assert-Contract (-not $old.TimedOut -and -not $old.Oversized) 'baseline-helper-timeout'
    Assert-Contract ($old.ExitCode -ne 0 -and $old.Stdout.Length -eq 0) 'baseline-wallpaper-command-unexpectedly-passed'
  }

  $script:step = 'decoder'
  Add-Type -AssemblyName System.Drawing
  $script:step = 'catalog'
  $listed = Invoke-WallpaperHelper '--wallpaper-list' 4096
  Assert-Contract ($listed.ExitCode -eq 0 -and $listed.Stderr.Length -eq 0) 'list-process-failed'
  $catalog = Get-SingleJsonLine $listed.Stdout 'catalog-envelope-invalid'
  Assert-Contract ($catalog.status -eq 'listed' -and $catalog.PSObject.Properties.Name.Count -eq 2) 'catalog-status-invalid'
  $entries = @($catalog.entries)
  Assert-Contract ($entries.Count -ge 1 -and $entries.Count -le 2) 'catalog-count-invalid'
  $separator = [char]0x00B7
  $expectedNames = @([string]::Concat('Windows ', $separator, ' img0'), [string]::Concat('Windows ', $separator, ' img19'))
  $seen = @{}
  foreach ($entry in $entries) {
    $script:step = 'load'
    Assert-Contract ($entry.PSObject.Properties.Name.Count -eq 4) 'catalog-entry-shape-invalid'
    Assert-Contract ($entry.id -match '^system-wallpaper-image-[a-f0-9]{64}$') 'catalog-id-invalid'
    Assert-Contract ($entry.name -in $expectedNames) 'catalog-name-invalid'
    Assert-Contract ($entry.available -eq $true -and $entry.downloadable -eq $false) 'catalog-availability-invalid'
    $token = $entry.name.Substring($entry.name.LastIndexOf(' ') + 1)
    Assert-Contract ($entry.id -eq (Get-ExpectedContentId $token)) 'catalog-content-id-invalid'
    Assert-Contract (-not $seen.ContainsKey($entry.id) -and -not $seen.ContainsKey($entry.name)) 'catalog-duplicate'
    $seen[$entry.id] = $true
    $seen[$entry.name] = $true
  }

  foreach ($entry in $entries) {
    $loaded = Invoke-WallpaperHelper ("--wallpaper " + $entry.id)
    Assert-Contract ($loaded.ExitCode -eq 0 -and $loaded.Stderr.Length -eq 0) 'load-process-failed'
    $newline = [Array]::IndexOf($loaded.Stdout, [byte]10)
    Assert-Contract ($newline -gt 0 -and $newline -le 1024) 'image-metadata-missing'
    $metadataBytes = New-Object byte[] $newline
    [Array]::Copy($loaded.Stdout, 0, $metadataBytes, 0, $newline)
    $metadata = Get-SingleJsonLine ([byte[]]($metadataBytes + [byte[]](10))) 'image-metadata-invalid'
    Assert-Contract ($metadata.status -eq 'loaded' -and $metadata.id -eq $entry.id -and
      $metadata.sourceType -eq 'image' -and $metadata.width -ge 1 -and $metadata.height -ge 1 -and
      $metadata.width -le 2600 -and $metadata.height -le 2600 -and
      $metadata.jpegBytes -gt 0 -and $metadata.jpegBytes -le 8388608) 'image-metadata-invalid'
    Assert-Contract ($metadata.PSObject.Properties.Name.Count -eq 6 -and
      [string]::Join(',', [string[]]@($metadata.PSObject.Properties.Name | Sort-Object)) -eq
      'height,id,jpegBytes,sourceType,status,width') 'image-metadata-shape-invalid'
    if (-not $script:jpegBytesById) { $script:jpegBytesById = @{} }
    $script:jpegBytesById[$entry.id] = [int]$metadata.jpegBytes
    $jpegLength = $loaded.Stdout.Length - $newline - 1
    Assert-Contract ($jpegLength -eq $metadata.jpegBytes) 'jpeg-byte-count-invalid'
    $jpeg = New-Object byte[] $jpegLength
    [Array]::Copy($loaded.Stdout, $newline + 1, $jpeg, 0, $jpegLength)
    Test-JpegInMemory $jpeg $metadata.width $metadata.height
    [Array]::Clear($jpeg, 0, $jpeg.Length)
    [Array]::Clear($loaded.Stdout, 0, $loaded.Stdout.Length)
    [Array]::Clear($loaded.Stderr, 0, $loaded.Stderr.Length)
    [Array]::Clear($metadataBytes, 0, $metadataBytes.Length)
  }

  $script:step = 'cancel-after-output'
  $cancelEntry = $entries | Sort-Object { [int]$script:jpegBytesById[$_.id] } -Descending | Select-Object -First 1
  Assert-Contract ($script:jpegBytesById[$cancelEntry.id] -gt 65536) 'cancel-source-too-small'
  $cancel = [PdshWallpaperContractRunner]::AbortAfterOutput($script:helper,
    ('--wallpaper ' + $cancelEntry.id), 512, 20000, 8389632, 1024)
  Assert-Contract ($cancel.ObservedOutput -and $cancel.Aborted) 'cancel-inflight-not-observed'
  Assert-Contract ($cancel.Settled -and -not $cancel.TimedOut) 'cancel-process-not-settled'
  Assert-Contract ($cancel.ExitCode -ne 0 -and -not $cancel.Oversized) 'cancel-result-accepted'
  Assert-Contract ($cancel.Stdout.Length -ge 512 -and $cancel.Stderr.Length -eq 0) 'cancel-stream-envelope-invalid'
  [Array]::Clear($cancel.Stdout, 0, $cancel.Stdout.Length)
  [Array]::Clear($cancel.Stderr, 0, $cancel.Stderr.Length)

  $unknownId = 'system-wallpaper-image-' + ('0' * 64)
  $script:step = 'unknown-id'
  $unknown = Invoke-WallpaperHelper ("--wallpaper " + $unknownId) 4096
  Assert-Contract ($unknown.ExitCode -ne 0 -and $unknown.Stdout.Length -eq 0) 'unknown-id-accepted'
  Assert-Contract ((Get-ClosedErrorStatus $unknown.Stderr) -eq 'wallpaper-unavailable') 'unknown-id-status-invalid'
  $extra = Invoke-WallpaperHelper ("--wallpaper " + $entries[0].id + ' extra') 4096
  Assert-Contract ($extra.ExitCode -ne 0 -and $extra.Stdout.Length -eq 0) 'extra-argument-accepted'
  Assert-Contract ((Get-ClosedErrorStatus $extra.Stderr) -eq 'wallpaper-invalid-request') 'extra-argument-status-invalid'

  [Array]::Clear($listed.Stdout, 0, $listed.Stdout.Length)
  [Array]::Clear($listed.Stderr, 0, $listed.Stderr.Length)
  [Console]::WriteLine('windows-wallpaper-contract=passed')
  exit 0
} catch {
  $failureCode = 'unexpected-' + $_.Exception.GetType().Name.ToLowerInvariant()
  if ($_.Exception.Message -match '^[a-z0-9-]{1,64}$') { $failureCode = $_.Exception.Message }
  [Console]::WriteLine('windows-wallpaper-contract=failed step=' + $script:step + ' code=' + $failureCode)
  exit 1
}
