// Competition Data Service - Transforms real fest data into application format
import festDataJSONFile from './fest-data.json';
import aarohanFestData from './aarohan-fest-data.json';

// Real fest data (imported from JSON)
const festDataJSON = aarohanFestData;


// Import all competition images for proper bundling
import artImg from './aarohan-comition-images/art.jpg';
import bandwarsImg from './aarohan-comition-images/bandwars.png';
import badmintonSoloImg from './aarohan-comition-images/aarohan badminton (solo).jpg';
import badmintonDuoImg from './aarohan-comition-images/aarohan badminton (duo).jpg';
import dastakImg from './aarohan-comition-images/dastak.png';
import groupdanceImg from './aarohan-comition-images/groupdance.jpg';
import nikhildsouzaImg from './aarohan-comition-images/nikhildsouza.jpg';
import platformImg from './aarohan-comition-images/platform.jpg';
import shreyajainImg from './aarohan-comition-images/shreyajain.jpg';
import comedyOnImg from './aarohan-comition-images/comedy-on.jpg';
import solodanceImg from './aarohan-comition-images/solodance.png';
import solosingingImg from './aarohan-comition-images/solosinging.jpg';
import fashionshowImg from './aarohan-comition-images/fashionshow.png';
import cricketImg from './aarohan-comition-images/cricket.jpg';
import footballImg from './aarohan-comition-images/football.png';
import bgmiImg from './symbi-images/BGMI-competion.png';

// Import Symbi UTSAV images
import { symbiBasketball, symbiCricket, symbiFutsal, symbiExpo, symbiMun, symbiBgmi } from '../../utils/imageImports.js';

// Import Persona Fest images - Using fallback images until Persona fest images are available
// Note: persona-fest-images directory doesn't exist yet, using Aarohan images as fallbacks

// Import sponsor images
import sponsor1Img from './aarohan-comition-images/sposer-images/aarohan sponsor 1.png';
import sponsor2Img from './aarohan-comition-images/sposer-images/aarohan sponsor 2.png';
import sponsor3Img from './aarohan-comition-images/sposer-images/aarohan sponsor 3.png';
import sponsor4Img from './aarohan-comition-images/sposer-images/aarohan sponsor 4.png';
import sponsor5Img from './aarohan-comition-images/sposer-images/aarohan sponsor 5.png';

// Utility function to get competition image from local assets
const getCompetitionImage = (category, type, competitionName = '') => {
    // Map competition names to their corresponding imported images
    const competitionImageMap = {
        'InSync': groupdanceImg,
        'Head Bang': bandwarsImg,
        'Dastak': dastakImg,
        'Inner Flame': solodanceImg,
        'Humming': solosingingImg,
        'Platform': platformImg,
        'Art Maestro': artImg,
        'Glamour Nova': fashionshowImg,
        'Box Football': footballImg,
        'Box Cricket': cricketImg,
        'Badminton (Solo)': badmintonSoloImg,
        'Badminton (Duo)': badmintonDuoImg,
        'Gaming Tournament': bgmiImg,
        // Symbi UTSAV competition mappings
        'Quiz Carnival': '/src/data/real-data/symbi-images/Quiz.jpg',
        'Live Band': '/src/data/real-data/symbi-images/band wars.jpg',
        'Flash Mob': '/src/data/real-data/symbi-images/flash mob.jpg',
        'Party Prism - Singing': '/src/data/real-data/symbi-images/singing (party prism).jpg',
        'Fashion Show': '/src/data/real-data/symbi-images/symbi utsav fashion show.jpg',
        'Party Prism - Dance': '/src/data/real-data/symbi-images/dance (party prism).jpg'
    };

    // First try to find image by competition name
    if (competitionName && competitionImageMap[competitionName]) {
        return competitionImageMap[competitionName];
    }

    // Fallback to type-based mapping with local images
    const typeImageMap = {
        'Cultural': {
            'Group Dance': groupdanceImg,
            'Solo Dance': solodanceImg,
            'Band Wars': bandwarsImg,
            'Street Play': dastakImg,
            'Solo Singing': solosingingImg,
            'Open Mic': platformImg,
            'Fine Arts': artImg,
            'Fashion Show': fashionshowImg
        },
        'CULTURAL': {
            'Live Band': '/src/data/real-data/symbi-images/band wars.jpg',
            'Flash Mob': '/src/data/real-data/symbi-images/flash mob.jpg',
            'Party Prism - Singing': '/src/data/real-data/symbi-images/singing (party prism).jpg',
            'Fashion Show': '/src/data/real-data/symbi-images/symbi utsav fashion show.jpg'
        },
        'QUIZ': {
            'Quiz Carnival': '/src/data/real-data/symbi-images/Quiz.jpg',
            'quiz': '/src/data/real-data/symbi-images/Quiz.jpg'
        },
        'Sports': {
            'Singles': badmintonSoloImg, // Using specific badminton image for singles
            'Doubles': badmintonDuoImg,   // Using specific badminton image for doubles
            'Football': footballImg,
            'Cricket': cricketImg
        },
        'GAMING': {
            'BGMI': bgmiImg,
            'Gaming': bgmiImg,
            'Tournament': bgmiImg
        }
    };

    return typeImageMap[category]?.[type] || platformImg; // Default fallback image
};

