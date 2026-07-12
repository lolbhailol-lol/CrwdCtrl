import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Megaphone,
  Users,
  Loader,
  ChevronRight,
  ChevronLeft,
  History,
  Check,
  Mail,
  Smartphone,
  Inbox,
  X,
  Search,
  Bookmark,
  Copy,
  FlaskConical,
} from 'lucide-react';
import { useDialog } from '../../context/DialogContext';
import {
  fetchAudienceOptions,
  previewAudience,
  sendNotificationCampaign,
  testSendNotification,
  fetchCampaigns,
  fetchCampaign,
  fetchAudiencePresets,
  createAudiencePreset,
  deleteAudiencePreset,
  searchAdminUsers,
  fetchEventCard,
  previewCampaignEmail,
} from '../../services/api/adminNotifications.api';

const STEPS = [
  { id: 1, label: '1. Pick who', hint: 'Choose the people' },
  { id: 2, label: '2. Write message', hint: 'Title, body, channels' },
  { id: 3, label: '3. Review & send', hint: 'Confirm counts' },
];

/** Primary browse filters — one list, not separate products */
const BROWSE_CHIPS = [
  { id: 'all', label: 'Everything', hint: 'All types mixed' },
  { id: 'competition', label: 'Competitions', hint: 'Single comps + types like Fashion' },
  { id: 'fest', label: 'Fests', hint: 'Whole fest registrants' },
  { id: 'trek', label: 'Treks', hint: 'Confirmed trek bookings' },
  { id: 'run', label: 'Runs', hint: 'Run / sports regs' },
  { id: 'event_show', label: 'Shows', hint: 'Event / pageant regs' },
];

const OTHER_CHIPS = [
  { id: 'everyone', label: 'Whole platform', hint: 'All CrwdCtrl users' },
  { id: 'manual', label: 'Pick people', hint: 'Search users one by one' },
];

/** Single-event kinds that can be the “about” subject (not aggregates). */
const ABOUT_EVENT_KINDS = ['fest', 'competition', 'trek', 'run', 'event_show'];

const ABOUT_KIND_CHIPS = [
  { id: 'fest', label: 'Fest' },
  { id: 'competition', label: 'Competition' },
  { id: 'trek', label: 'Trek' },
  { id: 'run', label: 'Run' },
  { id: 'event_show', label: 'Show' },
  { id: 'none', label: 'None (plain message)' },
];

const KIND_LABEL = {
  competition_type: 'All of this type',
  competition: 'One competition',
  fest: 'Whole fest',
  trek: 'Trek',
  run: 'Run event',
  event_show: 'Show / event',
};

function statusOptionsForType(type) {
  if (type === 'trek') {
    return [
      { value: 'confirmed', label: 'Confirmed only (default)' },
      { value: 'cancelled', label: 'Cancelled only' },
    ];
  }
  if (type === 'run') {
    return [
      { value: 'all', label: 'Confirmed + pending' },
      { value: 'confirmed', label: 'Confirmed only' },
      { value: 'pending', label: 'Pending only' },
    ];
  }
  if (['fest', 'competition', 'competition_type', 'event_show'].includes(type)) {
    return [
      { value: 'all', label: 'Approved + pending' },
      { value: 'approved', label: 'Approved only' },
      { value: 'pending', label: 'Pending only' },
    ];
  }
  return [];
}

const MESSAGE_TEMPLATES = [
  {
    id: 'fashion_live',
    label: 'New fashion fest is live',
    title: 'New fashion fest is live',
    message: 'A new fashion fest just went live on CrwdCtrl. Open the app to check details and register.',
    link: '/fests',
  },
  {
    id: 'reg_reminder',
    label: 'Registration reminder',
    title: 'Registration reminder',
    message: 'Friendly reminder — registration is still open. Complete yours so you don’t miss out.',
    link: '',
  },
  {
    id: 'schedule_update',
    label: 'Schedule / venue update',
    title: 'Important schedule update',
    message: 'There has been a change to the schedule or venue. Please open the event page for the latest details before you travel.',
    link: '',
  },
  {
    id: 'general',
    label: 'General announcement',
    title: 'Update from CrwdCtrl',
    message: 'We have an update for you. Open CrwdCtrl for the full details.',
    link: '/',
  },
];

const emptyFilters = () => ({
  verifiedOnly: false,
  hasPush: false,
  role: '',
  festId: '',
  competitionType: '',
  competitionId: '',
  trekId: '',
  eventId: '',
  eventShowId: '',
  status: 'all',
});

