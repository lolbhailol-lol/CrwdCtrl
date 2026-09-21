import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader,
  RefreshCw,
  Search,
  WifiOff,
  X,
  QrCode,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import {
  fetchFestDayDesk,
  createFestDayAssistedRegistration,
  refundFestDayDeskOrder,
  refreshFestDayDeskOrder,
} from "../../../services/api/festOrganizer.api";
import { verifyDeskPayment } from "../../../services/api/deskPayment.api";
import { buildBrandedCompetitionQrDataUrl } from "../../../utils/competitionPublicQr";
import { organizerCompetitionFeeLabel } from "../../../utils/competitionFeeTiers";
import { useDialog } from "../../../context/DialogContext";
import { getFestOrganizerSession } from "../../../utils/festOrganizerSession";
import LocalQRCode from "../../../components/LocalQRCode";

const statusLabels = {
  form_started: "Form started",
  payment_pending: "Draft · payment pending",
  confirming: "Confirming payment",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
  pending: "Draft · payment pending",
  paid_review: "Paid — review required",
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
  pending: "bg-amber-500/15 text-amber-300 border-amber-400/20",
  paid_review: "bg-orange-500/15 text-orange-300 border-orange-400/20",
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

function paymentTokenFromUrl(url) {
  const match = String(url || "").match(/\/desk-payment\/([^/?#]+)/);
  return match?.[1] || "";
}

function AssistedEntryModal({ festId, competition, online, onClose, onCreated }) {
  const emptyMember = () => ({ name: "", email: "" });
  const teamMin = Math.max(1, Number(competition.teamSizeMin) || 1);
  const teamMax = Math.max(teamMin, Number(competition.teamSizeMax) || teamMin);
  const extraMin = Math.max(0, teamMin - 1);
  const extraMax = Math.max(0, teamMax - 1);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    college: "",
    teamName: "",
    feeTierId: "",
  });
  const [members, setMembers] = useState(() => Array.from({ length: extraMin }, emptyMember));
  const [qr, setQr] = useState("");
  const [ticketQr, setTicketQr] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submissionKey = useRef(crypto.randomUUID());
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const paid = result?.status === "paid";
  const paymentToken = paymentTokenFromUrl(result?.paymentUrl);

  useEffect(() => {
    if (!result || paid || !paymentToken) return undefined;
    if (!["pending", "confirming", "payment_pending"].includes(result.status)) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const next = await verifyDeskPayment(paymentToken);
        if (!next) return;
        setResult((prev) => ({
          ...prev,
          ...next,
          status: next.status || prev.status,
          registrationId: next.registrationId || prev.registrationId,
          ticketQr: next.ticketQr || prev.ticketQr,
          amount: next.amount ?? prev.amount,
        }));
        if (next.status === "paid" && next.ticketQr) setTicketQr(next.ticketQr);
        if (next.status === "paid") onCreated?.();
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [paymentToken, paid, result?.status, onCreated]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const teammateRows = members
        .map((row) => ({ name: row.name.trim(), email: row.email.trim().toLowerCase() }))
        .filter((row) => row.name || row.email);
      if (teammateRows.length < extraMin || teammateRows.length > extraMax) {
        throw new Error(
          `Add ${extraMin === extraMax ? extraMin : `${extraMin}–${extraMax}`} other teammates with name and email`,
        );
      }
      if (teammateRows.some((row) => !row.name || (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)))) {
        throw new Error("Every teammate needs a full name; email is optional but must be valid when entered");
      }
      const data = await createFestDayAssistedRegistration(festId, {
        ...form,
        competitionId: competition._id,
        submissionKey: submissionKey.current,
        members: teammateRows,
      });
      setResult(data);
      if (data.status === "paid" && data.ticketQr) {
        setTicketQr(data.ticketQr);
      } else if (data.paymentUrl) {
        setQr(await buildBrandedCompetitionQrDataUrl(data.paymentUrl, { size: 900 }));
      }
      onCreated?.();
    } catch (err) {
      if (err?.openPayment && err?.paymentUrl) {
        setResult({
          status: "pending",
          amount: err.amount,
          orderId: err.orderId,
          paymentUrl: err.paymentUrl,
          competitionName: err.competitionName,
          reused: true,
          openPaymentBlocked: true,
        });
        setQr(await buildBrandedCompetitionQrDataUrl(err.paymentUrl, { size: 900 }));
        setError(err.message || "This person already has an open payment QR");
      } else {
        setError(err.message || "Could not create registration");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 p-3 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-4xl max-h-[96dvh] overflow-y-auto rounded-3xl border border-white/10 bg-[#121314] p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#0ECCEE]">
              Desk-assisted registration
            </p>
            <h2 className="text-xl sm:text-3xl font-bold text-white mt-1">
              {competition.name}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {organizerCompetitionFeeLabel(competition)} · Team size{" "}
              {teamMin === teamMax ? teamMin : `${teamMin}–${teamMax}`}
            </p>
            <p className="mt-2 text-xs text-amber-200/90 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-1.5">
              Full single-event price — not the any-3 bundle (65% off). Use Bundle if they want 3 events.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-white/10 text-gray-400"
            title="Close — pending payments stay in Live activity"
          >
            <X />
          </button>
        </div>
        {result ? (
          <div className="space-y-4">
            {(result.reused || result.openPaymentBlocked) ? (
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-center text-sm text-cyan-100">
                One payment QR per person — showing their existing open QR
                {result.competitionName ? ` (${result.competitionName})` : ""}.
              </div>
            ) : null}
            <div
              className={`rounded-xl border px-3 py-2 text-center text-sm font-semibold ${
                paid
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-400/30 bg-amber-500/10 text-amber-100"
              }`}
            >
              {paid ? "ENTRY TICKET QR — show at gate" : "PAYMENT QR — not for gate entry"}
            </div>
            <div className="rounded-3xl bg-white p-4 flex items-center justify-center min-h-[320px]">
              {paid && ticketQr ? (
                <div className="w-full max-w-[420px] flex justify-center">
                  <LocalQRCode data={ticketQr} size={360} className="mx-auto" printSafe />
                </div>
              ) : paid ? (
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
              <p className={paid ? "text-sm text-emerald-300" : "text-sm text-amber-300"}>
                {paid
                  ? "Paid · ticket ready · confirmation email sent"
                  : result.status === "paid_review"
                    ? "Payment received — refund/review in progress. Do not create another entry."
                  : result.status === "confirming"
                    ? "Payment confirming — waiting for ticket…"
                    : "Student scans this QR and pays on their phone"}
              </p>
              <p className="font-mono text-xs text-gray-500 mt-1">{result.orderId}</p>
              {result.registrationId ? (
                <p className="text-xs text-gray-400 mt-1">Reg: {result.registrationId}</p>
              ) : null}
            </div>
            {paid ? (
              <button type="button" onClick={onClose} className="desk-action w-full">
                Done — next student
              </button>
            ) : (
              <div className="space-y-2">
                <button type="button" onClick={onClose} className="desk-action w-full bg-[#0ECCEE]/15 border-[#0ECCEE]/40 text-[#0ECCEE]">
                  Next student — keep this in Live activity
                </button>
                <p className="text-center text-xs text-gray-500">
                  They can keep paying on their phone. Later tap <span className="text-gray-300">Show pay QR</span> or{" "}
                  <span className="text-gray-300">Show ticket</span> in the live bar.
                </p>
              </div>
            )}
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
              <span className="text-xs text-gray-400">Email * (ticket + confirmation)</span>
              <input
                required
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
                <div className="sm:col-span-2 space-y-3">
                  <p className="text-xs text-gray-400">
                    Other teammates ({extraMin}–{extraMax}) — full name required
                  </p>
                  {members.map((member, index) => (
                    <div key={index} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
                      <input
                        required={index < extraMin}
                        value={member.name}
                        onChange={(e) =>
                          setMembers((all) =>
                            all.map((row, i) =>
                              i === index ? { ...row, name: e.target.value } : row,
                            ),
                          )
                        }
                        placeholder="Full name"
                        className="rounded-xl bg-[#1D1E20] border border-white/10 px-3 py-2.5"
                      />
                      <input
                        type="email"
                        value={member.email}
                        onChange={(e) =>
                          setMembers((all) =>
                            all.map((row, i) =>
                              i === index ? { ...row, email: e.target.value } : row,
                            ),
                          )
                        }
                        placeholder="Email (optional)"
                        className="rounded-xl bg-[#1D1E20] border border-white/10 px-3 py-2.5"
                      />
                      <button
                        type="button"
                        onClick={() => setMembers((all) => all.filter((_, i) => i !== index))}
                        className="rounded-xl border border-white/10 px-3 text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {members.length < extraMax ? (
                    <button
                      type="button"
                      onClick={() => setMembers((all) => [...all, emptyMember()])}
                      className="w-full rounded-xl border border-dashed border-[#0ECCEE]/40 py-2.5 text-sm font-semibold text-[#0ECCEE]"
                    >
                      + Add teammate
                    </button>
                  ) : null}
                </div>
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
                      {tier.label} · ₹{Number(tier.amount).toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {error ? <p className="sm:col-span-2 text-sm text-red-400">{error}</p> : null}
            <button
              disabled={busy || !online}
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

function DeskQrModal({ row, onClose }) {
  const isTicket = row.mode === "ticket" || row.status === "paid";
  const [payQr, setPayQr] = useState("");

  useEffect(() => {
    if (isTicket || !row.resumeUrl) {
      setPayQr("");
      return undefined;
    }
    let cancelled = false;
    buildBrandedCompetitionQrDataUrl(row.resumeUrl, { size: 900 }).then((url) => {
      if (!cancelled) setPayQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [isTicket, row.resumeUrl]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 p-3 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#121314] p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-xs uppercase tracking-wider ${isTicket ? "text-emerald-300" : "text-amber-300"}`}>
              {isTicket ? "ENTRY TICKET QR" : "PAYMENT QR — not for gate"}
            </p>
            <h2 className="text-lg font-bold text-white mt-1">{row.participantName}</h2>
            <p className="text-sm text-gray-400">{row.competitionName}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl border border-white/10 text-gray-400">
            <X />
          </button>
        </div>
        <div className="rounded-3xl bg-white p-4 flex justify-center min-h-[280px] items-center">
          {isTicket && row.ticketQr ? (
            <LocalQRCode data={row.ticketQr} size={280} printSafe />
          ) : !isTicket && payQr ? (
            <img src={payQr} alt="Scan to pay" className="w-full max-w-[360px] aspect-square" />
          ) : isTicket ? (
            <p className="text-sm text-gray-600 py-10">Ticket QR not available yet — tap Check payment</p>
          ) : (
            <Loader className="animate-spin text-black" />
          )}
        </div>
        <p className="text-center text-sm text-gray-400">
          {isTicket
            ? "Paid · show this at the gate"
            : row.status === "confirming"
              ? "Payment confirming — wait, then Show ticket"
              : "Student pays on their phone · status updates in Live activity"}
        </p>
        {row.registrationId ? (
          <button
            type="button"
            className="desk-action w-full"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(row.registrationId);
              } catch {
                /* ignore */
              }
            }}
          >
            <Copy size={14} /> Copy registration id
          </button>
        ) : null}
        <button type="button" onClick={onClose} className="desk-action w-full">
          Close — next student
        </button>
      </div>
    </div>
  );
}

export default function FestOrganizerFestDayDeskPage() {
  const { festId } = useParams();
  const { toast, confirm } = useDialog();
  const organizerSession = getFestOrganizerSession();
  const isDeskRole = organizerSession?.organizer?.portalRole === "desk";
  const canRefund = !isDeskRole;
  const [competitions, setCompetitions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [bundleActivity, setBundleActivity] = useState([]);
  const [query, setQuery] = useState("");
  const [activityQuery, setActivityQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [deskQrPreview, setDeskQrPreview] = useState(null);
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
        setBundleActivity(data.bundleActivity || []);
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
    const timer = window.setInterval(() => load({ quiet: true }), 8000);
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

  const combinedActivity = useMemo(() => [
    ...activity.map((row) => ({ ...row, activityType: "single" })),
    ...bundleActivity.map((row) => ({
      ...row,
      activityType: "bundle",
      orderId: row.activeOrderId,
      competitionName: row.competitionNames?.join(" + ") || "3-competition bundle",
    })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [activity, bundleActivity]);

  const refreshOrder = async (orderId) => {
    if (!online) return toast("Internet is required to verify a Cashfree payment");
    setBusyOrder(orderId);
    try {
      const result = await refreshFestDayDeskOrder(festId, orderId);
      toast(
        result.issued
          ? "Payment verified and registration issued"
          : result.message ||
              (result.verified
                ? "Payment received; ticket issuance is still confirming"
                : "Latest payment status loaded"),
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
    setBusyOrder(row.orderId || row.activeOrderId);
    try {
      await refundFestDayDeskOrder(festId, row.orderId || row.activeOrderId);
      toast("Refund started; Cashfree confirmation is pending");
      await load({ quiet: true });
    } catch (error) {
      toast(error.message || "Could not start refund");
    } finally {
      setBusyOrder("");
    }
  };

  const copyId = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast("Copied");
    } catch {
      toast("Could not copy");
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
          Offline — existing QRs remain usable, but live status and payment verification will resume when connected.
        </div>
      ) : null}

      <section className="rounded-3xl border border-[#0ECCEE]/25 bg-linear-to-br from-[#0ECCEE]/15 to-[#161718] p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#0ECCEE]">MindSpark operations</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">Fest Day Desk</h1>
            <p className="text-sm text-gray-400 mt-2">
              Attend many people in parallel: create payment QR → next student → reopen pay/ticket from Live activity.
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
        <div className="mt-4 grid sm:grid-cols-2 gap-2">
          <div className="rounded-2xl border border-[#0ECCEE] bg-[#0ECCEE]/15 p-3 text-left">
            <UserRound size={18} className="text-[#0ECCEE] mb-2" />
            <p className="font-semibold text-white text-sm">Desk assist</p>
            <p className="text-[11px] text-gray-400 mt-1">Pick a competition below · you type · they pay</p>
          </div>
          <Link
            to="/mindspark/bundle?desk=1"
            className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-left hover:border-emerald-300/50"
          >
            <ShoppingCart size={18} className="text-emerald-300 mb-2" />
            <p className="font-semibold text-emerald-100 text-sm">Any-3 bundle · 65%</p>
            <p className="text-[11px] text-gray-400 mt-1">Stay on tablet with payment QR</p>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-[#0ECCEE]/20 bg-[#121314] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-[#0ECCEE]/10 p-2.5 text-[#0ECCEE]">
              <ShoppingCart size={20} />
            </span>
            <div>
              <h2 className="font-semibold text-white">Bundle registrations</h2>
              <p className="text-xs text-gray-500">One payment covering exactly three competitions</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-gray-300">
              {bundleActivity.length} shown
            </span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">
              {bundleActivity.filter((row) => row.status === "paid").length} paid
            </span>
          </div>
        </div>
        <div className="space-y-2 max-h-[28vh] overflow-y-auto">
          {bundleActivity.length ? (
            bundleActivity.map((row) => (
              <article key={row.bundleId} className="rounded-xl border border-white/10 bg-[#1A1B1D] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{row.participantName}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{row.competitionNames?.join(" + ")}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClasses[row.status] || statusClasses.expired}`}
                  >
                    {statusLabels[row.status] || row.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                  <span className="font-semibold text-gray-300">
                    ₹{Number(row.amount).toLocaleString("en-IN")}
                  </span>
                  <span>Saved ₹{Number(row.discountAmount).toLocaleString("en-IN")}</span>
                  <span>{row.source === "desk" ? "Desk" : "Public"}</span>
                  <span>{formatWhen(row.createdAt)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.activeOrderId ? (
                    <button
                      type="button"
                      onClick={() => refreshOrder(row.activeOrderId)}
                      disabled={busyOrder === row.activeOrderId || !online}
                      className="desk-action"
                    >
                      {busyOrder === row.activeOrderId ? (
                        <Loader size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Check payment
                    </button>
                  ) : null}
                  {row.status === "paid" && row.registrationIds?.[0] ? (
                    isDeskRole ? (
                      <button
                        type="button"
                        className="desk-action"
                        onClick={() => copyId(row.registrationIds[0])}
                      >
                        <Copy size={14} /> Copy reg id
                      </button>
                    ) : (
                      <Link
                        to={`/fest-organizer/fests/${festId}/participants?q=${encodeURIComponent(row.registrationIds[0])}`}
                        className="desk-action"
                      >
                        <ExternalLink size={14} /> Open registrations
                      </Link>
                    )
                  ) : row.paymentPath ? (
                    <a href={row.paymentPath} target="_blank" rel="noreferrer" className="desk-action">
                      <QrCode size={14} /> Payment page
                    </a>
                  ) : null}
                  {canRefund && row.status === "paid" && row.activeOrderId ? (
                    <button
                      type="button"
                      onClick={() =>
                        refundOrder({
                          orderId: row.activeOrderId,
                          amount: row.amount,
                          participantName: row.participantName,
                        })
                      }
                      disabled={busyOrder === row.activeOrderId || !online}
                      className="desk-action text-red-300"
                    >
                      Refund
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-gray-500">
              No bundle registrations yet. Use “Any-3 bundle” above to start one.
            </div>
          )}
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
                competition.registrationsOpen === false || competition.slotsLeft === 0;
              const slots = Number(competition.slotsAllotted) || 0;
              return (
                <button
                  key={competition._id}
                  type="button"
                  disabled={closed}
                  onClick={() => setSelected({ ...competition, id: competition._id })}
                  className="rounded-2xl border border-white/10 bg-[#1A1B1D] p-4 text-left hover:border-[#0ECCEE]/50 disabled:opacity-45 transition"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-semibold text-white">{competition.name}</p>
                    <ExternalLink size={15} className="text-[#0ECCEE] shrink-0" />
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
                  {(competition.pendingToday || competition.paidToday) ? (
                    <p className="text-[11px] text-gray-400 mt-2">
                      Today · {competition.pendingToday || 0} pending · {competition.paidToday || 0} paid
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#121314] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">Live activity</h2>
              <p className="text-xs text-gray-500">
                Pending → confirming → paid. Reopen pay QR or ticket anytime.
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
              <Search size={16} className="absolute left-3 top-3 text-gray-500" />
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
                        <p className="text-sm font-semibold truncate">{row.participantName}</p>
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
                      {row.source ? (
                        <span className="uppercase tracking-wide">{row.source}</span>
                      ) : null}
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
                          busyOrder === row.orderId || !online || row.status === "form_started"
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
                          : row.status === "paid"
                            ? "Refresh"
                            : "Check payment"}
                      </button>
                      {row.status === "paid" && (row.ticketQr || row.registrationId) ? (
                        <button
                          type="button"
                          className="desk-action flex-1"
                          onClick={() =>
                            row.ticketQr
                              ? setDeskQrPreview({ ...row, mode: "ticket" })
                              : copyId(row.registrationId)
                          }
                        >
                          {row.ticketQr ? (
                            <>
                              <QrCode size={14} /> Show ticket
                            </>
                          ) : (
                            <>
                              <Copy size={14} /> Copy id
                            </>
                          )}
                        </button>
                      ) : null}
                      {!["paid", "form_started", "failed", "expired", "refunded"].includes(
                        displayStatus,
                      ) && row.resumeUrl ? (
                        <button
                          type="button"
                          className="desk-action flex-1"
                          onClick={() => setDeskQrPreview({ ...row, mode: "payment" })}
                        >
                          <QrCode size={14} /> Show pay QR
                        </button>
                      ) : null}
                      {row.status === "paid" &&
                      !isDeskRole &&
                      row.registrationId &&
                      !row.ticketQr ? (
                        <Link
                          to={`/fest-organizer/fests/${festId}/participants?q=${encodeURIComponent(row.registrationId)}`}
                          className="desk-action flex-1"
                        >
                          <ExternalLink size={14} /> Open entry
                        </Link>
                      ) : null}
                      {canRefund && row.status === "paid" && !row.refundStatus ? (
                        <button
                          type="button"
                          onClick={() => refundOrder(row)}
                          disabled={busyOrder === row.orderId || !online}
                          className="desk-action text-red-300"
                        >
                          Refund
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
        Multi-student: create pay QR → tap <span className="text-gray-300">Next student</span> → help the next person.
        Find anyone again in Live activity (Show pay QR / Check payment / Show ticket). Payment QR is never valid at the gate.
      </p>

      {selected ? (
        <AssistedEntryModal
          festId={festId}
          competition={selected}
          online={online}
          onClose={() => setSelected(null)}
          onCreated={() => load({ quiet: true })}
        />
      ) : null}
      {deskQrPreview ? (
        <DeskQrModal row={deskQrPreview} onClose={() => setDeskQrPreview(null)} />
      ) : null}
    </div>
  );
}
