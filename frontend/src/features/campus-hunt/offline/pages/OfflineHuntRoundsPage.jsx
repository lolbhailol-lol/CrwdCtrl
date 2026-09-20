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
        Loading…
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
      label: 'The Hunt',
      subtitle: 'Offline',
      detail: waiting ? 'Start when ready.' : 'Continue.',
      open: true,
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
      intro="Leader phone only."
      onOpenRound={(id) => {
        if (id === 'round1') navigate(CAMPUS_HUNT_PATHS.offlinePlay);
      }}
      onSwitchPerson={() => navigate(CAMPUS_HUNT_PATHS.offlineTeam)}
      switchLabel="← Team"
    />
  );
}
