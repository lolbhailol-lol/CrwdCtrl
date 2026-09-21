import { useCallback, useEffect, useState } from 'react';
import CrwdCtrlGridGame from '../grid/CrwdCtrlGridGame';
import { joinGridGame, fetchGridSession } from '../services/campusHunt.api';
import { isPhoneOrTabletClient, LAPTOP_ONLY_RULE } from '../grid/laptopOnly';

const GRID_TOKEN_KEY = 'crwdctrl_grid_token';

export function clearGridSession() {
  sessionStorage.removeItem(GRID_TOKEN_KEY);
}

function LaptopOnlyGate() {
  return (
    <div className="rounded-3xl border border-amber-400/35 bg-amber-500/10 px-5 py-8 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/85">
        Field Terminal
      </p>
      <h2 className="mt-3 text-2xl font-black uppercase tracking-wide text-white">
        Wrong screen
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-white/65">
        Zip Grid only runs on a laptop or desktop.
        Open this same link there and enter your device key.
      </p>
      <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-3 text-left text-xs leading-relaxed text-red-100/90">
        {LAPTOP_ONLY_RULE}
      </p>
      <p className="mt-4 break-all font-mono text-xs text-violet-300/90">
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
      <div className="flex min-h-screen items-center justify-center bg-[#06040f] text-white/60">
        Loading Zip…
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-8 text-white"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.35), transparent 55%),'
          + 'radial-gradient(ellipse 60% 40% at 100% 80%, rgba(14,204,238,0.18), transparent 45%),'
          + 'radial-gradient(ellipse 50% 35% at 0% 100%, rgba(251,146,60,0.12), transparent 40%),'
          + '#06040f',
      }}
    >
      <div className="mx-auto max-w-lg space-y-6">
        <header className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-violet-300/90">
            Field Terminal · Clue 4
          </p>
          <h1
            className="mt-2 text-5xl font-black uppercase tracking-tight"
            style={{
              background: 'linear-gradient(110deg, #c4b5fd 0%, #0ECCEE 45%, #fb923c 100%)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Zip Grid
          </h1>
          <p className="mt-3 text-sm text-white/65">
            Connect numbers in order · fill every cell · <strong className="text-white">3 rounds</strong>
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px]">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">
              R1 · 25 pts
            </span>
            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-violet-100">
              R2 · 50 pts
            </span>
            <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-2.5 py-1 text-orange-100">
              R3 · 50 pts
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/50">
              Hint −20
            </span>
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-amber-200/75">
            Laptop only · no phones · no account ranking
          </p>
        </header>

        {blocked ? (
          <LaptopOnlyGate />
        ) : !session ? (
          <form
            onSubmit={handleJoin}
            className="rounded-3xl border border-violet-400/25 bg-violet-500/5 p-5 backdrop-blur"
          >
            <label className="block text-xs uppercase tracking-wide text-white/50">
              Device key (from leader phone)
              <input
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="e.g. K7M2XP"
                className="mt-2 w-full rounded-xl border border-violet-300/25 bg-black/50 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] outline-none focus:border-[#0ECCEE]"
                autoComplete="off"
                maxLength={6}
              />
            </label>
            {error && (
              <p className="mt-3 text-center text-sm text-red-300">
                {/session expired/i.test(String(error))
                  ? 'That key timed out — enter it again (it will reopen automatically).'
                  : error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || accessCode.length < 4}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-400 via-[#0ECCEE] to-orange-300 py-3.5 text-sm font-black uppercase tracking-wide text-black disabled:opacity-40"
            >
              {loading ? 'Joining…' : 'Start Zip · 3 rounds'}
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-white/40">
              Difficulty climbs each round. Miss a timer → 0 for that round, keep going.
            </p>
          </form>
        ) : (
          <CrwdCtrlGridGame
            sessionToken={session.sessionToken}
            initialData={session}
            onSwitchTeam={handleSwitchTeam}
          />
        )}
      </div>
    </div>
  );
}
