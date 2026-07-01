import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mountain, ChevronRight, Loader, MapPin, Phone, Instagram } from 'lucide-react';
import { fetchTrekOrganizerMe } from '../../services/api/trekOrganizer.api';
import { getTrekOrganizerSession, setTrekOrganizerSession } from '../../utils/trekOrganizerSession';

function formatTrekDate(d) {
    if (!d) return 'Date TBA';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TrekOrganizerHomePage() {
    const navigate = useNavigate();
    const session = getTrekOrganizerSession();
    const [treks, setTreks] = useState(session?.treks || []);
    const [community, setCommunity] = useState(session?.community || null);
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const data = await fetchTrekOrganizerMe();
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
                if (nextTreks.length === 1 && nextTreks[0]?._id) {
                    navigate(`/trek-organizer/treks/${nextTreks[0]._id}`, { replace: true });
                }
            } catch (e) {
                setError(e.message || 'Failed to load community');
            } finally {
                setLoading(false);
            }
        })();
    }, [navigate]);

    if (loading) {
        return <div className="flex justify-center py-20"><Loader className="animate-spin text-[#0ECCEE]" /></div>;
    }

    if (error) {
        return <div className="text-center py-16 text-red-400 text-sm">{error}</div>;
    }

    return (
        <div className="space-y-6">
            {community ? (
                <div className="rounded-2xl border border-gray-800 bg-[#161718] overflow-hidden">
                    {community.coverImage ? (
                        <div className="h-32 sm:h-40 bg-cover bg-center" style={{ backgroundImage: `url(${community.coverImage})` }} />
                    ) : (
                        <div className="h-24 bg-linear-to-r from-[#053780]/40 to-[#0ECCEE]/20" />
                    )}
                    <div className="p-4 sm:p-5 space-y-3">
                        <div>
                            <h1 className="text-2xl font-bold">{community.name}</h1>
                            {community.basedIn ? (
                                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                    <MapPin size={14} /> {community.basedIn}
                                </p>
                            ) : null}
                        </div>
                        {community.aboutUs ? (
                            <p className="text-sm text-gray-400 leading-relaxed">{community.aboutUs}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            {community.contactPhone ? (
                                <span className="inline-flex items-center gap-1"><Phone size={12} /> {community.contactPhone}</span>
                            ) : null}
                            {community.contactInstagram ? (
                                <span className="inline-flex items-center gap-1"><Instagram size={12} /> {community.contactInstagram}</span>
                            ) : null}
                        </div>
                        {community.trekCategories?.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {community.trekCategories.map((cat) => (
                                    <span key={cat} className="px-2 py-0.5 rounded-full bg-[#0ECCEE]/10 text-[#0ECCEE] text-[10px] font-medium">{cat}</span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div>
                    <h1 className="text-2xl font-bold mb-1">Your community</h1>
                    <p className="text-sm text-gray-500">No community linked yet. Contact CrwdCtrl admin.</p>
                </div>
            )}

            <div>
                <h2 className="text-lg font-semibold mb-1">All treks</h2>
                <p className="text-sm text-gray-500 mb-4">{treks.length} trek{treks.length !== 1 ? 's' : ''} in your community</p>

                {treks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-500 text-sm">
                        No treks found for this community yet.
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {treks.map((trek) => (
                            <button
                                key={trek._id}
                                type="button"
                                onClick={() => navigate(`/trek-organizer/treks/${trek._id}`)}
                                className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#161718] p-4 hover:border-[#0ECCEE]/40 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="size-10 rounded-lg bg-[#0ECCEE]/10 flex items-center justify-center shrink-0">
                                        <Mountain className="text-[#0ECCEE]" size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold truncate">{trek.trekName}</p>
                                        <p className="text-xs text-gray-500">
                                            {trek.city || '—'} · {formatTrekDate(trek.trekDate)} · {trek.status}
                                        </p>
                                        {trek.registration?.status ? (
                                            <p className="text-[10px] text-gray-600 mt-0.5 capitalize">Registration: {trek.registration.status}</p>
                                        ) : null}
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
