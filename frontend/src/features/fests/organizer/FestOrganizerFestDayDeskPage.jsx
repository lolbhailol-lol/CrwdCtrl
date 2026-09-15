import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CheckCircle2,
  ExternalLink,
  Loader,
  RefreshCw,
  Search,
  WifiOff,
  X,
  QrCode,
} from "lucide-react";
import {
  fetchFestDayDesk,
  createFestDayAssistedRegistration,
  refundFestDayDeskOrder,
  refreshFestDayDeskOrder,
} from "../../../services/api/festOrganizer.api";
import { buildBrandedCompetitionQrDataUrl } from "../../../utils/competitionPublicQr";
import { organizerCompetitionFeeLabel } from "../../../utils/competitionFeeTiers";
import { useDialog } from "../../../context/DialogContext";
import { getFestOrganizerSession } from "../../../utils/festOrganizerSession";

const statusLabels = {
  form_started: "Form started",
  payment_pending: "Payment pending",
  confirming: "Confirming payment",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
  refund_pending: "Refund pending",
  refunded: "Refunded",
  refund_failed: "Refund failed",
};

const statusClasses = {
  form_started: "bg-blue-500/15 text-blue-300 border-blue-400/20",
  payment_pending: "bg-amber-500/15 text-amber-300 border-amber-400/20",
  confirming: "bg-cyan-500/15 text-cyan-300 border-cyan-400/20",
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
  failed: "bg-red-500/15 text-red-300 border-red-400/20",
  expired: "bg-white/5 text-gray-400 border-white/10",
  refund_pending: "bg-violet-500/15 text-violet-300 border-violet-400/20",
  refunded: "bg-gray-500/15 text-gray-300 border-gray-400/20",
  refund_failed: "bg-red-500/15 text-red-300 border-red-400/20",
};

