import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fetchEventBySlug } from '../services/campusHunt.api';
import { useHuntTeam } from '../hooks/useHuntTeam';
import PlayerPlayScreen from '../player/PlayerPlayScreen';
import { CAMPUS_HUNT_PATHS } from '../config';
import { readHuntSession } from '../utils/huntSession';

export default function CampusHuntPlayPage() {
  const { slug } = useParams();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [eventId, setEventId] = useState(null);
  const [bootError, setBootError] = useState('');
  const saved = readHuntSession();
  const teamLoginFallback = saved?.slug === slug && saved?.teamLoginPath
    ? saved.teamLoginPath
    : CAMPUS_HUNT_PATHS.event(slug);

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

  const { data, loading, error, refreshProgress, applyActionData } = useHuntTeam(
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
    return <Navigate to={teamLoginFallback} replace />;
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
    const sessionGone = /auth|login|session|401/i.test(String(error));
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0c0d] px-4 text-center text-white">
        <p className="text-lg font-semibold">
          {sessionGone ? 'Session expired' : 'No team assigned'}
        </p>
        <p className="text-sm text-white/60">{error}</p>
        <p className="text-xs text-white/45">
          Open your team link once — password + tap your name. Then you stay logged in.
        </p>
        <Link
          to={teamLoginFallback}
          className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black"
        >
          Open team login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0c0d]">
      <PlayerPlayScreen
        data={data}
        onRefresh={refreshProgress}
        onActionResult={applyActionData}
        userId={user?._id || user?.id}
        eventSlug={slug}
      />
    </div>
  );
}
