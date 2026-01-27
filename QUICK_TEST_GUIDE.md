# ⚡ QUICK START TESTING GUIDE

## 🚀 Start Servers

### Terminal 1 - Backend
```bash
cd c:\CrwdCtrl-1\backend
npm start
```
**Expected Output:**
```
🚀 Starting FestBuzzZ Backend Server...
✅ Connected to MongoDB
✅ Server running on port 8080
✅ API endpoints registered
```

### Terminal 2 - Frontend
```bash
cd c:\CrwdCtrl-1\frontend
npm run dev
```
**Expected Output:**
```
  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## 🧪 Test Scenarios (Copy-Paste URLs)

### 1. Admin Login Test
**URL**: `http://localhost:5173/admin/login`

**Test Credentials:**
- Email: Check `.env.development` for `ADMIN_EMAIL`
- Password: Check `.env.development` for `ADMIN_PASSWORD`

**Expected Result:**
1. Enter credentials
2. Click "Login"
3. See "Loading..." briefly
4. Redirected to `http://localhost:5173/admin/dashboard`
5. Dashboard loads with stats

**Debug Checklist:**
- [ ] Network tab shows POST to `/admin/login` with 200 status
- [ ] Response includes `accessToken` and `refreshToken`
- [ ] localStorage has `admin_token` and `admin_refresh_token`
- [ ] Console shows "✅ Admin tokens stored successfully"

---

### 2. User Login Test
**URL**: `http://localhost:5173/login`

**Test Flow:**
1. Click on any fest or navigation
2. Click "Login" button
3. Enter test email/password
4. Click "Login with Email"

**Expected Result:**
1. Firebase authentication
2. Backend validation
3. Redirect to dashboard
4. See user profile in navbar

**Debug Checklist:**
- [ ] Network tab shows POST to `/users/login` with 200 status
- [ ] localStorage has `crwdctrl_token` and `crwdctrl_user`
- [ ] Console shows "✅ User tokens stored successfully"

---

### 3. Fest Registration Test
**URL**: `http://localhost:5173/` → Click any Festival

**Test Flow:**
1. Click "Register" button
2. Fill out dynamic registration form
3. Upload payment receipt (any image)
4. Click "Submit Registration"

**Expected Result:**
1. Form submits successfully
2. "Registration successful" message
3. Redirected to confirmation page

**Debug Checklist:**
- [ ] Network tab shows POST to `/registrations/fests/:id/register`
- [ ] Request payload includes all form fields + file
- [ ] Response status is 200-201
- [ ] Console shows "✅ Registration submitted"

---

### 4. Competition Registration Test
**URL**: `http://localhost:5173/competitions` → Click any Competition

**Test Flow:**
1. Click "Register for Competition"
2. Fill dynamic form fields
3. Upload payment screenshot
4. Click "Submit"

**Expected Result:**
1. Form submits successfully
2. "Registration successful" message
3. Data saved to database

**Debug Checklist:**
- [ ] Network shows POST to `/registrations/competitions/:id/register`
- [ ] All form fields included in request
- [ ] Payment screenshot uploaded to Cloudinary
- [ ] Response status 200-201

---

### 5. Admin Fest Creation Test
**URL**: `http://localhost:5173/admin/dashboard` → Click "Create Fest"

**Test Flow:**
1. Fill fest details (name, date, location, etc.)
2. Upload hero image
3. Add competitions
4. Click "Create Fest"

**Expected Result:**
1. Fest created successfully
2. Message: "Fest created successfully"
3. New fest appears in fest list

**Debug Checklist:**
- [ ] Network shows POST to `/admin/fests`
- [ ] Images uploaded to Cloudinary
- [ ] Database entry created
- [ ] Admin can see fest in dashboard

---

## 🔍 Console Debug Logging

### Expected Console Output on Login:

```
🔧 LoginPage - API_BASE_URL: http://localhost:8080/api
🔐 Attempting admin login with email: admin@example.com
🔐 Login response status: 200
🔐 Login response: {success: true, hasAccessToken: true}
✅ Admin tokens stored successfully
🪪 Token check: {hasToken: true, hasRefreshToken: true, tokenExpired: false}
📡 Fetching admin stats with valid token
📡 Stats response status: 200
✅ Stats fetched successfully: {totalUsers: 10, totalFests: 5, ...}
```

### Expected Network Tab Entries:

```
POST /admin/login                 → 200 OK
GET /admin/stats                  → 200 OK
GET /fests/all                    → 200 OK
POST /registrations/fests/:id/register → 201 Created
```

