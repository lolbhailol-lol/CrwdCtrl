import { useEffect, useState } from 'react';
import {
  Trophy,
  Users2,
  Building,
  ClipboardList,
  CheckCircle2,
  Clock,
  LayoutGrid,
  RefreshCw,
} from 'lucide-react';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import CollegeGamesManager from '../../components/admin/CollegeGamesManager';

const inputClass =
  'w-full rounded-lg border border-gray-700 bg-[#191b1d] px-3 py-2 text-sm text-white outline-none focus:border-[#0ECCEE]';
const buttonClass =
  'rounded-lg bg-[#0ECCEE] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50';

export default function CollegePlatformPage() {
  const [data, setData] = useState({
    games: [],
    colleges: [],
    hostRequests: [],
    registrations: [],
    preRegistrations: [],
    hostPlatform: {
      hosts: [],
      games: [],
      permissions: [],
      refunds: [],
      disputes: [],
      reports: [],
      payouts: [],
    },
  });
  const [activeTab, setActiveTab] = useState('games');
  const [college, setCollege] = useState({
    name: '',
    shortName: '',
    city: '',
    emailDomains: '',
  });
  const [result, setResult] = useState({
    registrationId: '',
    placement: 1,
    points: '',
  });
  const [qrToken, setQrToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preRegCsv, setPreRegCsv] = useState('');

  const load = async () => {
    try {
      const [response, hostPlatform] = await Promise.all([
        adminFetchJSON('/admin/college-platform'),
        adminFetchJSON('/admin/college-platform/host-platform'),
      ]);
      setData({ ...response, hostPlatform });
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (path, options) => {
    setBusy(true);
    try {
      await adminFetchJSON(path, options);
      await load();
      setMessage('Saved successfully');
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const post = (path, body, method = 'POST') =>
    run(path, { method, body: JSON.stringify(body) });

  const handleSaveGame = async (payload, editingId) => {
    if (editingId) {
      return post(`/admin/college-platform/games/${editingId}`, payload, 'PUT');
    }
    return post('/admin/college-platform/games', payload, 'POST');
  };

  const handleUpdateGameStatus = async (gameId, status) => {
    return post(`/admin/college-platform/games/${gameId}`, { status }, 'PUT');
  };

  const handleDeleteGame = async (gameId) => {
    return run(`/admin/college-platform/games/${gameId}`, { method: 'DELETE' });
  };

  const preRegistrations = data.preRegistrations || [];
  const buildPreRegCsv = () => {
    const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      [
        'Game',
        'Team',
        'Captain',
        'Phone',
        'Email',
        'College',
        'Team size',
        'Status',
        'Submitted',
      ],
    ].concat(
      preRegistrations.map((item) => [
        item.gameKey,
        item.teamName,
        item.captainName,
        item.phone,
        item.email,
        item.collegeName,
        item.teamSize || '',
        item.status,
        new Date(item.createdAt).toLocaleString('en-IN'),
      ])
    );
    setPreRegCsv(rows.map((row) => row.map(cell).join(',')).join('\n'));
  };

  const saveCollege = async (event) => {
    event.preventDefault();
    const saved = await post('/admin/college-platform/colleges', {
      ...college,
      emailDomains: college.emailDomains
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    });
    if (saved) setCollege({ name: '', shortName: '', city: '', emailDomains: '' });
  };

  const approveSubstitution = (registration, member) => {
    const name = window.prompt('Substitute name', member.name);
    if (!name) return;
    const email = window.prompt('Approved college email', member.email);
    if (!email) return;
    post(
      `/admin/college-platform/registrations/${registration._id}/members/${member._id}/approve-substitution`,
      { name, email }
    );
  };

  const TABS = [
    { id: 'games', label: 'Games Management', icon: Trophy, count: data.games.length },
    { id: 'hosts', label: 'Host Approvals & Ops', icon: Users2, count: data.hostPlatform.hosts.length },
    { id: 'colleges', label: 'Colleges & Domains', icon: Building, count: data.colleges.length },
    { id: 'requests', label: 'Host Game Requests', icon: ClipboardList, count: data.hostRequests.length },
    { id: 'results', label: 'Results & Passes', icon: CheckCircle2 },
    { id: 'prereg', label: 'Pre-Registrations', icon: Clock, count: preRegistrations.length },
    { id: 'registrations', label: 'Teams Registered', icon: Users2, count: data.registrations.length },
    { id: 'all', label: 'All Sections', icon: LayoutGrid },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            College Games
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Create and manage campus games, set rules & fees, approve hosts, and audit registrations.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-2 bg-[#191b1d] border border-gray-700 hover:border-gray-500 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Refresh Data
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-[#0ECCEE] flex items-center justify-between">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage('')}
            className="text-gray-400 hover:text-white text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-800 text-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl whitespace-nowrap text-xs sm:text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-[#0ECCEE] text-black shadow-[0_0_15px_rgba(14,204,238,0.3)]'
                  : 'bg-[#111213] border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-black/20 text-black' : 'bg-white/10 text-gray-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: GAMES MANAGEMENT */}
      {(activeTab === 'games' || activeTab === 'all') && (
        <section className="space-y-6">
          <CollegeGamesManager
            games={data.games}
            colleges={data.colleges}
            onRefresh={load}
            onSaveGame={handleSaveGame}
            onUpdateGameStatus={handleUpdateGameStatus}
            onDeleteGame={handleDeleteGame}
            busy={busy}
          />
        </section>
      )}

      {/* TAB 2: HOST APPROVALS & OPERATIONS */}
      {(activeTab === 'hosts' || activeTab === 'all') && (
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-gray-800 bg-[#111213] p-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Campus Hunt host approvals</h2>
              <p className="text-sm text-gray-400">
                Approve verified student hosts, then review each submitted Hunt setup.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.hostPlatform.hosts.map((host) => (
                <article
                  key={host._id}
                  className="rounded-lg border border-gray-800 bg-black/20 p-4 text-sm"
                >
                  <div className="flex justify-between gap-3">
                    <strong className="text-white">{host.fullName}</strong>
                    <span className="uppercase text-[#0ECCEE] font-mono text-xs">{host.status}</span>
                  </div>
                  <p className="mt-2 text-gray-400">
                    {host.collegeId?.shortName || host.collegeId?.name} ·{' '}
                    {host.clubName || host.roleTitle}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded bg-emerald-700 hover:bg-emerald-600 px-3 py-1 text-xs text-white"
                      onClick={() =>
                        post(`/admin/college-platform/hosts/${host._id}`, { status: 'approved' }, 'PATCH')
                      }
                    >
                      Approve 1 year
                    </button>
                    <button
                      className="rounded bg-amber-700 hover:bg-amber-600 px-3 py-1 text-xs text-white"
                      onClick={() =>
                        post(
                          `/admin/college-platform/hosts/${host._id}`,
                          {
                            status: 'changes_required',
                            adminNotes: window.prompt('Required changes') || '',
                          },
                          'PATCH'
                        )
                      }
                    >
                      Request Changes
                    </button>
                    <button
                      className="rounded bg-red-900 hover:bg-red-800 px-3 py-1 text-xs text-white"
                      onClick={() =>
                        post(
                          `/admin/college-platform/hosts/${host._id}`,
                          {
                            status: 'suspended',
                            adminNotes: window.prompt('Suspension reason') || '',
                          },
                          'PATCH'
                        )
                      }
                    >
                      Suspend
                    </button>
                  </div>
                </article>
              ))}
              {!data.hostPlatform.hosts.length && (
                <p className="text-sm text-gray-500">No host profiles registered yet.</p>
              )}
            </div>

            {data.hostPlatform.games
              .filter((item) => item.turnoutDecisionRequested)
              .map((item) => (
                <article
                  key={item._id}
                  className="rounded-lg border border-amber-700/60 bg-amber-950/20 p-4 text-sm"
                >
                  <strong className="text-white">
                    {item.title} · {item.turnoutDecisionRequested} requested
                  </strong>
                  <p className="mt-1 text-gray-400">{item.turnoutDecisionReason}</p>
                  <div className="mt-3 flex gap-2">
                    {item.turnoutDecisionRequested === 'continuation' ? (
                      <button
                        className="rounded bg-emerald-700 px-3 py-1 text-xs text-white"
                        onClick={() => {
                          const topUp = window.prompt('Verified top-up amount');
                          const paymentReference = window.prompt('Top-up payment reference');
                          if (topUp && paymentReference) {
                            post(
                              `/admin/college-platform/hosted-games/${item._id}/turnout-decision`,
                              {
                                decision: 'continuation',
                                topUp: Number(topUp),
                                paymentReference,
                              }
                            );
                          }
                        }}
                      >
                        Approve funded continuation
                      </button>
                    ) : null}
                    <button
                      className="rounded bg-red-900 px-3 py-1 text-xs text-white"
                      onClick={() =>
                        post(
                          `/admin/college-platform/hosted-games/${item._id}/turnout-decision`,
                          { decision: 'cancellation' }
                        )
                      }
                    >
                      Cancel and queue refunds
                    </button>
                  </div>
                </article>
              ))}
          </section>

          <section className="space-y-4 rounded-xl border border-gray-800 bg-[#111213] p-5">
            <h2 className="text-lg font-semibold text-white">Submitted Hunts for Review</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.hostPlatform.games
                .filter((item) =>
                  ['pending_approval', 'changes_required'].includes(item.approvalStatus)
                )
                .map((item) => (
                  <article key={item._id} className="rounded-lg border border-gray-800 p-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <strong className="text-white">{item.title}</strong>
                      <span className="uppercase text-[#0ECCEE] font-mono text-xs">
                        {item.approvalStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="mt-2 text-gray-400">
                      {item.venue} · {item.city}
                      <br />
                      {item.capacity} teams · {item.teamSize} people/team
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className={buttonClass}
                        onClick={() =>
                          post(
                            `/admin/college-platform/hosted-games/${item._id}/review`,
                            { status: 'approved' },
                            'PATCH'
                          )
                        }
                      >
                        Approve and provision
                      </button>
                      <button
                        className="rounded bg-amber-700 px-3 py-1 text-xs text-white"
                        onClick={() =>
                          post(
                            `/admin/college-platform/hosted-games/${item._id}/review`,
                            {
                              status: 'changes_required',
                              adminNotes: window.prompt('Required changes') || '',
                            },
                            'PATCH'
                          )
                        }
                      >
                        Request changes
                      </button>
                      <button
                        className="rounded bg-red-900 px-3 py-1 text-xs text-white"
                        onClick={() =>
                          post(
                            `/admin/college-platform/hosted-games/${item._id}/review`,
                            {
                              status: 'rejected',
                              adminNotes: window.prompt('Rejection reason') || '',
                            },
                            'PATCH'
                          )
                        }
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))}
              {!data.hostPlatform.games.some((item) =>
                ['pending_approval', 'changes_required'].includes(item.approvalStatus)
              ) && <p className="text-sm text-gray-500">No Hunts waiting for review.</p>}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-gray-800 bg-[#111213] p-5">
              <h2 className="text-lg font-semibold text-white">Refunds and disputes</h2>
              {data.hostPlatform.refunds.map((item) => (
                <article key={item._id} className="rounded-lg border border-gray-800 p-3 text-sm">
                  <strong>{item.registrationId?.teamName || 'Registration refund'}</strong>
                  <p className="text-gray-400">
                    {item.reason} · ₹{item.amount} · {item.status}
                  </p>
                  {!['refunded', 'rejected'].includes(item.status) ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded bg-emerald-700 px-2 py-1 text-xs text-white"
                        onClick={() =>
                          post(`/admin/college-platform/refunds/${item._id}/process`, {
                            status: 'approved',
                          })
                        }
                      >
                        Full refund
                      </button>
                      <button
                        className="rounded bg-red-900 px-2 py-1 text-xs text-white"
                        onClick={() =>
                          post(`/admin/college-platform/refunds/${item._id}/process`, {
                            status: 'rejected',
                            adminNotes: window.prompt('Reason') || '',
                          })
                        }
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
              {data.hostPlatform.disputes.map((item) => (
                <article key={item._id} className="rounded-lg border border-gray-800 p-3 text-sm">
                  <strong>{item.registrationId?.teamName || 'Result dispute'}</strong>
                  <p className="text-gray-400">{item.reason} · {item.status}</p>
                  {item.status === 'open' ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded bg-emerald-700 px-2 py-1 text-xs text-white"
                        onClick={() =>
                          post(`/admin/college-platform/disputes/${item._id}/resolve`, {
                            status: 'upheld',
                            resolution: window.prompt('Resolution') || 'Upheld',
                          })
                        }
                      >
                        Uphold
                      </button>
                      <button
                        className="rounded bg-gray-700 px-2 py-1 text-xs text-white"
                        onClick={() =>
                          post(`/admin/college-platform/disputes/${item._id}/resolve`, {
                            status: 'rejected',
                            resolution: window.prompt('Resolution') || 'Rejected',
                          })
                        }
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
              {!data.hostPlatform.refunds.length && !data.hostPlatform.disputes.length && (
                <p className="text-sm text-gray-500">No active refund requests or disputes.</p>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-gray-800 bg-[#111213] p-5">
              <h2 className="text-lg font-semibold text-white">Safety reports and emergency</h2>
              {data.hostPlatform.reports.map((item) => (
                <article key={item._id} className="rounded-lg border border-gray-800 p-3 text-sm">
                  <strong>{item.type}</strong>
                  <p className="text-gray-400">{item.message} · {item.status}</p>
                  {!['resolved', 'dismissed'].includes(item.status) ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded bg-gray-700 px-2 py-1 text-xs text-white"
                        onClick={() =>
                          post(`/admin/college-platform/reports/${item._id}/resolve`, {
                            status: 'resolved',
                            resolution: window.prompt('Resolution') || 'Resolved',
                          })
                        }
                      >
                        Resolve
                      </button>
                      <button
                        className="rounded bg-red-900 px-2 py-1 text-xs text-white"
                        onClick={() =>
                          post(`/admin/college-platform/reports/${item._id}/resolve`, {
                            status: 'resolved',
                            resolution: window.prompt('Suspension reason') || 'Safety moderation',
                            suspendHost: true,
                          })
                        }
                      >
                        Resolve + suspend host
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
              {data.hostPlatform.games
                .filter((item) => item.operationalStatus === 'live')
                .map((item) => (
                  <article
                    key={item._id}
                    className="rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-sm"
                  >
                    <strong className="text-white">{item.title} (Live Game)</strong>
                    <div className="mt-2 flex gap-2">
                      {item.emergencyStoppedAt ? (
                        <button
                          className="rounded bg-emerald-700 px-2 py-1 text-xs text-white"
                          onClick={() =>
                            post(
                              `/admin/college-platform/hosted-games/${item._id}/clear-emergency-stop`,
                              {}
                            )
                          }
                        >
                          Clear stop
                        </button>
                      ) : (
                        <button
                          className="rounded bg-red-800 px-2 py-1 text-xs text-white"
                          onClick={() =>
                            post(
                              `/admin/college-platform/hosted-games/${item._id}/emergency-stop`,
                              {
                                reason:
                                  window.prompt('Emergency reason') || 'Admin emergency stop',
                              }
                            )
                          }
                        >
                          Emergency stop
                        </button>
                      )}
                      <button
                        className="rounded bg-gray-700 px-2 py-1 text-xs text-white"
                        onClick={() =>
                          run(`/admin/college-platform/hosted-games/${item._id}/reconcile`)
                        }
                      >
                        Reconcile
                      </button>
                    </div>
                  </article>
                ))}
              {!data.hostPlatform.reports.length && (
                <p className="text-sm text-gray-500">No pending safety reports.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: APPROVED COLLEGES & DOMAINS */}
      {(activeTab === 'colleges' || activeTab === 'all') && (
        <div className="space-y-6">
          <form
            className="space-y-3 rounded-xl border border-gray-800 bg-[#111213] p-5 shadow-lg"
            onSubmit={saveCollege}
          >
            <h2 className="text-lg font-semibold text-white">Add approved college</h2>
            <p className="text-xs text-gray-400">
              Only students with email domains matching these approved colleges will be able to verify and play on campus.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              <input
                className={inputClass}
                placeholder="Full College name (e.g. MIT World Peace University)"
                required
                value={college.name}
                onChange={(event) => setCollege({ ...college, name: event.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Short name (e.g. MIT-WPU)"
                value={college.shortName}
                onChange={(event) => setCollege({ ...college, shortName: event.target.value })}
              />
              <input
                className={inputClass}
                placeholder="City (e.g. Pune)"
                value={college.city}
                onChange={(event) => setCollege({ ...college, city: event.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Approved domains: mitwpu.edu.in, student.mitwpu.edu"
                required
                value={college.emailDomains}
                onChange={(event) => setCollege({ ...college, emailDomains: event.target.value })}
              />
            </div>
            <button className={buttonClass} disabled={busy}>
              Add Approved College
            </button>
          </form>

          <section className="rounded-xl border border-gray-800 bg-[#111213] p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Approved College Domains ({data.colleges.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.colleges.map((item) => (
                <article
                  key={item._id}
                  className="rounded-lg border border-gray-800 bg-black/20 p-4"
                >
                  <div className="flex justify-between gap-3">
                    <strong className="text-white">{item.name}</strong>
                    <span className="text-xs uppercase text-[#0ECCEE] font-mono">{item.status}</span>
                  </div>
                  <p className="mt-2 break-words text-xs text-gray-400 font-mono">
                    {item.emailDomains?.join(', ')}
                  </p>
                  <button
                    type="button"
                    className="mt-3 rounded bg-gray-700 hover:bg-gray-600 px-3 py-1 text-xs text-white"
                    onClick={() => {
                      const domains = window.prompt(
                        'Comma-separated approved domains',
                        item.emailDomains?.join(', ')
                      );
                      if (domains != null) {
                        post(
                          `/admin/college-platform/colleges/${item._id}`,
                          {
                            emailDomains: domains
                              .split(',')
                              .map((value) => value.trim())
                              .filter(Boolean),
                          },
                          'PUT'
                        );
                      }
                    }}
                  >
                    Edit domains
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: HOST REQUESTS */}
      {(activeTab === 'requests' || activeTab === 'all') && (
        <section className="rounded-xl border border-gray-800 bg-[#111213] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Incoming Host Requests</h2>
              <p className="text-xs text-gray-400">
                Proposals submitted by student reps wanting to host a game at their college.
              </p>
            </div>
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">
              {data.hostRequests.length} requests
            </span>
          </div>

          <div className="space-y-3">
            {!data.hostRequests.length && (
              <p className="rounded-lg border border-dashed border-gray-700 p-8 text-center text-sm text-gray-500">
                No host requests received yet.
              </p>
            )}
            {data.hostRequests.map((item) => (
              <article
                key={item._id}
                className="rounded-lg border border-gray-800 bg-black/20 p-4 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="text-base text-white">
                      {item.gameName || 'Game proposal'}
                    </strong>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {item.collegeName} · {item.clubName || 'Independent club'}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#0ECCEE]/10 px-2.5 py-1 text-xs uppercase text-[#0ECCEE] font-mono">
                    {item.status}
                  </span>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-gray-400 sm:grid-cols-2">
                  <p>
                    {item.name}
                    {item.contactRole ? ` · ${item.contactRole}` : ''}
                  </p>
                  <p>{item.city}</p>
                  <a className="text-[#0ECCEE]" href={`mailto:${item.email}`}>
                    {item.email}
                  </a>
                  {item.phone ? (
                    <a className="text-[#0ECCEE]" href={`tel:${item.phone}`}>
                      {item.phone}
                    </a>
                  ) : (
                    <span>No phone</span>
                  )}
                  {item.expectedTeams ? <p>{item.expectedTeams} expected teams</p> : null}
                  {item.preferredDate ? (
                    <p>{new Date(item.preferredDate).toLocaleDateString('en-IN')}</p>
                  ) : null}
                </div>
                <p className="mt-3 rounded-lg bg-white/5 p-3 text-gray-200">{item.gameIdea}</p>
                <p className="mt-2 text-[11px] text-gray-600">
                  Received {new Date(item.createdAt).toLocaleString('en-IN')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status !== 'reviewing' && (
                    <button
                      className="rounded bg-amber-700 hover:bg-amber-600 px-2.5 py-1 text-xs text-white"
                      onClick={() =>
                        post(
                          `/admin/college-platform/host-requests/${item._id}`,
                          { status: 'reviewing' },
                          'PUT'
                        )
                      }
                    >
                      Mark Reviewing
                    </button>
                  )}
                  {item.status !== 'approved' && (
                    <button
                      className="rounded bg-emerald-700 hover:bg-emerald-600 px-2.5 py-1 text-xs text-white"
                      onClick={() =>
                        post(
                          `/admin/college-platform/host-requests/${item._id}`,
                          { status: 'approved' },
                          'PUT'
                        )
                      }
                    >
                      Approve
                    </button>
                  )}
                  {item.status !== 'rejected' && (
                    <button
                      className="rounded bg-red-900 hover:bg-red-800 px-2.5 py-1 text-xs text-white"
                      onClick={() =>
                        post(
                          `/admin/college-platform/host-requests/${item._id}`,
                          { status: 'rejected' },
                          'PUT'
                        )
                      }
                    >
                      Reject
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* TAB 5: RESULTS & PASS VALIDATION */}
      {(activeTab === 'results' || activeTab === 'all') && (
        <section className="grid gap-4 xl:grid-cols-2">
          <form
            className="space-y-3 rounded-xl border border-gray-800 bg-[#111213] p-5 shadow-lg"
            onSubmit={(event) => {
              event.preventDefault();
              post('/admin/college-platform/results', {
                ...result,
                points: result.points === '' ? undefined : Number(result.points),
                finalized: true,
              });
            }}
          >
            <h2 className="text-lg font-semibold text-white">Finalize & Audit Results</h2>
            <p className="text-xs text-gray-400">
              Award placements and points to checked-in teams toward the leaderboard.
            </p>
            <div className="pt-2 space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Registration</label>
                <select
                  className={inputClass}
                  required
                  value={result.registrationId}
                  onChange={(event) =>
                    setResult({ ...result, registrationId: event.target.value })
                  }
                >
                  <option value="">Select confirmed team registration</option>
                  {data.registrations
                    .filter((item) => ['confirmed', 'checked_in'].includes(item.status))
                    .map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.gameId?.title} — {item.teamName} ({item.collegeId?.shortName || item.collegeId?.name})
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Placement Position</label>
                  <input
                    className={inputClass}
                    type="number"
                    min="1"
                    placeholder="Rank (1, 2, 3...)"
                    value={result.placement}
                    onChange={(event) =>
                      setResult({ ...result, placement: Number(event.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Custom Points (Optional)</label>
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    placeholder="Auto from game rule"
                    value={result.points}
                    onChange={(event) =>
                      setResult({ ...result, points: event.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <button className={buttonClass} disabled={busy}>
              Finalize Audited Result
            </button>
          </form>

          <form
            className="space-y-3 rounded-xl border border-gray-800 bg-[#111213] p-5 shadow-lg"
            onSubmit={(event) => {
              event.preventDefault();
              post('/admin/college-platform/check-in', { qrToken });
            }}
          >
            <h2 className="text-lg font-semibold text-white">Check in game pass</h2>
            <p className="text-xs text-gray-400">
              Scan or paste the signed QR ticket token string presented at the entrance desk.
            </p>
            <div className="pt-2">
              <textarea
                className={inputClass}
                rows={4}
                placeholder="Paste signed QR pass token payload..."
                required
                value={qrToken}
                onChange={(event) => setQrToken(event.target.value.trim())}
              />
            </div>
            <button className={buttonClass} disabled={busy}>
              Validate & Check In Team
            </button>
          </form>
        </section>
      )}

      {/* TAB 6: PRE-REGISTRATIONS */}
      {(activeTab === 'prereg' || activeTab === 'all') && (
        <section className="rounded-xl border border-gray-800 bg-[#111213] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Pre-registrations ({preRegistrations.length})
              </h2>
              <p className="text-sm text-gray-400">
                Teams signed up for coming-soon games awaiting launch.
              </p>
            </div>
            {preRegistrations.length ? (
              <button
                className="rounded bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-xs text-white"
                onClick={buildPreRegCsv}
              >
                Export CSV
              </button>
            ) : null}
          </div>

          {preRegCsv && (
            <textarea
              readOnly
              className={`${inputClass} mb-4 h-32 font-mono text-xs`}
              value={preRegCsv}
              onFocus={(event) => event.target.select()}
            />
          )}

          {!preRegistrations.length ? (
            <p className="rounded-lg border border-dashed border-gray-700 p-8 text-center text-sm text-gray-500">
              No pre-registrations yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="text-gray-500 text-xs border-b border-gray-800 pb-2">
                  <tr>
                    <th className="pb-3">Game</th>
                    <th>Team</th>
                    <th>Captain</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>College</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {preRegistrations.map((item) => (
                    <tr key={item._id} className="border-t border-gray-800/80 align-top text-xs">
                      <td className="py-3 text-gray-300 font-mono">{item.gameKey}</td>
                      <td className="font-semibold text-white">{item.teamName}</td>
                      <td>{item.captainName}</td>
                      <td>{item.phone}</td>
                      <td className="break-all text-gray-400">{item.email}</td>
                      <td>{item.collegeName}</td>
                      <td>{item.teamSize || '—'}</td>
                      <td>
                        <select
                          className="rounded border border-gray-700 bg-[#191b1d] px-2 py-1 text-xs text-white"
                          value={item.status}
                          disabled={busy}
                          onChange={(event) =>
                            post(
                              `/admin/college-platform/pre-registrations/${item._id}`,
                              { status: event.target.value },
                              'PUT'
                            )
                          }
                        >
                          {['new', 'contacted', 'converted', 'cancelled'].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="text-gray-500">
                        {new Date(item.createdAt).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 7: REGISTRATIONS */}
      {(activeTab === 'registrations' || activeTab === 'all') && (
        <section className="rounded-xl border border-gray-800 bg-[#111213] p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Team Registrations ({data.registrations.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-gray-500 text-xs border-b border-gray-800 pb-2">
                <tr>
                  <th className="pb-3">Game</th>
                  <th>Team</th>
                  <th>College</th>
                  <th>Status</th>
                  <th>Roster & Substitution</th>
                </tr>
              </thead>
              <tbody>
                {data.registrations.map((item) => (
                  <tr key={item._id} className="border-t border-gray-800/80 text-xs">
                    <td className="py-3 text-white font-medium">{item.gameId?.title}</td>
                    <td className="font-semibold text-[#0ECCEE]">{item.teamName}</td>
                    <td>{item.collegeId?.shortName || item.collegeId?.name}</td>
                    <td>
                      <span className="uppercase font-mono text-[11px] px-2 py-0.5 rounded bg-black/40 border border-gray-700">
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <span className="text-gray-300">
                        {item.members?.filter((member) => member.status !== 'invited').length || 0}
                        /{item.members?.length || 0} verified
                      </span>
                      {item.members
                        ?.filter((member) => member.status === 'invited')
                        .map((member) => (
                          <button
                            key={member._id}
                            type="button"
                            className="ml-2 rounded bg-amber-700 hover:bg-amber-600 px-2 py-1 text-xs text-white"
                            onClick={() => approveSubstitution(item, member)}
                          >
                            Substitute
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
