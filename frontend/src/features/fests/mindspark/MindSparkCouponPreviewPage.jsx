import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../../context/DarkModeContext';
import MindSparkSuccessStep from './MindSparkSuccessStep';

/**
 * Local UI preview — no registration needed.
 * Open: /mindspark/coupon-preview
 */
export default function MindSparkCouponPreviewPage() {
  const navigate = useNavigate();
  const { isDark } = useDarkMode();

  const fest = {
    _id: 'preview-fest',
    festName: 'MindSpark 2026',
    registration: {
      whatsappCommunityLink: 'https://chat.whatsapp.com/preview',
    },
  };

  const competition = {
    _id: 'preview-comp',
    name: 'Game of Innovation',
    coverImage:
      'https://res.cloudinary.com/dyonimhgb/image/upload/v1786723270/crwdctrl/competitions/szft2cp3lfdcg9tf1np3.jpg',
    registration: {
      whatsappGroupLink: 'https://chat.whatsapp.com/preview',
    },
  };

  return (
    <div className="relative">
      <div
        className={`sticky top-0 z-50 px-4 py-2 text-center text-xs font-semibold tracking-wide ${
          isDark ? 'bg-amber-500/90 text-black' : 'bg-amber-400 text-black'
        }`}
      >
        PREVIEW ONLY — not a real registration ·{' '}
        <button type="button" className="underline" onClick={() => navigate(-1)}>
          Go back
        </button>
      </div>
      <MindSparkSuccessStep
        isDark={isDark}
        competition={competition}
        fest={fest}
        registrationId={null}
        navigate={navigate}
        competitionId="preview-comp"
        festId="preview-fest"
        stallCoupon={{ brand: 'Svvad Pro', discountPercent: 20, code: 'SV7K3MP' }}
      />
    </div>
  );
}
