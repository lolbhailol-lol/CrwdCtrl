import { buildEventPriceBreakdown } from '../../utils/platformFee';
import {
    TREK_PLATFORM_FEE_PERCENT_OPTIONS,
    sanitizeTrekRegistrationFee,
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
}) {
    const fee = Number(ticketPrice) || 0;
    const platformPct = Number(platformFeePercent) || 2.5;
    const { platformFee: samplePlatform, totalAmount: sampleTotal } = buildEventPriceBreakdown(
        fee,
        platformPct,
    );

    const inp =
        inputClassName ||
        'w-full bg-[#111213] border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#0ECCEE]';

    return (
        <div className="space-y-4 rounded-xl border border-gray-700 bg-[#1D1E20] p-4">
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
                    value={fee > 0 ? fee : ''}
                    onChange={(e) => {
                        const raw = e.target.value;
                        onTicketPriceChange(raw === '' ? 0 : sanitizeTrekRegistrationFee(raw));
                    }}
                    className={inp}
                    placeholder="e.g. 500 — leave empty for Free"
                />
            </div>

            <div>
                <p className="text-sm font-semibold text-gray-200">Platform fee (%)</p>
                <p className="text-[11px] text-gray-500 mt-0.5 mb-2">
                    Extra % added on top at checkout. e.g. 2.5% on ₹1,000 = ₹25 platform fee.
                </p>
                <div className="flex flex-wrap gap-2">
                    {TREK_PLATFORM_FEE_PERCENT_OPTIONS.map((opt) => {
                        const selected = platformPct === opt.value;
                        return (
                            <button
                                key={opt.chip}
                                type="button"
                                onClick={() => onPlatformFeePercentChange(opt.value)}
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
                <p>
                    Event fee: <span className="text-white font-medium">{formatEventTicketPrice(fee)}</span>
                    {fee > 0 ? (
                        <span className="text-gray-500"> · Platform fee: {platformPct}%</span>
                    ) : null}
                </p>
                {fee > 0 ? (
                    <p>
                        Example checkout:{' '}
                        <span className="text-[#0ECCEE] font-medium">
                            ₹{sampleTotal.toLocaleString('en-IN')}
                        </span>
                        {' '}(₹{fee.toLocaleString('en-IN')} ticket + ₹{samplePlatform} platform fee)
                    </p>
                ) : (
                    <p>No payment at checkout — registration is free.</p>
                )}
            </div>
        </div>
    );
}
