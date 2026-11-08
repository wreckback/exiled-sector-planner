<#
  Extracts the Exiled Sector skill tree into the web planner.

  Reads the mod checkout (default: ..\ExiledSector) and writes:
    web\data\planner-data.js   tree, skill types, effect wording (as a JS global, so the page also works from file://)
    web\assets\...             every image the planner draws, at its mod-relative path

  Run again whenever the mod's tree or skill types change:
    powershell -ExecutionPolicy Bypass -File tools\extract.ps1 [-ModRoot <path>]
#>
param(
    [string]$ModRoot = (Join-Path $PSScriptRoot '..\ExiledSector'),
    [string]$WebRoot = (Join-Path $PSScriptRoot '..\web')
)

$ErrorActionPreference = 'Stop'
$ModRoot = (Resolve-Path $ModRoot).Path
$WebRoot = [IO.Path]::GetFullPath($WebRoot)
$utf8 = New-Object Text.UTF8Encoding($false)

function Read-Json([string]$path) {
    [IO.File]::ReadAllText($path, $utf8) | ConvertFrom-Json
}

Write-Host "Mod:  $ModRoot"
Write-Host "Web:  $WebRoot"

$tree = Read-Json "$ModRoot\data\skilltrees\ship_skill_tree.json"
$types = (Read-Json "$ModRoot\data\skilltrees\skill_types.json").skillTypes
$strings = @{}
foreach ($part in 'core', 'skillTree') {
    $s = Read-Json "$ModRoot\data\strings\exiledSector\$part\en.json"
    foreach ($p in $s.PSObject.Properties) { $strings[$p.Name] = $p.Value }
}

# ---------------------------------------------------------------- effects
# Effect wording lives in Java enums. Each constant is either a plain stat effect
# (mode + stat name key, worded by desc.<mode>.up/down) or a templated one
# (effect.<NAME> string with {value} and extra args taken from Java constants).

$javaFiles = Get-ChildItem -Path $ModRoot -Recurse -Filter *.java |
    Where-Object { $_.FullName -match '\\src\\main\\java\\' }

# Numeric constants: NAME = 12.5f;  keyed both as NAME and Class.NAME
$constants = @{}
$stringConstants = @{}
$classText = @{}      # class name -> source, for following description helpers into other classes
$hullTables = @{}     # HullSizeTable constants: NAME and Class.NAME -> @(fighter, frigate, destroyer, cruiser, capital, otherwise)
foreach ($f in $javaFiles) {
    $text = [IO.File]::ReadAllText($f.FullName, $utf8)
    $cls = $f.BaseName
    if (-not $classText.ContainsKey($cls)) { $classText[$cls] = $text -replace "`r", '' }
    foreach ($m in [regex]::Matches($text, '\bHullSizeTable\s+([A-Z][A-Z0-9_]*)\s*=\s*new\s+HullSizeTable\(([^)]*)\)')) {
        $vals = @($m.Groups[2].Value -split ',' | ForEach-Object { [double]($_.Trim() -replace '[fFdD]$', '') })
        if ($vals.Count -eq 6) { $hullTables["$cls.$($m.Groups[1].Value)"] = $vals; $hullTables[$m.Groups[1].Value] = $vals }
    }
    foreach ($m in [regex]::Matches($text, '(?m)\b(?:static\s+)?final\s+(?:int|float|double|long)\s+([A-Z][A-Z0-9_]*)\s*=\s*(-?[0-9]+(?:\.[0-9]+)?)[fFdDlL]?\s*;')) {
        $v = [double]$m.Groups[2].Value
        $constants["$cls.$($m.Groups[1].Value)"] = $v
        if (-not $constants.ContainsKey($m.Groups[1].Value)) { $constants[$m.Groups[1].Value] = $v }
    }
    foreach ($m in [regex]::Matches($text, '(?m)\bstatic\s+final\s+String\s+([A-Z][A-Z0-9_]*)\s*=\s*"(stat\.[A-Za-z0-9_.]+)"\s*;')) {
        $stringConstants["$cls.$($m.Groups[1].Value)"] = $m.Groups[2].Value
        $stringConstants[$m.Groups[1].Value] = $m.Groups[2].Value
    }
}

function Resolve-Expression([string]$expr, [string]$cls) {
    # Returns a JS-evaluable expression over `magnitude`, or $null if it uses anything unknown.
    $e = $expr.Trim()
    $e = [regex]::Replace($e, '\(\s*(?:int|float|double)\s*\)', '')
    $e = $e -replace 'Math\.round', 'round' -replace 'Math\.abs', 'abs' -replace 'Math\.max', 'max' -replace 'Math\.min', 'min'
    $e = [regex]::Replace($e, '(\d+(?:\.\d+)?)[fFdD]\b', '$1')
    $script:failed = $false
    $e = [regex]::Replace($e, '\b([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Z][A-Z0-9_]*)?)\b', {
        param($m)
        $id = $m.Groups[1].Value
        if ($id -in 'magnitude', 'round', 'abs', 'max', 'min') { return $id }
        if ($constants.ContainsKey($id)) { return [string]$constants[$id] }
        if ($constants.ContainsKey("$cls.$id")) { return [string]$constants["$cls.$id"] }
        $script:failed = $true
        return $id
    })
    if ($script:failed) { $script:failed = $false; return $null }
    if ($e -notmatch '^[0-9a-z+\-*/()., ]+$') { return $null }
    return $e
}

# Index of the bracket that closes the one at $open (works for ( and {).
function Find-Close([string]$s, [int]$open) {
    $o = $s[$open]; $c = if ($o -eq '(') { ')' } else { '}' }
    $depth = 0
    for ($i = $open; $i -lt $s.Length; $i++) {
        if ($s[$i] -eq $o) { $depth++ } elseif ($s[$i] -eq $c) { $depth--; if ($depth -eq 0) { return $i } }
    }
    return -1
}
function Split-TopLevel([string]$s) {
    $parts = @(); $depth = 0; $start = 0
    for ($i = 0; $i -lt $s.Length; $i++) {
        $ch = $s[$i]
        if ($ch -eq '(' -or $ch -eq '{' -or $ch -eq '<') { $depth++ }
        elseif ($ch -eq ')' -or $ch -eq '}' -or $ch -eq '>') { $depth-- }
        elseif ($ch -eq ',' -and $depth -eq 0) { $parts += $s.Substring($start, $i - $start).Trim(); $start = $i + 1 }
    }
    $last = $s.Substring($start).Trim()
    if ($last) { $parts += $last }
    return , $parts
}
# Message args added by a description body: .arg("k", expr), HullSizeTable.withShipSizeArgs(...), and calls into
# helper methods (followed into their class, with the helper's parameters replaced by the call's arguments).
$skipCalls = 'msg|arg|styled|templated|signed|text|format|of|valueOf|get|round|abs|max|min|withShipSizeArgs|affinityScaling|stepSize|count|plain|list'
function Get-DescriptionArgs([string]$body, [string]$cls, [hashtable]$params, [int]$depth) {
    $out = [ordered]@{}
    $sub = {
        param([string]$expr)
        $e = $expr
        foreach ($p in $params.Keys) { $e = [regex]::Replace($e, "\b$p\b", "($($params[$p]))") }
        Resolve-Expression $e $cls
    }
    foreach ($a in [regex]::Matches($body, '\.arg\(\s*"(\w+)"\s*,\s*((?:[^()]|\((?:[^()]|\([^()]*\))*\))+)\)')) {
        $r = & $sub $a.Groups[2].Value
        if ($r -and -not $out.Contains($a.Groups[1].Value)) { $out[$a.Groups[1].Value] = $r }
    }
    foreach ($m in [regex]::Matches($body, '\b(?:(\w+)\.)?(\w+)\.withShipSizeArgs\(')) {
        $key = if ($m.Groups[1].Success) { "$($m.Groups[1].Value).$($m.Groups[2].Value)" } else { $m.Groups[2].Value }
        $t = if ($hullTables.ContainsKey($key)) { $hullTables[$key] } else { $hullTables[$m.Groups[2].Value] }
        if ($t) { $out.frigate = [string]$t[1]; $out.destroyer = [string]$t[2]; $out.cruiser = [string]$t[3]; $out.capital = [string]$t[4] }
    }
    if ($depth -ge 3) { return $out }
    foreach ($m in [regex]::Matches($body, '\b(?:([A-Z]\w*)\.)?([a-z]\w*)\s*\(')) {
        $method = $m.Groups[2].Value
        if ($method -match "^($skipCalls)$") { continue }
        $owner = if ($m.Groups[1].Success) { $m.Groups[1].Value } else { $cls }
        if ($owner -in 'EffectText', 'Translation', 'Math', 'String', 'List', 'Map', 'NumberText') { continue }
        $src = $classText[$owner]
        if (-not $src) { continue }
        $close = Find-Close $body ($m.Index + $m.Length - 1)
        if ($close -lt 0) { continue }
        $callArgs = Split-TopLevel $body.Substring($m.Index + $m.Length, $close - $m.Index - $m.Length)
        $def = [regex]::Match($src, "(?m)^\s*(?:(?:public|private|protected|static|final)\s+)*[\w<>\[\]]+\s+$method\s*\(([^)]*)\)\s*\{")
        if (-not $def.Success) { continue }
        $bodyOpen = $def.Index + $def.Length - 1
        $bodyClose = Find-Close $src $bodyOpen
        if ($bodyClose -lt 0) { continue }
        $helperParams = @{}
        $declared = Split-TopLevel $def.Groups[1].Value
        for ($k = 0; $k -lt $declared.Count -and $k -lt $callArgs.Count; $k++) {
            $pname = ($declared[$k] -split '\s+')[-1]
            $arg = $callArgs[$k]
            foreach ($p in $params.Keys) { $arg = [regex]::Replace($arg, "\b$p\b", "($($params[$p]))") }
            if ($arg -match '^[\w.()+\-*/ ]+$' -and $arg -notmatch '\bthis\b') { $helperParams[$pname] = $arg }
        }
        $inner = Get-DescriptionArgs $src.Substring($bodyOpen + 1, $bodyClose - $bodyOpen - 1) $owner $helperParams ($depth + 1)
        foreach ($k2 in $inner.Keys) { if (-not $out.Contains($k2)) { $out[$k2] = $inner[$k2] } }
    }
    return $out
}

# LowBaseArmorBonus keeps its per-hull scale in a map; its description helpers return "a/b/c/d" strings.
$lowArmorScales = [ordered]@{}
if ($classText['LowBaseArmorBonus']) {
    foreach ($m in [regex]::Matches($classText['LowBaseArmorBonus'], 'SCALES\.put\(\s*HullSize\.(\w+)\s*,\s*new\s+Scale\(([^)]*)\)')) {
        $lowArmorScales[$m.Groups[1].Value] = @($m.Groups[2].Value -split ',' | ForEach-Object { [double]($_.Trim() -replace '[fFdD]$', '') })
    }
}

$effects = @{}
$enumFiles = $javaFiles | Where-Object { $_.Name -like '*SkillEffect.java' }
foreach ($f in $enumFiles) {
    $text = [IO.File]::ReadAllText($f.FullName, $utf8) -replace "`r", ''
    if ($text -notmatch '\benum\s+\w+') { continue }
    $cls = $f.BaseName
    # Constants start at 4-space indent with an UPPER_CASE name.
    $starts = [regex]::Matches($text, '(?m)^    ([A-Z][A-Z0-9_]+)\s*(?=[\(,;{])')
    for ($i = 0; $i -lt $starts.Count; $i++) {
        $name = $starts[$i].Groups[1].Value
        $from = $starts[$i].Index
        $to = if ($i + 1 -lt $starts.Count) { $starts[$i + 1].Index } else { $text.Length }
        $body = $text.Substring($from, $to - $from)
        $info = [ordered]@{}

        $mode = [regex]::Match($body, '(?:statEffect|ConditionalStatEffect|DerivedStatEffect|ScaledBonus|statEffectFor\w*)\s*\(\s*(?:StatMode\.)?(PERCENT|FLAT|MULT)\b')
        if (-not $mode.Success) { $mode = [regex]::Match($body, '\b(PERCENT|FLAT|MULT)\s*,') }
        if ($mode.Success) { $info.mode = $mode.Groups[1].Value.ToLower() }

        $stat = [regex]::Match($body, '"(stat\.[A-Za-z0-9_.]+)"')
        if ($stat.Success) { $info.stat = $stat.Groups[1].Value }
        else {
            $sc = [regex]::Match($body, '\b(?:([A-Z][A-Za-z]+)\.)?([A-Z][A-Z0-9_]+)\s*,\s*(?:true|false)\s*\)')
            if ($sc.Success) {
                $key = if ($sc.Groups[1].Success) { "$($sc.Groups[1].Value).$($sc.Groups[2].Value)" } else { $sc.Groups[2].Value }
                if ($stringConstants.ContainsKey($key)) { $info.stat = $stringConstants[$key] }
                elseif ($stringConstants.ContainsKey($sc.Groups[2].Value)) { $info.stat = $stringConstants[$sc.Groups[2].Value] }
            }
        }
        if ($body -match ',\s*true\s*\)\s*\)' -or $body -match 'lowerIsBetter\(\)\s*\{\s*return\s+true') { $info.lowerIsBetter = $true }

        $args = [ordered]@{}
        # Affinity-scaled effects (AffinityScaling backing) word themselves with {step} = the scaling's step size.
        $scaling = [regex]::Match($body, 'new\s+AffinityScaling\(\s*AffinityScaling\.Filter\.\w+\s*,\s*(?:AffinityScaling\.)?([A-Z_][A-Z0-9_]*|\d+)')
        $step = $null
        if ($scaling.Success) {
            $sv = $scaling.Groups[1].Value
            $step = if ($sv -match '^\d+$') { $sv } elseif ($constants.ContainsKey("AffinityScaling.$sv")) { [string]$constants["AffinityScaling.$sv"] } else { $null }
            if ($step) { $args.step = $step }
        }
        $desc = [regex]::Match($body, 'description\s*\(\s*float\s+magnitude\s*\)\s*\{(.*?)\n        \}', 'Singleline')
        if ($desc.Success) {
            $info.custom = $true
            $dbody = $desc.Groups[1].Value
            if ($step) { $dbody = $dbody -replace 'affinityScaling\(\)\.stepSize\(\)', $step }
            $found = Get-DescriptionArgs $dbody $cls @{} 0
            foreach ($k in $found.Keys) { if (-not $args.Contains($k)) { $args[$k] = $found[$k] } }
            # LowBaseArmorBonus.*ByHullSize(magnitude): one value per hull size joined with "/", plus per-hull values
            # for the hull-specific wording (effect.NAME.hullSize).
            if ($dbody -match 'LowBaseArmorBonus\.(most|least|cutoff)ByHullSize' -and $lowArmorScales.Count) {
                $fields = @{ most = 0; least = 1; cutoff = 2 }
                foreach ($f2 in $fields.Keys) {
                    $parts = foreach ($h in $lowArmorScales.Keys) { $v = $lowArmorScales[$h][$fields[$f2]]; if ($f2 -eq 'cutoff') { "$v" } else { "round($v*magnitude)" } }
                    $args[$f2] = "join($($parts -join ','))"
                }
                $hullArgs = [ordered]@{}
                foreach ($h in $lowArmorScales.Keys) {
                    $s3 = $lowArmorScales[$h]
                    $hullArgs[$h] = [ordered]@{ most = "round($($s3[0])*magnitude)"; least = "round($($s3[1])*magnitude)"; cutoff = "$($s3[2])" }
                }
                $info.hullArgs = $hullArgs
            }
            $variant = [regex]::Match($dbody, 'EffectText\.(signed)\(')
            if ($variant.Success) { $info.signed = $true }
        }
        if ($args.Count) { $info.args = $args }
        $effects[$name] = $info
    }
}

# Weapon stat families declared with qualifiedByScope = false don't prefix the scope.
$weaponUnqualified = @()
$wsf = $javaFiles | Where-Object { $_.Name -eq 'WeaponStatFamily.java' } | Select-Object -First 1
if ($wsf) {
    foreach ($m in [regex]::Matches([IO.File]::ReadAllText($wsf.FullName), '(?m)^    ([A-Z_]+)\(\s*false\b')) { $weaponUnqualified += $m.Groups[1].Value }
}

# Effects actually used by skill types, plus the string templates they need.
$usedEffects = @{}
foreach ($t in $types) {
    foreach ($e in @($t.effects) + @($t.hullSizeEffects)) { if ($e -and $e.effect) { $usedEffects[$e.effect] = $true } }
}
$effectOut = [ordered]@{}
$neededStrings = @{}
foreach ($k in $strings.Keys) { if ($k -like 'desc.*' -or $k -like 'stat.*' -or $k -like 'weapon.*') { $neededStrings[$k] = $strings[$k] } }
$missing = @()
foreach ($name in ($usedEffects.Keys | Sort-Object)) {
    $info = if ($effects.ContainsKey($name)) { $effects[$name] } else { [ordered]@{} }
    # Weapon effects are generated (ScopedWeaponEffect): <SCOPE_>WEAPON_<FAMILY>_<MODE>, worded by weapon.stat.<FAMILY>.
    $w = [regex]::Match($name, '^(BALLISTIC_|MISSILE_|NON_BEAM_ENERGY_|ENERGY_|BEAM_)?WEAPON_([A-Z_]+)_(PERCENT|FLAT|MULT)$')
    if (-not $info.stat -and $w.Success -and $strings.ContainsKey("weapon.stat.$($w.Groups[2].Value)")) {
        $family = $w.Groups[2].Value
        $info = [ordered]@{ mode = $w.Groups[3].Value.ToLower(); weaponFamily = $family }
        if ($w.Groups[1].Success) { $info.weaponScope = $w.Groups[1].Value.TrimEnd('_') }
        if ($weaponUnqualified -contains $family) { $info.unqualified = $true }
        if ($family -in 'FLUX_COST', 'RECOIL') { $info.lowerIsBetter = $true }
    }
    foreach ($k in $strings.Keys) {
        if ($k -eq "effect.$name" -or $k -like "effect.$name.*") { $neededStrings[$k] = $strings[$k] }
    }
    $hasTemplate = $strings.ContainsKey("effect.$name") -or @($strings.Keys | Where-Object { $_ -like "effect.$name.*" }).Count -gt 0
    if (-not $hasTemplate -and -not $info.stat -and -not $info.weaponFamily) { $missing += $name }
    $effectOut[$name] = $info
}
Write-Host ("Effects: {0} used, {1} without wording (shown by name)" -f $usedEffects.Count, $missing.Count)
if ($missing.Count) { Write-Host ('  ' + ($missing -join ', ')) }

# Affinity step bonuses (AffinitySteps.stepsByAffinity): every <size> affinity grants <bonus> of <effect>.
$affinitySteps = [ordered]@{}
$asf = $javaFiles | Where-Object { $_.Name -eq 'AffinitySteps.java' } | Select-Object -First 1
if ($asf) {
    $txt = [IO.File]::ReadAllText($asf.FullName)
    foreach ($m in [regex]::Matches($txt, 'steps\.put\(\s*\w+\.(\w+)\s*,\s*List\.of\((.*?)\)\);', 'Singleline')) {
        $list = @()
        foreach ($s in [regex]::Matches($m.Groups[2].Value, 'new Step\(\s*(\w+)\s*,\s*\w+\.(\w+)\s*,\s*([0-9.]+)f?\s*\)')) {
            $size = $constants["AffinitySteps.$($s.Groups[1].Value)"]
            if ($null -eq $size) { $size = $constants[$s.Groups[1].Value] }
            $list += [ordered]@{ size = $size; effect = $s.Groups[2].Value; bonus = [double]$s.Groups[3].Value }
            $usedEffects[$s.Groups[2].Value] = $true
        }
        $affinitySteps[$m.Groups[1].Value] = $list
    }
}

# Hull mod display names (phantom / vanilla hull mod nodes) from the balance sheet.
$hullModNames = [ordered]@{}
$balance = "$ModRoot\docs\analysis\balance.csv"
if (Test-Path $balance) {
    foreach ($row in (Import-Csv $balance)) { if ($row.hullmod_id -and $row.hullmod_name) { $hullModNames[$row.hullmod_id] = $row.hullmod_name } }
}
foreach ($name in @($usedEffects.Keys)) {
    if (-not $effectOut.Contains($name) -and $effects.ContainsKey($name)) { $effectOut[$name] = $effects[$name] }
}

# Wormhole anchor items: templates store socket -> anchor item id, the planner links socket -> exit node.
$wormholeAnchors = @()
$anchorCsv = "$ModRoot\data\config\exiledSector\wormhole_anchors.csv"
if (Test-Path $anchorCsv) {
    foreach ($row in (Import-Csv $anchorCsv)) {
        if ($row.id -and $row.exit_node) { $wormholeAnchors += [ordered]@{ id = $row.id; exit = $row.exit_node; name = $row.name } }
    }
}

# Retired / renamed ids, so templates written by older mod versions import like the game reads them (NodeReplacements, AffinityOptions).
function Read-Renames([string]$path) {
    $map = [ordered]@{}
    if (Test-Path $path) { foreach ($row in (Import-Csv $path)) { if ($row.old -and $row.new) { $map[$row.old.Trim()] = $row.new.Trim() } } }
    return $map
}
$nodeRenames = Read-Renames "$ModRoot\data\config\exiledSector\node_replacements.csv"
foreach ($kv in (Read-Renames "$ModRoot\data\config\exiledSector\node_id_renames.csv").GetEnumerator()) { $nodeRenames[$kv.Key] = $kv.Value }
$typeRenames = Read-Renames "$ModRoot\data\config\exiledSector\type_id_renames.csv"
$retiredOptions = [ordered]@{}
$aof = $javaFiles | Where-Object { $_.Name -eq 'AffinityOptions.java' } | Select-Object -First 1
if ($aof) {
    $block = [regex]::Match([IO.File]::ReadAllText($aof.FullName), 'RETIRED_OPTIONS\s*=\s*Map\.of\((.*?)\);', 'Singleline')
    if ($block.Success) {
        foreach ($m in [regex]::Matches($block.Groups[1].Value, '"([^"]+)"\s*,\s*"([^"]+)"')) { $retiredOptions[$m.Groups[1].Value] = $m.Groups[2].Value }
    }
}

# UI strings the planner reuses.
foreach ($k in $strings.Keys) { if ($k -like 'ui.node.*' -or $k -like 'tier.*') { $neededStrings[$k] = $strings[$k] } }

# ---------------------------------------------------------------- tree + types
$typeOut = foreach ($t in $types) {
    $o = [ordered]@{ id = $t.id; name = $t.name; icon = $t.icon; tier = $(if ($t.tier) { $t.tier } else { 'SMALL' }) }
    foreach ($k in 'effects', 'hullSizeEffects', 'options', 'tags', 'flavour', 'effectText', 'phantomHullMods', 'exclusiveHullMods',
                   'exclusiveSkillTypes', 'vanillaHullMod', 'requiredHullSizes', 'itemCost', 'unlockConditions', 'todo') {
        if ($null -ne $t.$k) { $o[$k] = $t.$k }
    }
    $o
}

$nodeOut = foreach ($n in $tree.nodes) {
    $o = [ordered]@{ id = $n.id; type = $n.type; x = $n.x; y = $n.y; c = @($n.connectedTo) }
    foreach ($k in 'tags', 'pairedWith', 'ringBeltPath', 'ringBeltColor', 'ringBeltWidth', 'wormholeColor', 'orbitAnchorId', 'orbitAngle') {
        if ($null -ne $n.$k) { $o[$k] = $n.$k }
    }
    $o
}

$data = [ordered]@{
    generated        = (Get-Date).ToString('yyyy-MM-dd HH:mm')
    modVersion       = $null
    nodes            = @($nodeOut)
    curves           = @($tree.connectorCurves)
    hiddenConnectors = @($tree.hiddenConnectors)
    anchors          = @($tree.orbitAnchors)
    decorations      = @($tree.decorations)
    types            = @($typeOut)
    effects          = $effectOut
    affinitySteps    = $affinitySteps
    hullModNames     = $hullModNames
    wormholeAnchors  = @($wormholeAnchors)
    nodeRenames      = $nodeRenames
    typeRenames      = $typeRenames
    retiredOptions   = $retiredOptions
    strings          = $neededStrings
}
$modInfo = "$ModRoot\mod_info.json"
if (Test-Path $modInfo) {
    $infoText = [IO.File]::ReadAllText($modInfo)
    $mv = [regex]::Match($infoText, '"version"\s*:\s*"([^"]+)"')
    $mo = [regex]::Match($infoText, '"version"\s*:\s*\{\s*"major"\s*:\s*(\d+)\s*,\s*"minor"\s*:\s*(\d+)\s*,\s*"patch"\s*:\s*(\d+)')
    if ($mv.Success) { $data.modVersion = $mv.Groups[1].Value }
    elseif ($mo.Success) { $data.modVersion = "$($mo.Groups[1].Value).$($mo.Groups[2].Value).$($mo.Groups[3].Value)" }
}

New-Item -ItemType Directory -Force "$WebRoot\data" | Out-Null
$json = $data | ConvertTo-Json -Depth 12 -Compress
[IO.File]::WriteAllText("$WebRoot\data\planner-data.js", "window.PLANNER_DATA = $json;`n", $utf8)
Write-Host ("Wrote data\planner-data.js ({0:N0} KB)" -f ((Get-Item "$WebRoot\data\planner-data.js").Length / 1KB))

# ---------------------------------------------------------------- images
$images = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($t in $types) { if ($t.icon) { [void]$images.Add($t.icon) } }
foreach ($n in $tree.nodes) { if ($n.ringBeltPath) { [void]$images.Add($n.ringBeltPath) } }
foreach ($d in $tree.decorations) {
    foreach ($k in 'imagePath', 'ringArtPath', 'overlayPath') { if ($d.$k) { [void]$images.Add($d.$k) } }
}
foreach ($p in 'graphics/fx/star_halo.png', 'graphics/planets/aurorae.png') { [void]$images.Add($p) }

$copied = 0; $absent = @()
foreach ($rel in $images) {
    $src = Join-Path $ModRoot ($rel -replace '/', '\')
    $dst = Join-Path "$WebRoot\assets" ($rel -replace '/', '\')
    if (Test-Path $src) {
        New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
        if (-not (Test-Path $dst) -or (Get-Item $src).LastWriteTime -gt (Get-Item $dst).LastWriteTime) {
            Copy-Item $src $dst -Force
        }
        $copied++
    } else { $absent += $rel }
}
Write-Host "Images: $copied copied or current, $($absent.Count) not in the mod (vanilla art; drawn as placeholders)"
if ($absent.Count) { $absent | Sort-Object | ForEach-Object { Write-Host "  $_" } }
