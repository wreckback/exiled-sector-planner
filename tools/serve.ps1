<#
  Serves the web planner on http://localhost:<Port>/ (no Node or Python needed).
    powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 8765]
  Ctrl+C to stop.
#>
param([int]$Port = 8765, [string]$Root = (Join-Path $PSScriptRoot '..\web'))

$Root = (Resolve-Path $Root).Path
$RepoRoot = Split-Path $Root -Parent
# version.js is answered with the planner's version from git (the latest vX.Y.Z tag, plus commits since and -dirty),
# so a local copy shows where it stands. The committed file says "dev" and is used when git can't answer.
function Get-VersionScript {
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $desc = & git -C $RepoRoot describe --tags --match 'v*' --dirty 2>$null; $code = $LASTEXITCODE }
    catch { $code = 1 }
    finally { $ErrorActionPreference = $old }
    if ($code -ne 0 -or -not $desc) { return $null }
    $desc = "$desc".Trim() -replace "'", ''
    return [Text.Encoding]::UTF8.GetBytes("window.PLANNER_VERSION = '$desc';`n")
}
$types = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
    '.json' = 'application/json'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.gif' = 'image/gif'; '.svg' = 'image/svg+xml'
    '.ico' = 'image/x-icon'; '.webp' = 'image/webp'
}
$listener = New-Object Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root at http://localhost:$Port/"
try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $res = $ctx.Response
        try {
            $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
            if ($path -eq '') { $path = 'index.html' }
            $file = [IO.Path]::GetFullPath((Join-Path $Root $path))
            $versionBytes = if ($path -eq 'version.js') { Get-VersionScript } else { $null }
            if ($versionBytes) {
                $res.ContentType = $types['.js']
                $res.Headers.Add('Cache-Control', 'no-cache')
                $res.ContentLength64 = $versionBytes.Length
                $res.OutputStream.Write($versionBytes, 0, $versionBytes.Length)
            } elseif ($file.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path $file -PathType Leaf)) {
                $bytes = [IO.File]::ReadAllBytes($file)
                $ext = [IO.Path]::GetExtension($file).ToLower()
                $res.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
                $res.Headers.Add('Cache-Control', 'no-cache')
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
            }
        } catch {
            # The browser dropped the connection (e.g. a reload mid-load). Skip this request and keep serving.
        } finally {
            try { $res.Close() } catch { }
        }
    }
} finally {
    $listener.Stop()
}
