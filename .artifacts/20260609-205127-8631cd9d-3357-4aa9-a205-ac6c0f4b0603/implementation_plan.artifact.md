# Fix Backend Connectivity and CORS for Android

The Android application is currently blocked by CORS when attempting to connect to the production backend. Additionally, the backend returns a 500 error when a CORS origin is not allowed, which is misleading.

## Proposed Changes

### Backend Component

Update the CORS configuration to explicitly allow mobile app origins and improve error handling.

#### [cors.js](file:///C:/Users/KARAN/CrwdCtrl/backend/src/config/cors.js)

- Change `corsOptionsDelegate` to return `callback(null, false)` instead of throwing an `Error`. This prevents the backend from crashing/returning 500 on disallowed origins.
- Ensure `https://localhost` and `capacitor://localhost` are in the allowed list and prioritized.

```javascript
function corsOptionsDelegate(origin, callback) {
  if (!origin) return callback(null, true);
  if (allowedOrigins.has(origin)) return callback(null, true);

  // Allow localhost for mobile/dev even if not in the set (extra safety)
  if (origin === 'https://localhost' || origin === 'capacitor://localhost' || origin.includes('localhost')) {
     return callback(null, true);
  }

  console.warn('CORS blocked origin:', origin);
  return callback(null, false); // Don't pass Error, just return false
}
```

---

### Frontend Component

Ensure that local Android development always uses the correct port forwarding.

#### [android-dev.ps1](file:///C:/Users/KARAN/CrwdCtrl/frontend/scripts/android-dev.ps1)

- No changes required to the file itself, but I will emphasize its use to the user.

## Verification Plan

### Automated Tests
I will use `curl.exe` to simulate preflight `OPTIONS` requests from the `https://localhost` origin and verify:
1. It returns `204 No Content` (or `200`) instead of `500`.
2. The `access-control-allow-origin` header is present.

```powershell
curl.exe -I -H "Origin: https://localhost" -X OPTIONS http://localhost:8080/api/health
```

### Manual Verification
1. I will ask the user to run `npm run android:dev` to verify local connectivity.
2. I will recommend a redeploy to Railway to fix the production block.
