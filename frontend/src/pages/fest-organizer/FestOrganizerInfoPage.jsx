import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, Info, Loader, RefreshCw, Calendar, MapPin, Building2 } from 'lucide-react';
import { fetchFestOrganizerDashboard } from '../../services/api/festOrganizer.api';

export default function FestOrganizerInfoPage() {
    const { festId } = useParams();
    const [fest, setFest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchFestOrganizerDashboard(festId);
            setFest(data.fest || null);
        } catch (e) {
            setError(e.message || 'Failed to load fest info');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [festId]);

    if (loading) {
        return (
            <div className="flex justify-center py-20 text-gray-400 gap-2">
                <Loader className="animate-spin" size={18} /> Loading…
            </div>
        );
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
        : `${window.location.origin}/view-details/${fest.id}`;

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
        ['Registration mode', fest.registrationMode],
        ['Registration status', fest.registrationStatus],
        ['Slug', fest.slug],
    ].filter(([, v]) => v);

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Info className="text-[#0ECCEE]" size={20} /> Fest info
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Read-only details for this fest</p>
                </div>
                <button type="button" onClick={load} className="p-2 rounded-xl border border-white/10 text-gray-400">
                    <RefreshCw size={16} />
                </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#161718] p-5 space-y-3">
                <h2 className="text-lg font-semibold text-white">{fest.festName}</h2>
                {fest.subtitle ? <p className="text-sm text-gray-400">{fest.subtitle}</p> : null}
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {fest.collegeName ? <span className="inline-flex items-center gap-1"><Building2 size={12} />{fest.collegeName}</span> : null}
                    {fest.city ? <span className="inline-flex items-center gap-1"><MapPin size={12} />{fest.city}</span> : null}
                    {fest.festDate ? <span className="inline-flex items-center gap-1"><Calendar size={12} />{fest.festDate}</span> : null}
                </div>
                <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#0ECCEE]">
                    <ExternalLink size={14} /> Open public page
                </a>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#161718] divide-y divide-white/5">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
                        <p className="text-xs text-gray-500 shrink-0">{label}</p>
                        <p className="text-sm text-white text-right break-all">{value}</p>
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

            <p className="text-xs text-gray-600 text-center">
                To edit fest content, ask CrwdCtrl admin (Admin → Fests).
            </p>
        </div>
    );
}
