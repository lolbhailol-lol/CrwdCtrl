import { publicRoutes } from './publicRoutes';
import { adminRoutes } from './adminRoutes';
import { organizerRoutes } from './organizerRoutes';
import { trekOrganizerRoutes } from './trekOrganizerRoutes';

/** Route elements for use inside <Routes> — must be JSX, not a wrapper component. */
export const appRoutes = (
  <>
    {publicRoutes}
    {organizerRoutes}
    {trekOrganizerRoutes}
    {adminRoutes}
  </>
);

export * from './lazyPages';
