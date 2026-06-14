/**
 * Safe Tailwind v4 canonical class rewrites (numeric z-index, dvh only).
 * Does NOT rewrite `!` important modifiers — those must stay in class strings only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const EXT = new Set(['.jsx', '.js', '.css']);

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
    next = next.replace(/\bz-\[(\d+)\]/g, 'z-$1');
    next = next.replace(/\bh-\[100dvh\]/g, 'h-dvh');
    next = next.replace(/\bmax-h-\[100dvh\]/g, 'max-h-dvh');
    next = next.replace(/\bmin-h-\[100dvh\]/g, 'min-h-dvh');
    return next;
}

let changed = 0;
for (const file of walk(SRC)) {
    const before = fs.readFileSync(file, 'utf8');
    const after = rewrite(before);
    if (after !== before) {
        fs.writeFileSync(file, after, 'utf8');
        changed += 1;
    }
}
console.log(`Updated ${changed} files.`);
