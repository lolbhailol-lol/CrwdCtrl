import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, Info, Pencil, RefreshCw } from 'lucide-react';
import { InlinePageLoader } from '../../components/DetailPageLoader';
import {
    fetchFestOrganizerFestDetails,
    buildFestOrganizerAdminApi,
} from '../../services/api/festOrganizer.api';
import FestFormModal from '../../components/admin/FestFormModal';

export default function FestOrganizerInfoPage() {
    const { festId } = useParams();
    const [fest, setFest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showEdit, setShowEdit] = useState(false);

    const adminApi = useMemo(() => buildFestOrganizerAdminApi(festId), [festId]);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchFestOrganizerFestDetails(festId);
            const f = data.fest || null;
            setFest(f ? { ...f, _id: f._id || f.id || festId } : null);
        } catch (e) {
            setError(e.message || 'Failed to load fest info');
            setFest(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [festId]);

    if (loading) {
        return <InlinePageLoader label="Loading…" variant="fest" />;
    }

    if (error || !fest) {
        return (
            <div className="text-center py-16 space-y-3">
                <p className="text-red-400 text-sm">{error || 'Not found'}</p>
                <button type="button" onClick={load} className="text-[#0ECCEE] text-sm">Retry</button>
            </div>
        );
    }

    const publicUrl = fest.slug
        ? `${window.location.origin}/view-details/${fest.slug}`
        : `${window.location.origin}/view-details/${fest._id || fest.id}`;

    const formFieldCount = Array.isArray(fest.registration?.formSchema)
        ? fest.registration.formSchema.length
        : (Array.isArray(fest.registration?.steps)
            ? fest.registration.steps.reduce((n, s) => n + (s.fields?.length || 0), 0)
            : 0);

    const rows = [
        ['College', fest.collegeName],
        ['City', fest.city],
        ['Venue', fest.venue],
        ['Dates', fest.festDate],
        ['Type', fest.festType],
        ['Category', fest.category],
        ['Status', fest.status],
        ['Ticket label', fest.ticketPrice],
        ['Fee amount', fest.feeAmount ? `₹${fest.feeAmount}` : ''],
        ['Registration mode', fest.registration?.mode],
        ['Form fields', formFieldCount || ''],
        ['Gallery photos', Array.isArray(fest.galleryImages) ? fest.galleryImages.length : ''],
        ['Artists', Array.isArray(fest.artists) ? fest.artists.length : ''],
        ['Sponsors', Array.isArray(fest.sponsors) ? fest.sponsors.length : ''],
        ['Slug', fest.slug],
    ].filter(([, v]) => v !== '' && v != null);

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Info className="text-[#0ECCEE]" size={20} /> Fest info
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Same edit wizard as main admin (Fest Details → Artists → Contacts → Sponsors → Registration)
                    </p>
                </div>
                <button type="button" onClick={load} className="p-2 rounded-xl border border-white/10 text-gray-400">
                    <RefreshCw size={16} />
                </button>
            </div>

            <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="w-full rounded-2xl border border-[#0ECCEE]/40 bg-[#0ECCEE]/15 p-4 text-left hover:border-[#0ECCEE]/60 transition flex items-center gap-3"
            >
                <div className="size-11 rounded-xl bg-[#0ECCEE]/20 flex items-center justify-center shrink-0">
                    <Pencil size={18} className="text-[#0ECCEE]" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">Edit fest (admin form)</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Cover, gallery, artists, contacts, sponsors, and registration form setup
                    </p>
                </div>
            </button>

            <div className="rounded-2xl border border-white/10 bg-[#161718] p-5 space-y-3">
                <h2 className="text-lg font-semibold text-white">{fest.festName}</h2>
                {fest.subtitle ? <p className="text-sm text-gray-400">{fest.subtitle}</p> : null}
                <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#0ECCEE]">
                    <ExternalLink size={14} /> Open public page
                </a>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#161718] divide-y divide-white/5">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
                        <p className="text-xs text-gray-500 shrink-0">{label}</p>
                        <p className="text-sm text-white text-right break-all">{String(value)}</p>
                    </div>
                ))}
            </div>

            {fest.description ? (
                <div className="rounded-2xl border border-white/10 bg-[#161718] p-4">
                    <p className="text-xs text-gray-500 mb-2">Description</p>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {String(fest.description).slice(0, 1200)}
                        {String(fest.description).length > 1200 ? '…' : ''}
                    </p>
                </div>
            ) : null}

            {showEdit ? (
                <FestFormModal
                    fest={fest}
                    api={adminApi}
                    onClose={() => setShowEdit(false)}
                    onSaved={() => {
                        setShowEdit(false);
                        load();
                    }}
                />
            ) : null}
        </div>
    );
}
