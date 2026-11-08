<#
  Brings the planner up to date with a mod release, then reports anything that needs a person to look at.

    powershell -ExecutionPolicy Bypass -File tools\update.ps1                 # newest release tag
    powershell -ExecutionPolicy Bypass -File tools\update.ps1 -Tag 0.11.1-alpha
    powershell -ExecutionPolicy Bypass -File tools\update.ps1 -NoCheckout     # use the mod checkout as it is
    powershell -ExecutionPolicy Bypass -File tools\update.ps1 -Commit         # also commit the result to the planner repo

  Steps:
    1. Fetch the mod's tags and check out the release (detached HEAD). Refuses if the mod checkout has local changes.
    2. Run extract.ps1.
    3. Check the new data: unfilled wording placeholders, effects without wording, missing art, unknown node types
       and tiers, broken links, template format versions and the node cap.
    4. Compare the tree with the previous data: nodes, skill types, renames and wording.
    5. List the mod's rule files that changed since the last synced release. Only these mean app.js may need work.
    6. Record the synced release in tools\mod-sync.json.
#>
param(
    [string]$Tag,
    [switch]$NoCheckout,
    [switch]$NoFetch,
    [switch]$Commit,
    [string]$ModRoot = (Join-Path $PSScriptRoot '..\ExiledSector')
)

$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ModRoot = (Resolve-Path $ModRoot).Path
$Web = Join-Path $Root 'web'
$DataFile = Join-Path $Web 'data\planner-data.js'
$StateFile = Join-Path $PSScriptRoot 'mod-sync.json'
$utf8 = New-Object Text.UTF8Encoding($false)

# Template format versions the planner reads and writes (app.js: buildTemplate, mergeTemplate, templateToCode).
$PlannerTemplateVersion = 1
$PlannerFileVersion = 1

$attention = New-Object System.Collections.Generic.List[string]
function Flag([string]$msg) { $attention.Add($msg); Write-Host "  ! $msg" -ForegroundColor Yellow }
function Ok([string]$msg) { Write-Host "  ok $msg" -ForegroundColor DarkGreen }
function Section([string]$title) { Write-Host ''; Write-Host "== $title" -ForegroundColor Cyan }

# git writes progress to stderr, which Windows PowerShell turns into errors under 'Stop'.
function Invoke-Git([string]$dir, [string[]]$gitArgs) {
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & git -C $dir @gitArgs 2>&1 | ForEach-Object { "$_" }; $code = $LASTEXITCODE }
    finally { $ErrorActionPreference = $old }
    if ($code) { throw "git $($gitArgs -join ' ') failed ($code): $($out -join ' ')" }
    return $out
}
function Read-PlannerData([string]$path) {
    if (-not (Test-Path $path)) { return $null }
    $raw = [IO.File]::ReadAllText($path, $utf8).Trim()
    $raw.Substring($raw.IndexOf('=') + 1).TrimEnd(';') | ConvertFrom-Json
}
function Get-JavaText([string]$name) {
    $f = Get-ChildItem -Path $ModRoot -Recurse -Filter "$name.java" | Where-Object { $_.FullName -match '\\src\\main\\java\\' } | Select-Object -First 1
    if ($f) { [IO.File]::ReadAllText($f.FullName, $utf8) } else { $null }
}
function Get-Images($d) {
    $set = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($t in $d.types) { if ($t.icon) { [void]$set.Add($t.icon) } }
    foreach ($n in $d.nodes) { if ($n.ringBeltPath) { [void]$set.Add($n.ringBeltPath) } }
    foreach ($x in $d.decorations) { foreach ($k in 'imagePath', 'ringArtPath', 'overlayPath') { if ($x.$k) { [void]$set.Add($x.$k) } } }
    return $set
}
function Join-Short($items, [int]$max = 12) {
    $a = @($items)
    if ($a.Count -le $max) { return ($a -join ', ') }
    return (($a[0..($max - 1)] -join ', ') + ", ... (+$($a.Count - $max) more)")
}

$state = if (Test-Path $StateFile) { [IO.File]::ReadAllText($StateFile, $utf8) | ConvertFrom-Json } else { $null }

