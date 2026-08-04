import React, { useState, useEffect } from 'react';
import { Phone, Instagram, Check, Moon, Sun, Mail, ArrowLeft, Trophy, Ticket, Zap, Share2 } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import Navbar from '../../components/layout/Navbar';
import ProfileSidebar from '../../components/layout/ProfileSidebar';
import { useDarkMode } from '../../context/DarkModeContext';
import { useDialog } from '../../context/DialogContext';
import { useRegisteredEvents } from '../../context/RegisteredEventsContext';
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
import { competitionPath, competitionRegistrationPath, festRegisterPath, festPath } from '../../utils/slugRoutes';
import { resolveCompetitionFee } from '../../utils/festPublicTransform';
import { trackBookNowClick } from '../../services/analyticsService';

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

const buildCompetitionData = (compData, options = {}) => {
    if (!compData) return null;

    const roundsSource = Array.isArray(compData.rounds) ? compData.rounds : [];
    const roundsObject = !Array.isArray(compData.rounds) && compData.rounds ? compData.rounds : null;
    const roundsListSource = Array.isArray(roundsObject?.roundsList) ? roundsObject.roundsList : roundsSource;

    const fee = resolveCompetitionFee(compData);

    return {
        id: compData._id || compData.id,
        title: compData.name || compData.title || 'Competition',
        subtitle: sanitizeRoundDescription(compData.subtitle || compData.description || ''),
        date: compData.dateTime || compData.date || '',
        time: compData.time || '',
        venue: compData.venue || 'TBD',
        entryFee: fee.known ? fee.label : (compData.registrationFee || compData.entryFee || 'Free'),
        feeAmount: fee.amount ?? 0,
        feeLabel: fee.known ? fee.label : '—',
        feeIsFree: fee.isFree,
        feeKnown: fee.known,
        prize: compData.prizePool || compData.prize || 'TBD',
        image: compData.coverImage || compData.image,
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

        rounds: {
            description: sanitizeRoundDescription(roundsObject?.description || roundsSource?.[0]?.description || ''),
            list: Array.isArray(roundsObject?.list)
                ? roundsObject.list
                : roundsSource.map((round) => round?.title || round?.description).filter(Boolean),
            roundsList: (roundsListSource || []).map((round, i) => ({
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
            }))
        }
    };
};

