import { useNavigate } from 'react-router-dom';

/**
 * Consistent back control for Campus Hunt player screens.
 * @param {boolean} [forceTo] — always go to `to` (use for “All rounds” / hub exits)
 */
export default function CampusHuntBackLink({
  to = '/',
  label = 'Back',
  className = '',
  forceTo = false,
  onBeforeNavigate,
}) {
  const navigate = useNavigate();

  const onBack = () => {
    onBeforeNavigate?.();
    if (forceTo && to) {
      navigate(to);
      return;
    }
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
