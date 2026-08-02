import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { festOrganizerLogin, applyFestOrganizerAuthPayload } from '../../services/api/festOrganizer.api';
import { showAppPopup } from '../../utils/appPopup';

export default function FestOrganizerLoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await festOrganizerLogin(username, password);
            applyFestOrganizerAuthPayload(data);
            showAppPopup({
                title: 'Signed in successfully',
                message: 'Welcome to the fest organizer portal.',
                tone: 'login',
            });
            navigate(location.state?.from || '/fest-organizer', { replace: true });
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh bg-[#0f1011] flex items-center justify-center px-5">
            <div className="w-full max-w-sm">
                <h1 className="text-2xl font-bold text-white tracking-tight">Fest Organizer</h1>
                <p className="text-sm text-gray-500 mt-1 mb-8">Sign in</p>

                <form onSubmit={submit} className="space-y-3">
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username or email"
                        autoComplete="username"
                        className="w-full px-0 py-3 bg-transparent border-0 border-b border-white/15 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]"
                        required
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        autoComplete="current-password"
                        className="w-full px-0 py-3 bg-transparent border-0 border-b border-white/15 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]"
                        required
                    />
                    {error ? <p className="text-sm text-red-400 pt-1">{error}</p> : null}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 py-3 rounded-xl bg-[#0ECCEE] text-black font-semibold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader className="animate-spin" size={16} /> : null}
                        Sign in
                    </button>
                </form>

                <p className="text-xs text-gray-500 mt-6 text-center">
                    Need an account?{' '}
                    <Link to="/fest-organizer/signup" className="text-[#0ECCEE] hover:underline">Sign up</Link>
                </p>
            </div>
        </div>
    );
}
