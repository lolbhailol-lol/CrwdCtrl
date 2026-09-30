/** Illustrated sample face photos and ID cards — no real people. */

export function SampleFace({ look = {} }) {
    const {
        skin = '#d9a882',
        hair = '#2b1d16',
        shirt = '#0ECCEE',
        bg = '#1d2a33',
        longHair = false,
        glasses = false,
    } = look;
    return (
        <svg viewBox="0 0 120 150" className="h-full w-full" role="img" aria-label="Sample face photo" preserveAspectRatio="xMidYMid slice">
            <rect width="120" height="150" fill={bg} />
            {longHair ? <path d="M30 60c-2 30 2 52 8 62h44c6-10 10-32 8-62z" fill={hair} /> : null}
            <circle cx="60" cy="58" r="26" fill={skin} />
            <path d="M32 52c2-22 16-32 30-32s27 9 28 30c-7-9-17-14-28-14s-22 6-30 16z" fill={hair} />
            <circle cx="50" cy="60" r="2.6" fill="#2b1d16" />
            <circle cx="70" cy="60" r="2.6" fill="#2b1d16" />
            {glasses ? (
                <g stroke="#111" strokeWidth="1.6" fill="none">
                    <circle cx="50" cy="60" r="6.5" />
                    <circle cx="70" cy="60" r="6.5" />
                    <path d="M56.5 60h7" />
                </g>
            ) : null}
            <path d="M52 72c5 4 11 4 16 0" stroke="#8a4b3a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M18 150c3-30 20-44 42-44s39 14 42 44z" fill={shirt} opacity="0.9" />
        </svg>
    );
}

export function SampleIdCard({ college, name, prn, branch, look, blurry = false }) {
    return (
        <div className={`h-full w-full rounded-lg bg-gradient-to-br from-slate-100 to-slate-300 p-2 text-slate-800 flex flex-col ${blurry ? 'blur-[1.5px]' : ''}`}>
            <div className="flex items-center justify-between gap-1 border-b border-slate-400/60 pb-1">
                <span className="text-[8px] font-black tracking-wide uppercase truncate">{college}</span>
                <span className="text-[7px] font-semibold text-slate-500 shrink-0">STUDENT ID</span>
            </div>
            <div className="flex gap-2 pt-1.5 flex-1 min-h-0">
                <div className="w-12 h-14 shrink-0 overflow-hidden rounded border border-slate-400">
                    <SampleFace look={look} />
                </div>
                <div className="min-w-0 text-[8px] leading-tight space-y-0.5">
                    <p className="font-bold text-[9px] truncate">{name}</p>
                    <p className="line-clamp-2">{branch}</p>
                    <p>PRN: <span className="font-mono font-bold bg-yellow-200 px-0.5">{prn}</span></p>
                </div>
            </div>
        </div>
    );
}
