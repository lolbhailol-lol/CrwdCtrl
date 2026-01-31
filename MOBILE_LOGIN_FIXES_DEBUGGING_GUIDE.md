# 📱 MOBILE LOGIN DEBUGGING & TROUBLESHOOTING GUIDE

## What Was Fixed

### Frontend Fixes (api.js)
1. **API Base URL Validation** - Proper error checking if VITE_API_BASE_URL not set
2. **Network Status Detection** - Check if device is online before making requests
3. **Enhanced Request Headers** - Added `Accept`, `X-Requested-With`, `Cache-Control` headers to prevent mobile proxy interference
4. **Mobile-Aware Error Detection** - Specific detection for CORS errors, network errors, timeouts
5. **Mobile Storage Fallback** - Falls back to sessionStorage, then memory if localStorage unavailable (iOS private mode)
6. **Comprehensive Logging** - All request/response headers logged for debugging
7. **HTTPS Enforcement** - Enforced in production to avoid mixed-content blocking

### Backend Fixes (server.js + controllers)
1. **Enhanced CORS Headers** - Added `Vary: Origin` to prevent mobile proxy CORS cache pollution
2. **Cache Control** - Proper cache control headers to prevent mobile proxy caching
3. **Cookie Settings** - Proper `SameSite=None`, `Secure` flags for mobile cross-origin
4. **Credentials Support** - Explicit `Access-Control-Allow-Credentials` header
5. **Preflight Status** - `optionsSuccessStatus: 200` for some mobile clients
6. **Request Logging** - Detailed logging of origin, headers, user-agent for mobile debugging

---

## Diagnosing Mobile Login Failures

### Step 1: Check Browser Console on Mobile Device

On your mobile device, open the app and check the browser console (F12 or remote debugging):

```
Look for these logs:

✅ API Configuration Healthy: true
  - If FALSE: VITE_API_BASE_URL environment variable not set

🟢 Network: ONLINE
  - If OFFLINE: Device has no internet connection

📤 API Request:
  - Check method, URL, timeout
  - Check "isMobile: true"
  
📥 API Response:
  - Check status code (should be 200)
  - Check CORS headers in response
```

### Step 2: Check for Specific Error Patterns

| Error | Cause | Solution |
|-------|-------|----------|
| **CORS Error** | Domain not in authorized list or preflight failed | Add domain to Firebase & backend CORS whitelist |
| **Timeout (408)** | Network too slow or server not responding | Check backend is running, increase timeout |
| **No internet connection** | Device offline or WiFi disconnected | Connect to internet |
| **403 Forbidden** | Token invalid or insufficient permissions | Clear localStorage, login again |
| **401 Unauthorized** | Token missing or expired | Check token is being sent in Authorization header |
| **Mixed Content Blocked** | Using HTTP in production | Use HTTPS in production |
| **Private Mode Storage Fail** | localStorage not available in iOS private mode | System now falls back to sessionStorage/memory |

### Step 3: Desktop Browser Remote Debugging

#### Chrome DevTools for Android

1. Connect Android device to computer via USB
2. Enable USB debugging on Android
3. Open Chrome and go to `chrome://inspect`
4. Click "inspect" next to your app
5. View real-time console logs

#### Safari for iOS (Mac only)

1. Connect iPhone to Mac via USB
2. Open Safari → Develop → [Your iPhone] → [Your App]
3. View real-time console logs

### Step 4: API Request Inspection

In mobile console, look for request details:

```javascript
📤 API Request (attempt 1/4): {
  method: "POST",
  url: "https://api.example.com/api/users/social-auth",
  timeout: 35000,
  headers: {
    Authorization: "Bearer eyJhbGc...",
    Content-Type: "application/json",
    Accept: "application/json",
    X-Requested-With: "XMLHttpRequest",
    Cache-Control: "no-cache",
    Pragma: "no-cache"
  },
  credentials: "include",
  isMobile: true,
  connection: "4g",
  online: true
}
```

