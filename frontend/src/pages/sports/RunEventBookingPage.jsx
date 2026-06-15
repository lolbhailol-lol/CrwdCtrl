import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import CrwdCtrlLogin from '../auth/login';
import { goToBookings } from '../../utils/paymentNavigation';

import { API_BASE_URL as API } from '../../services/api/client';

export default function RunEventBookingPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const { isDark } = useDarkMode();
    const { user, isAuthenticated } = useAuth();

    const [event, setEvent] = useState(location.state?.event || null);
    const [loading, setLoading] = useState(!location.state?.event);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [registrationId, setRegistrationId] = useState(null);
    const [error, setError] = useState('');
    const [showLogin, setShowLogin] = useState(false);

    useEffect(() => {
        if (event || !id) {
            setLoading(false);
            return;
        }
        fetch(`${API}/sports/${id}`)
            .then((r) => r.json())
            .then((d) => {
                if (d.event) setEvent(d.event);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id, event]);

    const eventId = id || event?._id || event?.id;
    const fee = Number(event?.registrationFee) || 0;
    const hasExternalLink = Boolean(event?.registrationLink?.trim());

    const handleRegister = async () => {
        if (!isAuthenticated) {
            setShowLogin(true);
            return;
        }
        if (hasExternalLink && fee > 0) {
            window.open(event.registrationLink, '_blank', 'noopener,noreferrer');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const token = localStorage.getItem('crwdctrl_token') || localStorage.getItem('token');
            const res = await fetch(`${API}/category-registrations/sports/${eventId}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ responses: {} }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Registration failed');
            const regId = data.registration?._id || data.registration?.id || data._id;
            if (regId) setRegistrationId(String(regId));
            setDone(true);
        } catch (err) {
            setError(err.message || 'Could not complete registration');
        } finally {
            setSubmitting(false);
        }
    };

    if (showLogin) {
        return <CrwdCtrlLogin onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />;
    }

    if (loading) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content flex items-center justify-center min-h-screen">
                <Loader className="animate-spin text-[#0ECCEE]" size={32} />
            </div>
        );
    }

    if (!event) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content flex flex-col items-center justify-center min-h-screen gap-3">
                <p className="text-gray-500 text-sm">Run not found</p>
                <button onClick={() => navigate(-1)} className="text-[#0ECCEE] text-sm font-semibold">
                    Go back
                </button>
            </div>
        );
    }

    if (done) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content flex flex-col items-center justify-center min-h-screen gap-4 px-6">
                <CheckCircle size={56} className="text-green-500" />
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>You&apos;re registered!</h1>
                <p className={`text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Download your ticket or view all bookings whenever you&apos;re ready.
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    {registrationId && (
                        <button
                            type="button"
                            onClick={() => navigate(`/qr-ticket/${registrationId}?type=sports`, { state: { refreshBookings: true } })}
                            className="px-6 py-3 rounded-xl bg-[#0ECCEE] text-black font-bold text-sm"
                        >
                            Download Ticket
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => goToBookings(navigate)}
                        className={`px-6 py-3 rounded-xl font-bold text-sm ${
                            registrationId
                                ? isDark
                                    ? 'border border-gray-600 text-gray-200'
                                    : 'border border-gray-300 text-gray-800'
                                : 'bg-[#0ECCEE] text-black'
                        }`}
                    >
                        View My Bookings
                    </button>
                </div>
            </div>
        );
    }

    const clubName = event.runClub?.name || event.organizer || 'Run Club';
    const dateLabel = event.eventDate
        ? new Date(event.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Date TBA';

    return (
        <div className="crwdctrl-page crwdctrl-mobile-page min-h-screen">
            <div className="px-4 pt-12 pb-4 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="size-9 rounded-full bg-stone-900/10 flex items-center justify-center">
                    <ArrowLeft size={18} className={isDark ? 'text-white' : 'text-gray-900'} />
                </button>
                <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Confirm Registration</h1>
            </div>

            <div className="px-4 pb-8">
                <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-[#111213] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{clubName}</p>
                    <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{event.title}</p>
                    <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{dateLabel}</p>
                    {event.venue && (
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{event.venue}</p>
                    )}
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total</span>
                        <span className={`text-lg font-bold ${fee > 0 ? 'text-[#0ECCEE]' : 'text-green-500'}`}>
                            {fee > 0 ? `₹${fee.toLocaleString('en-IN')}` : 'Free'}
                        </span>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-red-900/30 border border-red-700 text-red-300 text-sm">{error}</div>
                )}

                {hasExternalLink && fee > 0 ? (
                    <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        You&apos;ll be redirected to the organiser&apos;s registration page to complete payment.
                    </p>
                ) : (
                    <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        {isAuthenticated
                            ? `Registering as ${user?.name || user?.email || 'your account'}.`
                            : 'Sign in to register for this run.'}
                    </p>
                )}

                <button
                    type="button"
                    disabled={submitting}
                    onClick={handleRegister}
                    className="w-full py-3.5 rounded-xl bg-[#0ECCEE] text-black font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {submitting ? <Loader size={18} className="animate-spin" /> : null}
                    {hasExternalLink && fee > 0 ? 'Continue to Register' : fee > 0 ? 'Register & Pay' : 'Confirm Registration'}
                </button>
            </div>
        </div>
    );
}
