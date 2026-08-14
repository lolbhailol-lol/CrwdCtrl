import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchEventBySlug } from '../services/campusHunt.api';
import { useHuntTeam } from '../hooks/useHuntTeam';
import { useFinaleTeam } from '../hooks/useFinaleTeam';
import useHuntAuth from '../hooks/useHuntAuth';
import PlayerPlayScreen from '../player/PlayerPlayScreen';
import FinalePlayScreen from '../player/FinalePlayScreen';
import PlayerRoundsHub from '../player/PlayerRoundsHub';
import { CAMPUS_HUNT_PATHS } from '../config';
import {
  clearHuntLastRound,
  readHuntSession,
  setHuntLastRound,
} from '../utils/huntSession';

const VALID_ROUNDS = new Set(['round1', 'survival', 'finale']);
const RESUMABLE_ROUNDS = new Set(['round1', 'finale']);

export default function CampusHuntPlayPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isHuntAuthenticated,
    claims: huntClaims,
    meta: huntMeta,
    clearHuntAuth,
  } = useHuntAuth();
  const [eventId, setEventId] = useState(() => huntClaims?.huntEventId || null);
  const [bootError, setBootError] = useState('');
  const saved = readHuntSession();
  const teamLoginFallback = saved?.slug === slug && saved?.teamLoginPath
    ? saved.teamLoginPath
    : CAMPUS_HUNT_PATHS.event(slug);

  const roundParam = String(searchParams.get('round') || '').toLowerCase();
  const urlRound = VALID_ROUNDS.has(roundParam) ? roundParam : null;

  useEffect(() => {
    if (!eventId && huntClaims?.huntEventId) {
      setEventId(huntClaims.huntEventId);
    }
  }, [eventId, huntClaims?.huntEventId]);

  useEffect(() => {
    if (eventId) return undefined;
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
  }, [slug, eventId]);

  const hunt = useHuntTeam(isHuntAuthenticated ? eventId : null, {
    enabled: Boolean(isHuntAuthenticated && eventId),
  });
  const wantFinale = urlRound === 'finale'
    || (!urlRound && saved?.lastRound === 'finale');
  const finale = useFinaleTeam(
    isHuntAuthenticated && eventId && wantFinale ? eventId : null,
  );

  useEffect(() => {
    const eventSlug = hunt.data?.event?.slug;
    if (eventSlug && slug && eventSlug !== slug) {
      navigate(teamLoginFallback, { replace: true });
    }
  }, [hunt.data?.event?.slug, slug, navigate, teamLoginFallback]);

  const loading = hunt.loading && !hunt.data;
  const error = hunt.error;

  const openRound = (id) => {
    if (RESUMABLE_ROUNDS.has(id)) setHuntLastRound(id);
    setSearchParams({ round: id }, { replace: false });
  };

  const backToHub = () => {
    clearHuntLastRound();
    setSearchParams({}, { replace: false });
  };

  const switchPerson = () => {
    clearHuntLastRound();
    clearHuntAuth();
    navigate(teamLoginFallback, { replace: true });
  };

  const rounds = hunt.data?.rounds || [];
  const roundsReady = Array.isArray(hunt.data?.rounds);
  const lastRound = saved?.lastRound;
  const lastCard = rounds.find((r) => r.id === lastRound);
  const resumeRound = !urlRound
    && roundsReady
    && RESUMABLE_ROUNDS.has(lastRound)
    && lastCard?.open
    && !lastCard.comingSoon
    ? lastRound
    : null;
  const activeRound = urlRound || resumeRound;

  useEffect(() => {
    if (RESUMABLE_ROUNDS.has(activeRound)) setHuntLastRound(activeRound);
  }, [activeRound]);

  useEffect(() => {
    if (!resumeRound || urlRound) return;
    setSearchParams({ round: resumeRound }, { replace: true });
  }, [resumeRound, urlRound, setSearchParams]);

  const playerUserId = useMemo(
    () => huntMeta?.userId || huntClaims?.userId || hunt.data?.team?.myUserId || null,
    [huntMeta?.userId, huntClaims?.userId, hunt.data?.team?.myUserId],
  );

  if (!isHuntAuthenticated) {
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0c0d] px-4 text-center text-white">
        <p>Loading your team…</p>
        {eventId ? (
          <button
            type="button"
            onClick={() => hunt.refresh?.({ force: true })}
            className="text-sm text-[#0ECCEE] underline"
          >
            Taking too long? Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (error && !hunt.data) {
    const sessionGone = /auth|login|session|401/i.test(String(error));
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0c0d] px-4 text-center text-white">
        <p className="text-lg font-semibold">
          {sessionGone ? 'Hunt session expired' : 'No team assigned'}
        </p>
        <p className="text-sm text-white/60">{error}</p>
        <Link
          to={teamLoginFallback}
          className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black"
        >
          Open team login
        </Link>
      </div>
    );
  }

  if (activeRound && !roundsReady && !error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0c0d] px-4 text-center text-white">
        <p>Loading rounds…</p>
        <button
          type="button"
          onClick={() => hunt.refresh?.({ force: true })}
          className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black"
        >
          Retry
        </button>
      </div>
    );
  }

  const roundCard = activeRound
    ? rounds.find((r) => r.id === activeRound)
    : null;

  if (activeRound && roundsReady && (!roundCard || !roundCard.open)) {
    return (
      <div className="min-h-screen bg-[#0b0c0d]">
        <div className="mx-auto max-w-lg px-4 py-10 text-center text-white">
          <p className="text-lg font-semibold">
            {roundCard?.label || 'This round'} is locked
          </p>
          <p className="mt-2 text-sm text-white/55">
            {roundCard?.lockedReason || 'Wait for organizers to open this round.'}
          </p>
          <button
            type="button"
            onClick={backToHub}
            className="mt-6 rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black"
          >
            Back to rounds
          </button>
        </div>
      </div>
    );
  }

  if (activeRound === 'finale') {
    if (finale.loading && !finale.data) {
      return (
        <div className="min-h-screen bg-[#0b0c0d] text-white">
          <div className="mx-auto max-w-lg animate-pulse px-4 pb-10 pt-8">
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="mt-3 h-7 w-40 rounded bg-white/15" />
            <div className="mt-2 h-4 w-56 rounded bg-white/10" />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl border border-white/10 bg-white/[0.04]" />
              ))}
            </div>
            <p className="mt-8 text-center text-xs text-white/35">Opening Finals…</p>
          </div>
        </div>
      );
    }
    if (!finale.data) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0c0d] px-4 text-center text-white">
          <p className="text-lg font-semibold">
            {finale.error ? 'Couldn’t load Finals' : 'Finale not ready'}
          </p>
          <p className="text-sm text-white/60">{finale.error || 'Waiting for organizer…'}</p>
          <button
            type="button"
            onClick={() => finale.refresh()}
            className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black"
          >
            Try again
          </button>
          <button type="button" onClick={backToHub} className="text-[#0ECCEE] underline">
            Back to rounds
          </button>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#0b0c0d]">
        <FinalePlayScreen
          data={finale.data}
          teamMeta={finale.teamMeta || hunt.data?.team}
          eventMeta={hunt.data?.event}
          teamId={finale.teamId || hunt.data?.team?.id}
          onRefresh={finale.refresh}
          onActionResult={finale.applyActionData}
          eventSlug={slug}
          onLeaveRound={clearHuntLastRound}
          pollError={finale.pollError || finale.error}
        />
      </div>
    );
  }

  if (activeRound === 'survival') {
    return (
      <div className="min-h-screen bg-[#0b0c0d]">
        <div className="mx-auto max-w-lg px-4 py-10 text-center text-white">
          <p className="text-lg font-semibold">Survival</p>
          <p className="mt-2 text-sm text-white/55">
            Survival stage play is not open yet. Check back when organizers unlock it.
          </p>
          <button
            type="button"
            onClick={backToHub}
            className="mt-6 rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black"
          >
            Back to rounds
          </button>
        </div>
      </div>
    );
  }

  if (activeRound === 'round1') {
    return (
      <div className="min-h-screen bg-[#0b0c0d]">
        <PlayerPlayScreen
          data={hunt.data}
          onRefresh={hunt.refreshProgress}
          onActionResult={hunt.applyActionData}
          userId={playerUserId}
          eventSlug={slug}
          onLeaveRound={clearHuntLastRound}
          pollError={hunt.pollError}
        />
      </div>
    );
  }

  if (!roundsReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white">
        Loading rounds…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0c0d]">
      <PlayerRoundsHub
        team={hunt.data?.team}
        rounds={rounds}
        eventName={hunt.data?.event?.name}
        lastRound={saved?.lastRound || null}
        onOpenRound={openRound}
        onSwitchPerson={switchPerson}
      />
    </div>
  );
}
