import { useNavigate } from 'react-router-dom';

/**
 * Consistent back control for Campus Hunt player screens.
 * Prefers browser history; falls back to `to` when there’s nowhere to go.
 */
export default function CampusHuntBackLink({
  to = '/',
  label = 'Back',
  className = '',
}) {
  const navigate = useNavigate();

  const onBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(to);
  };

  return (
    <button
      type="button"
      onClick={onBack}
      className={`inline-flex items-center gap-1 text-[11px] text-white/40 transition hover:text-white/75 ${className}`}
    >
      <span aria-hidden>←</span>
      {label}
    </button>
  );
}