# ---------------------------------------------------------------- 1. mod release
Section 'Mod release'
$before = @(Invoke-Git $ModRoot @('rev-parse', 'HEAD'))[0]
if ($NoCheckout) {
    Write-Host "  Using the checkout as it is ($(@(Invoke-Git $ModRoot @('describe', '--tags', '--always'))[0]))."
} else {
    $dirty = @(Invoke-Git $ModRoot @('status', '--porcelain', '--untracked-files=no'))
    if ($dirty.Count) {
        Write-Host "  The mod checkout has local changes, so it was left alone:" -ForegroundColor Red
        $dirty | ForEach-Object { Write-Host "    $_" }
        Write-Host '  Commit or stash them in ExiledSector\, or rerun with -NoCheckout.'
        exit 1
    }
    if (-not $NoFetch) {
        Write-Host '  Fetching tags...'
        Invoke-Git $ModRoot @('fetch', '--quiet', '--tags', 'origin') | Out-Null
    }
    if (-not $Tag) {
        $Tag = @(Invoke-Git $ModRoot @('tag', '--sort=-creatordate'))[0]
        if (-not $Tag) { throw 'The mod has no tags. Pass -Tag or use -NoCheckout.' }
    }
    Invoke-Git $ModRoot @('checkout', '--quiet', '--detach', "refs/tags/$Tag") | Out-Null
    Write-Host "  Checked out $Tag (detached HEAD; 'git switch main' in ExiledSector\ goes back)."
}
$after = @(Invoke-Git $ModRoot @('rev-parse', 'HEAD'))[0]
$release = @(Invoke-Git $ModRoot @('describe', '--tags', '--always'))[0]
$baseline = if ($state -and $state.commit) { $state.commit } else { $before }
$baselineName = if ($state -and $state.release) { $state.release } else { "previous checkout ($($before.Substring(0, 8)))" }

# ---------------------------------------------------------------- 2. extract
Section 'Extract'
$old = Read-PlannerData $DataFile
& (Join-Path $PSScriptRoot 'extract.ps1') -ModRoot $ModRoot -WebRoot $Web
$new = Read-PlannerData $DataFile

# ---------------------------------------------------------------- 3. checks
Section 'Checks'
$S = @{}; foreach ($p in $new.strings.PSObject.Properties) { $S[$p.Name] = $p.Value }
$appJs = [IO.File]::ReadAllText((Join-Path $Web 'app.js'), $utf8)

# Wording placeholders the planner can't fill show as "?" in tooltips (describeRaw / fill in app.js).
$variants = '', '.one', '.other', '.more', '.less', '.increases', '.reduces', '.hullSize'
$unfilled = @(); $noWording = @()
foreach ($e in $new.effects.PSObject.Properties) {
    $name = $e.Name; $info = $e.Value
    $known = @('value') + @(if ($info.args) { $info.args.PSObject.Properties.Name })
    $hullKnown = @(if ($info.hullArgs) { ($info.hullArgs.PSObject.Properties | Select-Object -First 1).Value.PSObject.Properties.Name })
    $hasText = $false
    foreach ($v in $variants) {
        $tpl = $S["effect.$name$v"]
        if ($null -eq $tpl) { continue }
        $hasText = $true
        $ok = if ($v -eq '.hullSize') { $known + $hullKnown } else { $known }
        $bad = @([regex]::Matches($tpl, '\{(\w+)\}') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -notin $ok } | Select-Object -Unique)
        if ($bad.Count) { $unfilled += "$name$v {$($bad -join '}, {')}" }
    }
    if (-not $hasText -and -not $info.stat -and -not $info.weaponFamily -and $name -notmatch '_AFFINITY_FLAT$') { $noWording += $name }
}
if ($unfilled.Count) { Flag "$($unfilled.Count) effect texts have placeholders the extractor couldn't fill (shown as '?'): $(Join-Short $unfilled 6). Extend Get-DescriptionArgs in extract.ps1." }
else { Ok 'every wording placeholder is filled' }
$prevNoWording = if ($state -and $null -ne $state.noWording) { @($state.noWording) } else { $null }
$newNoWording = if ($null -ne $prevNoWording) { @($noWording | Where-Object { $_ -notin $prevNoWording }) } else { @() }
if ($newNoWording.Count) { Flag "newly without wording (shown by name): $(Join-Short $newNoWording)" }
else { Ok "effects without wording: $($noWording.Count)$(if ($null -ne $prevNoWording) { ', none new' })" }

