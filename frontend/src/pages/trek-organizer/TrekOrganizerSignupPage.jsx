import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mountain, Loader } from 'lucide-react';
import {
    fetchTrekOrganizerSignupCommunities,
    trekOrganizerSignup,
} from '../../services/api/trekOrganizer.api';

export default function TrekOrganizerSignupPage() {
    const navigate = useNavigate();
    const [communities, setCommunities] = useState([]);
    const [loadingCommunities, setLoadingCommunities] = useState(true);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [communityId, setCommunityId] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const prevTitle = document.title;
        document.title = 'Trek Organizer Signup | CrwdCtrl';
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

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchTrekOrganizerSignupCommunities();
                if (!cancelled) {
                    setCommunities(data.communities || []);
                    if (data.communities?.length === 1) setCommunityId(String(data.communities[0].id));
                }
            } catch (e) {
                if (!cancelled) setError(e.message || 'Failed to load communities');
            } finally {
                if (!cancelled) setLoadingCommunities(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!email.trim()) {
            setError('Email is required — use the email CrwdCtrl approved for Trek community');
            return;
        }
        if (!communityId) {
            setError('Select your trek community');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        try {
            const data = await trekOrganizerSignup({
                name: name.trim(),
                username: username.trim().toLowerCase(),
                password,
                phone: phone.trim(),
                email: email.trim().toLowerCase(),
                communityId,
            });
            setSuccess(data.message || 'Account created. Await CrwdCtrl approval before signing in.');
            setTimeout(() => navigate('/trek-organizer/login', { replace: true }), 2200);
        } catch (err) {
            setError(err.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh bg-[#0f1011] flex items-center justify-center px-4 py-6 pt-[max(1.5rem,var(--safe-top))] pb-[max(1.5rem,var(--safe-bottom))]">
            <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#161718] p-6 sm:p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="size-12 rounded-xl bg-[#0ECCEE]/10 flex items-center justify-center">
                        <Mountain className="text-[#0ECCEE]" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Trek Organizer signup</h1>
                        <p className="text-xs text-gray-500">Invite-only trek portal — not fest or events</p>
                    </div>
                </div>

                <p className="text-[11px] text-gray-500 mb-4 rounded-lg border border-gray-800 bg-[#111213] px-3 py-2">
                    Use the email CrwdCtrl approved for trek access. After signup, wait for approval, then sign in at the trek login link only.
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
                            placeholder="you@community.com"
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
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Trek community</label>
                        {loadingCommunities ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
                                <Loader className="animate-spin" size={16} /> Loading communities…
                            </div>
                        ) : (
                            <select
                                required
                                value={communityId}
                                onChange={(e) => setCommunityId(e.target.value)}
                                className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"
                            >
                                <option value="">Select your community</option>
                                {communities.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}{c.basedIn ? ` · ${c.basedIn}` : ''}
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
                            placeholder="e.g. peak_trekkers"
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
                        disabled={loading || loadingCommunities || !!success}
                        className="w-full min-h-[48px] py-3.5 rounded-xl bg-[#0ECCEE] text-black text-base font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader className="animate-spin" size={20} /> : null}
                        Request access
                    </button>
                </form>

                <p className="text-[11px] text-gray-600 mt-5 text-center">
                    Already have an account?{' '}
                    <Link to="/trek-organizer/login" className="text-[#0ECCEE] hover:underline">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
