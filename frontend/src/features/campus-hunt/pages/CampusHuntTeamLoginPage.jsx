import { useParams, useSearchParams } from 'react-router-dom';
import TeamLoginForm from '../components/TeamLoginForm';
import { normalizeTeamCode } from '../utils/teamCode';

/** Shared team URL — password + tap name only. */
export default function CampusHuntTeamLoginPage() {
  const { slug, teamCode } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');
  const slot = Number(searchParams.get('slot') || 0);

  return (
    <TeamLoginForm
      slug={slug}
      initialCode={normalizeTeamCode(teamCode)}
      preselectRole={role}
      preselectSlot={slot}
    />
  );
}