**Check these:**
- ✅ URL is correct HTTPS URL
- ✅ Authorization header present with token
- ✅ Connection type (4g, 3g, lte)
- ✅ online: true
- ✅ credentials: "include"

### Step 5: Response Headers Check

Look for CORS response headers:

```javascript
📥 API Response: {
  status: 200,
  statusText: "OK",
  corsHeaders: {
    Access-Control-Allow-Origin: "https://your-domain.com",
    Access-Control-Allow-Credentials: "true",
    Content-Type: "application/json"
  }
}
```

**Check these:**
- ✅ `Access-Control-Allow-Origin` matches request origin
- ✅ `Access-Control-Allow-Credentials: true`
- ✅ Status 200 (or 201 for creation)

---

## Common Mobile Issues & Fixes

### Issue 1: "Unable to connect to server. CORS error detected."

**Root Cause**: 
- API domain not in Firebase authorized domains
- OR API domain not in backend CORS whitelist
- OR missing `Access-Control-Allow-Credentials` header

**Fix**:

#### Firebase Authorized Domains
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Authentication → Settings
4. Scroll to "Authorized domains"
5. Add your production domain (e.g., `crwdctrl.in`, `api.crwdctrl.in`)
6. Also add `localhost` for testing

#### Backend CORS Whitelist
File: `backend/src/server.js` (lines ~55-75)

```javascript
const corsOrigins = [
  "http://localhost:5173",
  "https://crwdctrl.in",
  "https://api.crwdctrl.in",
  // Add your mobile domain here
];
```

### Issue 2: "Request timeout. Your connection is slow."

**Root Cause**: 
- Mobile network connection is slow (3G, 2G)
- Server taking too long to respond
- Railway cold start if using Railway

**Fix**:

1. **Check Network Type** - Look in console for `connection: "3g"` or `"2g"`
2. **Increase Timeout** - Backend checks show timeouts set to 35s for auth on mobile (should be enough)
3. **Check Backend** - Make sure backend is running and responding
4. **Railway Cold Start** - If on Railway, first request after idle may take 30-45 seconds

### Issue 3: Token Stored But Not Sent in Requests

**Root Cause**:
- Token not being retrieved from storage
- Authorization header not being set
- Headers being stripped by mobile proxy

**Fix**:

1. **Check Storage** - Console should show:
   ```
   ✅ Token retrieved from localStorage
   OR ⚠️ Token retrieved from sessionStorage (localStorage unavailable)
   OR ⚠️ Token retrieved from memory (storage unavailable - will be lost on refresh)
   ```

2. **Check Headers Sent** - Look for Authorization header in every request:
   ```javascript
   headers: {
     Authorization: "Bearer eyJhbGc..."  // Should be present
   }
   ```

3. **Clear Storage and Re-login**:
   ```javascript
   // In browser console:
   localStorage.clear();
   sessionStorage.clear();
   window.location.reload();
   ```

### Issue 4: iOS Private Mode Login Fails

**Root Cause**:
- iOS private browsing disables localStorage
- Cookie with `httpOnly: true` can't be stored in private mode on some versions

**Fix**:

1. **Already Implemented** - Code now has fallback:
   - Try localStorage first
   - Fall back to sessionStorage
   - Fall back to in-memory token

2. **User Notice** - Show message: "Private browsing mode has limited storage. Logout when done."

### Issue 5: Login Works on Emulator but Not Real Device

**Root Cause**:
- Emulator uses desktop network (no proxy/firewall)
- Real device might be on corporate WiFi with proxy
- Real device might have network security policies

**Fix**:

1. **Add All Necessary Headers** - Already done in frontend code
2. **Use HTTPS Even in Dev** - If possible, test with HTTPS
3. **Whitelist on Corporate Network** - Ask IT to whitelist your API domain
4. **VPN Issues** - Try without VPN if testing

---

## Advanced Debugging

### View All Network Requests

#### On Android (Chrome)
1. Open `chrome://inspect`
2. Click "inspect"
3. Go to Network tab
4. Reload and try login
5. Check each request status code and headers

#### On iOS (Safari)
1. In Safari Develop menu
2. Select your device/app
3. Console should show request details

