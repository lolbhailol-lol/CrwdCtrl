import { useState } from 'react';
import { ISSUE_CATEGORIES } from '../config';
import { volunteerReportIssue } from '../services/campusHunt.api';

export default function IssueReportForm({ checkpointId, teamId, onDone }) {
  const [category, setCategory] = useState('technical');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await volunteerReportIssue({ category, notes, checkpointId, teamId });
      setMsg('Issue reported');
      setNotes('');
      onDone?.();
    } catch (err) {
      setMsg(err.message || 'Failed to report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">Report issue</h3>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-white"
      >
        {ISSUE_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={3}
        className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-white"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-amber-500/90 py-2 font-semibold text-black disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Submit report'}
      </button>
      {msg && <p className="text-center text-sm text-white/70">{msg}</p>}
    </form>
  );
}
