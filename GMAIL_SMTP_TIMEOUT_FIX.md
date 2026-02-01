# Fix: Gmail SMTP Connection Timeout in Production

## Problem
✅ **Localhost**: Works fine
❌ **Production (Railway)**: `Connection timeout` error when sending emails

```
Error: Connection timeout
❌ Login confirmation email sending failed!
```

## Root Cause
Railway's network might be blocking or having issues connecting to Gmail SMTP on port 587.

## Solution - Step by Step

### Step 1: Enable "Less Secure Apps" in Gmail
This is the most reliable way to fix Railway SMTP issues:

1. Go to: https://myaccount.google.com/lesssecureapps
2. Sign in with: `karanjadhav0430@gmail.com`
3. Toggle ON: "Allow less secure app access"
4. Click "Save"

⚠️ **Note**: You may need to disable 2-Step Verification temporarily or this option won't appear.

### Step 2: Verify Password Format
The Gmail password must have spaces:
- ❌ Wrong: `imfpwilyjzscquin` (no spaces)
- ✅ Correct: `imfp wily jzsc quin` (with 3 spaces)

Check in Railway Variables that `EMAIL_PASS` is exactly: `imfp wily jzsc quin`

### Step 3: Code Updates (Already Applied)
I've added:
1. ✅ **Password validation** - Logs password length and space check
2. ✅ **Connection timeouts** - 5-minute timeout instead of default
3. ✅ **Retry logic** - Attempts up to 3 times for timeout errors
4. ✅ **Better logging** - Shows exact error and attempt number

### Step 4: Redeploy Backend
After enabling "Less Secure Apps":

1. Go to Railway Dashboard
2. Backend Service → Deployments
3. Click "Redeploy" on the latest deployment
4. Wait 2-3 minutes for redeployment

### Step 5: Test

1. Test login with your account
2. Check Railway logs for:
   ```
   📋 Password length: 19 (should be 19 with spaces)
   📋 Password contains spaces: true
   ✅ Gmail SMTP transporter created successfully
   📤 Sending login confirmation email...
      📨 Attempt 1/3...
   ✅ Login confirmation email sent successfully!
      Accepted: [your-email]
   ```

3. Check your email inbox for the confirmation email

## Alternative: Regenerate Gmail App Password

If "Less Secure Apps" doesn't work:

1. Go to: https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer"
3. Generate new password
4. Copy the 16-character password (with spaces)
5. Update `EMAIL_PASS` in Railway Variables with the new password
6. Redeploy

## Code Changes Made

### emailService.js
- Added password validation logging
- Added connection timeout of 5 minutes
- Added retry logic for timeout errors (3 attempts)
- Enhanced error logging with full error object

## Expected Logs After Fix

```
✅ Email transporter configured with: karanjadhav0430@gmail.com
📋 Password length: 19 (should be 19 with spaces)
📋 Password contains spaces: true
✅ Gmail SMTP transporter created successfully
📤 Sending login confirmation email...
   From: karanjadhav0430@gmail.com
   To: user@example.com
   Subject: ✅ Login Confirmed - CrwdCtrl Account
   📨 Attempt 1/3...
✅ Login confirmation email sent successfully!
   Message ID: <...>
   Response: 250 2.0.0 OK
   Accepted: ['user@example.com']
```

## Troubleshooting

### Still getting "Connection timeout"
- **Check**: Is Railway backend actually deployed? (Check Deployments tab)
- **Check**: Are EMAIL_USER and EMAIL_PASS set in Railway Variables?
- **Check**: Is the password exactly `imfp wily jzsc quin` with spaces?
- **Try**: Wait 5+ minutes between redeploys
- **Try**: Regenerate Gmail App Password and update it

### Still not receiving emails
- Check Spam/Promotions folder in Gmail
- Check if "Less Secure Apps" is ON
- Check if email is going to correct address
- Look for "Accepted:" in logs to confirm delivery

### Error: "Invalid login credentials"
- **Problem**: Password doesn't have spaces or is wrong
- **Fix**: Update EMAIL_PASS to: `imfp wily jzsc quin`
- **Check**: Copy from this guide to avoid typos

## Quick Checklist

- [ ] Went to https://myaccount.google.com/lesssecureapps
- [ ] Enabled "Allow less secure app access"
- [ ] Verified PASSWORD = `imfp wily jzsc quin` (with spaces) in Railway
- [ ] Redeployed backend in Railway
- [ ] Waited 2-3 minutes for deployment
- [ ] Tested login and checked for email
- [ ] Looked for "Connection timeout" errors in logs

## Files Modified
- `backend/src/services/emailService.js` - Added timeout handling and retry logic
