import { useNavigate, useLocation } from 'react-router-dom';
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

function resolveActiveCategory(pathname, explicit) {
    if (explicit) return explicit;
    if (pathname.startsWith('/fests')) return 'fests';
    if (pathname.startsWith('/sports')) return 'sports';
    if (pathname.startsWith('/treks')) return 'treks';
    if (pathname.startsWith('/theatre')) return 'theatre';
    return null;
}

function CategoryCard({ icon, darkIcon, label, isActive, isDark, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className={`category-card flex-1 flex flex-col items-center gap-1${isActive ? ' category-card--active' : ''}`}
        >
            <span className="category-icon-wrap">
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
            </span>
            <span className="category-active-line" aria-hidden />
        </button>
    );
}

export default function HomeCategoryBar({ isDark = false, activeCategory = null, noPadding = false }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const currentCategory = resolveActiveCategory(pathname, activeCategory);

    return (
        <div className={noPadding ? 'home-category-bar w-full' : 'home-category-bar mb-2 w-full px-0 sm:px-4'}>
            <div className="mx-auto flex w-full items-end justify-between gap-0.5 sm:max-w-[720px] sm:gap-1">
                {CATEGORIES.map(cat => (
                    <CategoryCard
                        key={cat.id}
                        {...cat}
                        isActive={currentCategory === cat.id}
                        isDark={isDark}
                        onClick={() => navigate(cat.path)}
                    />
                ))}
            </div>
        </div>
    );
}
