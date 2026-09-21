import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchEventBySlug } from '../services/campusHunt.api';
import { useHuntTeam } from '../hooks/useHuntTeam';
import useHuntAuth from '../hooks/useHuntAuth';
import PlayerPlayScreen from '../player/PlayerPlayScreen';
import PlayerRoundsHub from '../player/PlayerRoundsHub';
import { CAMPUS_HUNT_PATHS } from '../config';
import { isHuntAuthenticated as huntTokenPresent } from '../utils/huntAuth';
import {
  clearHuntLastRound,
  readHuntSession,
  setHuntLastRound,
} from '../utils/huntSession';

const VALID_ROUNDS = new Set(['round1']);
const RESUMABLE_ROUNDS = new Set(['round1']);

function roundIsLive(card) {
  return String(card?.statusHint || '').toLowerCase() === 'live';
}

function teamIsInLivePlay(team) {
  const stage = String(team?.currentStage || '');
  if (!stage || stage === 'WAITING' || stage === 'SCORE_LOCKED') return false;
  const released = Boolean(
    team?.actualStartAt
    || ['RELEASED', 'ACTIVE', 'COMPLETED'].includes(String(team?.startStatus || '')),
  );
  return released || stage.includes('ACTIVE') || stage.includes('COMPLETED');
}

/** Drop Survival / Finale leftovers from any cached API response. */
function singleHuntRounds(rounds) {
  const list = Array.isArray(rounds) ? rounds : [];
  return list.filter((c) => {
    const id = String(c?.id || '').toLowerCase();
    return id === 'round1' || (!id.includes('survival') && !id.includes('finale'));
  }).map((c) => (
    String(c.id).toLowerCase() === 'round1' || !c.id
      ? { ...c, id: 'round1', label: c.label === 'The Hunt' ? 'Campus Hunt Challenge' : c.label }
      : c
  ));
}

function HubBoot({ team, eventName, lastRound, onOpenRound, onSwitchPerson, rounds = [] }) {
  return (
    <div className="min-h-screen bg-[#0b0c0d]">
      <PlayerRoundsHub
        team={team}
        rounds={rounds}
        eventName={eventName}
        lastRound={lastRound}
        onOpenRound={onOpenRound}
        onSwitchPerson={onSwitchPerson}
      />
    </div>
  );
}

export default function CampusHuntPlayPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isHuntAuthenticated,
    claims: huntClaims,
    meta: huntMeta,
    clearHuntAuth,
  } = useHuntAuth();
  const enrolled = isHuntAuthenticated || huntTokenPresent();
  const bootstrap = location.state?.huntBootstrap || null;
  const [eventId, setEventId] = useState(
    () => huntClaims?.huntEventId || bootstrap?.event?.id || null,
  );
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

  const hunt = useHuntTeam(enrolled ? eventId : null, {
    enabled: Boolean(enrolled && eventId),
    initialData: bootstrap,
  });

  useEffect(() => {
    const eventSlug = hunt.data?.event?.slug;
    if (eventSlug && slug && eventSlug !== slug) {
      navigate(teamLoginFallback, { replace: true });
    }
  }, [hunt.data?.event?.slug, slug, navigate, teamLoginFallback]);

  const error = hunt.error;

  const openRound = (id) => {
    if (RESUMABLE_ROUNDS.has(id)) setHuntLastRound(id);
    setSearchParams({ round: id }, { replace: false });
  };

  const switchPerson = () => {
    clearHuntLastRound();
    clearHuntAuth();
    navigate(teamLoginFallback, { replace: true });
  };

  const rounds = singleHuntRounds(hunt.data?.rounds || []);
  const roundsReady = Array.isArray(hunt.data?.rounds);
  const lastRound = saved?.lastRound === 'round1' ? 'round1' : null;
  const lastCard = rounds.find((r) => r.id === lastRound);
  const canResume = Boolean(
    lastCard?.open
    && !lastCard.comingSoon
    && (roundIsLive(lastCard) || teamIsInLivePlay(hunt.data?.team)),
  );
  const resumeRound = !urlRound
    && roundsReady
    && RESUMABLE_ROUNDS.has(lastRound)
    && canResume
    ? lastRound
    : null;
  // Single-game: skip Survival/Finale hub — open the hunt when live / resumable.
  const onlyHunt = roundsReady && rounds.length === 1 && rounds[0]?.id === 'round1';
  const autoOpen = !urlRound && onlyHunt && rounds[0]?.open && !rounds[0]?.comingSoon
    ? 'round1'
    : null;
  const activeRound = urlRound || resumeRound || autoOpen;

  useEffect(() => {
    if (RESUMABLE_ROUNDS.has(activeRound)) setHuntLastRound(activeRound);
  }, [activeRound]);

  useEffect(() => {
    if (!resumeRound || urlRound) return;
    setSearchParams({ round: resumeRound }, { replace: true });
  }, [resumeRound, urlRound, setSearchParams]);

  useEffect(() => {
    if (!roundsReady || !urlRound) return;
    const card = rounds.find((r) => r.id === urlRound);
    if (!card || !card.open || card.comingSoon) {
      clearHuntLastRound();
      setSearchParams({}, { replace: true });
    }
  }, [roundsReady, urlRound, rounds, setSearchParams]);

  const playerUserId = useMemo(
    () => huntMeta?.userId || huntClaims?.userId || hunt.data?.team?.myUserId || null,
    [huntMeta?.userId, huntClaims?.userId, hunt.data?.team?.myUserId],
  );

  if (!enrolled) {
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

  const hubProps = {
    team: hunt.data?.team || { teamCode: saved?.teamCode },
    eventName: hunt.data?.event?.name,
    lastRound: saved?.lastRound || null,
    onOpenRound: openRound,
    onSwitchPerson: switchPerson,
  };

  // Never drop into a blank play screen while event/team is still resolving.
  if (!eventId || (!roundsReady && !hunt.data?.team)) {
    return <HubBoot {...hubProps} />;
  }

  if (error && !hunt.data) {
    const sessionGone = /auth|login|session|401/i.test(String(error));
    const networkIssue = /network|timeout|fetch|signal|slow/i.test(String(error));
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0c0d] px-4 text-center text-white">
        <p className="text-lg font-semibold">
          {sessionGone
            ? 'Hunt session expired'
            : networkIssue
              ? 'Could not reach hunt server'
              : 'No team assigned'}
        </p>
        <p className="text-sm text-white/60">{error}</p>
        {networkIssue ? (
          <button
            type="button"
            onClick={() => hunt.refresh({ force: true })}
            className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black"
          >
            Retry
          </button>
        ) : (
          <Link
            to={teamLoginFallback}
            className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black"
          >
            Open team login
          </Link>
        )}
      </div>
    );
  }

  const roundCard = activeRound
    ? rounds.find((r) => r.id === activeRound)
    : null;

  if (activeRound && roundsReady && (!roundCard || !roundCard.open)) {
    return <HubBoot {...hubProps} rounds={rounds} />;
  }

  if (activeRound === 'round1') {
    if (!hunt.data?.team) {
      return <HubBoot {...hubProps} />;
    }
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
          roundLabel="Campus Hunt Challenge"
        />
      </div>
    );
  }

  if (!roundsReady) {
    return <HubBoot {...hubProps} />;
  }

  return <HubBoot {...hubProps} rounds={rounds} />;
}
