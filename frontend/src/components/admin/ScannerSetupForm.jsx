import { useEffect, useState } from 'react';
import {
  Copy,
  Check,
  Loader,
  Sheet,
  KeyRound,
  Link2,
  ShieldCheck,
  Eye,
  EyeOff,
  Share2,
} from 'lucide-react';
import { adminFetch } from '../../utils/adminApi';

const VARIANT = {
  fest: {
    codeLabel: 'Fest code',
    codePlaceholder: (name) => `${(name || 'FEST').slice(0, 8).toUpperCase().replace(/\s/g, '-')}-26`,
    labelPlaceholder: 'e.g. Delhi University Fest Team',
    subheading: 'Volunteers log in with this code & password — they can only scan tickets for this fest.',
  },
  trek: {
    codeLabel: 'Trek code',
    codePlaceholder: (name) => `${(name || 'TREK').slice(0, 8).toUpperCase().replace(/\s/g, '-')}-26`,
    labelPlaceholder: 'e.g. Manali Trek Team',
    subheading: 'Trek leaders log in with this code & password — they can only scan tickets for this trek.',
  },
  sport: {
    codeLabel: 'Event code',
    codePlaceholder: (name) => `${(name || 'RUN').slice(0, 8).toUpperCase().replace(/\s/g, '-')}-26`,
    labelPlaceholder: 'e.g. Sunday Run Club Gate Team',
    subheading: 'Volunteers log in with this code & password — they can only scan tickets for this event.',
  },
};

const inputClass =
  'w-full bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0ECCEE]';

