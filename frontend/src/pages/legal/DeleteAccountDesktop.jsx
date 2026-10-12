import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInAppBack } from '../../hooks/useInAppBack';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { authService } from '../../services/authService';
import Seo from '../../components/Seo';
import { breadcrumbSchema, webPageSchema } from '../../utils/seo';
import {
    LEGAL_EMAIL,
    LEGAL_NAME,
    LEGAL_OPERATOR_LINE,
    LEGAL_PHONE_DISPLAY,
    LEGAL_PHONE_TEL,
    WEBSITE_URL,
    LEGAL_JURISDICTION,
    LEGAL_POLICY_LINKS
} from '../../constants/legalEntity';
import {
    ArrowLeft,
    Trash2,
    ListChecks,
    Clock,
    ShieldCheck,
    Mail,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    UserX,
    FileText,
    Building2,
    HelpCircle
} from 'lucide-react';

const DELETED_ITEMS = [
    'Complete personal profile — Full name, mobile number, registered email, and college affiliation',
    'Avatar and profile photographs stored on cloud media servers',
    'All saved, bookmarked, and followed campus fests and tournaments',
    'Authentication session tokens and Google OAuth sign-in association'
];

const RETAINED_ITEMS = [
    'Completed transaction and payment invoices (retained up to 7 years per statutory Indian accounting mandates)',
    'Event organizer attendance manifests for past events already concluded',
    'Records strictly necessary to resolve active financial disputes or prevent chargeback fraud'
];

