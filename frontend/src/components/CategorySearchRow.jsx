import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Category hub search row — home button beside the search bar (mobile header).
 */
export default function CategorySearchRow({ isDark = false, children }) {
  const navigate = useNavigate();

  return (
    <div className="category-search-row flex w-full items-center gap-2.5">
      <button
        type="button"
        onClick={() => navigate('/')}
        aria-label="Home"
        className={`category-home-btn touch-target shrink-0 ${isDark ? 'category-home-btn--dark' : ''}`}
      >
        <Home className="category-home-btn__icon" strokeWidth={2} aria-hidden />
      </button>
      <div className="category-search-row__field min-w-0 flex-1">{children}</div>
    </div>
  );
}
