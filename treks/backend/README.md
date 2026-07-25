# CrwdCtrl Treks — Backend

Reserved for a future Treks API (read-only trek directory, status, community updates).

**Not implemented in the MVP.** The frontend currently uses local mock data in `../frontend/src/data/treks.js`.

When you add an API here later:

1. Keep it separate from the main CrwdCtrl `backend/`
2. Expose trek discovery endpoints only (no bookings/auth/payments in v1 unless needed)
3. Point `frontend/src/services/trekService.js` at this service
4. Deploy independently (e.g. Railway) alongside `treks.crwdctrl.in` on Vercel
