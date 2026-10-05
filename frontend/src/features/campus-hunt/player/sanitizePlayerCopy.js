/**
 * Strip legacy “enter team code after scan” phrasing from stored clue/checkpoint copy.
 * One-phone mode auto-unlocks on scan — players should never be told to re-enter the code.
 */
export function sanitizePlayerCopy(text) {
  let s = String(text || '');
  if (!s) return s;
  s = s
    .replace(/,?\s*then enters? (?:your |their )?team code(?: to unlock[^.!]*)?/gi, '')
    .replace(/,?\s*then enter(?:s)? (?:your |their )?team code(?: to (?:unlock|continue)[^.!]*)?/gi, '')
    .replace(/\s+and enter(?:s)? (?:your |their )?team code(?: to unlock[^.!]*)?/gi, '')
    .replace(/\s*\+\s*team code(?:\s*→|\s*to)?/gi, ' →')
    .replace(/\s*scan once \+ team code/gi, 'scan once')
    .replace(/\bMindSpark Lobby\b/g, 'Mindspark Lobby')
    .replace(/\bFinale Assembly\b/g, 'Mindspark Lobby')
    .replace(/\bplant slips?\b/gi, 'digit slips')
    .replace(/\bplant fragments?\b/gi, 'digit slips')
    .replace(/\bplant join[- ]?words?\b/gi, 'digit answer')
    .replace(/\bjoined word from plant\b/gi, 'digit answer')
    .replace(/\bdigital lockbox\b/gi, 'lockbox')
    .replace(/\bopen (?:the )?digital lockbox\b/gi, 'find the lockbox')
    .replace(/\beveryone scans[^.!]*/gi, 'the leader scans once')
    .replace(/\bwaiting for teammates\b/gi, '')
    .replace(/\bcollect teammate proof QRs?\b/gi, '')
    .replace(/\bneed \d+ more\b/gi, '')
    .replace(/\ball \d+ scan the same poster[^.!]*/gi, 'Leader scans the poster once')
    .replace(/\byou submit answers\s*[·•|-]\s*everyone scans/gi, 'Leader phone only')
    .replace(/\ball pieces are on this phone[^.!]*/gi, '')
    .replace(/\brebuild the code\b/gi, 'type the code')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.!?])/g, '$1')
    .trim();
  return s;
}
