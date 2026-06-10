import { useEffect, useState } from 'react';
import { Copy, Check, Loader, Sheet, KeyRound, Link2, ShieldCheck } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const VARIANT = {
  fest: {
    codeLabel: 'Fest code',
    codePlaceholder: (name) => `${(name || 'FEST').slice(0, 8).toUpperCase().replace(/\s/g, '-')}-26`,
    passwordLabel: 'Password',
    labelPlaceholder: 'e.g. Delhi University Fest Team',
    heading: 'Scanner credentials',
    subheading: 'Volunteers log in with this code — they can only scan tickets for this fest.',
  },
  trek: {
    codeLabel: 'Trek code',
    codePlaceholder: (name) => `${(name || 'TREK').slice(0, 8).toUpperCase().replace(/\s/g, '-')}-26`,
    passwordLabel: 'Password',
    labelPlaceholder: 'e.g. Manali Trek Team',
    heading: 'Scanner credentials',
    subheading: 'Trek leaders log in with this code — they can only scan tickets for this trek.',
  },
  sport: {
    codeLabel: 'Event code',
    codePlaceholder: (name) => `${(name || 'RUN').slice(0, 8).toUpperCase().replace(/\s/g, '-')}-26`,
    passwordLabel: 'Password',
    labelPlaceholder: 'e.g. Sunday Run Club Gate Team',
    heading: 'Scanner credentials',
    subheading: 'Volunteers log in with this code — they can only scan tickets for this sports/run club event.',
  },
};

export default function ScannerSetupForm({ variant = 'fest', eventId, eventName, apiPath }) {
  const cfg = VARIANT[variant] || VARIANT.fest;
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [label, setLabel] = useState('');
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSheet, setTestingSheet] = useState(false);
  const [sheetTestMessage, setSheetTestMessage] = useState('');
  const [message, setMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBundle, setCopiedBundle] = useState(false);

  const loginUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/organizer/login`
      : '/organizer/login';

  useEffect(() => {
    if (!eventId || !apiPath) return;
    setLoading(true);
    fetch(`${API}${apiPath}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCode(data.code || '');
          setLabel(data.label || '');
          setGoogleSheetsUrl(data.googleSheetsUrl || '');
          setEnabled(data.enabled !== false);
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
      const res = await fetch(`${API}${apiPath}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({
          code,
          password: password || undefined,
          label,
          enabled,
          googleSheetsUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Save failed');
      setMessage(data.message || 'Saved successfully');
      setPassword('');
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
      const res = await fetch(`${API}/registrations/admin/test-google-sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
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

  const copyText = (text, setter) => {
    navigator.clipboard?.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const shareBundle = code
    ? `Login: ${loginUrl}\nCode: ${code}\nEvent: ${eventName}`
    : '';

  if (!eventId) return null;

  const inputClass =
    'w-full bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0ECCEE]';

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#0ECCEE]/5 border border-[#0ECCEE]/20">
        <Link2 className="text-[#0ECCEE] shrink-0 mt-0.5" size={18} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-300">Organizer login link</p>
          <p className="text-xs text-[#0ECCEE] truncate mt-1">{loginUrl}</p>
        </div>
        <button
          type="button"
          onClick={() => copyText(loginUrl, setCopiedLink)}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-600 rounded-lg hover:bg-gray-800"
        >
          {copiedLink ? <Check size={12} /> : <Copy size={12} />}
          {copiedLink ? 'Copied' : 'Copy'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-6 justify-center">
          <Loader className="animate-spin text-[#0ECCEE]" size={18} />
          Loading settings…
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-[#0ECCEE]" />
              <h3 className="text-sm font-semibold text-white">{cfg.heading}</h3>
            </div>
            <p className="text-xs text-gray-500">{cfg.subheading}</p>

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
                <label className="text-xs text-gray-400">{cfg.passwordLabel}</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={code ? 'Leave blank to keep current' : 'Set password'}
                  className={`mt-1 ${inputClass}`}
                />
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

            <label className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-gray-600 text-[#0ECCEE] focus:ring-[#0ECCEE]"
              />
              <ShieldCheck size={14} className="text-gray-500" />
              Scanner login enabled
            </label>
          </section>

          <section className="rounded-xl border border-gray-800 bg-[#1D1E20] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sheet size={16} className="text-[#0ECCEE]" />
              <span className="text-sm font-medium text-white">Google Sheets log</span>
              <span
                className={`text-xs ml-auto px-2 py-0.5 rounded-full ${
                  googleSheetsUrl
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                {googleSheetsUrl ? 'URL set' : 'Not set'}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
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
          </section>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#0ECCEE] text-black rounded-lg text-sm font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            {message && (
              <p className={`text-xs ${message.includes('fail') || message.includes('Could') ? 'text-red-400' : 'text-green-400'}`}>
                {message}
              </p>
            )}
          </div>

          {code && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-500 flex-1">
                Share with <span className="text-white">{eventName}</span>: code{' '}
                <span className="text-[#0ECCEE] font-medium">{code}</span> + password
              </p>
              <button
                type="button"
                onClick={() => copyText(shareBundle, setCopiedBundle)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-600 rounded-lg hover:bg-gray-800 shrink-0"
              >
                {copiedBundle ? <Check size={12} /> : <Copy size={12} />}
                Copy share text
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
