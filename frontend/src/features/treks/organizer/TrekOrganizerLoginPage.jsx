import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Mountain, Loader } from 'lucide-react';
import { trekOrganizerLogin, tryTrekOrganizerAppSession } from '../../services/api/trekOrganizer.api';
import {
    isTrekOrganizerManualLogout,
    setTrekOrganizerSession,
} from '../../utils/trekOrganizerSession';
import { showAppPopup } from '../../utils/appPopup';
import { useAuth } from '../../context/AuthContext';
import DetailPageLoader from '../../components/DetailPageLoader';

function resolvePostLoginPath(treks, from) {
    if (from) return from;
    return '/trek-organizer';
}

function usePortalMeta() {
    useEffect(() => {
        const prevTitle = document.title;
        document.title = 'Trek Organizer Login | CrwdCtrl';
        let robots = document.querySelector('meta[name="robots"]');
        const created = !robots;
        if (!robots) {
            robots = document.createElement('meta');
            robots.setAttribute('name', 'robots');
            document.head.appendChild(robots);
        }
        const prevRobots = robots.getAttribute('content');
        robots.setAttribute('content', 'noindex, nofollow');
        return () => {
            document.title = prevTitle;
            if (created) robots.remove();
            else if (prevRobots != null) robots.setAttribute('content', prevRobots);
            else robots.removeAttribute('content');
        };
    }, []);
}

export default function TrekOrganizerLoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { isAuthenticated } = useAuth();
    const prefillUser = String(searchParams.get('u') || searchParams.get('username') || '').trim();
    const [username, setUsername] = useState(prefillUser);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [booting, setBooting] = useState(true);

    usePortalMeta();

    useEffect(() => {
        if (prefillUser) setUsername(prefillUser);
    }, [prefillUser]);

    useEffect(() => {
        let cancelled = false;
        const bootTimeout = window.setTimeout(() => {
            if (!cancelled) setBooting(false);
        }, 6000);

        (async () => {
            // After explicit Log out, stay on the form even if CrwdCtrl Firebase session is still active.
            if (!isAuthenticated || isTrekOrganizerManualLogout()) {
                if (!cancelled) setBooting(false);
                return;
            }
            try {
                const session = await tryTrekOrganizerAppSession();
                if (!cancelled && session?.token) {
                    navigate(resolvePostLoginPath(session.treks, location.state?.from), { replace: true });
                    return;
                }
            } catch (err) {
                if (!cancelled && err?.code === 'no_organizer_account') {
                    navigate('/trek-organizer/signup', { replace: true });
                    return;
                }
                /* fall through to manual login */
            }
            if (!cancelled) setBooting(false);
        })();
        return () => {
            cancelled = true;
            window.clearTimeout(bootTimeout);
        };
    }, [isAuthenticated, navigate, location.state?.from]);

    const skipAutoSession = () => {
        setBooting(false);
        setError('');
    };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await trekOrganizerLogin(username, password);
            setTrekOrganizerSession({
                token: data.token,
                organizer: data.organizer,
                community: data.community || null,
                treks: data.treks || [],
            });
            showAppPopup({
                title: 'Signed in successfully',
                message: 'Welcome to the trek organizer portal.',
                tone: 'login',
            });
            navigate(resolvePostLoginPath(data.treks, location.state?.from), { replace: true });
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    if (booting) {
        return (
            <div className="min-h-dvh bg-[#0f1011] flex flex-col items-center justify-center gap-4 px-4">
                <DetailPageLoader label="Checking your session" variant="trek" />
                <button
                    type="button"
                    onClick={skipAutoSession}
                    className="text-sm font-semibold text-[#0ECCEE] hover:underline"
                >
                    Sign in with username instead
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-[#0f1011] flex items-center justify-center px-4 py-6 pt-[max(1.5rem,var(--safe-top))] pb-[max(1.5rem,var(--safe-bottom))]">
            <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#161718] p-6 sm:p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="size-12 rounded-xl bg-[#0ECCEE]/15 flex items-center justify-center shrink-0">
                        <Mountain className="text-[#0ECCEE]" size={26} />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-white">Trek Organizer</h1>
                        <p className="text-xs sm:text-sm text-gray-500">Sign in to manage your treks</p>
                    </div>
                </div>

                <p className="text-[11px] text-gray-500 mb-4 rounded-lg border border-gray-800 bg-[#111213] px-3 py-2">
                    This is the trek organizer portal only — not fest, run club, or event community login.
                </p>

                {error ? (
                    <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-3 py-2.5 text-sm text-red-300">{error}</div>
                ) : null}

                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label htmlFor="organizer-username" className="block text-xs font-medium text-gray-400 mb-1.5">Username</label>
                        <input
                            id="organizer-username"
                            type="text"
                            inputMode="text"
                            autoCapitalize="none"
                            autoCorrect="off"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                            className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"
                            placeholder="Your trek organizer username"
                        />
                    </div>
                    <div>
                        <label htmlFor="organizer-password" className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                        <input
                            id="organizer-password"
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
                        className="w-full min-h-[48px] py-3.5 rounded-xl bg-[#0ECCEE] text-black text-base font-bold hover:opacity-90 active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 touch-manipulation"
                    >
                        {loading ? <Loader className="animate-spin" size={20} /> : null}
                        Sign in
                    </button>
                </form>
                <p className="text-[11px] text-gray-600 mt-5 text-center leading-relaxed">
                    New trek community? Ask CrwdCtrl to approve your email, then{' '}
                    <Link to="/trek-organizer/signup" className="text-[#0ECCEE] hover:underline">create your account</Link>.
                </p>
            </div>
        </div>
    );
}
