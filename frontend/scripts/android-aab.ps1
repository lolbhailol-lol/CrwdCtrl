# Build a signed release AAB for Google Play.
# Requires android/keystore.properties (see keystore.properties.example).
$ErrorActionPreference = "Stop"
$frontendRoot = Split-Path $PSScriptRoot -Parent
$androidRoot = Join-Path $frontendRoot "android"
$keystoreProps = Join-Path $androidRoot "keystore.properties"

if (-not (Test-Path $keystoreProps)) {
    Write-Error "Missing android/keystore.properties. Copy keystore.properties.example and fill in your signing key, or run: npm run android:keystore"
}

Set-Location $frontendRoot
Write-Host "Building production web bundle + syncing Capacitor..."
powershell -ExecutionPolicy Bypass -File scripts/android-prod.ps1

Set-Location $androidRoot
Write-Host "Assembling signed release AAB..."
if ($IsWindows -or $env:OS -eq "Windows_NT") {
    .\gradlew.bat bundleRelease
} else {
    ./gradlew bundleRelease
}

$aab = Join-Path $androidRoot "app\build\outputs\bundle\release\app-release.aab"
if (Test-Path $aab) {
    Write-Host ""
    Write-Host "AAB ready: $aab"
} else {
    Write-Error "Build finished but app-release.aab was not found."
}
