# How to Set Railway URL for Keep-Alive

## Problem
The keep-alive mechanism needs your Railway backend URL to prevent cold starts, but Railway doesn't always auto-set the environment variables.

## Solution: Set `RAILWAY_KEEP_ALIVE_URL` Manually

### Step 1: Find Your Railway URL

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click on your **backend service**
3. Go to **Settings** tab
4. Scroll to **Domains** section
5. You'll see your public domain (e.g., `xxx.up.railway.app`)
6. Copy the full URL: `https://xxx.up.railway.app`

**OR** check your frontend `.env` file - it should have:
```
VITE_API_BASE_URL=https://xxx.up.railway.app/api
```
Remove `/api` from the end to get the base URL.

### Step 2: Set Environment Variable in Railway

1. In Railway Dashboard → Your Backend Service
2. Go to **Variables** tab
3. Click **+ New Variable**
4. Add:
   - **Name**: `RAILWAY_KEEP_ALIVE_URL`
   - **Value**: `https://your-actual-railway-url.up.railway.app`
   - (Replace with your actual Railway URL)
5. Click **Add**
6. Railway will automatically redeploy

### Step 3: Verify It Works

After deployment, check Railway logs. You should see:
```
🚂 Railway URL for keep-alive: https://your-url.up.railway.app
🔄 Railway keep-alive ping...
✅ Railway keep-alive successful
```

## Alternative: Use Railway's Built-in Health Checks

If you don't want to set the environment variable, Railway's built-in health checks will still work:
- Health check path: `/api/health` (already configured in `railway.json`)
- Railway pings this automatically
- This helps but may not prevent all cold starts on Trial plan

## Example

If your Railway URL is: `https://prolific-learning-production-13aa.up.railway.app`

Set in Railway Variables:
```
RAILWAY_KEEP_ALIVE_URL=https://prolific-learning-production-13aa.up.railway.app
```

## Notes

- ✅ Keep-alive pings every 4 minutes to prevent sleep
- ✅ Only works if URL is set correctly
- ✅ If not set, Railway's built-in health checks still work
- ✅ This is optional - your service will work without it, but may have cold starts
