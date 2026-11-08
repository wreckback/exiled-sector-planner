<#
  Tags a planner release or pre-release. The tag is the planner's own version, with the mod release the data was
  synced from (tools\mod-sync.json) as build metadata: v0.4.0-alpha.1+es0.11.1-alpha, v0.4.0+es0.11.1-alpha.

    powershell -ExecutionPolicy Bypass -File tools\release.ps1 -Version 0.4.0 -Pre alpha   # v0.4.0-alpha.1+es...
    powershell -ExecutionPolicy Bypass -File tools\release.ps1 -Pre alpha                  # next: v0.4.0-alpha.2+es...
    powershell -ExecutionPolicy Bypass -File tools\release.ps1 -Pre rc                     # move on: v0.4.0-rc.1+es...
    powershell -ExecutionPolicy Bypass -File tools\release.ps1                             # release it: v0.4.0+es...
    powershell -ExecutionPolicy Bypass -File tools\release.ps1 -Bump minor -Pre alpha      # from the last release: v0.5.0-alpha.1+es...
    -RC is short for -Pre rc. Add -Plain to leave out the +es part, -Push to push the tag, -DryRun to only show it.

  Pre-release stages, in order (semantic versioning sorts them this way): alpha (internal testing, features still
  changing), beta (feature-complete, wider testing), rc (release candidate, fixes only). Without -Version or -Bump,
  -Pre continues the newest open pre-release's version, and no -Pre releases it.

  Which number to raise: patch for a mod sync or fixes, minor for new features, major when old share links or saved
  builds stop loading.

  Refuses when the working tree has changes, the version isn't newer than the last release, the tag exists, or the
  data doesn't match the mod checkout. Tags that don't look like vX.Y.Z (such as the old 0.11.1-alpha) are ignored.
#>
param(
    [string]$Version,
    [ValidateSet('', 'major', 'minor', 'patch')][string]$Bump = '',
    [ValidateSet('', 'alpha', 'beta', 'rc')][string]$Pre = '',
    [switch]$RC,
    [switch]$Plain,
    [switch]$Push,
    [switch]$DryRun,
    [string]$ModRoot = (Join-Path $PSScriptRoot '..\ExiledSector')
)

$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$utf8 = New-Object Text.UTF8Encoding($false)

function Fail([string]$msg) { Write-Host "release: $msg" -ForegroundColor Red; exit 1 }
# git writes progress to stderr, which Windows PowerShell turns into errors under 'Stop'.
function Invoke-Git([string]$dir, [string[]]$gitArgs) {
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & git -C $dir @gitArgs 2>&1 | ForEach-Object { "$_" }; $code = $LASTEXITCODE }
    finally { $ErrorActionPreference = $old }
    if ($code) { throw "git $($gitArgs -join ' ') failed ($code): $($out -join ' ')" }
    return $out
}

# 1. A clean tree, so the tag holds exactly what was tested.
$dirty = @(Invoke-Git $Root @('status', '--porcelain'))
if ($dirty.Count -and $dirty[0]) { Fail ("commit or stash these first:`n  " + ($dirty -join "`n  ")) }
$branch = "$(Invoke-Git $Root @('rev-parse', '--abbrev-ref', 'HEAD'))"
if ($branch -ne 'main') { Write-Host "  note: on branch $branch, not main" -ForegroundColor Yellow }

# 2. The data matches the synced mod release.
$syncFile = Join-Path $PSScriptRoot 'mod-sync.json'
if (-not (Test-Path $syncFile)) { Fail 'tools\mod-sync.json is missing. Run tools\update.ps1 first.' }
$sync = [IO.File]::ReadAllText($syncFile, $utf8) | ConvertFrom-Json
if (-not $sync.release) { Fail 'tools\mod-sync.json has no release. Run tools\update.ps1 first.' }
if (Test-Path (Join-Path $ModRoot '.git')) {
    $modHead = "$(Invoke-Git $ModRoot @('rev-parse', 'HEAD'))"
    if ($sync.commit -and $modHead -ne $sync.commit) {
        Fail "ExiledSector is at $($modHead.Substring(0, 8)), but the data was synced from $($sync.release) ($($sync.commit.Substring(0, 8))). Run tools\update.ps1, or check out that release."
    }
}
$dataFile = Join-Path $Root 'web\data\planner-data.js'
$dataVersion = [regex]::Match([IO.File]::ReadAllText($dataFile, $utf8), '"modVersion":"([^"]*)"').Groups[1].Value
if ($sync.modVersion -and $dataVersion -ne $sync.modVersion) {
    Fail "planner-data.js is for mod $dataVersion, but mod-sync.json says $($sync.modVersion). Run tools\update.ps1."
}

