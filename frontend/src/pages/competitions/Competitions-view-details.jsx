import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Phone, Instagram, Check, Moon, Sun, Mail, ArrowLeft, Ticket, Zap, Share2, Users } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import Navbar from '../../components/layout/Navbar';
import ProfileSidebar from '../../components/layout/ProfileSidebar';
import { useDarkMode } from '../../context/DarkModeContext';
import { useDialog } from '../../context/DialogContext';
import { useAuth } from '../../context/AuthContext';
import CalendarIcon from '../../assets/calendar.svg';
import LocationIcon from '../../assets/location-.svg';
import ShareIcon from '../../assets/share.svg';
import { getImageUrl } from '../../utils/imageImports.js';
import CrwdCtrlLogin from '../auth/login';
import CrwdCtrlRegister from '../auth/register';
import { publicFetchJSONRetry as fetchJSON, resolveUrl } from '../../services/api/client';
import Seo from '../../components/Seo';
import { breadcrumbSchema, eventSchema } from '../../utils/seo';
import { openExternalUrl, shareContent } from '../../utils/externalLink';
import { competitionPath, competitionRegistrationPath, festRegisterPath, festPath, entityMatchesRouteParam } from '../../utils/slugRoutes';
import { resolveCompetitionFee, buildRegistrationPrefetch, saveRegistrationPrefetch } from '../../utils/festPublicTransform';
import { trackBookNowClick } from '../../services/analyticsService';
import PrizePoolPodium from '../../components/PrizePoolPodium';
import DetailPageLoader from '../../components/DetailPageLoader';
import CompetitionCoverImage from '../../components/CompetitionCoverImage';
import { signalDetailPageReady } from '../../utils/bootSplash';
import { formatSlotsLabel, buildTeamSizeLabel, isCompetitionSoldOut } from '../../utils/teamSize';
import { useInAppBack } from '../../hooks/useInAppBack';
import {
    loadCompetitionDetailCache,
    saveCompetitionDetailCache,
    isBuiltCompetitionDetail,
} from '../../utils/detailPageCache';

