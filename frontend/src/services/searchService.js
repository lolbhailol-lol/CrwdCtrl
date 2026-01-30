/**
 * Search Service
 * Handles all search-related API calls
 */

// Get the API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

/**
 * Transform backend fest data to match frontend expectations
 * @param {Object} fest - Backend fest object
 * @returns {Object} Transformed fest object
 */
const transformFestData = (fest) => ({
    id: fest._id,
    title: fest.festName,
    festival_name: fest.festName,
    organizing_body: fest.collegeName,
    subtitle: `${fest.festDate || 'Date TBA'} • ${fest.venue || 'Venue TBA'}`,
    location: fest.venue || 'Location TBA',
    description: fest.description,
    category: fest.festType,
    type: fest.festType,
    tags: fest.highlights || [],
    image: fest.coverImage,
    startDate: fest.startDate,
    endDate: fest.endDate
});

/**
 * Transform backend competition data to match frontend expectations
 * @param {Object} competition - Backend competition object
 * @returns {Object} Transformed competition object
 */
const transformCompetitionData = (competition) => ({
    id: competition._id,
    title: competition.competitionName || competition.name,
    festival_name: competition.competitionName || competition.name,
    organizing_body: competition.festName || competition.organizingBody || 'Competition',
    subtitle: `${competition.competitionDate || 'Date TBA'} • ${competition.venue || 'Venue TBA'}`,
    location: competition.venue || competition.location || 'Location TBA',
    description: competition.description,
    category: competition.category || competition.competitionType || 'competition',
    type: competition.competitionType || 'competition',
    tags: competition.tags || [],
    image: competition.image || competition.coverImage,
    startDate: competition.startDate,
    endDate: competition.endDate,
    resultType: 'competition'
});

/**
 * Search competitions using the backend API
 * @param {string} query - Search query string
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Array of matching competitions
 */
export const searchCompetitions = async (query, filters = {}) => {
    try {
        console.log('🔍 searchCompetitions called with:', query);
        
        const searchParams = new URLSearchParams();
        
        if (query && query.trim()) {
            searchParams.append('query', query.trim());
        }
        
        // Add optional filters
        if (filters.festType) {
            searchParams.append('festType', filters.festType);
        }
        if (filters.location) {
            searchParams.append('location', filters.location);
        }

        const url = `${API_BASE_URL}/competitions/search?${searchParams.toString()}`;
        console.log('🔍 Competition search URL:', url);
        
        const response = await fetch(url);
        console.log('🔍 Competition response status:', response.status);
        
        if (!response.ok) {
            console.warn('Competition search endpoint not available:', response.status);
            return [];
        }
        
        const competitions = await response.json();
        console.log('🔍 Raw competitions:', competitions.length);
        
        // Transform backend data to match frontend expectations
        const transformed = competitions.map(transformCompetitionData);
        console.log('🔍 Transformed competitions:', transformed.length);
        
        return transformed;
    } catch (error) {
        console.error('Error searching competitions:', error);
        return [];
    }
};

/**
 * Search both fests and competitions
 * @param {string} query - Search query string
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} Object containing fests and competitions arrays
 */
export const searchAll = async (query, filters = {}) => {
    try {
        console.log('🔍 searchAll called with:', query);
        
        // Search both fests and competitions in parallel
        const [fests, competitions] = await Promise.all([
            searchFests(query, filters),
            searchCompetitions(query, filters)
        ]);

        console.log('🔍 searchAll results - fests:', fests.length, 'competitions:', competitions.length);

        return {
            fests,
            competitions,
            total: fests.length + competitions.length
        };
    } catch (error) {
        console.error('Error in combined search:', error);
        return {
            fests: [],
            competitions: [],
            total: 0
        };
    }
};

/**
 * Search fests using the backend API
 * @param {string} query - Search query string
 * @param {Object} filters - Optional filters (festType, location, startDate, endDate)
 * @returns {Promise<Array>} Array of matching fests
 */
export const searchFests = async (query, filters = {}) => {
    try {
        const searchParams = new URLSearchParams();
        
        if (query && query.trim()) {
            searchParams.append('query', query.trim());
        }
        
        // Add optional filters
        if (filters.festType) {
            searchParams.append('festType', filters.festType);
        }
        if (filters.location) {
            searchParams.append('location', filters.location);
        }
        if (filters.startDate) {
            searchParams.append('startDate', filters.startDate);
        }
        if (filters.endDate) {
            searchParams.append('endDate', filters.endDate);
        }

        const url = `${API_BASE_URL}/fests/search?${searchParams.toString()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status} ${response.statusText}`);
        }
        
        const fests = await response.json();
        
        // Transform backend data to match frontend expectations
        return fests.map(transformFestData);
    } catch (error) {
        console.error('Error searching fests:', error);
        return [];
    }
};

/**
 * Get all public fests with optional filtering
 * @param {Object} options - Options for pagination and filtering
 * @returns {Promise<Object>} Object containing fests array and pagination info
 */
export const getAllPublicFests = async (options = {}) => {
    try {
        const searchParams = new URLSearchParams();
        
        if (options.page) searchParams.append('page', options.page);
        if (options.limit) searchParams.append('limit', options.limit);
        if (options.festType) searchParams.append('festType', options.festType);
        if (options.college) searchParams.append('college', options.college);
        if (options.search) searchParams.append('search', options.search);
        if (options.sortBy) searchParams.append('sortBy', options.sortBy);

        const response = await fetch(`${API_BASE_URL}/fests/all?${searchParams.toString()}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch fests: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Transform backend data to match frontend expectations
        const transformedFests = data.fests.map(transformFestData);
        
        return {
            fests: transformedFests,
            pagination: data.pagination
        };
    } catch (error) {
        console.error('Error fetching all fests:', error);
        return { fests: [], pagination: null };
    }
};

/**
 * Get upcoming fests
 * @param {number} limit - Number of fests to return
 * @returns {Promise<Array>} Array of upcoming fests
 */
export const getUpcomingFests = async (limit = 5) => {
    try {
        const response = await fetch(`${API_BASE_URL}/fests/upcoming?limit=${limit}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch upcoming fests: ${response.status} ${response.statusText}`);
        }
        
        const fests = await response.json();
        
        // Transform backend data to match frontend expectations
        return fests.map(transformFestData);
    } catch (error) {
        console.error('Error fetching upcoming fests:', error);
        return [];
    }
};

export default {
    searchFests,
    searchCompetitions,
    searchAll,
    getAllPublicFests,
    getUpcomingFests
};