export default function DeleteAccountDesktop() {
    const { isDark } = useDarkMode();
    const { isAuthenticated, token, logout } = useAuth();
    const { confirm, toast } = useDialog();
    const navigate = useNavigate();
    const goBack = useInAppBack();
    const [deleting, setDeleting] = useState(false);

    const pageDescription =
        'Request complete deletion of your CrwdCtrl account and personal data under Indian DPDP Act. Learn what is permanently wiped and statutory retention policies.';

    const handleDeleteAccount = async () => {
        const confirmed = await confirm({
            title: 'Permanently delete your account?',
            message:
                'This action permanently wipes your profile, tickets inventory, and credentials. Past payment receipts are retained strictly as required by law. This action cannot be reversed.',
            confirmText: 'Yes, Delete Account',
            cancelText: 'Keep My Account',
            tone: 'danger',
        });
        if (!confirmed) return;

        setDeleting(true);
        try {
            await authService.deleteAccount(token);
            await logout();
            toast('Your account has been deleted successfully.');
            navigate('/', { replace: true });
        } catch (err) {
            toast(err?.message || 'Failed to delete account. Please contact support.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className={`crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 font-sans ${
            isDark ? 'bg-[#04060A] text-gray-100' : 'bg-[#F8FAFC] text-gray-900'
        }`}>
            <Seo
                title="Delete Account & Data Erasure — CrwdCtrl"
                description={pageDescription}
                canonical="/delete-account"
                jsonLd={[
                    webPageSchema({ name: 'Delete Your CrwdCtrl Account', description: pageDescription, url: '/delete-account' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Delete Account', path: '/delete-account' },
                    ]),
                ]}
            />

            {/* Sticky Glass Top Header */}
            <header className={`crwdctrl-sticky-header backdrop-blur-xl border-b transition-colors duration-300 z-50 ${
                isDark ? 'bg-[#04060A]/90 border-gray-800/80' : 'bg-white/90 border-gray-200/80'
            }`}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={goBack}
                            aria-label="Go Back"
                            className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-2">
                            <span className="text-red-500 font-bold text-sm leading-none">&gt;</span>
                            <span className="text-xs font-semibold tracking-wide uppercase text-red-500">
                                Account &amp; Data Erasure
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            to="/privacy-policy"
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                isDark
                                    ? 'bg-gray-900/60 border-gray-800 hover:border-gray-700 text-gray-300'
                                    : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 shadow-xs'
                            }`}
                        >
                            Privacy Policy
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-16 sm:space-y-20">

                {/* 1. HERO SECTION */}
                <section className="space-y-6 pt-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase border bg-red-500/10 text-red-500 border-red-500/30">
                        <UserX className="w-3.5 h-3.5" />
                        <span>Right to Erasure | Indian DPDP Act Compliance</span>
                    </div>

                    <h1 className="text-3xl sm:text-6xl font-black tracking-tight leading-[1.1]">
                        Data deletion &amp; autonomy. <br />
                        <span className="bg-linear-to-r from-red-500 via-rose-400 to-amber-400 bg-clip-text text-transparent">
                            Complete control over your profile.
                        </span>
                    </h1>

                    <p className={`text-base sm:text-lg max-w-3xl leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        You have the right to request deletion of your CrwdCtrl account and all personal identification data. We process account closures transparently within statutory limits.
                    </p>

                    {/* Meta Pillars Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Response SLA</div>
                            <div className="font-bold mt-0.5 text-blue-500">2–3 Business Days</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Erasure Completion</div>
                            <div className="font-bold mt-0.5 text-emerald-500">Within 30 Days</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">In-App Deletion</div>
                            <div className="font-bold mt-0.5 text-red-500">{isAuthenticated ? 'Active & Ready' : 'Sign-In Required'}</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Tax Retention</div>
                            <div className="font-bold mt-0.5 text-amber-500">7 Years Mandatory</div>
                        </div>
                    </div>
                </section>

                {/* 2. DIRECT IN-APP DELETION ACTION (IF SIGNED IN) */}
                {isAuthenticated && (
                    <section className="space-y-4">
                        <div className={`p-6 sm:p-8 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${
                            isDark ? 'bg-red-950/20 border-red-900/50' : 'bg-red-50 border-red-200 shadow-xs'
                        }`}>
                            <div className="space-y-2 max-w-xl">
                                <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-wider">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span>Immediate In-App Deletion</span>
                                </div>
                                <h3 className="text-xl font-bold">You are currently signed in</h3>
                                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    You can permanently wipe your account right now. This immediately terminates your session, purges your credentials, and detaches linked passes.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                                className="px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 transition-all flex items-center gap-2 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                            >
                                {deleting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Deleting Account...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        <span>Permanently Delete My Account</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </section>
                )}

                {/* 3. WHAT GETS DELETED VS WHAT IS RETAINED */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <ListChecks className="w-3.5 h-3.5" />
                            <span>01. Data Classification</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            What is Purged vs. What is Legally Retained
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* What Gets Deleted */}
                        <div className={`p-6 sm:p-7 rounded-2xl border flex flex-col justify-between ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                        }`}>
                            <div>
                                <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase mb-3">
                                    <Trash2 className="w-4 h-4" />
                                    <span>Permanently Purged</span>
                                </div>
                                <h3 className="text-lg font-bold mb-3">Wiped From Our Systems</h3>
                                <ul className="space-y-2.5 text-xs">
                                    {DELETED_ITEMS.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5">
                                            <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* What May Be Retained */}
                        <div className={`p-6 sm:p-7 rounded-2xl border flex flex-col justify-between ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                        }`}>
                            <div>
                                <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase mb-3">
                                    <ShieldCheck className="w-4 h-4" />
                                    <span>Statutory Records</span>
                                </div>
                                <h3 className="text-lg font-bold mb-3">Retained Under Legal Mandates</h3>
                                <ul className="space-y-2.5 text-xs">
                                    {RETAINED_ITEMS.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. REQUESTING BY EMAIL DESK */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Mail className="w-3.5 h-3.5" />
                            <span>02. Manual Verification Option</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Request Deletion via Registered Email
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border space-y-4 ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            If you no longer have device access or cannot sign in, send an official deletion dispatch from the email address linked to your account:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                            <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="text-xs font-mono font-bold text-blue-500 uppercase mb-1">Step 01</div>
                                <h4 className="text-xs font-bold mb-1">Send Email</h4>
                                <p className="text-[11px] text-gray-400">
                                    Email to <a href={`mailto:${LEGAL_EMAIL}?subject=Delete%20my%20CrwdCtrl%20account`} className="text-blue-500 underline">{LEGAL_EMAIL}</a> with subject &quot;Delete my CrwdCtrl account&quot;.
                                </p>
                            </div>

                            <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="text-xs font-mono font-bold text-blue-500 uppercase mb-1">Step 02</div>
                                <h4 className="text-xs font-bold mb-1">Identify Account</h4>
                                <p className="text-[11px] text-gray-400">
                                    Include your registered full name and phone number for verified ownership validation.
                                </p>
                            </div>

                            <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="text-xs font-mono font-bold text-blue-500 uppercase mb-1">Step 03</div>
                                <h4 className="text-xs font-bold mb-1">Confirmation</h4>
                                <p className="text-[11px] text-gray-400">
                                    Our dispatch team acknowledges in 2–3 days and completes data wipe within 30 days.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 5. LEGAL DIRECTORY INDEX */}
                <section className={`p-6 sm:p-8 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'
                }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-blue-500">
                                Policy Index &amp; Legal Framework
                            </div>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Official corporate policies governing the CrwdCtrl digital platform.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        {LEGAL_POLICY_LINKS.map((link) => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    isDark
                                        ? 'bg-gray-800/80 text-gray-300 hover:bg-blue-600 hover:text-white'
                                        : 'bg-white text-gray-800 hover:bg-blue-600 hover:text-white border border-gray-200'
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
