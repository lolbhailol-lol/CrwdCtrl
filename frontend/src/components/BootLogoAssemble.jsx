import markLogo from '../assets/crwdctrl-mark.png';

/** Five vertical slices — gentle converge, ~0.65s assemble before hold */
const SLICES = [
    { index: 0, x: '-16%', y: '3%', delay: '0s' },
    { index: 1, x: '-9%', y: '-2%', delay: '0.03s' },
    { index: 2, x: '0%', y: '7%', delay: '0.06s' },
    { index: 3, x: '9%', y: '-2%', delay: '0.09s' },
    { index: 4, x: '16%', y: '3%', delay: '0.12s' },
];

export default function BootLogoAssemble({ className = '' }) {
    return (
        <div className={`boot-logo-assemble ${className}`.trim()} aria-hidden="true">
            {SLICES.map(({ index, x, y, delay }) => (
                <div
                    key={index}
                    className="boot-logo-slice"
                    style={{
                        '--boot-slice-index': index,
                        '--boot-slice-x': x,
                        '--boot-slice-y': y,
                        '--boot-slice-delay': delay,
                    }}
                >
                    <img src={markLogo} alt="" decoding="sync" draggable={false} />
                </div>
            ))}
        </div>
    );
}
