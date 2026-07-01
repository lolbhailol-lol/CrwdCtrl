import { buildTrekPriceBreakdown } from '../../utils/platformFee';
import {
    TREK_PLATFORM_FEE_PERCENT_OPTIONS,
    sanitizeTrekRegistrationFee,
    formatTrekPerPersonFee,
} from '../../utils/trekRegistrationFee';

export default function TrekRegistrationFeePicker({
    registrationFee = 0,
    platformFeePercent = 3,
    onRegistrationFeeChange,
    onPlatformFeePercentChange,
    maxPeoplePerBooking = 10,
    inputClassName = '',
}) {
    const fee = Number(registrationFee) || 0;
    const platformPct = Number(platformFeePercent) || 3;
    const samplePeople = 1;
    const sampleBase = fee * samplePeople;
    const { platformFee: samplePlatform, totalAmount: sampleTotal } = buildTrekPriceBreakdown(
        sampleBase,
        platformPct,
    );

    const inp =
        inputClassName ||
        'w-full bg-[#111213] border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#0ECCEE]';

    return (
        <div className="space-y-4 rounded-xl border border-gray-700 bg-[#1D1E20] p-4">
            <div>
                <label className="block text-sm font-semibold text-gray-200 mb-1">
                    Registration fee (₹ per person)
                </label>
                <p className="text-[11px] text-gray-500 mb-2">
                    What each person pays for the trek. This is the ticket price shown at checkout.
                </p>
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={fee > 0 ? fee : ''}
                    onChange={(e) => {
                        const raw = e.target.value;
                        onRegistrationFeeChange(raw === '' ? 0 : sanitizeTrekRegistrationFee(raw));
                    }}
                    className={inp}
                    placeholder="e.g. 3500 — leave empty for Free"
                />
            </div>

            <div>
                <p className="text-sm font-semibold text-gray-200">Platform fee (%)</p>
                <p className="text-[11px] text-gray-500 mt-0.5 mb-2">
                    Extra % added on top at checkout (on total trek fee). e.g. 3% on ₹7,000 = ₹210 platform fee.
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
                    Trek fee: <span className="text-white font-medium">{formatTrekPerPersonFee(fee)}</span>
                    {fee > 0 ? (
                        <span className="text-gray-500"> · Platform fee: {platformPct}%</span>
                    ) : null}
                </p>
                {fee > 0 ? (
                    <p>
                        Example checkout ({samplePeople} people):{' '}
                        <span className="text-[#0ECCEE] font-medium">
                            ₹{sampleTotal.toLocaleString('en-IN')}
                        </span>
                        {' '}(₹{sampleBase.toLocaleString('en-IN')} trek + ₹{samplePlatform} platform fee)
                    </p>
                ) : (
                    <p>No payment at checkout — booking is free.</p>
                )}
            </div>
        </div>
    );
}