---

## ❌ Troubleshooting

### Problem: "Cannot GET /admin/login"
**Solution**: 
- Make sure frontend is running on port 5173
- Check vite.config.js proxy settings
- Restart frontend dev server

### Problem: "CORS error" in console
**Solution**:
- Backend CORS is already configured for localhost:5173
- Check if backend is running on 8080
- Restart both backend and frontend

### Problem: "401 Unauthorized" on dashboard
**Solution**:
- Check if tokens are in localStorage
- Check if token is expired (decode JWT)
- Try logging in again
- Check admin credentials in .env.development

### Problem: "404 Not Found" on registration
**Solution**:
- Verify API_BASE_URL is set to `http://localhost:8080/api`
- Check if backend route exists: `POST /api/registrations/fests/:id/register`
- Verify request headers include Authorization token
- Check backend logs for route hits

### Problem: File upload fails
**Solution**:
- Check Cloudinary credentials in backend .env
- Verify multer configuration
- Check file size (should be < 10MB)
- Check CORS for file upload endpoint

---

## 📊 API Endpoints Quick Reference

### Public (No Auth)
```
GET http://localhost:8080/api/fests/all
GET http://localhost:8080/api/fests/search?q=tech
GET http://localhost:8080/api/fests/:id/public
GET http://localhost:8080/api/health
GET http://localhost:8080/api/status
```

### Auth Required (Add `Authorization: Bearer <token>` header)
```
POST http://localhost:8080/api/users/login
POST http://localhost:8080/api/users/register
GET http://localhost:8080/api/users/profile
PUT http://localhost:8080/api/users/profile

POST http://localhost:8080/api/registrations/fests/:id/register
POST http://localhost:8080/api/registrations/competitions/:id/register
GET http://localhost:8080/api/registrations/my-registrations
```

### Admin (Add `Authorization: Bearer <admin_token>` header)
```
POST http://localhost:8080/api/admin/login
POST http://localhost:8080/api/admin/refresh-token
GET http://localhost:8080/api/admin/stats
POST http://localhost:8080/api/admin/fests
PUT http://localhost:8080/api/admin/fests/:id
DELETE http://localhost:8080/api/admin/fests/:id
```

---

## 💡 Quick Debug Commands

### Check if backend is running:
```bash
curl http://localhost:8080/api/health
```
Expected: `{"status":"OK",...}`

### Check if frontend is running:
```bash
curl http://localhost:5173/
```
Expected: HTML response (or 404 if page doesn't exist)

### Decode JWT Token (in browser console):
```javascript
const token = localStorage.getItem('admin_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
```

### Check localStorage:
```javascript
console.log(localStorage);
```

---

## ✅ Success Indicators

### Admin Login Success ✅
- [x] Redirected to `/admin/dashboard`
- [x] Dashboard loads with stats
- [x] No 401/403 errors
- [x] Console shows "✅ success" messages
- [x] localStorage has `admin_token`

### User Login Success ✅
- [x] Redirected to dashboard or home
- [x] User name appears in navbar
- [x] No errors in console
- [x] localStorage has `crwdctrl_token`

### Registration Success ✅
- [x] Form submits without errors
- [x] Success message displayed
- [x] Confirmation page shows
- [x] Network shows 200-201 status
- [x] Data appears in admin panel

### Admin Fest Creation Success ✅
- [x] Form submits without errors
- [x] Images upload successfully
- [x] "Fest created" message
- [x] New fest appears in list
- [x] Can edit/delete fest

---

## 🎯 Test Completion Checklist

After running all tests:

- [ ] Admin login works
- [ ] Admin dashboard loads
- [ ] User login works
- [ ] Fest registration works
- [ ] Competition registration works
- [ ] Admin fest creation works
- [ ] File uploads work
- [ ] No 404 errors
- [ ] No CORS errors
- [ ] No auth errors
- [ ] Console is clean (no red errors)
- [ ] All API calls show correct endpoints

**If all ✅**: System is ready for production! 🚀

---

## 🚨 Emergency Contacts

If something doesn't work:

1. **Check console** - Look for error messages
2. **Check Network tab** - Verify API calls
3. **Check localStorage** - Verify token storage
4. **Restart backend** - Kill and restart npm start
5. **Restart frontend** - Kill and restart npm run dev
6. **Clear cache** - Ctrl+Shift+Delete in browser
7. **Check .env files** - Verify env variables are set

Still stuck? Check COMPLETE_SYSTEM_FIX_REPORT.md for detailed debugging.
