import { buildEventPriceBreakdown } from '../../utils/platformFee';
import {
    TREK_PLATFORM_FEE_PERCENT_OPTIONS,
    sanitizeTrekRegistrationFee,
    resolveTrekPlatformFeePercent,
} from '../../utils/trekRegistrationFee';

function formatEventTicketPrice(value) {
    const n = Number(value) || 0;
    if (n <= 0) return 'Free';
    return `₹${n.toLocaleString('en-IN')}`;
}

export default function EventRegistrationFeePicker({
    ticketPrice = 0,
    platformFeePercent = 2.5,
    onTicketPriceChange,
    onPlatformFeePercentChange,
    inputClassName = '',
    hideFeeInput = false,
    sampleFee = null,
}) {
    const baseFee = Number(ticketPrice) || 0;
    const fee = hideFeeInput ? Math.max(0, Number(sampleFee) || 0) : baseFee;
    // Use nullish resolve — `|| 2.5` wrongly treats 0% as missing and blocks changing to 0
    const platformPct = resolveTrekPlatformFeePercent(platformFeePercent, 2.5);
    const exampleBase = fee > 0 ? fee : (hideFeeInput ? 1000 : 0);
    const { platformFee: samplePlatform, totalAmount: sampleTotal } = buildEventPriceBreakdown(
        exampleBase || 0,
        platformPct,
    );

    const inp =
        inputClassName ||
        'w-full bg-[#111213] border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#0ECCEE]';

    return (
        <div className="space-y-4 rounded-xl border border-gray-700 bg-[#1D1E20] p-4">
            {!hideFeeInput ? (
                <div>
                    <label className="block text-sm font-semibold text-gray-200 mb-1">
                        Registration fee (₹)
                    </label>
                    <p className="text-[11px] text-gray-500 mb-2">
                        Base ticket price for this event. Platform fee is added on top at checkout.
                    </p>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={baseFee > 0 ? baseFee : ''}
                        onChange={(e) => {
                            const raw = e.target.value;
                            onTicketPriceChange?.(raw === '' ? 0 : sanitizeTrekRegistrationFee(raw));
                        }}
                        className={inp}
                        placeholder="e.g. 500 — leave empty for Free"
                    />
                </div>
            ) : null}

            <div>
                <p className="text-sm font-semibold text-gray-200">Platform fee (%)</p>
                <p className="text-[11px] text-gray-500 mt-0.5 mb-2">
                    Extra % added on top at checkout. Tap a chip to set — including 0% (no platform fee).
                </p>
                <div className="flex flex-wrap gap-2">
                    {TREK_PLATFORM_FEE_PERCENT_OPTIONS.map((opt) => {
                        const selected = platformPct === opt.value;
                        return (
                            <button
                                key={`pf_${opt.value}`}
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onPlatformFeePercentChange?.(opt.value);
                                }}
                                title={opt.label}
                                className={`min-w-10 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                    selected
                                        ? 'bg-[#0ECCEE] text-black border-[#0ECCEE]'
                                        : 'bg-[#111213] text-gray-300 border-gray-600 hover:border-[#0ECCEE]/50'
                                }`}
                            >
                                {opt.chip}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-[#111213] px-3 py-2.5 text-xs text-gray-400 space-y-1">
                {!hideFeeInput ? (
                    <p>
                        Event fee: <span className="text-white font-medium">{formatEventTicketPrice(baseFee)}</span>
                        <span className="text-gray-500"> · Platform fee: {platformPct}%</span>
                    </p>
                ) : (
                    <p>
                        Platform fee: <span className="text-white font-medium">{platformPct}%</span>
                        {' '}applied on the selected package at checkout
                    </p>
                )}
                {(hideFeeInput || baseFee > 0) && exampleBase > 0 ? (
                    <p>
                        Example checkout:{' '}
                        <span className="text-[#0ECCEE] font-medium">
                            ₹{sampleTotal.toLocaleString('en-IN')}
                        </span>
                        {' '}(₹{exampleBase.toLocaleString('en-IN')}
                        {platformPct > 0 ? ` + ₹${samplePlatform} platform fee` : ' · no platform fee'})
                    </p>
                ) : !hideFeeInput ? (
                    <p>No payment at checkout — registration is free.</p>
                ) : null}
            </div>
        </div>
    );
}
