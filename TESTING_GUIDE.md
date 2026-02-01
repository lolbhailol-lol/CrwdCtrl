# Testing Guide - Login System

## Quick Test (5 minutes)

### Test 1: Desktop Email/Password
1. Open http://localhost:3000/login
2. Enter email and password
3. Click "Login"
4. ✅ Should redirect to /dashboard
5. ✅ Token should appear in localStorage
6. ✅ Refresh page - still logged in

### Test 2: Desktop Google OAuth
1. Click "Sign in with Google"
2. ✅ Popup should open
3. Select Google account
4. ✅ Popup should close
5. ✅ Should redirect to /dashboard

### Test 3: Mobile (Real Device)
1. Navigate to http://<your-ip>:3000/login on Android/iOS
2. Enter email and password
3. ✅ Should redirect to /dashboard
4. ✅ Check Network tab - no CORS errors
5. ✅ Refresh page - still logged in

---

## Comprehensive Test Suite

### Email/Password Login

#### Desktop
```bash
# Expected: Success
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Client-Type: desktop" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Response should include:
# { "success": true, "token": "...", "user": {...} }
```

#### Mobile
```bash
# Expected: Success (same as desktop)
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Client-Type: mobile" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

#### Instagram
```bash
# Expected: Success with Instagram cookie settings
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Client-Type: instagram" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Response headers should include:
# Set-Cookie: authToken=...; SameSite=None; Secure
```

---

### Google OAuth Testing

#### Desktop (Popup)
- [ ] Click "Sign in with Google"
- [ ] Popup opens
- [ ] Google login screen appears
- [ ] Select account or login
- [ ] Popup closes automatically
- [ ] Redirected to /dashboard
- [ ] Check Network tab for /api/auth/google-signin call
- [ ] Response includes token

#### Mobile (Redirect)
- [ ] Click "Sign in with Google" on real Android/iOS
- [ ] Page redirects to Google login
- [ ] Complete Google authentication
- [ ] Page redirects back to app
- [ ] Loading shows "Processing sign-in..."
- [ ] Redirected to /dashboard
- [ ] Check console for [OAuth] logs

#### Instagram (Redirect)
- [ ] Open Instagram app
- [ ] Navigate to login link (opens in-app browser)
- [ ] Click "Sign in with Google"
- [ ] Google auth flow in WebView
- [ ] Redirected back to app
- [ ] Successfully logged in

---

### Storage Testing

#### localStorage Test
```javascript
// In browser console
localStorage.setItem('authToken', 'test-token');
console.log(localStorage.getItem('authToken')); // Should print: test-token
localStorage.removeItem('authToken');
```

#### sessionStorage Fallback
```javascript
// Test localStorage failure
Object.defineProperty(window, 'localStorage', {
  value: {
    setItem: () => { throw new Error('QuotaExceededError') }
  }
});

// Now try login - should fall back to sessionStorage
```

#### Token Persistence
1. Login successfully
2. Open DevTools > Application > Storage
3. Check localStorage for 'authToken'
4. Refresh page (F5)
5. ✅ Token still present
6. ✅ Still logged in

---

### CORS Testing

#### Preflight Request
```bash
# Test OPTIONS request
curl -i -X OPTIONS http://localhost:8080/api/auth/login \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"

# Response should include:
# Access-Control-Allow-Credentials: true
# Access-Control-Allow-Origin: http://localhost:3000
# Access-Control-Allow-Methods: POST
# Access-Control-Allow-Headers: Content-Type
```

#### Mobile Origin (No Origin Header)
```bash
# Some mobile requests have no origin
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Should succeed (backend allows no origin)
```

---

### Error Handling

#### Invalid Credentials
1. Login with wrong password
2. ✅ Error message: "Invalid email or password"
3. ✅ Not redirected
4. ✅ Can retry

#### Missing Fields
1. Leave email empty
2. Click Login
3. ✅ Browser validation (required attribute)
4. Try with API:
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{}'

# Response: 400 Bad Request
# Message: "Email and password required"
```

#### Network Timeout
1. Disconnect internet
2. Try to login
3. ✅ Error after 15 seconds
4. ✅ Error message shown
5. Can retry when connected

