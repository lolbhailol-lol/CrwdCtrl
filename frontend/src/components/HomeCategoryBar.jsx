import { useNavigate, useLocation } from 'react-router-dom';
import { CATEGORY_NAV_ICONS } from '../constants/categoryNavIcons';

const CATEGORIES = [
  { id: 'fests', label: 'Fests', path: '/fests' },
  { id: 'sports', label: 'Sports', path: '/sports' },
  { id: 'treks', label: 'Treks', path: '/treks' },
  { id: 'events', label: 'Events', path: '/events' },
];

function resolveActiveCategory(pathname, explicit) {
  if (explicit) return explicit;
  if (pathname.startsWith('/fests')) return 'fests';
  if (pathname.startsWith('/sports')) return 'sports';
  if (pathname.startsWith('/treks')) return 'treks';
  if (pathname.startsWith('/events') || pathname.startsWith('/theatre')) return 'events';
  return null;
}

function CategoryCard({ categoryId, label, isActive, isDark, onClick }) {
  const iconSet = isDark ? CATEGORY_NAV_ICONS.dark : CATEGORY_NAV_ICONS.light;
  const src = iconSet[categoryId];

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
          src={src}
          alt={label}
          width={78}
          height={85}
          draggable={false}
          decoding="async"
          loading="eager"
          fetchPriority="high"
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
        {CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat.id}
            categoryId={cat.id}
            label={cat.label}
            isActive={currentCategory === cat.id}
            isDark={isDark}
            onClick={() => {
              if (currentCategory === cat.id) return;
              navigate(cat.path);
            }}
          />
        ))}
      </div>
    </div>
  );
}