// Utility function to get Persona Fest competition image
const getPersonaCompetitionImage = (competitionId) => {
    // Map Persona Fest competition IDs to their corresponding fallback images from Aarohan
    const personaImageMap = {
        'vishwadhun_indian_solo_singing': solosingingImg,
        'saptasur_classical_singing': solosingingImg,
        'crescendo_western_solo_singing': solosingingImg,
        'ghoongruh_classical_dance': solodanceImg,
        'step_up_solo_dance_open_genre': solodanceImg,
        'rhydhun_instrumental': solosingingImg,
        'trance_group_dance': groupdanceImg,
        'mega_jam_band_competition': bandwarsImg,
        'show_stopper_fashion_show': artImg
    };

    return personaImageMap[competitionId] || platformImg;
};

// Transform competition data to match application format
const transformCompetitionData = (competition) => {
    const {
        competition_id,
        name,
        category,
        type,
        entry_fee,
        prize,
        rules = [],
        process = {},
        notes = ''
    } = competition;

    // Generate rounds from process data
    let rounds = ['Registration and Verification'];
    if (process.rounds) {
        rounds = [...rounds, ...process.rounds];
    } else {
        rounds.push('Final Round');
    }

    // Override rounds for specific competitions to show only Final Round
    // Check if this is a SPORTS, ACADEMIC, GAMING, QUIZ, or CULTURAL category competition that should show only Final Round
    const shouldShowOnlyFinalRound = (
        category === 'SPORTS' || category === 'ACADEMIC' || category === 'GAMING' || category === 'QUIZ' || category === 'CULTURAL' ||
        name === 'Art Maestro' || name === 'Glamour Nova' || name === 'Platform' ||
        name === 'Box Cricket' || name === 'Box Football' ||
        name === 'Badminton (Solo)' || name === 'Badminton (Duo)'
    );

    if (shouldShowOnlyFinalRound) {
        rounds = ['Final Round'];
    }

    // Format prize money
    const formatPrize = (amount) => `₹${amount?.toLocaleString('en-IN') || 'TBA'}`;

    const prizePool = prize?.winner ?
        formatPrize(prize.winner + (prize.runner_up || 0)) :
        'TBA';

    // Determine team size based on competition type
    const getTeamSize = (type) => {
        const soloTypes = ['Solo Dance', 'Solo Singing', 'Open Mic', 'Fine Arts', 'Fashion Show', 'Singles'];
        if (soloTypes.includes(type)) return '1 member';
        if (type === 'Doubles') return '2 members';
        if (type === 'Group Dance') return '6-16 members';
        if (type === 'Street Play') return '4-20 members';
        if (type === 'Band Wars') return '4-16 members';
        if (type === 'Football') return '8 members (6 on field)';
        if (type === 'Cricket') return '7 members';
        return 'TBA';
    };

    // Build detailed rules from process and rules
    let detailedRules = [...rules];

    // Add all process rules to detailed rules
    Object.keys(process).forEach(key => {
        if (Array.isArray(process[key]) && key !== 'rounds') {
            const sectionTitle = key.split('_').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ') + ' Rules:';
            detailedRules = [...detailedRules, sectionTitle, ...process[key]];
        }
    });

    // Helper function to get the second round rules
    const getSecondRoundRules = () => {
        return process.final_round ||
            process.knockout_stage ||
            process.knockout_rounds ||
            process.final ||
            (rules.length > 0 ? rules : [
                'Live performance on stage',
                'Judges\' decision will be final',
                'Time limits must be strictly followed',
                'All safety guidelines must be followed'
            ]);
    };

    // Build rounds object for detailed view
    // Special handling for specific competitions - show only Final Round
    let roundsList, finalRoundData;

    // Check if this competition should show only Final Round based on category or specific names
    const showOnlyFinalRound = (
        category === 'SPORTS' || category === 'ACADEMIC' || category === 'GAMING' || category === 'QUIZ' || category === 'CULTURAL' ||
        name === 'Art Maestro' || name === 'Glamour Nova' || name === 'Platform' ||
        name === 'Box Cricket' || name === 'Box Football' ||
        name === 'Badminton (Solo)' || name === 'Badminton (Duo)'
    );

    if (showOnlyFinalRound) {
        // For these competitions, show only Final Round
        roundsList = ['Final Round'];
        finalRoundData = {
            title: 'Final Round',
            rules: process.final_round || getSecondRoundRules()
        };
    } else {
        // Regular processing for other competitions
        roundsList = process.rounds || rounds;
        finalRoundData = {
            title: process.rounds?.[1] || process.rounds?.[2] || 'Final Round',
            rules: getSecondRoundRules()
        };
    }

    const roundsObject = {
        description: showOnlyFinalRound
            ? `The ${name} competition will be conducted as a Final Round only.`
            : `The ${name} competition will be conducted in multiple rounds to ensure fair judging and maximum participation.`,
        list: roundsList,
        round1: showOnlyFinalRound
            ? finalRoundData
            : {
                title: process.rounds?.[0] || 'Elimination Round',
                offline: {
                    title: 'Offline Elimination',
                    rules: process.offline_elimination ||
                        process.qualifying_round ||
                        process.preliminary_round ||
                        process.group_stage || [
                            'Same rules as Final Round apply',
                            'Registration fee refunded only if eliminated',
                            'Participants must report 30 minutes before the event'
                        ]
                },
                online: {
                    title: 'Online Elimination',
                    rules: process.online_elimination || [
                        'Submit performance video as per guidelines',
                        'No editing allowed in submissions',
                        'Fee refunded only if eliminated',
                        'Send submissions to aarohan@mitwpu.edu.in'
                    ]
                }
            },
        // Only show round2 for competitions with multiple rounds
        ...(!showOnlyFinalRound && {
            round2: finalRoundData
        })
    };

    // Add additional rounds if they exist (but not for single-round competitions)
    if (!showOnlyFinalRound &&
        process.rounds && process.rounds.length > 2) {
        roundsObject.round3 = {
            title: process.rounds[2],
            rules: process.final || process.final_round || [
                'Championship round',
                'Best of the qualified participants',
                'Final judging and prize distribution'
            ]
        };
    }

    return {
        id: `comp_${competition_id.toString().padStart(3, '0')}`,
        title: name,
        subtitle: `${type} Competition`,
        category: category,
        subcategory: type,
        date: 'To be announced', // Using fest year as base
        time: '', // Hidden for Aarohan competitions
        venue: 'MIT World Peace University, Pune',
        image: getCompetitionImage(category, type, name),
        description: `Join the ${name} - ${type} competition and showcase your talent! ${notes}`.trim(),
        registrationFee: `₹${entry_fee || 'TBA'}`,
        entryFee: `₹${entry_fee || 'TBA'}`,
        prizePool: prizePool,
        prize: prizePool,
        teamSize: getTeamSize(type),
        duration: category === 'Cultural' ?
            (type.includes('Solo') ? '4-5 minutes' : '8-20 minutes') :
            (type === 'Football' ? '20 minutes' : type === 'Cricket' ? '6 overs' : '15 minutes'),
        contact: {
            email: 'aarohan.competitions2026@gmail.com ',
            phone: '+91 99603 95998 / +91 83020 74991 (Tashu Agarwal) / +91 7262-019404 (Pritam Bonde)',
            instagram: 'https://www.instagram.com/mitaarohanfest?igsh=eHZjYXFjMW41aHUy'
        },
        rules: detailedRules.length > 0 ? detailedRules : [
            'All participants must carry valid ID proof',
            'Registration fee is non-refundable unless eliminated',
            'Participants must report 30 minutes before the event',
            'Use of unfair means will lead to disqualification',
            'Organizers reserve the right to modify rules if necessary'
        ],
        commonRules: [
            'The age limit for the participants is 16-35 years.',
            'Performance slots will be allocated by the organizers.',
            'If a performance is interrupted by external disturbances, audio, or lighting issues, the team may be allowed to restart or continue, as determined by the judges.',
            'In case of interruptions or mishaps caused by the performers themselves, the decision to allow a restart or continuation will be at the judge s discretion.',
            'If an unforeseeable event requires the participating team to stop their performance, any team member may signal a member of the organizing team.',
            'The decision to restart, continue, or terminate the performance will be made by the judges.',
            'Failure to be present at the allocated time will result in disqualification. In case of unavoidable circumstances, participants must contact the organizers.',
            'Participation fees are non-refundable under any circumstances.',
            'Decisions made by the organizers and judges are final and binding.',
            'Teams must adhere to the allotted performance time. Exceeding the time limit may result in penalties or disqualification, as determined by the judges.',
            'Any form of misconduct, inappropriate behavior, or violation of the event\'s code of conduct may lead to immediate disqualification at the discretion of the organizers.'
        ],
        prizes: {
            first: formatPrize(prize?.winner),
            second: formatPrize(prize?.runner_up)
        },
        rounds: roundsObject,
        organizer: 'MIT World Peace University',
        festival: `AAROHAN ${festDataJSON.year}`,
        registrationDeadline: '2026-02-10   ',
        status: 'Open'
    };
};

