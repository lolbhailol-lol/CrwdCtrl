import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Footprints, Users, Loader, ArrowLeft } from 'lucide-react';
import { DetailLoader3DIcon } from '../../components/DetailPageLoader';
import {
    fetchRunClubOrganizerSignupClubs,
    runClubOrganizerSignup,
} from '../../services/api/runClubOrganizer.api';
import { organizerHubCopy } from '../../utils/listingHubCopy';

export default function RunClubOrganizerSignupPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isEventHub = searchParams.get('hub') === 'events';
    const copy = useMemo(() => organizerHubCopy(isEventHub), [isEventHub]);
    const HubIcon = isEventHub ? Users : Footprints;

    const [clubs, setClubs] = useState([]);
    const [loadingClubs, setLoadingClubs] = useState(true);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [runClubId, setRunClubId] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchRunClubOrganizerSignupClubs(isEventHub ? 'events' : 'sports');
                if (!cancelled) {
                    setClubs(data.clubs || []);
                    if (data.clubs?.length === 1) setRunClubId(String(data.clubs[0].id));
                }
            } catch (e) {
                if (!cancelled) setError(e.message || 'Failed to load communities');
            } finally {
                if (!cancelled) setLoadingClubs(false);
            }
        })();
        return () => { cancelled = true; };
    }, [isEventHub]);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!email.trim()) {
            setError(`Email is required — ${copy.signupEmailHint}`);
            return;
        }
        if (!runClubId) {
            setError(`Select your ${copy.signupClubLabel.toLowerCase()}`);
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        try {
            const data = await runClubOrganizerSignup({
                name: name.trim(),
                username: username.trim().toLowerCase(),
                password,
                phone: phone.trim(),
                email: email.trim().toLowerCase(),
                runClubId,
            });
            setSuccess(data.message || 'Account created. Await CrwdCtrl approval before signing in.');
            setTimeout(() => navigate(copy.signupLoginPath, { replace: true }), 2200);
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
                        <HubIcon className="text-[#0ECCEE]" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{copy.signupTitle}</h1>
                        <p className="text-xs text-gray-500">{copy.signupHint}</p>
                    </div>
                </div>

                <p className="text-[11px] text-gray-500 mb-4 rounded-lg border border-gray-800 bg-[#111213] px-3 py-2">
                    {copy.signupEmailHint}
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
                            placeholder="you@example.com"
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
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">{copy.signupClubLabel}</label>
                        {loadingClubs ? (
                            <div className="flex items-center gap-3 text-sm text-gray-500 py-3">
                                <DetailLoader3DIcon size="mini" />
                                Loading…
                            </div>
                        ) : (
                            <select
                                required
                                value={runClubId}
                                onChange={(e) => setRunClubId(e.target.value)}
                                className="w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE] min-h-[48px]"
                            >
                                <option value="">Select {copy.signupClubLabel.toLowerCase()}</option>
                                {clubs.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}{c.basedIn ? ` · ${c.basedIn}` : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                        {!loadingClubs && clubs.length === 0 ? (
                            <p className="text-[11px] text-amber-400/90 mt-1.5">{copy.signupClubEmpty}</p>
                        ) : null}
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
                            placeholder="e.g. delulu_ops"
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
                        disabled={loading || loadingClubs || !!success}
                        className="w-full min-h-[48px] py-3.5 rounded-xl bg-[#0ECCEE] text-black text-base font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader className="animate-spin" size={20} /> : null}
                        Request access
                    </button>
                </form>

                <p className="text-[11px] text-gray-600 mt-5 text-center">
                    Already have an account?{' '}
                    <Link to={copy.signupLoginPath} className="text-[#0ECCEE] hover:underline">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