function EventPage() {
    const { competitionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeRound, setActiveRound] = useState(0);
    const [showRegistrationSuccess] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [expandedRules, setExpandedRules] = useState({});
    const [competitionData, setCompetitionData] = useState(null);
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { isDark } = useDarkMode();
    const { alert: showAlert, toast } = useDialog();
    const { registeredEvents } = useRegisteredEvents();
    const { isAuthenticated } = useAuth();

    // Fetch competition data from backend API
    useEffect(() => {
        const fetchCompetitionData = async () => {
            if (!competitionId) {
                // If no competitionId in URL, check if data was passed via navigation state
                const stateCompetition = location.state?.competition;
                if (stateCompetition) {
                    console.log('Using competition data from navigation state:', stateCompetition);
                    setCompetitionData(buildCompetitionData(stateCompetition));
                    setLoading(false);
                    return;
                }
                
                console.log('No competitionId and no state data, redirecting to dashboard');
                navigate('/');
                return;
            }

            try {
                setLoading(true);
                setError(null);
                
                console.log('ViewDetails - Fetching competition data for ID:', competitionId);
                console.log('ViewDetails - API URL:', resolveUrl(`/fests/competitions/${competitionId}/public`));
                
                // Try to fetch competition data from backend
                // Force fresh data by bypassing browser cache and PWA service worker cache
                const timestamp = Date.now();
                const response = await fetchJSON(`/fests/competitions/${competitionId}/public?t=${timestamp}`, {
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });
                console.log('ViewDetails - API Response Status: OK');
                console.log('ViewDetails - API Response Data:', response.data);
                
                const compData = response.data;
                console.log('🔍 Raw competition data from API:', compData);
                console.log('🔍 Registration type:', compData.registrationType);
                console.log('🔍 Registration status:', compData.registration?.status);
                console.log('🔍 Full registration object:', compData.registration);

                if (compData) {
                    setCompetitionData(buildCompetitionData(compData, { useFestRegistrationFallback: true }));
                } else {
                    setError('Competition not found');
                }
            } catch (err) {
                console.error('Error fetching competition data:', err);
                console.error('Error details:', {
                    message: err.message,
                    status: err.response?.status,
                    statusText: err.response?.statusText,
                    data: err.response?.data
                });
                
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
                
                // Fallback to navigation state if API fails
                const stateCompetition = location.state?.competition;
                if (stateCompetition) {
                    console.log('API failed, using competition data from navigation state:', stateCompetition);
                    setCompetitionData(buildCompetitionData(stateCompetition));
                } else {
                    setError(errorMessage);
                    console.log('No fallback data available, showing error:', errorMessage);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchCompetitionData();
    }, [competitionId, navigate, location.state]);

    // 🔄 Listen for admin updates and refetch data
    useEffect(() => {
        const handleAdminUpdate = () => {
            // Only refetch if we have a competitionId
            if (competitionId) {
                console.log('🔄 Admin update detected - refetching competition details');
                // Refetch the competition data with cache busting
                const fetchUpdatedData = async () => {
                    try {
                        const timestamp = Date.now();
                        const response = await fetchJSON(`/fests/competitions/${competitionId}/public?t=${timestamp}`);
                        const compData = response.data;

                        if (compData) {
                            setCompetitionData(buildCompetitionData(compData, { useFestRegistrationFallback: true }));
                            console.log('Competition data updated from admin changes');
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
                console.log('🔄 Admin update detected (cross-tab) - refetching competition details');
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
        console.log('🔄 [VIEW-DETAILS] Auth state check:', { isAuthenticated, showLogin, showRegister });
        
        if (isAuthenticated && showLogin) {
            console.log('✅ [VIEW-DETAILS] User authenticated, closing login modal');
            setShowLogin(false);
            // Clear URL parameters
            const url = new URL(window.location);
            url.searchParams.delete('showLogin');
            window.history.replaceState({}, '', url);
        }
        if (isAuthenticated && showRegister) {
            console.log('✅ [VIEW-DETAILS] User authenticated, closing register modal');
            setShowRegister(false);
        }
    }, [isAuthenticated, showLogin, showRegister]);

    // Loading state
    if (loading) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Loading competition...</h2>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !competitionData) {
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

    // Function to get round rules (merge nested offline/online — no separate mode labels)
    const getRoundRules = (roundData) => {
        if (!roundData) return [];

        if (roundData.roundRulesMessage && roundData.roundRulesMessage.trim()) {
            return [sanitizeRoundDescription(roundData.roundRulesMessage)];
        }

        const merged = [
            ...sanitizeRulesArray(roundData.rules || []),
            ...sanitizeRulesArray(roundData.offline?.rules || []),
            ...sanitizeRulesArray(roundData.online?.rules || []),
        ];
        // Dedupe while preserving order
        return [...new Set(merged.map((r) => String(r).trim()).filter(Boolean))];
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
        const isLast = totalRounds > 1 && idx === totalRounds - 1;
        if (isLast || /^final\s*rounds?$/i.test(title)) return 'Final';
        if (title && !/^(offline|online)\s*rounds?$/i.test(title) && !/^rounds?\s*\d+$/i.test(title)) {
            return title;
        }
        return `Round ${idx + 1}`;
    };

    const commonRules = getCommonRules();

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
        return [{
            name: c.name || '',
            role: c.role || '',
            email: c.email || '',
            phone: c.phone || '',
            instagramId: instagramId.replace(/^@/, ''),
        }];
    })();

    const isRegistered = registeredEvents.some(event => event.id === eventData?.id);

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
        
        console.log('🔍 Form configuration check:', {
            formType,
            isCustomForm: true,
            hasFormFields,
            singleStepLength: eventData?.registration?.formSchema?.length || 0,
            multiStepCount: eventData?.registration?.steps?.length || 0,
            multiStepFields: eventData?.registration?.steps?.map(s => ({ 
                stepNumber: s.stepNumber, 
                fieldsCount: s.fields?.length || 0 
            }))
        });
        
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

        // Competition-level "not open yet" / closed always wins
        if (registrationStatus === 'not_started') {
            return closedResult('Registration Not Open Yet');
        }
        if (registrationStatus === 'registration_closed') {
            return closedResult('Registration Closed');
        }
        if (legacyStatus === 'NOT_STARTED') {
            // Only block legacy when competition status isn't explicitly open
            if (!['external_link', 'internal_form', 'started'].includes(registrationStatus)) {
                return closedResult('Registration Not Open Yet');
            }
        }
        if (legacyStatus === 'CLOSED') {
            return closedResult('Registration Closed');
        }

        // Parent fest still not open → keep all comps closed
        if (festMode === 'NOT_STARTED') {
            return closedResult('Registration Not Open Yet');
        }
        if (festMode === 'CLOSED') {
            return closedResult('Registration Closed');
        }

        if (registrationType === 'fest') {
            const mode = festMode || 'NOT_STARTED';
            return {
                isAvailable: mode === 'EXTERNAL_LINK' || mode === 'INTERNAL_FORM',
                buttonText: mode === 'NOT_STARTED' ? 'Registration Not Open Yet'
                    : mode === 'CLOSED' ? 'Registration Closed' : 'Register Now',
                isDisabled: mode === 'NOT_STARTED' || mode === 'CLOSED',
            };
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
        if (!isAuthenticated) {
            setShowLogin(true);
            return;
        }

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
                title: statusInfo.buttonText === 'Registration Closed' ? 'Registration closed' : 'Registration not open yet',
                message: statusInfo.buttonText === 'Registration Closed'
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
                navigate(festRegisterPath(eventData?.fest || { _id: eventData?.festId }), {
                    state: { festId: eventData?.festId || eventData?.fest?._id, competitionId: eventData?.id },
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
                navigate(competitionRegistrationPath(eventData || { id: competitionId }));
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
        const normalizedRules = (rules || [])
            .map((rule) => (typeof rule === 'string' ? sanitizeRoundDescription(rule).trim() : ''))
            .filter((rule) => rule.length > 0);
        
        // Check if this is a message field (single item with line breaks)
        const isMessageField = normalizedRules.length === 1 && normalizedRules[0].includes('\n');
        
        // For message fields, check character length; for rule arrays, check item count
        const shouldTruncate = isMessageField 
            ? normalizedRules[0].length > 300  // Truncate if message is longer than 300 characters
            : normalizedRules.length > maxItems;
            
        const displayRules = shouldTruncate && !isExpanded 
            ? (isMessageField 
                ? [normalizedRules[0].substring(0, 300) + '...'] 
                : normalizedRules.slice(0, maxItems))
            : normalizedRules;

        const toggleExpanded = () => {
            setExpandedRules(prev => ({
                ...prev,
                [ruleKey]: !prev[ruleKey]
            }));
        };

        return (
            <div>
                <div className={`space-y-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {displayRules?.map((rule, index) => {
                        // Check if this is a message field (single item with formatting)
                        const isCurrentMessageField = displayRules.length === 1 && rule.includes('\n');
                        
                        if (isCurrentMessageField) {
                            return (
                                <div 
                                    key={index} 
                                    className="leading-relaxed whitespace-pre-wrap"
                                    style={{ whiteSpace: 'pre-wrap' }}
                                >
                                    {rule}
                                </div>
                            );
                        } else {
                            return (
                                <div key={index} className="leading-relaxed">
                                    • {rule}
                                </div>
                            );
                        }
                    }) || <div>Rules will be updated soon</div>}
                </div>
                {shouldTruncate && (
                    <button
                        onClick={toggleExpanded}
                        className={`mt-3 text-sm font-medium transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
                            }`}
                    >
                        {isExpanded 
                            ? 'Read Less' 
                            : (isMessageField 
                                ? 'Read More' 
                                : `Show More (${normalizedRules.length - maxItems} more rules)`)}
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

    return (
        <div className={`crwdctrl-page flex flex-col min-h-screen pb-28 transition-colors ${isDark ? 'bg-[#0c0d0e]' : 'bg-white'}`}>
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

            <main className="flex-1 w-full">
                    {/* Mobile — full-bleed hero (no side gutters) */}
                    <div className="block md:hidden w-full">
                            <div className="mx-auto w-full flex flex-col flex-1 overflow-x-clip">
                                <div className="relative w-full h-[396px] shrink-0 overflow-hidden bg-[#1A1B1D]">
                                    <img
                                        src={getImageUrl(eventData?.image, { preset: 'hero' }) || '/default-image.jpg'}
                                        alt={eventData?.title || 'Competition'}
                                        className="absolute inset-0 w-full h-full object-cover content-image"
                                        loading="eager"
                                        fetchPriority="high"
                                        decoding="async"
                                        onError={(e) => {
                                            e.target.src = '/default-image.jpg';
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-black/30 pointer-events-none" />
                                    <div
                                        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 z-10"
                                        style={{ paddingTop: 'calc(max(env(safe-area-inset-top), 0px) + 2.5rem)' }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const fest = eventData?.fest;
                                                if (fest?._id || fest?.id || eventData?.festId) {
                                                    navigate(festPath(fest || { _id: eventData.festId }), { replace: true });
                                                    return;
                                                }
                                                navigate('/fests', { replace: true });
                                            }}
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

                                <div className={`relative -mt-10 flex-1 rounded-t-3xl z-10 pb-4 overflow-hidden ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
                            {/* Mobile Event Header */}
                            <div className="px-4 pt-5 pb-3">
                                <h1 className={`text-[26px] font-bold leading-8 wrap-break-word mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {eventData?.title || 'Competition Title'}
                                </h1>
                                {eventData?.subtitle ? (
                                    <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {eventData.subtitle}
                                    </p>
                                ) : null}
                                <div className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    <p>
                                        <span className="font-semibold">Registration fee: </span>
                                        <span className={`font-bold ${eventData?.feeIsFree ? 'text-green-500' : 'text-[#0ECCEE]'}`}>
                                            {eventData?.feeLabel || (eventData?.feeAmount > 0 ? `₹${Number(eventData.feeAmount).toLocaleString('en-IN')}` : 'Free')}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            {/* Mobile Event Details */}
                            <div className="px-4 py-2">
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-blue-600">
                                        <img src={CalendarIcon} alt="Calendar" className={`w-4 h-4 ${isDark ? 'filter invert' : ''}`} />
                                        <span className="text-sm">{eventData?.date || 'TBD'} {eventData?.time && `| ${eventData.time}`}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-blue-600">
                                        <img src={LocationIcon} alt="Location" className={`w-4 h-4 ${isDark ? 'filter invert' : ''}`} />
                                        <span className="text-sm">{eventData?.venue || 'TBD'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Registration Button - Hidden, using fixed footer instead */}
                            <div className="hidden px-4 py-4">
                                <div className="flex gap-2 relative">
                                    <button
                                        onClick={handleRegister}
                                        disabled={registrationInfo.isDisabled}
                                        className={`flex-1 py-3 px-4 rounded-full font-semibold transition ${isRegistered
                                            ? 'bg-green-500 text-white hover:opacity-90'
                                            : registrationInfo.isDisabled
                                            ? 'bg-gray-500 text-white cursor-not-allowed opacity-60'
                                            : 'bg-linear-to-r from-[#0060DF] to-[#00C2CB] text-white hover:opacity-90'
                                            }`}
                                        title={registrationInfo.isDisabled ? registrationInfo.buttonText : ''}
                                    >
                                        {isRegistered ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <Check className="w-4 h-4" />
                                                Register Again
                                            </span>
                                        ) : (
                                            registrationInfo.buttonText
                                        )}
                                    </button>
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowShareMenu(!showShareMenu)}
                                            className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isDark ? 'bg-dark-700 hover:bg-dark-600' : 'bg-gray-100 hover:bg-gray-200'
                                                }`}
                                        >
                                            <img src={ShareIcon} alt="Share" className="w-5 h-5" />
                                        </button>

                                        {showShareMenu && (
                                            <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-20 ${isDark ? 'bg-dark-700' : 'bg-white'
                                                } border ${isDark ? 'border-dark-600' : 'border-gray-200'}`}>
                                                <div className="py-2">
                                                    <button
                                                        onClick={() => handleShare('whatsapp')}
                                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-blue-500 ${isDark ? 'text-gray-200' : 'text-gray-700'
                                                            }`}
                                                    >
                                                        Share on WhatsApp
                                                    </button>
                                                    <button
                                                        onClick={() => handleShare('facebook')}
                                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-blue-500 ${isDark ? 'text-gray-200' : 'text-gray-700'
                                                            }`}
                                                    >
                                                        Share on Facebook
                                                    </button>
                                                    <button
                                                        onClick={() => handleShare('twitter')}
                                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-blue-500 ${isDark ? 'text-gray-200' : 'text-gray-700'
                                                            }`}
                                                    >
                                                        Share on Twitter
                                                    </button>
                                                    <button
                                                        onClick={() => handleShare('copy')}
                                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-blue-500 ${isDark ? 'text-gray-200' : 'text-gray-700'
                                                            }`}
                                                    >
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
                            
                            {/* Mobile Prize Pool Highlight Card */}
                            {eventData?.prize && (
                                <div className="px-4 py-4">
                                    <div className={`relative overflow-hidden rounded-2xl border ${isDark ? 'bg-[#111213] border-[#00C2CB]/20' : 'bg-white border-[#0060DF]/20'}`}>
                                        <div className="absolute inset-0 bg-linear-to-br from-[#0060DF]/6 via-[#00C2CB]/4 to-transparent pointer-events-none" />
                                        <div className="relative p-4">
                                            <div className="flex items-center gap-2.5 mb-3">
                                                <div className="w-8 h-8 rounded-xl bg-linear-to-br from-[#0060DF] to-[#00C2CB] flex items-center justify-center shadow-md shadow-[#00C2CB]/30">
                                                    <Trophy className="w-4 h-4 text-white" />
                                                </div>
                                                <h2 className="text-xs font-bold uppercase tracking-widest text-[#00C2CB]">Prize Pool</h2>
                                            </div>
                                            <div
                                                className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}
                                                style={{ whiteSpace: 'pre-wrap' }}
                                            >
                                                {eventData.prize}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* Mobile Competition Rounds - Only show if rounds exist */}
                            {eventData?.rounds?.roundsList?.length > 0 && (
                            <div className="px-4 py-4">
                                <div className={`${isDark ? 'bg-[#111213]' : 'bg-white'} rounded-lg p-4 shadow-sm`}>
                                    <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Competition Rounds</h2>
                                    {eventData?.rounds?.description && (() => {
                                        const desc = sanitizeRoundDescription(eventData.rounds.description);

                                        return (
                                            <div className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                <div 
                                                    className="whitespace-pre-wrap"
                                                    style={{ whiteSpace: 'pre-wrap' }}
                                                >
                                                    {desc}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Mobile Round Tabs - Dynamic based on available rounds */}
                                    {eventData.rounds.roundsList.length > 1 && !festName?.toLowerCase().includes('symbi') && (
                                        <div className={`grid gap-2 mb-4 mt-4`} style={{ gridTemplateColumns: `repeat(${Math.min(eventData.rounds.roundsList.length, 5)}, 1fr)` }}>
                                            {eventData.rounds.roundsList.map((round, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setActiveRound(idx)}
                                                    className={`py-3 px-3 rounded-lg font-medium transition text-sm ${activeRound === idx
                                                        ? `border-2 border-[#00C2CB] ${isDark ? 'bg-dark-700 text-white' : 'bg-blue-50 text-black'}`
                                                        : `${isDark ? 'bg-dark-700 text-gray-300' : 'bg-gray-100 text-black'}`
                                                        }`}
                                                >
                                                    {getRoundTabLabel(round, idx, eventData.rounds.roundsList.length)}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Mobile Round Content */}
                                    <div className="space-y-4">
                                        {(() => {
                                            const round = eventData.rounds.roundsList[activeRound];
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

                                            const displayTitle = getRoundDisplayTitle(
                                                round,
                                                activeRound,
                                                eventData.rounds.roundsList.length,
                                            );
                                            const roundRules = getRoundRules(round);

                                            return (
                                                <>
                                                    {cleanedRoundDescription && !isDuplicateOfOverview && (
                                                        <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                            {cleanedRoundDescription}
                                                        </p>
                                                    )}

                                                    {displayTitle ? (
                                                        <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {displayTitle}
                                                        </h3>
                                                    ) : null}

                                                    {roundRules.length > 0 && (
                                                        <div className={`${isDark ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-4`}>
                                                            <RulesList
                                                                rules={roundRules}
                                                                ruleKey={`mobile-round${activeRound}-${eventData?.id}`}
                                                                maxItems={5}
                                                            />
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                            )}

                            {/* Mobile Common Rules */}
                            <div className="px-4 py-4">
                                <div className={`${isDark ? 'bg-[#111213]' : 'bg-white'} rounded-lg p-4 shadow-sm`}>
                                    <h2 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Rules and Guidelines</h2>
                                    <RulesList
                                        rules={commonRules}
                                        ruleKey={`mobile-common-rules-${eventData?.id}`}
                                        maxItems={3}
                                    />
                                </div>
                            </div>

                            {/* Mobile Contact Details — same layout as fest view-details */}
                            {contactList.length > 0 ? (
                            <section className={`px-4 mb-8 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
                                <h2 className={`text-base font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Details</h2>
                                <div className="space-y-3">
                                    {contactList.map((contact, index) => (
                                        <div
                                            key={index}
                                            className={`rounded-xl p-3 ${isDark ? 'bg-[#1f2021]' : 'bg-gray-100'}`}
                                        >
                                            {(contact.name || contact.role) && (
                                                <div className="mb-2">
                                                    <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                        {contact.name || 'Contact Person'}
                                                    </span>
                                                    {contact.role && (
                                                        <span className={`text-xs ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                            - {contact.role}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                {contact.phone && contact.phone.split(/\s*(?:,|\/)\s*/).filter(Boolean).map((entry, pi) => {
                                                    const nameMatch = entry.match(/\(([^)]+)\)/);
                                                    const name = nameMatch ? nameMatch[1].trim() : null;
                                                    const rawNumber = entry.replace(/\s*\([^)]*\)/, '').trim();
                                                    return (
                                                        <a
                                                            key={pi}
                                                            href={`tel:${rawNumber.replace(/[\s-]/g, '')}`}
                                                            className="flex items-center gap-2.5"
                                                        >
                                                            <span className="size-9 shrink-0 rounded-full bg-[#0060DF] flex items-center justify-center">
                                                                <Phone size={16} className="text-white" />
                                                            </span>
                                                            <span className="min-w-0">
                                                                {name && (
                                                                    <span className={`block text-[11px] leading-tight ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                        {name}
                                                                    </span>
                                                                )}
                                                                <span className={`block text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                                    {rawNumber}
                                                                </span>
                                                            </span>
                                                        </a>
                                                    );
                                                })}

                                                {contact.instagramId && (
                                                    <a
                                                        href={`https://instagram.com/${contact.instagramId.replace('@', '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2.5"
                                                    >
                                                        <span className="size-9 shrink-0 rounded-full bg-linear-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] flex items-center justify-center">
                                                            <Instagram size={16} className="text-white" />
                                                        </span>
                                                        <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                            {contact.instagramId.startsWith('@') ? contact.instagramId : `@${contact.instagramId}`}
                                                        </span>
                                                    </a>
                                                )}

                                                {contact.email && (
                                                    <a
                                                        href={`mailto:${contact.email}`}
                                                        className="flex items-center gap-2.5"
                                                    >
                                                        <span className="size-9 shrink-0 rounded-full bg-emerald-600 flex items-center justify-center">
                                                            <Mail size={16} className="text-white" />
                                                        </span>
                                                        <span className={`text-sm truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                            {contact.email}
                                                        </span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                            ) : null}
                                </div>
                            </div>
                        </div>

                        {/* Desktop/Laptop Layout - Visible at 768px and above */}
                        <div className="hidden md:flex md:flex-row gap-8 p-6">
                            {/* Left Column - Image and Rules */}
                            <div className="w-1/2 shrink-0 space-y-6">
                                {/* Event Image Card */}
                                <div className={`rounded-3xl overflow-hidden shadow-sm ${isDark ? 'bg-[#111213]' : 'bg-white'} p-2`}>
                                    <div className="rounded-2xl overflow-hidden">
                                    <img
                                        src={getImageUrl(eventData?.image, { preset: 'hero' }) || '/default-image.jpg'}
                                        alt={eventData?.title || 'Competition'}
                                        className="w-full h-80 object-cover"
                                        onError={(e) => {
                                            e.target.src = '/default-image.jpg';
                                        }}
                                    />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Desktop Prize Pool Highlight Card */}
                                    {eventData?.prize && (
                                        <div className={`relative overflow-hidden rounded-2xl border ${isDark ? 'bg-[#111213] border-[#00C2CB]/20' : 'bg-white border-[#0060DF]/20'}`}>
                                            <div className="absolute inset-0 bg-linear-to-br from-[#0060DF]/6 via-[#00C2CB]/4 to-transparent pointer-events-none" />
                                            <div className="relative p-6">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#0060DF] to-[#00C2CB] flex items-center justify-center shadow-lg shadow-[#00C2CB]/30">
                                                        <Trophy className="w-5 h-5 text-white" />
                                                    </div>
                                                    <h2 className="text-xs font-bold uppercase tracking-widest text-[#00C2CB]">Prize Pool</h2>
                                                </div>
                                                <div
                                                    className={`leading-relaxed whitespace-pre-wrap text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}
                                                    style={{ whiteSpace: 'pre-wrap' }}
                                                >
                                                    {eventData.prize}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Common Rules */}
                                    <div className={`${isDark ? 'bg-[#111213]' : 'bg-[#EDEDF2]'} rounded-2xl p-6`}>
                                        <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Rules and Guidelines</h2>
                                        <RulesList
                                            rules={commonRules}
                                            ruleKey={`desktop-common-rules-${eventData?.id}`}
                                            maxItems={5}
                                        />
                                    </div>
                                </div>

                                {/* Contact Details — same layout as fest view-details */}
                                {contactList.length > 0 ? (
                                <div className={`${isDark ? 'bg-[#111213]' : 'bg-gray-100'} rounded-2xl p-4 transition-colors duration-300`}>
                                    <h3 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Details</h3>
                                    <div className="space-y-2">
                                        {contactList.map((contact, index) => (
                                            <div key={index} className={`${isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]'} rounded-lg p-3 transition-colors duration-300`}>
                                                <div className="mb-1">
                                                    <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                        {contact.name || 'Contact Person'}
                                                    </span>
                                                    {contact.role && (
                                                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} ml-2`}>
                                                            - {contact.role}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="space-y-1">
                                                    {contact.phone && contact.phone.split(/\s*(?:,|\/)\s*/).filter(Boolean).map((entry, pi) => {
                                                        const nameMatch = entry.match(/\(([^)]+)\)/);
                                                        const name = nameMatch ? nameMatch[1].trim() : null;
                                                        const rawNumber = entry.replace(/\s*\([^)]*\)/, '').trim();
                                                        return (
                                                            <div key={pi} className="flex items-start gap-1.5">
                                                                <Phone size={12} className={`${isDark ? 'text-blue-400' : 'text-blue-600'} mt-0.5 shrink-0`} />
                                                                <div>
                                                                    {name && <span className={`text-fluid-2xs ${isDark ? 'text-gray-500' : 'text-gray-400'} block leading-tight`}>{name}</span>}
                                                                    <a
                                                                        href={`tel:${rawNumber.replace(/[\s-]/g, '')}`}
                                                                        className={`text-xs ${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'} transition`}
                                                                    >
                                                                        {rawNumber}
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {contact.email && (
                                                        <div className="flex items-center">
                                                            <Mail size={12} className={`${isDark ? 'text-green-400' : 'text-green-600'} mr-2`} />
                                                            <a
                                                                href={`mailto:${contact.email}`}
                                                                className={`text-xs ${isDark ? 'text-gray-300 hover:text-green-400' : 'text-gray-600 hover:text-green-600'} transition truncate`}
                                                            >
                                                                {contact.email}
                                                            </a>
                                                        </div>
                                                    )}

                                                    {contact.instagramId && (
                                                        <div className="flex items-center">
                                                            <Instagram size={12} className={`${isDark ? 'text-pink-400' : 'text-pink-600'} mr-2`} />
                                                            <a
                                                                href={`https://instagram.com/${contact.instagramId.replace('@', '')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`text-xs ${isDark ? 'text-gray-300 hover:text-pink-400' : 'text-gray-600 hover:text-pink-600'} transition`}
                                                            >
                                                                {contact.instagramId.startsWith('@') ? contact.instagramId : `@${contact.instagramId}`}
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
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

                                    <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{eventData?.title || 'Competition Title'}</h1>
                                    <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{eventData?.subtitle || 'Competition Subtitle'}</p>

                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-blue-600">
                                            <img src={CalendarIcon} alt="Calendar" className={`w-4 h-4 ${isDark ? 'filter invert' : ''}`} />
                                            <span className="text-sm">{eventData?.date || 'TBD'} {eventData?.time && `| ${eventData.time}`}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-blue-600">
                                            <img src={LocationIcon} alt="Location" className={`w-4 h-4 ${isDark ? 'filter invert' : ''}`} />
                                            <span className="text-sm">{eventData?.venue || 'TBD'}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex items-center gap-2.5 px-4 py-3 rounded-full border bg-[#0ECCEE]/10 border-[#0ECCEE]/30">
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#0ECCEE]/20">
                                                {eventData?.feeIsFree
                                                    ? <Zap className="w-3.5 h-3.5 text-[#0ECCEE]" />
                                                    : <Ticket className="w-3.5 h-3.5 text-[#0ECCEE]" />
                                                }
                                            </div>
                                            <div>
                                                <span className={`text-base font-bold leading-tight block ${eventData?.feeIsFree ? 'text-green-500' : 'text-[#0ECCEE]'}`}>
                                                    {eventData?.feeLabel || (eventData?.feeAmount > 0 ? `₹${Number(eventData.feeAmount).toLocaleString('en-IN')}` : 'Free')}
                                                </span>
                                                <span className={`text-[10px] leading-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {eventData?.feeIsFree ? 'No Entry Fee' : 'Registration Fee'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Register button — trek/run style */}
                                        <button
                                            onClick={handleRegister}
                                            disabled={registrationInfo.isDisabled}
                                            className={`flex flex-1 items-center justify-center gap-2 h-14 px-6 rounded-3xl text-base font-medium shadow-lg transition ${isRegistered
                                                ? 'bg-green-500 text-white hover:opacity-90'
                                                : registrationInfo.isDisabled
                                                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                                                : 'bg-[#0ECCEE] text-black active:opacity-90'
                                                }`}
                                            title={registrationInfo.isDisabled ? registrationInfo.buttonText : ''}
                                        >
                                            {isRegistered ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <Check className="w-4 h-4" />
                                                    Register Again
                                                </span>
                                            ) : (
                                                <>
                                                    {registrationInfo.buttonText}
                                                    {!registrationInfo.isDisabled ? (
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="m9 18 6-6-6-6"/>
                                                        </svg>
                                                    ) : null}
                                                </>
                                            )}
                                        </button>
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowShareMenu(!showShareMenu)}
                                                className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isDark ? 'bg-dark-700 hover:bg-dark-600' : 'bg-gray-100 hover:bg-gray-200'
                                                    }`}
                                            >
                                                <img src={ShareIcon} alt="Share" className="w-5 h-5" />
                                            </button>

                                            {showShareMenu && (
                                                <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-20 ${isDark ? 'bg-dark-700' : 'bg-white'
                                                    } border ${isDark ? 'border-dark-600' : 'border-gray-200'}`}>
                                                    <div className="py-2">
                                                        <button
                                                            onClick={() => handleShare('whatsapp')}
                                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-blue-500 ${isDark ? 'text-gray-200' : 'text-gray-700'
                                                                }`}
                                                        >
                                                            Share on WhatsApp
                                                        </button>
                                                        <button
                                                            onClick={() => handleShare('facebook')}
                                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-blue-500 ${isDark ? 'text-gray-200' : 'text-gray-700'
                                                                }`}
                                                        >
                                                            Share on Facebook
                                                        </button>
                                                        <button
                                                            onClick={() => handleShare('twitter')}
                                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-blue-500 ${isDark ? 'text-gray-200' : 'text-gray-700'
                                                                }`}
                                                        >
                                                            Share on Twitter
                                                        </button>
                                                        <button
                                                            onClick={() => handleShare('copy')}
                                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-blue-500 ${isDark ? 'text-gray-200' : 'text-gray-700'
                                                                }`}
                                                        >
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

                                {/* Competition Rounds - Only show if rounds exist */}
                                {eventData?.rounds?.roundsList?.length > 0 && (
                                <div className={`${isDark ? 'bg-[#111213]' : 'bg-[#EDEDF2]'} rounded-2xl p-6`}>
                                    <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{eventData?.title || 'Competition'} Rounds</h2>
                                    {eventData?.rounds?.description && (() => {
                                        const desc = sanitizeRoundDescription(eventData.rounds.description);

                                        return (
                                            <div className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                <div 
                                                    className="whitespace-pre-wrap"
                                                    style={{ whiteSpace: 'pre-wrap' }}
                                                >
                                                    {desc}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Desktop Round Tabs - Dynamic based on available rounds */}
                                    {eventData.rounds.roundsList.length > 1 && !festName?.toLowerCase().includes('symbi') && (
                                        <div className="grid gap-2 mb-6" style={{ gridTemplateColumns: `repeat(${Math.min(eventData.rounds.roundsList.length, 5)}, 1fr)` }}>
                                            {eventData.rounds.roundsList.map((round, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setActiveRound(idx)}
                                                    className={`flex-1 py-2 px-4 rounded-2xl font-medium transition ${activeRound === idx
                                                        ? `border-2 border-[#00C2CB] ${isDark ? 'bg-dark-700 text-white' : 'bg-[#EDEDF2] text-black'}`
                                                        : `shadow-md ${isDark ? 'bg-dark-700 text-gray-300' : 'bg-[#EDEDF2] text-black'}`
                                                        }`}
                                                >
                                                    {getRoundTabLabel(round, idx, eventData.rounds.roundsList.length)}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        {(() => {
                                            const round = eventData.rounds.roundsList[activeRound];
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

                                            const displayTitle = getRoundDisplayTitle(
                                                round,
                                                activeRound,
                                                eventData.rounds.roundsList.length,
                                            );
                                            const roundRules = getRoundRules(round);

                                            return (
                                                <>
                                                    {cleanedRoundDescription && !isDuplicateOfOverview && (
                                                        <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                            {cleanedRoundDescription}
                                                        </p>
                                                    )}

                                                    {displayTitle ? (
                                                        <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {displayTitle}
                                                        </h3>
                                                    ) : null}

                                                    {roundRules.length > 0 && (
                                                        <RulesList
                                                            rules={roundRules}
                                                            ruleKey={`desktop-round${activeRound}-${eventData?.id}`}
                                                            maxItems={5}
                                                        />
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                                )}
                            </div>
                        </div>
                </main>

                {/* Spacer for fixed mobile footer */}
                <div className="md:hidden h-24"></div>


            {/* Fixed mobile sticky fee + Register — same pattern as treks / runs */}
            <div
                className="fixed bottom-0 left-0 right-0 z-40 md:hidden px-2"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
            >
                <div className={`mx-auto w-full max-w-md flex items-center justify-between gap-4 rounded-[30px] px-5 py-3.5 ${isDark ? 'bg-[#111213] shadow-lg' : 'bg-white shadow-[0_-2px_20px_rgba(0,0,0,0.15)] border border-gray-100'}`}>
                    <div className="min-w-0 shrink-0">
                        <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Registration Fee</p>
                        {!eventData?.feeKnown ? (
                            <p className={`mt-0.5 text-2xl font-bold leading-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>—</p>
                        ) : eventData?.feeIsFree ? (
                            <p className="mt-0.5 text-2xl font-bold leading-none text-green-500">Free</p>
                        ) : (
                            <p className={`mt-0.5 text-2xl font-bold leading-none truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {eventData?.feeLabel || `₹${Number(eventData.feeAmount || 0).toLocaleString('en-IN')}`}
                            </p>
                        )}
                    </div>
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
                        className={`flex flex-1 items-center justify-center gap-2 h-14 px-6 rounded-3xl text-lg font-medium shadow-lg transition ${
                            registrationInfo.isDisabled
                                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                                : isRegistered
                                ? 'bg-green-600 text-white'
                                : 'bg-[#0ECCEE] text-black active:opacity-90'
                        }`}
                    >
                        {isRegistered ? (
                            <><Check className="w-4 h-4" /> Register Again</>
                        ) : (
                            <>
                                {registrationInfo.buttonText}
                                {!registrationInfo.isDisabled ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                ) : null}
                            </>
                        )}
                    </button>
                </div>
            </div>

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


