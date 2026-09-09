import { getRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';
import { isEventsListingHub } from '../../utils/listingHubCopy';
import RunClubOrganizerLayout from '../run-club-organizer/RunClubOrganizerLayout';
import RunClubOrganizerHomePage from '../run-club-organizer/RunClubOrganizerHomePage';
import RunClubOrganizerDashboardPage from '../run-club-organizer/RunClubOrganizerDashboardPage';
import EventCommunityOrganizerLayout from './EventCommunityOrganizerLayout';
import EventCommunityOrganizerHomePage from './EventCommunityOrganizerHomePage';
import EventCommunityOrganizerDashboardPage from './EventCommunityOrganizerDashboardPage';
import EventCommunityOrganizerNotificationsPage from './EventCommunityOrganizerNotificationsPage';
import RunClubOrganizerNotificationsPage from '../run-club-organizer/RunClubOrganizerNotificationsPage';

function isEventCommunityOrganizer() {
    return isEventsListingHub(getRunClubOrganizerSession()?.runClub);
}

export function OrganizerLayoutGate() {
    return isEventCommunityOrganizer()
        ? <EventCommunityOrganizerLayout />
        : <RunClubOrganizerLayout />;
}

export function OrganizerHomeGate() {
    return isEventCommunityOrganizer()
        ? <EventCommunityOrganizerHomePage />
        : <RunClubOrganizerHomePage />;
}

export function OrganizerDashboardGate() {
    return isEventCommunityOrganizer()
        ? <EventCommunityOrganizerDashboardPage />
        : <RunClubOrganizerDashboardPage />;
}

export function OrganizerNotificationsGate() {
    return isEventCommunityOrganizer()
        ? <EventCommunityOrganizerNotificationsPage />
        : <RunClubOrganizerNotificationsPage />;
}
