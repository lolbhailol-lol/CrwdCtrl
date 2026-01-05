// Event data management for CrwdCtrl
import { getFestDataForEvents, getPersonaFestDataForEvents } from './real-data/competitionDataService.js';
import { processEventsArray } from '../utils/imagePreprocessor.js';
import { comingSoonEvents } from './comingSoonEvents.js';
import {
    symbiPhoto1,
    symbiPhoto2,
    symbiPhoto3,
    symbiPhoto4,
    symbiFashionShow,
    symbiBasketball,
    symbiCricket,
    symbiAtharva,
    symbiBgmi,
    symbiQuiz,
    symbiLiveBand
} from '../utils/imageImports.js';

// Import fest data from backend (in real app, this would be API calls)
// Filter out null values from the imported data
const importedFestData = [
    getFestDataForEvents(),
    getPersonaFestDataForEvents(),
].filter(Boolean);

// Get Persona and Saksham from coming soon events
const personaEvent = comingSoonEvents.find(event => event.id === 'persona-fest-2026');
const sakshamEvent = comingSoonEvents.find(event => event.id === 'saksham-3.0-2024');

const festData = {
    "festivals": [
        ...importedFestData,
        ...(personaEvent ? [{
            "id": "persona_fest_2026",
            "title": "PERSONA FEST",
            "subtitle": "Dates To be announced • MIT ADT, Loni Kalbhor, Maharashtra",
            "organizing_body": "MIT Art, Design & Technology University",
            "festival_name": "PERSONA FEST 2026",
            "event_type": "Techno-Cultural Festival",
            "type": "cultural",
            "category": "cultural",
            "description": "The biggest techno-cultural fest featuring multiple competitions including singing, dancing, instrumental music, band competitions, and fashion shows",
            "overview": personaEvent.overview,
            "date": personaEvent.date,
            "end_date": personaEvent.date,
            "dateTime": "To be announced",
            "location": personaEvent.location,
            "venue": personaEvent.location,
            "image": personaEvent.image,
            "heroImage": personaEvent.heroImage,
            "artistImage": personaEvent.artistImage,
            "galleryImages": personaEvent.galleryImages,
            "theme": "The Biggest Techno ~ Cultural Fest",
            "registration_deadline": "TBA",
            "contact_email": "persona@mit.edu",
            "phone": "+91 7887748174",
            "contact": personaEvent.contact,
            "website": "https://mitadt.edu.in",
            "entry_fee_range": "Free Entry",
            "ticketPrice": "Free Entry",
            "total_prize_money": "₹50,000+",
            "status": "upcoming",
            "featured": true,
            "trending": false,
            "tags": personaEvent.tags,
            "competitions": {
                "DANCE": [
                    {
                        "id": "persona_dance_001",
                        "name": "Ghoongruh - Classical Dance",
                        "subtitle": "Kathak and Bharatnatyam - Day 1",
                        "image": personaEvent.competitions?.find(c => c.id === 'ghoongruh_classical_dance')?.image || personaEvent.image,
                        "fee": "TBA",
                        "prize": "TBA",
                        "date": "TBA",
                        "time": "TBA"
                    },
                    {
                        "id": "persona_dance_002",
                        "name": "Step-Up - Solo Dance",
                        "subtitle": "Open Genre (except classical) - Day 1",
                        "image": personaEvent.competitions?.find(c => c.id === 'step_up_solo_dance_open_genre')?.image || personaEvent.image,
                        "fee": "TBA",
                        "prize": "TBA",
                        "date": "TBA",
                        "time": "TBA"
                    },
                    {
                        "id": "persona_dance_003",
                        "name": "Trance - Group Dance",
                        "subtitle": "Fusion & Creative Styles - Day 2",
                        "image": personaEvent.competitions?.find(c => c.id === 'trance_group_dance')?.image || personaEvent.image,
                        "fee": "TBA",
                        "prize": "TBA",
                        "date": "TBA",
                        "time": "TBA"
                    }
                ],
                "MUSIC": [
                    {
                        "id": "persona_music_001",
                        "name": "Vishwadhun - Indian Solo Singing",
                        "subtitle": "Indian Languages Only - Day 1",
                        "image": personaEvent.competitions?.find(c => c.id === 'vishwadhun_indian_solo_singing')?.image || personaEvent.image,
                        "fee": "TBA",
                        "prize": "TBA",
                        "date": "TBA",
                        "time": "TBA"
                    },
                    {
                        "id": "persona_music_002",
                        "name": "Saptasur - Classical Singing",
                        "subtitle": "Indian Classical Music - Day 1",
                        "image": personaEvent.competitions?.find(c => c.id === 'saptasur_classical_singing')?.image || personaEvent.image,
                        "fee": "TBA",
                        "prize": "TBA",
                        "date": "TBA",
                        "time": "TBA"
                    },
                    {
                        "id": "persona_music_003",
                        "name": "Crescendo - Western Solo Singing",
                        "subtitle": "English Songs Only - Day 2",
                        "image": personaEvent.competitions?.find(c => c.id === 'crescendo_western_solo_singing')?.image || personaEvent.image,
                        "fee": "TBA",
                        "prize": "TBA",
                        "date": "TBA",
                        "time": "TBA"
                    },
                    {
                        "id": "persona_music_004",
                        "name": "Rhydhun - Instrumental",
                        "subtitle": "Solo Instrumental Performance - Day 2",
                        "image": personaEvent.competitions?.find(c => c.id === 'rhydhun_instrumental')?.image || personaEvent.image,
                        "fee": "TBA",
                        "prize": "TBA",
                        "date": "TBA",
                        "time": "TBA"
                    },
                    {
                        "id": "persona_music_005",
                        "name": "Mega Jam - Band Competition",
                        "subtitle": "Live Band Performance - Day 3",
                        "image": personaEvent.competitions?.find(c => c.id === 'mega_jam_band_competition')?.image || personaEvent.image,
                        "fee": "TBA",
                        "prize": "TBA",
                        "date": "TBA",
                        "time": "TBA"
                    }
                ],
                "ART": [
                    {
                        "id": "persona_art_001",
                        "name": "Show Stopper - Fashion Show",
                        "subtitle": "Theme-based Ramp Walk - Day 3",
                        "image": personaEvent.competitions?.find(c => c.id === 'show_stopper_fashion_show')?.image || personaEvent.image,
                        "fee": "TBA",
                        "prize": "TBA",
                        "date": "TBA",
                        "time": "TBA"
                    }
                ]
            },
            "artists": personaEvent.artists || [],
            "sponsors": []
        }] : []),
        ...(sakshamEvent ? [{
            "id": "saksham_4_0_2024",
            "title": "SAKSHAM 4.0",
            "subtitle": "Dates To be announced • SSPU, Kiwale",
            "organizing_body": "Symbiosis Skills & Professional University",
            "festival_name": "SAKSHAM 4.0",
            "event_type": "Arts & Culture Festival",
            "type": "cultural",
            "category": "cultural",
            "description": "An exciting Arts & Culture festival featuring dance, singing, band wars, beauty pageants, and theatre competitions",
            "overview": sakshamEvent.overview,
            "date": sakshamEvent.date,
            "end_date": sakshamEvent.date,
            "dateTime": "To be announced",
            "location": sakshamEvent.location,
            "venue": sakshamEvent.venue,
            "image": sakshamEvent.image,
            "heroImage": sakshamEvent.heroImage,
            "artistImage": sakshamEvent.artistImage,
            "galleryImages": sakshamEvent.galleryImages,
            "theme": "Arts & Culture Festival",
            "registration_deadline": "TBA",
            "contact_email": "saksham@sspu.ac.in",
            "phone": "+91 7378378021",
            "contact": sakshamEvent.contact,
            "website": "https://sspu.ac.in",
            "entry_fee_range": "Free Entry",
            "ticketPrice": "Free Entry",
            "total_prize_money": "₹25,000",
            "status": "upcoming",
            "featured": true,
            "trending": false,
            "tags": sakshamEvent.tags,
            "competitions": {
                "DANCE": [
                    {
                        "id": "saksham_dance_001",
                        "name": "Solo Dance Competition",
                        "subtitle": "Individual Performance - Day 1",
                        "image": sakshamEvent.competitions?.find(c => c.id === 'dance')?.image || sakshamEvent.image,
                        "fee": "TBD",
                        "prize": "TBD",
                        "date": "TBA",
                        "time": "TBA"
                    },
                    {
                        "id": "saksham_dance_002",
                        "name": "Group Dance Competition",
                        "subtitle": "Team Performance - Day 1",
                        "image": sakshamEvent.competitions?.find(c => c.id === 'dance')?.groupImage || sakshamEvent.image,
                        "fee": "TBD",
                        "prize": "TBD",
                        "date": "TBA",
                        "time": "TBA"
                    }
                ],
                "MUSIC": [
                    {
                        "id": "saksham_music_001",
                        "name": "Solo Singing Competition",
                        "subtitle": "Individual Vocal Performance - Day 2",
                        "image": sakshamEvent.competitions?.find(c => c.id === 'singing')?.image || sakshamEvent.image,
                        "fee": "TBD",
                        "prize": "TBD",
                        "date": "TBA",
                        "time": "TBA"
                    },
                    {
                        "id": "saksham_music_002",
                        "name": "Duet Singing Competition",
                        "subtitle": "Duo Vocal Performance - Day 2",
                        "image": sakshamEvent.competitions?.find(c => c.id === 'singing')?.duetImage || sakshamEvent.image,
                        "fee": "TBD",
                        "prize": "TBD",
                        "date": "TBA",
                        "time": "TBA"
                    },
                    {
                        "id": "saksham_music_003",
                        "name": "Band War",
                        "subtitle": "Battle of the Bands - Day 3",
                        "image": sakshamEvent.competitions?.find(c => c.id === 'band_war')?.image || sakshamEvent.image,
                        "fee": "TBD",
                        "prize": "TBD",
                        "date": "TBA",
                        "time": "TBA"
                    }
                ],
                "THEATRE": [
                    {
                        "id": "saksham_theatre_001",
                        "name": "Theatre Competition",
                        "subtitle": "Dramatic Performance - Day 2",
                        "image": sakshamEvent.competitions?.find(c => c.id === 'theatre')?.image || sakshamEvent.image,
                        "fee": "TBD",
                        "prize": "TBD",
                        "date": "TBA",
                        "time": "TBA"
                    }
                ],
                "ART": [
                    {
                        "id": "saksham_art_001",
                        "name": "Beauty Pageant",
                        "subtitle": "Personality & Style Competition - Day 3",
                        "image": sakshamEvent.competitions?.find(c => c.id === 'beauty_pageant')?.image || sakshamEvent.image,
                        "fee": "TBD",
                        "prize": "TBD",
                        "date": "TBA",
                        "time": "TBA"
                    }
                ]
            },
            "artists": sakshamEvent.artists || [],
            "sponsors": []
        }] : []),
        {
            "id": "fest_007",
            "title": "SYMBI UTSAV",
            "subtitle": "December 10-12, 2025 • Symbiosis Junior College, Kiwale",
            "organizing_body": "Symbiosis Junior College",
            "festival_name": "SYMBI UTSAV 2025",
            "event_type": "Multi-Category Festival",
            "type": "mixed",
            "description": "Annual fest featuring cultural events, sports competitions, academic activities, exhibitions, and gaming tournaments",
            "overview": "Symbiosis Junior College presents SYMBI UTSAV 2025, a comprehensive three-day festival combining cultural performances, competitive sports, academic excellence through MUN and exhibitions, plus exciting gaming tournaments. Experience the perfect blend of creativity, sportsmanship, and intellectual engagement.",
            "date": "2025-12-10",
            "end_date": "2025-12-12",
            "dateTime": "December 10-12, 2025 • 09:00 AM - 03:00 PM",
            "location": "Symbiosis Junior College, Kiwale",
            "venue": "Symbiosis Junior College, Kiwale",
            "image": symbiPhoto1,
            "heroImage": symbiPhoto1,
            "artistImage": symbiAtharva,
            "galleryImages": [
                symbiPhoto1,
                symbiPhoto2,
                symbiPhoto3,
                symbiPhoto4
            ],
            "category": "cultural",
            "theme": "Unity in Diversity",
            "registration_deadline": "2025-12-05",
            "contact_email": "admissions@symbiosisjrcollege.ac.in",
            "phone": "+91-9890920773",
            "contact": {
                "phone": "+91-980920773 (Harshal Kulkarni)",
                "email": "admissions@symbiosisjrcollege.ac.in",
                "instagram": "@symbiosisjrcollege"
            },
            "website": "https://symbiosis.ac.in/symbi-utsav",
            "entry_fee_range": "₹500 - ₹1500",
            "ticketPrice": "₹500 - ₹1500",
            "total_prize_money": "₹50,000",
            "status": "upcoming",
            "featured": true,
            "trending": true,
            "tags": ["cultural", "sports", "academic", "gaming", "exhibition", "mun"],
            "competitions": {
                "SPORTS": [
                    {
                        "id": "symbi_sports_001",
                        "name": "3x3 Basketball",
                        "subtitle": "Fast-paced basketball tournament - DAY 1",
                        "image": symbiBasketball,
                        "fee": "1500",
                        "prize": "10000",
                        "date": "2025-12-10",
                        "time": "08:00 AM"
                    },
                    {
                        "id": "symbi_sports_002",
                        "name": "Box Cricket",
                        "subtitle": "5 overs cricket matches - DAY 1",
                        "image": symbiCricket,
                        "fee": "1500",
                        "prize": "10000",
                        "date": "2025-12-10",
                        "time": "08:00 AM"
                    },
                    {
                        "id": "symbi_sports_003",
                        "name": "Futsal",
                        "subtitle": "Indoor football competition - DAY 3",
                        "image": "/src/data/real-data/symbi-images/symbi utsav football (futsal).jpg",
                        "fee": "1500",
                        "prize": "10000",
                        "date": "2025-12-12",
                        "time": "08:00 AM"
                    }
                ],
                "ACADEMIC": [
                    {
                        "id": "symbi_academic_001",
                        "name": "Model United Nations (MUN)",
                        "subtitle": "Global Maritime Security - DAY 1",
                        "image": "/src/data/real-data/symbi-images/symbi utsav mun.png",
                        "fee": "500",
                        "date": "2025-12-10",
                        "time": "09:00 AM"
                    },
                    {
                        "id": "symbi_academic_002",
                        "name": "Curriculum Expo",
                        "subtitle": "Project & Model Showcase - DAY 1",
                        "image": "/src/data/real-data/symbi-images/symbi utsav expo.jpg",
                        "fee": "500",
                        "prize": "Trophy and Certificates",
                        "date": "2025-12-10",
                        "time": "09:00 AM"
                    }
                ],
                "GAMING": [
                    {
                        "id": "symbi_gaming_001",
                        "name": "BGMI Tournament",
                        "subtitle": "Squad-based gaming competition - DAY 1-3",
                        "image": symbiBgmi,
                        "fee": "500",
                        "prize": "7000",
                        "date": "2025-12-10",
                        "time": "TBD"
                    }
                ],
                "QUIZ": [
                    {
                        "id": "symbi_quiz_001",
                        "name": "Quiz Carnival",
                        "subtitle": "Inter-school quiz competition for Classes 8 to 12",
                        "image": symbiQuiz,
                        "fee": "500",
                        "prize": "TBA",
                        "date": "2025-12-10",
                        "time": "10:30 AM"
                    }
                ],
                "CULTURAL": [
                    {
                        "id": "symbi_cultural_001",
                        "name": "Live Band",
                        "subtitle": "Live band performance competition showcasing musical talents",
                        "image": symbiLiveBand,
                        "fee": "1500",
                        "prize": "TBA",
                        "date": "2025-12-10",
                        "time": "02:00 PM"
                    },
                    {
                        "id": "symbi_cultural_002",
                        "name": "Flash Mob",
                        "subtitle": "Dynamic flash mob performance with Global Mix theme",
                        "image": "/src/data/real-data/symbi-images/flash mob.jpg",
                        "fee": "100",
                        "prize": "TBA",
                        "date": "2025-12-12",
                        "time": "12:30 PM"
                    },
                    {
                        "id": "symbi_cultural_003",
                        "name": "Party Prism - Singing",
                        "subtitle": "Solo and group singing competition with audition process",
                        "image": "/src/data/real-data/symbi-images/singing (party prism).jpg",
                        "fee": "Solo: ₹500, Group: ₹500",
                        "prize": "TBA",
                        "date": "2025-12-10",
                        "time": "10:00 AM"
                    },
                    {
                        "id": "symbi_cultural_004",
                        "name": "Fashion Show",
                        "subtitle": "Fashion show competition showcasing creativity and style",
                        "image": "/src/data/real-data/symbi-images/symbi utsav fashion show.jpg",
                        "fee": "500",
                        "prize": "TBA",
                        "date": "2025-12-11",
                        "time": "TBD"
                    },
                    {
                        "id": "symbi_cultural_005",
                        "name": "Party Prism - Dance",
                        "subtitle": "Solo and group dance competition with audition process",
                        "image": "/src/data/real-data/symbi-images/dance (party prism).jpg",
                        "fee": "Solo: ₹500, Group: ₹500",
                        "prize": "TBA",
                        "date": "2025-12-10",
                        "time": "11:00 AM"
                    }
                ]
            },
            "artists": [
                {
                    "name": "Atharva Sudame",
                    "genre": "Content Creator and Influencer",
                    "image": "/src/data/real-data/symbi-images/symbi utsav Atharva-Sudame artist.webp",
                    "dateTime": "Dec 11, 2:00 PM",
                    "ticketPrice": "Free"
                }
            ],
            "sponsors": [
                {
                    "name": "Symbiosis Group",
                    "logo": null
                }
            ]
        }
    ],
    "events": [
        {
            "id": "event_001",
            "festival_id": "fest_001",
            "name": "InSync",
            "type": "Group Dance",
            "description": "Showcase your team's synchronization and creativity in this group dance competition",
            "category": "cultural",
            "subcategory": "dance",
            "registration_fee": 2500,
            "team_size_min": 6,
            "team_size_max": 16,
            "duration_minutes": 8,
            "prizes": {
                "first": 35000,
                "second": 20000,
                "third": 10000
            },
            "eligibility": "Age limit: 16-36 years",
            "rounds": ["Online/Offline Elimination", "Final Round"]
        },
        {
            "id": "event_002",
            "festival_id": "fest_001",
            "name": "Head Bang",
            "type": "Band Wars",
            "description": "Battle of the bands - showcase your musical prowess and stage presence",
            "category": "cultural",
            "subcategory": "music",
            "registration_fee": 2500,
            "team_size_min": 4,
            "team_size_max": 16,
            "duration_minutes": 15,
            "prizes": {
                "first": 35000,
                "second": 20000,
                "third": 10000
            },
            "eligibility": "Age limit: 16-35 years",
            "rounds": ["Online/Offline Elimination", "Final Round"]
        },
        {
            "id": "event_003",
            "festival_id": "fest_002",
            "name": "RoboWars",
            "type": "Robotics Competition",
            "description": "Build and battle with your robots in this epic robotics competition",
            "category": "technical",
            "subcategory": "robotics",
            "registration_fee": 1500,
            "team_size_min": 3,
            "team_size_max": 5,
            "duration_minutes": 120,
            "prizes": {
                "first": 100000,
                "second": 50000,
                "third": 25000
            },
            "eligibility": "Engineering/Technical students",
            "rounds": ["Design Submission", "Preliminary Battle", "Final Battle"]
        }
    ]
};

// Get all events
export const getAllEvents = () => {
    return processEventsArray(festData.festivals);
};

// Get event by ID
export const getEventById = (id) => {
    return festData.festivals.find(event => event && event.id === id) || null;
};

// Get events by category
export const getEventsByCategory = (category) => {
    return festData.festivals.filter(event => event && (event.category === category || event.type === category));
};

// Get featured events
export const getFeaturedEvents = () => {
    return festData.festivals.filter(event => event.featured);
};

// Get upcoming events
export const getUpcomingEvents = () => {
    return festData.festivals.filter(event => event.status === 'upcoming');
};

// Search events
export const searchEvents = (query) => {
    const lowercaseQuery = query.toLowerCase();
    return festData.festivals.filter(event =>
        event.festival_name.toLowerCase().includes(lowercaseQuery) ||
        event.description.toLowerCase().includes(lowercaseQuery) ||
        event.organizing_body.toLowerCase().includes(lowercaseQuery) ||
        event.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
};

export default {
    getAllEvents,
    getEventById,
    getEventsByCategory,
    getFeaturedEvents,
    getUpcomingEvents,
    searchEvents
};