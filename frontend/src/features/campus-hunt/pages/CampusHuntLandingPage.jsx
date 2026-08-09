import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import CrwdCtrlLogin from '../../../pages/auth/login';
import { prepareLogin } from '../../../utils/loginFlow';
import { fetchEventBySlug } from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';

export default function CampusHuntLandingPage() {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchEventBySlug(slug);
        if (!cancelled) setEvent(res.data?.event);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Event not available');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (isAuthenticated && showLogin) {
      setShowLogin(false);
      navigate(CAMPUS_HUNT_PATHS.play(slug), { replace: true });
    }
  }, [isAuthenticated, showLogin, navigate, slug]);

  const enterHunt = () => {
    if (!isAuthenticated) {
      prepareLogin({ returnPath: CAMPUS_HUNT_PATHS.play(slug) });
      setShowLogin(true);
      return;
    }
    navigate(CAMPUS_HUNT_PATHS.play(slug));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white">
        Loading…
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0c0d] px-4 text-center text-white">
        <h1 className="text-2xl font-bold">Campus Hunt</h1>
        <p className="text-white/60">{error || 'Not found'}</p>
        <button
          type="button"
          onClick={() => {
            prepareLogin({ returnPath: CAMPUS_HUNT_PATHS.event(slug) });
            setShowLogin(true);
          }}
          className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 font-semibold text-black"
        >
          Log in
        </button>
        <Link to="/" className="text-[#0ECCEE] underline">
          Back to CrwdCtrl
        </Link>
        {showLogin && (
          <div className="fixed inset-0 z-50">
            <CrwdCtrlLogin
              onClose={() => setShowLogin(false)}
              onSwitchToRegister={() => setShowLogin(false)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0c0d] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, #0ECCEE55, transparent), linear-gradient(180deg, #121416 0%, #0b0c0d 60%)',
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
        <p className="text-sm uppercase tracking-[0.3em] text-[#0ECCEE]">CRWDCtrl</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">Campus Hunt</h1>
        <p className="mt-3 text-lg text-white/70">{event.name}</p>
        <p className="mt-1 text-sm text-white/50">{event.college}</p>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-white/60">
          A physical campus treasure hunt. Solve clues, verify at checkpoints, score as a team of four.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={enterHunt}
            className="rounded-xl bg-[#0ECCEE] py-3.5 text-center text-base font-semibold text-black"
          >
            {isAuthenticated ? 'Enter hunt' : 'Log in to enter'}
          </button>
        </div>
      </div>

      {showLogin && (
        <div className="fixed inset-0 z-50">
          <CrwdCtrlLogin
            onClose={() => setShowLogin(false)}
            onSwitchToRegister={() => setShowLogin(false)}
          />
        </div>
      )}
    </div>
  );
}