function SectionCard({ step, icon: Icon, title, badge, children }) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-[#141517] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-800 bg-[#17181A]">
        <span className="w-6 h-6 rounded-full bg-[#0ECCEE]/15 text-[#0ECCEE] text-xs font-bold flex items-center justify-center shrink-0">
          {step}
        </span>
        <Icon size={15} className="text-[#0ECCEE] shrink-0" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {badge && <span className="ml-auto">{badge}</span>}
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

function CopyRow({ label, value, mono = true, hidden = false }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-800">
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <span
        className={`text-xs flex-1 truncate ${mono ? 'font-mono' : ''} ${
          value ? 'text-white' : 'text-gray-600 italic'
        }`}
      >
        {value ? (hidden ? '••••••••' : value) : 'not set'}
      </span>
      {value && (
        <button
          type="button"
          onClick={copy}
          className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"
          title={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
        </button>
      )}
    </div>
  );
}

export default function ScannerSetupForm({ variant = 'fest', eventId, eventName, apiPath }) {
  const cfg = VARIANT[variant] || VARIANT.fest;
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [savedPassword, setSavedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [label, setLabel] = useState('');
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSheet, setTestingSheet] = useState(false);
  const [sheetTestMessage, setSheetTestMessage] = useState('');
  const [message, setMessage] = useState('');
  const [copiedBundle, setCopiedBundle] = useState(false);

  const loginUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/organizer/login`
      : '/organizer/login';

  useEffect(() => {
    if (!eventId || !apiPath) return;
    setLoading(true);
    setMessage('');
    setSheetTestMessage('');
    adminFetch(apiPath)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCode(data.code || '');
          setLabel(data.label || '');
          setGoogleSheetsUrl(data.googleSheetsUrl || '');
          setEnabled(data.enabled !== false);
          setPassword(data.password || '');
          setSavedPassword(data.password || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId, apiPath]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await adminFetch(apiPath, {
        method: 'PUT',
        body: JSON.stringify({
          code,
          // Only send the password if it changed, so the hash isn't rewritten needlessly
          password: password && password !== savedPassword ? password : undefined,
          label,
          enabled,
          googleSheetsUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Save failed');
      setMessage(data.message || 'Saved successfully');
      setCode(data.code || code);
      if (data.password) {
        setPassword(data.password);
        setSavedPassword(data.password);
      }
    } catch (err) {
      setMessage(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const testSheetConnection = async () => {
    if (!googleSheetsUrl.trim()) {
      setSheetTestMessage('Enter a Google Sheets URL first');
      return;
    }
    setTestingSheet(true);
    setSheetTestMessage('');
    try {
      const res = await adminFetch('/registrations/admin/test-google-sheets', {
        method: 'POST',
        body: JSON.stringify({ googleSheetsUrl: googleSheetsUrl.trim() }),
      });
      const data = await res.json();
      setSheetTestMessage(
        data.success ? `Connected — "${data.title || 'Sheet'}"` : data.error || 'Connection failed',
      );
    } catch {
      setSheetTestMessage('Could not test connection');
    } finally {
      setTestingSheet(false);
    }
  };

  const shareBundle = [
    `Scanner login for ${eventName}`,
    `Link: ${loginUrl}`,
    `Code: ${code}`,
    savedPassword ? `Password: ${savedPassword}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const copyBundle = () => {
    navigator.clipboard?.writeText(shareBundle);
    setCopiedBundle(true);
    setTimeout(() => setCopiedBundle(false), 2000);
  };

  if (!eventId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-10 justify-center">
        <Loader className="animate-spin text-[#0ECCEE]" size={18} />
        Loading settings…
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white truncate">{eventName}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{cfg.subheading}</p>
      </div>

      <SectionCard
        step={1}
        icon={KeyRound}
        title="Credentials"
        badge={
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-gray-600 text-[#0ECCEE] focus:ring-[#0ECCEE]"
            />
            <ShieldCheck size={13} className={enabled ? 'text-green-400' : 'text-gray-600'} />
            {enabled ? 'Login enabled' : 'Login disabled'}
          </label>
        }
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">{cfg.codeLabel}</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={cfg.codePlaceholder(eventName)}
              className={`mt-1 ${inputClass}`}
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Password</label>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={savedPassword ? 'Saved — edit to change' : 'Set password'}
                className={`${inputClass} pr-10`}
                required={!savedPassword}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400">Scanner name in sheet (optional)</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={cfg.labelPlaceholder}
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </SectionCard>

      <SectionCard
        step={2}
        icon={Sheet}
        title="Google Sheets log"
        badge={
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              googleSheetsUrl ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {googleSheetsUrl ? 'URL set' : 'Optional'}
          </span>
        }
      >
        <p className="text-xs text-gray-500">
          Scans append to a <span className="text-gray-400">Check-ins</span> tab (auto-created).
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={googleSheetsUrl}
            onChange={(e) => {
              setGoogleSheetsUrl(e.target.value);
              setSheetTestMessage('');
            }}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className={`flex-1 ${inputClass}`}
          />
          <button
            type="button"
            onClick={testSheetConnection}
            disabled={testingSheet}
            className="px-4 py-2.5 text-xs font-medium border border-gray-600 rounded-lg hover:bg-gray-800 disabled:opacity-50 shrink-0"
          >
            {testingSheet ? 'Testing…' : 'Test connection'}
          </button>
        </div>
        {sheetTestMessage && (
          <p
            className={`text-xs ${
              sheetTestMessage.startsWith('Connected') ? 'text-green-400' : 'text-amber-400'
            }`}
          >
            {sheetTestMessage}
          </p>
        )}
      </SectionCard>

      <SectionCard
        step={3}
        icon={Share2}
        title="Share with volunteers"
        badge={
          code ? (
            <button
              type="button"
              onClick={copyBundle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#0ECCEE]/40 text-[#0ECCEE] rounded-lg hover:bg-[#0ECCEE]/10"
            >
              {copiedBundle ? <Check size={12} /> : <Copy size={12} />}
              {copiedBundle ? 'Copied' : 'Copy all'}
            </button>
          ) : null
        }
      >
        {code ? (
          <div className="space-y-2">
            <CopyRow label="Login link" value={loginUrl} mono={false} />
            <CopyRow label="Code" value={code} />
            <CopyRow label="Password" value={savedPassword} hidden={!showPassword} />
            {!savedPassword && (
              <p className="text-[11px] text-amber-400/80 flex items-center gap-1.5">
                <Link2 size={11} />
                Save a password above to include it in the share text.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            Set a code and password in step 1, then save — the share details will appear here.
          </p>
        )}
      </SectionCard>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-[#0ECCEE] text-black rounded-lg text-sm font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {message && (
          <p
            className={`text-xs ${
              message.includes('fail') || message.includes('Could') ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
