import { Mail, Phone, GraduationCap, User } from 'lucide-react';

const DEFAULT_FIELD_ORDER = ['name', 'email', 'phone', 'college'];

function fieldLabel(key, personFields = []) {
  const hit = personFields.find((f) => f.key === key);
  if (hit?.label) return hit.label;
  return String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function orderedEntries(member, personFields = []) {
  const fields = member?.fields && typeof member.fields === 'object' ? member.fields : {};
  const keys = new Set([
    ...personFields.map((f) => f.key).filter(Boolean),
    ...DEFAULT_FIELD_ORDER,
    ...Object.keys(fields),
  ]);
  const ordered = [];
  for (const k of DEFAULT_FIELD_ORDER) {
    if (keys.has(k) && (fields[k] || member?.[k])) ordered.push(k);
    keys.delete(k);
  }
  for (const k of keys) {
    if (fields[k] || member?.[k]) ordered.push(k);
  }
  return ordered.map((key) => ({
    key,
    label: fieldLabel(key, personFields),
    value: String(fields[key] || member?.[key] || '').trim(),
  })).filter((row) => row.value);
}

/**
 * Clear per-person roster for organizer dashboard (solo or team).
 */
export default function OrganizerTeamRoster({
  teamMembers = [],
  personFields = [],
  teamSize,
  compact = false,
  title,
}) {
  const people = Array.isArray(teamMembers) ? teamMembers.filter(Boolean) : [];
  if (!people.length) return null;

  const sizeLabel = Number(teamSize) > 0 ? Number(teamSize) : people.length;
  const heading = title || (sizeLabel === 1 ? 'Participant details' : `Team · ${sizeLabel} people`);

  return (
    <div className={`rounded-xl border border-white/10 bg-[#0f1011] ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0ECCEE]/90">
          {heading}
        </p>
        <span className="text-[10px] tabular-nums text-gray-500">
          {people.length} listed
        </span>
      </div>
      <div className={`space-y-2 ${compact ? '' : 'sm:space-y-2.5'}`}>
        {people.map((person, idx) => {
          const rows = orderedEntries(person, personFields);
          const name = person.name || rows.find((r) => r.key === 'name')?.value || `Person ${idx + 1}`;
          const email = person.email || rows.find((r) => r.key === 'email')?.value || '';
          const phone = person.phone || rows.find((r) => r.key === 'phone')?.value || '';
          const college = person.college || rows.find((r) => r.key === 'college')?.value || '';
          const extras = rows.filter((r) => !['name', 'email', 'phone', 'college'].includes(r.key));

          return (
            <div
              key={`${person.index || idx}-${name}`}
              className="rounded-lg border border-white/8 bg-[#161718] px-3 py-2.5"
            >
              <div className="flex items-start gap-2.5">
                <div className="size-8 rounded-lg bg-[#0ECCEE]/12 border border-[#0ECCEE]/20 flex items-center justify-center shrink-0 text-[11px] font-bold text-[#0ECCEE]">
                  {person.index || idx + 1}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                    <User size={12} className="text-gray-500 shrink-0" />
                    {name}
                    {idx === 0 && people.length > 1 ? (
                      <span className="text-[9px] font-medium uppercase tracking-wide text-[#0ECCEE]/80 bg-[#0ECCEE]/10 px-1.5 py-0.5 rounded">
                        Lead
                      </span>
                    ) : null}
                  </p>
                  {email ? (
                    <a
                      href={`mailto:${email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-gray-400 truncate flex items-center gap-1.5 hover:text-[#0ECCEE]"
                    >
                      <Mail size={11} className="shrink-0 opacity-60" />
                      {email}
                    </a>
                  ) : null}
                  {phone ? (
                    <a
                      href={`tel:${phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-gray-400 truncate flex items-center gap-1.5 hover:text-[#0ECCEE]"
                    >
                      <Phone size={11} className="shrink-0 opacity-60" />
                      {phone}
                    </a>
                  ) : null}
                  {college ? (
                    <p className="text-[11px] text-gray-500 truncate flex items-center gap-1.5">
                      <GraduationCap size={11} className="shrink-0 opacity-60" />
                      {college}
                    </p>
                  ) : null}
                  {extras.length ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {extras.map((row) => (
                        <span
                          key={row.key}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-400 max-w-full truncate"
                          title={`${row.label}: ${row.value}`}
                        >
                          {row.label}: {row.value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Compact preview for list cards — names + contact so organizers scan without opening Excel */
export function OrganizerRosterPreview({ teamMembers = [], teamSize }) {
  const people = Array.isArray(teamMembers) ? teamMembers.filter(Boolean) : [];
  if (!people.length) return null;
  const size = Number(teamSize) > 0 ? Number(teamSize) : people.length;
  const shown = people.slice(0, 3);
  const more = Math.max(0, people.length - shown.length);

  return (
    <div className="mt-1.5 rounded-lg border border-white/8 bg-black/25 px-2.5 py-2 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wide text-[#0ECCEE]/80 font-semibold">
        {size === 1 ? '1 person' : `${size} people`}
      </p>
      <ul className="space-y-1">
        {shown.map((p, idx) => {
          const name = p.name || `Person ${idx + 1}`;
          const contact = [p.phone, p.email].filter(Boolean).join(' · ');
          return (
            <li key={`${idx}-${name}`} className="min-w-0">
              <p className="text-[12px] text-white truncate leading-tight">
                <span className="text-gray-500 tabular-nums mr-1">{idx + 1}.</span>
                {name}
                {idx === 0 && people.length > 1 ? (
                  <span className="ml-1 text-[9px] text-[#0ECCEE]/70">lead</span>
                ) : null}
              </p>
              {contact ? (
                <p className="text-[10px] text-gray-500 truncate pl-3.5">{contact}</p>
              ) : null}
              {p.college && size === 1 ? (
                <p className="text-[10px] text-gray-600 truncate pl-3.5">{p.college}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {more > 0 ? (
        <p className="text-[10px] text-gray-500 pl-0.5">+{more} more — open for full roster</p>
      ) : null}
    </div>
  );
}