function formatWhen(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

function AssistedEntryModal({ festId, competition, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    college: "",
    teamName: "",
    membersText: "",
    feeTierId: "",
  });
  const [qr, setQr] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submissionKey = useRef(crypto.randomUUID());
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await createFestDayAssistedRegistration(festId, {
        ...form,
        competitionId: competition._id,
        submissionKey: submissionKey.current,
        members: form.membersText
          .split(/[,;\n]+/)
          .map((value) => value.trim())
          .filter(Boolean),
      });
      setResult(data);
      if (data.paymentUrl && data.status !== "paid")
        setQr(
          await buildBrandedCompetitionQrDataUrl(data.paymentUrl, {
            size: 900,
          }),
        );
      onCreated?.();
    } catch (err) {
      setError(err.message || "Could not create registration");
    } finally {
      setBusy(false);
    }
  };
  const teamMin = Math.max(1, Number(competition.teamSizeMin) || 1);
  const teamMax = Math.max(teamMin, Number(competition.teamSizeMax) || teamMin);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 p-3 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-4xl max-h-[96dvh] overflow-y-auto rounded-3xl border border-white/10 bg-[#121314] p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#0ECCEE]">
              Organizer-assisted registration
            </p>
            <h2 className="text-xl sm:text-3xl font-bold text-white mt-1">
              {competition.name}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {organizerCompetitionFeeLabel(competition)} · Team size{" "}
              {teamMin === teamMax ? teamMin : `${teamMin}–${teamMax}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-white/10 text-gray-400"
          >
            <X />
          </button>
        </div>
        {result ? (
          <div className="space-y-4">
            <div className="rounded-3xl bg-white p-4 flex items-center justify-center min-h-[320px]">
              {result.status === "paid" ? (
                <CheckCircle2 className="text-emerald-600" size={54} />
              ) : qr ? (
                <img
                  src={qr}
                  alt="Scan to pay"
                  className="w-full max-w-[520px] aspect-square"
                />
              ) : (
                <Loader className="animate-spin text-black" />
              )}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                ₹{Number(result.amount).toLocaleString("en-IN")}
              </p>
              <p className={result.status === "paid" ? "text-sm text-emerald-300" : "text-sm text-amber-300"}>
                {result.status === "paid" ? "Registration confirmed" : "Payment pending · student scans this QR"}
              </p>
              <p className="font-mono text-xs text-gray-500 mt-1">
                {result.orderId}
              </p>
            </div>
            {result.status === "paid" && result.ticketUrl ? (
              <a href={result.ticketUrl} className="desk-action">
                Open ticket
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="desk-action w-full"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-gray-400">Captain name *</span>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="w-full rounded-xl bg-[#1D1E20] border border-white/10 px-3 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-400">Phone *</span>
              <input
                required
                inputMode="numeric"
                pattern="[0-9 +()-]{10,}"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="w-full rounded-xl bg-[#1D1E20] border border-white/10 px-3 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-400">Email (optional)</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="w-full rounded-xl bg-[#1D1E20] border border-white/10 px-3 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-400">College</span>
              <input
                value={form.college}
                onChange={(e) => set("college", e.target.value)}
                className="w-full rounded-xl bg-[#1D1E20] border border-white/10 px-3 py-2.5"
              />
            </label>
            {teamMax > 1 ? (
              <>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-gray-400">Team name</span>
                  <input
                    value={form.teamName}
                    onChange={(e) => set("teamName", e.target.value)}
                    className="w-full rounded-xl bg-[#1D1E20] border border-white/10 px-3 py-2.5"
                  />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-gray-400">
                    Other team members ({Math.max(0, teamMin - 1)}–
                    {Math.max(0, teamMax - 1)} names)
                  </span>
                  <textarea
                    rows={3}
                    value={form.membersText}
                    onChange={(e) => set("membersText", e.target.value)}
                    placeholder="One name per line"
                    className="w-full rounded-xl bg-[#1D1E20] border border-white/10 px-3 py-2.5"
                  />
                </label>
              </>
            ) : null}
            {competition.feeTiers?.length ? (
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-gray-400">Fee tier *</span>
                <select
                  required
                  value={form.feeTierId}
                  onChange={(e) => set("feeTierId", e.target.value)}
                  className="w-full rounded-xl bg-[#1D1E20] border border-white/10 px-3 py-2.5"
                >
                  <option value="">Select fee tier</option>
                  {competition.feeTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.label} · ₹
                      {Number(tier.amount).toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {error ? (
              <p className="sm:col-span-2 text-sm text-red-400">{error}</p>
            ) : null}
            <button
              disabled={busy}
              className="sm:col-span-2 rounded-xl bg-[#0ECCEE] text-black py-3 font-semibold disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create entry & payment QR"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function FestOrganizerFestDayDeskPage() {
  const { festId } = useParams();
  const { toast, confirm } = useDialog();
  const organizerSession = getFestOrganizerSession();
  const canRefund = organizerSession?.organizer?.portalRole !== "desk";
  const [competitions, setCompetitions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [query, setQuery] = useState("");
  const [activityQuery, setActivityQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrder, setBusyOrder] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!navigator.onLine) return;
      if (!quiet) setLoading(true);
      else setRefreshing(true);
      try {
        const data = await fetchFestDayDesk(
          festId,
          activityQuery ? { search: activityQuery } : {},
        );
        setCompetitions(data.competitions || []);
        setActivity(data.activity || []);
      } catch (error) {
        if (!quiet) toast(error.message || "Could not load Fest Day Desk");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [festId, activityQuery, toast],
  );

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => load({ quiet: true }), 3000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (online) load({ quiet: true });
  }, [online, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return competitions.filter(
      (competition) =>
        !q ||
        `${competition.name} ${competition.category || ""} ${competition.module || ""}`
          .toLowerCase()
          .includes(q),
    );
  }, [competitions, query]);

  const refreshOrder = async (orderId) => {
    if (!online)
      return toast("Internet is required to verify a Cashfree payment");
    setBusyOrder(orderId);
    try {
      const result = await refreshFestDayDeskOrder(festId, orderId);
      toast(
        result.verified
          ? "Payment verified and registration issued"
          : result.message || "Latest payment status loaded",
      );
      await load({ quiet: true });
    } catch (error) {
      toast(error.message || "Could not refresh payment");
    } finally {
      setBusyOrder("");
    }
  };

  const refundOrder = async (row) => {
    const approved = await confirm({
      title: "Refund this registration?",
      message: `Refund ₹${Number(row.amount).toLocaleString("en-IN")} for ${row.participantName}. Their ticket will be blocked immediately.`,
      confirmLabel: "Start refund",
      danger: true,
    });
    if (!approved) return;
    setBusyOrder(row.orderId);
    try {
      await refundFestDayDeskOrder(festId, row.orderId);
      toast("Refund started; Cashfree confirmation is pending");
      await load({ quiet: true });
    } catch (error) {
      toast(error.message || "Could not start refund");
    } finally {
      setBusyOrder("");
    }
  };

  if (loading)
    return (
      <div className="min-h-[55vh] flex items-center justify-center">
        <Loader className="animate-spin text-[#0ECCEE]" size={30} />
      </div>
    );

  return (
    <div className="space-y-5 fest-day-desk">
      <style>{`.desk-action{display:flex;align-items:center;justify-content:center;gap:.45rem;border:1px solid rgba(255,255,255,.12);border-radius:.8rem;padding:.7rem;color:#e5e7eb;font-size:.8rem;font-weight:600;background:rgba(255,255,255,.04)}.desk-action:disabled{opacity:.4}`}</style>
      {!online ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex gap-2">
          <WifiOff size={18} />
          Offline — existing QRs remain usable, but live status and payment
          verification will resume when connected.
        </div>
      ) : null}
      <section className="rounded-3xl border border-[#0ECCEE]/25 bg-linear-to-br from-[#0ECCEE]/15 to-[#161718] p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#0ECCEE]">
              MindSpark operations
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">
              Fest Day Desk
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Pick a competition, enter the team, then let the student scan and
              pay.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load({ quiet: true })}
            disabled={refreshing || !online}
            className="desk-action self-start"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      <div className="grid xl:grid-cols-[1.05fr_.95fr] gap-5">
        <section className="rounded-2xl border border-white/10 bg-[#121314] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">New desk registration</h2>
              <p className="text-xs text-gray-500">
                Select a competition to enter participant details
              </p>
            </div>
            <QrCode className="text-[#0ECCEE]" />
          </div>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-3 text-gray-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search competition"
              className="w-full rounded-xl border border-white/10 bg-[#1D1E20] py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-2 max-h-[58vh] overflow-y-auto">
            {filtered.map((competition) => {
              const closed =
                competition.registrationsOpen === false ||
                competition.slotsLeft === 0;
              const slots = Number(competition.slotsAllotted) || 0;
              return (
                <button
                  key={competition._id}
                  type="button"
                  disabled={closed}
                  onClick={() =>
                    setSelected({ ...competition, id: competition._id })
                  }
                  className="rounded-2xl border border-white/10 bg-[#1A1B1D] p-4 text-left hover:border-[#0ECCEE]/50 disabled:opacity-45 transition"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-semibold text-white">
                      {competition.name}
                    </p>
                    <ExternalLink
                      size={15}
                      className="text-[#0ECCEE] shrink-0"
                    />
                  </div>
                  <p className="text-sm text-[#0ECCEE] mt-2">
                    {organizerCompetitionFeeLabel(competition)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {competition.registrationsOpen === false
                      ? "Registration closed"
                      : competition.slotsLeft === 0
                        ? "Sold out"
                        : slots > 0
                          ? `${competition.slotsLeft} of ${slots} slots left`
                          : "Registration open"}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#121314] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">Live payment activity</h2>
              <p className="text-xs text-gray-500">
                Auto-refreshes every 3 seconds
              </p>
            </div>
            {refreshing ? (
              <Loader size={16} className="animate-spin text-[#0ECCEE]" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-400" />
            )}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              load();
            }}
            className="flex gap-2 mb-3"
          >
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-3 text-gray-500"
              />
              <input
                value={activityQuery}
                onChange={(event) => setActivityQuery(event.target.value)}
                placeholder="Name, phone, registration or order ID"
                className="w-full rounded-xl border border-white/10 bg-[#1D1E20] py-2.5 pl-9 pr-3 text-sm"
              />
            </div>
            <button className="desk-action" type="submit">
              Search
            </button>
          </form>
          <div className="space-y-2 max-h-[58vh] overflow-y-auto">
            {activity.length ? (
              activity.map((row) => {
                const displayStatus =
                  row.refundStatus === "success"
                    ? "refunded"
                    : ["failed", "cancelled"].includes(row.refundStatus)
                      ? "refund_failed"
                      : row.refundStatus
                        ? "refund_pending"
                        : row.status;
                return (
                  <article
                    key={row.orderId}
                    className="rounded-xl border border-white/10 bg-[#1A1B1D] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {row.participantName}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {row.competitionName}
                          {row.teamName ? ` · ${row.teamName}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClasses[displayStatus] || statusClasses.expired}`}
                      >
                        {statusLabels[displayStatus] || displayStatus}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
                      <span>
                        {row.status === "form_started"
                          ? "Form in progress"
                          : `₹${Number(row.amount).toLocaleString("en-IN")}`}
                      </span>
                      <span>{formatWhen(row.createdAt)}</span>
                      {row.status !== "form_started" ? (
                        <span className="font-mono">{row.orderId}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => refreshOrder(row.orderId)}
                        disabled={
                          busyOrder === row.orderId ||
                          !online ||
                          row.status === "form_started"
                        }
                        className="desk-action flex-1"
                      >
                        {busyOrder === row.orderId ? (
                          <Loader size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        {row.status === "form_started"
                          ? "Awaiting payment"
                          : "Check payment"}
                      </button>
                      {row.status === "paid" && row.registrationId ? (
                        <Link
                          to={`/fest-organizer/fests/${festId}/participants?q=${encodeURIComponent(row.registrationId)}`}
                          className="desk-action flex-1"
                        >
                          <ExternalLink size={14} />
                          Open entry
                        </Link>
                      ) : row.resumeUrl ? (
                        <a
                          href={row.resumeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="desk-action flex-1"
                        >
                          <QrCode size={14} />
                          Payment page
                        </a>
                      ) : null}
                      {canRefund &&
                      row.status === "paid" &&
                      !row.refundStatus ? (
                        <button
                          type="button"
                          onClick={() => refundOrder(row)}
                          disabled={busyOrder === row.orderId || !online}
                          className="desk-action text-red-300"
                        >
                          <span>Refund</span>
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="py-14 text-center text-sm text-gray-500">
                No matching Cashfree attempts yet.
              </div>
            )}
          </div>
        </section>
      </div>
      <p className="rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-xs text-gray-400">
        Fest Day Desk accepts Cashfree only. Unpaid entries remain pending and
        never receive a ticket.
      </p>
      {selected ? (
        <AssistedEntryModal
          festId={festId}
          competition={selected}
          onClose={() => setSelected(null)}
          onCreated={() => load({ quiet: true })}
        />
      ) : null}
    </div>
  );
}
