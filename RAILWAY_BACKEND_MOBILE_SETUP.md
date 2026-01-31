# ✅ RAILWAY BACKEND SETUP - MOBILE LOGIN FIX CHECKLIST

## Your Configuration
- **Frontend URL**: Development (localhost:5173)
- **Backend URL**: `https://prolific-learning-production-13aa.up.railway.app/api`
- **Firebase Project**: `crwdctrl`

## Immediate Actions Required

### 1. ✅ Firebase Authorized Domains (CRITICAL)
**Status**: NOT YET DONE - This is why mobile login fails on real devices

1. Go to: https://console.firebase.google.com/
2. Select project: **crwdctrl**
3. Left sidebar: **Authentication**
4. Settings icon (gear) at top → **Settings** tab
5. Scroll to **Authorized Domains** section
6. Click **Add Domain** and add:
   - `prolific-learning-production-13aa.up.railway.app`
   - `localhost` (for development)
   - `crwdctrl.in` (if you have custom domain)

**Why**: Firebase OAuth redirects won't work if domain not authorized

### 2. ✅ Backend CORS Configuration
**Status**: ✅ DONE - Just added Railway domain

File: `backend/src/server.js` (line ~53)

Railway domain now in CORS whitelist:
```javascript
const corsOrigins = [
  // ✅ Railway Production
  "https://prolific-learning-production-13aa.up.railway.app",
  ...
];
```

### 3. ✅ Frontend Environment Variable
**Status**: ✅ ALREADY SET

File: `frontend/.env` (line 2)
```
VITE_API_BASE_URL=https://prolific-learning-production-13aa.up.railway.app/api
```

---

## Deployment Steps

1. **Deploy Backend**:
   ```bash
   cd backend
   git add .
   git commit -m "Add Railway domain to CORS whitelist"
   git push
   # Wait for Railway to auto-deploy
   ```

2. **Deploy Frontend**:
   ```bash
   cd frontend
   git add .
   git commit -m "Mobile login fixes with Railway backend"
   git push
   # Wait for Vercel to auto-deploy
   ```

3. **Add Firebase Domain** (do this on Firebase Console):
   - Cannot be done from code
   - Must be done manually in Firebase Console

---

## Testing on Mobile After Deployment

### Android Device
1. Connect via USB
2. Open Chrome → `chrome://inspect`
3. Click **inspect** next to your app
4. Go to **Console** tab
5. Try login and look for:

```
✅ Token retrieved from localStorage
🟢 Network: ONLINE
📤 API Request: {
  url: "https://prolific-learning-production-13aa.up.railway.app/api/users/social-auth",
  headers: { Authorization: "Bearer..." },
  isMobile: true
}
📥 API Response: { status: 200 }
✅ API Success
```

### iOS Device
1. Connect to Mac via USB
2. Safari → Develop → [Your iPhone]
3. Try login and check console for same logs

### If You See CORS Error
```
"Unable to connect to server. CORS error detected. Check API configuration"
```

**Solutions** (in order):
1. Check Firebase Console → Authentication → Settings → Authorized Domains
   - Must include: `prolific-learning-production-13aa.up.railway.app`
2. Check backend deployed with CORS changes
3. Clear mobile browser cache (Settings → Clear browsing data)
4. Hard refresh on mobile (Ctrl+Shift+R or Cmd+Shift+R)

---

## Database Connection Verification

Your Railway backend connects to MongoDB. Make sure:

1. **MongoDB URI Set**: `process.env.MONGODB_URI` should be set in Railway
2. **Test Connection**: Backend logs should show:
   ```
   ✅ MongoDB Connected
   ```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Mobile shows "CORS error" | Add domain to Firebase authorized domains |
| Mobile shows "Unable to connect" | Verify Railway backend is running |
| Desktop works, mobile fails | This is normal without the fixes - now should work |
| Token saved but 401 error | Authorization header not being sent - check console logs |
| Works on WiFi but not mobile data | Proxy is interfering - all fixes now handle this |

---

## Key Points

✅ **Your API URL is correct**: `https://prolific-learning-production-13aa.up.railway.app/api`
✅ **HTTPS enforced**: Good for mobile security
✅ **Backend CORS updated**: Railway domain now whitelisted
✅ **Frontend env configured**: API URL already set

⚠️ **Critical Next Step**: Add Railway domain to Firebase authorized domains (manually in Console)

---

## Deployment Order

1. First: Deploy backend (CORS changes)
2. Then: Deploy frontend (mobile fixes)
3. Finally: Add Firebase domain (manual Firebase Console)
4. Test: Try login on real Android + iOS devices

---

## Questions?

Check the detailed guides:
- `MOBILE_LOGIN_FIXES_DEBUGGING_GUIDE.md` - How to debug on mobile
- `MOBILE_LOGIN_FIXES_SUMMARY.md` - Technical details
- `MOBILE_LOGIN_FIXES_CODE_REFERENCE.md` - Exact code changes

