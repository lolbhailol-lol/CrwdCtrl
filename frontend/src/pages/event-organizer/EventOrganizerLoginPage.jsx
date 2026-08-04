import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CalendarDays, Loader, ArrowLeft } from 'lucide-react';
import { eventOrganizerLogin } from '../../services/api/eventShowOrganizer.api';
import { setEventOrganizerSession } from '../../utils/eventShowOrganizerSession';
import { showAppPopup } from '../../utils/appPopup';

function resolvePostLoginPath(events, from) {
    if (from) return from;
    if (Array.isArray(events) && events.length === 1 && events[0]?._id) {
        return `/event-organizer/events/${events[0]._id}`;
    }
    return '/event-organizer';
}

export default function EventOrganizerLoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const from = new URLSearchParams(location.search).get('from') || location.state?.from;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await eventOrganizerLogin(username, password);
            setEventOrganizerSession({
                token: data.token,
                organizer: data.organizer,
                events: data.events || [],
            });
            showAppPopup({
                title: 'Signed in',
                message: 'Welcome to your event organizer panel.',
                tone: 'login',
            });
            navigate(resolvePostLoginPath(data.events, from), { replace: true });
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh bg-[#0f1011] flex items-center justify-center px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
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
                        <CalendarDays className="text-[#0ECCEE]" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Event organizer</h1>
                        <p className="text-xs text-gray-500">Guests, check-in & notifications</p>
                    </div>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Username</label>
                        <input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm text-white focus:outline-none focus:border-[#0ECCEE]/50"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm text-white focus:outline-none focus:border-[#0ECCEE]/50"
                            required
                        />
                    </div>
                    {error ? <p className="text-sm text-red-400">{error}</p> : null}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-[#0ECCEE] text-black font-bold text-sm disabled:opacity-60 inline-flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader className="animate-spin" size={16} /> : null}
                        Sign in
                    </button>
                </form>
                <p className="text-[11px] text-gray-600 mt-4 text-center">
                    Access is assigned by CrwdCtrl admin.
                </p>
            </div>
        </div>
    );
}
