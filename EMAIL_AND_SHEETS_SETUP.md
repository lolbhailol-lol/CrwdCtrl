# 🔧 EMAIL & GOOGLE SHEETS FIX - ENVIRONMENT VARIABLES REQUIRED

## Problems Identified

1. **Emails Not Sending** - EMAIL_USER and EMAIL_PASS not configured
2. **Google Sheets Not Updating** - GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY not configured

---

## Required Environment Variables for Backend

Add these to your **Railway project environment variables** or **local `.env` file**:

### 1. EMAIL CONFIGURATION (Gmail)

```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
```

**How to Get Gmail App Password:**
1. Go to: https://myaccount.google.com/
2. Left sidebar: **Security**
3. Scroll down: **How you sign in to Google**
4. Turn on **2-Step Verification** (if not already on)
5. Back to Security → Find **App passwords**
6. Select: App = Mail, Device = Windows/Mac/Linux
7. Copy the generated 16-character password
8. Use this as `EMAIL_PASS` (without spaces)

⚠️ **DO NOT use your Gmail password directly!** Use the 16-character App Password.

---

### 2. GOOGLE SHEETS CONFIGURATION

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...[very long string]...-----END PRIVATE KEY-----\n"
```

**How to Get Google Sheets Credentials:**

1. **Create Google Cloud Project**:
   - Go to: https://console.cloud.google.com/
   - Click **Create Project**
   - Name it: `CrwdCtrl` (or similar)
   - Click **Create**

2. **Enable Google Sheets API**:
   - Click **APIs & Services** (left sidebar)
   - Click **Enable APIs and Services**
   - Search for: `Google Sheets API`
   - Click it → Click **Enable**

3. **Create Service Account**:
   - Click **APIs & Services** → **Credentials** (left sidebar)
   - Click **Create Credentials** → **Service Account**
   - **Service account name**: `crwdctrl-sheets`
   - **Service account ID**: `crwdctrl-sheets` (auto-filled)
   - Click **Create and Continue**
   - Click **Create and Continue** again (skip optional steps)
   - Click **Done**

4. **Get Private Key**:
   - In **Service Accounts** list, click the email (`crwdctrl-sheets@...`)
   - Go to **Keys** tab
   - Click **Add Key** → **Create new key**
   - Select **JSON** → **Create**
   - A file downloads automatically (keep it safe!)

5. **Extract Credentials from JSON**:
   - Open the downloaded JSON file
   - Copy the value of `"client_email"` → use as `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - Copy the value of `"private_key"` → use as `GOOGLE_PRIVATE_KEY`

⚠️ **The private key already has `\n` in it** - don't modify it!

6. **Share Google Sheet with Service Account**:
   - Open your Google Sheet
   - Click **Share** (top right)
   - Paste the service account email in "Add people and groups"
   - Give **Editor** permission
   - Click **Share** (you may get "can't send email" - that's ok, click **Share anyway**)

---

## Setting Environment Variables

### Option 1: Railway Dashboard (Production)

1. Go to: https://railway.app/dashboard
2. Select your `prolific-learning-production-13aa` project
3. Click **Variables** tab
4. Add these variables:
   - `EMAIL_USER` = your gmail
   - `EMAIL_PASS` = app password
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = service account email
   - `GOOGLE_PRIVATE_KEY` = private key (paste entire thing including `-----BEGIN...`)
5. Click **Save**
6. Redeploy backend

### Option 2: Local `.env` File (Development)

Create/Edit `backend/.env`:

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password

# Google Sheets Configuration  
GOOGLE_SERVICE_ACCOUNT_EMAIL=crwdctrl-sheets@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n"

# Other existing variables...
MONGODB_URI=your-mongodb-uri
JWT_SECRET=your-secret
NODE_ENV=development
PORT=8080
```

---

## Testing Email Sending

Once configured, test with this endpoint:

1. **Start backend**:
```bash
cd backend
npm run dev
```

2. **Test email** (in browser or Postman):
```
POST http://localhost:8080/api/users/send-test-email
Body: { "email": "your-test-email@gmail.com" }
```

3. **Check console output**:
```
✅ Email transporter configured with: your-email@gmail.com
🎉 Starting welcome email process for: recipient@example.com
📧 Email sent successfully!
```

---

## Testing Google Sheets Integration

Once configured, registrations should auto-sync:

1. Create a test registration in your app
2. Check the console for:
```
🔥🔥🔥 GOOGLE SHEETS FUNCTION CALLED 🔥🔥🔥
📊 Starting Google Sheets integration...
✅ Data appended successfully to Google Sheets
```

3. Open your Google Sheet - new row should appear!

---

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| "Email credentials not configured" | Add EMAIL_USER and EMAIL_PASS to environment |
| "SMTP Error: connect ECONNREFUSED" | Check EMAIL_USER is valid Gmail and EMAIL_PASS is app password |
| "Google service account credentials not configured" | Add GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY |
| "Invalid private key" | Make sure GOOGLE_PRIVATE_KEY starts with `-----BEGIN PRIVATE KEY-----` |
| "Permission denied" | Share Google Sheet with service account email |
| "Invalid spreadsheet ID" | Check Google Sheets URL is correct in fest/competition settings |

---

## Verification Checklist

- [ ] EMAIL_USER set in environment
- [ ] EMAIL_PASS is 16-character app password (not Gmail password)
- [ ] GOOGLE_SERVICE_ACCOUNT_EMAIL set
- [ ] GOOGLE_PRIVATE_KEY set (full private key with newlines)
- [ ] Google Sheets API enabled in Google Cloud
- [ ] Service account created
- [ ] Google Sheets shared with service account email
- [ ] Backend restarted with new environment variables
- [ ] Test email sends successfully
- [ ] Test registration syncs to Google Sheets

---

## Quick Copy-Paste Template

Once you have all values, use this template:

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=XXXX XXXX XXXX XXXX

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=crwdctrl-sheets@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n[copy entire private key]\n-----END PRIVATE KEY-----\n"

# Existing variables
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret
NODE_ENV=production
PORT=8080
```

---

## If You Need Help

Check logs in:
- **Railway**: Dashboard → Logs tab (shows any email/sheets errors)
- **Local**: Terminal where `npm run dev` is running

Look for:
- ❌ Errors starting with "Email credentials"
- ❌ Errors starting with "Google service account"
- ✅ Confirmation messages with "Email sent successfully"
- ✅ Confirmation messages with "Data appended successfully"

