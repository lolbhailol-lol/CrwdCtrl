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
    { id: 'sports',  icon: SportsIcon,  darkIcon: SportsDarkIcon,  label: 'Sports',  path: '/sports-fest' },
    { id: 'treks',   icon: TreksIcon,   darkIcon: TreksDarkIcon,   label: 'Treks',   path: '/treks' },
    { id: 'theatre', icon: TheatreIcon, darkIcon: TheatreDarkIcon, label: 'Theatre', path: '/theatre' },
];

/*
  Figma spec:
  - Icon image: w-20 h-14 (80×56px), overflows 37px above the box
  - Box: w-16 h-12 (64×48px), rounded-2xl
  - Active box: shadow + border-slate-100
  - Label: text-sm font-medium, inside/below box
  - Active underline: thin black line under label
*/
function CategoryCard({ icon, darkIcon, label, isActive, isDark, onClick }) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className="flex-1 flex flex-col items-center gap-0.5 active:scale-95 transition-all duration-200"
        >
            <div className={`transition-all duration-200 ${isActive ? '-translate-y-1 scale-110 drop-shadow-lg' : 'scale-100'}`}>
                <img
                    src={isDark ? darkIcon : icon}
                    alt={label}
                    draggable={false}
                    className="w-[110px] h-[88px] object-contain"
                />
            </div>
            <div className={`h-1 w-5 rounded-full transition-all duration-200 ${isActive ? 'bg-[#0ECCEE]' : 'bg-transparent'}`} />
        </button>
    );
}

export default function HomeCategoryBar({ isDark = false, activeCategory = null, noPadding = false }) {
    const navigate = useNavigate();

    return (
        <div className={noPadding ? 'w-full' : 'mb-2 w-full px-0 sm:px-4'}>
            <div className="mx-auto flex w-full items-end gap-1 sm:max-w-[640px] sm:gap-2">
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
