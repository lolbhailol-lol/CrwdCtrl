import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { festOrganizerSignup } from '../../services/api/festOrganizer.api';

export default function FestOrganizerSignupPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', username: '', email: '', phone: '', password: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            const data = await festOrganizerSignup(form);
            setSuccess(data.message || 'Account created. Awaiting approval.');
            setTimeout(() => navigate('/fest-organizer/login'), 1800);
        } catch (err) {
            setError(err.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    const fieldClass =
        'w-full px-0 py-3 bg-transparent border-0 border-b border-white/15 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]';

    return (
        <div className="min-h-dvh bg-[#0f1011] flex items-center justify-center px-5">
            <div className="w-full max-w-sm">
                <h1 className="text-2xl font-bold text-white tracking-tight">Create account</h1>
                <p className="text-sm text-gray-500 mt-1 mb-8">Fest organizer signup</p>

                <form onSubmit={submit} className="space-y-3">
                    {['name', 'username', 'email', 'phone'].map((key) => (
                        <input
                            key={key}
                            required={key !== 'phone'}
                            type={key === 'email' ? 'email' : 'text'}
                            value={form[key]}
                            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                            placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                            className={fieldClass}
                        />
                    ))}
                    <input
                        required
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="Password (min 8)"
                        className={fieldClass}
                    />
                    {error ? <p className="text-sm text-red-400 pt-1">{error}</p> : null}
                    {success ? <p className="text-sm text-emerald-400 pt-1">{success}</p> : null}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 py-3 rounded-xl bg-[#0ECCEE] text-black font-semibold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader className="animate-spin" size={16} /> : null}
                        Sign up
                    </button>
                </form>

                <p className="text-xs text-gray-500 mt-6 text-center">
                    Already have an account?{' '}
                    <Link to="/fest-organizer/login" className="text-[#0ECCEE] hover:underline">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
