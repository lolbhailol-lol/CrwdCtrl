# 🔧 ORGANIZER EMAIL NOT WORKING - DIAGNOSTIC & FIX GUIDE

## Problem
Organizer emails are not being sent when users register. The email service is falling back to test mode (Ethereal).

## Root Cause
**Missing environment variables in Railway:**
- `EMAIL_USER` - NOT SET
- `EMAIL_PASS` - NOT SET

When these are missing, the system uses a test email service instead of real Gmail SMTP.

---

## Verification Steps

### 1. Check if EMAIL_USER and EMAIL_PASS are set in Railway

Go to: **Railway Dashboard** → Your Project → **Variables** tab

Look for:
- ✅ `EMAIL_USER` - Should show your Gmail address
- ✅ `EMAIL_PASS` - Should show your 16-character app password
- ❌ If missing → That's the problem!

### 2. Check Backend Logs in Railway

Go to: **Railway Dashboard** → Your Project → **Logs** tab

Search for these messages:
- ❌ If you see: `⚠️ WARNING: Email credentials (EMAIL_USER/EMAIL_PASS) not configured!`
- ❌ Then email is NOT working

- ✅ If you see: `✅ Email transporter configured with: your-email@gmail.com`
- ✅ Then email SHOULD be working

### 3. Test Email Manually

Once you've added the environment variables:

1. Restart Railway deployment
2. Go to backend logs and check for: `✅ Email transporter configured with:`
3. Create a test registration
4. Check logs for: `✅ Organizer notification email sent successfully:`

---

## Solution: Add Environment Variables to Railway

### Step 1: Prepare Your Credentials

**Gmail App Password:**
- Go to: https://myaccount.google.com/apppasswords
- Select App: **Mail** | Device: **Windows PC** (or your device)
- Copy the 16-character password (example: `abcd efgh ijkl mnop`)

**Service Account Email (for Google Sheets):**
- Already have from Google Cloud setup
- Format: `crwdctrl-sheets@project-id.iam.gserviceaccount.com`

**Private Key (for Google Sheets):**
- Copy from downloaded JSON file
- Already includes `\n` for newlines

### Step 2: Add to Railway Dashboard

1. Go to: https://railway.app/dashboard
2. Select your `prolific-learning-production-13aa` project
3. Click **Variables** tab
4. Add these variables (copy-paste exactly):

```
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
GOOGLE_SERVICE_ACCOUNT_EMAIL=crwdctrl-sheets@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...[paste entire key]...\n-----END PRIVATE KEY-----\n"
```

5. Click **Save**
6. Railway automatically redeploys with new variables

### Step 3: Verify it Worked

Wait 2-3 minutes for restart, then:

1. Check **Logs** tab for: `✅ Email transporter configured with:`
2. Create a test registration
3. Check organizer email received

---

## Code Locations (Reference)

**Email Service Setup:**
- File: [backend/src/services/emailService.js](backend/src/services/emailService.js#L5)
- Lines 5-35: Email transporter creation (checks EMAIL_USER/EMAIL_PASS)
- Lines 465-485: Organizer notification email function

**Registration Controller:**
- File: [backend/src/controllers/registrationController.js](backend/src/controllers/registrationController.js#L378)
- Line 378-395: Calls sendOrganizerNotificationEmail

**Organizer Email Sent When:**
- New user registers for a fest
- New user registers for a competition
- User completes registration form

---

## Quick Checklist

- [ ] Go to myaccount.google.com → App passwords → Get Gmail app password
- [ ] Go to Railway Dashboard → Variables
- [ ] Add `EMAIL_USER` with Gmail address
- [ ] Add `EMAIL_PASS` with 16-char app password
- [ ] Save variables
- [ ] Wait 2-3 minutes for Railway to restart
- [ ] Check logs for: `✅ Email transporter configured with:`
- [ ] Test by creating a registration
- [ ] Verify organizer receives email

---

## If Still Not Working

**Check these in order:**

1. **Is EMAIL_USER a real Gmail address?**
   - Should be: `yourname@gmail.com` (not Yahoo, Outlook, etc.)

2. **Is EMAIL_PASS the 16-character App Password?**
   - NOT your Gmail password
   - Should be format: `abcd efgh ijkl mnop`
   - Get from: https://myaccount.google.com/apppasswords

3. **Did Railway restart?**
   - Check Deployments tab - should show new deployment after saving variables
   - Wait for status to change from "Building" to "Success"

4. **Check organizer email in database:**
   - The organizer email field must not be empty
   - It's stored in: `fest.registration.organizerEmail`

5. **Check Firebase Domain Whitelist:**
   - Firebase → Authentication → Settings → Authorized domains
   - Must include your Railway domain for OAuth redirect

6. **Check logs for specific error:**
   - Railway Logs tab → search for "error" or "failed"
   - Look for SMTP authentication errors

---

## Email Flow Diagram

```
User Registration
        ↓
Calls: sendOrganizerNotificationEmail(organizerEmail, ...)
        ↓
createTransporter() checks EMAIL_USER & EMAIL_PASS
        ↓
If SET:     Uses Gmail SMTP → ✅ Email sent
If NOT SET: Uses Ethereal Test → ❌ Email NOT sent
        ↓
Logs: "✅ Organizer notification email sent successfully" (on success)
      "❌ Organizer notification email sending failed" (on error)
```

---

## Manual Testing

Once variables are set, test with this in backend:

```javascript
// Add to backend test endpoint
const { sendOrganizerNotificationEmail } = require('../services/emailService');

app.post('/api/test-organizer-email', async (req, res) => {
  try {
    const result = await sendOrganizerNotificationEmail(
      'organizer@example.com',
      'Test User',
      'user@example.com',
      'Test Fest',
      'Test Competition',
      'test-id',
      new Date()
    );
    res.json({ success: true, result });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});
```

Then POST to: `http://localhost:8080/api/test-organizer-email`

---

## Summary

**Why organizers aren't receiving emails:**
1. EMAIL_USER and EMAIL_PASS are not set in Railway
2. System defaults to test email (Ethereal) which doesn't actually send
3. Need to add real Gmail credentials to Railway environment variables

**Solution:**
1. Get 16-char Gmail app password from https://myaccount.google.com/apppasswords
2. Add EMAIL_USER and EMAIL_PASS to Railway Variables
3. Save and wait for restart
4. Test by creating a registration

**Time to fix:** 5-10 minutes

