# Firebase Authentication - Domain Configuration Guide

## All Domains Required in Firebase

### Production Domains

#### 1. Main Frontend Domain
```
https://www.crwdctrl.in
https://crwdctrl.in
```

#### 2. API Domain (for OAuth callbacks)
```
https://api.crwdctrl.in
```

#### 3. Localhost Development
```
http://localhost:3000
http://localhost:3001
http://127.0.0.1:3000
http://127.0.0.1:3001
```

---

## Firebase Console Setup

### Step 1: Go to Firebase Console
1. Open https://console.firebase.google.com
2. Select your project
3. Go to **Authentication** → **Settings** → **Authorized domains**

### Step 2: Add All Required Domains

#### Production Domains (Add These)
```
www.crwdctrl.in
crwdctrl.in
api.crwdctrl.in
```

#### Development Domains (Add These)
```
localhost
127.0.0.1
```

**Firebase automatically allows:**
- localhost
- 127.0.0.1
- Your Firebase hosting domain (if using)

---

## Google OAuth Configuration

### Step 1: Go to Google Cloud Console
1. Open https://console.cloud.google.com
2. Select your project
3. Go to **APIs & Services** → **Credentials**

### Step 2: Find OAuth 2.0 Client ID
1. Find "Web application" credential
2. Click edit

### Step 3: Add Authorized Redirect URIs

#### Production URIs
```
https://www.crwdctrl.in/login
https://crwdctrl.in/login
https://api.crwdctrl.in/auth/google-signin
```

#### Development URIs
```
http://localhost:3000/login
http://localhost:3001/login
http://127.0.0.1:3000/login
http://127.0.0.1:3001/login
```

### Step 4: Add Authorized JavaScript Origins

#### Production
```
https://www.crwdctrl.in
https://crwdctrl.in
https://api.crwdctrl.in
```

#### Development
```
http://localhost:3000
http://localhost:3001
http://127.0.0.1:3000
http://127.0.0.1:3001
```

### Step 5: Save Changes
- Click **Save**
- Copy Client ID for frontend configuration

---

## Frontend Configuration

### Firebase Config File
```typescript
// firebase.config.ts
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "...",
};
```

### Google OAuth Redirect URL
```
// For production: https://www.crwdctrl.in
// For development: http://localhost:3000
// For API: https://api.crwdctrl.in
```

---

## Backend Configuration

### Firebase Admin SDK
```javascript
// firebaseConfig.js
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "your-project-id",
});
```

### Token Verification Domains
```
No additional config needed - works for all domains
```

---

## Domain List Summary

| Domain | Purpose | Type | Required |
|--------|---------|------|----------|
| www.crwdctrl.in | Main frontend | Production | ✅ YES |
| crwdctrl.in | Redirect to www | Production | ✅ YES |
| api.crwdctrl.in | Backend API | Production | ✅ YES |
| localhost | Development | Dev | ✅ YES |
| 127.0.0.1 | Development | Dev | ✅ YES |

---

## Firebase Authorized Domains (Current List)

### To View Current Domains
1. Firebase Console → Authentication → Settings
2. Scroll to "Authorized domains"
3. You should see:

```
localhost (automatic)
127.0.0.1 (automatic)
www.crwdctrl.in (add manually)
crwdctrl.in (add manually)
api.crwdctrl.in (add manually)
```

---

## Google Cloud OAuth Domains

### Authorized JavaScript Origins
```
https://www.crwdctrl.in
https://crwdctrl.in
https://api.crwdctrl.in
http://localhost:3000
http://localhost:3001
http://127.0.0.1:3000
http://127.0.0.1:3001
```

### Authorized Redirect URIs
```
https://www.crwdctrl.in/login
https://crwdctrl.in/login
https://api.crwdctrl.in/auth/google-signin
http://localhost:3000/login
http://localhost:3001/login
http://127.0.0.1:3000/login
http://127.0.0.1:3001/login
```

---

## Step-by-Step Setup Instructions

### Step 1: Firebase Console
```
1. Go to https://console.firebase.google.com
2. Click your project
3. Click Authentication (left menu)
4. Click Settings (top menu)
5. Go to "Authorized domains" tab
6. Click "Add domain"
7. Enter: www.crwdctrl.in
8. Click Add
9. Repeat for: crwdctrl.in, api.crwdctrl.in
```

