<#
  Builds the ready-to-use zip for a planner tag: the site and its data, with a README.txt, in one folder that runs from
  a double-clicked index.html.

    powershell -ExecutionPolicy Bypass -File tools\package.ps1                   # the planner tag on HEAD, if any
    powershell -ExecutionPolicy Bypass -File tools\package.ps1 -Tag v0.2.0+es0.11.1-alpha

  Writes dist\exiled-sector-planner-<tag>.zip (dist\ is git-ignored). The site and its data come from the tag itself
  (git archive), so any tag can be packaged whatever is checked out.

  The zip holds none of the mod's art: it belongs to Exiled Sector and the authors its CREDITS.md names. The page reads
  it from the mod folder each user chooses (the Mod art dialog), and draws placeholders without one.
#>
param(
    [string]$Tag
)

$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$Web = Join-Path $Root 'web'
$utf8 = New-Object Text.UTF8Encoding($false)

function Fail([string]$msg) { Write-Host "package: $msg" -ForegroundColor Red; exit 1 }
function Invoke-Git([string]$dir, [string[]]$gitArgs) {
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & git -C $dir @gitArgs 2>&1 | ForEach-Object { "$_" }; $code = $LASTEXITCODE }
    finally { $ErrorActionPreference = $old }
    if ($code) { throw "git $($gitArgs -join ' ') failed ($code): $($out -join ' ')" }
    return $out
}

$pattern = '^v(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?(?:\+es(.+))?$'
if (-not $Tag) {
    $Tag = @(Invoke-Git $Root @('tag', '--points-at', 'HEAD')) | Where-Object { $_ -match $pattern } | Select-Object -Last 1
    if (-not $Tag) { Fail 'HEAD has no planner tag. Pass -Tag, or tag HEAD with tools\release.ps1.' }
}
$m = [regex]::Match($Tag, $pattern)
if (-not $m.Success) { Fail "'$Tag' doesn't look like a planner tag (vX.Y.Z[-alpha.N|-beta.N|-rc.N][+es<mod release>])." }
$null = Invoke-Git $Root @('rev-parse', '--verify', "refs/tags/$Tag")

# The tag's mod release: from the tag name, else from the tag's own mod-sync.json.
$tagSync = (Invoke-Git $Root @('show', "${Tag}:tools/mod-sync.json")) -join "`n" | ConvertFrom-Json
$modRelease = if ($m.Groups[6].Success) { $m.Groups[6].Value } else { $tagSync.release }
$preStage = if ($m.Groups[4].Success) { $m.Groups[4].Value } else { $null }

# Stage the folder: site files from the tag.
$name = "exiled-sector-planner-$Tag"
$stage = Join-Path ([IO.Path]::GetTempPath()) ("esp-package-" + [guid]::NewGuid().ToString('N'))
$dir = Join-Path $stage $name
New-Item -ItemType Directory -Force $dir | Out-Null
$archive = Join-Path $stage 'site.zip'
$null = Invoke-Git $Root @('archive', '--format=zip', '-o', $archive, "refs/tags/$Tag", 'web/index.html', 'web/style.css', 'web/app.js', 'web/data/planner-data.js')
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory($archive, (Join-Path $stage 'site'))
Get-ChildItem (Join-Path $stage 'site\web') | Move-Item -Destination $dir
Remove-Item $archive, (Join-Path $stage 'site') -Recurse -Force
$title = "Exiled Sector Skill Tree Planner $Tag"
$readme = @(
    $title
    ('=' * $title.Length)
    ''
    'A planner for the ship skill tree of the Exiled Sector Starsector mod,'
    "matching mod release $modRelease."
)
$stageText = @{ alpha = 'an alpha build, for internal testing. Features may still change.'; beta = 'a beta build, for testing before the release.'; rc = 'a release candidate: expected to become the release unless testing finds problems.' }
if ($preStage) { $readme += @('', "This is $($stageText[$preStage])") }
$readme += @(
    ''
    'How to use'
    '----------'
    'Unzip this folder anywhere, then double-click index.html. It runs in your'
    'browser with no install and no internet connection needed. Chrome or Edge is'
    'recommended (Firefox may not remember your build between visits).'
    ''
    'Press ? in the planner for every control.'
    ''
    'Mod art'
    '-------'
    'The planner doesn''t include Exiled Sector''s art. Click "Show mod art" in'
    'the top bar and choose the mod''s folder (usually mods\ExiledSector in your'
    'Starsector folder) to see the mod''s icons, nebulae and planets. Without'
    'it, the tree draws placeholders. The planner only reads the images; nothing'
    'is uploaded or changed. Chrome and Edge remember the folder.'
    ''
    'Templates'
    '---------'
    'The Templates button imports and exports the game''s skill tree templates'
    '(saves/common/exiledSector_skillTreeTemplates.json.data in your Starsector'
    'folder). Template codes (ES1....) can be pasted to share a build in chat.'
    ''
    'Credits'
    '-------'
    'Exiled Sector is by Portals. Its art belongs to the mod and to the authors'
    'of the other mods and games its art comes from; the CREDITS.md in the mod'
    'folder lists who made what and under which terms. This planner contains'
    'none of that art: it only shows the images from your own installed copy of'
    'the mod. Its tree data (node layout, names and effect wording) is'
    'extracted from the mod''s data files. Starsector is by Fractal Softworks.'
    'The planner is a free, non-commercial fan tool for Exiled Sector players.'
)
[IO.File]::WriteAllText((Join-Path $dir 'README.txt'), (($readme -join "`r`n") + "`r`n"), $utf8)

# Zip it, with forward slashes in entry names so every unzip tool reads the folders.
$dist = Join-Path $Root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$zipPath = Join-Path $dist "$name.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }
$zip = [IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
    foreach ($file in Get-ChildItem $stage -Recurse -File) {
        $entry = $file.FullName.Substring($stage.Length + 1).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entry, 'Optimal') | Out-Null
    }
} finally { $zip.Dispose() }
Remove-Item $stage -Recurse -Force

$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "Wrote dist\$name.zip ($size MB)." -ForegroundColor Green
