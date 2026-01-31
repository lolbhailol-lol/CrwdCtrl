# 🔍 LOGIN ERROR 401 - DIAGNOSTICS & FIX

## Error
```
POST http://localhost:8080/api/users/login 401 (Unauthorized)
Invalid credentials
```

## Root Cause Analysis

The 401 "Invalid credentials" error means **one of these is happening**:

### Option 1: User Doesn't Exist
- You never registered with this email/phone number
- User was registered but deleted or not saved properly
- Email/phone in database doesn't match what you're trying to login with

### Option 2: Password Mismatch
- Password entered during login ≠ password registered
- Passwords are case-sensitive
- Extra spaces in password

### Option 3: Database Issue
- User exists but password hash is corrupted
- Database connection failing
- User model not loading properly

---

## Troubleshooting Steps

### Step 1: Check if Backend is Running

```bash
cd backend
npm run dev
```

Look for messages:
- ✅ `Server running on port 8080`
- ✅ `MongoDB connected`
- ❌ If you see connection errors, backend is NOT running

### Step 2: Check if User Exists in Database

**Option A - Using MongoDB Compass (GUI):**
1. Open MongoDB Compass
2. Connect to your MongoDB database
3. Navigate to: `crwdctrl` (database) → `users` (collection)
4. Search for your email: `{ "email": "your-email@gmail.com" }`
5. Check if user record exists

**Option B - Using MongoDB CLI:**
```bash
# Connect to MongoDB
mongosh "your-connection-string"

# Switch to database
use crwdctrl

# Search for user
db.users.findOne({ email: "your-email@gmail.com" })
```

Expected output should show:
```json
{
  "_id": ObjectId(...),
  "name": "Your Name",
  "email": "your-email@gmail.com",
  "password": "$2a$12$...[hashed]...",  // Should be hashed, not plain text!
  "role": "student",
  ...
}
```

### Step 3: Test Login with Correct Credentials

Make sure you're using:
- ✅ The EXACT email/phone you registered with
- ✅ The EXACT password you used (case-sensitive!)
- ✅ No extra spaces before/after email
- ✅ No accidental CAPS LOCK

### Step 4: Check Backend Logs During Login

When you attempt login, watch the terminal where `npm run dev` is running.

Look for:
```
✅ User found: { email: '...', name: '...' }
✅ Password valid
✅ JWT token generated
```

OR

```
❌ User not found in database
❌ Password does not match
❌ Password comparison failed
```

### Step 5: Test Registration First

If you're not sure if a user exists, **register a new account first**:

1. Go to Registration page
2. Fill in:
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `Password123`
3. Click Register
4. Watch console for: `✅ User registered successfully`
5. Then try to login with same email/password

---

## Backend Login Flow (Debug)

```
Frontend: POST /api/users/login
  Body: { email: "user@example.com", password: "Password123" }
           ↓
Backend: Receives request
           ↓
Step 1: Find user in database by email
  - If NOT found → Return 401 "Invalid credentials"
  - If found → Continue to Step 2
           ↓
Step 2: Compare password using bcrypt
  - If NOT match → Return 401 "Invalid credentials"
  - If match → Continue to Step 3
           ↓
Step 3: Generate JWT token
           ↓
Backend: Return 200 with user data + token
```

If you get 401 at any step, it returns the same generic message for security.

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **"Invalid credentials" but I'm sure I'm using correct password** | User might not be registered. Try registering new account first. |
| **"Invalid credentials" for admin account** | Admin accounts use different endpoint. Check /api/admin/login, not /api/users/login |
| **Registration works but login fails** | Password might not be hashing correctly. Check backend logs for: "Password hashing error" |
| **MongoDB connection failing** | Check MONGODB_URI in .env is correct and database is running |
| **Backend not running** | Run `npm run dev` in backend folder |
| **Frontend can't reach backend** | Check VITE_API_BASE_URL in frontend/.env |

---

## Quick Fix Checklist

- [ ] Backend is running (`npm run dev` in backend folder)
- [ ] MongoDB is running and connected
- [ ] User exists in database (check MongoDB Compass)
- [ ] Password is correct (check registration email to confirm)
- [ ] No extra spaces in email
- [ ] Email is lowercase
- [ ] Password is case-sensitive
- [ ] API base URL is correct (http://localhost:8080/api for local)
- [ ] Network is working (no connection errors)
- [ ] Browser console shows 401, not network error

---

## If Still Not Working

### Debug Mode: Add Logging to Backend

Edit [backend/src/controllers/usercontroller.js](backend/src/controllers/usercontroller.js#L180):

```javascript
const login = async (req, res) => {
    try {
        const { email, phoneNumber, password, firebaseUid } = req.body;
        
        // DEBUG: Log what we received
        console.log('🔐 LOGIN ATTEMPT:');
        console.log('  Email:', email);
        console.log('  Phone:', phoneNumber);
        console.log('  Password length:', password?.length);
        
        // ... rest of code
        
        // DEBUG: After user query
        console.log('🔍 User found:', !!user);
        if (user) {
            console.log('  User email:', user.email);
            console.log('  Has password hash:', !!user.password);
        }
```

Then:
1. Restart backend
2. Attempt login
3. Check backend console for debug output
4. Share the output

### Test API Directly (Postman/Curl)

```bash
curl -X POST http://localhost:8080/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "name": "...", "email": "...", ... },
    "token": "eyJhbG..."
  }
}
```

---

## Summary

**401 "Invalid credentials" typically means:**
1. User doesn't exist (not registered)
2. Password is wrong
3. Email doesn't match exactly what's in database

**To fix:**
1. ✅ Verify backend is running
2. ✅ Verify user exists in MongoDB
3. ✅ Verify exact email/password match
4. ✅ If unsure, register a new test account first
5. ✅ Then login with new account credentials

**Time to fix:** 5 minutes

