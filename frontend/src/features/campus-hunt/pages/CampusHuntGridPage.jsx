import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CrwdCtrlGridGame from '../grid/CrwdCtrlGridGame';
import { joinGridGame, fetchGridSession } from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';
import CampusHuntBackLink from '../components/CampusHuntBackLink';
import { isPhoneOrTabletClient, LAPTOP_ONLY_RULE } from '../grid/laptopOnly';

const GRID_TOKEN_KEY = 'crwdctrl_grid_token';

export function clearGridSession() {
  sessionStorage.removeItem(GRID_TOKEN_KEY);
}

function LaptopOnlyGate() {
  return (
    <div className="rounded-3xl border border-amber-400/35 bg-amber-500/10 px-5 py-8 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/85">
        Laptop required
      </p>
      <h2 className="mt-3 text-2xl font-black uppercase tracking-wide text-white">
        Phone blocked
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-white/65">
        This puzzle only runs on a laptop or desktop.
        Borrow a device on campus, then open this same link there and enter your device key.
      </p>
      <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-3 text-left text-xs leading-relaxed text-red-100/90">
        {LAPTOP_ONLY_RULE}
      </p>
      <p className="mt-4 break-all font-mono text-xs text-[#0ECCEE]/90">
        {typeof window !== 'undefined' ? window.location.href : '/campus-hunt/grid'}
      </p>
    </div>
  );
}

export default function CampusHuntGridPage() {
  const [accessCode, setAccessCode] = useState('');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [blocked, setBlocked] = useState(false);

  const handleSwitchTeam = useCallback(() => {
    clearGridSession();
    setSession(null);
    setAccessCode('');
    setError('');
  }, []);

  const enforceLaptopGate = useCallback(() => {
    const phone = isPhoneOrTabletClient();
    setBlocked(phone);
    if (phone) {
      clearGridSession();
      setSession(null);
    }
    return phone;
  }, []);

  useEffect(() => {
    const phone = enforceLaptopGate();
    if (phone) {
      setBooting(false);
      return undefined;
    }

    const token = sessionStorage.getItem(GRID_TOKEN_KEY);
    if (!token) {
      setBooting(false);
      return undefined;
    }
    let cancelled = false;
    fetchGridSession(token)
      .then((res) => {
        if (!cancelled) setSession(res.data);
      })
      .catch((err) => {
        clearGridSession();
        if (err?.code === 'LAPTOP_ONLY') setBlocked(true);
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => { cancelled = true; };
  }, [enforceLaptopGate]);

  // Re-check after rotate / Desktop site toggle mid-session
  useEffect(() => {
    const recheck = () => {
      if (enforceLaptopGate()) {
        setError('Laptop only — phones are against event rules.');
      }
    };
    window.addEventListener('resize', recheck);
    window.addEventListener('orientationchange', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('resize', recheck);
      window.removeEventListener('orientationchange', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [enforceLaptopGate]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (enforceLaptopGate()) {
      setError('Laptop only — open this page on a computer. Phones are against the rules.');
      return;
    }
    const code = accessCode.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const res = await joinGridGame(code);
      setSession(res.data);
      sessionStorage.setItem(GRID_TOKEN_KEY, res.data.sessionToken);
    } catch (err) {
      if (err?.code === 'LAPTOP_ONLY') setBlocked(true);
      setError(err.message || 'Could not join');
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07090d] text-white/60">
        Loading…
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-8 text-white"
      style={{
        background:
          'radial-gradient(ellipse at top, rgba(14,204,238,0.18), transparent 45%), radial-gradient(ellipse at bottom right, rgba(139,92,246,0.16), transparent 40%), #07090d',
      }}
    >
      <div className="mx-auto max-w-lg space-y-6">
        <CampusHuntBackLink to={CAMPUS_HUNT_PATHS.leaderboard} label="Back" />
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]">CrwdCtrl</p>
          <h1
            className="mt-1 text-4xl font-black uppercase tracking-tight"
            style={{
              background: 'linear-gradient(90deg, #0ECCEE, #a78bfa, #fb923c)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Zip Grid
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Connect the numbers in order · fill every cell · 3 levels
          </p>
          <p className="mt-1 text-xs text-white/40">
            L1 = 25 · L2 = 50 · L3 = 50 · Hint −20 · miss timer = 0 that level
          </p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-amber-200/70">
            Laptop / desktop only · phones against the rules
          </p>
        </header>

        {blocked ? (
          <LaptopOnlyGate />
        ) : !session ? (
          <form
            onSubmit={handleJoin}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur"
          >
            <label className="block text-xs uppercase tracking-wide text-white/50">
              Team access code
              <input
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="e.g. K7M2XP"
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] outline-none focus:border-[#0ECCEE]"
                autoComplete="off"
                maxLength={6}
              />
            </label>
            {error && <p className="mt-3 text-center text-sm text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={loading || accessCode.length < 4}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#0ECCEE] to-violet-400 py-3 text-sm font-black uppercase tracking-wide text-black disabled:opacity-40"
            >
              {loading ? 'Joining…' : 'Play Zip'}
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-white/40">
              Phones are not allowed. Desktop site will not help — use a real laptop.
            </p>
          </form>
        ) : (
          <CrwdCtrlGridGame
            sessionToken={session.sessionToken}
            initialData={session}
            onSwitchTeam={handleSwitchTeam}
          />
        )}

        <p className="text-center text-xs text-white/35">
          <Link to={CAMPUS_HUNT_PATHS.leaderboard} className="underline hover:text-[#0ECCEE]">
            Back to Campus Hunt
          </Link>
        </p>
      </div>
    </div>
  );
}
