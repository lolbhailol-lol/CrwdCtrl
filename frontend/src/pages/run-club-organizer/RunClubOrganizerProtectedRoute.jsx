import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
    clearRunClubOrganizerSession,
    getRunClubOrganizerToken,
    isRunClubOrganizerTokenExpired,
    getRunClubOrganizerSession,
    isRunClubOrganizerManualLogout,
} from '../../utils/runClubOrganizerSession';
import {
    tryRunClubOrganizerAppSession,
    organizerSessionMatchesHub,
} from '../../services/api/runClubOrganizer.api';
import {
    organizerLoginPath,
    organizerSignupPath,
    toEventCommunityOrganizerPath,
} from '../../utils/organizerPortalPaths';
import { isEventsListingHub } from '../../utils/listingHubCopy';
import DetailPageLoader from '../../components/DetailPageLoader';

async function bootOrganizerSession(forcedHub = '') {
    const token = getRunClubOrganizerToken();
    if (token && !isRunClubOrganizerTokenExpired(token)) {
        const session = getRunClubOrganizerSession();
        if (!forcedHub || organizerSessionMatchesHub(session, forcedHub)) {
            return { status: 'authed' };
        }
        clearRunClubOrganizerSession();
    } else if (token) {
        clearRunClubOrganizerSession();
    }

    if (isRunClubOrganizerManualLogout()) {
        return { status: 'guest', hub: forcedHub || '' };
    }

    const hubs = forcedHub
        ? [forcedHub]
        : ['events', 'sports', ''];

    let signupHub = '';
    for (const hub of hubs) {
        try {
            const booted = await tryRunClubOrganizerAppSession(null, hub);
            if (booted?.token) return { status: 'authed' };
        } catch (err) {
            if (err?.code === 'no_organizer_account') {
                signupHub = hub || signupHub;
            }
        }
    }

    if (signupHub === 'events') return { status: 'signup', hub: 'events' };
    if (signupHub === 'sports') return { status: 'signup', hub: 'sports' };
    return { status: 'guest', hub: forcedHub || '' };
}

export default function RunClubOrganizerProtectedRoute({ children, forcedHub = '' }) {
    const location = useLocation();
    const isEventPortal = forcedHub === 'events';
    const [status, setStatus] = useState('checking');
    const [redirectHub, setRedirectHub] = useState(forcedHub);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const result = await bootOrganizerSession(forcedHub);
            if (cancelled) return;
            setRedirectHub(result.hub || forcedHub);
            setStatus(result.status);
        })();

        return () => { cancelled = true; };
    }, [forcedHub]);

    if (status === 'checking') {
        return <DetailPageLoader label={isEventPortal ? 'Opening event organizer portal' : 'Opening club manager portal'} />;
    }

    if (status === 'guest') {
        return (
            <Navigate
                to={organizerLoginPath(isEventPortal || redirectHub === 'events', location.pathname)}
                replace
                state={{ from: location.pathname, hub: redirectHub || undefined }}
            />
        );
    }

    if (status === 'signup') {
        return (
            <Navigate
                to={organizerSignupPath(isEventPortal || redirectHub === 'events')}
                replace
                state={{ from: location.pathname, hub: redirectHub || undefined }}
            />
        );
    }

    const legacyRedirect = !isEventPortal && isEventsListingHub(getRunClubOrganizerSession()?.runClub)
        ? toEventCommunityOrganizerPath(location.pathname, location.search)
        : null;
    if (legacyRedirect) {
        return <Navigate to={legacyRedirect} replace />;
    }

    return children;
}
