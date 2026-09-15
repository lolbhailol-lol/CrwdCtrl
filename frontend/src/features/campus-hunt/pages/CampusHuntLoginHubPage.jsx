import { Navigate, useParams } from 'react-router-dom';
import { CAMPUS_HUNT_PATHS } from '../config';

/** Old /login hub removed — send people to the event page. */
export default function CampusHuntLoginHubPage() {
  const { slug } = useParams();
  return <Navigate to={CAMPUS_HUNT_PATHS.event(slug)} replace />;
}
