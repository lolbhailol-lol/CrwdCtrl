import { useEffect, useState } from 'react';
import { adminFetchJSON } from '../../services/api/admin.api.js';

const inputClass = 'w-full rounded-lg border border-gray-700 bg-[#191b1d] px-3 py-2 text-sm text-white outline-none focus:border-[#0ECCEE]';
const buttonClass = 'rounded-lg bg-[#0ECCEE] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50';

export default function CollegePlatformPage() {
  const [data, setData] = useState({ games: [], colleges: [], hostRequests: [], registrations: [] });
  const [college, setCollege] = useState({ name: '', shortName: '', city: '', emailDomains: '' });
  const [game, setGame] = useState({ title: '', slug: '', venue: '', city: '', startsAt: '', teamSize: 4, capacity: 20, feePerTeam: 0, status: 'draft', hostCollegeId: '' });
  const [result, setResult] = useState({ registrationId: '', placement: 1, points: '' });
  const [qrToken, setQrToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const response = await adminFetchJSON('/admin/college-platform');
      setData(response);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => { load(); }, []);

  const run = async (path, options) => {
    setBusy(true);
    try {
      await adminFetchJSON(path, options);
      await load();
      setMessage('Saved successfully');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const post = (path, body, method = 'POST') => run(path, { method, body: JSON.stringify(body) });
  const approveSubstitution = (registration, member) => {
    const name = window.prompt('Substitute name', member.name);
    if (!name) return;
    const email = window.prompt('Approved college email', member.email);
    if (!email) return;
    post(`/admin/college-platform/registrations/${registration._id}/members/${member._id}/approve-substitution`, { name, email });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">College Games</h1>
        <p className="mt-1 text-sm text-gray-400">Colleges, games, registrations, passes, requests, and audited results.</p>
        {message ? <p className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-[#0ECCEE]">{message}</p> : null}
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <form className="space-y-3 rounded-xl border border-gray-800 bg-[#111213] p-5" onSubmit={(event) => { event.preventDefault(); post('/admin/college-platform/colleges', { ...college, emailDomains: college.emailDomains.split(',').map((value) => value.trim()).filter(Boolean) }); }}>
          <h2 className="text-lg font-semibold">Add approved college</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={inputClass} placeholder="College name" required value={college.name} onChange={(event) => setCollege({ ...college, name: event.target.value })} />
            <input className={inputClass} placeholder="Short name" value={college.shortName} onChange={(event) => setCollege({ ...college, shortName: event.target.value })} />
            <input className={inputClass} placeholder="City" value={college.city} onChange={(event) => setCollege({ ...college, city: event.target.value })} />
            <input className={inputClass} placeholder="Domains: college.edu, college.ac.in" required value={college.emailDomains} onChange={(event) => setCollege({ ...college, emailDomains: event.target.value })} />
          </div>
          <button className={buttonClass} disabled={busy}>Add college</button>
        </form>

        <form className="space-y-3 rounded-xl border border-gray-800 bg-[#111213] p-5" onSubmit={(event) => { event.preventDefault(); post('/admin/college-platform/games', { ...game, startsAt: game.startsAt || null }); }}>
          <h2 className="text-lg font-semibold">Create game</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={inputClass} placeholder="Game title" required value={game.title} onChange={(event) => setGame({ ...game, title: event.target.value })} />
            <input className={inputClass} placeholder="URL slug" required value={game.slug} onChange={(event) => setGame({ ...game, slug: event.target.value })} />
            <input className={inputClass} placeholder="Venue" value={game.venue} onChange={(event) => setGame({ ...game, venue: event.target.value })} />
            <input className={inputClass} placeholder="City" value={game.city} onChange={(event) => setGame({ ...game, city: event.target.value })} />
            <input className={inputClass} type="datetime-local" value={game.startsAt} onChange={(event) => setGame({ ...game, startsAt: event.target.value })} />
            <select className={inputClass} value={game.hostCollegeId} onChange={(event) => setGame({ ...game, hostCollegeId: event.target.value })}>
              <option value="">No host college</option>
              {data.colleges.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
            <input className={inputClass} type="number" min="2" max="12" placeholder="Team size" value={game.teamSize} onChange={(event) => setGame({ ...game, teamSize: Number(event.target.value) })} />
            <input className={inputClass} type="number" min="1" placeholder="Capacity" value={game.capacity} onChange={(event) => setGame({ ...game, capacity: Number(event.target.value) })} />
            <input className={inputClass} type="number" min="0" placeholder="Fee per team" value={game.feePerTeam} onChange={(event) => setGame({ ...game, feePerTeam: Number(event.target.value) })} />
            <select className={inputClass} value={game.status} onChange={(event) => setGame({ ...game, status: event.target.value })}>
              <option value="draft">Draft</option><option value="published">Published</option><option value="completed">Completed</option>
            </select>
          </div>
          <button className={buttonClass} disabled={busy}>Create game</button>
        </form>
      </section>

      <section className="rounded-xl border border-gray-800 bg-[#111213] p-5">
        <h2 className="mb-4 text-lg font-semibold">Approved college domains</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.colleges.map((item) => <article key={item._id} className="rounded-lg border border-gray-800 p-4"><div className="flex justify-between gap-3"><strong>{item.name}</strong><span className="text-xs uppercase text-[#0ECCEE]">{item.status}</span></div><p className="mt-2 break-words text-xs text-gray-400">{item.emailDomains?.join(', ')}</p><button type="button" className="mt-3 rounded bg-gray-700 px-3 py-1 text-xs" onClick={() => { const domains = window.prompt('Comma-separated approved domains', item.emailDomains?.join(', ')); if (domains != null) post(`/admin/college-platform/colleges/${item._id}`, { emailDomains: domains.split(',').map((value) => value.trim()).filter(Boolean) }, 'PUT'); }}>Edit domains</button></article>)}
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-[#111213] p-5">
        <h2 className="mb-4 text-lg font-semibold">Games</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.games.map((item) => (
            <article key={item._id} className="rounded-lg border border-gray-800 p-4">
              <div className="flex items-start justify-between gap-3"><strong>{item.title}</strong><span className="text-xs uppercase text-[#0ECCEE]">{item.status}</span></div>
              <p className="mt-2 text-xs text-gray-400">{item.hostCollegeId?.shortName || item.hostCollegeId?.name || 'Independent'} · {item.reservedSlots || 0}/{item.capacity} teams</p>
              <div className="mt-3 flex gap-2">
                {item.status !== 'published' ? <button className="rounded bg-emerald-700 px-3 py-1 text-xs" onClick={() => post(`/admin/college-platform/games/${item._id}`, { status: 'published' }, 'PUT')}>Publish</button> : null}
                {item.status !== 'completed' ? <button className="rounded bg-gray-700 px-3 py-1 text-xs" onClick={() => post(`/admin/college-platform/games/${item._id}`, { status: 'completed' }, 'PUT')}>Complete</button> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-[#111213] p-5">
          <h2 className="mb-4 text-lg font-semibold">Host requests</h2>
          <div className="space-y-3">
            {!data.hostRequests.length ? <p className="rounded-lg border border-dashed border-gray-700 p-4 text-sm text-gray-500">No host requests yet.</p> : null}
            {data.hostRequests.map((item) => (
              <article key={item._id} className="rounded-lg border border-gray-800 bg-black/20 p-4 text-sm">
                <div className="flex items-start justify-between gap-3"><div><strong className="text-base">{item.gameName || 'Game proposal'}</strong><p className="mt-0.5 text-xs text-gray-400">{item.collegeName} · {item.clubName || 'Independent club'}</p></div><span className="rounded-full bg-[#0ECCEE]/10 px-2 py-1 text-xs uppercase text-[#0ECCEE]">{item.status}</span></div>
                <div className="mt-3 grid gap-1 text-xs text-gray-400 sm:grid-cols-2">
                  <p>{item.name}{item.contactRole ? ` · ${item.contactRole}` : ''}</p><p>{item.city}</p>
                  <a className="text-[#0ECCEE]" href={`mailto:${item.email}`}>{item.email}</a>{item.phone ? <a className="text-[#0ECCEE]" href={`tel:${item.phone}`}>{item.phone}</a> : <span>No phone</span>}
                  {item.expectedTeams ? <p>{item.expectedTeams} expected teams</p> : null}{item.preferredDate ? <p>{new Date(item.preferredDate).toLocaleDateString('en-IN')}</p> : null}
                </div>
                <p className="mt-3 rounded-lg bg-white/5 p-3 text-gray-200">{item.gameIdea}</p>
                <p className="mt-2 text-[11px] text-gray-600">Received {new Date(item.createdAt).toLocaleString('en-IN')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status !== 'reviewing' ? <button className="rounded bg-amber-700 px-2 py-1 text-xs" onClick={() => post(`/admin/college-platform/host-requests/${item._id}`, { status: 'reviewing' }, 'PUT')}>Review</button> : null}
                  {item.status !== 'approved' ? <button className="rounded bg-emerald-700 px-2 py-1 text-xs" onClick={() => post(`/admin/college-platform/host-requests/${item._id}`, { status: 'approved' }, 'PUT')}>Approve</button> : null}
                  {item.status !== 'rejected' ? <button className="rounded bg-red-900 px-2 py-1 text-xs" onClick={() => post(`/admin/college-platform/host-requests/${item._id}`, { status: 'rejected' }, 'PUT')}>Reject</button> : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <form className="space-y-3 rounded-xl border border-gray-800 bg-[#111213] p-5" onSubmit={(event) => { event.preventDefault(); post('/admin/college-platform/results', { ...result, points: result.points === '' ? undefined : Number(result.points), finalized: true }); }}>
            <h2 className="text-lg font-semibold">Finalize result</h2>
            <select className={inputClass} required value={result.registrationId} onChange={(event) => setResult({ ...result, registrationId: event.target.value })}>
              <option value="">Select registration</option>
              {data.registrations.filter((item) => ['confirmed', 'checked_in'].includes(item.status)).map((item) => <option key={item._id} value={item._id}>{item.gameId?.title} — {item.teamName}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3"><input className={inputClass} type="number" min="1" value={result.placement} onChange={(event) => setResult({ ...result, placement: Number(event.target.value) })} /><input className={inputClass} type="number" min="0" placeholder="Auto points" value={result.points} onChange={(event) => setResult({ ...result, points: event.target.value })} /></div>
            <button className={buttonClass} disabled={busy}>Finalize result</button>
          </form>
          <form className="space-y-3 rounded-xl border border-gray-800 bg-[#111213] p-5" onSubmit={(event) => { event.preventDefault(); post('/admin/college-platform/check-in', { qrToken }); }}>
            <h2 className="text-lg font-semibold">Check in game pass</h2>
            <textarea className={inputClass} rows="3" placeholder="Paste signed QR token" required value={qrToken} onChange={(event) => setQrToken(event.target.value.trim())} />
            <button className={buttonClass} disabled={busy}>Validate and check in</button>
          </form>
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-[#111213] p-5">
        <h2 className="mb-4 text-lg font-semibold">Registrations</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-gray-500"><tr><th className="pb-3">Game</th><th>Team</th><th>College</th><th>Status</th><th>Verification</th></tr></thead><tbody>{data.registrations.map((item) => <tr key={item._id} className="border-t border-gray-800"><td className="py-3">{item.gameId?.title}</td><td>{item.teamName}</td><td>{item.collegeId?.shortName || item.collegeId?.name}</td><td>{item.status}</td><td><span>{item.members?.filter((member) => member.status !== 'invited').length || 0}/{item.members?.length || 0}</span>{item.members?.filter((member) => member.status === 'invited').map((member) => <button key={member._id} type="button" className="ml-2 rounded bg-amber-700 px-2 py-1 text-xs" onClick={() => approveSubstitution(item, member)}>Substitute</button>)}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
