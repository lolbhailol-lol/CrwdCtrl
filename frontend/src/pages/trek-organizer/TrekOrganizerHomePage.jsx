import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mountain, ChevronRight, Loader, MapPin, Phone, Instagram, Sparkles, ContactRound } from 'lucide-react';
import { fetchTrekOrganizerMe } from '../../services/api/trekOrganizer.api';
import { getTrekOrganizerSession, setTrekOrganizerSession } from '../../utils/trekOrganizerSession';
import { formatOrganizerTrekDate } from '../../utils/trekDateDisplay';

function statusTone(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'published') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
    if (s === 'cancelled') return 'bg-red-500/10 text-red-300 border-red-500/25';
    if (s === 'completed') return 'bg-white/5 text-gray-400 border-white/10';
    return 'bg-amber-500/10 text-amber-300 border-amber-500/25';
}

export default function TrekOrganizerHomePage() {
    const navigate = useNavigate();
    const session = getTrekOrganizerSession();
    const [treks, setTreks] = useState(session?.treks || []);
    const [community, setCommunity] = useState(session?.community || null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchTrekOrganizerMe();
                if (cancelled) return;
                const nextTreks = data.treks || [];
                setTreks(nextTreks);
                setCommunity(data.community || null);
                const current = getTrekOrganizerSession();
                if (current) {
                    setTrekOrganizerSession({
                        ...current,
                        organizer: data.organizer,
                        community: data.community,
                        treks: nextTreks,
                    });
                }
            } catch (e) {
                if (!cancelled) setError(e.message || 'Failed to load community');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader className="animate-spin text-[#0ECCEE]" />
                <p className="text-xs text-gray-500">Loading community…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16 space-y-3">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="text-sm text-[#0ECCEE] hover:underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {community ? (
                <div className="rounded-3xl border border-white/10 bg-[#161718] overflow-hidden">
                    {community.coverImage ? (
                        <div className="relative h-32 sm:h-40 bg-cover bg-center" style={{ backgroundImage: `url(${community.coverImage})` }}>
                            <div className="absolute inset-0 bg-linear-to-t from-[#161718] via-[#161718]/40 to-transparent" />
                        </div>
                    ) : (
                        <div className="h-24 bg-linear-to-r from-[#053780]/60 via-[#0ECCEE]/20 to-[#053780]/30" />
                    )}
                    <div className="p-5 sm:p-6 space-y-3 -mt-2 relative">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#0ECCEE]/20 bg-[#0ECCEE]/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0ECCEE]">
                            <Sparkles size={11} /> Your community
                        </div>
                        <h1 className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight">{community.name}</h1>
                        {community.basedIn ? (
                            <p className="text-sm text-gray-400 flex items-center gap-1.5">
                                <MapPin size={14} className="text-[#0ECCEE]" /> {community.basedIn}
                            </p>
                        ) : null}
                        {community.aboutUs ? (
                            <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">{community.aboutUs}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-1">
                            {community.contactPhone ? (
                                <a href={`tel:${String(community.contactPhone).replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 hover:text-[#0ECCEE] hover:border-[#0ECCEE]/40 transition-colors">
                                    <Phone size={12} /> {community.contactPhone}
                                </a>
                            ) : null}
                            {community.contactInstagram ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10">
                                    <Instagram size={12} /> {community.contactInstagram}
                                </span>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/trek-organizer/customers')}
                            className="mt-2 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-11 rounded-xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 text-[#0ECCEE] text-sm font-semibold hover:bg-[#0ECCEE]/15"
                        >
                            <ContactRound size={16} />
                            View customers
                        </button>
                    </div>
                </div>
            ) : (
                <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center bg-white/5">
                    <h1 className="text-xl font-semibold mb-1">Your community</h1>
                    <p className="text-sm text-gray-500">No community linked yet. Contact CrwdCtrl admin.</p>
                </div>
            )}

            <div>
                <div className="flex items-end justify-between gap-3 mb-3.5 px-0.5">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">Your treks</h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {treks.length === 0
                                ? 'Nothing published yet'
                                : `${treks.length} trek${treks.length === 1 ? '' : 's'} — tap to manage`}
                        </p>
                    </div>
                </div>

                {treks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-gray-500 text-sm bg-white/5">
                        No treks in this community yet.
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {treks.map((trek) => (
                            <button
                                key={trek._id}
                                type="button"
                                onClick={() => navigate(`/trek-organizer/treks/${trek._id}`)}
                                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#141516] p-4 hover:border-[#0ECCEE]/40 active:scale-[0.99] transition-all text-left min-h-[80px]"
                            >
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="size-12 rounded-2xl bg-linear-to-br from-[#0ECCEE]/20 to-[#053780]/30 flex items-center justify-center shrink-0 border border-[#0ECCEE]/15">
                                        <Mountain className="text-[#0ECCEE]" size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold truncate text-[15px]">{trek.trekName}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {[trek.city || '—', formatOrganizerTrekDate(trek) || 'Date TBA'].join(' · ')}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize border ${statusTone(trek.status)}`}>
                                                {trek.status || 'draft'}
                                            </span>
                                            {trek.registration?.status ? (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                                    trek.registration.status === 'open'
                                                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                                                        : 'bg-red-500/10 text-red-300 border-red-500/25'
                                                }`}>
                                                    Reg {trek.registration.status}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="text-gray-600 group-hover:text-[#0ECCEE] shrink-0 transition-colors" size={18} />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
