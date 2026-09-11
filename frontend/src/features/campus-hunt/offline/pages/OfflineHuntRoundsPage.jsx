import { Navigate, useNavigate } from 'react-router-dom';
import PlayerRoundsHub from '../../player/PlayerRoundsHub';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { isHuntWaiting } from '../offlineEngine';
import { useOfflineHuntSession } from '../useOfflineHuntSession';

export default function OfflineHuntRoundsPage() {
  const navigate = useNavigate();
  const { bundle, session, state, loading } = useOfflineHuntSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white/60">
        Loading rounds…
      </div>
    );
  }

  if (!bundle || !session) {
    return <Navigate to={CAMPUS_HUNT_PATHS.offlineLogin} replace />;
  }

  const waiting = isHuntWaiting(state);
  const rounds = [
    {
      id: 'round1',
      label: 'Campus Hunt',
      subtitle: 'Offline',
      detail: waiting
        ? 'Meet at the start desk. Leader starts Round 1 there.'
        : 'Continue Round 1.',
      open: true,
    },
    {
      id: 'survival',
      label: 'Survival',
      detail: 'Not in Offline Event Mode.',
      open: false,
      lockedReason: 'Locked for this offline hunt.',
    },
    {
      id: 'finale',
      label: 'Finals',
      detail: 'Not in Offline Event Mode.',
      open: false,
      lockedReason: 'Locked for this offline hunt.',
    },
  ];

  return (
    <PlayerRoundsHub
      team={{
        teamCode: bundle.team.teamCode,
        teamName: bundle.team.teamName,
        currentScore: state?.score,
        isLeader: session.role === 'leader',
        myName: session.name,
      }}
      eventName={bundle.event?.name}
      rounds={rounds}
      lastRound="round1"
      intro="Tap Round 1 only when your team is at the start desk. Survival and Finals stay locked."
      onOpenRound={(id) => {
        if (id === 'round1') navigate(CAMPUS_HUNT_PATHS.offlinePlay);
      }}
      onSwitchPerson={() => navigate(CAMPUS_HUNT_PATHS.offlineTeam)}
      switchLabel="← Back to team"
    />
  );
}
