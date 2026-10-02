import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import CheckinScannerPage from '../../../components/admin/CheckinScannerPage';
import OrganizerGateCheckinPanel from '../../../components/organizer/OrganizerGateCheckinPanel';
import { getApiBaseUrl } from '../../../config/apiBase';
import { getFestOrganizerSession, getFestOrganizerToken } from '../../../utils/festOrganizerSession';
import {
    fetchFestOrganizerAuditoriumGate,
    fetchFestOrganizerAuditoriumGateRoster,
    festOrganizerCheckin,
} from '../../../services/api/festOrganizer.api';
import { useDialog } from '../../../context/DialogContext';
import { getFestPlugin } from '../plugins/registry';
import { organizerHasPage } from './festOrganizerPages';

function normalizeAuditoriumRow(ticket) {
    if (!ticket) return null;
    return {
        id: String(ticket.registrationId || ticket.id),
        name: ticket.fullName || 'Guest',
        phone: ticket.phone || '',
        email: ticket.email || '',
        checkedIn: Boolean(ticket.checkedIn),
        checkedInAt: ticket.checkedInAt || null,
        photoUrl: ticket.ticketPhotoUrl || '',
        meta: [ticket.categoryLabel, ticket.college].filter(Boolean).join(' · '),
        raw: ticket,
    };
}

export default function FestOrganizerAuditoriumScanPage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const api = getApiBaseUrl();
    const { toast } = useDialog();
    const canOpenAuditorium = organizerHasPage(getFestOrganizerSession(), 'auditorium');
    const [competitionId, setCompetitionId] = useState('');
    const [categories, setCategories] = useState([]);
    const [rosterKey, setRosterKey] = useState(0);
    const [categoryFilter, setCategoryFilter] = useState('');

    const loadGate = useCallback(() => {
        if (getFestPlugin(festId).id !== 'mindspark') return;
        fetchFestOrganizerAuditoriumGate(festId)
            .then((res) => {
                setCompetitionId(res?.competitionId || '');
                setCategories(Array.isArray(res?.categories) ? res.categories : []);
            })
            .catch((e) => toast(e.message || 'Failed to load auditorium gate'));
    }, [festId, toast]);

    useEffect(() => {
        loadGate();
        const poll = setInterval(() => {
            if (!document.hidden) loadGate();
        }, 6000);
        return () => clearInterval(poll);
    }, [loadGate]);

    const refreshTimerRef = useRef(null);
    const refreshSoon = useCallback((withRoster = true) => {
        if (refreshTimerRef.current) return;
        refreshTimerRef.current = setTimeout(() => {
            refreshTimerRef.current = null;
            loadGate();
            if (withRoster) setRosterKey((k) => k + 1);
        }, 1500);
    }, [loadGate]);

    useEffect(() => () => clearTimeout(refreshTimerRef.current), []);

    const listRoster = useCallback(
        ({ checkInStatus, search, page, limit }) => fetchFestOrganizerAuditoriumGateRoster(festId, {
            checkInStatus,
            search,
            page,
            limit,
            categoryId: categoryFilter,
        }),
        [festId, categoryFilter],
    );

    const selectedCategory = categories.find((c) => c.id === categoryFilter) || null;
    const toggleCategory = (id) => setCategoryFilter((current) => (current === id ? '' : id));

    const manualCheckin = useCallback(async (row) => {
        const res = await festOrganizerCheckin(festId, { registrationId: row.id, competitionId });
        refreshSoon(false);
        return res;
    }, [festId, competitionId, refreshSoon]);

    if (getFestPlugin(festId).id !== 'mindspark') {
        return (
            <div className="p-6 text-center text-sm text-gray-400">
                Auditorium scanner is MindSpark-only.{' '}
                <Link to={`/fest-organizer/fests/${festId}`} className="text-[#0ECCEE]">Back</Link>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-2xl mx-auto pb-10">
            {canOpenAuditorium ? (
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/auditorium`)}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-400"
                    >
                        <ArrowLeft size={16} /> Auditorium
                    </button>
                </div>
            ) : null}

            <div>
                <h1 className="text-xl font-bold text-white">Auditorium gate</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Photo ticket check-in only. Other competition QRs will be rejected.
                </p>
                {categories.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                        <button
                            type="button"
                            onClick={() => setCategoryFilter('')}
                            aria-pressed={!categoryFilter}
                            className={`text-left rounded-xl border px-3 py-2 min-h-[52px] transition-colors ${
                                !categoryFilter ? 'border-[#0ECCEE] bg-[#0ECCEE]/10' : 'border-white/10 bg-[#161718]'
                            }`}
                        >
                            <p className="text-[11px] font-semibold text-white truncate">All categories</p>
                            <p className="text-xs mt-0.5 tabular-nums">
                                <span className="text-emerald-400">
                                    {categories.reduce((n, c) => n + (c.inside || 0), 0)} in
                                </span>
                                <span className="text-gray-600"> · </span>
                                <span className="text-amber-300">
                                    {categories.reduce((n, c) => n + (c.outside || 0), 0)} outside
                                </span>
                            </p>
                        </button>
                        {categories.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => toggleCategory(c.id)}
                                aria-pressed={categoryFilter === c.id}
                                className={`text-left rounded-xl border px-3 py-2 min-h-[52px] transition-colors ${
                                    categoryFilter === c.id ? 'border-[#0ECCEE] bg-[#0ECCEE]/10' : 'border-white/10 bg-[#161718]'
                                }`}
                            >
                                <p className="text-[11px] font-semibold text-[#0ECCEE] truncate">{c.label}</p>
                                <p className="text-xs mt-0.5 tabular-nums">
                                    <span className="text-emerald-400">{c.inside || 0} in</span>
                                    <span className="text-gray-600"> · </span>
                                    <span className="text-amber-300">{c.outside || 0} outside</span>
                                </p>
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            {competitionId ? (
                <>
                    <CheckinScannerPage
                        embedded
                        showStats
                        showSheetStatus={false}
                        festId={festId}
                        competitionId={competitionId}
                        festName="Auditorium check-in"
                        getAuthToken={getFestOrganizerToken}
                        onCheckinSuccess={() => refreshSoon(true)}
                        checkinUrl={`${api}/fest-organizer/fests/${festId}/checkin`}
                        statsUrl={`${api}/fest-organizer/fests/${festId}/checkin/stats?competitionId=${encodeURIComponent(competitionId)}`}
                        sessionExpiredMessage="Organizer session expired — please sign in again."
                        authErrorMessage="Access denied or session expired."
                        title="Scan auditorium ticket"
                        subtitle="Face photo + ID appear after a successful scan"
                    />

                    <OrganizerGateCheckinPanel
                        key={`roster-${categoryFilter || 'all'}`}
                        listRoster={listRoster}
                        manualCheckin={manualCheckin}
                        normalize={normalizeAuditoriumRow}
                        refreshKey={rosterKey}
                        onToast={toast}
                        searchPlaceholder="Name, phone, email, MIS, or college"
                        outsideStatus="not_in"
                        insideStatus="checked_in"
                        pollMs={6000}
                        labels={{
                            title: selectedCategory ? `Manual check-in · ${selectedCategory.label}` : 'Manual check-in · All categories',
                            subtitle: 'Tap a category above to filter · search and tap Check in',
                            outside: 'Still outside',
                            inside: 'Checked in',
                        }}
                    />
                </>
            ) : (
                <p className="text-sm text-gray-500">Loading scanner…</p>
            )}
        </div>
    );
}
