import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader, Pencil, RefreshCw, Trophy } from 'lucide-react';
import {
    fetchFestOrganizerCompetitionDetails,
    buildFestOrganizerAdminApi,
} from '../../services/api/festOrganizer.api';
import CompetitionModal from '../../components/admin/Competition_Modal';

/**
 * Opens the same admin Competition_Modal for this fest so organizers
 * edit / add competitions in the identical Basic Info → Images & Rules → Rounds flow.
 */
export default function FestOrganizerCompetitionDetailsPage() {
    const { festId, competitionId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [fest, setFest] = useState(null);
    const [competitionName, setCompetitionName] = useState('');
    const [showModal, setShowModal] = useState(true);

    const adminApi = useMemo(() => buildFestOrganizerAdminApi(festId), [festId]);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchFestOrganizerCompetitionDetails(festId, competitionId);
            setFest({
                _id: data.fest?.id || festId,
                festName: data.fest?.festName || '',
                slug: data.fest?.slug || '',
            });
            setCompetitionName(data.competition?.name || '');
        } catch (e) {
            setError(e.message || 'Failed to load competition');
            setFest({ _id: festId, festName: '' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [festId, competitionId]);

    if (loading) {
        return (
            <div className="flex justify-center py-20 text-gray-400 gap-2">
                <Loader className="animate-spin" size={18} /> Loading…
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <button
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions`)}
                        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white mb-2"
                    >
                        <ArrowLeft size={14} /> Competitions
                    </button>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Trophy className="text-[#0ECCEE]" size={20} />
                        Edit competition details
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {competitionName ? `${competitionName} · ` : ''}
                        Same admin wizard (add photos, rules line-by-line, rounds)
                    </p>
                    {error ? <p className="text-sm text-red-400 mt-2">{error}</p> : null}
                </div>
                <button type="button" onClick={load} className="p-2 rounded-xl border border-white/10 text-gray-400">
                    <RefreshCw size={16} />
                </button>
            </div>

            <button
                type="button"
                onClick={() => setShowModal(true)}
                className="w-full rounded-2xl border border-[#0ECCEE]/40 bg-[#0ECCEE]/15 p-4 text-left hover:border-[#0ECCEE]/60 transition flex items-center gap-3"
            >
                <Pencil className="text-[#0ECCEE]" size={18} />
                <div>
                    <p className="text-sm font-semibold text-white">Open admin competition form</p>
                    <p className="text-xs text-gray-400 mt-0.5">Create new or edit any competition for this fest</p>
                </div>
            </button>

            <Link
                to={`/fest-organizer/fests/${festId}/competitions/${competitionId}`}
                className="block text-center text-sm text-gray-400 hover:text-white"
            >
                Back to ops desk
            </Link>

            {showModal && fest?._id ? (
                <CompetitionModal
                    fest={fest}
                    api={adminApi}
                    initialCompetitionId={competitionId}
                    onClose={() => {
                        setShowModal(false);
                        navigate(`/fest-organizer/fests/${festId}/competitions`);
                    }}
                    onSaved={() => {
                        setShowModal(false);
                        load();
                        navigate(`/fest-organizer/fests/${festId}/competitions`);
                    }}
                />
            ) : null}
        </div>
    );
}
