import { groupdanceImg } from '../utils/imageImports.js';
import { processEventsArray } from '../utils/imagePreprocessor.js';

const rawLastYearHitsEvents = [
    {
        id: 'aarohan-2026',
        title: 'AAROHAN 2026',
        subtitle: 'Cultural & Sports Extravaganza',
        image: groupdanceImg,
        fallbackImage: null,
        description: 'Experience the ultimate college festival featuring cultural competitions like InSync Group Dance, Head Bang Band Wars, Dastak Street Play, and thrilling sports competitions including Box Cricket and Football.',
        category: 'Multi-Category',
        participants: '1000+ Participants',
        duration: '3 Days',
        categoryColor: 'bg-linear-to-r from-purple-600 to-blue-600'
    }
];

// Export preprocessed events
export const lastYearHitsEvents = processEventsArray(rawLastYearHitsEvents);