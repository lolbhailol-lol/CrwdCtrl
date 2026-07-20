import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mountain, ChevronRight, Loader, MapPin, Phone, Instagram } from 'lucide-react';
import { fetchTrekOrganizerMe } from '../../services/api/trekOrganizer.api';
import { getTrekOrganizerSession, setTrekOrganizerSession } from '../../utils/trekOrganizerSession';
import { formatOrganizerTrekDate } from '../../utils/trekDateDisplay';

function statusTone(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'published') return 'bg-emerald-500/15 text-emerald-400';
    if (s === 'cancelled') return 'bg-red-500/15 text-red-400';
    if (s === 'completed') return 'bg-gray-500/15 text-gray-400';
    return 'bg-amber-500/15 text-amber-400';
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
        return <div className="flex justify-center py-20"><Loader className="animate-spin text-[#0ECCEE]" /></div>;
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
                <div className="rounded-2xl border border-gray-800 bg-[#161718] overflow-hidden">
                    {community.coverImage ? (
                        <div className="h-28 sm:h-36 bg-cover bg-center" style={{ backgroundImage: `url(${community.coverImage})` }} />
                    ) : (
                        <div className="h-20 bg-linear-to-r from-[#053780]/50 to-[#0ECCEE]/25" />
                    )}
                    <div className="p-4 sm:p-5 space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight">{community.name}</h1>
                        {community.basedIn ? (
                            <p className="text-sm text-gray-500 flex items-center gap-1.5">
                                <MapPin size={14} className="text-[#0ECCEE]" /> {community.basedIn}
                            </p>
                        ) : null}
                        {community.aboutUs ? (
                            <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">{community.aboutUs}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-1">
                            {community.contactPhone ? (
                                <a href={`tel:${String(community.contactPhone).replace(/\s/g, '')}`} className="inline-flex items-center gap-1 hover:text-[#0ECCEE]">
                                    <Phone size={12} /> {community.contactPhone}
                                </a>
                            ) : null}
                            {community.contactInstagram ? (
                                <span className="inline-flex items-center gap-1"><Instagram size={12} /> {community.contactInstagram}</span>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-gray-700 p-6 text-center">
                    <h1 className="text-xl font-bold mb-1">Your community</h1>
                    <p className="text-sm text-gray-500">No community linked yet. Contact CrwdCtrl admin.</p>
                </div>
            )}

            <div>
                <div className="flex items-end justify-between gap-3 mb-3">
                    <div>
                        <h2 className="text-lg font-semibold">Your treks</h2>
                        <p className="text-sm text-gray-500">
                            {treks.length === 0
                                ? 'Nothing published yet'
                                : `${treks.length} trek${treks.length === 1 ? '' : 's'} — tap to manage`}
                        </p>
                    </div>
                </div>

                {treks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-700 p-10 text-center text-gray-500 text-sm">
                        No treks in this community yet.
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {treks.map((trek) => (
                            <button
                                key={trek._id}
                                type="button"
                                onClick={() => navigate(`/trek-organizer/treks/${trek._id}`)}
                                className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#161718] p-4 hover:border-[#0ECCEE]/40 active:scale-[0.99] transition-all text-left min-h-[72px]"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="size-11 rounded-xl bg-[#0ECCEE]/10 flex items-center justify-center shrink-0">
                                        <Mountain className="text-[#0ECCEE]" size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold truncate">{trek.trekName}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {[trek.city || '—', formatOrganizerTrekDate(trek) || 'Date TBA'].join(' · ')}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusTone(trek.status)}`}>
                                                {trek.status || 'draft'}
                                            </span>
                                            {trek.registration?.status ? (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                    trek.registration.status === 'open'
                                                        ? 'bg-emerald-500/15 text-emerald-400'
                                                        : 'bg-red-500/15 text-red-400'
                                                }`}>
                                                    Reg {trek.registration.status}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="text-gray-600 shrink-0" size={18} />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
