import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import HomeCategoryBar from '../HomeCategoryBar';
import MobileStickyHeader from '../MobileStickyHeader';
import HeroSearchBar from '../HeroSearchBar';
import AppLogo from '../AppLogo';
import { CompactPortraitCardsRowSkeleton } from '../HomeEventCardSkeleton';
import CustomPageSectionsRenderer from '../CustomPageSectionsRenderer';
import { usePageSectionHandlers } from '../../utils/pageSectionHandlers';
import { useFavorites } from '../../context/FavoritesContext';
import { useNavigate } from 'react-router-dom';

const THEATRE_TYPE_LABELS = {
  play: 'Play',
  musical: 'Musical',
  standup: 'Stand-up',
  improv: 'Improv',
  dance_drama: 'Dance Drama',
  other: 'Other',
};

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

function ShowCard({ show, isDark, onBook }) {
  const poster = show.poster ? getImageUrl(show.poster, { preset: 'cardLg' }) : null;
  return (
    <div
      className={`flex flex-col card-portrait cursor-pointer active:scale-95 transition-all duration-200 ${isDark ? 'text-white' : 'text-black'}`}
      onClick={onBook}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onBook()}
    >
      <div className="card-portrait-image relative overflow-hidden">
        {poster ? (
          <img
            src={poster}
            alt={show.title}
            className="w-full h-full object-cover"
            onError={(e) => handleImageErrorWithFallback(e, 160, 208, '#2a1a3a', show.title || 'Show')}
          />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-purple-800 to-indigo-600 flex items-center justify-center">
            <span className="text-5xl">🎭</span>
          </div>
        )}
      </div>
      <div className="mt-2 px-1">
        <p className="font-semibold text-sm line-clamp-2">{show.title}</p>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {THEATRE_TYPE_LABELS[show.theatreType] || show.theatreType}
        </p>
        {show.city && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            <MapPin className="size-3 shrink-0" />
            {show.city}
          </p>
        )}
      </div>
    </div>
  );
}

export default function TheatrePage() {
  const { isDark } = useDarkMode();
  const navigate = useNavigate();
  const { toggleFavorite, isFavorite } = useFavorites();
  const [shows, setShows] = useState([]);
  const [carouselFests, setCarouselFests] = useState([]);
  const [carouselTreks, setCarouselTreks] = useState([]);
  const [carouselCommunities, setCarouselCommunities] = useState([]);
  const [carouselSports, setCarouselSports] = useState([]);
  const [carouselRunClubs, setCarouselRunClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [theatreRes, festsRes, treksRes, commRes, sportsRes, clubsRes] = await Promise.all([
          fetch(`${API}/theatre?_cb=${Date.now()}`, { headers: { Accept: 'application/json' }, credentials: 'omit', mode: 'cors' }),
          fetch(`${API}/fests/all?_cb=${Date.now()}`, { headers: { Accept: 'application/json' }, credentials: 'omit', mode: 'cors' }),
          fetch(`${API}/treks?_cb=${Date.now()}`, { headers: { Accept: 'application/json' }, credentials: 'omit', mode: 'cors' }),
          fetch(`${API}/trek-communities?_cb=${Date.now()}`, { headers: { Accept: 'application/json' }, credentials: 'omit', mode: 'cors' }),
          fetch(`${API}/sports?_cb=${Date.now()}`, { headers: { Accept: 'application/json' }, credentials: 'omit', mode: 'cors' }),
          fetch(`${API}/run-clubs?_cb=${Date.now()}`, { headers: { Accept: 'application/json' }, credentials: 'omit', mode: 'cors' }),
        ]);
        if (!cancelled) {
          if (theatreRes.ok) {
            const data = await theatreRes.json();
            setShows(data.shows || []);
          }
          if (festsRes.ok) {
            const data = await festsRes.json();
            setCarouselFests(Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : []);
          }
          if (treksRes.ok) {
            const data = await treksRes.json();
            setCarouselTreks(Array.isArray(data?.treks) ? data.treks : []);
          }
          if (commRes.ok) {
            const data = await commRes.json();
            setCarouselCommunities(Array.isArray(data?.communities) ? data.communities : []);
          }
          if (sportsRes.ok) {
            const data = await sportsRes.json();
            setCarouselSports(Array.isArray(data?.events) ? data.events : []);
          }
          if (clubsRes.ok) {
            const data = await clubsRes.json();
            setCarouselRunClubs(Array.isArray(data?.clubs) ? data.clubs : []);
          }
        }
      } catch {
        if (!cancelled) setShows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = shows.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.title?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q) ||
      s.venue?.toLowerCase().includes(q)
    );
  });

  const handleBook = (show) => {
    if (show.bookingLink) {
      window.open(show.bookingLink, '_blank', 'noopener,noreferrer');
    }
  };

  const { onItemClick, onToggleFavorite: onSectionFav, getShareUrl } = usePageSectionHandlers(navigate, { toggleFavorite });

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
      <MobileStickyHeader
        isDark={isDark}
        brandingRow={<AppLogo />}
        searchRow={
          <HeroSearchBar
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search theatre shows..."
          />
        }
        categoryBar={<HomeCategoryBar activeCategory="theatre" />}
      />

      <main className="px-4 pt-4 max-w-7xl mx-auto lg:ml-20">
        <h1 className={`text-2xl font-bold mb-4 font-inter ${isDark ? 'text-white' : 'text-black'}`}>
          Theatre &amp; Performing Arts
        </h1>

        {loading ? (
          <CompactPortraitCardsRowSkeleton count={4} />
        ) : filtered.length === 0 ? (
          <p className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            No theatre shows available right now. Check back soon!
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((show) => (
              <ShowCard
                key={show._id}
                show={show}
                isDark={isDark}
                onBook={() => handleBook(show)}
              />
            ))}
          </div>
        )}

        <CustomPageSectionsRenderer
          targetPage="theatre"
          fests={carouselFests}
          treks={carouselTreks}
          communities={carouselCommunities}
          sports={carouselSports}
          runClubs={carouselRunClubs}
          isDark={isDark}
          loading={loading}
          isFavorite={isFavorite}
          onToggleFavorite={onSectionFav}
          onItemClick={onItemClick}
          getShareUrl={getShareUrl}
        />
      </main>
    </div>
  );
}