#### Invalid Token
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Response: 401 Unauthorized
```

---

### Device-Specific Testing

#### Android Chrome
- [ ] Login works
- [ ] Cookies stored
- [ ] Redirect works
- [ ] No CORS errors
- [ ] Persists on reload

#### Android Firefox
- [ ] Same as Chrome
- [ ] Check localStorage

#### iOS Safari
- [ ] Login works
- [ ] Check Network tab
- [ ] Private mode: sessionStorage only
- [ ] Normal mode: localStorage

#### iOS Chrome
- [ ] Same as Safari
- [ ] Chrome uses WebKit on iOS

#### Instagram (Android)
- [ ] In-app browser login works
- [ ] Redirect OAuth works
- [ ] Token persists

#### Instagram (iOS)
- [ ] Same as Android
- [ ] Same WebView engine

#### Facebook App
- [ ] Same behavior as Instagram
- [ ] Uses same WebView

---

### Browser DevTools Testing

#### Console
```javascript
// Check for errors
console.log('✅ No errors in console');

// Check logs
// [Login] Starting login flow
// [Login] Token stored in localStorage
// [Login] Login successful
```

#### Network Tab
1. Open DevTools > Network
2. Login
3. Check request to /api/auth/login:
   - [x] Method: POST
   - [x] Status: 200 OK
   - [x] Headers include Authorization (if token exists)
   - [x] Headers include X-Client-Type
4. Check response:
   - [x] Status: 200
   - [x] Body includes token
   - [x] Set-Cookie header present

#### Storage Tab
1. Open DevTools > Application > Storage
2. After login:
   - [x] localStorage contains authToken
   - [x] Cookies show authToken cookie
3. After logout:
   - [x] localStorage authToken removed
   - [x] Cookie cleared

---

### Load Testing

#### Single User
- [ ] Login works
- [ ] Token stored
- [ ] Redirect works

#### Multiple Tabs
1. Open login in tab 1
2. Login successfully
3. Open new tab 2
4. Navigate to /dashboard
5. ✅ Both tabs show dashboard (same token in localStorage)

#### Multiple Users
1. User A: Open incognito window, login
2. User B: Open normal window, login
3. ✅ Both have different tokens
4. ✅ No cross-contamination

---

### Production Checklist

Before deploying to production:

- [ ] Tested on real Android device
- [ ] Tested on real iOS device
- [ ] Tested in Instagram app
- [ ] Tested in Facebook app
- [ ] Tested email/password login
- [ ] Tested Google OAuth
- [ ] Tested token persistence
- [ ] Tested logout
- [ ] Tested error scenarios
- [ ] Verified CORS headers
- [ ] Verified cookie settings
- [ ] Checked environment variables
- [ ] Backend logs clean
- [ ] No console errors
- [ ] Load time acceptable

---

## Automated Testing

### Unit Tests
```typescript
// Example: authService.login()
describe('authService', () => {
  it('should login successfully', async () => {
    const response = await authService.login('user@example.com', 'password');
    expect(response.token).toBeDefined();
    expect(localStorage.getItem('authToken')).toBe(response.token);
  });

  it('should handle login error', async () => {
    await expect(
      authService.login('user@example.com', 'wrong')
    ).rejects.toThrow();
  });
});
```

### E2E Tests
```typescript
// Example: Cypress test
describe('Login Flow', () => {
  it('should login and redirect to dashboard', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type('user@example.com');
    cy.get('input[type="password"]').type('password');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

---

## Troubleshooting

### Login button not working
- [ ] Check console for errors
- [ ] Check Network tab
- [ ] Verify API URL
- [ ] Check backend is running

### CORS errors
- [ ] Check backend corsConfig
- [ ] Verify frontend Origin header
- [ ] Check if credentials: true set

### Token not persisting
- [ ] Check localStorage/sessionStorage
- [ ] Verify cookie domain
- [ ] Check cookie settings (SameSite, Secure)

### OAuth not working
- [ ] Check Firebase config
- [ ] Verify Google credentials
- [ ] Check redirect URL

### Instagram login fails
- [ ] Check browser detection
- [ ] Verify cookie settings (SameSite=None)
- [ ] Check if token in response body

---

## Success Indicators ✅

You've successfully tested when:
- ✅ Desktop email/password login works
- ✅ Desktop Google OAuth works
- ✅ Mobile email/password login works
- ✅ Mobile Google OAuth works
- ✅ Instagram login works
- ✅ Token persists on reload
- ✅ Logout clears token
- ✅ No CORS errors
- ✅ No console errors
- ✅ Performance acceptable
