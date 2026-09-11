import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVolunteerSession } from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';
import VolunteerCheckpointScreen from '../volunteer/VolunteerCheckpointScreen';

export default function VolunteerCheckpointPage() {
  const navigate = useNavigate();
  const session = getVolunteerSession();

  useEffect(() => {
    if (!session?.token) {
      navigate(CAMPUS_HUNT_PATHS.volunteerLogin, { replace: true });
    }
  }, [session, navigate]);

  if (!session?.token) return null;

  return (
    <VolunteerCheckpointScreen
      onLogout={() => navigate(CAMPUS_HUNT_PATHS.volunteerLogin, { replace: true })}
    />
  );
}
