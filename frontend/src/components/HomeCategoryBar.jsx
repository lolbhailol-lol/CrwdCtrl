import { useNavigate } from 'react-router-dom';
import FestsIcon from '../assets/mobile-icons/FEST.svg';
import SportsIcon from '../assets/mobile-icons/SPORTS.svg';
import TreksIcon from '../assets/mobile-icons/trek.svg';
import TheatreIcon from '../assets/mobile-icons/THETRE.svg';
import FestsDarkIcon from '../assets/mobile-icons/fest-dark.svg';
import SportsDarkIcon from '../assets/mobile-icons/sports-dark.svg';
import TreksDarkIcon from '../assets/mobile-icons/treks-dark.svg';
import TheatreDarkIcon from '../assets/mobile-icons/theatre-dark.svg';

const CATEGORIES = [
    { id: 'fests',   icon: FestsIcon,   darkIcon: FestsDarkIcon,   label: 'Fests',   path: '/fests' },
    { id: 'sports',  icon: SportsIcon,  darkIcon: SportsDarkIcon,  label: 'Sports',  path: '/sports' },
    { id: 'treks',   icon: TreksIcon,   darkIcon: TreksDarkIcon,   label: 'Treks',   path: '/treks' },
    { id: 'theatre', icon: TheatreIcon, darkIcon: TheatreDarkIcon, label: 'Theatre', path: '/theatre' },
];

/*
  Category icons are full SVG assets (illustration + label).
  No extra wrapper box — active state uses lift + shadow only.
 */
function CategoryCard({ icon, darkIcon, label, isActive, isDark, onClick }) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className="flex-1 flex flex-col items-center active:opacity-80"
        >
            <img
                src={isDark ? darkIcon : icon}
                alt={label}
                width={78}
                height={85}
                draggable={false}
                decoding="sync"
                loading="eager"
                className="crisp-icon category-icon pointer-events-none select-none"
            />
        </button>
    );
}

export default function HomeCategoryBar({ isDark = false, activeCategory = null, noPadding = false }) {
    const navigate = useNavigate();

    return (
        <div className={noPadding ? 'home-category-bar w-full' : 'home-category-bar mb-2 w-full px-0 sm:px-4'}>
            <div className="mx-auto flex w-full items-center justify-between gap-0.5 sm:max-w-[720px] sm:gap-1">
                {CATEGORIES.map(cat => (
                    <CategoryCard
                        key={cat.id}
                        {...cat}
                        isActive={activeCategory === cat.id}
                        isDark={isDark}
                        onClick={() => navigate(cat.path)}
                    />
                ))}
            </div>
        </div>
    );
}
