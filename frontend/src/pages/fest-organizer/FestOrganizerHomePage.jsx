import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyPopper, ChevronRight, Loader, MapPin } from 'lucide-react';
import { fetchFestOrganizerMe } from '../../services/api/festOrganizer.api';
import { getFestOrganizerSession, setFestOrganizerSession } from '../../utils/festOrganizerSession';

export default function FestOrganizerHomePage() {
    const navigate = useNavigate();
    const session = getFestOrganizerSession();
    const [fests, setFests] = useState(session?.fests || []);
    const [loggedInUsers, setLoggedInUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchFestOrganizerMe();
                if (cancelled) return;
                const next = data.fests || [];
                const users = Array.isArray(data.loggedInUsers) ? data.loggedInUsers : [];
                setFests(next);
                setLoggedInUsers(users);
                const current = getFestOrganizerSession();
                if (current) {
                    setFestOrganizerSession({
                        ...current,
                        organizer: data.organizer,
                        fests: next,
                        loggedInUsers: users,
                    });
                }
            } catch (e) {
                if (!cancelled) setError(e.message || 'Failed to load fests');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
                <Loader className="animate-spin" size={18} /> Loading fests…
            </div>
        );
    }

    const meName = session?.organizer?.displayName || session?.organizer?.name || '';
    const meId = String(session?.organizer?.id || session?.organizer?._id || '');
    const sortedUsers = [...loggedInUsers].sort((a, b) => {
        if (a.isYou) return -1;
        if (b.isYou) return 1;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });

    return (
        <div className="max-w-3xl mx-auto space-y-5">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Your fests</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Welcome{meName ? `, ${meName}` : ''}. Open a fest to manage registrations.
                </p>
            </div>

            <section className="rounded-2xl border border-white/10 bg-[#161718] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                        {sortedUsers.length} people logged in
                    </p>
                    <p className="text-[11px] text-gray-500">Names from sign-in</p>
                </div>
                {sortedUsers.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {sortedUsers.map((person) => {
                            const you = person.isYou
                                || (String(person.organizerId) === meId
                                    && String(person.name || '').toLowerCase() === String(meName).toLowerCase());
                            return (
                                <li
                                    key={person.id || `${person.organizerId}-${person.name}`}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                                        you
                                            ? 'border-[#0ECCEE]/35 bg-[#0ECCEE]/10 text-[#0ECCEE]'
                                            : 'border-white/10 bg-white/5 text-gray-200'
                                    }`}
                                >
                                    <span className="font-medium">{person.name || 'Organizer'}</span>
                                    {you ? <span className="text-[10px] opacity-80">(you)</span> : null}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="mt-2 text-xs text-gray-500">No logins recorded yet.</p>
                )}
            </section>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <div className="space-y-3">
                {fests.map((fest) => (
                    <button
                        key={fest._id}
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${fest._id}`)}
                        className="w-full text-left rounded-2xl border border-white/10 bg-[#161718] p-4 hover:border-[#0ECCEE]/40 transition flex items-center gap-3"
                    >
                        <div className="size-11 rounded-xl bg-[#0ECCEE]/10 flex items-center justify-center shrink-0">
                            <PartyPopper className="text-[#0ECCEE]" size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                                <p className="font-semibold text-white truncate">{fest.festName}</p>
                                {fest.status === 'lastyearhit' ? (
                                    <span className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                                        Last year
                                    </span>
                                ) : null}
                            </div>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <MapPin size={12} />
                                {[fest.collegeName, fest.city].filter(Boolean).join(' · ') || '—'}
                                {fest.status && fest.status !== 'lastyearhit' ? ` · ${fest.status}` : ''}
                            </p>
                        </div>
                        <ChevronRight className="text-gray-600 shrink-0" size={18} />
                    </button>
                ))}
                {!fests.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">
                        No fests assigned yet. Ask CrwdCtrl admin to assign fests to your account.
                    </div>
                ) : null}
            </div>
        </div>
    );
}
