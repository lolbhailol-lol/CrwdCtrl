# Run club organizer — QA checklist

Use a dedicated test club (e.g. **CrwdCtrl QA Run Club**) so you can verify flows without reading real runner PII.

## Discovery (main app)

| Step | Action | Expected |
|------|--------|----------|
| A | Open normal login | No Club manager block |
| B | Profile sidebar → **Club manager** | Only if email is on Admin → Profile emails; else hidden |
| C | Help Center | No public club-manager signup/login links |
| D | Direct `/run-club-organizer/signup` without invite email | Rejected (`invite_required`) |

## Setup

1. Admin → create/publish the QA run club.
2. Admin → **Profile emails** → add the manager’s CrwdCtrl email.
3. Admin → create a published run under that club (fee + `organizer_qr` if testing payments).
4. Signup: `/run-club-organizer/signup` with that **same approved email**.

## Account flow

| Step | Action | Expected |
|------|--------|----------|
| 1 | Signup with non-invited email | 403 invite required |
| 2 | Signup with invited email | Pending in admin list; no JWT |
| 3 | Login before approve | Awaiting CrwdCtrl approval |
| 4 | Admin **Approve** | Login works; only that club’s runs |
| 5 | Admin **Reject** / deactivate | Login blocked |

## Mobile portal

After login → Club home → pick a run:

- Bottom tabs: Dash / Guests / Scan / Notify
- Payment review queue: Start review → Approve/Reject → auto-next
- Notify → **One person** tab + Message on participant card

## Registration / payments

| Step | Action | Expected |
|------|--------|----------|
| 6 | Free register | Confirmed +1 |
| 7 | QR paid register | Pending review; ticket after approve |
| 8 | Reject payment | Cancelled; runner can re-register |
| 9 | Admin registrations | Form fields redacted |
| 10 | Organizer CSV | Full PII only in organizer session |

## URLs

- Signup: `/run-club-organizer/signup` (invite email required)
- Login: `/run-club-organizer/login`
- Admin: `/admin/run-club-organizers`
