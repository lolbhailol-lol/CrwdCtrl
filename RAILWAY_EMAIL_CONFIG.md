# Fix: Email Not Sending in Production - Railway Deployment

## Problem
✅ **Localhost**: Emails work perfectly (using .env file)
❌ **Production (Railway)**: Emails NOT sending after login/registration

## Root Cause
**Environment variables not set in Railway deployment**. The backend on Railway doesn't have access to `EMAIL_USER` and `EMAIL_PASS`, so email sending fails silently.

## Solution: Set Environment Variables in Railway Dashboard

### Step 1: Go to Railway Dashboard
1. Open https://railway.app/dashboard
2. Select your **backend service** (the Node.js app)

### Step 2: Add Environment Variables

1. Click on the **Variables** tab
2. Click **+ New Variable** button
3. Add the following variables:

#### Variable 1: EMAIL_USER
- **Name**: `EMAIL_USER`
- **Value**: `karanjadhav0430@gmail.com`
- Click **Add**

#### Variable 2: EMAIL_PASS
- **Name**: `EMAIL_PASS`
- **Value**: `imfp wily jzsc quin` (with spaces)
- Click **Add**

#### Variable 3: NODE_ENV (if not already set)
- **Name**: `NODE_ENV`
- **Value**: `production`
- Click **Add**

### Step 3: Trigger Redeployment
After adding variables, Railway will automatically redeploy your service. Wait for the deployment to complete (usually 2-5 minutes).

### Step 4: Verify Configuration

After deployment, check the logs. You should see:
```
✅ Email transporter configured with: karanjadhav0430@gmail.com
```

If you see this warning instead:
```
⚠️ WARNING: Email credentials (EMAIL_USER/EMAIL_PASS) not configured!
```

Then the environment variables were not properly set in Railway.

## Testing After Deployment

1. **Test Login Email**:
   - Go to your production app
   - Log in with an existing account
   - Check your email inbox for login confirmation

2. **Test Registration Email**:
   - Register a new account with an email
   - Check inbox for welcome email and confirmation

3. **Check Backend Logs**:
   - Go to Railway → Backend Service → Logs
   - Look for lines like:
     ```
     ✅ Email transporter configured with: karanjadhav0430@gmail.com
     📧 Starting login confirmation email process for: user@example.com
     ✅ Login confirmation email sent successfully!
     ```

## Complete Environment Variables for Railway

Here's the complete list of environment variables needed in Railway:

```
# Database
MONGODB_URI=mongodb+srv://karan_lol:jadhav0908@crwdctrl.6smlz12.mongodb.net/?appName=crwdctrl

# Email Configuration (CRITICAL FOR LOGIN/REGISTRATION EMAILS)
EMAIL_USER=karanjadhav0430@gmail.com
EMAIL_PASS=imfp wily jzsc quin

# JWT
JWT_SECRET=Yd9n#2@zC5f*1R!e$gT7xP0vLqWm^KsA

# Admin
ADMIN_EMAIL=crwdctrl.in@gmail.com
ADMIN_PASSWORD=CrwdCtrl0430
ADMIN_JWT_SECRET=8e16c3bde96dbd0843ba594ab09b18e69457f34c6d06999fb4cf3254973f8169
ADMIN_REFRESH_SECRET=your-secure-refresh-secret-key

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=dyonimhgb
CLOUDINARY_API_KEY=364951443798767
CLOUDINARY_API_SECRET=i0F-jEG4V3n6vM_tlLtSCVx6bUI

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=sheet-service-507@keen-incline-483004-g5.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...copied from .env..."

# Deployment
NODE_ENV=production
PORT=8080
```

## Email Flow in Production

```
User logs in/registers
         ↓
Express backend (Railway)
         ↓
Email Service loads EMAIL_USER & EMAIL_PASS from environment
         ↓
Creates Gmail SMTP transporter with credentials
         ↓
Sends email via Gmail
         ↓
Email delivered to user inbox
```

## What Happens Without Email Credentials

1. Backend logs warning: "⚠️ WARNING: Email credentials not configured!"
2. Email sending fails silently
3. User doesn't receive confirmation emails
4. No error in API response (emails are sent async)

## Common Issues

### Issue 1: "Still not working after setting variables"
**Solution**: 
- Verify the deployment completed (check Railway logs for "Deployment successful")
- Hard refresh your browser (Ctrl+Shift+R)
- Wait 2-3 minutes for Railway to fully redeploy

### Issue 2: "Wrong password format"
**Solution**:
- Gmail app password is: `imfp wily jzsc quin` (16 characters WITH spaces)
- NOT: `imfpwilyjzscquin` (no spaces - this won't work)

### Issue 3: "Still see warning in logs"
**Solution**:
1. Check Railway Variables tab - confirm both EMAIL_USER and EMAIL_PASS are there
2. Copy-paste exactly: `imfp wily jzsc quin` (watch for typos)
3. Make sure NODE_ENV=production
4. Click "Save" after adding variables
5. Wait for automatic redeployment to complete

## Logs to Check

**Expected logs after setting variables:**
```
🚀 Starting FestBuzzZ Backend Server...
📍 Node Environment: production
✅ Email transporter configured with: karanjadhav0430@gmail.com
🚂 Railway deployment detected
```

**Bad logs (email won't work):**
```
⚠️ WARNING: Email credentials (EMAIL_USER/EMAIL_PASS) not configured!
⚠️ Emails will NOT be sent in production.
```

## Quick Checklist

- [ ] Opened Railway Dashboard
- [ ] Selected backend service
- [ ] Clicked Variables tab
- [ ] Added EMAIL_USER = karanjadhav0430@gmail.com
- [ ] Added EMAIL_PASS = imfp wily jzsc quin (with spaces)
- [ ] Waited for automatic redeployment
- [ ] Checked logs for "✅ Email transporter configured"
- [ ] Tested login/registration with test account
- [ ] Verified email received in inbox

## Alternative: Using railway.json

If you want to hardcode environment variables in your repository (not recommended for secrets), you can add to `railway.json`:

```json
{
  "environments": {
    "production": {
      "variables": {
        "NODE_ENV": "production",
        "EMAIL_USER": "karanjadhav0430@gmail.com",
        "EMAIL_PASS": "imfp wily jzsc quin"
      }
    }
  }
}
```

⚠️ **WARNING**: This puts secrets in source control. Only do this if your repo is private.

## References

- [Email Setup Guide](backend/EMAIL_SETUP.md)
- [Email Delivery Fix](EMAIL_DELIVERY_FIX.md)
- [Railway Deployment Guide](RAILWAY_DEPLOYMENT_GUIDE.md)
- Email Service Code: `backend/src/services/emailService.js`
