import React, { useState, useEffect } from 'react';
import { Phone, Instagram, Check, Moon, Sun, Mail, User, ArrowLeft, Trophy, Ticket, Zap } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import ProfileSidebar from '../../components/ProfileSidebar';
import { useDarkMode } from '../../context/DarkModeContext';
import { useRegisteredEvents } from '../../context/RegisteredEventsContext';
import { useAuth } from '../../context/AuthContext';
import CalendarIcon from '../../assets/calendar.svg';
import LocationIcon from '../../assets/location-.svg';
import ShareIcon from '../../assets/share.svg';
import { getImageUrl } from '../../utils/imageImports.js';
import CrwdCtrlLogin from '../auth/login';
import CrwdCtrlRegister from '../auth/register';
import { publicFetchJSONRetry as fetchJSON, resolveUrl } from '../../services/api/client';

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

    const useFestRegistrationFallback = options.useFestRegistrationFallback ?? true;
    const roundsSource = Array.isArray(compData.rounds) ? compData.rounds : [];
    const roundsObject = !Array.isArray(compData.rounds) && compData.rounds ? compData.rounds : null;
    const roundsListSource = Array.isArray(roundsObject?.roundsList) ? roundsObject.roundsList : roundsSource;

    return {
        id: compData._id || compData.id,
        title: compData.name || compData.title || 'Competition',
        subtitle: sanitizeRoundDescription(compData.subtitle || compData.description || ''),
        date: compData.dateTime || compData.date || '',
        time: compData.time || '',
        venue: compData.venue || 'TBD',
        entryFee: compData.registrationFee || compData.entryFee || 'Free',
        feeAmount: compData.feeAmount || 0,
        prize: compData.prizePool || compData.prize || 'TBD',
        image: compData.coverImage || compData.image,
        contact: compData.contact || { phone: '', instagram: '', email: '' },
        description: sanitizeRoundDescription(compData.description || ''),
        commonRules: sanitizeRulesArray(compData.commonRules || compData.rules || []),
        commonRulesMessage: sanitizeRoundDescription(compData.commonRulesMessage || ''),
        registrationLink: compData.registrationLink || '',

        registrationType: compData.registrationType || 'fest',
        registration: useFestRegistrationFallback && (compData.registrationType === 'fest' || !compData.registrationType)
            ? (compData.fest?.registration || compData.registration || { mode: 'NOT_STARTED' })
            : (compData.registration || { status: 'not_started' }),
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

    // Function to get round rules
    const getRoundRules = (roundData) => {
        if (!roundData) return [];
        
        // Display priority: show message field if present, otherwise show individual rules
        if (roundData.roundRulesMessage && roundData.roundRulesMessage.trim()) {
            // Return message field content as a single item for display
            return [sanitizeRoundDescription(roundData.roundRulesMessage)];
        }
        
        // Use rules array
        return sanitizeRulesArray(roundData.rules || []);
    };

    const commonRules = getCommonRules();

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
        const registrationStatus = eventData?.registration?.status || 'not_started';
        
        // ✅ CRITICAL: Also check registration from passedEventData (from navigation state)
        const festRegistrationFromState = passedEventData?.registration || eventData?.registration;
        const festRegistrationMode = eventData?.fest?.registration?.mode || 
                                     festRegistrationFromState?.mode || 
                                     eventData?.registration?.mode;
        
        console.log('🔍 Registration check:', { 
            registrationType, 
            registrationStatus,
            festRegistrationMode,
            eventData: eventData,
            festData: eventData?.fest,
            festRegistration: eventData?.fest?.registration,
            passedEventData: passedEventData
        });
        
        if (registrationType === 'fest') {
            // ✅ Use mode from multiple sources
            const mode = festRegistrationMode || 'NOT_STARTED';
            console.log('🎯 Fest registration mode:', mode);
            
            return {
                isAvailable: mode === 'EXTERNAL_LINK' || mode === 'INTERNAL_FORM',
                buttonText: mode === 'NOT_STARTED' ? 'Registrations Not Started' : 
                           mode === 'CLOSED' ? 'Registration Closed' : 'Register Now',
                isDisabled: mode === 'NOT_STARTED' || mode === 'CLOSED'
            };
        } else if (registrationType === 'custom') {
            // Check if form is properly configured
            const isConfigured = isCustomFormConfigured();
            
            if (!isConfigured) {
                return {
                    isAvailable: false,
                    buttonText: 'Form Not Configured',
                    isDisabled: true,
                    notConfigured: true
                };
            }
            
            return {
                isAvailable: registrationStatus === 'external_link' || registrationStatus === 'internal_form',
                buttonText: registrationStatus === 'not_started' ? 'Registrations Not Started' : 
                           registrationStatus === 'registration_closed' ? 'Registration Closed' : 'Register Now',
                isDisabled: registrationStatus === 'not_started' || registrationStatus === 'registration_closed'
            };
        } else {
            // Legacy compatibility - check both new and old status fields
            const legacyStatus = eventData?.legacyRegistration?.status || eventData?.registration?.status || 'NOT_STARTED';
            return {
                isAvailable: legacyStatus === 'STARTED' || legacyStatus === 'internal_form' || legacyStatus === 'external_link',
                buttonText: legacyStatus === 'NOT_STARTED' || legacyStatus === 'not_started' ? 'Registrations Not Started' : 
                           legacyStatus === 'CLOSED' || legacyStatus === 'registration_closed' ? 'Registration Closed' : 'Register Now',
                isDisabled: legacyStatus === 'NOT_STARTED' || legacyStatus === 'CLOSED' || legacyStatus === 'not_started' || legacyStatus === 'registration_closed'
            };
        }
    };

    const registrationInfo = getRegistrationStatus();

    const handleRegister = async () => {
        if (!isAuthenticated) {
            setShowLogin(true);
            return;
        }

        const registrationType = eventData?.registrationType || 'fest';
        const registrationStatus = eventData?.registration?.status || 'not_started';
        const festRegistrationFromState = passedEventData?.registration || eventData?.registration;
        const festRegistrationMode = eventData?.fest?.registration?.mode ||
                                     festRegistrationFromState?.mode ||
                                     eventData?.registration?.mode;

        if (registrationType === 'fest') {
            const mode = festRegistrationMode || 'NOT_STARTED';
            if (mode === 'EXTERNAL_LINK') {
                const externalLink = eventData?.fest?.registration?.externalLink ||
                                     festRegistrationFromState?.externalLink ||
                                     eventData?.registration?.externalLink;
                externalLink?.trim()
                    ? window.open(externalLink, '_blank')
                    : alert('Registration link is not available. Please contact the organizers.');
            } else if (mode === 'INTERNAL_FORM') {
                const festId = eventData?.fest?._id || passedEventData?.id || eventData?.festId || eventData?.fest?.id;
                const compId = eventData?.id;
                festId
                    ? navigate(`/fest/${festId}/register?competition=${compId}`)
                    : alert('Registration is not available. Please contact the organizers.');
            } else if (mode === 'NOT_STARTED') {
                alert('Registration has not started yet for this competition.');
            } else if (mode === 'CLOSED') {
                alert('Registration for this competition is closed.');
            } else {
                alert('Registration configuration is not set up properly. Please contact the organizers.');
            }
        } else if (registrationType === 'custom') {
            if (registrationStatus === 'internal_form') {
                navigate(`/competition-registration/${eventData?.id || eventData?._id}`);
            } else if (registrationStatus === 'external_link') {
                const externalUrl = eventData?.registration?.externalUrl;
                externalUrl?.trim()
                    ? window.open(externalUrl, '_blank')
                    : alert('External registration link not available. Please contact the organizers.');
            } else if (registrationStatus === 'not_started') {
                alert('Registration has not started yet for this competition.');
            } else if (registrationStatus === 'registration_closed') {
                alert('Registration for this competition is closed.');
            } else {
                alert('Registration configuration is not set up properly. Please contact the organizers.');
            }
        } else {
            alert('Registration has not started yet for this competition.');
        }
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
                window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
                break;
            case 'facebook':
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
                break;
            case 'twitter':
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
                break;
            case 'copy':
                navigator.clipboard.writeText(url);
                alert('Link copied to clipboard!');
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

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex flex-col transition-colors">

            <main className="flex-1 pb-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Mobile/Narrow Layout - Only visible below 768px */}
                        <div className="block md:hidden">
                            {/* Mobile Back Button */}
                            <div className="px-4 pt-4 pb-2">
                                <button
                                    onClick={() => navigate(-1)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                        isDark 
                                            ? 'bg-[#111213] text-gray-300 hover:bg-[#1D1E20] hover:text-white' 
                                            : 'bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                    } shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-sm font-medium">Back</span>
                                </button>
                            </div>

                            {/* Mobile Event Image */}
                            <div className="px-4 pt-4">
                                <div className="bg-[#EDEDF2] dark:bg-[#111213] rounded-lg overflow-hidden shadow-sm">
                                    <img
                                        src={getImageUrl(eventData?.image, { preset: 'hero' }) || '/default-image.jpg'}
                                        alt={eventData?.title || 'Competition'}
                                        className="w-full h-48 object-cover"
                                        onError={(e) => {
                                            console.log('Image load error for:', eventData?.image);
                                            console.log('Resolved URL:', getImageUrl(eventData?.image));
                                            e.target.src = '/default-image.jpg';
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Mobile Event Header */}
                            <div className="px-4 py-4">
                                <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {eventData?.title || 'Competition Title'}
                                </h1>
                                <p className={`text-lg mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {eventData?.subtitle || 'Competition Subtitle'}
                                </p>
                                <div className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    <p>
                                        <span className="font-semibold">Entry fee: </span>
                                        <span className="font-bold text-[#0ECCEE]">
                                            {eventData?.feeAmount > 0 ? `₹${eventData.feeAmount}` : 'Free'}
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
                                        disabled={isRegistered || registrationInfo.isDisabled}
                                        className={`flex-1 py-3 px-4 rounded-full font-semibold transition ${isRegistered
                                            ? 'bg-green-500 text-white cursor-not-allowed'
                                            : registrationInfo.isDisabled
                                            ? 'bg-gray-500 text-white cursor-not-allowed opacity-60'
                                            : 'bg-linear-to-r from-[#0060DF] to-[#00C2CB] text-white hover:opacity-90'
                                            }`}
                                        title={registrationInfo.isDisabled ? registrationInfo.buttonText : ''}
                                    >
                                        {isRegistered ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <Check className="w-4 h-4" />
                                                Registered
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
                                                    Round {idx + 1}
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

                                            return (
                                                <>
                                                    {cleanedRoundDescription && !isDuplicateOfOverview && (
                                                        <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                            {cleanedRoundDescription}
                                                        </p>
                                                    )}

                                                    {round.title && (
                                                        <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {round.title}
                                                        </h3>
                                                    )}

                                                    {round.offline && (
                                                        <div className={`${isDark ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-4`}>
                                                            <p className={`font-semibold mb-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                                {round.offline.title || 'Offline Round'}
                                                            </p>
                                                            <RulesList
                                                                rules={round.offline.rules}
                                                                ruleKey={`mobile-round${activeRound}-offline-${eventData?.id}`}
                                                                maxItems={5}
                                                            />
                                                        </div>
                                                    )}

                                                    {round.online && (
                                                        <div className={`${isDark ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-4`}>
                                                            <p className={`font-semibold mb-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                                {round.online.title || 'Online Round'}
                                                            </p>
                                                            <RulesList
                                                                rules={round.online.rules}
                                                                ruleKey={`mobile-round${activeRound}-online-${eventData?.id}`}
                                                                maxItems={5}
                                                            />
                                                        </div>
                                                    )}

                                                    {!round.offline && !round.online && round.rules && (
                                                        <div className={`${isDark ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-4`}>
                                                            <RulesList
                                                                rules={getRoundRules(round)}
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

                            {/* Mobile Contact Details */}
                            <div className="px-4 py-4 mb-6">
                                <div className={`${isDark ? 'bg-[#111213]' : 'bg-white'} rounded-lg p-4 shadow-sm`}>
                                    <h2 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Details</h2>

                                    {/* Contact Name */}
                                    {eventData?.contact?.name && (
                                        <div className="mb-3">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <div className={`p-1 ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'} rounded-full`}>
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Person</p>
                                            </div>
                                            <p className={`text-sm pl-7 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{eventData.contact.name}</p>
                                        </div>
                                    )}

                                    {/* Email Display */}
                                    {eventData?.contact?.email && (
                                        <div className="mb-4">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <div className={`p-1 ${isDark ? 'bg-red-900 text-red-400' : 'bg-red-100 text-red-600'} rounded-full`}>
                                                    <Mail className="w-4 h-4" />
                                                </div>
                                                <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Email</p>
                                            </div>
                                            <a
                                                href={`mailto:${eventData.contact.email}`}
                                                className={`text-sm break-all pl-7 ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} transition-colors`}
                                            >
                                                {eventData.contact.email}
                                            </a>
                                        </div>
                                    )}

                                    {/* Phone Numbers Section */}
                                    {eventData?.contact?.phone && (
                                        <div className="mb-4">
                                            <div className="flex items-center space-x-2 mb-3">
                                                <div className={`p-1 ${isDark ? 'bg-blue-900 text-blue-400' : 'bg-blue-100 text-blue-600'} rounded-full`}>
                                                    <Phone className="w-4 h-4" />
                                                </div>
                                                <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Phone</p>
                                            </div>
                                            <div className="space-y-2 pl-7">
                                                {eventData.contact.phone
                                                    .split(/\s*(?:,|\/)\s*/)
                                                    .map(s => s.trim())
                                                    .filter(Boolean)
                                                    .map((entry, index) => {
                                                        const nameMatch = entry.match(/\(([^)]+)\)/);
                                                        const name = nameMatch ? nameMatch[1].trim() : null;
                                                        const rawNumber = entry.replace(/\s*\([^)]*\)/, '').trim();
                                                        const telHref = `tel:${rawNumber.replace(/[\s-]/g, '')}`;
                                                        return (
                                                            <a
                                                                key={index}
                                                                href={telHref}
                                                                className={`flex items-center gap-2.5 group py-2 px-3 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-blue-50'}`}
                                                            >
                                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                                                    {name ? name.charAt(0).toUpperCase() : '#'}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    {name && (
                                                                        <p className={`text-xs font-medium leading-none mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{name}</p>
                                                                    )}
                                                                    <p className={`text-sm font-medium ${isDark ? 'text-blue-400 group-hover:text-blue-300' : 'text-blue-600 group-hover:text-blue-800'} transition-colors`}>{rawNumber}</p>
                                                                </div>
                                                            </a>
                                                        );
                                                    })
                                                }
                                            </div>
                                        </div>
                                    )}

                                    {/* Instagram */}
                                    {eventData?.contact?.instagram && (
                                        <div className="mb-4">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <div className={`p-1 bg-linear-to-br from-purple-500 to-pink-500 rounded-full`}>
                                                    <Instagram className="w-4 h-4 text-white" />
                                                </div>
                                                <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Instagram</p>
                                            </div>
                                            <a
                                                href={eventData.contact.instagram.startsWith('http') 
                                                    ? eventData.contact.instagram 
                                                    : `https://instagram.com/${eventData.contact.instagram.replace('@', '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`text-sm pl-7 ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-800'} transition-colors`}
                                            >
                                                {eventData.contact.instagram}
                                            </a>
                                        </div>
                                    )}

                                    {/* Show message if no contact details */}
                                    {!eventData?.contact?.name && !eventData?.contact?.email && !eventData?.contact?.phone && !eventData?.contact?.instagram && (
                                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Contact details will be updated soon.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Desktop/Laptop Layout - Visible at 768px and above */}
                        <div className="hidden md:flex md:flex-row gap-8 p-6">
                            {/* Left Column - Image and Rules */}
                            <div className="w-1/2 shrink-0 space-y-6">
                                {/* Event Image Card */}
                                <div className="bg-[#EDEDF2] rounded-2xl overflow-hidden">
                                    <img
                                        src={getImageUrl(eventData?.image, { preset: 'hero' }) || '/default-image.jpg'}
                                        alt={eventData?.title || 'Competition'}
                                        className="w-full h-80 object-cover"
                                        onError={(e) => {
                                            console.log('Image load error for:', eventData?.image);
                                            console.log('Resolved URL:', getImageUrl(eventData?.image));
                                            e.target.src = '/default-image.jpg';
                                        }}
                                    />
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

                                {/* Contact Details */}
                                <div className={`${isDark ? 'bg-[#111213]' : 'bg-[#EDEDF2]'} rounded-2xl p-6`}>
                                    <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact details</h2>

                                    {/* Contact Name */}
                                    {eventData?.contact?.name && (
                                        <div className="mb-4">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <div className={`p-2 ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'} rounded-full`}>
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Person</p>
                                            </div>
                                            <p className={`text-sm pl-12 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{eventData.contact.name}</p>
                                        </div>
                                    )}

                                    {/* Email Display */}
                                    {eventData?.contact?.email && (
                                        <div className="mb-6">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <div className={`p-2 ${isDark ? 'bg-red-900 text-red-400' : 'bg-red-100 text-red-600'} rounded-full`}>
                                                    <Mail className="w-5 h-5" />
                                                </div>
                                                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Email</p>
                                            </div>
                                            <a
                                                href={`mailto:${eventData.contact.email}`}
                                                className={`text-sm break-all pl-12 ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} transition-colors`}
                                            >
                                                {eventData.contact.email}
                                            </a>
                                        </div>
                                    )}

                                    {/* Phone Numbers Section */}
                                    {eventData?.contact?.phone && (
                                        <div className="mb-6">
                                            <div className="flex items-center space-x-3 mb-3">
                                                <div className={`p-2 ${isDark ? 'bg-blue-900 text-blue-400' : 'bg-blue-100 text-blue-600'} rounded-full`}>
                                                    <Phone className="w-5 h-5" />
                                                </div>
                                                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Phone Numbers</p>
                                            </div>
                                            <div className="space-y-1 pl-12">
                                                {eventData.contact.phone
                                                    .split(/\s*(?:,|\/)\s*/)
                                                    .map(s => s.trim())
                                                    .filter(Boolean)
                                                    .map((entry, index) => {
                                                        const nameMatch = entry.match(/\(([^)]+)\)/);
                                                        const name = nameMatch ? nameMatch[1].trim() : null;
                                                        const rawNumber = entry.replace(/\s*\([^)]*\)/, '').trim();
                                                        return (
                                                            <a
                                                                key={index}
                                                                href={`tel:${rawNumber.replace(/[\s-]/g, '')}`}
                                                                className={`flex items-center gap-2.5 group py-2 px-3 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-blue-50'}`}
                                                            >
                                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                                                    {name ? name.charAt(0).toUpperCase() : '#'}
                                                                </div>
                                                                <div>
                                                                    {name && <p className={`text-xs font-medium leading-none mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{name}</p>}
                                                                    <p className={`text-sm font-medium ${isDark ? 'text-blue-400 group-hover:text-blue-300' : 'text-blue-600 group-hover:text-blue-800'} transition-colors`}>{rawNumber}</p>
                                                                </div>
                                                            </a>
                                                        );
                                                    })
                                                }
                                            </div>
                                        </div>
                                    )}

                                    {/* Instagram */}
                                    {eventData?.contact?.instagram && (
                                        <div className="mb-6">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <div className={`p-2 bg-linear-to-br from-purple-500 to-pink-500 rounded-full`}>
                                                    <Instagram className="w-5 h-5 text-white" />
                                                </div>
                                                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Instagram</p>
                                            </div>
                                            <a
                                                href={eventData.contact.instagram.startsWith('http') 
                                                    ? eventData.contact.instagram 
                                                    : `https://instagram.com/${eventData.contact.instagram.replace('@', '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`text-sm pl-12 ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-800'} transition-colors`}
                                            >
                                                {eventData.contact.instagram}
                                            </a>
                                        </div>
                                    )}

                                    {/* Show message if no contact details */}
                                    {!eventData?.contact?.name && !eventData?.contact?.email && !eventData?.contact?.phone && !eventData?.contact?.instagram && (
                                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Contact details will be updated soon.
                                        </p>
                                    )}
                                </div>
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
                                        {/* Fee pill */}
                                        <div className="flex items-center gap-2.5 px-4 py-3 rounded-full border bg-linear-to-r from-[#0060DF]/10 to-[#00C2CB]/10 border-[#00C2CB]/30">
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-linear-to-br from-[#0060DF]/25 to-[#00C2CB]/25">
                                                {eventData?.feeAmount > 0
                                                    ? <Ticket className="w-3.5 h-3.5 text-[#00C2CB]" />
                                                    : <Zap className="w-3.5 h-3.5 text-[#00C2CB]" />
                                                }
                                            </div>
                                            <div>
                                                <span className="text-base font-bold leading-tight block text-[#00C2CB]">
                                                    {eventData?.feeAmount > 0 ? `₹${eventData.feeAmount}` : 'Free'}
                                                </span>
                                                <span className={`text-[10px] leading-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {eventData?.feeAmount > 0 ? 'Entry Fee' : 'No Entry Fee'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Register button */}
                                        <button
                                            onClick={handleRegister}
                                            disabled={isRegistered || registrationInfo.isDisabled}
                                            className={`flex-1 py-3 px-4 rounded-full font-semibold transition ${isRegistered
                                                ? 'bg-green-500 text-white cursor-not-allowed'
                                                : registrationInfo.isDisabled
                                                ? 'bg-gray-500 text-white cursor-not-allowed opacity-60'
                                                : 'bg-linear-to-r from-[#0060DF] to-[#00C2CB] text-white hover:opacity-90'
                                                }`}
                                            title={registrationInfo.isDisabled ? registrationInfo.buttonText : ''}
                                        >
                                            {isRegistered ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <Check className="w-4 h-4" />
                                                    Registered
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
                                                    Round {idx + 1}
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

                                            return (
                                                <>
                                                    {cleanedRoundDescription && !isDuplicateOfOverview && (
                                                        <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                            {cleanedRoundDescription}
                                                        </p>
                                                    )}

                                                    {round.title && (
                                                        <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {round.title}
                                                        </h3>
                                                    )}

                                                    {round.offline && (
                                                        <div className="mb-4">
                                                            <p className={`font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                                {round.offline.title || 'Offline Round'}
                                                            </p>
                                                            <RulesList
                                                                rules={round.offline.rules}
                                                                ruleKey={`desktop-round${activeRound}-offline-${eventData?.id}`}
                                                                maxItems={5}
                                                            />
                                                        </div>
                                                    )}

                                                    {round.online && (
                                                        <div className="mb-4">
                                                            <p className={`font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                                {round.online.title || 'Online Round'}
                                                            </p>
                                                            <RulesList
                                                                rules={round.online.rules}
                                                                ruleKey={`desktop-round${activeRound}-online-${eventData?.id}`}
                                                                maxItems={5}
                                                            />
                                                        </div>
                                                    )}

                                                    {!round.offline && !round.online && round.rules && (
                                                        <RulesList
                                                            rules={getRoundRules(round)}
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
                    </div>
                </main>

                {/* Spacer for fixed mobile footer */}
                <div className="md:hidden h-20"></div>


            {/* Fixed Mobile/Tablet Register Button Footer */}
            <div className={`fixed bottom-0 left-0 right-0 z-40 md:hidden px-4 py-3 flex items-center gap-3 ${isDark ? 'bg-[#0F1014] border-t border-gray-700' : 'bg-white border-t border-gray-200'}`}>
                {/* Fee display */}
                <div className="shrink-0">
                    <span className={`text-lg font-bold leading-tight block ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {eventData?.feeAmount > 0 ? `₹${eventData.feeAmount}/-` : 'Free'}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {eventData?.feeAmount > 0 ? 'Fee' : 'No Fee'}
                    </span>
                </div>

                {/* Register button */}
                <button
                    onClick={handleRegister}
                    disabled={isRegistered || registrationInfo.isDisabled}
                    className={`flex-1 font-semibold py-3 rounded-xl transition ${
                        registrationInfo.isDisabled
                            ? 'bg-gray-500 text-white cursor-not-allowed'
                            : isRegistered
                            ? 'bg-green-600 text-white'
                            : 'bg-linear-to-r from-[#0060DF] to-[#00C2CB] hover:opacity-90 text-white'
                    }`}
                >
                    {isRegistered ? (
                        <><span className="mr-1">✓</span> Registered</>
                    ) : registrationInfo.buttonText}
                </button>
            </div>

            {/* Login Modal */}
            {showLogin && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlLogin onClose={handleCloseLogin} onSwitchToRegister={handleSwitchToRegister} />
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


