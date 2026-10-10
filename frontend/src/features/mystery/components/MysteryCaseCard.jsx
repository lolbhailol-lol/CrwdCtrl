import { Calendar, MapPin, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MYSTERY_PATHS } from '../config';

function formatDate(iso) {
  if (!iso) return 'Date TBA';
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function MysteryCaseCard({ mysteryCase, event }) {
  const hasImage = Boolean(mysteryCase.coverImageUrl);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div
        className="relative h-40 w-full"
        style={hasImage
          ? { backgroundImage: `url(${mysteryCase.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'radial-gradient(ellipse 100% 100% at 50% 0%, #0ECCEE33, transparent 70%), linear-gradient(135deg, #121416, #0b0c0d)' }}
      >
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10">
          <div className="flex gap-2">
            <span className="rounded-full bg-[#0ECCEE]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0ECCEE]">CTRL Mystery</span>
            {event && <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80">{event.college || 'Live event'}</span>}
          </div>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold text-white">{mysteryCase.title}</h3>
        <p className="mt-1 text-sm text-white/60">{mysteryCase.tagline}</p>
        {event && <p className="mt-2 text-xs font-semibold text-emerald-400">Registration open</p>}
        {event && (
          <div className="mt-4 space-y-2 text-sm text-white/70">
            <div className="flex items-center gap-2"><Calendar size={15} className="text-white/40" /><span>{formatDate(event.dateTime)}</span></div>
            <div className="flex items-center gap-2"><MapPin size={15} className="text-white/40" /><span>{event.venue || 'Venue TBA'}</span></div>
            <div className="flex items-center gap-2"><Users size={15} className="text-white/40" /><span>{event.minTeamSize}-{event.maxTeamSize} members per team</span></div>
            <div className="flex items-center gap-2"><Wallet size={15} className="text-white/40" /><span>{event.entryFeePerTeam > 0 ? `₹${event.entryFeePerTeam} per team` : 'Free entry'}</span></div>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to={MYSTERY_PATHS.practice(mysteryCase._id)} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white">Try solo (practice)</Link>
          {event && <Link to={`${MYSTERY_PATHS.register(mysteryCase._id)}?eventId=${event._id}`} className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-bold text-black">Register team</Link>}
        </div>
      </div>
    </div>
  );
}