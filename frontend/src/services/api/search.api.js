/**
 * Search API — fest/competition search and public listing endpoints.
 */
import { publicFetch } from './client.js';

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
  endDate: fest.endDate,
});

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
  resultType: 'competition',
});

export const searchCompetitions = async (query, filters = {}) => {
  try {
    const searchParams = new URLSearchParams();
    if (query?.trim()) searchParams.append('query', query.trim());
    if (filters.festType) searchParams.append('festType', filters.festType);
    if (filters.location) searchParams.append('location', filters.location);

    const response = await publicFetch(`/competitions/search?${searchParams.toString()}`);
    if (!response.ok) return [];

    const competitions = await response.json();
    return competitions.map(transformCompetitionData);
  } catch (error) {
    console.error('Error searching competitions:', error);
    return [];
  }
};

export const searchAll = async (query, filters = {}) => {
  try {
    const [fests, competitions] = await Promise.all([
      searchFests(query, filters),
      searchCompetitions(query, filters),
    ]);
    return { fests, competitions, total: fests.length + competitions.length };
  } catch (error) {
    console.error('Error in combined search:', error);
    return { fests: [], competitions: [], total: 0 };
  }
};

let keywordsCache = null;
let keywordsCacheAt = 0;
const KEYWORDS_TTL_MS = 5 * 60 * 1000;

export const clearSearchKeywordsCache = () => {
  keywordsCache = null;
  keywordsCacheAt = 0;
};

export const fetchSearchKeywords = async () => {
  if (keywordsCache && Date.now() - keywordsCacheAt < KEYWORDS_TTL_MS) {
    return keywordsCache;
  }
  try {
    const response = await publicFetch('/search/keywords');
    if (!response.ok) return keywordsCache || [];
    const data = await response.json();
    const list = Array.isArray(data?.keywords) ? data.keywords.filter(Boolean) : [];
    keywordsCache = list;
    keywordsCacheAt = Date.now();
    return list;
  } catch (error) {
    console.warn('Failed to fetch search keywords:', error);
    return keywordsCache || [];
  }
};

export const searchFests = async (query, filters = {}) => {
  try {
    const searchParams = new URLSearchParams();
    if (query?.trim()) searchParams.append('query', query.trim());
    if (filters.festType) searchParams.append('festType', filters.festType);
    if (filters.location) searchParams.append('location', filters.location);
    if (filters.startDate) searchParams.append('startDate', filters.startDate);
    if (filters.endDate) searchParams.append('endDate', filters.endDate);

    const response = await publicFetch(`/fests/search?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }

    const fests = await response.json();
    return fests.map(transformFestData);
  } catch (error) {
    console.error('Error searching fests:', error);
    return [];
  }
};

export const getAllPublicFests = async (options = {}) => {
  try {
    const searchParams = new URLSearchParams();
    if (options.page) searchParams.append('page', options.page);
    if (options.limit) searchParams.append('limit', options.limit);
    if (options.festType) searchParams.append('festType', options.festType);
    if (options.college) searchParams.append('college', options.college);
    if (options.search) searchParams.append('search', options.search);
    if (options.sortBy) searchParams.append('sortBy', options.sortBy);

    const response = await publicFetch(`/fests/all?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch fests: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      fests: data.fests.map(transformFestData),
      pagination: data.pagination,
    };
  } catch (error) {
    console.error('Error fetching all fests:', error);
    return { fests: [], pagination: null };
  }
};

export const getUpcomingFests = async (limit = 5) => {
  try {
    const response = await publicFetch(`/fests/upcoming?limit=${limit}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch upcoming fests: ${response.status} ${response.statusText}`);
    }

    const fests = await response.json();
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
  fetchSearchKeywords,
  getAllPublicFests,
  getUpcomingFests,
};