function catalogKey(row) {
  return `${row.kind}:${row.id}`;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function deliverySummary(stats = {}) {
  const parts = [];
  if (stats.inApp) parts.push(`${stats.inApp} in-app`);
  if (stats.push) parts.push(`${stats.push} push`);
  if (stats.email) parts.push(`${stats.email} email`);
  if (stats.skippedPrefs) parts.push(`${stats.skippedPrefs} skipped prefs`);
  if (stats.failed) parts.push(`${stats.failed} failed`);
  return parts.length ? parts.join(' · ') : 'No deliveries recorded';
}

function testDeliveryToast(res) {
  const d = res.delivery || {};
  const parts = [];
  if (d.inApp) parts.push('in-app');
  if (d.push) parts.push('push');
  if (d.email) parts.push('email');
  if (res.reason === 'no_user_account') {
    return parts.length
      ? `Test: ${parts.join(' + ')} (no user account — in-app/push skipped)`
      : 'No CrwdCtrl user for admin email — enable Email to test, or create a matching account';
  }
  return parts.length ? `Test sent · ${parts.join(' + ')}` : res.message || 'Test sent';
}

function filtersFingerprint(audienceType, filters, selectedUserIds) {
  return JSON.stringify({ audienceType, filters, selectedUserIds: [...selectedUserIds].sort() });
}

function applyAudienceToState(audience) {
  const type = audience?.type || 'all_users';
  const f = audience?.filters || {};
  return {
    audienceType: type,
    filters: {
      ...emptyFilters(),
      ...f,
      status: f.status || (type === 'trek' ? 'confirmed' : 'all'),
      verifiedOnly: !!f.verifiedOnly,
      hasPush: !!f.hasPush,
    },
  };
}

export default function AdminNotificationsPage() {
  const { confirm, toast } = useDialog();
  const [view, setView] = useState('compose');
  const [step, setStep] = useState(1);

  const [options, setOptions] = useState(null);
  const [presets, setPresets] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [catalogChip, setCatalogChip] = useState('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [hideZero, setHideZero] = useState(true);
  const [sortBy, setSortBy] = useState('count'); // count | name

  const [audienceType, setAudienceType] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [excludedIds, setExcludedIds] = useState(new Set());
  const [audienceLabel, setAudienceLabel] = useState('');

  const [preview, setPreview] = useState(null);
  const [previewFingerprint, setPreviewFingerprint] = useState('');
  const [previewing, setPreviewing] = useState(false);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [channels, setChannels] = useState({ inApp: true, push: true, email: false });
  const [eventCard, setEventCard] = useState(null);
  const [aboutKindChip, setAboutKindChip] = useState('fest');
  const [aboutSearch, setAboutSearch] = useState('');
  const [loadingAboutCard, setLoadingAboutCard] = useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState('');
  const [loadingEmailPreview, setLoadingEmailPreview] = useState(false);
  /** True once admin picks or clears About — blocks auto-suggest override. */
  const aboutManualRef = useRef(false);

  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [pollingId, setPollingId] = useState(null);
  const [detailCampaign, setDetailCampaign] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const [showTestCampaigns, setShowTestCampaigns] = useState(false);

  const pollTimerRef = useRef(null);
  const pollStartedRef = useRef(0);
  const pollFailRef = useRef(0);
  const detailIdRef = useRef(null);
  const previewReqRef = useRef(0);
  const aboutReqRef = useRef(0);

  useEffect(() => {
    detailIdRef.current = detailCampaign?._id || null;
  }, [detailCampaign]);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [opts, presetRes] = await Promise.all([
        fetchAudienceOptions(),
        fetchAudiencePresets(),
      ]);
      setOptions(opts);
      setPresets(presetRes.presets || []);
    } catch (e) {
      toast(e.message || 'Failed to load notification tools');
    } finally {
      setLoadingMeta(false);
    }
  }, [toast]);

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const data = await fetchCampaigns({ page: 1, limit: 30 });
      setCampaigns(data.campaigns || []);
    } catch (e) {
      toast(e.message || 'Failed to load campaign history');
    } finally {
      setLoadingCampaigns(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (view === 'history') loadCampaigns();
  }, [view, loadCampaigns]);

  useEffect(() => () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPollingId(null);
  }, []);

  const startPollingCampaign = useCallback((campaignId) => {
    stopPolling();
    setPollingId(String(campaignId));
    pollStartedRef.current = Date.now();
    pollFailRef.current = 0;

    const tick = async () => {
      try {
        const { campaign } = await fetchCampaign(campaignId);
        pollFailRef.current = 0;
        setCampaigns((prev) => {
          const idx = prev.findIndex((c) => String(c._id) === String(campaignId));
          if (idx === -1) return [campaign, ...prev];
          const next = [...prev];
          next[idx] = campaign;
          return next;
        });
        if (detailIdRef.current && String(detailIdRef.current) === String(campaignId)) {
          setDetailCampaign(campaign);
        }
        if (campaign.status === 'completed' || campaign.status === 'failed') {
          stopPolling();
          toast(
            campaign.status === 'failed'
              ? `Campaign failed · ${campaign.errorMessage || 'see history'}`
              : `Campaign done · ${deliverySummary(campaign.stats)}`,
          );
        } else if (Date.now() - pollStartedRef.current > 180000) {
          stopPolling();
          toast('Still sending — refresh History for final stats');
        }
      } catch {
        pollFailRef.current += 1;
        if (pollFailRef.current >= 5) {
          stopPolling();
          toast('Could not refresh campaign status — use Refresh in History');
        }
      }
    };

    tick();
    pollTimerRef.current = setInterval(tick, 2000);
  }, [stopPolling, toast]);

  const currentFingerprint = useMemo(
    () => filtersFingerprint(audienceType, filters, selectedUserIds),
    [audienceType, filters, selectedUserIds],
  );
  const previewOutdated = !!preview && previewFingerprint !== currentFingerprint;

  const catalog = options?.catalog || [];

  const filteredCatalog = useMemo(() => {
    let rows = catalog;
    if (catalogChip === 'competition') {
      rows = rows.filter((r) => r.kind === 'competition' || r.kind === 'competition_type');
    } else if (catalogChip !== 'all' && catalogChip !== 'everyone' && catalogChip !== 'manual') {
      rows = rows.filter((r) => r.kind === catalogChip);
    } else if (catalogChip === 'everyone' || catalogChip === 'manual') {
      rows = [];
    }

    const q = catalogSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const hay = `${r.label || ''} ${r.meta || ''} ${r.kind || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (hideZero) {
      rows = rows.filter((r) => (r.registrantCount || 0) > 0);
    }

    rows = [...rows].sort((a, b) => {
      if (sortBy === 'name') {
        return String(a.label || '').localeCompare(String(b.label || ''));
      }
      return (b.registrantCount || 0) - (a.registrantCount || 0);
    });

    return rows;
  }, [catalog, catalogChip, catalogSearch, hideZero, sortBy]);

  const aboutCatalog = useMemo(() => {
    if (aboutKindChip === 'none') return [];
    let rows = catalog.filter((r) => ABOUT_EVENT_KINDS.includes(r.kind));
    if (ABOUT_EVENT_KINDS.includes(aboutKindChip)) {
      rows = rows.filter((r) => r.kind === aboutKindChip);
    }
    const q = aboutSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const hay = `${r.label || ''} ${r.meta || ''} ${r.kind || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return [...rows].sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));
  }, [catalog, aboutKindChip, aboutSearch]);

  const statusOptions = useMemo(() => statusOptionsForType(audienceType), [audienceType]);

  const buildAudience = useCallback(() => {
    const audience = {
      type: audienceType,
      filters: {},
      label: audienceLabel || audienceType || 'Audience',
    };

    if (audienceType === 'all_users') {
      if (filters.verifiedOnly) audience.filters.verifiedOnly = true;
      if (filters.hasPush) audience.filters.hasPush = true;
      if (filters.role) audience.filters.role = filters.role;
      audience.label = audienceLabel || (filters.verifiedOnly ? 'All verified users' : 'All users');
    } else if (audienceType === 'fest') {
      audience.filters.festId = filters.festId;
      audience.filters.status = filters.status || 'all';
    } else if (audienceType === 'competition_type') {
      audience.filters.competitionType = filters.competitionType;
      audience.filters.status = filters.status || 'all';
    } else if (audienceType === 'competition') {
      audience.filters.competitionId = filters.competitionId;
      audience.filters.status = filters.status || 'all';
    } else if (audienceType === 'trek') {
      audience.filters.trekId = filters.trekId;
      audience.filters.status = filters.status === 'all' ? 'confirmed' : filters.status;
    } else if (audienceType === 'run') {
      audience.filters.eventId = filters.eventId;
      audience.filters.status = filters.status || 'all';
    } else if (audienceType === 'event_show') {
      audience.filters.eventShowId = filters.eventShowId;
      if (filters.status && filters.status !== 'all') audience.filters.status = filters.status;
    } else if (audienceType === 'manual') {
      audience.selectedUserIds = selectedUserIds;
      audience.label = `Manual pick (${selectedUserIds.length})`;
    }

    if (excludedIds.size > 0 && preview?.userIds?.length) {
      audience.selectedUserIds = preview.userIds.filter((id) => !excludedIds.has(id));
    }

    return audience;
  }, [audienceType, filters, selectedUserIds, excludedIds, preview, audienceLabel]);

  const buildAbout = useCallback(() => {
    if (!eventCard?.kind || !eventCard?.id) return null;
    return { kind: eventCard.kind, id: String(eventCard.id) };
  }, [eventCard]);

  const runPreviewForState = useCallback(async ({
    type,
    nextFilters,
    nextSelectedIds = [],
    label = '',
    silent = false,
  }) => {
    if (!type) return;
    if (type === 'manual' && nextSelectedIds.length === 0) {
      if (!silent) toast('Select at least one user');
      return;
    }

    const reqId = ++previewReqRef.current;
    setPreviewing(true);
    setExcludedIds(new Set());
    try {
      const audience = {
        type,
        filters: {},
        label: label || type,
      };
      if (type === 'all_users') {
        if (nextFilters.verifiedOnly) audience.filters.verifiedOnly = true;
        if (nextFilters.hasPush) audience.filters.hasPush = true;
      } else if (type === 'fest') {
        audience.filters.festId = nextFilters.festId;
        audience.filters.status = nextFilters.status || 'all';
      } else if (type === 'competition_type') {
        audience.filters.competitionType = nextFilters.competitionType;
        audience.filters.status = nextFilters.status || 'all';
      } else if (type === 'competition') {
        audience.filters.competitionId = nextFilters.competitionId;
        audience.filters.status = nextFilters.status || 'all';
      } else if (type === 'trek') {
        audience.filters.trekId = nextFilters.trekId;
        audience.filters.status = nextFilters.status === 'all' ? 'confirmed' : nextFilters.status;
      } else if (type === 'run') {
        audience.filters.eventId = nextFilters.eventId;
        audience.filters.status = nextFilters.status || 'all';
      } else if (type === 'event_show') {
        audience.filters.eventShowId = nextFilters.eventShowId;
      } else if (type === 'manual') {
        audience.selectedUserIds = nextSelectedIds;
        audience.label = `Manual pick (${nextSelectedIds.length})`;
      }

      const data = await previewAudience(audience);
      if (reqId !== previewReqRef.current) return;
      setPreview(data);
      setPreviewFingerprint(filtersFingerprint(type, nextFilters, nextSelectedIds));
      if (!silent) toast(`${data.count} people match`);
    } catch (e) {
      if (reqId !== previewReqRef.current) return;
      toast(e.message || 'Preview failed');
      setPreview(null);
      setPreviewFingerprint('');
    } finally {
      if (reqId === previewReqRef.current) setPreviewing(false);
    }
  }, [toast]);

  const changeStatusFilter = (status) => {
    const nextFilters = { ...filters, status };
    setFilters(nextFilters);
    if (!audienceType || audienceType === 'manual' || audienceType === 'all_users') return;
    runPreviewForState({
      type: audienceType,
      nextFilters,
      nextSelectedIds: selectedUserIds,
      label: audienceLabel,
    });
  };

  const selectCatalogRow = (row) => {
    const a = row.audience || {};
    const { audienceType: type, filters: nextFilters } = applyAudienceToState(a);
    setSelectedKey(catalogKey(row));
    setAudienceType(type);
    setFilters(nextFilters);
    setAudienceLabel(a.label || row.label);
    setSelectedUserIds([]);
    setCatalogChip((prev) => (prev === 'everyone' || prev === 'manual' ? 'all' : prev));
    aboutManualRef.current = false;
    setEventCard(null);
    runPreviewForState({
      type,
      nextFilters,
      label: a.label || row.label,
    });
  };

  const selectEveryone = (verifiedOnly = true) => {
    const nextFilters = { ...emptyFilters(), verifiedOnly };
    setCatalogChip('everyone');
    setSelectedKey(verifiedOnly ? 'everyone:verified' : 'everyone:all');
    setAudienceType('all_users');
    setFilters(nextFilters);
    setAudienceLabel(verifiedOnly ? 'All verified users' : 'All users');
    setSelectedUserIds([]);
    aboutManualRef.current = false;
    setEventCard(null);
    runPreviewForState({
      type: 'all_users',
      nextFilters,
      label: verifiedOnly ? 'All verified users' : 'All users',
    });
  };

  const selectManualMode = () => {
    setCatalogChip('manual');
    setSelectedKey('manual');
    setAudienceType('manual');
    setFilters(emptyFilters());
    setAudienceLabel('Manual pick');
    setPreview(null);
    setPreviewFingerprint('');
    setExcludedIds(new Set());
    aboutManualRef.current = false;
    setEventCard(null);
  };

  const applyEventDraft = () => {
    if (!eventCard) return;
    setTitle(eventCard.suggestedTitle || '');
    setMessage(eventCard.suggestedMessage || '');
    if (eventCard.ctaPath) setLink(eventCard.ctaPath);
    toast('Event draft applied');
  };

  const clearAbout = () => {
    aboutManualRef.current = true;
    setEventCard(null);
    setAboutKindChip('none');
    setLink('');
    setEmailPreviewHtml('');
  };

  const loadAboutCard = useCallback(async (type, nextFilters) => {
    if (!ABOUT_EVENT_KINDS.includes(type)) {
      setEventCard(null);
      return null;
    }
    const reqId = ++aboutReqRef.current;
    setLoadingAboutCard(true);
    try {
      const data = await fetchEventCard({ type, filters: nextFilters });
      if (reqId !== aboutReqRef.current) return null;
      const card = data.eventCard || null;
      setEventCard(card);
      if (card?.ctaPath) setLink(card.ctaPath);
      if (card?.kind) setAboutKindChip(card.kind);
      return card;
    } catch (e) {
      if (reqId !== aboutReqRef.current) return null;
      setEventCard(null);
      toast(e.message || 'Failed to load event card');
      return null;
    } finally {
      if (reqId === aboutReqRef.current) setLoadingAboutCard(false);
    }
  }, [toast]);

  const selectAboutRow = (row) => {
    const a = row.audience || {};
    const type = a.type || row.kind;
    if (!ABOUT_EVENT_KINDS.includes(type)) return;
    const { filters: nextFilters } = applyAudienceToState(a);
    aboutManualRef.current = true;
    setAboutKindChip(type);
    loadAboutCard(type, nextFilters);
  };

  const selectAboutKindChip = (chipId) => {
    if (chipId === 'none') {
      clearAbout();
      return;
    }
    setAboutKindChip(chipId);
    setEventCard(null);
    setLink('');
    setEmailPreviewHtml('');
  };

  const goToMessageStep = async () => {
    setStep(2);
    if (aboutManualRef.current) return;
    if (!ABOUT_EVENT_KINDS.includes(audienceType)) return;
    await loadAboutCard(audienceType, filters);
  };

  const refreshEmailPreview = useCallback(async () => {
    if (step !== 2 && step !== 3) return;
    if (!title.trim() && !message.trim()) {
      setEmailPreviewHtml('');
      return;
    }
    setLoadingEmailPreview(true);
    try {
      const audience = audienceType ? buildAudience() : null;
      const data = await previewCampaignEmail({
        title: title.trim() || 'Update from CrwdCtrl',
        message: message.trim() || 'Your message will appear here.',
        link: link.trim(),
        audience: audience?.type ? { type: audience.type, filters: audience.filters } : null,
        about: buildAbout(),
        name: 'Alex',
      });
      setEmailPreviewHtml(data.html || '');
    } catch {
      setEmailPreviewHtml('');
    } finally {
      setLoadingEmailPreview(false);
    }
  }, [step, title, message, link, audienceType, buildAudience, buildAbout]);

  useEffect(() => {
    if (step !== 2 && step !== 3) return undefined;
    const t = setTimeout(() => {
      refreshEmailPreview();
    }, 400);
    return () => clearTimeout(t);
  }, [step, title, message, link, audienceType, eventCard?.id, refreshEmailPreview]);

  const applyPreset = (preset) => {
    const a = preset.audience || {};
    const { audienceType: type, filters: nextFilters } = applyAudienceToState(a);
    setAudienceType(type);
    setFilters(nextFilters);
    setAudienceLabel(a.label || preset.name);
    setSelectedUserIds([]);
    setExcludedIds(new Set());
    setStep(1);
    aboutManualRef.current = false;
    setEventCard(null);

    if (type === 'manual') {
      setCatalogChip('manual');
      setSelectedKey('manual');
      toast(`Loaded preset: ${preset.name}`);
      return;
    }
    if (type === 'all_users') {
      setCatalogChip('everyone');
      setSelectedKey(nextFilters.verifiedOnly ? 'everyone:verified' : 'everyone:all');
    } else {
      const match = (options?.catalog || []).find((row) => {
        if (row.audience?.type !== type) return false;
        const rf = row.audience.filters || {};
        if (type === 'competition_type') return rf.competitionType === nextFilters.competitionType;
        if (type === 'competition') return rf.competitionId === nextFilters.competitionId;
        if (type === 'fest') return rf.festId === nextFilters.festId;
        if (type === 'trek') return rf.trekId === nextFilters.trekId;
        if (type === 'run') return rf.eventId === nextFilters.eventId;
        if (type === 'event_show') return rf.eventShowId === nextFilters.eventShowId;
        return false;
      });
      setSelectedKey(match ? catalogKey(match) : '');
      if (type === 'competition' || type === 'competition_type') setCatalogChip('competition');
      else if (['fest', 'trek', 'run', 'event_show'].includes(type)) setCatalogChip(type);
      else setCatalogChip('all');
    }

    runPreviewForState({
      type,
      nextFilters,
      label: a.label || preset.name,
    });
    toast(`Loaded preset: ${preset.name}`);
  };

  const saveCurrentAsPreset = async () => {
    const name = presetName.trim();
    if (!name) {
      toast('Enter a preset name');
      return;
    }
    if (!audienceType) {
      toast('Pick an audience first');
      return;
    }
    setSavingPreset(true);
    try {
      const audience = buildAudience();
      delete audience.selectedUserIds;
      await createAudiencePreset({ name, description: '', audience });
      setPresetName('');
      const data = await fetchAudiencePresets();
      setPresets(data.presets || []);
      toast('Preset saved');
    } catch (e) {
      toast(e.message || 'Failed to save preset');
    } finally {
      setSavingPreset(false);
    }
  };

  const removePreset = async (preset) => {
    if (preset.isSystem) {
      toast('System presets cannot be deleted');
      return;
    }
    const ok = await confirm({
      title: 'Delete preset?',
      message: `Remove “${preset.name}”?`,
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await deleteAudiencePreset(preset._id);
      setPresets((prev) => prev.filter((p) => p._id !== preset._id));
      toast('Preset deleted');
    } catch (e) {
      toast(e.message || 'Failed to delete');
    }
  };

  const searchUsers = async () => {
    setSearchingUsers(true);
    try {
      const data = await searchAdminUsers({ search: userSearch.trim(), limit: 30 });
      setUserResults(data.users || []);
    } catch (e) {
      toast(e.message || 'User search failed');
    } finally {
      setSearchingUsers(false);
    }
  };

  const toggleManualUser = (id) => {
    setSelectedUserIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setPreview(null);
      setPreviewFingerprint('');
      return next;
    });
  };

  const toggleExclude = (id) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearExclusions = () => setExcludedIds(new Set());
  const excludeAllSample = () => {
    if (!preview?.sample?.length) return;
    setExcludedIds(new Set(preview.sample.map((u) => u.id)));
  };

  const effectiveCount = useMemo(() => {
    if (!preview || previewOutdated) return 0;
    if (excludedIds.size === 0) return preview.count;
    return Math.max(0, preview.count - excludedIds.size);
  }, [preview, excludedIds, previewOutdated]);

  const channelList = useMemo(
    () => Object.entries(channels).filter(([, on]) => on).map(([k]) => k),
    [channels],
  );

  const reachEstimates = useMemo(() => {
    if (!preview || previewOutdated) return null;
    const count = effectiveCount;
    return {
      inApp: channels.inApp ? count : 0,
      push: channels.push ? Math.min(count, preview.reach?.push ?? 0) : 0,
      email: channels.email ? Math.min(count, preview.reach?.email ?? 0) : 0,
    };
  }, [preview, previewOutdated, effectiveCount, channels]);

  const canGoMessage = !!audienceType && preview && !previewOutdated && effectiveCount > 0;
  const canGoSend = title.trim() && message.trim() && channelList.length > 0 && !loadingAboutCard;
  const canConfirmSend = canGoSend && !!preview && !previewOutdated && !loadingAboutCard;

  const resetCompose = useCallback(() => {
    setStep(1);
    setPreview(null);
    setPreviewFingerprint('');
    setExcludedIds(new Set());
    setTitle('');
    setMessage('');
    setLink('');
    setEventCard(null);
    aboutManualRef.current = false;
    setAboutKindChip('fest');
    setAboutSearch('');
    setEmailPreviewHtml('');
    setAudienceType('');
    setFilters(emptyFilters());
    setSelectedKey('');
    setCatalogChip('all');
    setAudienceLabel('');
    setSelectedUserIds([]);
    setChannels({ inApp: true, push: true, email: false });
    setUserSearch('');
    setUserResults([]);
  }, []);

  const applyTemplate = (tpl) => {
    setTitle(tpl.title);
    setMessage(tpl.message);
    if (tpl.link) setLink(tpl.link);
  };

  const handleTestSend = async () => {
    if (!canGoSend) {
      toast(loadingAboutCard ? 'Wait for event card to finish loading' : 'Add title, message, and at least one channel first');
      return;
    }
    setTesting(true);
    try {
      const audience = audienceType ? buildAudience() : null;
      const res = await testSendNotification({
        title: title.trim(),
        message: message.trim(),
        link: link.trim(),
        channels: channelList,
        audience: audience || undefined,
        about: buildAbout(),
      });
      toast(testDeliveryToast(res));
    } catch (e) {
      toast(e.message || 'Test send failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSend = async () => {
    if (!canConfirmSend) {
      toast(
        previewOutdated
          ? 'Audience changed — go back and refresh the preview'
          : loadingAboutCard
            ? 'Wait for event card to finish loading'
            : 'Add title, message, and at least one channel first',
      );
      return;
    }
    const audience = buildAudience();
    const about = buildAbout();
    const aboutLabel = eventCard?.name ? ` About: ${eventCard.name}.` : ' Plain announcement (no event card).';
    const ok = await confirm({
      title: 'Send notification?',
      message: `Send to ${effectiveCount} users via ${channelList.join(' + ')}.${aboutLabel}${
        effectiveCount > 50 ? ' This is a large audience.' : ''
      }`,
      confirmText: 'Send now',
    });
    if (!ok) return;

    setSending(true);
    try {
      const res = await sendNotificationCampaign({
        audience,
        about,
        title: title.trim(),
        message: message.trim(),
        link: link.trim(),
        channels: channelList,
        confirmLarge: effectiveCount > 50,
      });
      toast(`Queued · ${res.count} users — tracking in History`);
      resetCompose();
      setView('history');
      await loadCampaigns();
      if (res.campaignId) startPollingCampaign(res.campaignId);
    } catch (e) {
      toast(e.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const openDetail = async (campaign) => {
    setDetailCampaign(campaign);
    setLoadingDetail(true);
    try {
      const data = await fetchCampaign(campaign._id);
      setDetailCampaign(data.campaign);
    } catch (e) {
      toast(e.message || 'Failed to load campaign');
    } finally {
      setLoadingDetail(false);
    }
  };

  const duplicateCampaign = (campaign) => {
    const a = campaign.audience || {};
    if (a.type && a.type !== 'test') {
      applyPreset({ name: a.label || 'Duplicated', audience: a });
    }
    setTitle(campaign.title || '');
    setMessage(campaign.message || '');
    setLink(campaign.link || '');
    const ch = { inApp: false, push: false, email: false };
    (campaign.channels || ['inApp']).forEach((c) => {
      if (c in ch) ch[c] = true;
    });
    setChannels(ch);

    const about = campaign.about?.kind && campaign.about?.id
      ? campaign.about
      : campaign.eventContext?.kind && campaign.eventContext?.id
        ? { kind: campaign.eventContext.kind, id: campaign.eventContext.id }
        : null;
    if (about) {
      aboutManualRef.current = true;
      const filtersForAbout = emptyFilters();
      if (about.kind === 'fest') filtersForAbout.festId = about.id;
      else if (about.kind === 'competition') filtersForAbout.competitionId = about.id;
      else if (about.kind === 'trek') filtersForAbout.trekId = about.id;
      else if (about.kind === 'run') filtersForAbout.eventId = about.id;
      else if (about.kind === 'event_show') filtersForAbout.eventShowId = about.id;
      loadAboutCard(about.kind, filtersForAbout);
    } else {
      aboutManualRef.current = true;
      setEventCard(null);
      setAboutKindChip('none');
    }

    setDetailCampaign(null);
    setView('compose');
    setStep(a.type && a.type !== 'test' ? 1 : 2);
    toast('Loaded into compose — confirm audience before sending');
  };

  const inputClass =
    'w-full bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#0ECCEE]';
  const labelClass = 'block text-xs text-gray-400 mb-1';

  const statusBadge = (status) => {
    const map = {
      completed: 'bg-emerald-900/40 text-emerald-300',
      failed: 'bg-red-900/40 text-red-300',
      sending: 'bg-amber-900/40 text-amber-200',
      draft: 'bg-gray-800 text-gray-400',
    };
    return map[status] || map.draft;
  };

  const chipClass = (active) =>
    `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
      active
        ? 'bg-[#0ECCEE] text-black'
        : 'bg-[#1D1E20] text-gray-300 border border-gray-700 hover:border-gray-500'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Megaphone className="text-[#0ECCEE]" size={28} />
            Notification Center
          </h1>
          <p className="text-gray-400">
            Send in-app, push, or email in three steps: pick who → write message → review &amp; send.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView('compose')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'compose' ? 'bg-[#0ECCEE] text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Compose
          </button>
          <button
            type="button"
            onClick={() => setView('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              view === 'history' ? 'bg-[#0ECCEE] text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <History size={16} />
            History
          </button>
        </div>
      </div>

      {view === 'history' ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-[#111213] rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 font-semibold flex flex-wrap items-center justify-between gap-2">
              <span>Campaign history</span>
              <div className="flex items-center gap-3">
                {pollingId && (
                  <span className="text-xs text-amber-300 flex items-center gap-1">
                    <Loader className="animate-spin" size={12} />
                    Sending…
                  </span>
                )}
                <label className="text-xs text-gray-400 font-normal flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTestCampaigns}
                    onChange={(e) => setShowTestCampaigns(e.target.checked)}
                  />
                  Show tests
                </label>
                <button
                  type="button"
                  onClick={() => loadCampaigns()}
                  disabled={loadingCampaigns}
                  className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 font-normal disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
            </div>
            {loadingCampaigns ? (
              <div className="p-8 flex justify-center text-gray-400">
                <Loader className="animate-spin" size={22} />
              </div>
            ) : campaigns.filter((c) => showTestCampaigns || !c.isTest).length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {campaigns.length > 0 && !showTestCampaigns
                  ? 'No live campaigns yet. Enable “Show tests” to see test sends.'
                  : 'No campaigns yet.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {campaigns.filter((c) => showTestCampaigns || !c.isTest).map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => openDetail(c)}
                    className={`w-full text-left px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3 hover:bg-gray-900/50 transition-colors ${
                      detailCampaign && String(detailCampaign._id) === String(c._id)
                        ? 'bg-gray-900/80'
                        : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate flex items-center gap-2">
                        {c.title}
                        {c.isTest && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                            test
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 mt-0.5 line-clamp-2">{c.message}</div>
                      <div className="text-xs text-gray-500 mt-2">
                        {c.audience?.label || c.audience?.type} · {formatDate(c.createdAt)}
                        {c.createdBy ? ` · ${c.createdBy}` : ''}
                      </div>
                    </div>
                    <div className="text-sm text-right shrink-0 space-y-1">
                      <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge(c.status)}`}>
                        {c.status === 'sending' && String(pollingId) === String(c._id) ? (
                          <span className="inline-flex items-center gap-1">
                            <Loader className="animate-spin" size={10} />
                            sending
                          </span>
                        ) : (
                          c.status
                        )}
                      </div>
                      <div className="text-xs text-gray-400">{deliverySummary(c.stats)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-[#111213] rounded-xl border border-gray-800 p-5 min-h-[240px]">
            {!detailCampaign ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                Select a campaign for details
              </div>
            ) : loadingDetail ? (
              <div className="flex justify-center py-12 text-gray-400">
                <Loader className="animate-spin" size={22} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">{detailCampaign.title}</div>
                    <div className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${statusBadge(detailCampaign.status)}`}>
                      {detailCampaign.status}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailCampaign(null)}
                    className="text-gray-500 hover:text-white p-1"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{detailCampaign.message}</p>
                {detailCampaign.link && (
                  <div className="text-xs font-mono text-[#0ECCEE]">{detailCampaign.link}</div>
                )}
                <div className="text-xs text-gray-500 space-y-1 border-t border-gray-800 pt-3">
                  <div>Audience: {detailCampaign.audience?.label || detailCampaign.audience?.type}</div>
                  <div>
                    About:{' '}
                    {detailCampaign.eventContext?.name
                      || (detailCampaign.about?.kind
                        ? `${detailCampaign.about.kind} ${detailCampaign.about.id}`
                        : 'Plain message')}
                  </div>
                  <div>Channels: {(detailCampaign.channels || []).join(', ')}</div>
                  <div>By: {detailCampaign.createdBy || '—'} · {formatDate(detailCampaign.createdAt)}</div>
                  <div>Stats: {deliverySummary(detailCampaign.stats)}</div>
                </div>
                {detailCampaign.status === 'failed' && detailCampaign.errorMessage && (
                  <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                    {detailCampaign.errorMessage}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => duplicateCampaign(detailCampaign)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium"
                >
                  <Copy size={14} />
                  Duplicate into compose
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight size={14} className="text-gray-600" />}
                  <button
                    type="button"
                    onClick={() => {
                      if (s.id === 1) setStep(1);
                      else if (s.id === 2 && canGoMessage) goToMessageStep();
                      else if (s.id === 3 && canGoMessage && canGoSend) setStep(3);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                      step === s.id
                        ? 'bg-[#0ECCEE]/20 text-[#0ECCEE] border border-[#0ECCEE]/40'
                        : step > s.id
                          ? 'bg-gray-800 text-gray-300'
                          : 'bg-gray-900 text-gray-500'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-black/30 flex items-center justify-center text-xs">
                      {step > s.id ? <Check size={12} /> : s.id}
                    </span>
                    {s.label}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {STEPS.find((s) => s.id === step)?.hint}
            </p>
          </div>

          {loadingMeta ? (
            <div className="p-12 flex justify-center text-gray-400">
              <Loader className="animate-spin" size={24} />
            </div>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-5">
                  <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
                    <div className="flex items-center gap-2 mb-3 font-semibold">
                      <Bookmark size={16} className="text-[#0ECCEE]" />
                      Presets
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {presets.map((p) => (
                        <div
                          key={p._id}
                          className="flex items-center gap-1 bg-[#1D1E20] border border-gray-700 rounded-lg overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => applyPreset(p)}
                            className="px-3 py-1.5 text-sm hover:bg-gray-800"
                            title={p.description || p.name}
                          >
                            {p.name}
                          </button>
                          {!p.isSystem && (
                            <button
                              type="button"
                              onClick={() => removePreset(p)}
                              className="px-2 py-1.5 text-gray-500 hover:text-red-400"
                              aria-label="Delete preset"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        className={inputClass}
                        placeholder="Save current audience as preset…"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={saveCurrentAsPreset}
                        disabled={savingPreset}
                        className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium disabled:opacity-50"
                      >
                        {savingPreset ? 'Saving…' : 'Save preset'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#111213] rounded-xl border border-gray-800 p-5 space-y-4">
                    <div>
                      <div className="font-semibold mb-1">Step 1 — Pick who gets the message</div>
                      <p className="text-sm text-gray-400">
                        Filter the list, click one row, then continue. Numbers = CrwdCtrl users who can get in-app / push / email.
                      </p>
                    </div>

                    {(audienceType || preview) && (
                      <div className="rounded-lg border border-[#0ECCEE]/40 bg-[#0ECCEE]/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs uppercase tracking-wide text-[#0ECCEE]/80 mb-0.5">Selected audience</div>
                          <div className="font-medium text-white truncate">
                            {audienceLabel || '—'}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {previewing
                              ? 'Loading count…'
                              : preview && !previewOutdated
                                ? `${effectiveCount} people · ${preview.reach?.push ?? 0} can get push · ${preview.reach?.email ?? 0} have email`
                                : 'Waiting for preview'}
                          </div>
                        </div>
                        {statusOptions.length > 0 && (
                          <div className="sm:w-48">
                            <label className={labelClass}>Who to include</label>
                            <select
                              className={inputClass}
                              value={filters.status || 'all'}
                              onChange={(e) => changeStatusFilter(e.target.value)}
                            >
                              {statusOptions.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <div className={labelClass}>Browse by category</div>
                      <div className="flex flex-wrap gap-2">
                        {BROWSE_CHIPS.map((chip) => (
                          <button
                            key={chip.id}
                            type="button"
                            title={chip.hint}
                            className={chipClass(catalogChip === chip.id)}
                            onClick={() => setCatalogChip(chip.id)}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className={labelClass}>Or send another way</div>
                      <div className="flex flex-wrap gap-2">
                        {OTHER_CHIPS.map((chip) => (
                          <button
                            key={chip.id}
                            type="button"
                            title={chip.hint}
                            className={chipClass(catalogChip === chip.id)}
                            onClick={() => {
                              if (chip.id === 'everyone') selectEveryone(true);
                              else selectManualMode();
                            }}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        className={`${inputClass} pl-9`}
                        placeholder="Search by name — e.g. fashion, ALACRITY, trek name…"
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                      />
                    </div>

                    {catalogChip !== 'everyone' && catalogChip !== 'manual' && (
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hideZero}
                            onChange={(e) => setHideZero(e.target.checked)}
                          />
                          Hide empty (0 people)
                        </label>
                        <div className="flex items-center gap-2">
                          <span>Sort</span>
                          <select
                            className="bg-[#1D1E20] border border-gray-700 rounded px-2 py-1 text-xs text-white"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                          >
                            <option value="count">Most people first</option>
                            <option value="name">A → Z</option>
                          </select>
                        </div>
                        <span className="text-gray-600">{filteredCatalog.length} shown</span>
                      </div>
                    )}

                    {catalogChip === 'everyone' && (
                      <div className="rounded-lg border border-gray-800 divide-y divide-gray-800">
                        <p className="px-4 py-2 text-xs text-gray-500">
                          Sends to accounts on the whole platform (not one fest/trek).
                        </p>
                        {[
                          { key: 'everyone:verified', label: 'Verified users only', verifiedOnly: true, hint: 'Safer default' },
                          { key: 'everyone:all', label: 'Every account', verifiedOnly: false, hint: 'Includes unverified' },
                        ].map((row) => (
                          <button
                            key={row.key}
                            type="button"
                            onClick={() => selectEveryone(row.verifiedOnly)}
                            className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-900/60 ${
                              selectedKey === row.key ? 'bg-[#0ECCEE]/10' : ''
                            }`}
                          >
                            <span>
                              <span className="text-sm font-medium block">{row.label}</span>
                              <span className="text-xs text-gray-500">{row.hint}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {catalogChip === 'manual' && (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-500">
                          Search and tick people, then press Preview selected.
                        </p>
                        <div className="flex gap-2">
                          <input
                            className={inputClass}
                            placeholder="Search users by name or email…"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                          />
                          <button
                            type="button"
                            onClick={searchUsers}
                            disabled={searchingUsers}
                            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center gap-2"
                          >
                            {searchingUsers ? <Loader className="animate-spin" size={16} /> : <Search size={16} />}
                            Search
                          </button>
                        </div>
                        <div className="text-xs text-gray-500">Selected: {selectedUserIds.length}</div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-gray-800 border border-gray-800 rounded-lg">
                          {userResults.map((u) => {
                            const id = String(u._id);
                            const on = selectedUserIds.includes(id);
                            return (
                              <label
                                key={id}
                                className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-900 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => toggleManualUser(id)}
                                />
                                <span className="flex-1 truncate">
                                  {u.name || '—'}{' '}
                                  <span className="text-gray-500">{u.email}</span>
                                </span>
                              </label>
                            );
                          })}
                          {userResults.length === 0 && (
                            <div className="p-4 text-sm text-gray-500 text-center">Search to find users</div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={selectedUserIds.length === 0 || previewing}
                          onClick={() =>
                            runPreviewForState({
                              type: 'manual',
                              nextFilters: emptyFilters(),
                              nextSelectedIds: selectedUserIds,
                              label: `Manual pick (${selectedUserIds.length})`,
                            })
                          }
                          className="px-4 py-2 rounded-lg bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-40"
                        >
                          Preview selected
                        </button>
                      </div>
                    )}

                    {catalogChip !== 'everyone' && catalogChip !== 'manual' && (
                      <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-800 divide-y divide-gray-800">
                        {filteredCatalog.length === 0 ? (
                          <div className="p-6 text-center text-sm text-gray-500 space-y-2">
                            <p>No audiences match these filters.</p>
                            <p className="text-xs text-gray-600">
                              Try turning off “Hide empty”, clearing search, or switching category.
                            </p>
                          </div>
                        ) : (
                          filteredCatalog.map((row) => {
                            const key = catalogKey(row);
                            const active = selectedKey === key;
                            const count = row.registrantCount || 0;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => selectCatalogRow(row)}
                                className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-900/60 transition-colors ${
                                  active ? 'bg-[#0ECCEE]/10 border-l-2 border-l-[#0ECCEE]' : ''
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-white truncate">{row.label}</div>
                                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                                    {KIND_LABEL[row.kind] || row.kind}
                                    {row.meta ? ` · ${row.meta}` : ''}
                                  </div>
                                </div>
                                <div
                                  className={`text-sm font-semibold tabular-nums shrink-0 ${
                                    count === 0 ? 'text-gray-600' : 'text-white'
                                  }`}
                                >
                                  {count}
                                  <span className="text-xs font-normal text-gray-500 ml-1">
                                    {count === 1 ? 'person' : 'people'}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {previewing && (
                        <span className="text-sm text-gray-400 flex items-center gap-2">
                          <Loader className="animate-spin" size={14} />
                          Loading audience…
                        </span>
                      )}
                      {previewOutdated && (
                        <p className="text-sm text-amber-400">Filters changed — pick the row again or refresh</p>
                      )}
                      {preview && !previewOutdated && audienceType && audienceType !== 'manual' && (
                        <button
                          type="button"
                          onClick={() =>
                            runPreviewForState({
                              type: audienceType,
                              nextFilters: filters,
                              nextSelectedIds: selectedUserIds,
                              label: audienceLabel,
                            })
                          }
                          className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 flex items-center gap-1"
                        >
                          <Users size={12} />
                          Refresh count
                        </button>
                      )}
                    </div>

                    {preview && !previewOutdated && preview.count === 0 && (
                      <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200/90 space-y-1">
                        <p className="font-medium">0 people can be notified.</p>
                        <p className="text-amber-200/70 text-xs leading-relaxed">
                          Only logged-in CrwdCtrl users count. Guest / email-only registrations are skipped. Try another row or turn off “Hide empty” to inspect empty audiences.
                        </p>
                      </div>
                    )}

                    {preview?.sample?.length > 0 && !previewOutdated && (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="text-sm font-medium">
                            Sample recipients — uncheck to exclude from send
                          </div>
                          <div className="flex gap-2 text-xs">
                            <button
                              type="button"
                              onClick={clearExclusions}
                              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
                            >
                              Select all shown
                            </button>
                            <button
                              type="button"
                              onClick={excludeAllSample}
                              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
                            >
                              Clear sample
                            </button>
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto border border-gray-800 rounded-lg divide-y divide-gray-800">
                          {preview.sample.map((u) => {
                            const excluded = excludedIds.has(u.id);
                            return (
                              <label
                                key={u.id}
                                className={`flex items-center gap-3 px-3 py-2 text-sm ${
                                  excluded ? 'opacity-40' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={!excluded}
                                  onChange={() => toggleExclude(u.id)}
                                />
                                <span className="flex-1 min-w-0 truncate">
                                  {u.name}{' '}
                                  <span className="text-gray-500">{u.email || 'no email'}</span>
                                </span>
                                <span className="text-xs text-gray-500 shrink-0">
                                  {u.hasPush ? 'push' : 'no push'}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Exclusions apply to the full audience, not only this sample.
                          {preview.count > preview.sample.length
                            ? ` Showing ${preview.sample.length} of ${preview.count}.`
                            : ''}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={!canGoMessage}
                        onClick={goToMessageStep}
                        className="px-5 py-2.5 rounded-lg bg-[#0ECCEE] text-black font-semibold text-sm flex items-center gap-2 disabled:opacity-40"
                      >
                        Continue to message
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="bg-[#111213] rounded-xl border border-gray-800 p-5 space-y-4 max-w-2xl">
                  <div>
                    <div className="font-semibold mb-1">Step 2 — Write what they see</div>
                    <p className="text-sm text-gray-400">
                      Who: {audienceLabel || '—'} · {effectiveCount} people. About is separate — pick the event for the email card &amp; link.
                    </p>
                  </div>

                  <div className="space-y-3 rounded-lg border border-gray-800 bg-[#0b0c0d] p-4">
                    <div>
                      <div className="font-medium text-sm text-white mb-0.5">What are you sending about?</div>
                      <p className="text-xs text-gray-500">
                        Optional. Leave as None for a plain announcement. Who receives is still the audience above.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ABOUT_KIND_CHIPS.map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          className={chipClass(
                            chip.id === 'none'
                              ? !eventCard && aboutKindChip === 'none'
                              : aboutKindChip === chip.id,
                          )}
                          onClick={() => selectAboutKindChip(chip.id)}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>

                    {aboutKindChip !== 'none' && (
                      <>
                        <div className="relative">
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <input
                            className={`${inputClass} pl-9`}
                            placeholder={`Search ${ABOUT_KIND_CHIPS.find((c) => c.id === aboutKindChip)?.label || 'events'}…`}
                            value={aboutSearch}
                            onChange={(e) => setAboutSearch(e.target.value)}
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-800 divide-y divide-gray-800">
                          {loadingAboutCard && (
                            <div className="p-3 text-xs text-gray-500 flex items-center gap-2">
                              <Loader className="animate-spin" size={12} />
                              Loading event…
                            </div>
                          )}
                          {aboutCatalog.length === 0 ? (
                            <div className="p-4 text-sm text-gray-500 text-center">No events in this category</div>
                          ) : (
                            aboutCatalog.map((row) => {
                              const key = catalogKey(row);
                              const active = eventCard
                                && eventCard.kind === row.kind
                                && String(eventCard.id) === String(row.id);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => selectAboutRow(row)}
                                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-900/60 ${
                                    active ? 'bg-[#0ECCEE]/10' : ''
                                  }`}
                                >
                                  <span className="font-medium text-white block truncate">{row.label}</span>
                                  <span className="text-xs text-gray-500">
                                    {KIND_LABEL[row.kind] || row.kind}
                                    {row.meta ? ` · ${row.meta}` : ''}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}

                    {eventCard && (
                      <div className="rounded-lg border border-[#0ECCEE]/30 bg-[#0ECCEE]/5 p-4 flex flex-col sm:flex-row gap-3">
                        {eventCard.imageUrl ? (
                          <img
                            src={eventCard.imageUrl}
                            alt=""
                            className="w-full sm:w-28 h-20 object-cover rounded-lg shrink-0"
                          />
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[#0ECCEE] uppercase tracking-wide mb-0.5">About this event</div>
                          <div className="font-medium text-white truncate">{eventCard.name}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {[eventCard.dateLabel, eventCard.placeLabel].filter(Boolean).join(' · ') || eventCard.subtitle}
                          </div>
                          <div className="text-xs font-mono text-gray-500 mt-1 truncate">{eventCard.ctaPath}</div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={applyEventDraft}
                            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium"
                          >
                            Use event draft
                          </button>
                          <button
                            type="button"
                            onClick={clearAbout}
                            className="px-3 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 text-xs text-gray-400"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className={labelClass}>Templates</div>
                    <div className="flex flex-wrap gap-2">
                      {MESSAGE_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyTemplate(tpl)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-[#1D1E20] border border-gray-700 hover:border-[#0ECCEE]/50"
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Title</label>
                    <input
                      className={inputClass}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="New fashion fest is live"
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Message</label>
                    <textarea
                      className={`${inputClass} min-h-[120px] resize-y`}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Write the notification body…"
                      maxLength={4000}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Deep link (auto-filled from About when available)</label>
                    <input
                      className={inputClass}
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="/view-details/… or /trek/…"
                    />
                  </div>

                  <div>
                    <div className={labelClass}>Delivery channels (pick any mix)</div>
                    <div className="flex flex-col gap-2">
                      {[
                        { key: 'inApp', label: 'In-app inbox', desc: 'Appears in the app notification list', icon: Inbox },
                        { key: 'push', label: 'Push notification', desc: 'Phone/browser alert if they allowed push', icon: Smartphone },
                        {
                          key: 'email',
                          label: 'Email',
                          desc: eventCard
                            ? 'Branded event card email (cover, date, place, CTA)'
                            : 'Plain announcement email (no event card)',
                          icon: Mail,
                        },
                      ].map(({ key, label, desc, icon: Icon }) => (
                        <label
                          key={key}
                          className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer text-sm ${
                            channels[key]
                              ? 'border-[#0ECCEE] bg-[#0ECCEE]/10'
                              : 'border-gray-700 bg-[#1D1E20]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={channels[key]}
                            onChange={(e) =>
                              setChannels((c) => ({ ...c, [key]: e.target.checked }))
                            }
                          />
                          <Icon size={16} className="mt-0.5 shrink-0" />
                          <span>
                            <span className="font-medium block">{label}</span>
                            <span className="text-xs text-gray-500">{desc}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    {channels.email && preview?.reach?.email > 100 && (
                      <p className="text-xs text-amber-400 mt-2">
                        Large email send ({preview.reach.email} reachable) — rate-limited via queue.
                      </p>
                    )}
                  </div>

                  {(channels.email || emailPreviewHtml) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={labelClass + ' mb-0'}>Email preview</div>
                        <button
                          type="button"
                          onClick={refreshEmailPreview}
                          className="text-xs text-gray-400 hover:text-white"
                        >
                          {loadingEmailPreview ? 'Refreshing…' : 'Refresh'}
                        </button>
                      </div>
                      <div className="rounded-lg border border-gray-800 bg-[#0b0c0d] overflow-hidden max-h-[420px] overflow-y-auto">
                        {loadingEmailPreview && !emailPreviewHtml ? (
                          <div className="p-8 flex justify-center text-gray-500">
                            <Loader className="animate-spin" size={20} />
                          </div>
                        ) : emailPreviewHtml ? (
                          <iframe
                            title="Email preview"
                            srcDoc={emailPreviewHtml}
                            className="w-full min-h-[360px] bg-white border-0"
                            sandbox=""
                          />
                        ) : (
                          <p className="p-4 text-xs text-gray-500">
                            Add a title and message to preview the email.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 rounded-lg bg-gray-800 text-sm flex items-center gap-2"
                    >
                      <ChevronLeft size={16} />
                      Audience
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleTestSend}
                        disabled={testing || !canGoSend}
                        className="px-4 py-2.5 rounded-lg border border-gray-600 text-sm flex items-center gap-2 disabled:opacity-40"
                      >
                        {testing ? <Loader className="animate-spin" size={16} /> : <FlaskConical size={16} />}
                        Send test to me
                      </button>
                      <button
                        type="button"
                        disabled={!canGoSend}
                        onClick={() => {
                          if (!canGoSend) {
                            toast(loadingAboutCard ? 'Wait for event card to finish loading' : 'Add title, message, and at least one channel first');
                            return;
                          }
                          setStep(3);
                        }}
                        className="px-5 py-2.5 rounded-lg bg-[#0ECCEE] text-black font-semibold text-sm flex items-center gap-2 disabled:opacity-40"
                      >
                        Next: Confirm
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="bg-[#111213] rounded-xl border border-gray-800 p-5 space-y-5 max-w-2xl">
                  <div>
                    <div className="font-semibold mb-1">Step 3 — Review & send</div>
                    <p className="text-sm text-gray-400">
                      Double-check who and how, then send. Tip: use “Send test to me” first.
                    </p>
                  </div>

                  {reachEstimates && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-[#1D1E20] border border-gray-800 px-2 py-3">
                        <div className="text-lg font-semibold text-white">~{reachEstimates.inApp}</div>
                        <div className="text-xs text-gray-500">in-app</div>
                      </div>
                      <div className="rounded-lg bg-[#1D1E20] border border-gray-800 px-2 py-3">
                        <div className="text-lg font-semibold text-white">~{reachEstimates.push}</div>
                        <div className="text-xs text-gray-500">push</div>
                      </div>
                      <div className="rounded-lg bg-[#1D1E20] border border-gray-800 px-2 py-3">
                        <div className="text-lg font-semibold text-white">~{reachEstimates.email}</div>
                        <div className="text-xs text-gray-500">email</div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg bg-[#1D1E20] border border-gray-700 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Bell className="text-[#0ECCEE] mt-0.5 shrink-0" size={18} />
                      <div>
                        <div className="font-medium">{title}</div>
                        <div className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{message}</div>
                        {link && (
                          <div className="text-xs text-[#0ECCEE] mt-2 font-mono">{link}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 border-t border-gray-700 pt-3 space-y-1">
                      <div>Audience: {audienceLabel || buildAudience().label}</div>
                      <div>
                        About:{' '}
                        {eventCard
                          ? `${eventCard.name} (${KIND_LABEL[eventCard.kind] || eventCard.kind})`
                          : 'Plain message (no event card)'}
                      </div>
                    </div>
                  </div>

                  {effectiveCount > 50 && (
                    <p className="text-sm text-amber-400">
                      You are about to notify more than 50 people. Double-check before sending.
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-2 rounded-lg bg-gray-800 text-sm flex items-center gap-2"
                    >
                      <ChevronLeft size={16} />
                      Message
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleTestSend}
                        disabled={testing || !canGoSend}
                        className="px-4 py-2.5 rounded-lg border border-gray-600 text-sm flex items-center gap-2 disabled:opacity-40"
                      >
                        {testing ? <Loader className="animate-spin" size={16} /> : <FlaskConical size={16} />}
                        Send test to me
                      </button>
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={sending || !canConfirmSend}
                        className="px-6 py-2.5 rounded-lg bg-[#0ECCEE] text-black font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
                      >
                        {sending ? <Loader className="animate-spin" size={16} /> : <Megaphone size={16} />}
                        {sending ? 'Queuing…' : 'Send now'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
