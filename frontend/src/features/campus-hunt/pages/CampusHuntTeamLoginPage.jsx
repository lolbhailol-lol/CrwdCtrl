import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import CrwdCtrlLogin from '../../../pages/auth/login';
import { prepareLogin } from '../../../utils/loginFlow';
import { fetchTeamLoginCard, loginTeamMember } from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';
import { useDarkMode } from '../../../context/DarkModeContext';

export default function CampusHuntTeamLoginPage() {
  const { slug, teamCode } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, logout } = useAuth();
  const { isDark } = useDarkMode();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loginStarted, setLoginStarted] = useState(false);

  const roleParam = searchParams.get('role');
  const slotParam = Number(searchParams.get('slot') || 0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchTeamLoginCard(slug, teamCode);
        if (cancelled) return;
        setData(res.data);
        const members = res.data?.team?.members || [];
        if (roleParam === 'leader') {
          setSelected(members.find((m) => m.role === 'leader') || null);
        } else if (roleParam === 'scanner' && slotParam) {
          setSelected(members.find((m) => m.role === 'scanner' && m.slot === slotParam) || null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Team not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, teamCode, roleParam, slotParam]);

  useEffect(() => {
    if (loginStarted && isAuthenticated && data?.team?.playPath) {
      navigate(data.team.playPath, { replace: true });
    }
  }, [loginStarted, isAuthenticated, data, navigate]);

  const pageBg = isDark ? 'bg-[#0b0c0d] text-white' : 'bg-[#F5F6FA] text-gray-900';
  const card = isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white shadow-sm';
  const muted = isDark ? 'text-white/55' : 'text-gray-500';

  const members = data?.team?.members || [];
  const playPath = data?.team?.playPath || CAMPUS_HUNT_PATHS.play(slug);

  const selectedHint = useMemo(() => {
    if (!selected) return '';
    if (selected.role === 'leader') {
      return selected.loginEmail
        ? `Leader login: ${selected.loginEmail} (use the separate leader password)`
        : 'Use the leader login and password from your team access pack';
    }
    return selected.loginEmail
      ? `Scanner login: ${selected.loginEmail} (password from your team slip)`
      : 'Use the scanner login from your team slip';
  }, [selected]);

  const openLogin = async (member) => {
    if (isAuthenticated) {
      setLoginStarted(false);
      await logout();
    }
    setSelected(member);
    setLoginStarted(true);
    prepareLogin({ returnPath: playPath });
    setShowLogin(true);
  };

  const openGenericLogin = async () => {
    if (isAuthenticated) {
      setLoginStarted(false);
      await logout();
    }
    setLoginStarted(true);
    prepareLogin({ returnPath: playPath });
    setShowLogin(true);
  };

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${pageBg}`}>
        Loading team…
      </div>
    );
  }

  if (error || !data?.team) {
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center gap-3 px-4 ${pageBg}`}>
        <h1 className="text-2xl font-bold">Team login</h1>
        <p className={muted}>{error || 'Not found'}</p>
        <Link to="/" className="text-[#0ECCEE] underline">Back home</Link>
      </div>
    );
  }

  const { event, team } = data;

  return (
    <div className={`min-h-screen px-4 py-8 ${pageBg}`}>
      <div className="mx-auto max-w-lg space-y-5">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-[#0ECCEE]">Campus Hunt</p>
          <h1 className="text-3xl font-bold">{team.teamName}</h1>
          <p className={`text-sm ${muted}`}>
            {team.teamCode} · {event.college}
          </p>
          <p className={`text-sm ${muted}`}>{event.name}</p>
        </header>

        <div className={`rounded-2xl border p-4 ${card}`}>
          <p className="text-sm font-semibold">Who are you?</p>
          <p className={`mt-1 text-xs ${muted}`}>
            Pick your name, then log in. Leader gets clues; others are scanners at checkpoints.
          </p>
          <div className="mt-4 space-y-2">
            {members.map((m) => (
              <button
                key={`${m.role}-${m.slot}`}
                type="button"
                onClick={() => openLogin(m)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  selected?.slot === m.slot && selected?.role === m.role
                    ? 'border-[#0ECCEE] bg-[#0ECCEE]/10'
                    : isDark
                      ? 'border-white/15 hover:border-white/30'
                      : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>
                  <p className="font-semibold">{m.name}</p>
                  <p className={`text-xs ${muted}`}>
                    {m.role === 'leader' ? 'Leader — full hunt' : 'Scanner — checkpoints only'}
                  </p>
                  {m.loginEmail && (
                    <p className={`mt-0.5 font-mono text-[11px] ${muted}`}>{m.loginEmail}</p>
                  )}
                </div>
                <span className="text-xs font-semibold text-[#0ECCEE]">Login →</span>
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <p className={`text-center text-sm ${muted}`}>{selectedHint}</p>
        )}

        <button
          type="button"
          onClick={openGenericLogin}
          className="w-full rounded-xl bg-[#0ECCEE] py-3 font-semibold text-black"
        >
          Open login
        </button>

        <Link to={CAMPUS_HUNT_PATHS.event(slug)} className={`block text-center text-sm underline ${muted}`}>
          Event page
        </Link>
      </div>

      {showLogin && (
        <div className="fixed inset-0 z-50">
          <CrwdCtrlLogin
            initialEmail={selected?.loginEmail || ''}
            loginWithEmail={(email, password) => loginTeamMember(slug, teamCode, email, password)}
            passwordOnly
            title={
              selected?.role === 'scanner'
                ? 'Scanner login'
                : selected?.role === 'leader'
                  ? 'Leader login'
                  : 'Team login'
            }
            subtitle={selectedHint || 'Use the credentials from your team access pack'}
            onClose={() => {
              setShowLogin(false);
              if (!isAuthenticated) setLoginStarted(false);
            }}
            onSwitchToRegister={() => setShowLogin(false)}
          />
        </div>
      )}
    </div>
  );
}
