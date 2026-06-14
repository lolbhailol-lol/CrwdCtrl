/**
 * Repair broken JS negation after fix-tailwind-canonical.mjs.
 * Restores `!fooBar` from `foo!Bar` and `!foo` from `foo!` in code contexts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const EXT = new Set(['.jsx', '.js']);

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (EXT.has(path.extname(entry.name))) out.push(full);
    }
    return out;
}

function fix(content) {
    let next = content;
    let prev;

    do {
        prev = next;
        // !firebaseResult → firebase!Result
        next = next.replace(/\b([a-z]+)!([A-Z][a-zA-Z0-9]*)/g, '!$1$2');
        // !item.requiresAuth → item!.requiresAuth
        next = next.replace(/\b([a-z][a-zA-Z0-9]*)!(\.)/g, '!$1$2');
        // !loading && → loading! &&
        next = next.replace(/\b([a-z][a-z0-9]*)!(\s*(?:&&|\|\||\)|,|;|\?|:))/g, '!$1$2');
        // !isNativeApp() → isNativeApp!()
        next = next.replace(/\b([a-z][a-z0-9]*)!(\()/g, '!$1$2');
    } while (next !== prev);

    return next;
}

let changed = 0;
for (const file of walk(SRC)) {
    const before = fs.readFileSync(file, 'utf8');
    const after = fix(before);
    if (after !== before) {
        fs.writeFileSync(file, after, 'utf8');
        changed += 1;
        console.log(path.relative(SRC, file));
    }
}
console.log(`Repaired ${changed} files.`);
