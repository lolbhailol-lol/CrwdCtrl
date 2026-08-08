import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Loader, ArrowLeft } from 'lucide-react';
import {
    eventOrganizerSignup,
    fetchEventOrganizerSignupEvents,
} from '../../services/api/eventShowOrganizer.api';

export default function EventOrganizerSignupPage() {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [eventShowId, setEventShowId] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchEventOrganizerSignupEvents();
                if (!cancelled) {
                    setEvents(data.events || []);
                    if (data.events?.length === 1) setEventShowId(String(data.events[0].id));
                }
            } catch (e) {
                if (!cancelled) setError(e.message || 'Failed to load events');
            } finally {
                if (!cancelled) setLoadingEvents(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!email.trim()) {
            setError('Email is required — use the email CrwdCtrl approved for Event organizer');
            return;
        }
        if (!eventShowId) {
            setError('Select your event');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        try {
            const data = await eventOrganizerSignup({
                name: name.trim(),
                username: username.trim().toLowerCase(),
                password,
                phone: phone.trim(),
                email: email.trim().toLowerCase(),
                eventShowId,
            });
            setSuccess(data.message || 'Account created. Await CrwdCtrl approval before signing in.');
            setTimeout(() => navigate('/event-organizer/login', { replace: true }), 2200);
        } catch (err) {
            setError(err.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

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
                        <CalendarDays className="text-[#0ECCEE]" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Create event organizer account</h1>
                        <p className="text-xs text-gray-500">Invite-only — then CrwdCtrl approves login</p>
                    </div>
                </div>

                <p className="text-[11px] text-gray-500 mb-4 rounded-lg border border-gray-800 bg-[#111213] px-3 py-2">
                    Use the same email CrwdCtrl added under Profile emails. After signup, wait for account approval before signing in.
                </p>

                {error ? (
                    <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-3 py-2.5 text-sm text-red-300">{error}</div>
                ) : null}
                {success ? (
                    <div className="mb-4 rounded-lg border border-emerald-800 bg-emerald-900/20 px-3 py-2.5 text-sm text-emerald-300">{success}</div>
                ) : null}

                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Approved email</label>
                        <input
                            required
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"
                            placeholder="you@event.com"
                            autoComplete="email"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Your name</label>
                        <input
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"
                            placeholder="Display name"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Event</label>
                        {loadingEvents ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
                                <Loader className="animate-spin" size={16} /> Loading events…
                            </div>
                        ) : (
                            <select
                                required
                                value={eventShowId}
                                onChange={(e) => setEventShowId(e.target.value)}
                                className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"
                            >
                                <option value="">Select your event</option>
                                {events.map((ev) => (
                                    <option key={ev.id} value={ev.id}>
                                        {ev.title}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Username</label>
                        <input
                            required
                            autoCapitalize="none"
                            autoCorrect="off"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base font-mono focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"
                            placeholder="e.g. event_manager"
                            minLength={3}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                        <input
                            required
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"
                            placeholder="Min 8 characters"
                            minLength={8}
                            autoComplete="new-password"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone (optional)</label>
                        <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"
                            placeholder="WhatsApp number"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || loadingEvents || !!success}
                        className="w-full min-h-[48px] py-3.5 rounded-xl bg-[#0ECCEE] text-black text-base font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader className="animate-spin" size={20} /> : null}
                        Request access
                    </button>
                </form>

                <p className="text-[11px] text-gray-600 mt-5 text-center">
                    Already have an account?{' '}
                    <Link to="/event-organizer/login" className="text-[#0ECCEE] hover:underline">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
