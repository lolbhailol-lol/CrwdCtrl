import React, { useState, useEffect } from 'react';
import { Phone, Instagram, Check, Moon, Sun, Mail, User, ArrowLeft } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import ProfileSidebar from '../ProfileSidebar';
import { useDarkMode } from '../../context/DarkModeContext';
import { useRegisteredEvents } from '../../context/RegisteredEventsContext';
import { useAuth } from '../../context/AuthContext';
import CalendarIcon from '../../assets/calendar.svg';
import LocationIcon from '../../assets/location-.svg';
import ShareIcon from '../../assets/share.svg';
import Footer from '../Footer';
import { getImageUrl } from '../../utils/imageImports.js';
import CrwdCtrlLogin from './login';
import CrwdCtrlRegister from './register';
// ✅ FIX: Use native fetch instead of axios (axios XMLHttpRequest causes ERR_NETWORK on mobile)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const fetchJSON = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const timeout = options.timeout || 20000;
    const maxRetries = options.retries || 3;
    
    const attemptFetch = async (retryCount = 0) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'omit',
                mode: 'cors',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return { data };
        } catch (err) {
            clearTimeout(timeoutId);
            
            // Retry on network errors (not on 404, 400, etc.)
            const isNetworkError = err.name === 'AbortError' || 
                                   err.name === 'TypeError' || 
                                   err.message.includes('Failed to fetch') ||
                                   err.message.includes('Network');
            
            if (isNetworkError && retryCount < maxRetries) {
                console.log(`🔄 Retry ${retryCount + 1}/${maxRetries} for ${endpoint}`);
                // Exponential backoff: 1s, 2s, 4s
                await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
                return attemptFetch(retryCount + 1);
            }
            
            if (err.name === 'AbortError') { 
                const e = new Error('Request timeout'); 
                e.code = 'ECONNABORTED'; 
                e.isNetworkError = true;
                throw e; 
            }
            err.isNetworkError = isNetworkError;
            throw err;
        }
    };
    
    return attemptFetch();
};

