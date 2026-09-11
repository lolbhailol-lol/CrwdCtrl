const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public', 'category-icons');

function dims(buf) {
    const fmt = buf.toString('ascii', 12, 16);
    if (fmt === 'VP8 ') {
        const w = buf.readUInt16LE(26) & 0x3fff;
        const h = buf.readUInt16LE(28) & 0x3fff;
        return { fmt, w, h };
    }
    if (fmt === 'VP8L') {
        const b = buf.readUInt32LE(21);
        const w = (b & 0x3fff) + 1;
        const h = ((b >> 14) & 0x3fff) + 1;
        return { fmt, w, h };
    }
    if (fmt === 'VP8X') {
        const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
        const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
        return { fmt, w, h };
    }
    return { fmt, w: '?', h: '?' };
}

for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.webp')) continue;
    const buf = fs.readFileSync(path.join(dir, f));
    const d = dims(buf);
    console.log(`${f.padEnd(20)} ${d.fmt} ${d.w}x${d.h}`);
}
