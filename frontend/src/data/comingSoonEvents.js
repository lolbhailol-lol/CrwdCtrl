import {
    personaPhoto1,
    personaPhoto2,
    personaPhoto3,
    personaPhoto4,
    personaLogo,
    personaArtist1,
    personaArtist2,
    personaSoloSinging,
    personaClassicalSinging,
    personaWesternSinging,
    personaBandWars,
    personaClassicalDance,
    personaGroupDance,
    personaSoloDance,
    personaFashionShow,
    personaInstrumental,
    // Saksham imports
    sakshamnCardPhoto,
    sakshamLogo,
    sakshamPhoto3,
    sakshamPhoto4,
    sakshamGroupDance,
    sakshamSoloSinging,
    sakshamBandWar,
    sakshamSoloDanceCompetition,
    sakshamDuetSinging,
    sakshamBeautyPagent,
    sakshamTheaterCompetition,
    sakshamArtist1Maahi,
    sakshamArtist2DjKratex,
    sakshamArtist3PragatiNagpal
} from '../utils/imageImports.js';
import { processEventsArray } from '../utils/imagePreprocessor.js';

const rawComingSoonEvents = [
    {
        id: 'persona-fest-2026',
        title: 'Persona Fest 2026',
        subtitle: 'The Biggest Techno ~ Cultural Fest',
        date: ' Dates To be announced',
        college: 'MIT Art, Design & Technology University',
        location: 'MIT ADT,Loni Kalbhor, Maharashtra',
        image: personaPhoto1,
        logo: personaLogo,
        heroImage: personaPhoto1,
        artistImage: personaArtist1,
        galleryImages: [
            personaPhoto1,
            personaPhoto2,
            personaPhoto3,
            personaPhoto4
        ],
        fallbackImage: null,
        description: 'The biggest techno-cultural fest featuring multiple competitions including singing, dancing, instrumental music, band competitions, and fashion shows. Open to participants under 25 years of age.',
        category: 'Cultural',
        status: 'Registration Not Started',
        ageLimit: 25,
        // Complete fest details
        fest_name: "Persona Fest 2026",
        fest_tagline: "The Biggest Techno ~ Cultural Fest",
        event_category: "Cultural",
        age_limit_years: 25,
        general_event_guidelines: [
            "All participants must register before the deadline under the 25-year age limit. Late entries will not be accepted.",
            "Any act of misbehaviour, indiscipline, or disrespect towards the organizers or judges will result in immediate disqualification.",
            "Participants must report 30 minutes before their scheduled performance time.",
            "Music tracks (if required) should be in MP3 format and submitted as per event guidelines.",
            "The organizers hold the right to modify rules if necessary and will communicate any changes in advance.",
            "Judges' decisions are final and binding in all events."
        ],
        student_organising_committee: [
            {
                "name": "Ms. Khushi Warang",
                "role": "General Secretary – Persona Fest 2026",
                "phone": "7887748174"
            },
            {
                "name": "Mr. Bhoumik Rajput",
                "role": "Organizing Secretary – Persona Fest 2026",
                "phone": "7970159079"
            },
            {
                "name": "Mr. Vaibhav Kalaskar",
                "role": "Organizing Secretary – Persona Fest 2026",
                "phone": "9657065552"
            }
        ],
        cultural_event_committee: [
            {
                "name": "Dr. Milind Dhobley",
                "designation": "Dean and Principal",
                "phone": "9422815528",
                "institute": "MIT SoFA"
            },
            {
                "name": "Dr. Shreyasi Pavgi",
                "designation": "I/C Principal",
                "phone": "9665039164",
                "institute": "MIT VSKA"
            },
            {
                "name": "Dr. Rekha Sugandhi",
                "designation": "Director - IRO",
                "phone": "9823044694",
                "institute": "MIT SoC"
            },
            {
                "name": "Dr. Amol Deshmukh",
                "designation": "Head, Theatre Dept.",
                "phone": "8380009041",
                "institute": "MIT SFT"
            },
            {
                "name": "Prof. Chaitanya Garware",
                "designation": "Assistant Professor",
                "phone": "9766683680",
                "institute": "MIT SoC"
            },
            {
                "name": "Prof. Viraj More",
                "designation": "Assistant Professor",
                "phone": "9834420522",
                "institute": "MIT IoD"
            },
            {
                "name": "Prof. Tashi PD Bahuguna",
                "designation": "Assistant Professor",
                "phone": "8788323798",
                "institute": "MIT SoFA"
            }
        ],
        competitions: [
            {
                "id": "vishwadhun_indian_solo_singing",
                "name": "Vishwadhun",
                "title": "Indian Solo Singing Competition",
                "short_description": "A prestigious solo singing competition showcasing the richness of Indian music.",
                "performance_category": "singing",
                "language_requirement": "Indian languages only",
                "image": personaSoloSinging,
                "team_size": {
                    "min": 1,
                    "max": 1
                },
                "rounds": [
                    {
                        "round_no": 1,
                        "name": "Elimination Round",
                        "type": "elimination",
                        "description": "Live performance.",
                        "min_duration_minutes": 2,
                        "max_duration_minutes": 2
                    },
                    {
                        "round_no": 2,
                        "name": "Final Round",
                        "type": "final",
                        "description": "Live performance.",
                        "min_duration_minutes": 3,
                        "max_duration_minutes": 4
                    }
                ],
                "rules": [
                    "Participants must perform songs only in Indian languages.",
                    "Background music is mandatory (karaoke, instrumental, or live).",
                    "Use of pre-recorded vocal tracks or autotuned backing will lead to disqualification.",
                    "Any change in song selection must be informed 24 hours before the performance.",
                    "The final decision rests with the judges."
                ],
                "coordinators": {
                    "faculty": {
                        "name": "Prof. Chaitanya Garware",
                        "phone": "9766683680",
                        "institute": "MIT SoC"
                    },
                    "students": [
                        {
                            "role": "Student Coordinator - I",
                            "name": "Aayushi Dhabale",
                            "phone": "6263002187"
                        },
                        {
                            "role": "Student Coordinator - II",
                            "name": "Vinit Bhayani",
                            "phone": "9082136276"
                        }
                    ]
                }
            },
            {
                "id": "saptasur_classical_singing",
                "name": "Saptasur",
                "title": "Classical Singing Competition",
                "short_description": "A platform dedicated to Indian classical singing, celebrating heritage and tradition.",
                "performance_category": "singing",
                "style": "Indian classical",
                "image": personaClassicalSinging,
                "team_size": {
                    "min": 1,
                    "max": 1
                },
                "rounds": [
                    {
                        "round_no": 1,
                        "name": "Audition Round",
                        "type": "elimination",
                        "description": "Live classical vocal performance.",
                        "min_duration_minutes": 7,
                        "max_duration_minutes": 7
                    },
                    {
                        "round_no": 2,
                        "name": "Final Round",
                        "type": "final",
                        "description": "Live classical vocal performance.",
                        "min_duration_minutes": 12,
                        "max_duration_minutes": 12
                    }
                ],
                "rules": [
                    "Participants must sing Indian classical compositions.",
                    "An accompanist is required and must be arranged by the participant.",
                    "Use of an electronic tanpura is allowed.",
                    "Microphones will be provided; any additional sound equipment must be pre-approved."
                ],
                "coordinators": {
                    "faculty": {
                        "name": "Dr. Shreyasi Pavgi",
                        "phone": "9665039164",
                        "institute": "MIT VSKA"
                    },
                    "students": [
                        {
                            "role": "Student Coordinator - I",
                            "name": "Vineet Saxena",
                            "phone": "7408367196"
                        },
                        {
                            "role": "Student Coordinator - II",
                            "name": "Parth Duggar",
                            "phone": "9326354940"
                        }
                    ]
                }
            },
            {
                "id": "crescendo_western_solo_singing",
                "name": "Crescendo",
                "title": "Western Solo Singing Competition",
                "short_description": "A competition for solo vocalists showcasing Western music styles.",
                "performance_category": "singing",
                "language_requirement": "English songs only",
                "image": personaWesternSinging,
                "team_size": {
                    "min": 1,
                    "max": 1
                },
                "rounds": [
                    {
                        "round_no": 1,
                        "name": "Elimination Round",
                        "type": "elimination",
                        "description": "Live performance.",
                        "min_duration_minutes": 2,
                        "max_duration_minutes": 2
                    },
                    {
                        "round_no": 2,
                        "name": "Final Round",
                        "type": "final",
                        "description": "Live performance.",
                        "min_duration_minutes": 3,
                        "max_duration_minutes": 4
                    }
                ],
                "rules": [
                    "Only English songs are allowed; Bollywood songs are strictly prohibited.",
                    "Background music (karaoke or instrumental) is mandatory.",
                    "Pre-recorded vocals are not permitted.",
                    "Explicit lyrics or inappropriate content will lead to immediate disqualification.",
                    "Song selection must be confirmed at least 24 hours in advance."
                ],
                "coordinators": {
                    "faculty": {
                        "name": "Prof. Vivek Sutar",
                        "phone": "9665414362",
                        "institute": "MIT VSKA"
                    },
                    "students": [
                        {
                            "role": "Student Coordinator - I",
                            "name": "Aishwarya Talkeri",
                            "phone": "7776062432"
                        },
                        {
                            "role": "Student Coordinator - II",
                            "name": "Kiran Rathod",
                            "phone": "7620209024"
                        }
                    ]
                }
            },
            {
                "id": "ghoongruh_classical_dance",
                "name": "Ghoongruh",
                "title": "Classical Dance Competition",
                "short_description": "A celebration of India's classical dance heritage.",
                "performance_category": "dance",
                "style": "Classical (Kathak and Bharatnatyam only)",
                "image": personaClassicalDance,
                "team_size": {
                    "min": 1,
                    "max": 1
                },
                "rounds": [
                    {
                        "round_no": 1,
                        "name": "Audition Round",
                        "type": "elimination",
                        "description": "Live classical dance performance.",
                        "min_duration_minutes": 3,
                        "max_duration_minutes": 4
                    },
                    {
                        "round_no": 2,
                        "name": "Final Round",
                        "type": "final",
                        "description": "Live classical dance performance.",
                        "min_duration_minutes": 5,
                        "max_duration_minutes": 7
                    }
                ],
                "rules": [
                    "Only Kathak and Bharatnatyam styles are permitted.",
                    "Participants must adhere to traditional attire and presentation.",
                    "Props may be used but require prior approval from the organizers.",
                    "Pre-recorded music is allowed; live music must be arranged by the participant."
                ],
                "coordinators": {
                    "faculty": {
                        "name": "Ms. Aditi Riswadkar",
                        "phone": "9823795506",
                        "institute": "MIT VSKA"
                    },
                    "students": [
                        {
                            "role": "Student Coordinator - I",
                            "name": "Bhavya Bhasin",
                            "phone": "7000648045"
                        },
                        {
                            "role": "Student Coordinator - II",
                            "name": "Sharayu More",
                            "phone": "9960463645"
                        }
                    ]
                }
            },
            {
                "id": "step_up_solo_dance_open_genre",
                "name": "Step-Up",
                "title": "Solo Dance – Open Genre",
                "short_description": "A dynamic competition open to various dance forms except classical styles.",
                "performance_category": "dance",
                "style": "Open (all styles except classical)",
                "image": personaSoloDance,
                "team_size": {
                    "min": 1,
                    "max": 1
                },
                "rounds": [
                    {
                        "round_no": 1,
                        "name": "Audition Round",
                        "type": "elimination",
                        "description": "Live solo dance performance.",
                        "min_duration_minutes": 2,
                        "max_duration_minutes": 3
                    },
                    {
                        "round_no": 2,
                        "name": "Final Round",
                        "type": "final",
                        "description": "Live solo dance performance.",
                        "min_duration_minutes": 3,
                        "max_duration_minutes": 4
                    }
                ],
                "rules": [
                    "Open to all dance forms except classical.",
                    "Participants may use props with prior approval.",
                    "The use of inappropriate gestures or explicit content will lead to disqualification.",
                    "Pre-recorded music must be submitted at least 24 hours before the performance."
                ],
                "coordinators": {
                    "faculty": {
                        "name": "Prof. Vaidehi Gawande",
                        "phone": "9823795506",
                        "institute": "MIT SHD"
                    },
                    "students": [
                        {
                            "role": "Student Coordinator - I",
                            "name": "Yashasvi More",
                            "phone": "9307638688"
                        },
                        {
                            "role": "Student Coordinator - II",
                            "name": "Vishakha Bodke",
                            "phone": "7678067965"
                        }
                    ]
                }
            },
            {
                "id": "rhydhun_instrumental",
                "name": "Rhydhun",
                "title": "Instrumental Competition",
                "short_description": "A stage for instrumentalists to showcase their musical talent.",
                "performance_category": "instrumental_music",
                "image": personaInstrumental,
                "team_size": {
                    "min": 1,
                    "max": 1
                },
                "rounds": [
                    {
                        "round_no": 1,
                        "name": "Elimination Round",
                        "type": "elimination",
                        "description": "Live instrumental performance.",
                        "min_duration_minutes": 2,
                        "max_duration_minutes": 3
                    },
                    {
                        "round_no": 2,
                        "name": "Final Round",
                        "type": "final",
                        "description": "Live instrumental performance.",
                        "min_duration_minutes": 6,
                        "max_duration_minutes": 6
                    }
                ],
                "rules": [
                    "No vocals are allowed during the performance.",
                    "Pre-recorded instruments in the background music will result in disqualification.",
                    "Participants must bring their own instruments and accessories.",
                    "Any special setup requirements must be communicated in advance.",
                    "Judges' decisions will be final."
                ],
                "coordinators": {
                    "faculty": {
                        "name": "Prof. Ankit Gupta",
                        "phone": "9044638407",
                        "institute": "MIT VSKA"
                    },
                    "students": [
                        {
                            "role": "Student Coordinator - I",
                            "name": "Sahil Yadav",
                            "phone": "7499577894"
                        },
                        {
                            "role": "Student Coordinator - II",
                            "name": "Vaishvani",
                            "phone": "8269118116"
                        }
                    ]
                }
            },
            {
                "id": "trance_group_dance",
                "name": "Trance",
                "title": "Group Dance Competition",
                "short_description": "A high-energy competition blending multiple dance styles.",
                "performance_category": "dance",
                "style": "Group, any style / fusion",
                "image": personaGroupDance,
                "team_size": {
                    "min": 5,
                    "max": 15
                },
                "rounds": [
                    {
                        "round_no": 1,
                        "name": "Audition Round",
                        "type": "elimination",
                        "description": "Group dance performance.",
                        "min_duration_minutes": 5,
                        "max_duration_minutes": 6
                    },
                    {
                        "round_no": 2,
                        "name": "Final Round",
                        "type": "final",
                        "description": "Group dance performance.",
                        "min_duration_minutes": 7,
                        "max_duration_minutes": 10
                    }
                ],
                "rules": [
                    "Minimum 5 and maximum 15 members per team.",
                    "Open to all dance styles, allowing fusion and creativity.",
                    "Props are allowed but must be approved in advance.",
                    "Vulgarity or offensive gestures will lead to immediate disqualification.",
                    "Music track must be submitted 48 hours in advance."
                ],
                "coordinators": {
                    "faculty": {
                        "name": "Ms. Reshma Girigosavi",
                        "phone": "9604448063",
                        "institute": "MIT VSKA"
                    },
                    "students": [
                        {
                            "role": "Student Coordinator - I",
                            "name": "Shruti Khandagre",
                            "phone": "7067561500"
                        },
                        {
                            "role": "Student Coordinator - II",
                            "name": "Pratiksha Behara",
                            "phone": "7517894926"
                        }
                    ]
                }
            },
            {
                "id": "mega_jam_band_competition",
                "name": "Mega Jam",
                "title": "Band Competition",
                "short_description": "A stage for bands to showcase their synergy, creativity, and musical prowess.",
                "performance_category": "band_music",
                "image": personaBandWars,
                "team_size": {
                    "min": 3,
                    "max": 8
                },
                "rounds": [
                    {
                        "round_no": 1,
                        "name": "Eliminations",
                        "type": "elimination",
                        "description": "Live performance (timing as per organizers' discretion)."
                    },
                    {
                        "round_no": 2,
                        "name": "On-Stage Finals",
                        "type": "final",
                        "description": "On-stage performance plus sound check.",
                        "min_duration_minutes": 10,
                        "max_duration_minutes": 10,
                        "sound_check_minutes": 5
                    }
                ],
                "rules": [
                    "Each band must have 3 to 8 members.",
                    "Both cover songs and original compositions are allowed.",
                    "The use of backing tracks or pre-recorded music is not allowed.",
                    "The performance should not contain offensive or explicit content.",
                    "Bands must bring their own instruments (drum kits and amps will be provided)."
                ],
                "coordinators": {
                    "faculty": {
                        "name": "Mr. Karan Singh",
                        "phone": "8349154542",
                        "institute": "MIT VSKA"
                    },
                    "students": [
                        {
                            "role": "Student Coordinator - I",
                            "name": "Harshil Rana",
                            "phone": "6353694966"
                        },
                        {
                            "role": "Student Coordinator - II",
                            "name": "Saisaarthak Mohanty",
                            "phone": "9049520481"
                        }
                    ]
                }
            },
            {
                "id": "show_stopper_fashion_show",
                "name": "Show Stopper",
                "title": "Fashion Show",
                "short_description": "A glamorous event showcasing fashion and creativity.",
                "performance_category": "fashion_show",
                "image": personaFashionShow,
                "team_size": {
                    "min": 16,
                    "max": 20
                },
                "rounds": [
                    {
                        "round_no": 1,
                        "name": "Eliminations",
                        "type": "elimination",
                        "description": "Theme-based ramp walk."
                    },
                    {
                        "round_no": 2,
                        "name": "On-Stage Finals",
                        "type": "final",
                        "description": "Full-scale performance.",
                        "min_duration_minutes": 4,
                        "max_duration_minutes": 6
                    }
                ],
                "rules": [
                    "Each team must have 16–20 members walking the ramp.",
                    "The performance must be theme-based, and the theme should be pre-approved.",
                    "Costume, choreography, and music selection will be judged collectively.",
                    "Music track must be submitted 48 hours prior to the event.",
                    "Any form of inappropriate content or behavior will lead to disqualification."
                ],
                "coordinators": {
                    "faculty": {
                        "name": "Prof. Nitin Gupta",
                        "phone": "7048392256",
                        "institute": "MIT IoD"
                    },
                    "students": [
                        {
                            "role": "Student Coordinator - I",
                            "name": "Megha Sharma",
                            "phone": "9422775406"
                        },
                        {
                            "role": "Student Coordinator - II",
                            "name": "Ritika Sharma",
                            "phone": "8766556255"
                        }
                    ]
                }
            }
        ],
        // Additional fields for view-details page compatibility
        festival_name: 'Persona Fest 2026',
        organizing_body: 'MIT Art, Design & Technology University',
        event_type: 'Techno-Cultural Festival',
        type: 'cultural',
        overview: 'Persona Fest 2026 is the biggest techno-cultural festival featuring multiple competitions including singing, dancing, instrumental music, band competitions, and fashion shows. Open to participants under 25 years of age, this prestigious event celebrates creativity, talent, and cultural diversity through 9 exciting competitions across various performance categories.',
        artists: [
            {
                name: 'Sharman Joshi',
                image: personaArtist1,
                genre: 'Indian actor',
                type: 'performer'
            },
            {
                name: 'Asees Kaur',
                image: personaArtist2,
                genre: 'Indian singer',
                type: 'performer'
            }
        ],
        contact: {
            phone: '7887748174',
            email: 'persona@mit.edu',
            instagram: '@personafest2025'
        },
        ticketPrice: 'Free Entry',
        entry_fee_range: 'Free Entry',
        total_prize_money: '₹50,000+',
        tags: ['cultural', 'techno', 'dance', 'singing', 'instrumental', 'band', 'fashion', 'competition'],
        // Legacy compatibility fields
        contactInfo: {
            generalSecretary: {
                name: 'Ms. Khushi Warang',
                phone: '7887748174'
            },
            organizingSecretaries: [
                {
                    name: 'Mr. Bhoumik Rajput',
                    phone: '7970159079'
                },
                {
                    name: 'Mr. Vaibhav Kalaskar',
                    phone: '9657065552'
                }
            ]
        }
    },
    {
        id: 'saksham-3.0-2024',
        title: 'Saksham 4.0',
        subtitle: 'Arts & Culture Festival',
        date: ' DatesTo be announced',
        timing: '10 AM onwards',
        college: 'Symbiosis Skills & Professional University',
        location: 'SSPU, Kiwale',
        venue: 'SSPU, Kiwale',
        image: sakshamnCardPhoto,
        logo: sakshamLogo,
        heroImage: sakshamnCardPhoto,
        artistImage: sakshamArtist1Maahi,
        galleryImages: [
            sakshamnCardPhoto,
            sakshamPhoto3,
            sakshamPhoto4,
            sakshamGroupDance,
            sakshamSoloSinging,
            sakshamBandWar
        ],
        fallbackImage: sakshamnCardPhoto,
        description: 'Saksham 4.0 is an exciting Arts & Culture festival featuring dance, singing, band wars, beauty pageants, and theatre competitions. Join us for three days of incredible performances and cultural celebrations.',
        category: 'Arts & Culture',
        status: 'Registration Not Started',
        fest_name: 'Saksham 4.0',
        host: 'Symbiosis Skills & Professional University',
        dates: ' DatesTo be announced',
        registration_contacts: [
            {
                name: 'Anand Shah',
                phone: '+91 7378378021'
            },
            {
                name: 'Suhani Karamchandani',
                phone: '+91 9923756181',
                role: 'Arts & Cultural University Head'
            }
        ],
        competitions: [
            {
                id: 'dance',
                name: 'Dance',
                image: sakshamSoloDanceCompetition,
                groupImage: sakshamGroupDance,
                registration_fee: {
                    solo: "TBD",
                    group: "TBD"
                },
                description: 'Showcase your dance skills in solo or group categories. Express yourself through movement and rhythm.',
                rules: [
                    'Dance performances should be 3 minutes each.',
                    'Appropriate dressing is mandatory. (No transparent or short dresses)',
                    'All audio files of the dance track should be sent as per given date.',
                    'All participants must adhere to University rules.',
                    'University Council & College Faculty may disqualify any participant/team for disciplinary violations or commotion.',
                    'Final decision authority rests with the judges; decisions are final and not open for debate.',
                    'For queries, contact the Committee Head.'
                ],
                coordinator: {
                    faculty_name: 'Prof. Shraddha Galande',
                    role: 'Faculty Coordinator'
                },
                prizes: {
                    first: 'TBD',
                    second: 'TBD',
                    third: 'TBD'
                }
            },
            {
                id: 'singing',
                name: 'Singing',
                image: sakshamSoloSinging,
                duetImage: sakshamDuetSinging,
                registration_fee: {
                    solo: "TBD",
                    duet: "TBD"
                },
                description: 'Let your voice be heard! Participate in solo or duet singing competitions.',
                rules: [
                    'Performance should be 3 minutes each.',
                    'Appropriate dressing is mandatory.',
                    'All soundtrack audio files must be submitted as per the given date.',
                    'All participants must adhere to University rules.',
                    'University Council & College Faculty may disqualify any participant/team for disciplinary violations or commotion.',
                    'Final decision authority rests with the judges; decisions are final and not open for debate.',
                    'For queries, contact the Committee Head.'
                ],
                coordinator: {
                    faculty_name: 'Prof. Shraddha Galande',
                    role: 'Faculty Coordinator'
                },
                prizes: {
                    first: 'TBD',
                    second: 'TBD',
                    third: 'TBD'
                }
            },
            {
                id: 'band_war',
                name: 'Band War',
                image: sakshamBandWar,
                registration_fee: "TBD",
                description: 'Battle of the bands! Bring your instruments and show your musical prowess.',
                rules: [
                    'Time allotted is 15 minutes (5 minutes setup + 10 minutes performance).',
                    'Appropriate dressing is mandatory.',
                    'Equipment list available in college will be sent to the team.',
                    'College is not responsible for damage/loss of instruments or belongings.',
                    'All participants must adhere to University rules.',
                    'University Council & College Faculty may disqualify any participant/team for disciplinary violations or commotion.',
                    'Final decision authority rests with the judges; decisions are final and not open for debate.',
                    'For queries, contact the Committee Head.'
                ],
                coordinator: {
                    faculty_name: 'Prof. Shraddha Galande',
                    role: 'Faculty Coordinator'
                },
                prizes: {
                    first: 'TBD',
                    second: 'TBD',
                    third: 'TBD'
                }
            },
            {
                id: 'beauty_pageant',
                name: 'Beauty Pageant',
                image: sakshamBeautyPagent,
                registration_fee: "TBD",
                description: 'Showcase your personality, confidence, and style in this glamorous competition.',
                rules: [
                    'Participants must dress as per the given theme only.',
                    'Appropriate dressing is mandatory.',
                    'Clothes should be below knee length; no deep neck; no revealing clothes.',
                    'Outfits must be approved by coordinator or participant will be disqualified.',
                    'Without outfit approval, participant will be disqualified.',
                    'Beauty lab facility available (Makeup TBD, Hair TBD).',
                    'Participants must adhere to University rules.',
                    'University Council & College Faculty may disqualify participants for disciplinary violations or commotion.',
                    'Final decision authority rests with the judges; decisions are final and not open for debate.',
                    'For queries, contact the Committee Head.'
                ],
                coordinator: {
                    faculty_name: 'Prof. Shraddha Galande',
                    role: 'Faculty Coordinator'
                },
                prizes: {
                    first: 'TBD',
                    second: 'TBD',
                    third: 'TBD'
                }
            },
            {
                id: 'theatre',
                name: 'Theatre',
                image: sakshamTheaterCompetition,
                registration_fee: "TBD",
                description: 'Bring stories to life through dramatic performances and theatrical excellence.',
                rules: [
                    'Total time allotted is 12 minutes (7 minutes performance + 5 minutes stage setup).',
                    'Appropriate dressing is mandatory.',
                    'Requirements list (mic, props, etc.) will be provided by college.',
                    'College is not responsible for damage/loss of belongings.',
                    'All participants must adhere to University rules.',
                    'Audio track & background images must be submitted by the given date.',
                    'University Council & College Faculty may disqualify participants for disciplinary violations or commotion.',
                    'Final decision authority rests with the judges; decisions are final and not open for debate.',
                    'For queries, contact the Committee Head.'
                ],
                coordinator: {
                    faculty_name: 'Prof. Shraddha Galande',
                    role: 'Faculty Coordinator'
                },
                prizes: {
                    first: 'TBD',
                    second: 'TBD',
                    third: 'TBD'
                }
            }
        ],
        // Additional fields for view-details page compatibility
        festival_name: 'Saksham 4.0',
        organizing_body: 'Symbiosis Skills & Professional University',
        event_type: 'Arts & Culture Festival',
        type: 'cultural',
        overview: 'Saksham 4.0 is a spectacular three-day Arts & Culture festival hosted by Symbiosis Skills & Professional University. This vibrant celebration of creativity features five exciting competitions: Dance (solo and group), Singing (solo and duet), Band War, Beauty Pageant, and Theatre. The festival provides a platform for students to showcase their artistic talents, build confidence, and celebrate cultural diversity. With professional coordination by Prof. Shraddha Galande and comprehensive support facilities, Saksham 4.0 promises an unforgettable experience for all participants and attendees.',
        artists: [
            {
                name: 'Maahi',
                image: sakshamArtist1Maahi,
                genre: 'Playback Singer',
                type: 'performer'
            },
            {
                name: 'DJ Kratex',
                image: sakshamArtist2DjKratex,
                genre: 'Electronic Music',
                type: 'dj'
            },
            {
                name: 'Pragati Nagpal',
                image: sakshamArtist3PragatiNagpal,
                genre: 'Classical Dancer',
                type: 'performer'
            }
        ],
        contact: {
            phone: '+91 7378378021',
            email: 'saksham@sspu.ac.in',
            instagram: '@saksham_sspu'
        },
        ticketPrice: 'Free Entry',
        entry_fee_range: 'Free Entry',
        total_prize_money: '₹25,000',
        tags: ['cultural', 'dance', 'singing', 'theatre', 'arts', 'competition'],
        contactInfo: {
            registration_contacts: [
                {
                    name: 'Anand Shah',
                    phone: '+91 7378378021'
                },
                {
                    name: 'Suhani Karamchandani',
                    phone: '+91 9923756181',
                    role: 'Arts & Cultural University Head'
                }
            ]
        }
    }

];

// Export preprocessed events
export const comingSoonEvents = processEventsArray(rawComingSoonEvents);