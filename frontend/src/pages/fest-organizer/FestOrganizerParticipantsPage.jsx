import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader, Search, Download, RefreshCw, Check } from 'lucide-react';
import {
    fetchFestOrganizerParticipants,
    exportFestOrganizerParticipants,
    updateFestOrganizerParticipantStatus,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import FestOrganizerParticipantModal from './FestOrganizerParticipantModal';

export default function FestOrganizerParticipantsPage() {
    const { festId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { confirm, toast } = useDialog();
    const [rows, setRows] = useState([]);
    const [competitions, setCompetitions] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [detailId, setDetailId] = useState(null);
    const [actionBusy, setActionBusy] = useState('');
    const status = searchParams.get('status') || '';
    const competitionId = searchParams.get('competitionId') || '';

    const load = async (page = 1) => {
        setLoading(true);
        try {
            const params = { page, limit: 25 };
            if (search.trim()) params.search = search.trim();
            if (status) params.status = status;
            if (competitionId) params.competitionId = competitionId;
            const data = await fetchFestOrganizerParticipants(festId, params);
            setRows(data.participants || []);
            setCompetitions(data.competitions || []);
            setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
        } catch (e) {
            toast(e.message || 'Failed to load participants');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(1);
    }, [festId, status, competitionId]);

    const setParam = (key, value) => {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(key, value);
        else next.delete(key);
        setSearchParams(next);
    };

    const exportCsv = async () => {
        try {
            const blob = await exportFestOrganizerParticipants(festId, {
                competitionId: competitionId || undefined,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fest_${festId}_participants.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast(e.message || 'Export failed');
        }
    };

    const setStatus = async (p, nextStatus, label) => {
        const ok = await confirm({
            title: `${label}?`,
            message: `${p.userName || p.userEmail || p.id} will be marked ${nextStatus}.`,
        });
        if (!ok) return;
        setActionBusy(`${p.id}-${nextStatus}`);
        try {
            await updateFestOrganizerParticipantStatus(festId, p.id, nextStatus);
            toast(nextStatus === 'approved' ? 'Approved' : 'Rejected');
            load(pagination.page);
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setActionBusy('');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold">Participants</h1>
                    <p className="text-xs text-gray-500">{pagination.total} total</p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-sm text-gray-300">
                        <Download size={14} /> Export
                    </button>
                    <button type="button" onClick={() => load(pagination.page)} className="p-2 rounded-xl border border-white/10 text-gray-400">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {['', 'approved', 'pending', 'rejected'].map((s) => (
                    <button
                        key={s || 'all'}
                        type="button"
                        onClick={() => setParam('status', s)}
                        className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
                            status === s ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'text-gray-500'
                        }`}
                    >
                        {s || 'active'}
                    </button>
                ))}
            </div>

            {competitions.length ? (
                <select
                    value={competitionId}
                    onChange={(e) => setParam('competitionId', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                >
                    <option value="">All competitions</option>
                    {competitions.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            ) : null}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    load(1);
                }}
                className="relative"
            >
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or email…"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                />
            </form>

            {loading ? (
                <div className="flex justify-center py-16 text-gray-400 gap-2">
                    <Loader className="animate-spin" size={18} /> Loading…
                </div>
            ) : (
                <div className="space-y-2">
                    {rows.map((p) => (
                        <div key={p.id} className="rounded-xl border border-white/10 bg-[#161718] px-4 py-3 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setDetailId(p.id)}
                                className="min-w-0 flex-1 text-left"
                            >
                                <p className="font-medium text-white truncate">{p.userName || '—'}</p>
                                <p className="text-xs text-gray-500 truncate">{p.userEmail}{p.userPhone ? ` · ${p.userPhone}` : ''}</p>
                                <p className="text-[11px] text-gray-600 mt-1">
                                    {p.status} · {p.paymentStatus} · ₹{p.amountPaid}
                                    {p.checkedIn ? ' · checked in' : ''}
                                    {p.competitionName ? ` · ${p.competitionName}` : ''}
                                </p>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                                {p.status === 'pending' ? (
                                    <button
                                        type="button"
                                        disabled={Boolean(actionBusy)}
                                        onClick={() => setStatus(p, 'approved', 'Approve registration')}
                                        className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 inline-flex items-center gap-1"
                                    >
                                        {actionBusy === `${p.id}-approved` ? <Loader className="animate-spin" size={12} /> : <Check size={12} />}
                                        Approve
                                    </button>
                                ) : null}
                                {p.status !== 'rejected' ? (
                                    <button
                                        type="button"
                                        disabled={Boolean(actionBusy)}
                                        onClick={() => setStatus(p, 'rejected', 'Reject registration')}
                                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                                    >
                                        Reject
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => setDetailId(p.id)}
                                    className="text-xs text-[#0ECCEE] px-2 py-1"
                                >
                                    Details
                                </button>
                            </div>
                        </div>
                    ))}
                    {!rows.length ? <p className="text-center text-gray-500 py-12 text-sm">No participants found.</p> : null}
                </div>
            )}

            {pagination.pages > 1 ? (
                <div className="flex justify-center gap-2">
                    <button type="button" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)} className="px-3 py-1.5 rounded-lg border border-white/10 text-sm disabled:opacity-40">Prev</button>
                    <span className="text-sm text-gray-500 self-center">{pagination.page} / {pagination.pages}</span>
                    <button type="button" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)} className="px-3 py-1.5 rounded-lg border border-white/10 text-sm disabled:opacity-40">Next</button>
                </div>
            ) : null}

            {detailId ? (
                <FestOrganizerParticipantModal
                    festId={festId}
                    registrationId={detailId}
                    onClose={() => setDetailId(null)}
                    onUpdated={() => load(pagination.page)}
                />
            ) : null}
        </div>
    );
}
