# smoke.ps1 -- launch wi-ai-service and exercise the full API surface.
# Usage: powershell -File .claude/skills/run-wi-ai-service/smoke.ps1 [-KeepAlive]
# Exits 0 on all green, 1 on any failure.

param([switch]$KeepAlive)

$ErrorActionPreference = "Stop"

$PORT   = 3000
$BASE   = "http://localhost:$PORT/api"
$BASEV1 = "$BASE/v1"
$KEY    = if ($env:SERVICE_API_KEY) { $env:SERVICE_API_KEY } else { "dev-service-key-change-me" }
$H      = @{ "x-api-key" = $KEY; "Content-Type" = "application/json" }

$pass = 0; $fail = 0
function ok($label)       { Write-Host "  PASS  $label" -ForegroundColor Green; $script:pass++ }
function ko($label, $msg) { Write-Host "  FAIL  $label -- $msg" -ForegroundColor Red; $script:fail++ }
function req($method, $url, $body=$null) {
    $params = @{ Method=$method; Uri=$url; Headers=$H; ErrorAction="Stop" }
    if ($body) { $params.Body = $body }
    return Invoke-RestMethod @params
}

# -- build --------------------------------------------------------------------
Write-Host "Building..."
$buildOut = cmd /c "npm run build 2>&1"
if ($LASTEXITCODE -ne 0) { Write-Host $buildOut; Write-Error "build failed"; exit 1 }

# -- clear port ---------------------------------------------------------------
Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

# -- start server -------------------------------------------------------------
Write-Host "Starting server on :$PORT ..."
$log    = [System.IO.Path]::GetTempFileName()
$logErr = "$log.err"
$proc   = Start-Process node -ArgumentList "dist/src/main.js" -NoNewWindow -PassThru `
          -RedirectStandardOutput $log -RedirectStandardError $logErr

$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 400
    $content = Get-Content $log -ErrorAction SilentlyContinue
    if ($content -match "successfully started") { break }
}
if (-not ($content -match "successfully started")) {
    Get-Content $log, $logErr -ErrorAction SilentlyContinue
    Write-Error "Server did not start within 20s"
    exit 1
}
Write-Host "Server up (PID $($proc.Id))"

# -- smoke checks -------------------------------------------------------------
Write-Host ""
Write-Host "Running smoke checks..."

# 1. health (public, no key)
try {
    $r = Invoke-RestMethod "$BASE/health"
    if ($r.status -eq "ok" -and $r.db -eq "up") { ok "GET /api/health -> {status:ok,db:up}" }
    else { ko "health" "unexpected body: $($r | ConvertTo-Json -Compress)" }
} catch { ko "health" $_ }

# 2. auth guard -- no key
try {
    Invoke-RestMethod "$BASEV1/deals" -ErrorAction Stop | Out-Null
    ko "auth no-key" "should have 401"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401) { ok "GET /deals with no key -> 401" }
    else { ko "auth no-key" "got $code" }
}

# 3. auth guard -- bad key
try {
    Invoke-RestMethod "$BASEV1/deals" -Headers @{"x-api-key"="wrong"} -ErrorAction Stop | Out-Null
    ko "auth bad-key" "should have 401"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401) { ok "GET /deals with bad key -> 401" }
    else { ko "auth bad-key" "got $code" }
}

# 4. create deal
$deal = $null
try {
    $deal = req Post "$BASEV1/deals" '{"externalRef":"SMOKE-001","name":"Smoke Deal","governingLaw":"English"}'
    ok "POST /deals -> $($deal.id)"
} catch { ko "create deal" $_ }

if ($deal) {
    # 5. list deals
    try {
        $list = req Get "$BASEV1/deals"
        if ($list.Count -ge 1) { ok "GET /deals -> $($list.Count) item(s)" }
        else { ko "list deals" "empty" }
    } catch { ko "list deals" $_ }

    # 6. get deal by id
    try {
        $got = req Get "$BASEV1/deals/$($deal.id)"
        if ($got.name -eq "Smoke Deal") { ok "GET /deals/:id -> correct name" }
        else { ko "get deal" "wrong name: $($got.name)" }
    } catch { ko "get deal" $_ }

    # 7. list warranties (empty -- no doc uploaded)
    try {
        $w = req Get "$BASEV1/deals/$($deal.id)/warranties"
        if ($w.Count -eq 0) { ok "GET warranties -> 0 (no doc yet)" }
        else { ko "warranties" "expected 0 got $($w.Count)" }
    } catch { ko "warranties" $_ }

    # 8. create exclusion
    $ex = $null
    try {
        $ex = req Post "$BASEV1/deals/$($deal.id)/exclusions" '{"label":"Cyber","text":"All cyber losses excluded.","isStandard":true}'
        ok "POST /exclusions -> $($ex.id)"
    } catch { ko "create exclusion" $_ }

    # 9. list exclusions
    if ($ex) {
        try {
            $exl = req Get "$BASEV1/deals/$($deal.id)/exclusions"
            if ($exl.Count -eq 1) { ok "GET /exclusions -> 1 item" }
            else { ko "list exclusions" "count $($exl.Count)" }
        } catch { ko "list exclusions" $_ }
    }
}

# -- teardown -----------------------------------------------------------------
if (-not $KeepAlive) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Server stopped."
}

# -- summary ------------------------------------------------------------------
Write-Host ""
Write-Host "Results: $pass passed, $fail failed"
if ($fail -gt 0) { exit 1 }