// Group competitions by category for the events data format
const groupCompetitionsByCategory = () => {
    const competitions = festDataJSON.competitions;
    const grouped = {
        'DANCE': [],
        'MUSIC': [],
        'THEATRE': [],
        'LITERATURE': [],
        'ART': [],
        'SPORTS': [],
        'OTHER': []
    };

    competitions.forEach(comp => {
        const { category, type } = comp;

        if (category === 'Cultural') {
            if (type.toLowerCase().includes('dance')) {
                grouped.DANCE.push({
                    id: `dance_${comp.competition_id.toString().padStart(3, '0')}`,
                    name: comp.name,
                    subtitle: type,
                    image: getCompetitionImage(category, type, comp.name),
                    fee: comp.entry_fee?.toString() || '500',
                    prize: comp.prize
                });
            } else if (type.toLowerCase().includes('band') || type.toLowerCase().includes('sing')) {
                grouped.MUSIC.push({
                    id: `music_${comp.competition_id.toString().padStart(3, '0')}`,
                    name: comp.name,
                    subtitle: type,
                    image: getCompetitionImage(category, type, comp.name),
                    fee: comp.entry_fee?.toString() || '500',
                    prize: comp.prize
                });
            } else if (type.toLowerCase().includes('play') || type.toLowerCase().includes('mic')) {
                grouped.THEATRE.push({
                    id: `theatre_${comp.competition_id.toString().padStart(3, '0')}`,
                    name: comp.name,
                    subtitle: type,
                    image: getCompetitionImage(category, type, comp.name),
                    fee: comp.entry_fee?.toString() || '500',
                    prize: comp.prize
                });
            } else if (type.toLowerCase().includes('art') || type.toLowerCase().includes('fashion')) {
                grouped.ART.push({
                    id: `art_${comp.competition_id.toString().padStart(3, '0')}`,
                    name: comp.name,
                    subtitle: type,
                    image: getCompetitionImage(category, type, comp.name),
                    fee: comp.entry_fee?.toString() || '500',
                    prize: comp.prize
                });
            } else {
                grouped.OTHER.push({
                    id: `other_${comp.competition_id.toString().padStart(3, '0')}`,
                    name: comp.name,
                    subtitle: type,
                    image: getCompetitionImage(category, type, comp.name),
                    fee: comp.entry_fee?.toString() || '500',
                    prize: comp.prize
                });
            }
        } else if (category === 'Sports') {
            grouped.SPORTS.push({
                id: `sports_${comp.competition_id.toString().padStart(3, '0')}`,
                name: comp.name,
                subtitle: type,
                image: getCompetitionImage(category, type, comp.name),
                fee: comp.entry_fee?.toString() || '500',
                prize: comp.prize
            });
        }
    });

    // Remove empty categories
    Object.keys(grouped).forEach(key => {
        if (grouped[key].length === 0) {
            delete grouped[key];
        }
    });

    return grouped;
};

