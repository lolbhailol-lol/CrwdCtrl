# Setting up Google Sheets API Credentials

## Step 1: Extract Information from JSON File

Your Google service account JSON file should look like this:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"
}
```

## Step 2: Update Environment Variables

From your JSON file, extract these two values and update your `.env` file:

1. **GOOGLE_SERVICE_ACCOUNT_EMAIL**: Copy the `client_email` value
2. **GOOGLE_PRIVATE_KEY**: Copy the `private_key` value (keep the quotes and \n characters)

Example:
```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7vTqDbh5w...\n-----END PRIVATE KEY-----"
```

## Step 3: Share Google Sheets

For any Google Sheet you want to use:
1. Open the Google Sheet
2. Click "Share"
3. Add the service account email (the `client_email` from your env)
4. Give it "Editor" permissions
5. Click "Send"

## Step 4: Test the Connection

Use the "Test" button in the admin panel to verify the connection works.

## Security Note

- Never commit the JSON file to version control
- Keep the private key secure
- Only share sheets that need to receive registration data