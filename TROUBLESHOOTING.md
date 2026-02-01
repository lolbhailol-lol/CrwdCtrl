# Troubleshooting Guide - Login Issues

## Mobile Login Not Working

### Check 1: Browser Compatibility
- **Symptom**: Login works on desktop but not mobile
- **Check**: Is it a real device or DevTools?
  - DevTools mobile view hides real mobile issues
  - **Always test on real device**

### Check 2: CORS Error
- **Symptom**: `No 'Access-Control-Allow-Credentials' header`
- **Solution**:
  ```javascript
  // Backend corsConfig.js should have:
  credentials: true
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true); // Allow mobile (no origin)
    }
  }
  ```
- **Verify**: Backend `.env` has `FRONTEND_URL` set

### Check 3: Cookies Not Stored
- **Symptom**: Token received but lost on reload
- **Check Frontend Console**:
  ```
  [Login] Token stored in localStorage ✅
  OR
  [Login] localStorage unavailable, using sessionStorage ✅
  ```
- **Check Backend Logs**:
  ```
  [Auth/Login] Success for mobile client
  ```
- **Solution**:
  - Verify `domain` in cookieConfig.js
  - Check `SameSite` is `lax` (not `strict`)
  - Ensure `secure: false` on localhost

### Check 4: Authorization Header Missing
- **Symptom**: 401 Unauthorized on protected endpoints
- **Check Frontend Network Tab**:
  - Request headers should include `Authorization: Bearer <token>`
  - Should include `X-Client-Type: mobile`
- **Solution**:
  ```typescript
  // authService.ts request interceptor
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  ```

---

## Instagram/Facebook In-App Browser Issues

### Check 1: Popup Not Opening
- **Symptom**: Nothing happens when clicking sign-in
- **Cause**: Instagram blocks popups completely
- **Solution**: 
  ```typescript
  // Should use redirect, not popup
  if (isInstagramBrowser()) {
    await signInWithRedirect(auth, provider);
  }
  ```

### Check 2: Instagram Cookies Not Saved
- **Symptom**: Cookies rejected by Instagram
- **Check Backend Logs**:
  ```
  [Auth/GoogleSignIn] INSTAGRAM OAuth:
  ```
- **Solution**:
  ```javascript
  // cookieConfig.js for Instagram
  sameSite: 'none',
  secure: true, // MUST be true for SameSite=None
  ```

### Check 3: Redirect Result Lost
- **Symptom**: Instagram OAuth completes but user not logged in
- **Check Frontend Console**:
  ```
  [LoginPage] Checking for redirect result...
  [LoginPage] Redirect result found ✅
  OR
  [LoginPage] No redirect result ❌
  ```
- **Solution**:
  ```typescript
  // LoginPage.tsx useEffect should handle redirect
  const result = await googleAuthService.initializeRedirectResult();
  if (result) {
    // Complete login
  }
  ```

---

## OAuth Redirect Issues

### Check 1: Redirect Happens But User Stays on Login
- **Symptom**: Redirect route reached but navigation fails
- **Check Frontend Console**:
  ```
  [LoginPage] Backend auth successful, redirecting
  OR
  [LoginPage] Redirect error: ...
  ```
- **Solution**: 
  - Check token is actually stored
  - Verify redirect route exists (`/dashboard`)
  - Check for 100ms delay before redirect

### Check 2: getRedirectResult() Returns Null
- **Symptom**: Redirect happens but no auth result
- **Check**:
  - Is Firebase properly initialized?
  - Does URL contain auth callback code?
  - Check browser console for Firebase errors
- **Solution**:
  ```typescript
  // firebaseConfig.ts
  setPersistence(auth, browserLocalPersistence);
  // Ensures auth state survives redirect
  ```

---

## Network & Connection Issues

### Check 1: Timeout on Mobile
- **Symptom**: Request times out on slow 4G
- **Solution**:
  ```javascript
  // authService.ts
  const apiClient = axios.create({
    timeout: 15000, // Longer timeout for mobile
  });
  ```

### Check 2: Network Error "Failed to fetch"
- **Symptom**: Network request fails completely
- **Check**:
  - Is HTTPS used in production?
  - Is API URL correct? (Check `.env`)
  - Is backend running and accessible?
- **Debug**:
  ```bash
  # Mobile: Use remote debugging
  # iOS: Safari DevTools > Develop > [Device]
  # Android: Chrome DevTools > chrome://inspect
  ```

---

## Storage Issues

### Check 1: localStorage Is Full
- **Symptom**: `QuotaExceededError` in console
- **Check**: 
  - DevTools > Application > LocalStorage
  - Look for large items
- **Solution**: Clear old data or use sessionStorage
  ```typescript
  // Already handled - uses sessionStorage fallback
  ```

### Check 2: Private Browsing Mode
- **Symptom**: Works in normal mode, fails in private
- **Cause**: Private mode restricts localStorage
- **Check Frontend Console**:
  ```
  [Login] localStorage unavailable, using sessionStorage ✅
  ```
- **Note**: Data lost on browser close (expected in private mode)

### Check 3: Token Lost on Redirect
- **Symptom**: OAuth redirect completes but token not found
- **Check Backend Logs**:
  ```
  [Auth/GoogleSignIn] Success for mobile client
  ```
- **Check Frontend**:
  ```typescript
  // googleAuthService.ts
  // Store in both localStorage and sessionStorage
  localStorage.setItem('authToken', token);
  sessionStorage.setItem('authToken', token);
  ```

---

## Debugging Checklist

### Frontend Debugging
```javascript
// Open console and run:
console.log({
  token: localStorage.getItem('authToken'),
  sessionToken: sessionStorage.getItem('authToken'),
  isMobile: /Android|iPhone/.test(navigator.userAgent),
  touchSupport: navigator.maxTouchPoints > 0,
  userAgent: navigator.userAgent,
});
```

### Backend Debugging
```bash
# Check logs for mobile client
grep "MOBILE\|mobile" backend.log

# Check CORS headers
curl -i -X OPTIONS http://localhost:8080/api/auth/login \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"

# Should include: Access-Control-Allow-Credentials: true
```

### Network Debugging
1. Open DevTools Network tab
2. Perform login
3. Look for:
   - ✅ Authorization header in request
   - ✅ Set-Cookie in response
   - ✅ 200 OK status (not 401/403)
   - ✅ Token in response body

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `No 'Access-Control-Allow-Credentials' header` | CORS not allowing credentials | Add `credentials: true` to CORS config |
| `The given token has invalid signature` | Invalid Firebase token | Check idToken is valid |
| `operation-not-supported-in-this-environment` | Popup blocked or unsupported | Use redirect flow instead |
| `Quota exceeded` | Storage full or private mode | Use sessionStorage fallback |
| `401 Unauthorized` | Missing Authorization header | Check token in request header |
| `Network request failed` | Backend unreachable or CORS issue | Check API URL and CORS config |

---

## Contact Support

If issues persist:
1. Collect frontend console logs
2. Collect backend server logs
3. Check browser DevTools Network tab
4. Include device type (Android/iOS/Instagram)
5. Run debugging checklist above
6. Report with reproducible steps
