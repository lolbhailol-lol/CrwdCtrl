import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import CrwdCtrlLogin from '../../../pages/auth/login';
import { prepareLogin } from '../../../utils/loginFlow';
import { fetchEventBySlug } from '../services/campusHunt.api';
import { useHuntTeam } from '../hooks/useHuntTeam';
import PlayerPlayScreen from '../player/PlayerPlayScreen';
import { CAMPUS_HUNT_PATHS } from '../config';

export default function CampusHuntPlayPage() {
  const { slug } = useParams();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [eventId, setEventId] = useState(null);
  const [bootError, setBootError] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      prepareLogin({ returnPath: CAMPUS_HUNT_PATHS.play(slug) });
      setShowLogin(true);
    } else {
      setShowLogin(false);
    }
  }, [authLoading, isAuthenticated, slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchEventBySlug(slug);
        if (!cancelled) setEventId(res.data?.event?._id || res.data?.event?.id);
      } catch (err) {
        if (!cancelled) setBootError(err.message || 'Event unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const { data, loading, error, refreshProgress } = useHuntTeam(
    isAuthenticated ? eventId : null,
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white">
        Checking login…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0c0d] px-4 text-center text-white">
        <h1 className="text-2xl font-bold">Campus Hunt</h1>
        <p className="text-white/60">Log in with your CrwdCtrl account to play.</p>
        <button
          type="button"
          onClick={() => {
            prepareLogin({ returnPath: CAMPUS_HUNT_PATHS.play(slug) });
            setShowLogin(true);
          }}
          className="rounded-xl bg-[#0ECCEE] px-6 py-3 font-semibold text-black"
        >
          Open login
        </button>
        <Link to={CAMPUS_HUNT_PATHS.event(slug)} className="text-sm text-[#0ECCEE] underline">
          Back to event
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

  if (bootError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0c0d] text-white">
        <p>{bootError}</p>
        <Link to={CAMPUS_HUNT_PATHS.event(slug)} className="text-[#0ECCEE] underline">
          Back
        </Link>
      </div>
    );
  }

  if (loading || !eventId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white">
        Loading your team…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0c0d] px-4 text-center text-white">
        <p className="text-lg font-semibold">No team assigned</p>
        <p className="text-sm text-white/60">{error}</p>
        <p className="text-xs text-white/40">Ask an admin to add you to a Campus Hunt team.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0c0d]">
      <PlayerPlayScreen
        data={data}
        onRefresh={refreshProgress}
        userId={user?._id || user?.id}
        eventSlug={slug}
      />
    </div>
  );
}
