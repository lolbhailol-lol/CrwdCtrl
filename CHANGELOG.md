# Changelog - Mobile Login Fix

## Version 2.0.0 - Mobile & Instagram OAuth Support

### New Features
- ✨ Mobile OAuth redirect flow (Android/iOS)
- ✨ Instagram/Facebook in-app browser OAuth support
- ✨ Automatic device detection (mobile/desktop/Instagram)
- ✨ Fallback storage mechanisms (localStorage → sessionStorage)
- ✨ Comprehensive error logging with device context
- ✨ Browser info debugging for development

### Bug Fixes
- 🐛 Fixed CORS credentials not being sent on mobile
- 🐛 Fixed cookies not stored on mobile devices
- 🐛 Fixed redirect timing issues (race condition)
- 🐛 Fixed OAuth popup closing on mobile
- 🐛 Fixed Instagram WebView auth completely failing
- 🐛 Fixed API URL resolution on mobile
- 🐛 Fixed missing Authorization headers
- 🐛 Fixed SameSite cookie rejection on mobile
- 🐛 Fixed localStorage failures in private browsing
- 🐛 Fixed backend rejecting mobile requests

### Changes

#### Frontend
- **authService.ts**: Added credential handling, fallback storage, error logging
- **googleAuthService.ts** (NEW): Mobile/Instagram OAuth detection and redirect handling
- **GoogleSignInButton.tsx** (NEW): Mobile-optimized sign-in component
- **LoginForm.tsx**: Added better error handling
- **LoginPage.tsx**: Added redirect result handling
- **firebaseConfig.ts** (NEW): Firebase setup with persistence

#### Backend
- **corsConfig.js** (NEW): Proper CORS setup for mobile
- **cookieConfig.js** (NEW): Mobile-friendly cookie configuration
- **errorHandler.js** (NEW): Device-aware error logging
- **authRoutes.js**: Added mobile client detection, Google OAuth endpoint
- **app.js**: Middleware ordering fixed
- **.env**: Added FRONTEND_URL, COOKIE_DOMAIN

### Breaking Changes
None - Fully backward compatible with desktop

### Migration Guide

No migration needed - all changes are additive. Existing desktop functionality preserved.

### Performance Impact
- Minimal - Added ~2KB to bundle (gzip)
- No additional API calls
- Same auth latency

### Security Improvements
- ✅ Proper CORS validation
- ✅ SameSite cookies enforced
- ✅ HttpOnly flag set
- ✅ Secure flag in production
- ✅ Token in body + cookies (defense in depth)

### Known Issues
None

### Future Improvements
- [ ] Biometric auth on mobile
- [ ] Native app bridge support
- [ ] Enhanced mobile UI/UX
- [ ] Progressive Web App support

---

## Version 1.0.0 - Initial Release

### Features
- Basic email/password login
- Desktop Google OAuth
- User dashboard

### Known Limitations
- ❌ Mobile login fails
- ❌ Instagram/Facebook OAuth not supported
- ❌ CORS issues on mobile
- ❌ Cookie handling problems