// Transform Persona Fest competition data to match application format
const transformPersonaCompetitionData = (competition) => {
    const {
        id,
        name,
        title,
        short_description,
        performance_category,
        language_requirement,
        style,
        team_size,
        rounds,
        rules = [],
        coordinators
    } = competition;

    // Generate competitive ID
    const competitionId = `persona_${id.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Format team size display
    const formatTeamSize = (size) => {
        if (size.min === size.max) {
            return `${size.min} member${size.min > 1 ? 's' : ''}`;
        }
        return `${size.min}-${size.max} members`;
    };

    // Build detailed rules
    const detailedRules = [
        ...rules,
        'All participants must carry valid ID proof',
        'Participants must report 30 minutes before the event',
        'Judges\' decisions are final and binding',
        'Use of unfair means will lead to disqualification'
    ];

    // Build rounds object for detailed view
    const roundsObject = {
        description: `The ${name} competition will be conducted in multiple rounds to ensure fair judging and maximum participation.`,
        list: rounds.map(round => round.name),
        round1: {
            title: rounds[0]?.name || 'Registration',
            rules: rounds[0]?.description ? [rounds[0].description] : ['Registration and verification process']
        }
    };

    if (rounds[1]) {
        roundsObject.round2 = {
            title: rounds[1].name,
            rules: rounds[1].description ? [rounds[1].description] : ['Live performance round']
        };
    }

    return {
        id: competitionId,
        title: name,
        subtitle: title,
        category: 'Cultural',
        subcategory: performance_category,
        date: 'TBA', // Persona Fest dates not announced
        time: 'TBA',
        venue: 'MIT Art, Design & Technology University, Loni Kalbhor, Maharashtra',
        image: getPersonaCompetitionImage(id, name),
        description: short_description,
        registrationFee: 'TBA',
        entryFee: 'TBA',
        prizePool: 'TBA',
        prize: 'TBA',
        teamSize: formatTeamSize(team_size),
        duration: rounds[1] ? `${rounds[1].min_duration_minutes || rounds[1].max_duration_minutes || 'TBA'} minutes` : 'TBA',
        contact: {
            email: coordinators?.faculty?.phone ? `faculty@mitadt.edu.in` : 'info@mitadt.edu.in',
            phone: coordinators?.faculty?.phone || coordinators?.students?.[0]?.phone || 'TBA',
            instagram: 'https://instagram.com/persona_fest_2025'
        },
        rules: detailedRules,
        commonRules: [
            'All participants must be under 25 years of age',
            'All participants must carry valid ID proof vijay ',
            'Participants must report 30 minutes before the event',
            'Music tracks (if required) should be in MP3 format',
            'Judges\' decisions are final and binding in all events'
        ],
        prizes: {
            first: 'TBA',
            second: 'TBA',
            third: 'TBA'
        },
        rounds: roundsObject,
        organizer: 'MIT Art, Design & Technology University',
        festival: 'Persona Fest 2025',
        registrationDeadline: 'TBA',
        status: 'Registrations not started yet',
        languageRequirement: language_requirement,
        style: style,
        coordinators: coordinators
    };
};

// Get Persona Fest competitions
export const getPersonaCompetitions = () => {
    const personaFest = festDataJSONFile.added_fests?.find(fest => fest.fest_name === 'Persona Fest 2025');
    if (!personaFest || !personaFest.competitions) return [];

    return personaFest.competitions.map(transformPersonaCompetitionData);
};

// Get all competitions in transformed format (including both Aarohan and Persona)
export const getAllCompetitions = () => {
    const aarohanComps = festDataJSON.competitions.map(transformCompetitionData);
    const personaComps = getPersonaCompetitions();
    return [...aarohanComps, ...personaComps];
};

// Transform SYMBI UTSAV competition data from eventsData format
const transformSymbiCompetitionData = (competition, category) => {
    // Handle registration fee - use from eventData if available, otherwise use fee
    const registrationFeeText = competition.eventData?.registration_fee || `₹${competition.fee}`;

    return {
        id: competition.id,
        title: competition.name,
        subtitle: competition.subtitle,
        category: category,
        subcategory: category.toLowerCase(),
        date: competition.date || '2025-12-10', // Use actual date from data
        time: competition.time || '09:00 AM', // Use actual time from data
        venue: competition.venue || 'Symbiosis Junior College, Kiwale',
        image: competition.image || getCompetitionImage(category, category.toLowerCase(), competition.name),
        description: `Join the ${competition.name} and showcase your talent at SYMBI UTSAV 2025!`,
        registrationFee: registrationFeeText,
        entryFee: registrationFeeText,
        prizePool: category === 'GAMING' && competition.eventData?.prize_pool?.total
            ? `₹${competition.eventData.prize_pool.total}`
            : (competition.prize === 'TBA' || competition.prize === null) ? null : (competition.prize.includes('₹') ? competition.prize : `₹${competition.prize}`),
        prize: category === 'GAMING' && competition.eventData?.prize_pool?.total
            ? `₹${competition.eventData.prize_pool.total}`
            : (competition.prize === 'TBA' || competition.prize === null) ? null : (competition.prize.includes('₹') ? competition.prize : `₹${competition.prize}`),
        teamSize: category === 'SPORTS' ? '3-5 members' : (category === 'CULTURAL' ? '1-10 members' : '1-4 members'),
        duration: category === 'SPORTS' ? '15-20 minutes' : (category === 'CULTURAL' ? '5-10 minutes' : '30-60 minutes'),
        contact: {
            email: 'admissions@symbiosisjrcollege.ac.in',
            phone: '+91-9637214982',
            instagram: 'https://instagram.com/symbiosisjrcollege'
        },
        rules: competition.eventData?.rules_and_regulations || [
            'All participants must be students with valid ID proof',
            'Participants must report 30 minutes before the event',
            'Time limits must be strictly adhered to',
            'Judges\' decisions are final and binding',
            'Any form of misconduct will lead to disqualification'
        ],
        commonRules: competition.eventData?.general_rules || [
            "Each participant should carry ID proof.",
            "On-spot entry is not obliged.",
            "Students should refrain from abusive language; violation will result in disqualification.",
            "Points will be awarded based on presentation, knowledge of the topic, and communication."

        ],
        prizes: {
            first: category === 'GAMING' && competition.eventData?.prize_pool
                ? `₹${competition.eventData.prize_pool.first}`
                : category === 'SPORTS'
                    ? '₹6,000'
                    : (typeof competition.prize === 'string' && competition.prize.includes('₹'))
                        ? competition.prize
                        : `₹${competition.prize}`,
            second: category === 'GAMING' && competition.eventData?.prize_pool
                ? `₹${competition.eventData.prize_pool.second}`
                : category === 'SPORTS'
                    ? '₹4,000'
                    : `₹${Math.floor((typeof competition.prize === 'string' ? parseInt(competition.prize.replace(/[₹,]/g, '')) : competition.prize) * 0.6).toLocaleString()}`,
            third: category === 'GAMING' && competition.eventData?.prize_pool
                ? `₹${competition.eventData.prize_pool.third}`
                : category === 'SPORTS'
                    ? 'Gift hampers'
                    : `₹${Math.floor((typeof competition.prize === 'string' ? parseInt(competition.prize.replace(/[₹,]/g, '')) : competition.prize) * 0.3).toLocaleString()}`
        },
        rounds: {
            description: (category === 'SPORTS' || category === 'ACADEMIC' || category === 'GAMING' || category === 'QUIZ' || category === 'CULTURAL')
                ? `The ${competition.name} will be conducted as a Final Round only.`
                : `The ${competition.name} will be conducted as per SYMBI UTSAV guidelines.`,
            list: (category === 'SPORTS' || category === 'ACADEMIC' || category === 'GAMING' || category === 'QUIZ' || category === 'CULTURAL')
                ? ['']
                : ['Registration', 'Main Event'],
            round1: (category === 'SPORTS' || category === 'ACADEMIC' || category === 'GAMING' || category === 'QUIZ' || category === 'CULTURAL')
                ? {
                    title: 'Final Round',
                    rules: competition.eventData?.rules_and_regulations || [
                        "Participants may bring friends from other colleges to create a team.",
                        "ID Card, Bonafide Certificate, and Birth Certificate are compulsory for each player.",
                        "Food stalls and refreshments will be available.",
                        "Medi-kit will be available.",
                        "No abusive language – violation leads to disqualification.",
                        "No arguing with the umpires.",
                        "Knockout format for all sports."

                    ]
                }
                : {
                    title: 'Registration',
                    rules: [
                        "Participants may bring friends from other colleges to create a team.",
                        "ID Card, Bonafide Certificate, and Birth Certificate are compulsory for each player.",
                        "Food stalls and refreshments will be available.",
                        "Medi-kit will be available.",
                        "No abusive language – violation leads to disqualification.",
                        "No arguing with the umpires.",
                        "Knockout format for all sports."
                    ]
                },
            // Only show round2 for non-SPORTS/ACADEMIC/GAMING/QUIZ/CULTURAL competitions
            ...((category !== 'SPORTS' && category !== 'ACADEMIC' && category !== 'GAMING' && category !== 'QUIZ' && category !== 'CULTURAL') && {
                round2: {
                    title: 'Main Event',
                    rules: [
                        'Report at designated venue on time',
                        'Follow event-specific guidelines',
                        'Maintain discipline and sportsmanship',
                        'Judges\' decision will be final'
                    ]
                }
            })
        },
        organizer: 'Symbiosis Junior College',
        festival: 'SYMBI UTSAV 2025',
        registrationDeadline: '2025-12-05',
        status: 'Open',
        fest: 'SYMBI UTSAV'
    };
};

// Import SYMBI UTSAV JSON data
import symbiUtsavData from './symbi-utsav-fest-data.json';

// Get SYMBI UTSAV competitions from the actual JSON data
const getSymbiCompetitions = () => {
    const allSymbiComps = [];

    // Map events from JSON to competition format
    symbiUtsavData.events.forEach(event => {
        let category = 'OTHER';
        let competitionData = {};

        // Determine category and create competition data based on event
        if (event.event_id === 2) { // MUN
            category = 'ACADEMIC';
            competitionData = {
                id: 'symbi_academic_001',
                name: event.title.replace('SYMBI UTSAV 2025 ', ''),
                subtitle: event.description,
                image: symbiMun,
                fee: '800',
                prize: '8000',
                date: event.date,
                time: event.time || '09:00 AM',
                venue: event.venue,
                eventData: event // Pass the full event data to access rules_and_regulations
            };
            console.log('MUN competition data created with image:', symbiMun);
        } else if (event.event_id === 3) { // Curriculum Expo
            category = 'ACADEMIC';
            competitionData = {
                id: 'symbi_academic_002',
                name: event.title,
                subtitle: event.description,
                image: symbiExpo,
                fee: event.registration_fee?.toString() || '500',
                prize: '5000',
                date: event.date,
                time: event.reporting_time || event.time || '09:00 AM',
                venue: 'Symbiosis Junior College, Kiwale Campus',
                eventData: event // Pass the full event data to access rules_and_regulations
            };
            console.log('Curriculum Expo competition data created with image:', symbiExpo);
        } else if (event.event_id === 4) { // 3x3 Basketball
            category = 'SPORTS';
            competitionData = {
                id: 'symbi_sports_001',
                name: event.title.replace(' Tournament', ''),
                subtitle: event.description,
                image: symbiBasketball,
                fee: event.registration_fee?.toString() || '1500',
                prize: event.prizes?.total?.toString() || '10000',
                date: event.date,
                time: event.time || '08:00 AM',
                venue: event.venue
            };
            console.log('Basketball competition data created with image:', symbiBasketball);
        } else if (event.event_id === 5) { // Box Cricket
            category = 'SPORTS';
            competitionData = {
                id: 'symbi_sports_002',
                name: event.title.replace(' Tournament', ''),
                subtitle: event.description,
                image: symbiCricket,
                fee: event.registration_fee?.toString() || '1500',
                prize: event.prizes?.total?.toString() || '10000',
                date: event.date,
                time: event.time || '08:00 AM',
                venue: event.venue
            };
            console.log('Cricket competition data created with image:', symbiCricket);
        } else if (event.event_id === 6) { // Futsal
            category = 'SPORTS';
            competitionData = {
                id: 'symbi_sports_003',
                name: event.title.replace(' Tournament', ''),
                subtitle: event.description,
                image: symbiFutsal,
                fee: event.registration_fee?.toString() || '1500',
                prize: event.prizes?.total?.toString() || '10000',
                date: event.date,
                time: event.time || '08:00 AM',
                venue: event.venue
            };
            console.log('Futsal competition data created with image:', symbiFutsal);
        } else if (event.event_id === 7) { // Gaming
            category = 'GAMING';
            competitionData = {
                id: 'symbi_gaming_001',
                name: event.title.replace(' – BGMI', ''),
                subtitle: event.description,
                image: symbiBgmi,
                fee: event.registration_fee?.toString() || '500',
                prize: event.prize_pool?.total?.toString() || '7000',
                date: event.date,
                time: event.time || 'TBD',
                venue: event.venue,
                eventData: event // Pass the full event data to access prize_pool details
            };
        } else if (event.event_id === 12) { // Quiz Carnival
            category = 'QUIZ';
            competitionData = {
                id: 'symbi_quiz_001',
                name: event.title,
                subtitle: event.description,
                image: event.image,
                fee: event.registration_fee?.toString() || 'TBA',
                prize: event.prize_pool?.toString() || 'TBA',
                date: event.date,
                time: event.time || '10:30 AM',
                venue: event.venue,
                eventData: event // Pass the full event data to access rules_and_regulations
            };
        } else if (event.event_id === 13) { // Live Band
            category = 'CULTURAL';
            competitionData = {
                id: 'symbi_cultural_001',
                name: event.title,
                subtitle: event.description,
                image: event.image,
                fee: event.registration_fee?.toString() || '1500',
                prize: event.prize_pool?.toString() || 'TBA',
                date: event.date,
                time: event.time || '02:00 PM',
                venue: event.venue,
                eventData: event // Pass the full event data to access rules_and_regulations
            };
        } else if (event.event_id === 14) { // Flash Mob
            category = 'CULTURAL';
            competitionData = {
                id: 'symbi_cultural_002',
                name: event.title,
                subtitle: event.description,
                image: event.image,
                fee: event.registration_fee?.toString() || '100',
                prize: event.prize_pool?.toString() || 'TBA',
                date: event.date,
                time: event.time || '12:30 PM',
                venue: event.venue,
                eventData: event // Pass the full event data to access rules_and_regulations
            };
        } else if (event.event_id === 15) { // Party Prism - Singing
            category = 'CULTURAL';
            competitionData = {
                id: 'symbi_cultural_003',
                name: event.title,
                subtitle: event.description,
                image: event.image,
                fee: 'Solo: ₹500, Group: ₹100',
                prize: event.prize_pool?.toString() || 'TBA',
                date: event.date,
                time: event.time || '10:00 AM',
                venue: event.venue,
                eventData: event // Pass the full event data to access rules_and_regulations
            };
        } else if (event.event_id === 16) { // Fashion Show
            category = 'CULTURAL';
            competitionData = {
                id: 'symbi_cultural_004',
                name: event.title,
                subtitle: event.description,
                image: event.image,
                fee: event.registration_fee?.toString() || 'TBD',
                prize: event.prize_pool?.toString() || 'TBA',
                date: event.date,
                time: event.time || 'TBD',
                venue: event.venue,
                eventData: event // Pass the full event data to access rules_and_regulations
            };
        } else if (event.event_id === 17) { // Party Prism - Dance
            category = 'CULTURAL';
            competitionData = {
                id: 'symbi_cultural_005',
                name: event.title,
                subtitle: event.description,
                image: event.image,
                fee: 'Solo: ₹500, Group: ₹100',
                prize: event.prize_pool?.toString() || 'TBA',
                date: event.date,
                time: event.time || '11:00 AM',
                venue: event.venue,
                eventData: event // Pass the full event data to access rules_and_regulations
            };
        }

        // Add all competitions
        if (Object.keys(competitionData).length > 0) {
            allSymbiComps.push(transformSymbiCompetitionData(competitionData, category));
        }
    });

    return allSymbiComps;
};

// Get competitions for a specific fest
export const getCompetitionsByFest = (festName) => {
    const festLower = festName?.toLowerCase();

    if (festLower?.includes('aarohan')) {
        // Return only AAROHAN competitions
        return festDataJSON.competitions.map(transformCompetitionData);
    } else if (festLower?.includes('persona')) {
        // Return only Persona Fest competitions
        return getPersonaCompetitions();
    } else if (festLower?.includes('symbi')) {
        // Return only SYMBI UTSAV competitions
        return getSymbiCompetitions();
    }

    // Default: return empty array to prevent mixing
    return [];
};

// Get competition by ID within a specific fest context
export const getCompetitionById = (id, festName = null) => {
    if (festName) {
        const competitions = getCompetitionsByFest(festName);
        return competitions.find(comp => comp.id === id);
    }

    // Fallback to all competitions if no fest specified
    const competitions = getAllCompetitions();
    return competitions.find(comp => comp.id === id);
};

// Get competitions by category within a specific fest context
export const getCompetitionsByCategory = (category, festName = null) => {
    const competitions = festName ? getCompetitionsByFest(festName) : getAllCompetitions();
    return competitions.filter(comp => comp.category.toLowerCase() === category.toLowerCase());
};

// Get the fest data in the format expected by eventsData.js
export const getFestDataForEvents = () => {
    const competitions = groupCompetitionsByCategory();

    return {
        id: "fest_001",
        title: "AAROHAN",
        subtitle: "Dates to be announced • MIT World Peace University, Pune",
        organizing_body: "MIT World Peace University",
        festival_name: "AAROHAN",
        fest_name: "AAROHAN", // Add fest identifier
        event_type: "Cultural Festival",
        type: "cultural",
        description: "MIT-WPU's premier cultural festival showcasing talent across various artistic domains including dance, music, drama, and fine arts",
        overview: "Aarohan, the cultural fest of MIT WPU and Pune's largest college fest, has grown rapidly since its inception in 2014. This 3-day celebration brings together young talents from across the country, offering a platform to showcase their skills through exciting events and performances. Known for captivating audiences with competitive events and stellar performances by renowned artists, Aarohan attracts over 40,000 attendees annually. As a student-driven fest, it continues to set new benchmarks, reaching unparalleled heights every year."
        ,
        date: "TBA",
        end_date: "TBA",
        dateTime: "Dates to be announced",
        location: "MIT World Peace University, Pune",
        venue: "MIT World Peace University, Pune",
        image: groupdanceImg,
        heroImage: nikhildsouzaImg,
        artistImage: nikhildsouzaImg,
        galleryImages: [
            groupdanceImg,
            bandwarsImg,
            nikhildsouzaImg,
            comedyOnImg,
            shreyajainImg
        ],
        category: "cultural",
        theme: "Cultural Arts Extravaganza",
        registration_deadline: "TBA",
        contact_email: "aarohan.competitions2026@gmail.com / aarohan@mitwpu.edu.in",
        phone: "+91 99603 95998 / +91 83020 74991 (Tashu Agarwal) / +91 7262-019404 (Pritam Bonde)",
        contact: {
            phone: "+91 99603 95998 / +91 83020 74991 (Tashu Agarwal) / +91 7262-019404 (Pritam Bonde)",
            email: "aarohan.competitions2026@gmail.com / aarohan@mitwpu.edu.in",
            instagram: "@mitaarohanfest"
        },
        website: "https://mitwpu.edu.in/aarohan",
        entry_fee_range: "₹500 - ₹2500",
        ticketPrice: "₹500 - ₹2500",
        total_prize_money: `₹${Math.floor(festDataJSON.competitions.reduce((sum, comp) => sum + (comp.prize?.winner || 0) + (comp.prize?.runner_up || 0), 0) / 1000)}K`,
        status: "upcoming",
        featured: true,
        trending: true,
        tags: ["cultural", "dance", "music", "drama", "art", "sports"],
        competitions,
        artists: [
            {
                name: "Nikhil D'Souza",
                genre: "Bollywood Playback Singer",
                image: nikhildsouzaImg,
                dateTime: "Date & Time TBA",
                ticketPrice: "₹1500"
            },
            {
                name: "Shreya Jain",
                genre: "Contemporary Artist",
                image: shreyajainImg,
                dateTime: "Date & Time TBA",
                ticketPrice: "₹1200"
            }
        ],
        sponsors: [
            {
                name: "Aarohan Sponsor 1",
                logo: sponsor1Img
            },
            {
                name: "Aarohan Sponsor 2",
                logo: sponsor2Img
            },
            {
                name: "Aarohan Sponsor 3",
                logo: sponsor3Img
            },
            {
                name: "Aarohan Sponsor 4",
                logo: sponsor4Img
            },
            {
                name: "Aarohan Sponsor 5",
                logo: sponsor5Img
            }
        ]
    };
};

// Replace dummy competitions with real data
export const getRealCompetitions = (festName = null) => {
    if (festName) {
        return getCompetitionsByFest(festName);
    }
    return getAllCompetitions();
};

// Get Persona Fest data in the format expected by eventsData.js
export const getPersonaFestDataForEvents = () => {
    const personaFest = festDataJSONFile.added_fests?.find(fest => fest.fest_name === 'Persona Fest 2025');
    if (!personaFest) return null;

    // Group Persona competitions by category
    const competitions = {};
    const personaComps = getPersonaCompetitions();

    personaComps.forEach(comp => {
        const category = comp.subcategory;
        if (category === 'singing') {
            if (!competitions.MUSIC) competitions.MUSIC = [];
            competitions.MUSIC.push({
                id: comp.id,
                name: comp.title,
                subtitle: comp.subtitle,
                image: comp.image,
                fee: 'TBA',
                prize: comp.prizes
            });
        } else if (category === 'dance') {
            if (!competitions.DANCE) competitions.DANCE = [];
            competitions.DANCE.push({
                id: comp.id,
                name: comp.title,
                subtitle: comp.subtitle,
                image: comp.image,
                fee: 'TBA',
                prize: comp.prizes
            });
        } else if (category === 'instrumental_music') {
            if (!competitions.MUSIC) competitions.MUSIC = [];
            competitions.MUSIC.push({
                id: comp.id,
                name: comp.title,
                subtitle: comp.subtitle,
                image: comp.image,
                fee: 'TBA',
                prize: comp.prizes
            });
        } else if (category === 'band_music') {
            if (!competitions.MUSIC) competitions.MUSIC = [];
            competitions.MUSIC.push({
                id: comp.id,
                name: comp.title,
                subtitle: comp.subtitle,
                image: comp.image,
                fee: 'TBA',
                prize: comp.prizes
            });
        } else if (category === 'fashion_show') {
            if (!competitions.ART) competitions.ART = [];
            competitions.ART.push({
                id: comp.id,
                name: comp.title,
                subtitle: comp.subtitle,
                image: comp.image,
                fee: 'TBA',
                prize: comp.prizes
            });
        }
    });

    return {
        id: "persona_fest_2025",
        title: personaFest.fest_name,
        subtitle: personaFest.fest_tagline,
        organizing_body: personaFest.college,
        festival_name: personaFest.fest_name,
        event_type: "Cultural Festival",
        type: "cultural",
        description: `${personaFest.fest_tagline} - A spectacular cultural extravaganza at MIT Art, Design & Technology University`,
        overview: `${personaFest.fest_tagline} - Experience the grandest cultural celebration at MIT ADT University. This festival brings together talented performers from across the nation to compete in various cultural events including classical and contemporary dance, solo and group singing competitions, instrumental music, band competitions, and fashion shows. A perfect blend of tradition and modernity awaits you at this prestigious cultural fest.`,
        date: personaFest.date || "TBA",
        end_date: "TBA",
        dateTime: personaFest.date || "To be announced",
        location: personaFest.location || "MIT Art, Design & Technology University, Loni Kalbhor, Maharashtra",
        venue: personaFest.location || "MIT Art, Design & Technology University, Loni Kalbhor, Maharashtra",
        image: personaFest.image,
        heroImage: personaFest.image,
        artistImage: platformImg,
        galleryImages: [
            platformImg,
            groupdanceImg,
            bandwarsImg,
            solodanceImg,
            artImg,
            solosingingImg,
            dastakImg,
            badmintonSoloImg
        ],
        category: "cultural",
        theme: personaFest.fest_tagline,
        registration_deadline: "TBA",
        contact_email: "info@mitadt.edu.in",
        phone: personaFest.student_organising_committee?.[0]?.phone || "TBA",
        contact: {
            phone: personaFest.student_organising_committee?.[0]?.phone || "TBA",
            email: "info@mitadt.edu.in",
            instagram: "@persona_fest_2025"
        },
        website: "https://mitadt.edu.in",
        entry_fee_range: "TBA",
        ticketPrice: "TBA",
        total_prize_money: "TBA",
        status: personaFest.registration_status === "Not started yet" ? "upcoming" : "open",
        featured: true,
        trending: true,
        tags: ["cultural", "dance", "music", "classical", "contemporary", "fashion"],
        competitions,
        age_limit_years: personaFest.age_limit_years,
        general_event_guidelines: personaFest.general_event_guidelines,
        student_organising_committee: personaFest.student_organising_committee,
        cultural_event_committee: personaFest.cultural_event_committee,
        artists: [], // To be added when artists are announced
        sponsors: [] // To be added when sponsors are announced
    };
};

export default {
    getAllCompetitions,
    getCompetitionById,
    getCompetitionsByCategory,
    getFestDataForEvents,
    getRealCompetitions,
    getPersonaCompetitions,
    getPersonaFestDataForEvents
};
