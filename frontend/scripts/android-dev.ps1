# Local Android dev: USB tunnel + sync with local backend override.
# Requires: backend running (cd backend && npm run dev), phone via USB.

$ErrorActionPreference = "Stop"

$sdkRoot = $env:ANDROID_HOME
if (-not $sdkRoot) {
    $sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}

$adb = Join-Path $sdkRoot "platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
    Write-Error "adb not found at $adb. Install Android SDK platform-tools or set ANDROID_HOME."
}

Write-Host "Setting USB port forward (phone localhost:8080 -> PC:8080)..."
& $adb reverse tcp:8080 tcp:8080
& $adb reverse --list

$frontendRoot = Split-Path $PSScriptRoot -Parent
Set-Location $frontendRoot

$androidLocal = Join-Path $frontendRoot ".env.android.local"
$prodLocal = Join-Path $frontendRoot ".env.production.local"

if (-not (Test-Path $androidLocal)) {
    Write-Error ".env.android.local not found. Copy from .env.android.local.example or create it."
}

Write-Host "Applying local backend override (.env.android.local -> .env.production.local)..."
Copy-Item -Force $androidLocal $prodLocal

try {
    Write-Host "Building and syncing Capacitor..."
    npm run build
    npx cap sync android
} finally {
    if (Test-Path $prodLocal) {
        Remove-Item -Force $prodLocal
        Write-Host "Removed temporary .env.production.local (use npm run android:prod for Railway builds)."
    }
}

Write-Host ""
Write-Host "Done. Click Run in Android Studio. Keep backend running: cd backend && npm run dev"