### Manual API Test on Mobile

Open mobile browser console and run:

```javascript
// Test API connectivity
const testApi = async () => {
  try {
    const response = await fetch('https://api.crwdctrl.in/api/users/validate', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crwdctrl_token')}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', {
      'Content-Type': response.headers.get('Content-Type'),
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin')
    });
    
    const data = await response.json();
    console.log('Data:', data);
  } catch (error) {
    console.error('Error:', error);
  }
};

testApi();
```

### Environment Variable Check

On mobile, check if API URL is properly configured:

```javascript
// In browser console:
console.log('API Config:', {
  base: import.meta.env.VITE_API_BASE_URL,
  prod: import.meta.env.PROD,
  mode: import.meta.env.MODE
});
```

Should show:
```javascript
API Config: {
  base: "https://api.crwdctrl.in",  // ✅ Should be HTTPS
  prod: true,  // ✅ In production
  mode: "production"
}
```

---

## Production Deployment Checklist

- [ ] **VITE_API_BASE_URL** set to production HTTPS URL
- [ ] **Production domain** added to Firebase authorized domains
- [ ] **Production domain** added to backend CORS whitelist
- [ ] **HTTPS enforced** (no mixed content)
- [ ] **JWT_SECRET** set in backend environment
- [ ] **NODE_ENV=production** in backend
- [ ] **Database connection** verified
- [ ] **Email service** configured (if needed)
- [ ] **Tested on real Android device**
- [ ] **Tested on real iOS device**
- [ ] **Tested with slow network** (3G/2G)
- [ ] **Tested with offline device**
- [ ] **Tested in iOS private mode**

---

## Quick Debugging Command

Copy-paste in mobile browser console to see all auth info:

```javascript
console.clear();
console.log('=== AUTH DEBUG INFO ===');
console.log('Token in localStorage:', !!localStorage.getItem('crwdctrl_token'));
console.log('Token in sessionStorage:', !!sessionStorage.getItem('crwdctrl_token'));
console.log('Token in memory:', !!window._crwdctrl_auth_token);
console.log('Device online:', navigator.onLine);
console.log('User Agent:', navigator.userAgent.substring(0, 100));
console.log('API Base:', import.meta.env.VITE_API_BASE_URL);
console.log('Production Mode:', import.meta.env.PROD);
console.log('=== END DEBUG ===');
```

---

## Reporting Mobile Issues

If you find a mobile-specific issue, please include:

1. **Device Info**:
   - Device (Samsung Galaxy S21, iPhone 13, etc.)
   - OS Version (Android 12, iOS 15, etc.)
   - Browser (Chrome, Safari, Edge, etc.)

2. **Network Info**:
   - Connection type (WiFi, 4G/LTE, 3G)
   - Whether using VPN

3. **Error Screenshots**:
   - Full browser console error messages
   - Any error dialog shown to user

4. **Logs**:
   - Copy entire console output with 🔴 errors
   - Include the full API request/response details

5. **Reproduction Steps**:
   - Exact steps to reproduce the issue
   - Whether it works on desktop browser

---

## Summary of Fixes

This update fixed these mobile-specific issues:

1. ✅ **CORS Preflight Cache Pollution** - Added `Vary: Origin` header
2. ✅ **Mixed Content Blocking** - Enforced HTTPS in production
3. ✅ **Cookie SameSite Issues** - Set proper `SameSite=None; Secure` flags
4. ✅ **localStorage Unavailable** - Fallback to sessionStorage, then memory
5. ✅ **Headers Stripped by Proxy** - Added robust headers and error detection
6. ✅ **Network Proxy Caching** - Added cache-control headers
7. ✅ **Authorization Header Not Sent** - Ensured all requests include Authorization
8. ✅ **API URL Misconfiguration** - Added validation and error logging
9. ✅ **No Network Error Detection** - Check `navigator.onLine` before requests
10. ✅ **Insufficient Mobile Logging** - Added detailed request/response/header logging

All these fixes work transparently - no changes needed to frontend code using the API!

