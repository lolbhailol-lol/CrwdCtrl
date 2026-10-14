import { useCallback, useEffect, useState } from 'react';
import LocalQRCode from '../../../components/LocalQRCode';
import { adminListMysteryCredentials, adminSetAllMysteryPasswords } from '../services/mystery.api';
import { MYSTERY_PATHS, mysteryEnterUrl, mysteryPublicUrl } from '../config';
import { cardClass, copyText, formatDateTime, ghostBtn, inputClass, primaryBtn } from './mysteryAdminUtils';

function teamMessage(event, cred) {
  return [
    `🕵️ CTRL Mystery — ${event.name || event.title}`,
    event.venue ? `📍 ${event.venue}` : '',
    event.date ? `🗓 ${formatDateTime(event.date)}` : '',
    '',
    `Team: ${cred.teamName}`,
    `Team code: ${cred.teamCode}`,
    cred.password ? `Password: ${cred.password}` : 'Password: the one you set during registration',
    '',
    `Login: ${mysteryEnterUrl(cred.teamCode)}`,
    'Log in only from the team leader\'s phone. You can start scanning clues as soon as the game goes live.',
  ].filter((line, i, arr) => line || arr[i - 1]).join('\n');
}

function whatsappHref(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  const number = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export default function MysteryEventLinks({ eventId, overview, onChanged }) {
  const event = overview?.event || {};
  const caseId = overview?.case?._id;
  const [credentials, setCredentials] = useState([]);
  const [commonPassword, setCommonPassword] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await adminListMysteryCredentials(eventId);
    setCredentials(res.data?.credentials || []);
  }, [eventId]);

  useEffect(() => { load().catch((err) => setError(err.message)); }, [load, overview?.counts?.teamsRegistered]);

  const copy = (text, label) => copyText(text).then(() => setMsg(`${label} copied`));

  const setAll = async () => {
    const pw = commonPassword.trim();
    if (pw.length < 4) { setError('Password must be at least 4 characters'); return; }
    if (!window.confirm(`Set the password for all ${credentials.length} teams to "${pw}"?`)) return;
    setBusy('pw');
    setError('');
    try {
      const res = await adminSetAllMysteryPasswords(eventId, pw);
      setCommonPassword('');
      setMsg(`Password updated for ${res.data?.teamsUpdated || 0} teams`);
      await load();
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const publicLinks = [
    ['Player landing', mysteryPublicUrl(MYSTERY_PATHS.landing), 'All published cases + registration'],
    caseId && ['Team registration', mysteryPublicUrl(`${MYSTERY_PATHS.register(caseId)}?eventId=${eventId}`), 'Teams register themselves (status: Registration open)'],
    ['Team login', mysteryPublicUrl(MYSTERY_PATHS.enter), 'Team code + password'],
    ['Live leaderboard', mysteryPublicUrl(MYSTERY_PATHS.leaderboard(eventId)), 'Show it on the projector'],
    caseId && ['Practice (solo)', mysteryPublicUrl(MYSTERY_PATHS.practice(caseId)), 'Try the case without an event'],
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-[#0ECCEE]">{msg}</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      <section className={cardClass}>
        <p className="text-sm font-semibold text-[#0ECCEE]">Public links</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {publicLinks.map(([label, url, hint]) => (
            <div key={label} className="flex gap-3 rounded-xl bg-black/25 p-3">
              <div className="shrink-0 rounded-lg bg-white p-1"><LocalQRCode data={url} size={72} printSafe /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-white/40">{hint}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-white/60">{url}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" className={ghostBtn} onClick={() => copy(url, label)}>Copy</button>
                  <a href={url} target="_blank" rel="noreferrer" className={ghostBtn}>Open ↗</a>
                </div>
              </div>
            </div>
          ))}
        </div>
        {event.status !== 'registration_open' && caseId && (
          <p className="mt-3 text-xs text-amber-200/80">The registration link works only when the event status is "Registration open".</p>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#0ECCEE]">Team logins — send to team leaders on WhatsApp</p>
            <p className="text-xs text-white/45">Only self-registered teams know their own password — if needed, issue a new one from the Teams tab.</p>
          </div>
          <button type="button" disabled={!credentials.length} className={ghostBtn} onClick={() => copy(credentials.map((c) => teamMessage(event, c)).join('\n\n— — —\n\n'), 'All messages')}>Copy all messages</button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input value={commonPassword} onChange={(e) => setCommonPassword(e.target.value)} placeholder="One password for all teams" className={`max-w-xs font-mono ${inputClass}`} />
          <button type="button" disabled={Boolean(busy) || !credentials.length} onClick={setAll} className={primaryBtn}>{busy === 'pw' ? 'Saving…' : 'Set for all'}</button>
        </div>

        <div className="mt-4 space-y-2">
          {credentials.map((c) => {
            const text = teamMessage(event, c);
            return (
              <div key={c._id} className="flex flex-wrap items-center gap-3 rounded-xl bg-black/25 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{c.teamName} <span className="font-mono text-[#0ECCEE]">{c.teamCode}</span></p>
                  <p className="font-mono text-xs text-white/50">{c.password ? `password: ${c.password}` : 'password: set by team'}{c.captainPhone ? ` · ${c.captainPhone}` : ''}</p>
                </div>
                <button type="button" className={ghostBtn} onClick={() => copy(mysteryEnterUrl(c.teamCode), 'Login link')}>Link</button>
                <button type="button" className={ghostBtn} onClick={() => copy(text, `${c.teamName} message`)}>Message</button>
                {c.captainPhone && <a href={whatsappHref(c.captainPhone, text)} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200">WhatsApp ↗</a>}
              </div>
            );
          })}
          {credentials.length === 0 && <p className="text-sm text-white/40">No teams yet — create them in the Teams tab.</p>}
        </div>
      </section>
    </div>
  );
}
