import { publicRoutes } from './publicRoutes';
import { adminRoutes } from './adminRoutes';
import { organizerRoutes } from './organizerRoutes';
import { trekOrganizerRoutes } from './trekOrganizerRoutes';
import { festOrganizerRoutes } from './festOrganizerRoutes';
import { runClubOrganizerRoutes } from './runClubOrganizerRoutes';
import { eventOrganizerRoutes } from './eventOrganizerRoutes';

/** Route elements for use inside <Routes> — must be JSX, not a wrapper component. */
export const appRoutes = (
  <>
    {publicRoutes}
    {organizerRoutes}
    {trekOrganizerRoutes}
    {festOrganizerRoutes}
    {runClubOrganizerRoutes}
    {eventOrganizerRoutes}
    {adminRoutes}
  </>
);

export * from './lazyPages';
