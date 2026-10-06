import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './huntV2.css';

export function HuntPageShell({ children, className = '' }) {
  return <main className={`hunt-v2 ${className}`.trim()}>{children}</main>;
}

export function HuntPageHeader({ title, backTo, onBack }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (onBack) return onBack();
    if (backTo) return navigate(backTo);
    return navigate(-1);
  };

  return (
    <header className="hunt-v2-header">
      <button type="button" onClick={goBack} className="hunt-v2-back" aria-label="Go back">
        <ChevronLeft size={20} aria-hidden />
        <span>{title}</span>
      </button>
      <div className="hunt-v2-brand" aria-label="CrwdCtrl">Ctrl.</div>
      <img src="/campus-hunt/v2/checkpoint-deco.svg" alt="" className="hunt-v2-header-route" />
    </header>
  );
}

export function MissionProgress({ label, step, total = 8 }) {
  const progress = Math.max(0, Math.min(100, (Number(step) / Number(total || 1)) * 100));
  return (
    <section className="hunt-v2-progress" aria-label={`${label} progress ${step} of ${total}`}>
      <div><span>{label}</span><strong>{step} / {total}</strong></div>
      <div className="hunt-v2-track"><span style={{ width: `${progress}%` }} /></div>
    </section>
  );
}

export function HuntSectionLabel({ children }) {
  return (
    <div className="hunt-v2-section-label">
      <span aria-hidden />
      <strong>{children}</strong>
    </div>
  );
}

export function HuntPrimaryButton({ children, className = '', ...props }) {
  return (
    <button type="button" className={`hunt-v2-primary ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

