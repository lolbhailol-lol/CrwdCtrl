# Google Sheets API Setup Guide

This guide explains how to set up Google Sheets API integration for automatic data appending.

## Prerequisites

1. Google Cloud Console account
2. A Google Sheets document where you want to store registration data

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click on it and press "Enable"

## Step 2: Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details:
   - Name: `crwdctrl-sheets`
   - ID: `crwdctrl-sheets`
   - Description: `Service account for FestBuzz Google Sheets integration`
4. Click "Create and Continue"
5. Skip the optional steps and click "Done"

## Step 3: Generate Service Account Key

1. In the "Credentials" page, find your service account
2. Click on the service account email
3. Go to the "Keys" tab
4. Click "Add Key" > "Create New Key"
5. Choose "JSON" format and click "Create"
6. A JSON file will be downloaded - keep it safe!

## Step 4: Configure Environment Variables

From the downloaded JSON file, extract these values and add them to your `.env` file:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----"
```

**Important:** The private key should include the `\n` characters for line breaks.

## Step 5: Share Google Sheets with Service Account

For each Google Sheet you want to use:

1. Open the Google Sheet
2. Click "Share" button
3. Add the service account email: `your-service-account@your-project.iam.gserviceaccount.com`
4. Give it "Editor" permissions
5. Click "Send"

## Step 6: Use in Admin Panel

1. In the admin panel, when creating/editing a fest
2. Select "Internal Website Form" for registration mode
3. Paste the Google Sheets URL (the regular URL from your browser)
4. The system will automatically append registration data to your sheet

## Troubleshooting

### Common Issues:

1. **"Permission denied" error**: Make sure the service account has Editor access to the sheet
2. **"Invalid URL" error**: Use the full Google Sheets URL from your browser
3. **"Authentication failed"**: Check that your environment variables are correctly set

### Testing the Connection:

You can test if the setup is working by:
1. Creating a test fest with internal form registration
2. Submitting a test registration
3. Checking if the data appears in your Google Sheet

## Security Notes

- Keep your service account JSON file secure
- Never commit the private key to version control
- Use environment variables for all sensitive data
- Regularly rotate your service account keys if needed

## Support

If you encounter issues, check the server logs for detailed error messages. The system will continue to work even if Google Sheets integration fails - it won't prevent user registrations.