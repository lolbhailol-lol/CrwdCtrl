import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fetchEventBySlug } from '../services/campusHunt.api';
import { useHuntTeam } from '../hooks/useHuntTeam';
import { useFinaleTeam } from '../hooks/useFinaleTeam';
import PlayerPlayScreen from '../player/PlayerPlayScreen';
import FinalePlayScreen from '../player/FinalePlayScreen';
import PlayerRoundsHub from '../player/PlayerRoundsHub';
import { CAMPUS_HUNT_PATHS } from '../config';
import { readHuntSession } from '../utils/huntSession';

const VALID_ROUNDS = new Set(['round1', 'survival', 'finale']);

export default function CampusHuntPlayPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [eventId, setEventId] = useState(null);
  const [bootError, setBootError] = useState('');
  const saved = readHuntSession();
  const teamLoginFallback = saved?.slug === slug && saved?.teamLoginPath
    ? saved.teamLoginPath
    : CAMPUS_HUNT_PATHS.event(slug);

  const roundParam = String(searchParams.get('round') || '').toLowerCase();
  const activeRound = VALID_ROUNDS.has(roundParam) ? roundParam : null;

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

  // Always load Round 1 team payload (includes rounds hub). Pause while deep in Finals play.
  const hunt = useHuntTeam(isAuthenticated ? eventId : null, {
    enabled: Boolean(isAuthenticated && eventId) && activeRound !== 'finale',
  });
  const finale = useFinaleTeam(
    isAuthenticated && eventId && activeRound === 'finale' ? eventId : null,
  );

  const loading = hunt.loading && !hunt.data;
  const error = hunt.error;

  const openRound = (id) => {
    setSearchParams({ round: id }, { replace: false });
  };

  const backToHub = () => {
    setSearchParams({}, { replace: false });
  };

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

  if (error && !hunt.data) {
    const sessionGone = /auth|login|session|401/i.test(String(error));
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0c0d] px-4 text-center text-white">
        <p className="text-lg font-semibold">
          {sessionGone ? 'Session expired' : 'No team assigned'}
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

  const rounds = hunt.data?.rounds || [];
  const roundsReady = Array.isArray(hunt.data?.rounds);

  // Wait for hub payload before opening a deep-linked round
  if (activeRound && !roundsReady && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white">
        Loading rounds…
      </div>
    );
  }

  const roundCard = activeRound
    ? rounds.find((r) => r.id === activeRound)
    : null;

  // Guard: deep link to locked / unknown round → bounce to hub
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
        <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white">
          Loading Finals…
        </div>
      );
    }
    if (!finale.data) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0c0d] px-4 text-center text-white">
          <p className="text-lg font-semibold">Finale not ready</p>
          <p className="text-sm text-white/60">{finale.error || 'Waiting for organizer…'}</p>
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
          teamId={finale.teamId || hunt.data?.team?.id}
          onRefresh={finale.refresh}
          onActionResult={finale.applyActionData}
          eventSlug={slug}
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
          userId={user?._id || user?.id}
          eventSlug={slug}
        />
      </div>
    );
  }

  // Default: round picker hub (do not auto-jump to Finals)
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
        onOpenRound={openRound}
      />
    </div>
  );
}