function EventPage() {
    const { competitionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeRound, setActiveRound] = useState('round1');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [expandedRules, setExpandedRules] = useState({});
    const [competitionData, setCompetitionData] = useState(null);
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { isDark } = useDarkMode();
    const { registeredEvents, registerForEvent } = useRegisteredEvents();
    const { isAuthenticated } = useAuth();

    // Fetch competition data from backend API
    useEffect(() => {
        const fetchCompetitionData = async () => {
            if (!competitionId) {
                // If no competitionId in URL, check if data was passed via navigation state
                const stateCompetition = location.state?.competition;
                if (stateCompetition) {
                    console.log('Using competition data from navigation state:', stateCompetition);
                    setCompetitionData(stateCompetition);
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
                console.log('ViewDetails - API URL:', `${API_BASE_URL}/fests/competitions/${competitionId}/public`);
                
                // Try to fetch competition data from backend
                // Add cache busting timestamp to ensure fresh data
                const timestamp = Date.now();
                const response = await fetchJSON(`/fests/competitions/${competitionId}/public?t=${timestamp}`);
                console.log('ViewDetails - API Response Status: OK');
                console.log('ViewDetails - API Response Data:', response.data);
                
                const compData = response.data;
                console.log('🔍 Raw competition data from API:', compData);
                console.log('🔍 Registration type:', compData.registrationType);
                console.log('🔍 Registration status:', compData.registration?.status);
                console.log('🔍 Full registration object:', compData.registration);

                if (compData) {
                    // Transform backend competition data to match expected structure
                    const transformedData = {
                        id: compData._id || compData.id,
                        title: compData.name,
                        subtitle: compData.subtitle || compData.description,
                        date: compData.dateTime,
                        time: '',
                        venue: compData.venue || 'TBD',
                        entryFee: compData.registrationFee || 'Free',
                        prize: compData.prizePool || 'TBD',
                        image: compData.coverImage,
                        contact: compData.contact || { phone: '', instagram: '', email: '' },
                        description: compData.description,
                        commonRules: compData.commonRules || [],
                        commonRulesMessage: compData.commonRulesMessage || '', // NEW: message field
                        registrationLink: compData.registrationLink || '',
                        
                        // NEW: Add registration configuration fields
                        registrationType: compData.registrationType || 'fest',
                        // ✅ FIX: For fest-type registrations, use fest's registration mode
                        registration: compData.registrationType === 'fest' || !compData.registrationType
                            ? (compData.fest?.registration || compData.registration || { mode: 'NOT_STARTED' })
                            : (compData.registration || { status: 'not_started' }),
                        legacyRegistration: compData.legacyRegistration || { status: 'NOT_STARTED' },
                        
                        // Add fest data for registration
                        fest: compData.fest || null,
                        festId: compData.fest?._id || null,
                        rounds: {
                            description: compData.rounds?.[0]?.description || '',
                            list: compData.rounds?.map(r => r.title || r.description) || [],
                            round1: compData.rounds?.[0] ? {
                                title: compData.rounds[0].title || '',
                                rules: compData.rounds[0].rules || [],
                                roundRulesMessage: compData.rounds[0].roundRulesMessage || '',
                                description: compData.rounds[0].description || '',
                                dateTime: compData.rounds[0].dateTime,
                                venue: compData.rounds[0].venue
                            } : null,
                            round2: compData.rounds?.[1] ? {
                                title: compData.rounds[1].title || 'Round 2',
                                rules: compData.rounds[1].rules || [],
                                roundRulesMessage: compData.rounds[1].roundRulesMessage || '', // NEW: message field
                                description: compData.rounds[1].description || '',
                                dateTime: compData.rounds[1].dateTime,
                                venue: compData.rounds[1].venue
                            } : null,
                            round3: compData.rounds?.[2] ? {
                                title: compData.rounds[2].title || 'Final Round',
                                rules: compData.rounds[2].rules || [],
                                roundRulesMessage: compData.rounds[2].roundRulesMessage || '', // NEW: message field
                                description: compData.rounds[2].description || '',
                                dateTime: compData.rounds[2].dateTime,
                                venue: compData.rounds[2].venue
                            } : null
                        }
                    };

                    setCompetitionData(transformedData);
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
                    setCompetitionData(stateCompetition);
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
                            const transformedData = {
                                id: compData._id || compData.id,
                                title: compData.name,
                                subtitle: compData.subtitle || compData.description,
                                date: compData.dateTime,
                                time: '',
                                venue: compData.venue || 'TBD',
                                entryFee: compData.registrationFee || 'Free',
                                prize: compData.prizePool || 'TBD',
                                image: compData.coverImage,
                                contact: compData.contact || { phone: '', instagram: '', email: '' },
                                description: compData.description,
                                commonRules: compData.commonRules || [],
                                commonRulesMessage: compData.commonRulesMessage || '',
                                registrationLink: compData.registrationLink || '',
                                registrationType: compData.registrationType || 'fest',
                                registration: compData.registration || { status: 'not_started' },
                                legacyRegistration: compData.legacyRegistration || { status: 'NOT_STARTED' },
                                fest: compData.fest || null,
                                festId: compData.fest?._id || null,
                                rounds: {
                                    description: compData.rounds?.[0]?.description || '',
                                    list: compData.rounds?.map(r => r.title || r.description) || [],
                                    round1: compData.rounds?.[0] ? {
                                        title: compData.rounds[0].title || '',
                                        rules: compData.rounds[0].rules || [],
                                        roundRulesMessage: compData.rounds[0].roundRulesMessage || '',
                                        description: compData.rounds[0].description || '',
                                        dateTime: compData.rounds[0].dateTime,
                                        venue: compData.rounds[0].venue
                                    } : null,
                                    round2: compData.rounds?.[1] ? {
                                        title: compData.rounds[1].title || 'Round 2',
                                        rules: compData.rounds[1].rules || [],
                                        roundRulesMessage: compData.rounds[1].roundRulesMessage || '',
                                        description: compData.rounds[1].description || '',
                                        dateTime: compData.rounds[1].dateTime,
                                        venue: compData.rounds[1].venue
                                    } : null,
                                    round3: compData.rounds?.[2] ? {
                                        title: compData.rounds[2].title || 'Final Round',
                                        rules: compData.rounds[2].rules || [],
                                        roundRulesMessage: compData.rounds[2].roundRulesMessage || '',
                                        description: compData.rounds[2].description || '',
                                        dateTime: compData.rounds[2].dateTime,
                                        venue: compData.rounds[2].venue
                                    } : null
                                }
                            };
                            setCompetitionData(transformedData);
                            console.log('✅ Competition data updated from admin changes');
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
            <div className={`min-h-screen ${isDark ? 'bg-[#0E0E0F]' : 'bg-white'} flex items-center justify-center`}>
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
            <div className={`min-h-screen ${isDark ? 'bg-[#0E0E0F]' : 'bg-white'} flex items-center justify-center`}>
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
            return [eventData.commonRulesMessage];
        }
        // Use commonRules array
        return eventData?.commonRules || [];
    };

    // Function to get round rules
    const getRoundRules = (roundData) => {
        if (!roundData) return [];
        
        // Display priority: show message field if present, otherwise show individual rules
        if (roundData.roundRulesMessage && roundData.roundRulesMessage.trim()) {
            // Return message field content as a single item for display
            return [roundData.roundRulesMessage];
        }
        
        // Use rules array
        return roundData.rules || [];
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
        console.log('🎯 Register button clicked');

        // Get the competition's registration configuration
        const registrationType = eventData?.registrationType || 'fest';
        const registrationStatus = eventData?.registration?.status || 'not_started';
        
        // ✅ Get registration data from multiple sources
        const festRegistrationFromState = passedEventData?.registration || eventData?.registration;
        const festRegistrationMode = eventData?.fest?.registration?.mode || 
                                     festRegistrationFromState?.mode || 
                                     eventData?.registration?.mode;
        
        console.log('🎯 Registration attempt:', { 
            registrationType, 
            registrationStatus,
            festRegistrationMode,
            eventData: eventData,
            registrationConfig: eventData?.registration,
            festRegistration: eventData?.fest?.registration,
            passedEventData: passedEventData
        });
        
        // Check if custom form is properly configured
        if (registrationType === 'custom' && !isCustomFormConfigured()) {
            console.error('❌ Custom form not configured');
            alert('This competition\'s registration form is not properly configured. Please contact the organizers to set up the form.');
            return;
        }
        
        if (registrationType === 'fest') {
            console.log('📋 Using fest registration system');
            
            // ✅ Use mode from multiple sources
            const mode = festRegistrationMode || 'NOT_STARTED';
            console.log('🎯 Fest registration mode:', mode);
            
            if (mode === 'EXTERNAL_LINK') {
                // Use fest's external registration link
                const externalLink = eventData?.fest?.registration?.externalLink || 
                                     festRegistrationFromState?.externalLink ||
                                     eventData?.registration?.externalLink;
                if (externalLink && externalLink.trim() !== '') {
                    window.open(externalLink, '_blank');
                } else {
                    alert('Registration link is not available. Please contact the organizers.');
                }
            } else if (mode === 'INTERNAL_FORM') {
                // ✅ CRITICAL: Navigate to internal registration form
                const festId = eventData?.fest?._id || passedEventData?.id || eventData?.festId || eventData?.fest?.id;
                const competitionId = eventData?.id;
                
                console.log('🚀 Navigating to internal form:', { festId, competitionId });
                
                if (festId) {
                    const registrationUrl = `/fest/${festId}/register?competition=${competitionId}`;
                    console.log('🌐 Registration URL:', registrationUrl);
                    navigate(registrationUrl);
                } else {
                    alert('Registration is not available. Please contact the organizers.');
                }
            } else if (mode === 'NOT_STARTED') {
                alert('Registration has not started yet for this competition.');
            } else if (mode === 'CLOSED') {
                alert('Registration for this competition is closed.');
            } else {
                console.log('❓ Unknown fest registration mode:', mode);
                alert('Registration configuration is not set up properly. Please contact the organizers.');
            }
        } else if (registrationType === 'custom') {
            console.log('🏆 Using custom competition registration system');
            console.log('📊 eventData.id:', eventData?.id);
            console.log('📊 eventData._id:', eventData?._id);
            // Competition has its own registration system
            if (registrationStatus === 'internal_form') {
                console.log('📝 Redirecting to custom internal form');
                const competitionIdForReg = eventData?.id || eventData?._id;
                console.log('🚀 Navigating to:', `/competition-registration/${competitionIdForReg}`);
                // Navigate to competition-specific registration page
                navigate(`/competition-registration/${competitionIdForReg}`);
            } else if (registrationStatus === 'external_link') {
                console.log('🔗 Opening external link');
                // Open external link
                const externalUrl = eventData?.registration?.externalUrl;
                if (externalUrl && externalUrl.trim() !== '') {
                    window.open(externalUrl, '_blank');
                } else {
                    alert('External registration link not available. Please contact the organizers.');
                }
            } else if (registrationStatus === 'not_started') {
                alert('Registration has not started yet for this competition.');
            } else if (registrationStatus === 'registration_closed') {
                alert('Registration for this competition is closed.');
            } else {
                console.log('❓ Unknown registration status:', registrationStatus);
                alert('Registration configuration is not set up properly. Please contact the organizers.');
            }
        }
        // For legacy compatibility, handle old status values
        else {
            console.log('🔄 Using legacy registration system');
            const competitionRegistrationStatus = eventData?.legacyRegistration?.status || eventData?.registration?.status || 'NOT_STARTED';
            if (competitionRegistrationStatus === 'CLOSED') {
                alert('Registration for this competition is closed.');
            } else if (competitionRegistrationStatus === 'NOT_STARTED' || competitionRegistrationStatus === 'not_started') {
                alert('Registration for this competition has not started yet.');
            } else {
                // Default to showing not started message
                alert('Registration for this competition has not started yet.');
            }
        }
    };

    // Component for rendering rules with read more functionality
    const RulesList = ({ rules, ruleKey, maxItems = 5 }) => {
        const isExpanded = expandedRules[ruleKey];
        
        // Check if this is a message field (single item with line breaks)
        const isMessageField = rules && rules.length === 1 && rules[0] && rules[0].includes('\n');
        
        // For message fields, check character length; for rule arrays, check item count
        const shouldTruncate = isMessageField 
            ? rules[0].length > 300  // Truncate if message is longer than 300 characters
            : rules && rules.length > maxItems;
            
        const displayRules = shouldTruncate && !isExpanded 
            ? (isMessageField 
                ? [rules[0].substring(0, 300) + '...'] 
                : rules.slice(0, maxItems))
            : rules;

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
                                : `Show More (${rules.length - maxItems} more rules)`)}
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

    const handleContact = (type) => {
        if (type === 'phone' && eventData?.contact?.phone) {
            // Extract only the first phone number if multiple numbers exist
            const phoneString = eventData.contact.phone;
            // Match the first valid phone number pattern (+91 followed by digits)
            const firstPhoneMatch = phoneString.match(/\+91\s*\d{10}|\+91\s*\d{5}\s*\d{5}/);
            const mainPhone = firstPhoneMatch ? firstPhoneMatch[0].replace(/\s/g, '') : phoneString.split('/')[0].trim();
            window.open(`tel:${mainPhone}`);
        } else if (type === 'instagram' && eventData?.contact?.instagram) {
            window.open(eventData.contact.instagram, '_blank');
        }
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
        <div className={`min-h-screen flex flex-col transition-colors ${isDark ? 'bg-[#0E0E0F]' : 'bg-[#F5F6FA]'}`}>

            <main className={`flex-1 pb-8 ${isDark ? 'bg-[#0E0E0F]' : 'bg-gray-50'}`}>
                    <div className="max-w-7xl mx-auto">
                        {/* Mobile/Narrow Layout - Only visible below 768px */}
                        <div className="block md:hidden">
                            {/* Mobile Back Button */}
                            <div className="px-4 pt-4 pb-2">
                                <button
                                    onClick={() => navigate(-1)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                        isDark 
                                            ? 'bg-[#1B1C1E] text-gray-300 hover:bg-[#2A2B2D] hover:text-white' 
                                            : 'bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                    } shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-sm font-medium">Back</span>
                                </button>
                            </div>

                            {/* Mobile Event Image */}
                            <div className="px-4 pt-4">
                                <div className="bg-[#F5F6FA] dark:bg-[#1B1C1E] rounded-lg overflow-hidden shadow-sm">
                                    <img
                                        src={getImageUrl(eventData?.image) || '/default-image.jpg'}
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
                                    <p><span className="font-semibold">Entry fee:</span> {eventData?.entryFee || 'Free'}</p>
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
                                            : 'bg-gradient-to-r from-[#0060DF] to-[#00C2CB] text-white hover:opacity-90'
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
                                    <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-white'} rounded-lg p-4 shadow-sm`}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className={`text-xl ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>🏆</span>
                                            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>PRIZE POOL</h2>
                                        </div>
                                        <div 
                                            className={`font-medium whitespace-pre-wrap leading-relaxed text-sm ${
                                                isDark ? 'text-gray-300' : 'text-gray-900'
                                            }`}
                                            style={{ whiteSpace: 'pre-wrap' }}
                                        >
                                            {eventData.prize}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* Mobile Competition Rounds - Only show if rounds exist */}
                            {(eventData?.rounds?.round1 || eventData?.rounds?.round2 || eventData?.rounds?.round3) && (
                            <div className="px-4 py-4">
                                <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-white'} rounded-lg p-4 shadow-sm`}>
                                    <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Competition Rounds</h2>
                                    {eventData?.rounds?.description && (
                                    <div className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                        <div 
                                            className="whitespace-pre-wrap"
                                            style={{ whiteSpace: 'pre-wrap' }}
                                        >
                                            {eventData.rounds.description}
                                        </div>
                                    </div>
                                    )}

                                    {/* Mobile Round Tabs - Dynamic based on available rounds */}
                                    {(eventData?.rounds?.round2 || eventData?.rounds?.round3) && !festName?.toLowerCase().includes('symbi') && (
                                        <div className={`grid gap-2 mb-4 mt-4 ${eventData?.rounds?.round3 ? 'grid-cols-3' :
                                            eventData?.rounds?.round2 ? 'grid-cols-2' : 'grid-cols-1'
                                            }`}>
                                            <button
                                                onClick={() => setActiveRound('round1')}
                                                className={`py-3 px-3 rounded-lg font-medium transition text-sm ${activeRound === 'round1'
                                                    ? `border-2 border-[#00C2CB] ${isDark ? 'bg-dark-700 text-white' : 'bg-blue-50 text-black'}`
                                                    : `${isDark ? 'bg-dark-700 text-gray-300' : 'bg-gray-100 text-black'}`
                                                    }`}
                                            >
                                                Round 1
                                            </button>
                                            {eventData?.rounds?.round2 && (
                                                <button
                                                    onClick={() => setActiveRound('round2')}
                                                    className={`py-3 px-3 rounded-lg font-medium transition text-sm ${activeRound === 'round2'
                                                        ? `border-2 border-[#00C2CB] ${isDark ? 'bg-dark-700 text-white' : 'bg-blue-50 text-black'}`
                                                        : `${isDark ? 'bg-dark-700 text-gray-300' : 'bg-gray-100 text-black'}`
                                                        }`}
                                                >
                                                    Round 2
                                                </button>
                                            )}
                                            {eventData?.rounds?.round3 && (
                                                <button
                                                    onClick={() => setActiveRound('round3')}
                                                    className={`py-3 px-3 rounded-lg font-medium transition text-sm ${activeRound === 'round3'
                                                        ? `border-2 border-[#00C2CB] ${isDark ? 'bg-dark-700 text-white' : 'bg-blue-50 text-black'}`
                                                        : `${isDark ? 'bg-dark-700 text-gray-300' : 'bg-gray-100 text-black'}`
                                                        }`}
                                                >
                                                    Round 3
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Mobile Round Content - Only show if rounds exist */}
                                    {(eventData?.rounds?.round1 || eventData?.rounds?.round2 || eventData?.rounds?.round3) && (
                                    <div className="space-y-4">
                                        {activeRound === 'round1' && eventData?.rounds?.round1 ? (
                                            <>
                                                {eventData?.rounds?.round1?.title && (
                                                <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {eventData.rounds.round1.title}
                                                </h3>
                                                )}

                                                {eventData?.rounds?.round1?.offline && (
                                                    <div className={`${isDark ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-4`}>
                                                        <p className={`font-semibold mb-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                            {eventData?.rounds?.round1?.offline?.title || 'Offline Round'}
                                                        </p>
                                                        <RulesList
                                                            rules={eventData?.rounds?.round1?.offline?.rules}
                                                            ruleKey={`mobile-round1-offline-${eventData?.id}`}
                                                            maxItems={5}
                                                        />
                                                    </div>
                                                )}

                                                {eventData?.rounds?.round1?.online && (
                                                    <div className={`${isDark ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-4`}>
                                                        <p className={`font-semibold mb-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                            {eventData?.rounds?.round1?.online?.title || 'Online Round'}
                                                        </p>
                                                        <RulesList
                                                            rules={eventData?.rounds?.round1?.online?.rules}
                                                            ruleKey={`mobile-round1-online-${eventData?.id}`}
                                                            maxItems={5}
                                                        />
                                                    </div>
                                                )}

                                                {!eventData?.rounds?.round1?.offline && !eventData?.rounds?.round1?.online && eventData?.rounds?.round1?.rules && (
                                                    <div className={`${isDark ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-4`}>
                                                        <RulesList
                                                            rules={getRoundRules(eventData?.rounds?.round1)}
                                                            ruleKey={`mobile-round1-${eventData?.id}`}
                                                            maxItems={5}
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        ) : activeRound === 'round2' ? (
                                            <>
                                                <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {eventData?.rounds?.round2?.title || 'Round 2'}
                                                </h3>

                                                <div className={`${isDark ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-4`}>
                                                    <RulesList
                                                        rules={getRoundRules(eventData?.rounds?.round2)}
                                                        ruleKey={`mobile-round2-${eventData?.id}`}
                                                        maxItems={5}
                                                    />
                                                </div>
                                            </>
                                        ) : activeRound === 'round3' && eventData?.rounds?.round3 ? (
                                            <>
                                                {(eventData?.rounds?.round3?.description && eventData.rounds.round3.description.trim()) ? (
                                                    <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        {eventData.rounds.round3.description}
                                                    </p>
                                                ) : null}

                                                <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {eventData.rounds.round3.title || 'Round 3'}
                                                </h3>

                                                <div className={`${isDark ? 'bg-dark-700' : 'bg-gray-50'} rounded-lg p-4`}>
                                                    <RulesList
                                                        rules={getRoundRules(eventData?.rounds?.round3)}
                                                        ruleKey={`mobile-round3-${eventData?.id}`}
                                                        maxItems={5}
                                                    />
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                    )}
                                </div>
                            </div>
                            )}

                            {/* Mobile Common Rules */}
                            <div className="px-4 py-4">
                                <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-white'} rounded-lg p-4 shadow-sm`}>
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
                                <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-white'} rounded-lg p-4 shadow-sm`}>
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
                                            <div className="space-y-2">
                                                {eventData.contact.phone.includes(' / ') 
                                                    ? eventData.contact.phone.split(' / ').map((phone, index) => (
                                                        <a
                                                            key={index}
                                                            href={`tel:${phone.replace(/\s*\([^)]*\)/, '').trim()}`}
                                                            className={`block text-sm ${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'} transition pl-7`}
                                                        >
                                                            {phone.trim()}
                                                        </a>
                                                    ))
                                                    : (
                                                        <a
                                                            href={`tel:${eventData.contact.phone.replace(/\s*\([^)]*\)/, '').trim()}`}
                                                            className={`block text-sm ${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'} transition pl-7`}
                                                        >
                                                            {eventData.contact.phone.trim()}
                                                        </a>
                                                    )
                                                }
                                            </div>
                                        </div>
                                    )}

                                    {/* Instagram */}
                                    {eventData?.contact?.instagram && (
                                        <div className="mb-4">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <div className={`p-1 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full`}>
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
                            <div className="w-1/2 flex-shrink-0 space-y-6">
                                {/* Event Image Card */}
                                <div className="bg-[#F5F6FA] rounded-2xl overflow-hidden">
                                    <img
                                        src={getImageUrl(eventData?.image) || '/default-image.jpg'}
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
                                        <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'} rounded-2xl p-6`}>
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className={`text-2xl ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>🏆</span>
                                                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>PRIZE POOL</h2>
                                            </div>
                                            <div 
                                                className={`font-medium whitespace-pre-wrap leading-relaxed ${
                                                    isDark ? 'text-gray-300' : 'text-gray-900'
                                                }`}
                                                style={{ whiteSpace: 'pre-wrap' }}
                                            >
                                                {eventData.prize}
                                            </div>
                                        </div>
                                    )}

                                    {/* Common Rules */}
                                    <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'} rounded-2xl p-6`}>
                                        <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Rules and Guidelines</h2>
                                        <RulesList
                                            rules={commonRules}
                                            ruleKey={`desktop-common-rules-${eventData?.id}`}
                                            maxItems={5}
                                        />
                                    </div>
                                </div>

                                {/* Contact Details */}
                                <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'} rounded-2xl p-6`}>
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
                                            <div className="flex items-center space-x-3 mb-4">
                                                <div className={`p-2 ${isDark ? 'bg-blue-900 text-blue-400' : 'bg-blue-100 text-blue-600'} rounded-full`}>
                                                    <Phone className="w-5 h-5" />
                                                </div>
                                                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Phone Numbers</p>
                                            </div>
                                            <div className="space-y-2">
                                                {eventData.contact.phone.includes(' / ') 
                                                    ? eventData.contact.phone.split(' / ').map((phone, index) => (
                                                        <a
                                                            key={index}
                                                            href={`tel:${phone.replace(/\s*\([^)]*\)/, '').trim()}`}
                                                            className={`block text-sm ${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'} transition pl-12`}
                                                        >
                                                            {phone.trim()}
                                                        </a>
                                                    ))
                                                    : (
                                                        <a
                                                            href={`tel:${eventData.contact.phone.replace(/\s*\([^)]*\)/, '').trim()}`}
                                                            className={`block text-sm ${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'} transition pl-12`}
                                                        >
                                                            {eventData.contact.phone.trim()}
                                                        </a>
                                                    )
                                                }
                                            </div>
                                        </div>
                                    )}

                                    {/* Instagram */}
                                    {eventData?.contact?.instagram && (
                                        <div className="mb-6">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <div className={`p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full`}>
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
                            <div className="w-1/2 flex-shrink-0 space-y-6">
                                {/* Event Header Card */}
                                <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'} rounded-2xl p-6 relative`}>
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

                                    <div className={`mb-4 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                        <p>Entry fee - {eventData?.entryFee || 'Free'}/-</p>
                                    </div>

                                    <div className="flex gap-2 relative">
                                        <button
                                            onClick={handleRegister}
                                            disabled={isRegistered || registrationInfo.isDisabled}
                                            className={`flex-1 py-3 px-4 rounded-full font-semibold transition ${isRegistered
                                                ? 'bg-green-500 text-white cursor-not-allowed'
                                                : registrationInfo.isDisabled
                                                ? 'bg-gray-500 text-white cursor-not-allowed opacity-60'
                                                : 'bg-gradient-to-r from-[#0060DF] to-[#00C2CB] text-white hover:opacity-90'
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
                                {(eventData?.rounds?.round1 || eventData?.rounds?.round2 || eventData?.rounds?.round3) && (
                                <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'} rounded-2xl p-6`}>
                                    <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{eventData?.title || 'Competition'} Rounds</h2>
                                    {eventData?.rounds?.description && (
                                    <div className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                        <div 
                                            className="whitespace-pre-wrap"
                                            style={{ whiteSpace: 'pre-wrap' }}
                                        >
                                            {eventData.rounds.description}
                                        </div>
                                    </div>
                                    )}

                                    {/* Desktop Round Tabs - Dynamic based on available rounds */}
                                    {(eventData?.rounds?.round2 || eventData?.rounds?.round3) && !festName?.toLowerCase().includes('symbi') && (
                                        <div className={`flex gap-2 mb-6 ${eventData?.rounds?.round3 ? 'grid grid-cols-3' : 'flex'}`}>
                                            <button
                                                onClick={() => setActiveRound('round1')}
                                                className={`flex-1 py-2 px-4 rounded-2xl font-medium transition ${activeRound === 'round1'
                                                    ? `border-2 border-[#00C2CB] ${isDark ? 'bg-dark-700 text-white' : 'bg-[#F5F6FA] text-black'}`
                                                    : `shadow-md ${isDark ? 'bg-dark-700 text-gray-300' : 'bg-[#F5F6FA] text-black'}`
                                                    }`}
                                            >
                                                Round 1
                                            </button>
                                            {eventData?.rounds?.round2 && (
                                                <button
                                                    onClick={() => setActiveRound('round2')}
                                                    className={`flex-1 py-2 px-4 rounded-2xl font-medium transition ${activeRound === 'round2'
                                                        ? `border-2 border-[#00C2CB] ${isDark ? 'bg-dark-700 text-white' : 'bg-[#F5F6FA] text-black'}`
                                                        : `shadow-md ${isDark ? 'bg-dark-700 text-gray-300' : 'bg-[#F5F6FA] text-black'}`
                                                        }`}
                                                >
                                                    Round 2
                                                </button>
                                            )}
                                            {eventData?.rounds?.round3 && (
                                                <button
                                                    onClick={() => setActiveRound('round3')}
                                                    className={`flex-1 py-2 px-4 rounded-2xl font-medium transition ${activeRound === 'round3'
                                                        ? `border-2 border-[#00C2CB] ${isDark ? 'bg-dark-700 text-white' : 'bg-[#F5F6FA] text-black'}`
                                                        : `shadow-md ${isDark ? 'bg-dark-700 text-gray-300' : 'bg-[#F5F6FA] text-black'}`
                                                        }`}
                                                >
                                                    Round 3
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        {activeRound === 'round1' && eventData?.rounds?.round1 ? (
                                            <>
                                                {eventData?.rounds?.round1?.title && (
                                                <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {eventData.rounds.round1.title}
                                                </h3>
                                                )}

                                                {eventData?.rounds?.round1?.offline && (
                                                    <div className="mb-4">
                                                        <p className={`font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                            {eventData.rounds.round1.offline.title || 'Offline Round'}
                                                        </p>
                                                        <RulesList
                                                            rules={eventData.rounds.round1.offline.rules}
                                                            ruleKey={`desktop-round1-offline-${eventData?.id}`}
                                                            maxItems={5}
                                                        />
                                                    </div>
                                                )}

                                                {eventData?.rounds?.round1?.online && (
                                                    <div className="mb-4">
                                                        <p className={`font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                            {eventData.rounds.round1.online.title || 'Online Round'}
                                                        </p>
                                                        <RulesList
                                                            rules={eventData.rounds.round1.online.rules}
                                                            ruleKey={`desktop-round1-online-${eventData?.id}`}
                                                            maxItems={5}
                                                        />
                                                    </div>
                                                )}

                                                {!eventData?.rounds?.round1?.offline && !eventData?.rounds?.round1?.online && eventData?.rounds?.round1?.rules && (
                                                    <RulesList
                                                        rules={getRoundRules(eventData?.rounds?.round1)}
                                                        ruleKey={`desktop-round1-${eventData?.id}`}
                                                        maxItems={5}
                                                    />
                                                )}
                                            </>
                                        ) : activeRound === 'round2' ? (
                                            <>
                                                {(eventData?.rounds?.round2?.description && eventData.rounds.round2.description.trim()) ? (
                                                    <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        {eventData.rounds.round2.description}
                                                    </p>
                                                ) : null}

                                                <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {eventData?.rounds?.round2?.title || 'Round 2'}
                                                </h3>

                                                <RulesList
                                                    rules={getRoundRules(eventData?.rounds?.round2)}
                                                    ruleKey={`desktop-round2-${eventData?.id}`}
                                                    maxItems={5}
                                                />
                                            </>
                                        ) : activeRound === 'round3' && eventData?.rounds?.round3 ? (
                                            <>
                                                {(eventData?.rounds?.round3?.description && eventData.rounds.round3.description.trim()) ? (
                                                    <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        {eventData.rounds.round3.description}
                                                    </p>
                                                ) : null}

                                                <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {eventData.rounds.round3.title || 'Round 3'}
                                                </h3>

                                                <RulesList
                                                    rules={getRoundRules(eventData?.rounds?.round3)}
                                                    ruleKey={`desktop-round3-${eventData?.id}`}
                                                    maxItems={5}
                                                />
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>

                {/* Spacer for fixed mobile footer */}
                <div className="md:hidden h-20"></div>

                {/* Footer */}
                <Footer />

            {/* Fixed Mobile/Tablet Register Button Footer */}
            <div className={`fixed bottom-0 left-0 right-0 z-40 md:hidden px-4 py-3 ${isDark ? 'bg-[#0F1014] border-t border-gray-700' : 'bg-white border-t border-gray-200'}`}>
                <button
                    onClick={handleRegister}
                    disabled={isRegistered || registrationInfo.isDisabled}
                    className={`w-full font-semibold py-3 rounded-xl transition ${
                        registrationInfo.isDisabled
                            ? 'bg-gray-500 hover:bg-gray-600 text-white cursor-not-allowed'
                            : isRegistered
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gradient-to-r from-[#0060DF] to-[#00C2CB] hover:opacity-90 text-white'
                    }`}
                >
                    {isRegistered ? (
                        <>
                            <span className="mr-1">✓</span> Registered
                        </>
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