### Step 2: Google Cloud Console
```
1. Go to https://console.cloud.google.com
2. Click your project (same Firebase project)
3. Go to APIs & Services → Credentials
4. Find OAuth 2.0 Client ID (Web application)
5. Click Edit
6. Add JavaScript Origins:
   - https://www.crwdctrl.in
   - https://crwdctrl.in
   - https://api.crwdctrl.in
   - http://localhost:3000
   - http://127.0.0.1:3000
7. Add Authorized redirect URIs:
   - https://www.crwdctrl.in/login
   - https://crwdctrl.in/login
   - https://api.crwdctrl.in/auth/google-signin
   - http://localhost:3000/login
   - http://127.0.0.1:3000/login
8. Click Save
```

---

## Testing Each Domain

### Test Production Frontend
```bash
# Frontend auth should work
curl -I https://www.crwdctrl.in/login

# OAuth redirect should work
# Visit https://www.crwdctrl.in/login
# Click "Sign in with Google"
# Should redirect to Google login
```

### Test Redirect Domain
```bash
# Should redirect to main domain
curl -I https://crwdctrl.in/login

# Should show same content as www.crwdctrl.in
```

### Test API Domain
```bash
# API should accept requests from this domain
curl -X POST https://api.crwdctrl.in/api/auth/google-signin \
  -H "Content-Type: application/json" \
  -d '{"idToken":"...","email":"user@example.com"}'
```

### Test Development Localhost
```bash
# Frontend at localhost
npm start  # http://localhost:3000

# OAuth should work
# Visit http://localhost:3000/login
# Click "Sign in with Google"
# Should complete OAuth flow
```

---

## Troubleshooting

### Error: "Origin Mismatch"
**Problem**: Firebase throws origin mismatch error
**Solution**: Add domain to Firebase Authorized domains list
```
Go to Firebase Console → Authentication → Settings → Authorized domains
Add the missing domain
```

### Error: "Redirect URI Mismatch"
**Problem**: Google OAuth returns redirect URI mismatch
**Solution**: Add URI to Google Cloud Console
```
Go to Google Cloud Console → Credentials → Edit OAuth Client
Add the redirect URI to "Authorized redirect URIs"
Format: https://domain.com/path/to/oauth/callback
```

### Error: "Invalid Client ID"
**Problem**: Frontend can't authenticate
**Solution**: Check Firebase Config
```typescript
// Verify in frontend config:
const firebaseConfig = {
  apiKey: "...", // Should not be empty
  authDomain: "your-project.firebaseapp.com", // Should match project
  projectId: "...", // Should match Google Cloud project
};
```

### OAuth Works on Localhost but not Production
**Problem**: Localhost works, production fails
**Solution**: Add production domains to both Firebase and Google Cloud
```
Firebase: https://www.crwdctrl.in
Google: https://www.crwdctrl.in + redirect URI
```

### OAuth Works on Desktop but not Mobile
**Problem**: Desktop works, mobile fails
**Solution**: Ensure mobile domains are configured
```
Firebase: Check "Authorized domains" includes all variants
Google: Check JavaScript origins include all domains
```

---

## Complete Domain Checklist

### Firebase Console (Authentication → Settings → Authorized domains)
- [ ] www.crwdctrl.in
- [ ] crwdctrl.in
- [ ] api.crwdctrl.in
- [ ] localhost (automatic)
- [ ] 127.0.0.1 (automatic)

### Google Cloud Console (APIs & Services → Credentials → OAuth Client)

**Authorized JavaScript Origins:**
- [ ] https://www.crwdctrl.in
- [ ] https://crwdctrl.in
- [ ] https://api.crwdctrl.in
- [ ] http://localhost:3000
- [ ] http://127.0.0.1:3000

**Authorized Redirect URIs:**
- [ ] https://www.crwdctrl.in/login
- [ ] https://crwdctrl.in/login
- [ ] https://api.crwdctrl.in/auth/google-signin
- [ ] http://localhost:3000/login
- [ ] http://127.0.0.1:3000/login

### Environment Variables (.env files)
- [ ] FRONTEND_URL=https://www.crwdctrl.in
- [ ] REACT_APP_API_URL=https://api.crwdctrl.in
- [ ] Firebase config updated

---

## Final Verification

```bash
# 1. Test Firebase Auth on production
curl -X POST https://api.crwdctrl.in/api/auth/google-signin

# 2. Test on frontend
# Visit https://www.crwdctrl.in/login
# Click "Sign in with Google"
# Should complete OAuth without errors

# 3. Test on mobile
# Visit https://www.crwdctrl.in/login on real device
# Click "Sign in with Google"
# Should work on Android and iOS

# 4. Test in Instagram
# Open Instagram app
# Click login link
# Should complete OAuth in WebView
```

✅ All domains configured and verified!
