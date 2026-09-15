import { getRunClubOrganizerSession } from '../../../../utils/runClubOrganizerSession';
import { isEventsListingHub } from '../../../../utils/listingHubCopy';
import RunClubOrganizerLayout from '../../../sports/organizer/RunClubOrganizerLayout';
import RunClubOrganizerHomePage from '../../../sports/organizer/RunClubOrganizerHomePage';
import RunClubOrganizerDashboardPage from '../../../sports/organizer/RunClubOrganizerDashboardPage';
import RunClubOrganizerNotificationsPage from '../../../sports/organizer/RunClubOrganizerNotificationsPage';
import EventCommunityOrganizerLayout from './EventCommunityOrganizerLayout';
import EventCommunityOrganizerHomePage from './EventCommunityOrganizerHomePage';
import EventCommunityOrganizerDashboardPage from './EventCommunityOrganizerDashboardPage';
import EventCommunityOrganizerNotificationsPage from './EventCommunityOrganizerNotificationsPage';

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
