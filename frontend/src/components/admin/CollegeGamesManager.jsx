import { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Search,
  RefreshCw,
  Sparkles,
  Calendar,
  Users,
  MapPin,
  Trophy,
  IndianRupee,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Image,
  AlertCircle,
  Shield,
  FileText,
  Sliders,
} from 'lucide-react';
import CoverImageUploadField from './CoverImageUploadField';

const inputClass =
  'w-full rounded-lg border border-gray-700 bg-[#191b1d] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-[#0ECCEE] focus:ring-1 focus:ring-[#0ECCEE]';
const labelClass = 'block text-xs font-semibold text-gray-300 mb-1';
const helperClass = 'text-[11px] text-gray-500 mt-0.5';

function toDatetimeLocal(val) {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toLines(arr) {
  return Array.isArray(arr) ? arr.join('\n') : '';
}

function fromLines(text) {
  return String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toPlacementString(arr) {
  return Array.isArray(arr) && arr.length ? arr.join(', ') : '100, 80, 60';
}

function fromPlacementString(str) {
  return String(str || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n >= 0);
}

const DEFAULT_GAME_STATE = {
  title: '',
  slug: '',
  tagline: '',
  description: '',
  coverImage: '',
  gameType: 'campus_game',
  hostCollegeId: '',
  participationMode: 'intercollege',
  allowedCollegeIds: [],
  city: '',
  venue: '',
  meetingPoint: '',
  startsAt: '',
  endsAt: '',
  registrationOpensAt: '',
  registrationClosesAt: '',
  checkInOpensAt: '',
  checkInClosesAt: '',
  teamSize: 4,
  capacity: 20,
  reservedSlots: 0,
  minimumTeams: 1,
  feePerTeam: 0,
  platformFeePercent: 0,
  prizeAmount: 0,
  rules: '',
  steps: '',
  requirements: '',
  safetyNotes: '',
  placementPoints: '100, 80, 60',
  status: 'draft',
  operationalStatus: 'draft',
  offlineEnabled: false,
  engineType: 'none',
  engineEventSlug: '',
};

export default function CollegeGamesManager({
  games = [],
  colleges = [],
  onRefresh,
  onSaveGame,
  onUpdateGameStatus,
  onDeleteGame,
  busy = false,
}) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(DEFAULT_GAME_STATE);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState('basic');
  const formRef = useRef(null);

  const stats = useMemo(() => {
    return {
      total: games.length,
      published: games.filter((g) => g.status === 'published').length,
      draft: games.filter((g) => g.status === 'draft').length,
      completed: games.filter((g) => g.status === 'completed').length,
      cancelled: games.filter((g) => g.status === 'cancelled').length,
    };
  }, [games]);

  const filteredGames = useMemo(() => {
    return games.filter((item) => {
      const matchSearch =
        !search.trim() ||
        item.title?.toLowerCase().includes(search.toLowerCase()) ||
        item.slug?.toLowerCase().includes(search.toLowerCase()) ||
        item.city?.toLowerCase().includes(search.toLowerCase()) ||
        item.venue?.toLowerCase().includes(search.toLowerCase()) ||
        item.hostCollegeId?.name?.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === 'all' || item.status === statusFilter;

      const matchCollege =
        collegeFilter === 'all' ||
        String(item.hostCollegeId?._id || item.hostCollegeId) === collegeFilter;

      return matchSearch && matchStatus && matchCollege;
    });
  }, [games, search, statusFilter, collegeFilter]);

  const handleStartEdit = (item) => {
    setEditingId(item._id);
    setForm({
      title: item.title || '',
      slug: item.slug || '',
      tagline: item.tagline || '',
      description: item.description || '',
      coverImage: item.coverImage || '',
      gameType: item.gameType || 'campus_game',
      hostCollegeId: item.hostCollegeId?._id || item.hostCollegeId || '',
      participationMode: item.participationMode || 'intercollege',
      allowedCollegeIds: item.allowedCollegeIds || [],
      city: item.city || '',
      venue: item.venue || '',
      meetingPoint: item.meetingPoint || '',
      startsAt: toDatetimeLocal(item.startsAt),
      endsAt: toDatetimeLocal(item.endsAt),
      registrationOpensAt: toDatetimeLocal(item.registrationOpensAt),
      registrationClosesAt: toDatetimeLocal(item.registrationClosesAt),
      checkInOpensAt: toDatetimeLocal(item.checkInOpensAt),
      checkInClosesAt: toDatetimeLocal(item.checkInClosesAt),
      teamSize: item.teamSize ?? 4,
      capacity: item.capacity ?? 20,
      reservedSlots: item.reservedSlots ?? 0,
      minimumTeams: item.minimumTeams ?? 1,
      feePerTeam: item.feePerTeam ?? 0,
      platformFeePercent: item.platformFeePercent ?? 0,
      prizeAmount: item.prizeAmount ?? 0,
      rules: toLines(item.rules),
      steps: toLines(item.steps),
      requirements: toLines(item.requirements),
      safetyNotes: toLines(item.safetyNotes),
      placementPoints: toPlacementString(item.placementPoints),
      status: item.status || 'draft',
      operationalStatus: item.operationalStatus || item.status || 'draft',
      offlineEnabled: Boolean(item.offlineEnabled),
      engineType: item.engine?.type || 'none',
      engineEventSlug: item.engine?.eventSlug || '',
    });
    setFormOpen(true);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(DEFAULT_GAME_STATE);
  };

  const handleAutoSlug = () => {
    if (!form.title) return;
    const auto = form.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setForm((prev) => ({ ...prev, slug: auto }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert('Please enter a Game Title');
      return;
    }

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      tagline: form.tagline.trim(),
      description: form.description.trim(),
      coverImage: form.coverImage.trim(),
      gameType: form.gameType.trim(),
      hostCollegeId: form.hostCollegeId || null,
      participationMode: form.participationMode,
      allowedCollegeIds: form.allowedCollegeIds,
      city: form.city.trim(),
      venue: form.venue.trim(),
      meetingPoint: form.meetingPoint.trim(),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      registrationOpensAt: form.registrationOpensAt
        ? new Date(form.registrationOpensAt).toISOString()
        : null,
      registrationClosesAt: form.registrationClosesAt
        ? new Date(form.registrationClosesAt).toISOString()
        : null,
      checkInOpensAt: form.checkInOpensAt
        ? new Date(form.checkInOpensAt).toISOString()
        : null,
      checkInClosesAt: form.checkInClosesAt
        ? new Date(form.checkInClosesAt).toISOString()
        : null,
      teamSize: Number(form.teamSize) || 4,
      capacity: Number(form.capacity) || 20,
      reservedSlots: Number(form.reservedSlots) || 0,
      minimumTeams: Number(form.minimumTeams) || 1,
      feePerTeam: Number(form.feePerTeam) || 0,
      platformFeePercent: Number(form.platformFeePercent) || 0,
      prizeAmount: Number(form.prizeAmount) || 0,
      rules: fromLines(form.rules),
      steps: fromLines(form.steps),
      requirements: fromLines(form.requirements),
      safetyNotes: fromLines(form.safetyNotes),
      placementPoints: fromPlacementString(form.placementPoints),
      status: form.status,
      operationalStatus: form.operationalStatus || form.status,
      offlineEnabled: Boolean(form.offlineEnabled),
      engine: {
        type: form.engineType === 'campus_hunt' ? 'campus_hunt' : 'none',
        eventSlug: form.engineEventSlug.trim(),
      },
    };

    const success = await onSaveGame(payload, editingId);
    if (success) {
      handleCancelEdit();
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            <CheckCircle size={12} /> Published
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
            <Clock size={12} /> Draft
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
            <Trophy size={12} /> Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
            <XCircle size={12} /> Cancelled
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-semibold text-gray-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Overview and Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-gray-800 bg-[#111213] p-4 flex flex-col justify-between">
          <span className="text-xs text-gray-400 font-medium">Total Games</span>
          <span className="text-2xl font-bold text-white mt-1">{stats.total}</span>
        </div>
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 flex flex-col justify-between">
          <span className="text-xs text-emerald-300 font-medium">Published</span>
          <span className="text-2xl font-bold text-emerald-400 mt-1">{stats.published}</span>
        </div>
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 flex flex-col justify-between">
          <span className="text-xs text-amber-300 font-medium">Drafts</span>
          <span className="text-2xl font-bold text-amber-400 mt-1">{stats.draft}</span>
        </div>
        <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 flex flex-col justify-between">
          <span className="text-xs text-blue-300 font-medium">Completed</span>
          <span className="text-2xl font-bold text-blue-400 mt-1">{stats.completed}</span>
        </div>
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-xs text-rose-300 font-medium">Cancelled</span>
          <span className="text-2xl font-bold text-rose-400 mt-1">{stats.cancelled}</span>
        </div>
      </div>

      {/* Main Create/Edit Game Section */}
      <div ref={formRef} className="rounded-2xl border border-gray-800 bg-[#111213] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-[#161718]/60 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {editingId ? (
                  <>
                    <Edit2 size={18} className="text-[#0ECCEE]" />
                    Edit Game
                    <span className="text-xs font-normal text-gray-400 bg-black/40 px-2 py-0.5 rounded border border-gray-700">
                      ID: {editingId}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} className="text-[#0ECCEE]" />
                    Create New Game
                  </>
                )}
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {editingId
                ? 'Update game specifications, pricing, schedule, and live status.'
                : 'Configure a new campus game, tournament, or treasure hunt with complete rules and slots.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3 py-1.5 rounded-lg border border-gray-700 hover:bg-gray-800 text-xs text-gray-300 transition-colors"
              >
                Cancel Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => setFormOpen((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg border border-gray-700 bg-black/30 hover:bg-black/60 text-xs font-medium text-gray-200 flex items-center gap-1.5 transition-colors"
            >
              {formOpen ? (
                <>
                  <ChevronUp size={14} /> Collapse Form
                </>
              ) : (
                <>
                  <Plus size={14} className="text-[#0ECCEE]" /> {editingId ? 'Open Editor' : 'Open Create Form'}
                </>
              )}
            </button>
          </div>
        </div>

        {formOpen && (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Form Section Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-800 pb-3 overflow-x-auto text-xs font-medium">
              {[
                { id: 'basic', label: '1. Basic Info', icon: Sparkles },
                { id: 'college', label: '2. College & Venue', icon: MapPin },
                { id: 'schedule', label: '3. Schedule & Timing', icon: Calendar },
                { id: 'teams', label: '4. Capacity & Pricing', icon: Users },
                { id: 'rules', label: '5. Rules & Guidelines', icon: FileText },
                { id: 'engine', label: '6. Status & Engine', icon: Sliders },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeFormTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFormTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-[#0ECCEE] text-black font-semibold'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TAB 1: BASIC INFO */}
            {activeFormTab === 'basic' && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Game Title *</label>
                    <input
                      className={inputClass}
                      placeholder="e.g. MIT-WPU Campus Treasure Hunt 2026"
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                    <p className={helperClass}>Primary display title for the game card and header</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-300">URL Slug *</label>
                      <button
                        type="button"
                        onClick={handleAutoSlug}
                        className="text-[11px] text-[#0ECCEE] hover:underline"
                      >
                        Auto-generate
                      </button>
                    </div>
                    <input
                      className={inputClass}
                      placeholder="e.g. mit-wpu-campus-hunt-2026"
                      required
                      value={form.slug}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''),
                        })
                      }
                    />
                    <p className={helperClass}>Public URL path: /games/{form.slug || 'slug'}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Tagline / Hook</label>
                    <input
                      className={inputClass}
                      placeholder="e.g. Decode clues, solve puzzles, race for ₹15,000"
                      value={form.tagline}
                      onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                    />
                    <p className={helperClass}>One-liner shown beneath the title</p>
                  </div>

                  <div>
                    <label className={labelClass}>Game Type</label>
                    <select
                      className={inputClass}
                      value={form.gameType}
                      onChange={(e) => setForm({ ...form, gameType: e.target.value })}
                    >
                      <option value="campus_game">Campus Game (General)</option>
                      <option value="treasure_hunt">Treasure Hunt</option>
                      <option value="campus_hunt">Campus Hunt</option>
                      <option value="tournament">College Tournament</option>
                      <option value="esports">Esports & Gaming</option>
                      <option value="quiz">Quiz Bowl / Trivia</option>
                      <option value="hackathon">Hackathon / Tech Sprint</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Detailed Description</label>
                  <textarea
                    rows={4}
                    className={inputClass}
                    placeholder="Describe the format, story, challenges, and prizes..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                <div>
                  <CoverImageUploadField
                    value={form.coverImage}
                    onChange={(url) => setForm((prev) => ({ ...prev, coverImage: url }))}
                    label="Cover Poster Image"
                    hint="Upload high-res banner or poster (Square or 16:9 ratio recommended)"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: COLLEGE & LOCATION */}
            {activeFormTab === 'college' && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Host College</label>
                    <select
                      className={inputClass}
                      value={form.hostCollegeId}
                      onChange={(e) => setForm({ ...form, hostCollegeId: e.target.value })}
                    >
                      <option value="">No Host College (Independent)</option>
                      {colleges.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} {c.shortName ? `(${c.shortName})` : ''} — {c.city || 'Campus'}
                        </option>
                      ))}
                    </select>
                    <p className={helperClass}>Attaches the host campus branding and domain validation</p>
                  </div>

                  <div>
                    <label className={labelClass}>Participation Mode</label>
                    <select
                      className={inputClass}
                      value={form.participationMode}
                      onChange={(e) => setForm({ ...form, participationMode: e.target.value })}
                    >
                      <option value="intercollege">Intercollege (Open to any verified college)</option>
                      <option value="on_campus">On-Campus Only (Restricted to host college email)</option>
                    </select>
                    <p className={helperClass}>Whether students from other institutions can register</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className={labelClass}>City</label>
                    <input
                      className={inputClass}
                      placeholder="e.g. Pune, Mumbai, Bangalore"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Campus Venue</label>
                    <input
                      className={inputClass}
                      placeholder="e.g. MIT World Peace Dome, Ground Floor"
                      value={form.venue}
                      onChange={(e) => setForm({ ...form, venue: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Assembly / Meeting Point</label>
                    <input
                      className={inputClass}
                      placeholder="e.g. Main Audi Foyer, Gate 3"
                      value={form.meetingPoint}
                      onChange={(e) => setForm({ ...form, meetingPoint: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SCHEDULE & TIMING */}
            {activeFormTab === 'schedule' && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Game Starts At *</label>
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={form.startsAt}
                      onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    />
                    <p className={helperClass}>When countdown ends and game challenges unlock</p>
                  </div>

                  <div>
                    <label className={labelClass}>Game Ends At</label>
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={form.endsAt}
                      onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                    />
                    <p className={helperClass}>Hard cutoff for final submissions</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Registration Opens At</label>
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={form.registrationOpensAt}
                      onChange={(e) => setForm({ ...form, registrationOpensAt: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Registration Closes At</label>
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={form.registrationClosesAt}
                      onChange={(e) => setForm({ ...form, registrationClosesAt: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Check-in Opens At</label>
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={form.checkInOpensAt}
                      onChange={(e) => setForm({ ...form, checkInOpensAt: e.target.value })}
                    />
                    <p className={helperClass}>When QR scanning at the desk begins</p>
                  </div>

                  <div>
                    <label className={labelClass}>Check-in Closes At</label>
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={form.checkInClosesAt}
                      onChange={(e) => setForm({ ...form, checkInClosesAt: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CAPACITY & PRICING */}
            {activeFormTab === 'teams' && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <label className={labelClass}>Team Size (People)</label>
                    <input
                      type="number"
                      min="2"
                      max="12"
                      className={inputClass}
                      value={form.teamSize}
                      onChange={(e) => setForm({ ...form, teamSize: Number(e.target.value) })}
                    />
                    <p className={helperClass}>Required members per team (e.g. 4)</p>
                  </div>

                  <div>
                    <label className={labelClass}>Team Capacity</label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      className={inputClass}
                      value={form.capacity}
                      onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    />
                    <p className={helperClass}>Total teams that can book slots</p>
                  </div>

                  <div>
                    <label className={labelClass}>Reserved Slots</label>
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      value={form.reservedSlots}
                      onChange={(e) => setForm({ ...form, reservedSlots: Number(e.target.value) })}
                    />
                    <p className={helperClass}>Held for host direct allocations</p>
                  </div>

                  <div>
                    <label className={labelClass}>Minimum Teams Required</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      className={inputClass}
                      value={form.minimumTeams}
                      onChange={(e) => setForm({ ...form, minimumTeams: Number(e.target.value) })}
                    />
                    <p className={helperClass}>Min teams before game is confirmed</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className={labelClass}>Registration Fee (₹ per Team)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-400 text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        className={`${inputClass} pl-7`}
                        value={form.feePerTeam}
                        onChange={(e) => setForm({ ...form, feePerTeam: Number(e.target.value) })}
                      />
                    </div>
                    <p className={helperClass}>Set 0 for Free Registration</p>
                  </div>

                  <div>
                    <label className={labelClass}>Platform Fee Share (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className={inputClass}
                      value={form.platformFeePercent}
                      onChange={(e) => setForm({ ...form, platformFeePercent: Number(e.target.value) })}
                    />
                    <p className={helperClass}>CrwdCtrl cut on ticket sales</p>
                  </div>

                  <div>
                    <label className={labelClass}>Prize Pool Amount (₹)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-400 text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        className={`${inputClass} pl-7`}
                        value={form.prizeAmount}
                        onChange={(e) => setForm({ ...form, prizeAmount: Number(e.target.value) })}
                      />
                    </div>
                    <p className={helperClass}>Displayed prominently on game pass</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: RULES & GUIDELINES */}
            {activeFormTab === 'rules' && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Official Rules (One rule per line)</label>
                    <textarea
                      rows={5}
                      className={inputClass}
                      placeholder="No external help or unauthorized tools&#10;All team members must arrive together for check-in&#10;Organizers decision is final"
                      value={form.rules}
                      onChange={(e) => setForm({ ...form, rules: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Steps / How It Works (One step per line)</label>
                    <textarea
                      rows={5}
                      className={inputClass}
                      placeholder="1. Register team and confirm slots&#10;2. Check in at campus desk to receive clue packet&#10;3. Solve clues across checkpoint stations"
                      value={form.steps}
                      onChange={(e) => setForm({ ...form, steps: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Requirements (One item per line)</label>
                    <textarea
                      rows={3}
                      className={inputClass}
                      placeholder="Valid college student ID&#10;Smartphone with GPS & active internet&#10;Comfortable walking shoes"
                      value={form.requirements}
                      onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Safety & Conduct Notes (One item per line)</label>
                    <textarea
                      rows={3}
                      className={inputClass}
                      placeholder="Stay within designated campus boundary&#10;Do not enter restricted lab areas&#10;Report any injury immediately to safety desk"
                      value={form.safetyNotes}
                      onChange={(e) => setForm({ ...form, safetyNotes: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Placement Ranking Points</label>
                  <input
                    className={inputClass}
                    placeholder="100, 80, 60, 40"
                    value={form.placementPoints}
                    onChange={(e) => setForm({ ...form, placementPoints: e.target.value })}
                  />
                  <p className={helperClass}>Points awarded for 1st, 2nd, 3rd, 4th place teams toward college rankings</p>
                </div>
              </div>
            )}

            {/* TAB 6: STATUS & ENGINE */}
            {activeFormTab === 'engine' && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Publication Status *</label>
                    <select
                      className={inputClass}
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="draft">Draft (Visible only to Admins & Hosts)</option>
                      <option value="published">Published (Visible on CrwdCtrl public site)</option>
                      <option value="completed">Completed (Archived with audited results)</option>
                      <option value="cancelled">Cancelled (Refunds and stops active)</option>
                    </select>
                    <p className={helperClass}>Controls visibility on /games and search indexes</p>
                  </div>

                  <div>
                    <label className={labelClass}>Operational Game Status</label>
                    <select
                      className={inputClass}
                      value={form.operationalStatus}
                      onChange={(e) => setForm({ ...form, operationalStatus: e.target.value })}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published / Open for Signups</option>
                      <option value="registration_closed">Registration Closed</option>
                      <option value="ready">Ready for Check-in</option>
                      <option value="live">Live in Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-800 bg-black/30 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="offlineEnabled"
                      className="w-4 h-4 rounded text-[#0ECCEE] focus:ring-[#0ECCEE] border-gray-700 bg-gray-900"
                      checked={form.offlineEnabled}
                      onChange={(e) => setForm({ ...form, offlineEnabled: e.target.checked })}
                    />
                    <label htmlFor="offlineEnabled" className="text-xs font-semibold text-gray-200 cursor-pointer">
                      Enable Offline Engine Sync (Local mesh & offline check-in caching)
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-gray-800">
                    <div>
                      <label className={labelClass}>Automated Engine</label>
                      <select
                        className={inputClass}
                        value={form.engineType}
                        onChange={(e) => setForm({ ...form, engineType: e.target.value })}
                      >
                        <option value="none">None (Standard Desk & Scoreboard)</option>
                        <option value="campus_hunt">Campus Hunt Engine (Clue QR Stations & Live Map)</option>
                      </select>
                    </div>

                    {form.engineType === 'campus_hunt' && (
                      <div>
                        <label className={labelClass}>Campus Hunt Event Slug</label>
                        <input
                          className={inputClass}
                          placeholder="e.g. mitwpu-hunt"
                          value={form.engineEventSlug}
                          onChange={(e) => setForm({ ...form, engineEventSlug: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {busy ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : editingId ? (
                    <CheckCircle size={15} />
                  ) : (
                    <Plus size={15} />
                  )}
                  {editingId ? 'Save Changes' : 'Create Game'}
                </button>

                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-lg border border-gray-700 hover:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors"
                >
                  Reset Form
                </button>
              </div>

              {editingId && (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-lg border border-amber-400/20">
                  <AlertCircle size={14} /> Currently modifying an existing game. Click Save Changes when done.
                </div>
              )}
            </div>
          </form>
        )}
      </div>

      {/* GAMES MANAGEMENT & LIST SECTION */}
      <div className="rounded-2xl border border-gray-800 bg-[#111213] p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy size={20} className="text-[#0ECCEE]" />
              Manage Existing Games
              <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-gray-300 font-normal">
                {filteredGames.length} of {games.length}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Edit game parameters, view registrations, toggle publication status, or remove events.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onRefresh}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 bg-[#161718] hover:bg-gray-800 text-xs text-gray-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                handleCancelEdit();
                setFormOpen(true);
                if (formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0ECCEE] text-black text-xs font-semibold hover:brightness-110 transition-all"
            >
              <Plus size={14} /> Add New Game
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, city, venue, or college..."
              className={`${inputClass} pl-9 py-2 text-xs`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              className={`${inputClass} py-2 text-xs w-full sm:w-40`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              className={`${inputClass} py-2 text-xs w-full sm:w-48`}
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
            >
              <option value="all">All Host Colleges</option>
              {colleges.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.shortName || c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Game Cards Grid */}
        {filteredGames.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-800 p-12 text-center">
            <Trophy size={32} className="mx-auto text-gray-600 mb-2" />
            <p className="text-sm font-medium text-gray-400">No games found matching filters.</p>
            <p className="text-xs text-gray-500 mt-1">Try resetting the search query or status filter.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 pt-2">
            {filteredGames.map((item) => {
              const startsText = item.startsAt
                ? new Date(item.startsAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Date TBA';

              const collegeLabel =
                item.hostCollegeId?.shortName ||
                item.hostCollegeId?.name ||
                'Independent Game';

              return (
                <article
                  key={item._id}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                    editingId === item._id
                      ? 'border-[#0ECCEE] bg-[#161a22] shadow-[0_0_20px_rgba(14,204,238,0.15)]'
                      : 'border-gray-800 bg-[#161718] hover:border-gray-700'
                  }`}
                >
                  {/* Card Cover & Header */}
                  <div>
                    {item.coverImage ? (
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/40">
                        <img
                          src={item.coverImage}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <div className="absolute top-2.5 right-2.5">
                          {getStatusBadge(item.status)}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 pb-0 flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 uppercase font-mono tracking-wider">
                          {item.gameType || 'game'}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                    )}

                    <div className="p-4 space-y-2.5">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-white text-base leading-snug line-clamp-1">
                            {item.title}
                          </h3>
                        </div>
                        {item.tagline && (
                          <p className="text-xs text-[#0ECCEE] line-clamp-1 font-medium mt-0.5">
                            {item.tagline}
                          </p>
                        )}
                        <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                          /games/{item.slug}
                        </p>
                      </div>

                      {/* Location & Time */}
                      <div className="grid gap-1 text-xs text-gray-300">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <MapPin size={13} className="text-[#0ECCEE] shrink-0" />
                          <span className="truncate">
                            {collegeLabel} · {item.venue || item.city || 'Venue TBA'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Calendar size={13} className="text-[#0ECCEE] shrink-0" />
                          <span>{startsText}</span>
                        </div>
                      </div>

                      {/* Specs Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                        <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-gray-300 flex items-center gap-1">
                          <Users size={11} className="text-gray-400" />
                          {item.teamSize} / team
                        </span>
                        <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-gray-300">
                          Slots: {item.reservedSlots || 0} / {item.capacity}
                        </span>
                        <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-emerald-400">
                          {item.feePerTeam > 0 ? `₹${item.feePerTeam}` : 'Free'}
                        </span>
                        {item.prizeAmount > 0 && (
                          <span className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-amber-300 font-medium">
                            Prize: ₹{item.prizeAmount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="p-4 pt-3 border-t border-gray-800/80 bg-black/20 space-y-2">
                    {/* Status Toggle Dropdown */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-400 font-medium">Quick Status:</span>
                      <select
                        disabled={busy}
                        value={item.status}
                        onChange={(e) => onUpdateGameStatus(item._id, e.target.value)}
                        className="rounded border border-gray-700 bg-[#191b1d] px-2 py-1 text-xs font-semibold text-white outline-none focus:border-[#0ECCEE]"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    {/* Button Row */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs font-medium text-white transition-colors"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <a
                          href={`/games/${item.slug || item._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1.5 rounded border border-gray-700 hover:bg-gray-800 text-xs text-gray-300 transition-colors"
                        >
                          <ExternalLink size={12} /> View
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to delete "${item.title}"? This cannot be undone.`
                            )
                          ) {
                            onDeleteGame(item._id);
                          }
                        }}
                        className="p-1.5 rounded hover:bg-rose-500/10 text-gray-500 hover:text-rose-400 transition-colors"
                        title="Delete game"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
