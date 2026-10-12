import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    QrCode,
    Lock,
    Eye,
    EyeOff,
    Key,
    ArrowLeft,
    PartyPopper,
    Mountain,
    Trophy,
    ShieldCheck,
    AlertCircle,
    Loader2,
    Sparkles,
    Zap
} from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useInAppBack } from '../../hooks/useInAppBack';
import Seo from '../../components/Seo';
import { breadcrumbSchema, webPageSchema } from '../../utils/seo';
import { getApiBaseUrl } from '../../config/apiBase';
import { setFestScannerSession } from '../../utils/festScannerSession';

const EVENT_CHANNELS = [
    {
        id: 'fest',
        icon: PartyPopper,
        label: 'Campus Fest',
        subtext: 'Pro-nights & competitions'
    },
    {
        id: 'trek',
        icon: Mountain,
        label: 'Trek & Outdoor',
        subtext: 'Trail check-ins'
    },
    {
        id: 'sports',
        icon: Trophy,
        label: 'Sports & Run',
        subtext: 'Bib & roster gates'
    }
];

export default function OrganizerScannerLoginPageDesktop() {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const goBack = useInAppBack();
    const [searchParams] = useSearchParams();

    const [code, setCode] = useState(() =>
        (searchParams.get('code') || '').trim().toUpperCase()
    );
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [touched, setTouched] = useState({});

    // Inline field validation
    const codeError = touched.code && !code.trim() ? 'Event code is required' : '';
    const passwordError = touched.password && !password ? 'Scanner password is required' : '';

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Mark all fields as touched
        setTouched({ code: true, password: true });

        if (!code.trim() || !password) {
            setError('Please enter both event code and password');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const res = await fetch(`${getApiBaseUrl()}/scanner/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.trim(), password }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Invalid scanner code or password');

            setFestScannerSession(
                data.eventType === 'trek'
                    ? {
                        eventType: 'trek',
                        token: data.token,
                        trekId: data.trekId,
                        trekName: data.trekName,
                        city: data.city,
                        scannerCode: data.scannerCode,
                        label: data.label,
                    }
                    : data.eventType === 'sport'
                    ? {
                        eventType: 'sport',
                        token: data.token,
                        sportEventId: data.sportEventId,
                        eventTitle: data.eventTitle,
                        city: data.city,
                        sportType: data.sportType,
                        scannerCode: data.scannerCode,
                        label: data.label,
                    }
                    : {
                        eventType: 'fest',
                        token: data.token,
                        festId: data.festId,
                        festName: data.festName,
                        collegeName: data.collegeName,
                        scannerCode: data.scannerCode,
                        label: data.label,
                    }
            );

            navigate('/organizer/scan', { replace: true });
        } catch (err) {
            setError(err.message || 'Authentication failed. Please verify credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen transition-colors duration-300 font-sans flex flex-col justify-between ${
            isDark ? 'bg-[#04060A] text-gray-100' : 'bg-[#F8FAFC] text-gray-900'
        }`}>
            <Seo
                title="Check-in Scanner Login — CrwdCtrl Gate Operations"
                description="Secure volunteer and organizer portal for high-density QR ticket scanning and campus gate authentication."
                canonical="/organizer/login"
                jsonLd={[
                    webPageSchema({ name: 'CrwdCtrl Check-in Scanner', url: '/organizer/login' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Scanner Login', path: '/organizer/login' },
                    ]),
                ]}
            />

            {/* Top Navigation Bar */}
            <header className={`backdrop-blur-xl border-b transition-colors duration-300 sticky top-0 z-40 ${
                isDark ? 'bg-[#04060A]/90 border-gray-800/80' : 'bg-white/90 border-gray-200/80'
            }`}>
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <button
                        onClick={goBack}
                        aria-label="Back to previous page"
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            isDark
                                ? 'text-gray-400 hover:text-white hover:bg-white/5'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="text-[#0ECCEE] font-bold text-sm leading-none">&gt;</span>
                        <span className="text-xs font-semibold tracking-wide uppercase text-[#0ECCEE]">
                            Gate Operations
                        </span>
                    </div>

                    <Link
                        to="/fests"
                        className="text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                    >
                        Browse Fests
                    </Link>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
                <div className="w-full max-w-md">

                    {/* Scanner Badge & Hero */}
                    <div className="text-center mb-7 sm:mb-8 space-y-3">
                        <div className="relative inline-flex items-center justify-center">
                            {/* Ambient Glow */}
                            <div className="absolute inset-0 bg-[#0ECCEE]/20 blur-xl rounded-full scale-125 pointer-events-none" />

                            <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center border transition-all ${
                                isDark
                                    ? 'bg-[#0B0F19] border-[#0ECCEE]/30 text-[#0ECCEE] shadow-[0_0_20px_rgba(14,204,238,0.2)]'
                                    : 'bg-white border-[#0ECCEE]/40 text-[#0094b3] shadow-md'
                            }`}>
                                <QrCode className="w-8 h-8" />
                            </div>
                        </div>

                        <div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase border mb-2 bg-[#0ECCEE]/10 border-[#0ECCEE]/30 text-[#0ECCEE]">
                                <Zap className="w-3 h-3" />
                                <span>Sub-Second Gate Scanner</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                                Check-in Scanner
                            </h1>
                            <p className={`text-xs sm:text-sm mt-1.5 max-w-xs mx-auto leading-relaxed ${
                                isDark ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                                Enter the event code and password assigned by your organizing committee to begin authenticating passes.
                            </p>
                        </div>
                    </div>

                    {/* Supported Channels Pill Matrix */}
                    <div className="grid grid-cols-3 gap-2.5 mb-6">
                        {EVENT_CHANNELS.map((ch) => {
                            const IconC = ch.icon;
                            return (
                                <div
                                    key={ch.id}
                                    className={`p-3 rounded-2xl border text-center transition-all ${
                                        isDark
                                            ? 'bg-[#0B0F19] border-gray-800/80 hover:border-[#0ECCEE]/40'
                                            : 'bg-white border-gray-200 hover:border-[#0ECCEE]/60 shadow-2xs'
                                    }`}
                                >
                                    <div className="w-7 h-7 mx-auto rounded-lg bg-[#0ECCEE]/10 text-[#0ECCEE] flex items-center justify-center mb-1.5">
                                        <IconC className="w-4 h-4" />
                                    </div>
                                    <p className="text-xs font-bold tracking-tight truncate">{ch.label}</p>
                                    <p className="text-[10px] text-gray-500 truncate mt-0.5">{ch.subtext}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Login Card Form */}
                    <form
                        onSubmit={handleSubmit}
                        noValidate
                        className={`rounded-3xl border p-6 sm:p-7 space-y-5 transition-all shadow-xl ${
                            isDark
                                ? 'bg-[#0B0F19] border-gray-800/90 shadow-black/40'
                                : 'bg-white border-gray-200 shadow-sm'
                        }`}
                    >
                        {/* Event Code Field */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="event-code"
                                className={`block text-xs font-bold uppercase tracking-wider ${
                                    isDark ? 'text-gray-300' : 'text-gray-700'
                                }`}
                            >
                                Event Code <span className="text-red-500">*</span>
                            </label>
                            <div className="relative flex items-center">
                                <Key className="w-4 h-4 absolute left-3.5 text-gray-400 pointer-events-none" />
                                <input
                                    id="event-code"
                                    name="eventCode"
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    onBlur={() => setTouched((p) => ({ ...p, code: true }))}
                                    placeholder="e.g. DU-FEST26"
                                    autoCapitalize="characters"
                                    autoComplete="username"
                                    required
                                    className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm font-mono tracking-wide border outline-none transition-all ${
                                        codeError
                                            ? 'border-red-500 bg-red-500/5 focus:ring-1 focus:ring-red-500'
                                            : isDark
                                            ? 'bg-[#050811] border-gray-800 text-white placeholder-gray-500 focus:border-[#0ECCEE] focus:ring-1 focus:ring-[#0ECCEE]'
                                            : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#0ECCEE] focus:ring-1 focus:ring-[#0ECCEE]'
                                    }`}
                                />
                            </div>
                            {codeError && (
                                <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{codeError}</span>
                                </p>
                            )}
                        </div>

                        {/* Scanner Password Field */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="event-password"
                                className={`block text-xs font-bold uppercase tracking-wider ${
                                    isDark ? 'text-gray-300' : 'text-gray-700'
                                }`}
                            >
                                Scanner Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative flex items-center">
                                <Lock className="w-4 h-4 absolute left-3.5 text-gray-400 pointer-events-none" />
                                <input
                                    id="event-password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                                    placeholder="Enter scanner password"
                                    autoComplete="current-password"
                                    required
                                    className={`w-full pl-10 pr-11 py-3 rounded-xl text-sm border outline-none transition-all ${
                                        passwordError
                                            ? 'border-red-500 bg-red-500/5 focus:ring-1 focus:ring-red-500'
                                            : isDark
                                            ? 'bg-[#050811] border-gray-800 text-white placeholder-gray-500 focus:border-[#0ECCEE] focus:ring-1 focus:ring-[#0ECCEE]'
                                            : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#0ECCEE] focus:ring-1 focus:ring-[#0ECCEE]'
                                    }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    className="absolute right-3.5 p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {passwordError && (
                                <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{passwordError}</span>
                                </p>
                            )}
                        </div>

                        {/* Error Notice */}
                        {error && (
                            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-red-400 text-xs">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">{error}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#0ECCEE] via-cyan-400 to-blue-500 hover:opacity-95 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(14,204,238,0.25)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Authenticating Scanner...</span>
                                </>
                            ) : (
                                <>
                                    <QrCode className="w-4 h-4" />
                                    <span>Open Scanner Camera</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer Info & Organizer Portal Link */}
                    <div className="mt-6 text-center space-y-3">
                        <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
                            Don't have scanner credentials? Request the secret key from your college fest lead or organizer portal.
                        </p>

                        <div className="pt-1 flex items-center justify-center gap-3 text-xs">
                            <Link
                                to="/organizer"
                                className="font-semibold text-[#0ECCEE] hover:underline"
                            >
                                Organizer Portal
                            </Link>
                            <span className="text-gray-600">•</span>
                            <Link
                                to="/contact-us"
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                Help &amp; Support
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom minimal entity tag */}
            <footer className="py-4 text-center text-[11px] text-gray-500">
                CrwdCtrl Fast Gate Authentication System &copy; 2026
            </footer>
        </div>
    );
}