# 3. Existing planner tags.
if ($RC) { if ($Pre -and $Pre -ne 'rc') { Fail "-RC and -Pre $Pre don't go together." }; $Pre = 'rc' }
$stageRank = @{ alpha = 1; beta = 2; rc = 3 } # a release ranks above all of them
$pattern = '^v(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?(?:\+.*)?$'
$tags = @(Invoke-Git $Root @('tag', '-l', 'v*') | Where-Object { $_ -match $pattern } | ForEach-Object {
    $m = [regex]::Match($_, $pattern)
    $stage = if ($m.Groups[4].Success) { $m.Groups[4].Value } else { $null }
    [pscustomobject]@{
        Name  = $_
        Key   = [version]("{0}.{1}.{2}" -f $m.Groups[1].Value, $m.Groups[2].Value, $m.Groups[3].Value)
        Stage = $stage
        Num   = if ($stage) { [int]$m.Groups[5].Value } else { 0 }
        Rank  = if ($stage) { $stageRank[$stage] } else { 4 }
    }
})
$byNewest = @($tags | Sort-Object -Property @{ Expression = 'Key'; Descending = $true }, @{ Expression = 'Rank'; Descending = $true }, @{ Expression = 'Num'; Descending = $true })
$lastRelease = $byNewest | Where-Object { $null -eq $_.Stage } | Select-Object -First 1
$latest = $byNewest | Select-Object -First 1

# 4. The version to tag.
if ($Version) {
    if ($Version -notmatch '^\d+\.\d+\.\d+$') { Fail "-Version must look like 1.2.3 (got '$Version')." }
    $base = [version]$Version
} elseif ($Bump) {
    $from = if ($lastRelease) { $lastRelease.Key } else { [version]'0.0.0' }
    $base = switch ($Bump) {
        'major' { [version]("{0}.0.0" -f ($from.Major + 1)) }
        'minor' { [version]("{0}.{1}.0" -f $from.Major, ($from.Minor + 1)) }
        'patch' { [version]("{0}.{1}.{2}" -f $from.Major, $from.Minor, ($from.Build + 1)) }
    }
} elseif ($latest -and $latest.Stage) {
    $base = $latest.Key # continue the open pre-release, or release it
} else {
    Fail 'Say which version: -Version X.Y.Z, or -Bump major|minor|patch.'
}
if ($lastRelease -and $base -le $lastRelease.Key) { Fail "v$base isn't newer than the last release, $($lastRelease.Name)." }
$baseText = "{0}.{1}.{2}" -f $base.Major, $base.Minor, $base.Build

$name = "v$baseText"
if ($Pre) {
    # Stages only move forward: an alpha after this version's rc would sort before it.
    $later = @($tags | Where-Object { $_.Key -eq $base -and $_.Stage -and $_.Rank -gt $stageRank[$Pre] })
    if ($later.Count) { Fail "v$baseText already has $($later[0].Name), and $Pre comes before $($later[0].Stage), so it would sort before it. Use -Pre $($later[0].Stage) or a later stage." }
    $nums = @($tags | Where-Object { $_.Key -eq $base -and $_.Stage -eq $Pre } | ForEach-Object { $_.Num })
    $next = if ($nums.Count) { ($nums | Measure-Object -Maximum).Maximum + 1 } else { 1 }
    $name += "-$Pre.$next"
}
if (-not $Plain) { $name += "+es$($sync.release)" }
& git check-ref-format "refs/tags/$name" | Out-Null
if ($LASTEXITCODE) { Fail "'$name' isn't a valid tag name." }
if (@($tags | Where-Object { $_.Name -eq $name }).Count) { Fail "$name already exists." }

# 5. The message: what it's for, and the commits since the previous planner tag.
$head = "$(Invoke-Git $Root @('rev-parse', '--short', 'HEAD'))"
$modShort = if ($sync.commit) { $sync.commit.Substring(0, 8) } else { 'unknown' }
$lines = @("Exiled Sector Planner $name", '', "For Exiled Sector $($sync.release) (mod version $($sync.modVersion), commit $modShort).")
# Since the previous planner tag, or with none yet, since the most recent tag of any kind.
$since = if ($latest) { $latest.Name } else {
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $t = & git -C $Root describe --tags --abbrev=0 HEAD 2>$null; $ErrorActionPreference = $old
    if ($LASTEXITCODE -eq 0 -and $t) { "$t" } else { $null }
}
$range = if ($since) { "$since..HEAD" } else { 'HEAD' }
$log = @(Invoke-Git $Root @('log', '--format=- %s', $range))
if ($log.Count -and $log[0]) {
    $lines += ''
    $lines += if ($since) { "Changes since ${since}:" } else { 'Changes:' }
    $lines += $log
}
$message = ($lines -join "`n") + "`n"

Write-Host "Tag:    $name"
Write-Host "Commit: $head ($branch)"
Write-Host ''
Write-Host $message
if ($DryRun) { Write-Host '(dry run: nothing tagged)' -ForegroundColor Yellow; exit 0 }

$msgFile = [IO.Path]::GetTempFileName()
try {
    [IO.File]::WriteAllText($msgFile, $message, $utf8)
    Invoke-Git $Root @('tag', '-a', $name, '-F', $msgFile) | Out-Null
} finally { Remove-Item $msgFile -ErrorAction SilentlyContinue }
Write-Host "Tagged $name." -ForegroundColor Green
if ($Push) {
    Invoke-Git $Root @('push', 'origin', "refs/tags/$name") | Out-Null
    Write-Host "Pushed $name to origin." -ForegroundColor Green
} else {
    Write-Host "Push it with: git push origin `"refs/tags/$name`""
}
