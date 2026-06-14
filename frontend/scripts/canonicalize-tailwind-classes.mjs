/**
 * Tailwind v4 canonical class rewrites — safe string replacements in source files.
 * Skips negation repair: does not touch `!` important modifier placement in JS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const EXT = new Set(['.jsx', '.js']);

const REPLACEMENTS = [
    [/aspect-\[16\/9\]/g, 'aspect-video'],
    [/lg:aspect-\[8\/5\]/g, 'lg:aspect-8/5'],
    [/aspect-\[2\/1\]/g, 'aspect-2/1'],
    [/aspect-\[11\/10\]/g, 'aspect-11/10'],
    [/aspect-\[3\/2\]/g, 'aspect-3/2'],
    [/aspect-\[4\/3\]/g, 'aspect-4/3'],
    [/aspect-\[3\/4\]/g, 'aspect-3/4'],
    [/aspect-\[10\/7\]/g, 'aspect-10/7'],
    [/aspect-\[5\/3\]/g, 'aspect-5/3'],
    [/aspect-\[4\/5\]/g, 'aspect-4/5'],
    [/max-w-\[var\(--card-portrait-w\)\]/g, 'max-w-(--card-portrait-w)'],
    [/px-\[var\(--page-gutter\)\]/g, 'px-(--page-gutter)'],
    [/mx-\[var\(--page-gutter\)\]/g, 'mx-(--page-gutter)'],
    [/pb-\[var\(--footer-nav-clearance\)\]/g, 'pb-(--footer-nav-clearance)'],
    [/min-h-\[2\.75rem\]/g, 'min-h-11'],
    [/p-\[1px\]/g, 'p-px'],
    [/min-w-\[11rem\]/g, 'min-w-44'],
    [/lg:h-\[17\.5rem\]/g, 'lg:h-70'],
    [/max-w-\[10rem\]/g, 'max-w-40'],
    [/z-\[100000\]/g, 'z-100000'],
    [/z-\[100010\]/g, 'z-100010'],
    [/top-\[max\(1rem,env\(safe-area-inset-top\)\)\]/g, 'top-(max(1rem,env(safe-area-inset-top)))'],
];

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (EXT.has(path.extname(entry.name))) out.push(full);
    }
    return out;
}

function rewrite(content) {
    let next = content;
    for (const [pattern, replacement] of REPLACEMENTS) {
        next = next.replace(pattern, replacement);
    }
    return next;
}

let changed = 0;
for (const file of walk(SRC)) {
    const before = fs.readFileSync(file, 'utf8');
    const after = rewrite(before);
    if (after !== before) {
        fs.writeFileSync(file, after, 'utf8');
        changed += 1;
        console.log(path.relative(SRC, file));
    }
}
console.log(`Updated ${changed} files.`);
