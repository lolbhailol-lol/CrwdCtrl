# Email Configuration Guide

## Problem
New users registering on the platform are not receiving welcome/verification emails in production.

## Root Cause
The `EMAIL_USER` and `EMAIL_PASS` environment variables are not configured in the production environment (Render/Google Cloud Run), causing the email service to fail silently or use a test email service that doesn't actually deliver emails.

## Solution

### 1. For Render Deployment

1. Go to your Render Dashboard: https://dashboard.render.com/
2. Select your backend service (`crwdctrl-backend`)
3. Go to the "Environment" tab
4. Add the following environment variables:
   - `EMAIL_USER` = `karanjadhav0430@gmail.com`
   - `EMAIL_PASS` = `imfp wily jzsc quin` (Gmail App Password)
5. Click "Save Changes"
6. The service will automatically redeploy with the new environment variables

### 2. For Google Cloud Run Deployment

#### Option A: Using Secret Manager (Recommended)

1. Create secrets in Google Secret Manager:
```bash
# Create EMAIL_USER secret
echo -n "karanjadhav0430@gmail.com" | gcloud secrets create EMAIL_USER --data-file=-

# Create EMAIL_PASS secret
echo -n "imfp wily jzsc quin" | gcloud secrets create EMAIL_PASS --data-file=-
```

2. The `cloudbuild.yaml` has been updated to automatically use these secrets.

3. Deploy using:
```bash
gcloud builds submit --config cloudbuild.yaml
```

#### Option B: Using Environment Variables Directly

```bash
gcloud run services update festbuzzzz-mvp \
  --update-env-vars EMAIL_USER=karanjadhav0430@gmail.com,EMAIL_PASS="imfp wily jzsc quin" \
  --region asia-south1
```

### 3. Gmail App Password Setup

If you need to generate a new App Password:

1. Go to your Google Account: https://myaccount.google.com/
2. Select "Security"
3. Under "How you sign in to Google", select "2-Step Verification"
4. At the bottom, select "App passwords"
5. Select "Mail" and your device
6. Generate and use the 16-character password

**Note:** The current app password is: `imfp wily jzsc quin`

## Verification

After setting up the environment variables:

1. Restart your service/application
2. Check the logs for confirmation:
   ```
   ✅ EMAIL_USER: SET
   ✅ EMAIL_PASS: SET
   ✅ Email transporter configured with: karanjadhav0430@gmail.com
   ```

3. Register a new user and check:
   - Server logs for "✅ Welcome email sent successfully"
   - User's email inbox for the welcome email

## Testing Locally

To test email functionality locally:

1. Ensure `.env` file has:
   ```
   EMAIL_USER=karanjadhav0430@gmail.com
   EMAIL_PASS=imfp wily jzsc quin
   ```

2. Run the test script:
   ```bash
   cd backend
   node test-email.js
   ```

3. Check the logs and the test email inbox.

## Troubleshooting

### Email not sending in production:
1. Check if environment variables are set: Look for "⚠️ WARNING: EMAIL_USER is not set" in logs
2. Verify Gmail App Password is valid
3. Check for "❌ Welcome email sending failed" in logs
4. Ensure 2-Step Verification is enabled on the Gmail account

### "Invalid login" error:
- The Gmail App Password may have expired or been revoked
- Generate a new App Password and update the environment variables

### Still not working:
1. Check server logs for detailed error messages
2. Verify the Gmail account hasn't been locked due to suspicious activity
3. Test using the `test-email.js` script locally first

## Code Changes Made

1. **emailService.js**: 
   - Added warnings when email credentials are missing
   - Throws error in production if credentials not set
   - Enhanced error logging

2. **usercontroller.js**:
   - Added detailed logging for email sending process
   - Better error handling and reporting

3. **server.js**:
   - Added startup validation for environment variables
   - Logs status of all critical and optional env vars

4. **render.yaml**:
   - Added EMAIL_USER and EMAIL_PASS to environment variables list

5. **cloudbuild.yaml**:
   - Added secrets configuration for EMAIL_USER and EMAIL_PASS

## Security Note

**IMPORTANT:** Never commit email passwords to Git. Always use:
- Environment variables for deployment
- Secret managers (Google Secret Manager, AWS Secrets Manager, etc.)
- The `.env` file is already in `.gitignore`
