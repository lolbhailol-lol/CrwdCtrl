import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
    clearRunClubOrganizerSession,
    getRunClubOrganizerToken,
    isRunClubOrganizerTokenExpired,
} from '../../utils/runClubOrganizerSession';
import { tryRunClubOrganizerAppSession } from '../../services/api/runClubOrganizer.api';

export default function RunClubOrganizerProtectedRoute({ children }) {
    const location = useLocation();
    const [status, setStatus] = useState('checking');

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const token = getRunClubOrganizerToken();
            if (token && !isRunClubOrganizerTokenExpired(token)) {
                if (!cancelled) setStatus('authed');
                return;
            }
            if (token) clearRunClubOrganizerSession();

            const booted = await tryRunClubOrganizerAppSession().catch((err) => {
                if (err?.code === 'no_organizer_account') return { needsSignup: true };
                return null;
            });
            if (!cancelled) {
                if (booted?.needsSignup) setStatus('signup');
                else setStatus(booted ? 'authed' : 'guest');
            }
        })();

        return () => { cancelled = true; };
    }, []);

    if (status === 'checking') {
        return (
            <div className="min-h-dvh bg-[#0f1011] flex items-center justify-center text-sm text-gray-500">
                Opening club manager…
            </div>
        );
    }

    if (status === 'guest') {
        return <Navigate to="/run-club-organizer/login" replace state={{ from: location.pathname }} />;
    }

    if (status === 'signup') {
        return <Navigate to="/run-club-organizer/signup" replace state={{ from: location.pathname }} />;
    }

    return children;
}
