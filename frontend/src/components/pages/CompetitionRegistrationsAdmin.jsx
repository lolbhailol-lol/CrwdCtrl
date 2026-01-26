import React, { useState, useEffect } from 'react';
import { useDarkMode } from '../../context/DarkModeContext';
import {
    Users,
    Trophy,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Eye,
    Filter,
    Download
} from 'lucide-react';

export default function CompetitionRegistrationsAdmin() {
    const { isDark } = useDarkMode();
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState({});
    const [filters, setFilters] = useState({
        competition: '',
        status: '',
        page: 1
    });

    // Fetch registrations from API
    const fetchRegistrations = async () => {
        try {
            setLoading(true);
            const API_BASE_URL = 'https://crwdctrl-730576782394.asia-south2.run.app/api';

            const queryParams = new URLSearchParams();
            if (filters.competition) queryParams.append('competition', filters.competition);
            if (filters.status) queryParams.append('status', filters.status);
            queryParams.append('page', filters.page);
            queryParams.append('limit', '20');

            const response = await fetch(`${API_BASE_URL}/competitions/registrations?${queryParams}`);

            if (!response.ok) {
                throw new Error('Failed to fetch registrations');
            }

            const result = await response.json();
            setRegistrations(result.data.registrations);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Fetch statistics
    const fetchStats = async () => {
        try {
            const API_BASE_URL = 'https://crwdctrl-730576782394.asia-south2.run.app/api';
            const response = await fetch(`${API_BASE_URL}/competitions/registrations/stats`);

            if (response.ok) {
                const result = await response.json();
                setStats(result.data);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    // Update registration status
    const updateStatus = async (registrationId, newStatus, reviewNotes = '') => {
        try {
            const API_BASE_URL = 'https://crwdctrl-730576782394.asia-south2.run.app/api';
            const response = await fetch(`${API_BASE_URL}/competitions/registrations/${registrationId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: newStatus,
                    reviewNotes
                })
            });

            if (response.ok) {
                // Refresh registrations
                fetchRegistrations();
                fetchStats();
            } else {
                throw new Error('Failed to update status');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        fetchRegistrations();
        fetchStats();
    }, [filters]);

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'rejected':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'under_review':
                return <Clock className="w-4 h-4 text-yellow-500" />;
            case 'payment_verified':
                return <CheckCircle className="w-4 h-4 text-blue-500" />;
            case 'waitlisted':
                return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            default:
                return <Clock className="w-4 h-4 text-gray-500" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved':
                return 'bg-green-100 text-green-800';
            case 'rejected':
                return 'bg-red-100 text-red-800';
            case 'under_review':
                return 'bg-yellow-100 text-yellow-800';
            case 'payment_verified':
                return 'bg-blue-100 text-blue-800';
            case 'waitlisted':
                return 'bg-orange-100 text-orange-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return (
            <div className={`min-h-screen p-6 ${isDark ? 'bg-[#0E0E0F] text-white' : 'bg-gray-50 text-gray-900'}`}>
                <div className="max-w-7xl mx-auto">
                    <div className="animate-pulse">
                        <div className="h-8 bg-gray-300 rounded w-64 mb-6"></div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-24 bg-gray-300 rounded-lg"></div>
                            ))}
                        </div>
                        <div className="h-96 bg-gray-300 rounded-lg"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen p-6 ${isDark ? 'bg-[#0E0E0F] text-white' : 'bg-gray-50 text-gray-900'}`}>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Competition Registrations
                    </h1>
                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        Manage and review competition registrations
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className={`mb-6 p-4 rounded-lg border ${isDark ? 'bg-red-900/20 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        <div className="flex items-center space-x-2">
                            <XCircle className="w-5 h-5" />
                            <span className="font-medium">Error!</span>
                        </div>
                        <p className="mt-1 text-sm">{error}</p>
                    </div>
                )}

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className={`p-6 rounded-lg border ${isDark ? 'bg-[#1B1C1E] border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    Total Registrations
                                </p>
                                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {stats.total || 0}
                                </p>
                            </div>
                            <Users className="w-8 h-8 text-blue-500" />
                        </div>
                    </div>

                    <div className={`p-6 rounded-lg border ${isDark ? 'bg-[#1B1C1E] border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    Approved
                                </p>
                                <p className={`text-2xl font-bold text-green-500`}>
                                    {stats.statusBreakdown?.approved || 0}
                                </p>
                            </div>
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                    </div>

                    <div className={`p-6 rounded-lg border ${isDark ? 'bg-[#1B1C1E] border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    Under Review
                                </p>
                                <p className={`text-2xl font-bold text-yellow-500`}>
                                    {(stats.statusBreakdown?.submitted || 0) + (stats.statusBreakdown?.under_review || 0)}
                                </p>
                            </div>
                            <Clock className="w-8 h-8 text-yellow-500" />
                        </div>
                    </div>

                    <div className={`p-6 rounded-lg border ${isDark ? 'bg-[#1B1C1E] border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    Payment Verified
                                </p>
                                <p className={`text-2xl font-bold text-blue-500`}>
                                    {stats.statusBreakdown?.payment_verified || 0}
                                </p>
                            </div>
                            <Trophy className="w-8 h-8 text-blue-500" />
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className={`mb-6 p-4 rounded-lg border ${isDark ? 'bg-[#1B1C1E] border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center space-x-2">
                            <Filter className="w-4 h-4" />
                            <span className="text-sm font-medium">Filters:</span>
                        </div>

                        <select
                            value={filters.competition}
                            onChange={(e) => setFilters(prev => ({ ...prev, competition: e.target.value, page: 1 }))}
                            className={`px-3 py-1 rounded border text-sm ${isDark
                                ? 'bg-[#2A2B2D] border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                                }`}
                        >
                            <option value="">All Competitions</option>
                            <option value="InSync (Group Dance)">InSync (Group Dance)</option>
                            <option value="Head Bang (Band Wars)">Head Bang (Band Wars)</option>
                            <option value="Humming (Solo Singing)">Humming (Solo Singing)</option>
                            <option value="Dastak (Street Play)">Dastak (Street Play)</option>
                            <option value="Inner Flame (Solo Dancing)">Inner Flame (Solo Dancing)</option>
                            <option value="Platform (Open Mic)">Platform (Open Mic)</option>
                            <option value="Art Maestro (Fine Arts)">Art Maestro (Fine Arts)</option>
                            <option value="Glamour Nova (Fashion Show)(Male)">Glamour Nova (Fashion Show)(Male)</option>
                        </select>

                        <select
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                            className={`px-3 py-1 rounded border text-sm ${isDark
                                ? 'bg-[#2A2B2D] border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                                }`}
                        >
                            <option value="">All Status</option>
                            <option value="submitted">Submitted</option>
                            <option value="under_review">Under Review</option>
                            <option value="payment_verified">Payment Verified</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="waitlisted">Waitlisted</option>
                        </select>

                        <button
                            onClick={() => setFilters({ competition: '', status: '', page: 1 })}
                            className={`px-3 py-1 rounded text-sm border ${isDark
                                ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>

                {/* Registrations Table */}
                <div className={`rounded-lg border ${isDark ? 'bg-[#1B1C1E] border-gray-700' : 'bg-white border-gray-200'} overflow-hidden`}>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className={`${isDark ? 'bg-[#2A2B2D]' : 'bg-gray-50'}`}>
                                <tr>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                                        Participant
                                    </th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                                        Competition
                                    </th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                                        Registration ID
                                    </th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                                        Status
                                    </th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                                        Submitted
                                    </th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                {registrations.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center">
                                            <div className="flex flex-col items-center">
                                                <Users className={`w-12 h-12 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                                <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    No registrations found
                                                </p>
                                                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    Registrations will appear here once submitted
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    registrations.map((registration) => (
                                        <tr key={registration._id} className={`hover:${isDark ? 'bg-[#2A2B2D]' : 'bg-gray-50'}`}>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                        {registration.name}
                                                    </div>
                                                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        {registration.email}
                                                    </div>
                                                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        {registration.contactNumber}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {registration.competitionName}
                                                </div>
                                                {registration.numberOfParticipants && (
                                                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        Team Size: {registration.numberOfParticipants}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`text-sm font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    {registration.registrationId}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-2">
                                                    {getStatusIcon(registration.status)}
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(registration.status)}`}>
                                                        {registration.status.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                                                    {new Date(registration.submittedAt).toLocaleDateString()}
                                                </div>
                                                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>
                                                    {new Date(registration.submittedAt).toLocaleTimeString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => {/* View details logic */ }}
                                                        className={`p-1 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {registration.status === 'submitted' && (
                                                        <>
                                                            <button
                                                                onClick={() => updateStatus(registration.registrationId, 'approved')}
                                                                className="p-1 rounded hover:bg-green-100 text-green-600"
                                                                title="Approve"
                                                            >
                                                                <CheckCircle className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => updateStatus(registration.registrationId, 'rejected')}
                                                                className="p-1 rounded hover:bg-red-100 text-red-600"
                                                                title="Reject"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}