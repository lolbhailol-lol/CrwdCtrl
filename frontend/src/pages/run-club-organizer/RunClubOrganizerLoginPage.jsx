import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Footprints, Users, Loader, ArrowLeft } from 'lucide-react';
import { runClubOrganizerLogin, tryRunClubOrganizerAppSession } from '../../services/api/runClubOrganizer.api';
import { setRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';
import { isEventsListingHub, organizerHubCopy } from '../../utils/listingHubCopy';
import {
    organizerEventPath,
    organizerHomePath,
    organizerLoginPath,
    organizerSignupPath,
    isEventCommunityOrganizerPath,
    EVENT_COMMUNITY_ORGANIZER_BASE,
    RUN_CLUB_ORGANIZER_BASE,
} from '../../utils/organizerPortalPaths';
import { showAppPopup } from '../../utils/appPopup';
import { useAuth } from '../../context/AuthContext';
import DetailPageLoader from '../../components/DetailPageLoader';

function resolvePostLoginPath(events, from, isEventHub) {
    if (from) return from;
    if (Array.isArray(events) && events.length === 1 && events[0]?._id) {
        return organizerEventPath(events[0]._id, isEventHub);
    }
    return organizerHomePath(isEventHub);
}

function crwdCtrlLoginRedirect(isEventHub) {
    const returnTo = organizerLoginPath(isEventHub);
    return `/login?redirect=${encodeURIComponent(returnTo)}`;
}

export default function RunClubOrganizerLoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const isEventHub = isEventCommunityOrganizerPath(location.pathname)
        || searchParams.get('hub') === 'events';
    const copy = useMemo(() => organizerHubCopy(isEventHub), [isEventHub]);
    const HubIcon = isEventHub ? Users : Footprints;
    const hub = isEventHub ? 'events' : 'sports';
    const fromParam = searchParams.get('from') || location.state?.from || '';
    const returnTo = fromParam.startsWith('/') ? fromParam : '';
    const { isAuthenticated } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [booting, setBooting] = useState(true);

    useEffect(() => {
        if (
            location.pathname.startsWith(`${RUN_CLUB_ORGANIZER_BASE}/login`)
            && searchParams.get('hub') === 'events'
        ) {
            const params = new URLSearchParams(searchParams);
            params.delete('hub');
            const qs = params.toString();
            navigate(`${EVENT_COMMUNITY_ORGANIZER_BASE}/login${qs ? `?${qs}` : ''}`, { replace: true });
        }
    }, [location.pathname, navigate, searchParams]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!isAuthenticated) {
                if (!cancelled) setBooting(false);
                return;
            }
            try {
                const session = await tryRunClubOrganizerAppSession(null, hub);
                if (!cancelled && session?.token) {
                    navigate(resolvePostLoginPath(session.events, returnTo, isEventHub), { replace: true });
                    return;
                }
            } catch (err) {
                if (!cancelled && err?.code === 'no_organizer_account') {
                    navigate(organizerSignupPath(isEventHub), { replace: true });
                    return;
                }
                /* fall through to manual login */
            }
            if (!cancelled) setBooting(false);
        })();
        return () => { cancelled = true; };
    }, [isAuthenticated, navigate, returnTo, hub, isEventHub]);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await runClubOrganizerLogin(username, password);
            setRunClubOrganizerSession({
                token: data.token,
                organizer: data.organizer,
                runClub: data.runClub || null,
                events: data.events || [],
            });
            showAppPopup({
                title: 'Signed in successfully',
                message: organizerHubCopy(isEventsListingHub(data.runClub)).welcome,
                tone: 'login',
            });
            navigate(resolvePostLoginPath(data.events, returnTo, isEventsListingHub(data.runClub) || isEventHub), { replace: true });
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    if (booting) {
        return <DetailPageLoader label="Checking your session" />;
    }

    return (
        <div className="min-h-dvh bg-[#0f1011] flex items-center justify-center px-4 py-6 pt-[max(1.5rem,var(--safe-top))] pb-[max(1.5rem,var(--safe-bottom))]">
            <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#161718] p-6 sm:p-8 shadow-xl">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#0ECCEE] mb-5"
                >
                    <ArrowLeft size={14} /> Back to CrwdCtrl
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="size-12 rounded-xl bg-[#0ECCEE]/10 flex items-center justify-center">
                        <HubIcon className="text-[#0ECCEE]" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{copy.managerTitle}</h1>
                        <p className="text-xs text-gray-500">{copy.managerSubtitle}</p>
                    </div>
                </div>

                <p className="text-[11px] text-gray-500 mb-4 rounded-lg border border-gray-800 bg-[#111213] px-3 py-2">
                    {isEventHub
                        ? 'Sign in with the Google account that matches your invited email, or use your organizer username below.'
                        : 'Only your club can see participant details. CrwdCtrl approves access — you set your own password.'}
                </p>

                {!isAuthenticated ? (
                    <Link
                        to={crwdCtrlLoginRedirect(isEventHub)}
                        className="mb-4 flex w-full items-center justify-center gap-2 min-h-[48px] py-3 rounded-xl bg-white text-black text-sm font-bold hover:opacity-90"
                    >
                        Continue with CrwdCtrl sign-in
                    </Link>
                ) : null}

                {!isAuthenticated ? (
                    <p className="text-[11px] text-center text-gray-600 mb-4">or use organizer username</p>
                ) : null}

                {error ? (
                    <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-3 py-2.5 text-sm text-red-300">{error}</div>
                ) : null}

                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label htmlFor="rc-organizer-username" className="block text-xs font-medium text-gray-400 mb-1.5">Username</label>
                        <input
                            id="rc-organizer-username"
                            type="text"
                            autoCapitalize="none"
                            autoCorrect="off"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                            className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"
                            placeholder="Your username"
                        />
                    </div>
                    <div>
                        <label htmlFor="rc-organizer-password" className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                        <input
                            id="rc-organizer-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full min-h-[48px] py-3.5 rounded-xl bg-[#0ECCEE] text-black text-base font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader className="animate-spin" size={20} /> : null}
                        Sign in
                    </button>
                </form>
                <p className="text-[11px] text-gray-600 mt-5 text-center">
                    {isEventHub ? 'New community organizer?' : 'New club?'}{' '}
                    Ask CrwdCtrl to approve your email, then{' '}
                    <Link to={copy.signupPath} className="text-[#0ECCEE] hover:underline">create your account</Link>.
                </p>
            </div>
        </div>
    );
}
