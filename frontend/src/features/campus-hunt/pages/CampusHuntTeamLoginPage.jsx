import { useParams } from 'react-router-dom';
import TeamLoginForm from '../components/TeamLoginForm';
import { normalizeTeamCode } from '../utils/teamCode';

/** Shared team URL — password enters as Team Leader. */
export default function CampusHuntTeamLoginPage() {
  const { slug, teamCode } = useParams();

  return (
    <TeamLoginForm
      slug={slug}
      initialCode={normalizeTeamCode(teamCode)}
    />
  );
}
