# Production Android build — Railway API only, no local overrides.
$ErrorActionPreference = "Stop"
$frontendRoot = Split-Path $PSScriptRoot -Parent
Set-Location $frontendRoot

$localOverride = Join-Path $frontendRoot ".env.production.local"
$backup = Join-Path $frontendRoot ".env.production.local.bak"

if (Test-Path $localOverride) {
    Write-Host "Moving .env.production.local aside (would override Railway URL)..."
    Move-Item -Force $localOverride $backup
}

try {
    Write-Host "Building production bundle..."
    npm run build
    Write-Host "Verifying bundle has no dev URLs..."
    node scripts/verify-prod-bundle.js
    Write-Host "Syncing Capacitor Android..."
    npx cap sync android
    Write-Host ""
    Write-Host "✅ Production sync complete. Open Android Studio and build release AAB/APK."
    Write-Host "   npm run cap:open"
} finally {
    if (Test-Path $backup) {
        Move-Item -Force $backup $localOverride
        Write-Host "Restored .env.production.local for local dev."
    }
}
