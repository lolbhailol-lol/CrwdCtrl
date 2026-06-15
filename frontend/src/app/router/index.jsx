import { publicRoutes } from './publicRoutes';
import { adminRoutes } from './adminRoutes';
import { organizerRoutes } from './organizerRoutes';

/** Route elements for use inside <Routes> — must be JSX, not a wrapper component. */
export const appRoutes = (
  <>
    {publicRoutes}
    {organizerRoutes}
    {adminRoutes}
  </>
);

export * from './lazyPages';
