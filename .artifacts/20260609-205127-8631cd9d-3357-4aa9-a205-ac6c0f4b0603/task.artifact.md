# Task: Fix Backend Connectivity and CORS for Android

- [/] Research and Diagnosis
    - [x] Check backend health (Local & Production)
    - [x] Inspect Android logs (Logcat) for errors
    - [x] Verify CORS configuration in `backend/src/config/cors.js`
    - [x] Reproduce CORS error via `curl`
- [ ] Implementation
    - [ ] Update `backend/src/config/cors.js` to allow mobile origins and fix error handling
    - [ ] Verify frontend environment variables for Android
- [ ] Verification
    - [ ] Mock preflight requests locally to confirm CORS fixes
    - [ ] Provide instructions for deployment and local testing
