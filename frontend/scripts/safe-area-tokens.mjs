/**
 * Route safe-area values through the global --safe-* tokens instead of env() directly.
 *
 * Android WebView < 140 reports 0px for env(safe-area-inset-*), so on Android 15/16 —
 * where edge-to-edge is forced — content renders under the system bars. The tokens in
 * styles/tokens.css prefer Capacitor's natively injected --safe-area-inset-* variables
 * and keep env() as the fallback, so every call site must read the token.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const EXT = new Set(['.jsx', '.js', '.css']);

// tokens.css defines the tokens in terms of env() and must keep doing so.
const SKIP_FILES = new Set([path.join(SRC, 'styles', 'tokens.css')]);

// Matches env(safe-area-inset-X) and env(safe-area-inset-X, 0px). All fallbacks in this
// codebase are 0px, which the tokens already provide.
const ENV_INSET = /env\(\s*safe-area-inset-(top|bottom|left|right)\s*(?:,\s*0px\s*)?\)/g;

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
    let count = 0;
    const lines = content.split('\n').map((line) => {
        // `@supports (padding-bottom: env(...))` is feature detection, not a value —
        // rewriting it to var() would make the query always match.
        if (line.trimStart().startsWith('@supports')) return line;
        return line.replace(ENV_INSET, (_match, side) => {
            count += 1;
            return `var(--safe-${side})`;
        });
    });
    return { content: lines.join('\n'), count };
}

let changedFiles = 0;
let totalReplacements = 0;

for (const file of walk(SRC)) {
    if (SKIP_FILES.has(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    const { content: after, count } = rewrite(before);
    if (count > 0 && after !== before) {
        fs.writeFileSync(file, after, 'utf8');
        changedFiles += 1;
        totalReplacements += count;
        console.log(`${path.relative(SRC, file)} (${count})`);
    }
}

console.log(`\nUpdated ${changedFiles} files, ${totalReplacements} replacements.`);