# Art: anything referenced but not in the mod is vanilla art the mod doesn't ship. Only new ones are worth a look.
$absent = @(Get-Images $new | Where-Object { -not (Test-Path (Join-Path $ModRoot ($_ -replace '/', '\'))) } | Sort-Object)
$prevAbsent = if ($state -and $null -ne $state.absentImages) { @($state.absentImages) } else { $null }
$newAbsent = if ($null -ne $prevAbsent) { @($absent | Where-Object { $_ -notin $prevAbsent }) } else { @() }
if ($newAbsent.Count) { Flag "newly missing images (drawn as placeholders): $(Join-Short $newAbsent)" }
else { Ok "images: $($absent.Count) not shipped by the mod (vanilla art)$(if ($null -ne $prevAbsent) { ', none new' })" }

# Node types and tiers.
$typeIds = @{}; foreach ($t in $new.types) { $typeIds[$t.id] = $t }
$tierBlock = [regex]::Match($appJs, 'const TIER_SIZE\s*=\s*\{([^}]*)\}').Groups[1].Value
$plannerTiers = @([regex]::Matches($tierBlock, '([A-Z_]+)\s*:') | ForEach-Object { $_.Groups[1].Value })
$badType = @($new.nodes | Where-Object { -not $typeIds.ContainsKey($_.type) } | ForEach-Object { "$($_.id) ($($_.type))" })
if ($badType.Count) { Flag "nodes with an unknown skill type: $(Join-Short $badType)" } else { Ok "every node's skill type exists" }
$badTier = @($new.types | Where-Object { $_.tier -notin $plannerTiers } | ForEach-Object { "$($_.id) ($($_.tier))" })
if ($badTier.Count) { Flag "skill types with a tier app.js doesn't know (TIER_SIZE, TIER_LABEL): $(Join-Short $badTier)" } else { Ok 'every tier is known to app.js' }
$skillTier = Get-JavaText 'SkillTier'
if ($skillTier) {
    $enumBody = [regex]::Match($skillTier, 'enum\s+SkillTier\s*\{(.*?);', 'Singleline').Groups[1].Value
    $modTiers = @([regex]::Matches($enumBody, '(?m)^\s*([A-Z][A-Z0-9_]*)\b') | ForEach-Object { $_.Groups[1].Value })
    $extra = @($modTiers | Where-Object { $_ -notin $plannerTiers })
    if ($extra.Count) { Flag "SkillTier has tiers app.js doesn't size: $($extra -join ', ')" }
}

# Links: targets must exist; wormhole pairs must point at each other.
$nodeIds = @{}; foreach ($n in $new.nodes) { $nodeIds[$n.id] = $n }
$dangling = @(); $badPair = @(); $oneWay = @()
foreach ($n in $new.nodes) {
    foreach ($c in @($n.c)) {
        if (-not $c) { continue }
        if (-not $nodeIds.ContainsKey($c)) { $dangling += "$($n.id)->$c" }
        elseif (@($nodeIds[$c].c) -notcontains $n.id) { $oneWay += "$($n.id)->$c" }
    }
    if ($n.pairedWith) {
        $p = $nodeIds[$n.pairedWith]
        if (-not $p -or $p.pairedWith -ne $n.id) { $badPair += "$($n.id)->$($n.pairedWith)" }
    }
}
foreach ($h in @($new.hiddenConnectors)) {
    foreach ($k in 'a', 'b') { if ($h.$k -and -not $nodeIds.ContainsKey($h.$k)) { $dangling += "hidden $($h.$k)" } }
}
if ($dangling.Count) { Flag "links to nodes that don't exist: $(Join-Short $dangling)" } else { Ok 'every link points at a real node' }
# The mod lists every link from both ends; app.js makes links symmetric anyway, so a one-way link hints at a format change.
if ($oneWay.Count) { Flag "links listed from one end only: $(Join-Short $oneWay)" } else { Ok 'every link is listed from both ends' }
if ($badPair.Count) { Flag "wormhole pairs that don't point back: $(Join-Short $badPair)" } else { Ok 'wormhole pairs are mutual' }
$badExit = @($new.wormholeAnchors | Where-Object { -not $nodeIds.ContainsKey($_.exit) } | ForEach-Object { "$($_.id)->$($_.exit)" })
if ($badExit.Count) { Flag "wormhole anchors whose exit node doesn't exist: $(Join-Short $badExit)" }

# Effects that refuse some ships: app.js words each one in EFFECT_BLOCKS (node rules). A new one needs a line there.
$blockBlock = [regex]::Match($appJs, 'const EFFECT_BLOCKS\s*=\s*\{(.*?)\n  \};', 'Singleline').Groups[1].Value
$knownBlocks = @([regex]::Matches($blockBlock, '(?m)^\s{4}([A-Z][A-Z0-9_]+)\s*:') | ForEach-Object { $_.Groups[1].Value })
$newBlocks = @($new.effects.PSObject.Properties | Where-Object { $_.Value.blocks -and $_.Name -notin $knownBlocks } | ForEach-Object { $_.Name })
if (-not $knownBlocks.Count) { Flag "couldn't read EFFECT_BLOCKS from app.js" }
elseif ($newBlocks.Count) { Flag "effects that refuse some ships but app.js doesn't check (add them to EFFECT_BLOCKS): $($newBlocks -join ', ')" }
else { Ok "every effect that refuses some ships is checked ($($knownBlocks.Count) known)" }

# In-game hull mod names come from a mod test resource; without it, other mods' hull mods show by id.
if (-not (Test-Path (Join-Path $ModRoot 'exiledsector-core\src\test\resources\i18n\hullmod_names.csv'))) {
    Flag "hullmod_names.csv is gone from exiledsector-core/src/test/resources/i18n; find where it moved and update extract.ps1"
} else { Ok 'in-game hull mod names found' }

# Template format and node cap, which app.js hard-codes.
$codec = Get-JavaText 'TemplateCodec'; $store = Get-JavaText 'SkillTreeTemplateStore'; $levels = Get-JavaText 'ShipLevelConfig'
$tv = if ($codec) { [regex]::Match($codec, '\bVERSION\s*=\s*(\d+)') } else { $null }
$fv = if ($store) { [regex]::Match($store, '\bFILE_VERSION\s*=\s*(\d+)') } else { $null }
if (-not $tv -or -not $tv.Success -or -not $fv -or -not $fv.Success) { Flag "couldn't find TemplateCodec.VERSION or SkillTreeTemplateStore.FILE_VERSION; the classes may have moved" }
elseif ([int]$tv.Groups[1].Value -ne $PlannerTemplateVersion -or [int]$fv.Groups[1].Value -ne $PlannerFileVersion) {
    Flag "template format changed: template v$($tv.Groups[1].Value), file v$($fv.Groups[1].Value); the planner writes v$PlannerTemplateVersion / v$PlannerFileVersion. Update app.js and the versions at the top of update.ps1."
} else { Ok "template format v$PlannerTemplateVersion, file v$PlannerFileVersion" }
$capMod = if ($levels) { [regex]::Match($levels, 'DEFAULT_MAX_ALLOCATED_NODES\s*=\s*(\d+)') } else { $null }
$capApp = [regex]::Match($appJs, '\bcap:\s*(\d+)')
if (-not $capMod -or -not $capMod.Success) { Flag "couldn't find ShipLevelConfig.DEFAULT_MAX_ALLOCATED_NODES" }
elseif ($capMod.Groups[1].Value -ne $capApp.Groups[1].Value) { Flag "default node cap is now $($capMod.Groups[1].Value); app.js starts at $($capApp.Groups[1].Value) (state.cap)" }
else { Ok "default node cap $($capApp.Groups[1].Value)" }

# ---------------------------------------------------------------- 4. tree changes
Section 'Tree changes'
$summary = New-Object System.Collections.Generic.List[string]
if (-not $old) { Write-Host '  No previous data to compare with.' }
else {
    $oldNodes = @{}; foreach ($n in $old.nodes) { $oldNodes[$n.id] = $n }
    $oldTypes = @{}; foreach ($t in $old.types) { $oldTypes[$t.id] = $t }
    $addedN = @($nodeIds.Keys | Where-Object { -not $oldNodes.ContainsKey($_) } | Sort-Object)
    $removedN = @($oldNodes.Keys | Where-Object { -not $nodeIds.ContainsKey($_) } | Sort-Object)
    $retyped = @(); $moved = 0; $relinked = 0
    foreach ($id in $nodeIds.Keys) {
        $o = $oldNodes[$id]; if (-not $o) { continue }
        $n = $nodeIds[$id]
        if ($o.type -ne $n.type) { $retyped += "$id ($($o.type) -> $($n.type))" }
        if ($o.x -ne $n.x -or $o.y -ne $n.y) { $moved++ }
        $oldLinks = (@($o.c) | Sort-Object) -join ','
        $newLinks = (@($n.c) | Sort-Object) -join ','
        if ($oldLinks -ne $newLinks) { $relinked++ }
    }
    $addedT = @($typeIds.Keys | Where-Object { -not $oldTypes.ContainsKey($_) } | Sort-Object)
    $removedT = @($oldTypes.Keys | Where-Object { -not $typeIds.ContainsKey($_) } | Sort-Object)
    $changedT = @()
    foreach ($id in ($typeIds.Keys | Sort-Object)) {
        $o = $oldTypes[$id]; if (-not $o) { continue }
        $n = $typeIds[$id]
        $what = @()
        if ($o.name -ne $n.name) { $what += "renamed '$($o.name)' -> '$($n.name)'" }
        if ($o.tier -ne $n.tier) { $what += "tier $($o.tier) -> $($n.tier)" }
        foreach ($k in 'effects', 'hullSizeEffects', 'options', 'effectText', 'phantomHullMods', 'requiredHullSizes') {
            if (($o.$k | ConvertTo-Json -Depth 8 -Compress) -ne ($n.$k | ConvertTo-Json -Depth 8 -Compress)) { $what += $k }
        }
        if ($what.Count) { $changedT += "$id ($($what -join ', '))" }
    }
    $renamesNew = @($new.nodeRenames.PSObject.Properties | Where-Object { $null -eq $old.nodeRenames.($_.Name) } | ForEach-Object { "$($_.Name) -> $($_.Value)" })
    $wording = @($new.strings.PSObject.Properties | Where-Object { $old.strings.($_.Name) -ne $_.Value }).Count

    if ($old.modVersion -ne $new.modVersion) { Write-Host "  Mod version: $($old.modVersion) -> $($new.modVersion)" }
    if ($addedN.Count) { Write-Host "  Nodes added ($($addedN.Count)): $(Join-Short $addedN)"; $summary.Add("$($addedN.Count) nodes added") }
    if ($removedN.Count) { Write-Host "  Nodes removed ($($removedN.Count)): $(Join-Short $removedN)"; $summary.Add("$($removedN.Count) removed") }
    if ($renamesNew.Count) { Write-Host "  New node renames ($($renamesNew.Count)): $(Join-Short $renamesNew)"; $summary.Add("$($renamesNew.Count) renamed") }
    if ($retyped.Count) { Write-Host "  Nodes with a new skill type ($($retyped.Count)): $(Join-Short $retyped 8)"; $summary.Add("$($retyped.Count) retyped") }
    if ($moved) { Write-Host "  Nodes moved: $moved"; $summary.Add("$moved moved") }
    if ($relinked) { Write-Host "  Nodes with changed links: $relinked" }
    if ($addedT.Count) { Write-Host "  Skill types added ($($addedT.Count)): $(Join-Short $addedT)"; $summary.Add("$($addedT.Count) skill types added") }
    if ($removedT.Count) { Write-Host "  Skill types removed ($($removedT.Count)): $(Join-Short $removedT)" }
    if ($changedT.Count) {
        Write-Host "  Skill types changed ($($changedT.Count)):"
        $changedT | Select-Object -First 25 | ForEach-Object { Write-Host "    $_" }
        if ($changedT.Count -gt 25) { Write-Host "    ... (+$($changedT.Count - 25) more)" }
        $summary.Add("$($changedT.Count) skill types changed")
    }
    if ($wording) { Write-Host "  Wording strings changed or added: $wording" }
    if (-not $summary.Count -and -not $wording) { Write-Host '  No changes to the tree.' }
    if ($removedN.Count -and -not $renamesNew.Count) {
        Flag "nodes were removed without a rename entry; saved builds and templates that use them will drop those nodes"
    }
}

# ---------------------------------------------------------------- 5. rule files
Section "Mod code changed since $baselineName"
# Files whose logic app.js or extract.ps1 reimplements. A change here is the only reason to open planner code.
$rulePattern = '/src/main/java/.*/(AllocationCheck|TemplateCapture|TemplateCodec|TemplateNames|TemplateFilter|SkillTreeTemplateStore|' +
               'AffinitySteps|AffinityOptions|AffinityScaling|SkillTier|NodeReplacements|ShipLevelConfig|SkillTreeNodeConnectorRenderer|' +
               'WormholeAnchorLinks|WormholeAnchorDefinitions|ScopedWeaponEffect|WeaponStatFamily|HullSizeTable|StatMode|' +
               'NodeEligibility|AllocatedNode|SkillType|HullModConflicts|LogisticsNodes|NodeRequirements|LowBaseArmorBonus|' +
               'SkillTypeUnlockStatus|NodeGates|ShieldSkillEffect|' +
               'Subroutine|SubroutineKind|SubroutineDefinitions|SubroutineRadius|SubroutineSocketLimits|NodeRadii|NodeRadiusCache|ExoshipNodes|' +
               'RootConduits|EmptyShells|GatedSubroutines|SkillTreeEffectSource|ModspecCaches|NodeAllocator|DoctrineOverrides|DoctrineArchive|StatTarget)\.java$'
$wordingPattern = '/src/main/java/.*SkillEffect\.java$'
$inputPattern = '^(data/skilltrees/|data/strings/exiledSector/(core|skillTree)/|data/config/exiledSector/(wormhole_anchors|node_replacements|node_id_renames|type_id_renames|hullmod_conflicts)\.csv|data/config/exiledSector/node_gates\.json|data/config/exiledSector/(subroutines|doctrine_archives|item_modifiers)\.csv|data/config/exiledSector/node_radii\.json|data/hullmods/hull_mods\.csv|exiledsector-core/src/test/resources/i18n/hullmod_names\.csv|docs/analysis/balance\.csv|mod_info\.json)'
$changedRules = @()
if ($baseline -eq $after) { Write-Host '  None: the mod is at the same commit as last time.' }
else {
    $known = $true
    try { Invoke-Git $ModRoot @('cat-file', '-e', "$baseline^{commit}") | Out-Null } catch { $known = $false }
    if (-not $known) { Flag "the last synced commit $baseline isn't in the mod checkout; can't list changed files" }
    else {
        $files = @(Invoke-Git $ModRoot @('diff', '--name-only', $baseline, $after))
        $commits = @(Invoke-Git $ModRoot @('rev-list', "$baseline..$after")).Count
        $changedRules = @($files | Where-Object { $_ -match $rulePattern })
        $changedWording = @($files | Where-Object { $_ -match $wordingPattern })
        $changedInputs = @($files | Where-Object { $_ -match $inputPattern })
        Write-Host "  $commits commits, $($files.Count) files. Tree and wording data files: $($changedInputs.Count) (handled by the extractor)."
        if ($changedWording.Count) { Write-Host "  Effect enums: $($changedWording.Count) (only matters if a wording check above flagged something)" }
        if ($changedRules.Count) {
            $names = @($changedRules | ForEach-Object { [IO.Path]::GetFileNameWithoutExtension($_) })
            Flag "rule files changed, compare with app.js / extract.ps1: $($names -join ', ')"
            $changedRules | ForEach-Object { Write-Host "      $_" }
            Write-Host "    See a change with: git -C ExiledSector diff $($baseline.Substring(0, 8)) $($after.Substring(0, 8)) -- <file>"
        } else { Ok 'no rule files changed' }
    }
}

# ---------------------------------------------------------------- 6. record
$record = [ordered]@{
    release      = $release
    commit       = $after
    modVersion   = $new.modVersion
    synced       = (Get-Date).ToString('yyyy-MM-dd HH:mm')
    noWording    = @($noWording | Sort-Object)
    absentImages = @($absent)
}
[IO.File]::WriteAllText($StateFile, ($record | ConvertTo-Json -Depth 4) + "`n", $utf8)

Section 'Result'
$changes = if ($summary.Count) { $summary -join ', ' } else { 'no tree changes' }
if ($attention.Count) {
    Write-Host "  $release ($($new.modVersion)): $changes. $($attention.Count) item(s) need a look:" -ForegroundColor Yellow
    $attention | ForEach-Object { Write-Host "    - $_" -ForegroundColor Yellow }
} else {
    Write-Host "  $release ($($new.modVersion)): $changes. All checks passed, no rule files changed." -ForegroundColor Green
}
Write-Host '  Reload the planner to see the new data.'

if (Test-Path (Join-Path $Root '.git')) {
    $pending = @(Invoke-Git $Root @('status', '--porcelain'))
    if (-not $pending.Count) { Write-Host '  Planner repo: nothing to commit.' }
    elseif ($Commit) {
        Invoke-Git $Root @('add', '-A') | Out-Null
        Invoke-Git $Root @('commit', '--quiet', '-m', "Sync with Exiled Sector $release") | Out-Null
        Write-Host "  Committed: Sync with Exiled Sector $release"
    } else {
        Write-Host "  Planner repo: $($pending.Count) changed paths. Review with 'git status', or rerun with -Commit."
    }
}
