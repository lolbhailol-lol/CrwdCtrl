import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyPopper, ChevronRight, Loader, MapPin } from 'lucide-react';
import { fetchFestOrganizerMe } from '../../services/api/festOrganizer.api';
import { getFestOrganizerSession, setFestOrganizerSession } from '../../utils/festOrganizerSession';

export default function FestOrganizerHomePage() {
    const navigate = useNavigate();
    const session = getFestOrganizerSession();
    const [fests, setFests] = useState(session?.fests || []);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchFestOrganizerMe();
                if (cancelled) return;
                const next = data.fests || [];
                setFests(next);
                const current = getFestOrganizerSession();
                if (current) {
                    setFestOrganizerSession({ ...current, organizer: data.organizer, fests: next });
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

    return (
        <div className="max-w-3xl mx-auto space-y-5">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Your fests</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Welcome{session?.organizer?.name ? `, ${session.organizer.name}` : ''}. Open a fest to manage registrations.
                </p>
            </div>
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