/** Compact slots + team chips — sits above Register Now inside the bar */
function RegisterMetaChips({ slotsLabel, teamLabel, isDark }) {
    // Keep full wording: "49 slots remain" (not just "49 remain")
    const slotsShort = (() => {
        const raw = String(slotsLabel || '').trim();
        if (!raw) return '';
        const remainMatch = raw.match(/^(\d+)\s+slots?\s+remains?$/i);
        if (remainMatch) {
            const n = Number(remainMatch[1]);
            return n === 1 ? '1 slot remains' : `${n} slots remain`;
        }
        const allottedMatch = raw.match(/^(\d+)\s+slots?$/i);
        if (allottedMatch) {
            const n = Number(allottedMatch[1]);
            return n === 1 ? '1 slot remains' : `${n} slots remain`;
        }
        return raw;
    })();
    const teamShort = String(teamLabel || '')
        .replace(/participants?/gi, 'people')
        .replace(/\s*per\s*team/gi, '')
        .replace(/^team\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim() || 'Solo';

    return (
        <div className="flex w-full items-center gap-1.5">
            {slotsShort ? (
                <span
                    className={`inline-flex flex-1 min-w-0 items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isDark
                            ? 'bg-[#0ECCEE]/15 text-[#7DE8F7]'
                            : 'bg-cyan-50 text-cyan-700'
                    }`}
                >
                    <Ticket className="w-2.5 h-2.5 shrink-0 opacity-70" strokeWidth={2.25} />
                    <span className="truncate tabular-nums">{slotsShort}</span>
                </span>
            ) : null}
            <span
                className={`inline-flex flex-1 min-w-0 items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    isDark
                        ? 'bg-amber-400/15 text-amber-200'
                        : 'bg-amber-50 text-amber-700'
                }`}
            >
                <Users className="w-2.5 h-2.5 shrink-0 opacity-70" strokeWidth={2.25} />
                <span className="truncate">{teamShort}</span>
            </span>
        </div>
    );
}

function compactRegisterMinAmount(feeTiers) {
    const list = Array.isArray(feeTiers) ? feeTiers.filter((t) => t && (t.label || t.amount >= 0)) : [];
    if (list.length <= 1) return null;
    return Math.min(...list.map((t) => Math.max(0, Number(t.amount) || 0)));
}

function RegisterFeeLabel({ feeLabel, feeIsFree, isDark, feeTiers }) {
    const fromAmount = compactRegisterMinAmount(feeTiers);
    const display = fromAmount != null ? `₹${fromAmount.toLocaleString('en-IN')}` : feeLabel;
    return (
        <div className="min-w-0 flex-1 flex flex-col justify-center h-14">
            {!feeIsFree ? (
                <p className={`text-sm font-semibold leading-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {fromAmount != null ? 'From' : ''}
                </p>
            ) : null}
            {feeIsFree ? (
                <p className="mt-1 text-xl font-bold leading-none text-green-500">Free</p>
            ) : (
                <p className={`mt-1 text-xl font-bold leading-none truncate tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {display}
                </p>
            )}
        </div>
    );
}

function RegistrationFeeLines({ tiers, feeLabel, feeIsFree, isDark }) {
    const list = Array.isArray(tiers) ? tiers.filter((t) => t && (t.label || t.amount >= 0)) : [];
    if (list.length > 1) {
        return (
            <div className={`text-sm space-y-1.5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Registration fees</p>
                {list.map((tier) => (
                    <p key={tier.id || tier.label} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0">{tier.label}</span>
                        <span className={`font-bold tabular-nums shrink-0 ${feeIsFree ? 'text-green-500' : 'text-[#0ECCEE]'}`}>
                            {Number(tier.amount) > 0
                                ? `₹${Number(tier.amount).toLocaleString('en-IN')}/-`
                                : 'Free'}
                        </span>
                    </p>
                ))}
            </div>
        );
    }
    if (!feeLabel) return null;
    return (
        <div className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            <p>
                <span className="font-semibold">Registration fee: </span>
                <span className={`font-bold ${feeIsFree ? 'text-green-500' : 'text-[#0ECCEE]'}`}>
                    {feeLabel}
                </span>
            </p>
        </div>
    );
}

/**
 * Sanitize round description to remove duplicated content blocks.
 * Admin panel sometimes stores the same content twice: once formatted (with newlines)
 * and once as a flat text block appended at the end.
 * This function detects and removes such duplication generically.
 */
const sanitizeRoundDescription = (rawDesc) => {
    if (!rawDesc) return '';

    // Normalize line breaks
    let desc = rawDesc.replace(/\r\n/g, '\n').replace(/<br\s*\/?\s*>/gi, '\n');

    // Drop standalone Offline / Online / Final Round headings (shown as extra labels in UI)
    desc = desc
        .split('\n')
        .filter((line) => !/^\s*(offline|online|final)\s*rounds?\s*:?\s*$/i.test(line))
        .join('\n');


    // Remove the known duplicated metadata paragraph that can appear between
    // "Submission Deadline" and the "Rules" heading.
    const deadlineMatch = /Submission\s+Deadline\s*[:-]?/i.exec(desc);
    if (deadlineMatch) {
        const afterDeadlineIndex = deadlineMatch.index + deadlineMatch[0].length;
        const afterDeadlineText = desc.substring(afterDeadlineIndex);
        const duplicateMetadataMatch = /No\.?\s*of\s*Participants\s*:.*?Participation\s*Type\s*:.*?No\.?\s*of\s*Rounds\s*:/is.exec(afterDeadlineText);

        if (duplicateMetadataMatch) {
            const duplicateStart = afterDeadlineIndex + duplicateMetadataMatch.index;
            const rulesHeadingMatch = /(?:^|\n)\s*Rules(?:\s*(?:&|and)\s*(?:Regulations|Guidelines))?\s*:?(?=\s|$)/im.exec(desc.substring(duplicateStart));

            if (rulesHeadingMatch) {
                const rulesStart = duplicateStart + rulesHeadingMatch.index;
                const beforeDuplicate = desc.substring(0, duplicateStart).trimEnd();
                const rulesSection = desc.substring(rulesStart).trimStart();
                desc = `${beforeDuplicate}\n\n${rulesSection}`.trim();
            }
        }
    }

    // Remove any repeated metadata block (participants/type/rounds) that appears again later.
    // We remove from the second metadata start up to the next Rules heading (or end of text).
    const metadataStartPattern = /No\.?\s*of\s*Participants\s*[:-]/i;
    const firstMetadataIndex = desc.search(metadataStartPattern);
    if (firstMetadataIndex !== -1) {
        const searchFrom = firstMetadataIndex + 1;
        const secondMetadataMatch = metadataStartPattern.exec(desc.substring(searchFrom));

        if (secondMetadataMatch) {
            const secondMetadataIndex = searchFrom + secondMetadataMatch.index;
            const afterSecond = desc.substring(secondMetadataIndex);
            const rulesAfterSecond = /\bRules(?:\s*(?:&|and)\s*(?:Regulations|Guidelines))?\b\s*:?/i.exec(afterSecond);

            if (rulesAfterSecond) {
                const rulesStart = secondMetadataIndex + rulesAfterSecond.index;
                const beforeDuplicate = desc.substring(0, secondMetadataIndex).trimEnd();
                const rulesSection = desc.substring(rulesStart).trimStart();
                desc = `${beforeDuplicate}\n\n${rulesSection}`.trim();
            } else {
                desc = desc.substring(0, secondMetadataIndex).trimEnd();
            }
        }
    }

    // Remove an appended duplicate section when the same heading repeats near the tail
    // (e.g. "GUIDELINES ... JUDGING CRITERIA ..." repeated as one flattened paragraph).
    const trimRepeatedTrailingSection = (text, headerRegex) => {
        const normalize = (value) => value.toLowerCase().replace(/\s+/g, ' ').trim();
        const cutIfTailRepeatsEarlier = (source, startIndex, headerLengthToSkip = 0) => {
            if (startIndex < Math.floor(source.length * 0.4)) return source;

            const earlier = normalize(source.substring(0, startIndex));
            const trailing = normalize(source.substring(startIndex + headerLengthToSkip));
            if (trailing.length < 50) return source;

            const probe = trailing.substring(0, Math.min(200, trailing.length));
            if (probe.length >= 50 && earlier.includes(probe)) {
                return source.substring(0, startIndex).trimEnd();
            }
            return source;
        };

        const matcher = new RegExp(
            headerRegex.source,
            headerRegex.flags.includes('g') ? headerRegex.flags : `${headerRegex.flags}g`
        );
        const firstMatch = matcher.exec(text);
        if (!firstMatch) return text;

        const secondMatch = matcher.exec(text);
        if (secondMatch) {
            const trimmedFromSecond = cutIfTailRepeatsEarlier(text, secondMatch.index, 0);
            if (trimmedFromSecond !== text) return trimmedFromSecond;
        }

        // Fallback: single header occurrence near the end where only the heading is duplicated
        // but the original block earlier has no heading (common in flattened admin content).
        return cutIfTailRepeatsEarlier(text, firstMatch.index, firstMatch[0].length);
    };

    desc = trimRepeatedTrailingSection(desc, /\bGUIDELINES\b/gi);
    desc = trimRepeatedTrailingSection(desc, /\bJUDGING\s+CRITERIA\b/gi);

    // Strategy 1: Find repeated section headers (e.g. GUIDELINES, JUDGING CRITERIA, No. of Participants, etc.)
    const lines = desc.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Build a list of "significant" lines
    const significantLines = [];
    for (const line of lines) {
        const isSignificant = line.length >= 5 && (
            /^[A-Z\s]{4,}$/.test(line) ||           // ALL CAPS header
            /^\d+\.\s/.test(line) ||                 // Numbered item
            /^[A-Z][^.]*:/.test(line) ||             // Key: Value
            /^(GUIDELINES|JUDGING|RULES|CRITERIA|SUBMISSION|No\.|Participation|General|Time\s+Limit)/i.test(line)
        );
        if (isSignificant) significantLines.push(line);
    }

    // Look for duplicate significant lines anywhere in the text
    // Normalize text for comparison by removing all whitespace and case
    const flatDesc = desc.toLowerCase().replace(/\s+/g, '');
    
    for (const sigLine of significantLines) {
        const sigFlat = sigLine.toLowerCase().replace(/\s+/g, '');
        const firstIdx = flatDesc.indexOf(sigFlat);
        if (firstIdx === -1) continue;
        
        const secondIdx = flatDesc.indexOf(sigFlat, firstIdx + sigFlat.length);
        if (secondIdx !== -1) {
            // Found a duplicate in flattened comparison. 
            // Now find the character position in the ORIGINAL desc string to cut.
            // We search for the sigLine's words starting from the second half.
            const sigWords = sigLine.split(/\s+/).filter(w => w.length > 1);
            if (sigWords.length > 0) {
                const searchStart = Math.floor(desc.length / 3); // Start search from after the first block
                const regexStr = sigWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
                const secondMatch = new RegExp(regexStr, 'i').exec(desc.substring(searchStart));
                if (secondMatch) {
                    desc = desc.substring(0, searchStart + secondMatch.index).trim();
                    break;
                }
            }
        }
    }

    // Strategy 2: Check for flattened-repeat tail (robust version)
    const halfLen = Math.floor(desc.length / 2);
    if (halfLen > 50) {
        const firstPart = desc.substring(0, halfLen);
        const firstPartFlat = firstPart.replace(/\s+/g, '').toLowerCase();
        
        // Check if various portions of the front appear flattened at the back
        const checkPoints = [0, 20, 50];
        const checkLen = 60;
        
        for (const start of checkPoints) {
            if (firstPartFlat.length < start + checkLen) continue;
            const prefix = firstPartFlat.substring(start, start + checkLen);
            const descLowerEndFlat = desc.substring(halfLen).toLowerCase().replace(/\s+/g, '');
            const matchPos = descLowerEndFlat.indexOf(prefix);
            
            if (matchPos !== -1) {
                // If we found a flattened match, we need to find where that match starts in the original desc
                // We'll look for first 3 significant words of that prefix in the original text
                const words = firstPart.substring(start).split(/\s+/).filter(w => w.length > 2).slice(0, 3);
                if (words.length >= 2) {
                    const regex = new RegExp(words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'i');
                    const secondMatch = regex.exec(desc.substring(halfLen));
                    if (secondMatch) {
                        desc = desc.substring(0, halfLen + secondMatch.index).trim();
                        return desc;
                    }
                }
            }
        }
    }

    return desc.trim();
};

const sanitizeRulesArray = (rules) => {
    if (!Array.isArray(rules)) return [];

    return rules
        .map((rule) => (typeof rule === 'string' ? sanitizeRoundDescription(rule).trim() : ''))
        .filter((rule) => rule.length > 0);
};

const stripRulePrefix = (line) =>
    String(line || '')
        .replace(/^[\s•●◦▪\-–—*]+/, '')
        .replace(/^\d+\.\s*/, '')
        .trim();

/** Turn rule strings (incl. multi-line blobs) into clean one-line bullet items */
const flattenRulesForDisplay = (rules) => {
    if (!Array.isArray(rules)) return [];

    const flat = [];
    for (const rule of rules) {
        const text = typeof rule === 'string' ? sanitizeRoundDescription(rule).trim() : '';
        if (!text) continue;

        const lines = text
            .split(/\n+/)
            .map(stripRulePrefix)
            .filter((line) => line.length > 0);

        if (lines.length <= 1) {
            const single = stripRulePrefix(text);
            if (single) flat.push(single);
            continue;
        }

        for (const line of lines) {
            if (line.length >= 4) flat.push(line);
        }
    }

    return flat;
};

/** True when a round has rules / mode sections worth showing (skip empty placeholders) */
const roundHasDisplayableContent = (round) => {
    if (!round) return false;
    const offline = sanitizeRulesArray(round.offline?.rules || []);
    const online = sanitizeRulesArray(round.online?.rules || []);
    const general = sanitizeRulesArray(round.rules || []);
    const msg = String(round.roundRulesMessage || '').trim();
    if (offline.length || online.length || general.length || msg) return true;

    const desc = String(round.description || '').trim();
    const title = String(round.title || '').trim();
    const genericTitle = !title
        || /^(offline|online)\s*rounds?$/i.test(title)
        || /^final\s*rounds?$/i.test(title)
        || /^rounds?\s*\d+$/i.test(title);
    // Custom-named round with a real description (no empty Offline/Online shells)
    return !genericTitle && desc.length >= 20;
};

const buildCompetitionData = (compData, options = {}) => {
    if (!compData) return null;

    const roundsSource = Array.isArray(compData.rounds) ? compData.rounds : [];
    const roundsObject = !Array.isArray(compData.rounds) && compData.rounds ? compData.rounds : null;
    const roundsListSource = Array.isArray(roundsObject?.roundsList) ? roundsObject.roundsList : roundsSource;

    const fee = resolveCompetitionFee(compData);

    const mappedRounds = (roundsListSource || []).map((round, i) => ({
        title: round?.title || `Round ${i + 1}`,
        rules: sanitizeRulesArray(round?.rules || []),
        roundRulesMessage: sanitizeRoundDescription(round?.roundRulesMessage || ''),
        description: sanitizeRoundDescription(round?.description || ''),
        dateTime: round?.dateTime || '',
        venue: round?.venue || '',
        offline: round?.offline
            ? {
                ...round.offline,
                rules: sanitizeRulesArray(round.offline.rules || [])
            }
            : null,
        online: round?.online
            ? {
                ...round.online,
                rules: sanitizeRulesArray(round.online.rules || [])
            }
            : null
    }));

    // Drop empty placeholder rounds so MindSpark comps without content don't show empty boxes
    const roundsList = mappedRounds.filter(roundHasDisplayableContent);
    // Only use an explicit rounds.description — never Round 1's blurb (that duplicated under the heading)
    const roundsDescription = sanitizeRoundDescription(roundsObject?.description || '');

    return {
        id: compData._id || compData.id,
        title: compData.name || compData.title || '',
        subtitle: sanitizeRoundDescription(compData.subtitle || ''),
        date: compData.dateTime || compData.date || '',
        time: compData.time || '',
        venue: compData.venue && String(compData.venue).trim().toUpperCase() !== 'TBD'
            ? compData.venue
            : '',
        entryFee: fee.known ? fee.label : (compData.registrationFee || compData.entryFee || ''),
        feeAmount: fee.amount ?? 0,
        feeLabel: fee.known ? fee.label : '',
        feeIsFree: fee.isFree,
        feeKnown: fee.known,
        feeTiers: fee.tiers || [],
        prize: (() => {
            const raw = String(compData.prizePool || compData.prize || '').trim();
            return !raw || /^(tbd|tba|n\/a|na|-|subject to change)$/i.test(raw) ? '' : raw;
        })(),
        image: compData.coverImage || compData.image || compData.fest?.coverImage || null,
        contact: compData.contact || { phone: '', instagram: '', email: '' },
        description: sanitizeRoundDescription(compData.description || ''),
        commonRules: sanitizeRulesArray(compData.commonRules || compData.rules || []),
        commonRulesMessage: sanitizeRoundDescription(compData.commonRulesMessage || ''),
        registrationLink: compData.registrationLink || '',

        registrationType: compData.registrationType || 'fest',
        // Keep competition-level status; never overwrite with fest.registration (that drops not_started)
        registration: compData.registration || { status: 'not_started' },
        legacyRegistration: compData.legacyRegistration || { status: 'NOT_STARTED' },

        fest: compData.fest || null,
        festId: compData.fest?._id || compData.festId || null,
        slotsAllotted: Math.max(0, Number(compData.slotsAllotted) || 0),
        slotsFilled: Math.max(0, Number(compData.slotsFilled) || 0),
        showSlotsPublic: compData.showSlotsPublic !== false,
        slotsLeft: (() => {
            if (compData.showSlotsPublic === false) return null;
            const allotted = Math.max(0, Number(compData.slotsAllotted) || 0);
            if (compData.slotsLeft != null && Number.isFinite(Number(compData.slotsLeft))) {
                return Math.max(0, Math.floor(Number(compData.slotsLeft)));
            }
            if (allotted > 0) {
                const filled = Math.max(0, Number(compData.slotsFilled) || 0);
                return Math.max(0, allotted - filled);
            }
            return null;
        })(),
        teamSizeMin: Math.max(1, Number(compData.teamSizeMin) || 1),
        teamSizeMax: Math.max(1, Number(compData.teamSizeMax) || Number(compData.teamSizeMin) || 1),
        teamSizeLabel: compData.teamSizeLabel || '',

        rounds: {
            description: roundsDescription,
            list: Array.isArray(roundsObject?.list)
                ? roundsObject.list
                : roundsSource.map((round) => round?.title || round?.description).filter(Boolean),
            roundsList,
        }
    };
};

/** Full paint package for this competition id only (never another comp’s hero). */
function resolvePaintPackage(competitionId, location) {
    const cached = competitionId ? loadCompetitionDetailCache(competitionId) : null;
    if (cached && entityMatchesRouteParam(cached, competitionId, ['name', 'title'])) {
        return isBuiltCompetitionDetail(cached)
            ? cached
            : buildCompetitionData(cached, { useFestRegistrationFallback: true });
    }
    // List-card seed is incomplete (often no cover/slots) — wait for live fetch so the page
    // appears as one composition instead of empty hero + faded body.
    const fromState = location?.state?.competition;
    if (
        fromState
        && competitionId
        && entityMatchesRouteParam(fromState, competitionId, ['name', 'title'])
        && (fromState.coverImage || fromState.image)
    ) {
        return buildCompetitionData(fromState, { useFestRegistrationFallback: true });
    }
    return null;
}

function EventPage() {
    const { competitionId } = useParams();
    const navigate = useNavigate();
    const goBack = useInAppBack();
    const location = useLocation();
    const [activeRound, setActiveRound] = useState(0);
    const [showRegistrationSuccess] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [showFullAbout, setShowFullAbout] = useState(false);
    const [expandedRules, setExpandedRules] = useState({});
    const [competitionData, setCompetitionData] = useState(() =>
        resolvePaintPackage(competitionId, location),
    );
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [fetchDone, setFetchDone] = useState(false);
    const [error, setError] = useState(null);
    // Single gate: hero + body + chips paint together (no empty banner then fade-in)
    const [pageReady, setPageReady] = useState(() =>
        Boolean(resolvePaintPackage(competitionId, location)),
    );
    const { isDark } = useDarkMode();
    const { alert: showAlert, toast } = useDialog();
    const { isAuthenticated } = useAuth();
    const fetchGenRef = useRef(0);

    // Switching comps reuses this page — swap to a complete package or hold on loader
    useLayoutEffect(() => {
        const pack = resolvePaintPackage(competitionId, location);
        fetchGenRef.current += 1;
        setCompetitionData(pack);
        setPageReady(Boolean(pack));
        setFetchDone(false);
        setError(null);
        setActiveRound(0);
        setExpandedRules({});
        setShowFullAbout(false);
        setShowShareMenu(false);
        return undefined;
    }, [competitionId]);

    // Fetch competition data from backend API
    useEffect(() => {
        const gen = fetchGenRef.current;
        const applyPackage = (built) => {
            if (gen !== fetchGenRef.current) return;
            setCompetitionData(built);
            setPageReady(true);
            setFetchDone(true);
        };

        const fetchCompetitionData = async () => {
            if (!competitionId) {
                const stateCompetition = location.state?.competition;
                if (stateCompetition) {
                    const built = buildCompetitionData(stateCompetition, { useFestRegistrationFallback: true });
                    applyPackage(built);
                    return;
                }
                navigate('/');
                return;
            }

            try {
                setError(null);
                const response = await fetchJSON(`/fests/competitions/${competitionId}/public`, {
                    cacheBust: false,
                });
                if (gen !== fetchGenRef.current) return;

                const compData = response.data;
                if (compData) {
                    const built = buildCompetitionData(compData, { useFestRegistrationFallback: true });
                    saveCompetitionDetailCache(competitionId, built);
                    applyPackage(built);
                } else {
                    setError('Competition not found');
                    setFetchDone(true);
                }
            } catch (err) {
                if (gen !== fetchGenRef.current) return;
                console.error('Error fetching competition data:', err);

                let errorMessage = 'Competition not found';
                if (err.response?.status === 404) {
                    errorMessage = 'Competition not found or not available';
                } else if (err.response?.status === 400) {
                    errorMessage = 'Invalid competition ID format';
                } else if (err.response?.status >= 500) {
                    errorMessage = 'Server error. Please try again later.';
                } else if (err.message?.includes('Network Error') || !err.response) {
                    errorMessage = 'Network error. Please check your connection.';
                }

                const stateCompetition = location.state?.competition;
                if (stateCompetition && entityMatchesRouteParam(stateCompetition, competitionId, ['name', 'title'])) {
                    const built = buildCompetitionData(stateCompetition, { useFestRegistrationFallback: true });
                    saveCompetitionDetailCache(competitionId, built);
                    applyPackage(built);
                } else {
                    const cached = competitionId ? loadCompetitionDetailCache(competitionId) : null;
                    if (cached && entityMatchesRouteParam(cached, competitionId, ['name', 'title'])) {
                        const built = isBuiltCompetitionDetail(cached)
                            ? cached
                            : buildCompetitionData(cached, { useFestRegistrationFallback: true });
                        applyPackage(built);
                    } else if (!resolvePaintPackage(competitionId, location)) {
                        setError(errorMessage);
                        setFetchDone(true);
                    } else {
                        // Keep whatever package is already on screen
                        setFetchDone(true);
                    }
                }
            }
        };

        fetchCompetitionData();
    }, [competitionId, navigate, location.state]);

    // Keep tab index valid when empty placeholder rounds are filtered out
    useEffect(() => {
        const total = competitionData?.rounds?.roundsList?.length || 0;
        if (total <= 0) {
            if (activeRound !== 0) setActiveRound(0);
            return;
        }
        if (activeRound >= total) setActiveRound(0);
    }, [competitionData?.id, competitionData?.rounds?.roundsList?.length, activeRound]);

    // 🔄 Listen for admin updates and refetch data
    useEffect(() => {
        const handleAdminUpdate = () => {
            // Only refetch if we have a competitionId
            if (competitionId) {
                // Refetch the competition data with cache busting
                const fetchUpdatedData = async () => {
                    try {
                        const timestamp = Date.now();
                        const response = await fetchJSON(`/fests/competitions/${competitionId}/public?t=${timestamp}`);
                        const compData = response.data;

                        if (compData) {
                            const built = buildCompetitionData(compData, { useFestRegistrationFallback: true });
                            setCompetitionData(built);
                            saveCompetitionDetailCache(competitionId, built);
                        }
                    } catch (err) {
                        console.error('Error refetching updated competition data:', err);
                    }
                };
                fetchUpdatedData();
            }
        };

        // Listen for custom admin update event (same-tab)
        window.addEventListener('admin_fest_updated', handleAdminUpdate);

        // Also listen for storage events (cross-tab updates)
        const handleStorageChange = (e) => {
            if (e.key === 'admin_data_updated') {
                handleAdminUpdate({ detail: {} });
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('admin_fest_updated', handleAdminUpdate);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [competitionId]);

    useEffect(() => {
        if (!competitionData) return;
        const canonical = competitionPath(competitionData);
        if (canonical && window.location.pathname !== canonical) {
            navigate(`${canonical}${window.location.search || ''}`, { replace: true, state: location.state });
        }
    }, [competitionData, navigate, location.state]);

    // Check for login modal parameter
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        if (urlParams.get('showLogin') === 'true') {
            setShowLogin(true);
        }
    }, [location.search]);

    // ✅ CRITICAL FIX: Auto-close login/register modal when user becomes authenticated
    // This is essential for phone login which uses redirect-based authentication
    useEffect(() => {
        if (isAuthenticated && showLogin) {
            setShowLogin(false);
            // Clear URL parameters
            const url = new URL(window.location);
            url.searchParams.delete('showLogin');
            window.history.replaceState({}, '', url);
        }
        if (isAuthenticated && showRegister) {
            setShowRegister(false);
        }
    }, [isAuthenticated, showLogin, showRegister]);

    useEffect(() => {
        if (pageReady || (fetchDone && error)) {
            signalDetailPageReady();
        }
    }, [pageReady, fetchDone, error]);

    if (!pageReady && !error) {
        return <DetailPageLoader variant="competition" label="Loading competition" />;
    }

    if (error && !competitionData) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="mb-6">
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-red-900/20' : 'bg-red-100'}`}>
                            <svg className={`w-8 h-8 ${isDark ? 'text-red-400' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                    </div>
                    <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
                        {error || 'Competition not found'}
                    </h2>
                    <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
                        The competition you're looking for might have been removed or the link might be incorrect.
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => navigate('/')}
                            className="w-full bg-cyan-500 text-white px-6 py-3 rounded-lg hover:bg-cyan-600 transition font-medium"
                        >
                            Go to Dashboard
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className={`w-full px-6 py-3 rounded-lg transition font-medium ${
                                isDark 
                                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Try Again
                        </button>
                    </div>
                    {competitionId && (
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-4`}>
                            Competition ID: {competitionId}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    const eventData = competitionData;
    const showHeroImage = Boolean(eventData?.image);

    if (!eventData?.title) {
        return <DetailPageLoader variant="competition" label="Loading competition" />;
    }

    // Get fest name from location state or URL params
    const festName = location.state?.eventData?.festival_name || location.state?.eventData?.title || '';
    const passedEventData = location.state?.eventData;

    // Function to get common rules based on fest context
    const getCommonRules = () => {
        // Display priority: show message field if present, otherwise show individual rules
        if (eventData?.commonRulesMessage && eventData.commonRulesMessage.trim()) {
            // Return message field content as a single item for display
            return [sanitizeRoundDescription(eventData.commonRulesMessage)];
        }
        // Use commonRules array
        return sanitizeRulesArray(eventData?.commonRules || []);
    };

    // Function to get round rules (flat list — used when no offline/online split)
    const getRoundRules = (roundData) => {
        if (!roundData) return [];

        if (roundData.roundRulesMessage && roundData.roundRulesMessage.trim()) {
            return [sanitizeRoundDescription(roundData.roundRulesMessage)];
        }

        return sanitizeRulesArray(roundData.rules || []);
    };

    const getRoundModeSections = (roundData) => {
        if (!roundData) return { offline: [], online: [], general: [] };

        const offline = sanitizeRulesArray(roundData.offline?.rules || []);
        const online = sanitizeRulesArray(roundData.online?.rules || []);
        const general = getRoundRules(roundData);

        if (offline.length || online.length) {
            return { offline, online, general: [] };
        }

        return { offline: [], online: [], general };
    };

    const RoundRulesContent = ({ round, roundIndex, variant = 'mobile' }) => {
        const { offline, online, general } = getRoundModeSections(round);
        const boxClass = `${isDark ? (variant === 'mobile' ? 'bg-dark-700' : 'bg-[#111213]') : 'bg-gray-50'} rounded-lg p-4`;
        const labelClass = `text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`;

        const renderRulesBox = (rules, modeLabel, keySuffix) => (
            <div className={boxClass}>
                {/* Only label Offline/Online when both modes exist for this round */}
                {modeLabel ? <h4 className={labelClass}>{modeLabel}</h4> : null}
                <RulesList
                    rules={rules}
                    ruleKey={`${variant}-round${roundIndex}-${keySuffix}-${eventData?.id}`}
                    maxItems={8}
                />
            </div>
        );

        if (offline.length && online.length) {
            return (
                <div className="space-y-3">
                    {renderRulesBox(offline, 'Offline', 'offline')}
                    {renderRulesBox(online, 'Online', 'online')}
                </div>
            );
        }

        if (offline.length) return renderRulesBox(offline, null, 'offline');
        if (online.length) return renderRulesBox(online, null, 'online');

        if (general.length > 0) {
            return renderRulesBox(general, null, 'general');
        }

        return null;
    };

    /** Hide generic Offline / Online titles — Final stays on the last round tab */
    const getRoundDisplayTitle = (round, idx, totalRounds = 0) => {
        const title = String(round?.title || '').trim();
        if (!title) return '';
        if (/^(offline|online)\s*rounds?$/i.test(title)) return '';
        if (/^final\s*rounds?$/i.test(title)) return '';
        if (/^rounds?\s*\d+$/i.test(title)) return '';
        if (title.toLowerCase() === `round ${idx + 1}`.toLowerCase()) return '';
        // Last round tab already says Final — don't repeat
        if (totalRounds > 1 && idx === totalRounds - 1 && /final/i.test(title)) return '';
        return title;
    };

    const getRoundTabLabel = (round, idx, totalRounds) => {
        const title = String(round?.title || '').trim();
        const isGeneric =
            !title
            || /^(offline|online)\s*rounds?$/i.test(title)
            || /^rounds?\s*\d+$/i.test(title)
            || /^final\s*rounds?$/i.test(title);

        // Keep real names (e.g. FLASH → Videography); only label generic last tabs as Final
        if (!isGeneric) return title;
        if (totalRounds > 1 && idx === totalRounds - 1) return 'Final';
        return `Round ${idx + 1}`;
    };

    /** Title → short blurb → rules (no duplicate title / Online-Offline noise) */
    const renderActiveRoundBody = (variant = 'mobile') => {
        const round = roundsList[activeRound];
        if (!round) return null;

        const cleanedRoundDescription = sanitizeRoundDescription(round.description || '');
        const cleanedOverviewDescription = sanitizeRoundDescription(eventData?.rounds?.description || '');
        const normalizedRoundDescription = cleanedRoundDescription.toLowerCase().replace(/\s+/g, ' ').trim();
        const normalizedOverviewDescription = cleanedOverviewDescription.toLowerCase().replace(/\s+/g, ' ').trim();
        const isDuplicateOfOverview =
            normalizedRoundDescription.length > 40 &&
            normalizedOverviewDescription.length > 40 &&
            (normalizedOverviewDescription.includes(normalizedRoundDescription) ||
                normalizedRoundDescription.includes(normalizedOverviewDescription));

        const tabLabel = getRoundTabLabel(round, activeRound, roundsList.length);
        let displayTitle = getRoundDisplayTitle(round, activeRound, roundsList.length);
        // Tab already shows this name (e.g. Fusion Fundamentals) — don't repeat above the blurb
        if (displayTitle && displayTitle.toLowerCase() === tabLabel.toLowerCase()) {
            displayTitle = '';
        }
        // On Final tab, keep the real round name as the upper heading (e.g. Design Round)
        if (!displayTitle && tabLabel === 'Final') {
            const raw = String(round?.title || '').trim();
            if (raw && !/^final\s*rounds?$/i.test(raw) && !/^rounds?\s*\d+$/i.test(raw)) {
                displayTitle = raw;
            }
        }

        const { offline, online, general } = getRoundModeSections(round);
        const hasRoundContent = offline.length + online.length + general.length > 0;
        // Always show intro when there are no rule bullets; otherwise keep it short
        const showDescription =
            cleanedRoundDescription &&
            !isDuplicateOfOverview &&
            (!hasRoundContent || cleanedRoundDescription.length <= 220);

        return (
            <div className="space-y-3">
                {displayTitle ? (
                    <h3 className={`font-bold text-lg leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {displayTitle}
                    </h3>
                ) : null}

                {showDescription ? (
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {cleanedRoundDescription}
                    </p>
                ) : null}

                {hasRoundContent ? (
                    <RoundRulesContent round={round} roundIndex={activeRound} variant={variant} />
                ) : null}
            </div>
        );
    };

    const commonRules = getCommonRules();
    // Re-filter at render (covers stale detail cache with empty placeholder rounds)
    const roundsList = (eventData?.rounds?.roundsList || []).filter(roundHasDisplayableContent);
    // Hide entire Competition Rounds card when MindSpark (or any) comp has no real round content
    const showCompetitionRounds = roundsList.length > 0;

    const contactList = (() => {
        const c = eventData?.contact;
        if (!c) return [];
        const hasAny = Boolean(c.name || c.email || c.phone || c.instagram);
        if (!hasAny) return [];

        let instagramId = c.instagram || '';
        if (instagramId.startsWith('http')) {
            try {
                const path = new URL(instagramId).pathname.replace(/^\/+|\/+$/g, '');
                instagramId = path || instagramId;
            } catch {
                /* keep as-is */
            }
        }
        instagramId = instagramId.replace(/^@/, '');

        const names = String(c.name || '')
            .split(/\s*(?:\/|&|,| and )\s*/i)
            .map((n) => n.replace(/^event\s*heads?\s*:?\s*/i, '').trim())
            .filter((n) => n.length > 1);
        const phones = String(c.phone || '')
            .split(/\s*(?:,|\/|;)\s*/)
            .map((p) => p.trim())
            .filter(Boolean);

        // Pair each event head with their number (MindSpark stores "A / B" + "ph1, ph2")
        if (names.length > 1 || phones.length > 1) {
            const count = Math.max(names.length, phones.length, 1);
            return Array.from({ length: count }, (_, i) => ({
                name: names[i] || names[0] || 'Event Head',
                role: c.role || 'Event Head',
                email: i === 0 ? (c.email || '') : '',
                phone: phones[i] || phones[0] || '',
                instagramId: i === 0 ? instagramId : '',
            })).filter((row) => row.name || row.phone || row.email || row.instagramId);
        }

        return [{
            name: names[0] || c.name || '',
            role: c.role || 'Event Head',
            email: c.email || '',
            phone: phones[0] || c.phone || '',
            instagramId,
        }];
    })();

    const ContactPersonCard = ({ contact }) => (
        <div className="space-y-3">
            <div>
                <p className="text-base font-bold leading-snug text-white">
                    {contact.name || 'Event Head'}
                </p>
                {contact.role ? (
                    <p className="mt-0.5 text-xs font-medium text-gray-400">{contact.role}</p>
                ) : null}
            </div>

            <div className="space-y-2">
                {contact.phone
                    ? contact.phone.split(/\s*(?:,|\/)\s*/).filter(Boolean).map((entry, pi) => {
                        const nameMatch = entry.match(/\(([^)]+)\)/);
                        const label = nameMatch ? nameMatch[1].trim() : null;
                        const rawNumber = entry.replace(/\s*\([^)]*\)/, '').trim();
                        const tel = rawNumber.replace(/[\s-]/g, '');
                        return (
                            <a
                                key={pi}
                                href={`tel:${tel}`}
                                className="flex items-center gap-2.5 text-white/90 hover:text-[#0ECCEE] transition"
                            >
                                <Phone size={15} className="text-[#0ECCEE] shrink-0" strokeWidth={2.25} />
                                <span className="min-w-0">
                                    {label ? (
                                        <span className="block text-[11px] text-gray-400 leading-tight">{label}</span>
                                    ) : null}
                                    <span className="block text-sm font-medium tabular-nums tracking-wide">
                                        {rawNumber}
                                    </span>
                                </span>
                            </a>
                        );
                    })
                    : null}

                {contact.email ? (
                    <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-2.5 text-white/90 hover:text-emerald-400 transition"
                    >
                        <Mail size={15} className="text-emerald-400 shrink-0" strokeWidth={2.25} />
                        <span className="text-sm font-medium truncate">{contact.email}</span>
                    </a>
                ) : null}

                {contact.instagramId ? (
                    <a
                        href={`https://instagram.com/${contact.instagramId.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 text-white/90 hover:text-pink-400 transition"
                    >
                        <Instagram size={15} className="text-pink-400 shrink-0" strokeWidth={2.25} />
                        <span className="text-sm font-medium">
                            {contact.instagramId.startsWith('@') ? contact.instagramId : `@${contact.instagramId}`}
                        </span>
                    </a>
                ) : null}
            </div>
        </div>
    );

    const ContactDetailsBox = () => (
        <div className="rounded-2xl bg-[#111213] shadow-[0_8px_24px_rgba(0,0,0,0.28)] border border-white/5 p-4 sm:p-5">
            <div className="space-y-5 divide-y divide-white/10">
                {contactList.map((contact, index) => (
                    <div key={index} className={index === 0 ? '' : 'pt-5'}>
                        <ContactPersonCard contact={contact} />
                    </div>
                ))}
            </div>
        </div>
    );

    // Helper function to check if custom internal form is properly configured
    const isCustomFormConfigured = () => {
        if (eventData?.registrationType !== 'custom' || eventData?.registration?.status !== 'internal_form') {
            return true; // Not a custom form, so return true (not applicable)
        }
        
        const formType = eventData?.registration?.formType || 'SINGLE_STEP';
        let hasFormFields = false;
        
        if (formType === 'SINGLE_STEP') {
            // Check SINGLE_STEP formSchema
            const formSchema = eventData?.registration?.formSchema || [];
            hasFormFields = Array.isArray(formSchema) && formSchema.length > 0;
        } else if (formType === 'MULTI_STEP') {
            // Check MULTI_STEP steps with fields
            const steps = eventData?.registration?.steps || [];
            hasFormFields = steps.length > 0 && steps.some(step => step.fields && step.fields.length > 0);
        }

        return hasFormFields;
    };

    // Helper function to determine registration availability
    const getRegistrationStatus = () => {
        const registrationType = eventData?.registrationType || 'fest';
        const registrationStatus = String(eventData?.registration?.status || 'not_started').toLowerCase();
        const festMode = String(
            eventData?.fest?.registration?.mode
            || passedEventData?.registration?.mode
            || 'NOT_STARTED'
        ).toUpperCase();
        const legacyStatus = String(
            eventData?.legacyRegistration?.status || ''
        ).toUpperCase();

        const closedResult = (buttonText) => ({
            isAvailable: false,
            buttonText,
            isDisabled: true,
        });

        if (isCompetitionSoldOut(eventData)) {
            return closedResult('Sold out');
        }

        // Fest-linked competitions follow the parent fest registration mode.
        // Competition-level "not_started" must NOT block these — otherwise admins
        // open the fest as Internal Form but every competition still looks closed.
        if (registrationType === 'fest') {
            if (festMode === 'NOT_STARTED') {
                return closedResult('Registration Not Open Yet');
            }
            if (festMode === 'CLOSED') {
                return closedResult('Registration Closed');
            }
            return {
                isAvailable: festMode === 'EXTERNAL_LINK' || festMode === 'INTERNAL_FORM',
                buttonText: festMode === 'NOT_STARTED' ? 'Registration Not Open Yet'
                    : festMode === 'CLOSED' ? 'Registration Closed' : 'Register Now',
                isDisabled: festMode === 'NOT_STARTED' || festMode === 'CLOSED',
            };
        }

        // Custom competitions: competition registration.status controls availability
        if (registrationStatus === 'not_started') {
            return closedResult('Registration Not Open Yet');
        }
        if (registrationStatus === 'registration_closed') {
            return closedResult('Registration Closed');
        }
        if (legacyStatus === 'NOT_STARTED') {
            if (!['external_link', 'internal_form', 'started'].includes(registrationStatus)) {
                return closedResult('Registration Not Open Yet');
            }
        }
        if (legacyStatus === 'CLOSED') {
            return closedResult('Registration Closed');
        }

        // Parent fest still not open → keep custom comps closed too
        if (festMode === 'NOT_STARTED') {
            return closedResult('Registration Not Open Yet');
        }
        if (festMode === 'CLOSED') {
            return closedResult('Registration Closed');
        }

        if (registrationType === 'custom') {
            const isConfigured = isCustomFormConfigured();
            if (!isConfigured && registrationStatus === 'internal_form') {
                return {
                    isAvailable: false,
                    buttonText: 'Form Not Configured',
                    isDisabled: true,
                    notConfigured: true,
                };
            }
            return {
                isAvailable: registrationStatus === 'external_link' || registrationStatus === 'internal_form',
                buttonText: registrationStatus === 'not_started' ? 'Registration Not Open Yet'
                    : registrationStatus === 'registration_closed' ? 'Registration Closed' : 'Register Now',
                isDisabled: registrationStatus === 'not_started' || registrationStatus === 'registration_closed',
            };
        }

        return {
            isAvailable: legacyStatus === 'STARTED' || registrationStatus === 'internal_form' || registrationStatus === 'external_link',
            buttonText: 'Register Now',
            isDisabled: false,
        };
    };

    const registrationInfo = getRegistrationStatus();

    const handleRegister = async () => {
        const statusInfo = getRegistrationStatus();
        if (statusInfo.isDisabled) {
            if (statusInfo.notConfigured) {
                showAlert({
                    title: 'Registration unavailable',
                    message: 'Registration is not available. Please contact the organizers.',
                });
                return;
            }
            showAlert({
                title: statusInfo.buttonText === 'Sold out'
                    ? 'Sold out'
                    : statusInfo.buttonText === 'Registration Closed' ? 'Registration closed' : 'Registration not open yet',
                message: statusInfo.buttonText === 'Sold out'
                    ? 'All slots for this competition are filled.'
                    : statusInfo.buttonText === 'Registration Closed'
                    ? 'Registration for this competition is closed.'
                    : 'Registration has not opened yet for this competition.',
            });
            return;
        }

        const registrationType = eventData?.registrationType || 'fest';
        const registrationStatus = String(eventData?.registration?.status || 'not_started').toLowerCase();
        const festRegistrationMode = String(
            eventData?.fest?.registration?.mode
            || passedEventData?.registration?.mode
            || 'NOT_STARTED'
        ).toUpperCase();

        if (registrationType === 'fest') {
            const mode = festRegistrationMode || 'NOT_STARTED';
            if (mode === 'EXTERNAL_LINK') {
                const link = eventData?.fest?.registration?.externalLink || eventData?.registrationLink;
                if (link) openExternalUrl(link);
                else showAlert({ title: 'Registration unavailable', message: 'Registration link is not available. Please contact the organizers.' });
            } else if (mode === 'INTERNAL_FORM') {
                const festRef = eventData?.fest || { _id: eventData?.festId };
                const compId = eventData?.id || eventData?._id || '';
                const base = festRegisterPath(festRef);
                const path = compId
                  ? `${base}${base.includes('?') ? '&' : '?'}competition=${encodeURIComponent(compId)}`
                  : base;
                const prefetch = buildRegistrationPrefetch({
                    fest: {
                        _id: eventData?.festId || eventData?.fest?._id,
                        festName: eventData?.fest?.festName || passedEventData?.festival_name || passedEventData?.title,
                        collegeName: eventData?.fest?.collegeName || passedEventData?.collegeName || passedEventData?.subtitle,
                        slug: eventData?.fest?.slug || '',
                        feeAmount: eventData?.fest?.feeAmount ?? 0,
                        platformFeePercent: eventData?.fest?.platformFeePercent ?? 0,
                        registration: eventData?.fest?.registration,
                    },
                    competition: {
                        _id: compId,
                        id: compId,
                        name: eventData?.title,
                        feeAmount: eventData?.feeAmount,
                        registrationFee: eventData?.entryFee,
                        registrationType: eventData?.registrationType,
                        registration: eventData?.registration,
                        teamSizeMin: eventData?.teamSizeMin,
                        teamSizeMax: eventData?.teamSizeMax,
                        teamSizeLabel: eventData?.teamSizeLabel,
                    },
                });
                const festRefId = eventData?.festId || eventData?.fest?._id;
                if (festRefId && prefetch) {
                    saveRegistrationPrefetch(festRefId, compId, prefetch);
                }
                navigate(path, {
                    state: {
                        freshRegistration: true,
                        festId: eventData?.festId || eventData?.fest?._id,
                        competitionId: compId,
                        prefetch,
                    },
                });
            } else if (mode === 'NOT_STARTED') {
                showAlert({ title: 'Registration not open yet', message: 'Registration has not opened yet for this competition.' });
            } else if (mode === 'CLOSED') {
                showAlert({ title: 'Registration closed', message: 'Registration for this competition is closed.' });
            } else {
                showAlert({ title: 'Registration unavailable', message: 'Registration configuration is not set up properly. Please contact the organizers.' });
            }
            return;
        }

        if (registrationType === 'custom') {
            if (registrationStatus === 'external_link') {
                const link = eventData?.registration?.externalUrl || eventData?.registrationLink;
                if (link) openExternalUrl(link);
                else showAlert({ title: 'Registration unavailable', message: 'External registration link not available. Please contact the organizers.' });
            } else if (registrationStatus === 'internal_form') {
                navigate(competitionRegistrationPath(eventData || { id: competitionId }), {
                    state: { freshRegistration: true },
                });
            } else if (registrationStatus === 'not_started') {
                showAlert({ title: 'Registration not open yet', message: 'Registration has not opened yet for this competition.' });
            } else if (registrationStatus === 'registration_closed') {
                showAlert({ title: 'Registration closed', message: 'Registration for this competition is closed.' });
            } else {
                showAlert({ title: 'Registration unavailable', message: 'Registration configuration is not set up properly. Please contact the organizers.' });
            }
            return;
        }

        showAlert({ title: 'Registration not open yet', message: 'Registration has not opened yet for this competition.' });
    };

    // Component for rendering rules with read more functionality
    const RulesList = ({ rules, ruleKey, maxItems = 5 }) => {
        const isExpanded = expandedRules[ruleKey];
        const normalizedRules = flattenRulesForDisplay(rules);

        const shouldTruncate = normalizedRules.length > maxItems;
        const displayRules = shouldTruncate && !isExpanded
            ? normalizedRules.slice(0, maxItems)
            : normalizedRules;

        const toggleExpanded = () => {
            setExpandedRules(prev => ({
                ...prev,
                [ruleKey]: !prev[ruleKey]
            }));
        };

        return (
            <div>
                <ul className="space-y-3 text-sm list-none p-0 m-0">
                    {displayRules.length > 0 ? (
                        displayRules.map((rule, index) => (
                            <li key={index} className="flex items-start gap-2.5">
                                <span
                                    className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-[#0ECCEE]"
                                    aria-hidden
                                />
                                <span className={`flex-1 min-w-0 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {rule}
                                </span>
                            </li>
                        ))
                    ) : null}
                </ul>
                {shouldTruncate && (
                    <button
                        onClick={toggleExpanded}
                        className={`mt-3 text-sm font-medium transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
                            }`}
                    >
                        {isExpanded
                            ? 'Read Less'
                            : `Show More (${normalizedRules.length - maxItems} more rules)`}
                    </button>
                )}
            </div>
        );
    };

    const handleShare = (platform) => {
        const url = window.location.href;
        const text = `Check out ${eventData?.title || 'this competition'} at CrwdCtrl!`;

        switch (platform) {
            case 'whatsapp':
                openExternalUrl(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`);
                break;
            case 'facebook':
                openExternalUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
                break;
            case 'twitter':
                openExternalUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
                break;
            case 'copy':
                navigator.clipboard?.writeText(url);
                toast('Link copied to clipboard!');
                break;
            case 'native':
                shareContent({ title: eventData?.title || 'CrwdCtrl', text, url });
                break;
            default:
                break;
        }
        setShowShareMenu(false);
    };

    // Modal handler functions
    const handleCloseLogin = () => {
        setShowLogin(false);
        // Clear URL parameters
        const url = new URL(window.location);
        url.searchParams.delete('showLogin');
        window.history.replaceState({}, '', url);
    };

    const handleCloseRegister = () => {
        setShowRegister(false);
    };

    const handleSwitchToRegister = () => {
        setShowLogin(false);
        setShowRegister(true);
    };

    const handleSwitchToLogin = () => {
        setShowRegister(false);
        setShowLogin(true);
    };

    const canonicalPath = competitionPath(competitionData || { id: competitionId, name: eventData?.title });
    const competitionDescription =
        eventData.description || eventData.subtitle || `${eventData.title} — a competition on CrwdCtrl.`;

    const aboutText = (() => {
        const raw = (
            eventData?.description
            || ''
        ).trim();
        if (!raw) return '';
        // About = short overview only — drop Team size opener + structure/rules dumps
        let text = raw
            .replace(/^Team size:[^.!\n]*[.!]?\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim();
        const cut = text.search(
            /\bEVENT\s+ST[RU]*CTURE\b|\bCATEGORIES\s*:|\bRULES\s*:|\bRound\s*\d+\s*:/i,
        );
        if (cut > 40) text = text.slice(0, cut).trim();
        return text;
    })();

    const renderAboutBlock = ({ headingClass, bodyClass, className = '' } = {}) => {
        if (!aboutText) return null;
        return (
            <div className={className}>
                <h2 className={headingClass}>About</h2>
                <p className={`${bodyClass} ${showFullAbout ? '' : 'line-clamp-3'}`}>
                    {aboutText}
                </p>
                {aboutText.length > 120 ? (
                    <button
                        type="button"
                        onClick={() => setShowFullAbout((v) => !v)}
                        className="mt-1 text-sm font-semibold text-[#0060DF]"
                    >
                        {showFullAbout ? 'read less' : 'read more'}
                    </button>
                ) : null}
            </div>
        );
    };

    return (
        <div className={`crwdctrl-page flex flex-col min-h-screen pb-28 ${isDark ? 'bg-black' : 'bg-white'}`}>
            <Seo
                title={eventData.title}
                description={competitionDescription}
                canonical={canonicalPath}
                image={eventData.image}
                type="article"
                jsonLd={[
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        ...(festName ? [{ name: festName, path: '/fests' }] : [{ name: 'Fests', path: '/fests' }]),
                        { name: eventData.title, path: canonicalPath },
                    ]),
                    eventSchema({
                        name: eventData.title,
                        description: competitionDescription,
                        url: canonicalPath,
                        image: eventData.image,
                        location: eventData.venue && eventData.venue !== 'TBD' ? eventData.venue : undefined,
                        price: eventData.entryFee,
                        organizerName: festName || undefined,
                        availabilityUrl: canonicalPath,
                    }),
                ]}
            />

            <main
                key={competitionId || eventData?.id || 'competition'}
                className="flex-1 w-full animate-detail-enter"
            >
                    {/* Mobile — full-bleed hero when cover exists; compact chrome otherwise (no empty black box) */}
                    <div className="block md:hidden w-full">
                            <div className="mx-auto w-full flex flex-col flex-1 overflow-x-clip">
                                <div
                                    className={`relative w-full shrink-0 overflow-hidden bg-[#1A1B1D] ${
                                        showHeroImage ? 'h-[396px]' : 'h-52'
                                    }`}
                                >
                                    <CompetitionCoverImage
                                        key={`${competitionId}-${eventData.image || 'placeholder'}`}
                                        src={showHeroImage ? eventData.image : null}
                                        alt={eventData.title || 'Competition'}
                                        preset="hero"
                                        containerClassName="absolute inset-0 w-full h-full"
                                        loaderSize="hero"
                                        eager={showHeroImage}
                                    />
                                    {showHeroImage ? (
                                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-black/30 pointer-events-none" />
                                    ) : null}
                                    <div
                                        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 z-10"
                                        style={{ paddingTop: 'calc(max(var(--safe-top), 0px) + 2.5rem)' }}
                                    >
                                        <button
                                            type="button"
                                            onClick={goBack}
                                            aria-label="Go back"
                                            className="size-11 rounded-full bg-black/40 flex items-center justify-center"
                                        >
                                            <ArrowLeft size={22} strokeWidth={2.25} className="text-white" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleShare('native')}
                                            aria-label="Share"
                                            className="size-11 rounded-full bg-black/40 flex items-center justify-center"
                                        >
                                            <Share2 size={20} strokeWidth={2.25} className="text-white" />
                                        </button>
                                    </div>
                                </div>

                                <div
                                    className={`relative ${showHeroImage ? '-mt-10' : ''} flex-1 rounded-t-3xl z-10 pb-4 overflow-hidden ${
                                        isDark ? 'bg-[#161718]' : 'bg-white'
                                    }`}
                                >
                            {/* Mobile Event Header */}
                            <div className="px-4 pt-5 pb-3">
                                <h1 className={`text-[26px] font-bold leading-8 wrap-break-word mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {eventData.title}
                                </h1>
                                {eventData?.subtitle ? (
                                    <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {eventData.subtitle}
                                    </p>
                                ) : null}
                                {renderAboutBlock({
                                    className: aboutText ? 'mb-3' : '',
                                    headingClass: `text-base font-bold mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`,
                                    bodyClass: `text-sm leading-relaxed text-left ${isDark ? 'text-gray-400' : 'text-gray-600'}`,
                                })}
                                {eventData.feeKnown ? (
                                <div className="mb-1">
                                    <RegistrationFeeLines
                                        tiers={eventData.feeTiers}
                                        feeLabel={eventData.feeLabel}
                                        feeIsFree={eventData.feeIsFree}
                                        isDark={isDark}
                                    />
                                </div>
                                ) : null}
                            </div>

                            {/* Mobile Event Details */}
                            <div className="px-4 py-2">
                                {(eventData.date || eventData.venue) && (
                                <div className="space-y-2 mb-4">
                                    {eventData.date ? (
                                    <div className="flex items-center gap-2 text-blue-600">
                                        <img src={CalendarIcon} alt="Calendar" className={`w-4 h-4 ${isDark ? 'filter invert' : ''}`} />
                                        <span className="text-sm">{eventData.date}{eventData.time ? ` | ${eventData.time}` : ''}</span>
                                    </div>
                                    ) : null}
                                    {eventData.venue && eventData.venue !== 'TBD' ? (
                                    <div className="flex items-center gap-2 text-blue-600">
                                        <img src={LocationIcon} alt="Location" className={`w-4 h-4 ${isDark ? 'filter invert' : ''}`} />
                                        <span className="text-sm">{eventData.venue}</span>
                                    </div>
                                    ) : null}
                                </div>
                                )}
                            </div>

                            {/* Prize pool — classic medal podium (all fest competitions) */}
                            {eventData?.prize && !/^(tbd|tba|n\/a|na|-|subject to change)$/i.test(String(eventData.prize).trim()) && (
                                <div className="px-4 pb-2">
                                    <PrizePoolPodium
                                      prizeText={eventData.prize}
                                      isDark={isDark}
                                      compact
                                    />
                                </div>
                            )}

                            {/* Mobile Competition Rounds — hidden when no real round content */}
                            {showCompetitionRounds && (
                            <div className="px-4 py-5">
                                <div className={`${isDark ? 'bg-[#111213]' : 'bg-white'} rounded-xl p-4 sm:p-5 shadow-sm`}>
                                    <h2 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Competition Rounds</h2>

                                    {/* Mobile Round Tabs - Dynamic based on available rounds */}
                                    {roundsList.length > 1 && !festName?.toLowerCase().includes('symbi') && (
                                        <div className={`grid gap-2 mb-4 mt-4`} style={{ gridTemplateColumns: `repeat(${Math.min(roundsList.length, 5)}, 1fr)` }}>
                                            {roundsList.map((round, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setActiveRound(idx)}
                                                    className={`py-3 px-3 rounded-lg font-medium transition text-sm ${activeRound === idx
                                                        ? `border-2 border-[#00C2CB] ${isDark ? 'bg-dark-700 text-white' : 'bg-blue-50 text-black'}`
                                                        : `${isDark ? 'bg-dark-700 text-gray-300' : 'bg-gray-100 text-black'}`
                                                        }`}
                                                >
                                                    {getRoundTabLabel(round, idx, roundsList.length)}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Mobile Round Content */}
                                    <div className="mt-4">
                                        {renderActiveRoundBody('mobile')}
                                    </div>
                                </div>
                            </div>
                            )}

                            {/* Mobile Common Rules */}
                            {commonRules.length > 0 ? (
                            <div className="px-4 py-5">
                                <div className={`${isDark ? 'bg-[#111213]' : 'bg-white'} rounded-xl p-4 sm:p-5 shadow-sm`}>
                                    <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Rules and Guidelines</h2>
                                    <RulesList
                                        rules={commonRules}
                                        ruleKey={`mobile-common-rules-${eventData?.id}`}
                                        maxItems={3}
                                    />
                                </div>
                            </div>
                            ) : null}

                            {/* Mobile Contact Details */}
                            {contactList.length > 0 ? (
                            <section className="px-4 mb-8">
                                <h2 className={`text-base font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Details</h2>
                                <ContactDetailsBox />
                            </section>
                            ) : null}
                                </div>
                            </div>
                        </div>

                        {/* Desktop/Laptop Layout - Visible at 768px and above */}
                        <div
                            className="hidden md:flex md:flex-row gap-8 p-6"
                        >
                            {/* Left Column - Image and Rules */}
                            <div className="w-1/2 shrink-0 space-y-6">
                                {/* Event Image Card — 3D trophy when cover missing or loading */}
                                <div className={`rounded-3xl overflow-hidden shadow-sm ${isDark ? 'bg-[#111213]' : 'bg-white'} p-2`}>
                                    <div className="rounded-2xl overflow-hidden bg-[#1A1B1D] h-80">
                                    <CompetitionCoverImage
                                        key={`${competitionId}-${eventData.image || 'placeholder'}`}
                                        src={showHeroImage ? eventData.image : null}
                                        alt={eventData.title || 'Competition'}
                                        preset="hero"
                                        containerClassName="w-full h-full"
                                        className="w-full h-full object-cover animate-detail-enter"
                                        loaderSize="hero"
                                        eager={showHeroImage}
                                    />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Desktop Prize Pool — classic medal podium (all fest competitions) */}
                                    {eventData?.prize && !/^(tbd|tba|n\/a|na|-|subject to change)$/i.test(String(eventData.prize).trim()) && (
                                        <PrizePoolPodium
                                          prizeText={eventData.prize}
                                          isDark={isDark}
                                        />
                                    )}

                                    {/* Common Rules */}
                                    {commonRules.length > 0 ? (
                                    <div className={`${isDark ? 'bg-[#111213]' : 'bg-[#EDEDF2]'} rounded-2xl p-6`}>
                                        <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Rules and Guidelines</h2>
                                        <RulesList
                                            rules={commonRules}
                                            ruleKey={`desktop-common-rules-${eventData?.id}`}
                                            maxItems={5}
                                        />
                                    </div>
                                    ) : null}
                                </div>

                                {/* Contact Details */}
                                {contactList.length > 0 ? (
                                <div>
                                    <h3 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Details</h3>
                                    <ContactDetailsBox />
                                </div>
                                ) : null}
                            </div>

                            {/* Right Column - Event Details */}
                            <div className="w-1/2 shrink-0 space-y-6">
                                {/* Event Header Card */}
                                <div className={`${isDark ? 'bg-[#111213]' : 'bg-[#EDEDF2]'} rounded-2xl p-6 relative`}>
                                    {showRegistrationSuccess && (
                                        <div className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 animate-fade-in z-10">
                                            <Check className="w-4 h-4" />
                                            <span className="text-sm">Registered Successfully!</span>
                                        </div>
                                    )}

                                    <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{eventData.title}</h1>
                                    {eventData.subtitle ? (
                                    <p className={`mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{eventData.subtitle}</p>
                                    ) : null}

                                    {renderAboutBlock({
                                        className: aboutText ? 'mb-4' : '',
                                        headingClass: `text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`,
                                        bodyClass: `text-sm leading-relaxed text-left ${isDark ? 'text-gray-300' : 'text-gray-600'}`,
                                    })}

                                    {eventData.feeKnown ? (
                                        <div className="mb-4">
                                            <RegistrationFeeLines
                                                tiers={eventData.feeTiers}
                                                feeLabel={eventData.feeLabel}
                                                feeIsFree={eventData.feeIsFree}
                                                isDark={isDark}
                                            />
                                        </div>
                                    ) : null}

                                    {(eventData.date || (eventData.venue && eventData.venue !== 'TBD')) && (
                                    <div className="space-y-2 mb-4">
                                        {eventData.date ? (
                                        <div className="flex items-center gap-2 text-blue-600">
                                            <img src={CalendarIcon} alt="Calendar" className={`w-4 h-4 ${isDark ? 'filter invert' : ''}`} />
                                            <span className="text-sm">{eventData.date}{eventData.time ? ` | ${eventData.time}` : ''}</span>
                                        </div>
                                        ) : null}
                                        {eventData.venue && eventData.venue !== 'TBD' ? (
                                        <div className="flex items-center gap-2 text-blue-600">
                                            <img src={LocationIcon} alt="Location" className={`w-4 h-4 ${isDark ? 'filter invert' : ''}`} />
                                            <span className="text-sm">{eventData.venue}</span>
                                        </div>
                                        ) : null}
                                    </div>
                                    )}

                                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,24rem)_auto] gap-x-3 gap-y-1.5 mb-4 items-center">
                                        <div aria-hidden />
                                        <RegisterMetaChips
                                            isDark={isDark}
                                            slotsLabel={formatSlotsLabel(
                                                eventData.slotsAllotted,
                                                eventData.slotsLeft,
                                                { showSlotsPublic: eventData.showSlotsPublic },
                                            )}
                                            teamLabel={buildTeamSizeLabel(eventData.teamSizeMin, eventData.teamSizeMax)}
                                        />
                                        <div className="w-11" aria-hidden />

                                        {eventData.feeKnown ? (
                                            <div className="min-w-0 flex flex-col justify-center h-14">
                                                {!eventData.feeIsFree && compactRegisterMinAmount(eventData.feeTiers) != null ? (
                                                    <p className={`text-sm font-semibold leading-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>From</p>
                                                ) : null}
                                                {eventData.feeIsFree ? (
                                                    <p className="mt-1 text-xl font-bold tabular-nums leading-none text-green-500">Free</p>
                                                ) : (
                                                    <p className={`mt-1 text-xl font-bold tabular-nums leading-none truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                        {compactRegisterMinAmount(eventData.feeTiers) != null
                                                            ? `₹${compactRegisterMinAmount(eventData.feeTiers).toLocaleString('en-IN')}`
                                                            : eventData.feeLabel}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div />
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleRegister}
                                            disabled={registrationInfo.isDisabled}
                                            className={`w-full flex items-center justify-center gap-2 h-14 px-5 rounded-2xl text-base font-semibold shadow-md transition ${
                                                registrationInfo.isDisabled
                                                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                                                    : 'bg-[#0ECCEE] text-black active:opacity-90'
                                            }`}
                                            title={registrationInfo.isDisabled ? registrationInfo.buttonText : ''}
                                        >
                                            <>
                                                {registrationInfo.buttonText}
                                                {!registrationInfo.isDisabled ? (
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="m9 18 6-6-6-6" />
                                                    </svg>
                                                ) : null}
                                            </>
                                        </button>

                                        <div className="relative shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setShowShareMenu(!showShareMenu)}
                                                className={`h-14 w-11 rounded-full flex items-center justify-center transition ${
                                                    isDark ? 'bg-dark-700 hover:bg-dark-600' : 'bg-gray-100 hover:bg-gray-200'
                                                }`}
                                            >
                                                <img src={ShareIcon} alt="Share" className="w-5 h-5" />
                                            </button>
                                            {showShareMenu && (
                                                <div className={`absolute right-0 bottom-full mb-2 w-48 rounded-lg shadow-lg z-20 ${isDark ? 'bg-dark-700' : 'bg-white'} border ${isDark ? 'border-dark-600' : 'border-gray-200'}`}>
                                                    <div className="py-2">
                                                        <button type="button" onClick={() => handleShare('whatsapp')} className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-blue-500 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                            Share on WhatsApp
                                                        </button>
                                                        <button type="button" onClick={() => handleShare('facebook')} className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-blue-500 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                            Share on Facebook
                                                        </button>
                                                        <button type="button" onClick={() => handleShare('twitter')} className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-blue-500 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                            Share on Twitter
                                                        </button>
                                                        <button type="button" onClick={() => handleShare('copy')} className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-blue-500 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                            Copy Link
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Warning: Form Not Configured */}
                                    {registrationInfo.notConfigured && (
                                        <div className={`mt-4 p-4 rounded-lg border ${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'}`}>
                                            <div className="flex items-start gap-3">
                                                <span className="text-yellow-500 text-lg">⚠️</span>
                                                <div>
                                                    <p className={`font-semibold ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>Registration Form Not Ready</p>
                                                    <p className={`text-sm mt-1 ${isDark ? 'text-yellow-200/80' : 'text-yellow-700'}`}>
                                                        This competition's registration form hasn't been set up yet. Please contact the organizers to complete the configuration.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Competition Rounds — hidden when no real round content */}
                                {showCompetitionRounds && (
                                <div className={`${isDark ? 'bg-[#111213]' : 'bg-[#EDEDF2]'} rounded-2xl p-6`}>
                                    <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{eventData?.title || 'Competition'} Rounds</h2>

                                    {/* Desktop Round Tabs - Dynamic based on available rounds */}
                                    {roundsList.length > 1 && !festName?.toLowerCase().includes('symbi') && (
                                        <div className="grid gap-2 mb-6" style={{ gridTemplateColumns: `repeat(${Math.min(roundsList.length, 5)}, 1fr)` }}>
                                            {roundsList.map((round, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setActiveRound(idx)}
                                                    className={`flex-1 py-2 px-4 rounded-2xl font-medium transition ${activeRound === idx
                                                        ? `border-2 border-[#00C2CB] ${isDark ? 'bg-dark-700 text-white' : 'bg-[#EDEDF2] text-black'}`
                                                        : `shadow-md ${isDark ? 'bg-dark-700 text-gray-300' : 'bg-[#EDEDF2] text-black'}`
                                                        }`}
                                                >
                                                    {getRoundTabLabel(round, idx, roundsList.length)}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-2">
                                        {renderActiveRoundBody('desktop')}
                                    </div>
                                </div>
                                )}
                            </div>
                        </div>
                </main>

                <div className="md:hidden h-32" aria-hidden="true" />

            {typeof document !== 'undefined' && createPortal(
            <div
                className="fixed inset-x-0 bottom-0 z-100040 md:hidden px-2 pointer-events-none"
                style={{ paddingBottom: 'max(var(--safe-bottom), 6px)' }}
            >
                <div className={`pointer-events-auto mx-auto w-full max-w-md rounded-[28px] px-4 py-3 ${isDark ? 'bg-[#111213] shadow-lg' : 'bg-white shadow-[0_-2px_20px_rgba(0,0,0,0.15)] border border-gray-100'}`}>
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,20rem)] gap-x-3 gap-y-1.5 items-center">
                        <div aria-hidden />
                        <RegisterMetaChips
                            isDark={isDark}
                            slotsLabel={formatSlotsLabel(
                                eventData.slotsAllotted,
                                eventData.slotsLeft,
                                { showSlotsPublic: eventData.showSlotsPublic },
                            )}
                            teamLabel={buildTeamSizeLabel(eventData.teamSizeMin, eventData.teamSizeMax)}
                        />

                        {eventData.feeKnown ? (
                            <RegisterFeeLabel
                                isDark={isDark}
                                feeLabel={eventData.feeLabel}
                                feeIsFree={eventData.feeIsFree}
                                feeTiers={eventData.feeTiers}
                            />
                        ) : (
                            <div />
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                trackBookNowClick({
                                    entityType: 'competition',
                                    entityId: eventData?.id || '',
                                    mode: eventData?.registrationType || 'fest',
                                    destination: 'competition_register',
                                });
                                handleRegister();
                            }}
                            disabled={registrationInfo.isDisabled}
                            className={`w-full flex items-center justify-center gap-1.5 h-14 px-3 rounded-2xl text-base font-semibold shadow-md transition ${
                                registrationInfo.isDisabled
                                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                                    : 'bg-[#0ECCEE] text-black active:opacity-90'
                            }`}
                        >
                            <>
                                {registrationInfo.buttonText}
                                {!registrationInfo.isDisabled ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                ) : null}
                            </>
                        </button>
                    </div>
                </div>
            </div>,
            document.body,
            )}

            {/* Login Modal */}
            {showLogin && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlLogin
                        googleOnly
                        title="Sign in to register"
                        subtitle="One tap with Google — then finish registration"
                        onClose={handleCloseLogin}
                    />
                </div>
            )}

            {/* Register Modal */}
            {showRegister && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlRegister onClose={handleCloseRegister} onSwitchToLogin={handleSwitchToLogin} />
                </div>
            )}
        </div>
    );
}

export default EventPage;


