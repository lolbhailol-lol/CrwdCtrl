import { CheckCircle, ImagePlus, Loader } from 'lucide-react';

/**
 * MindSpark-style UPI + QR payment block for run bookings.
 * Amount first → coupon → scan/pay → proof + txn ID.
 */
export default function RunQrPaymentPanel({
    isDark,
    payableAmount,
    baseFee,
    chargePerPerson,
    people,
    couponInfo,
    couponCode,
    couponLoading,
    couponError,
    couponJustApplied,
    onCouponCodeChange,
    onApplyCoupon,
    onClearCoupon,
    paymentQR,
    paymentUpiId,
    paymentQRMessage,
    qrAutoConfirm,
    upiCopied,
    onCopyUpi,
    paymentScreenshotUrl,
    uploadingProof,
    onUploadScreenshot,
    onRemoveScreenshot,
    transactionId,
    onTransactionIdChange,
}) {
    const couponApplied = Boolean(couponInfo?.couponApplied);
    const saved = Number(couponInfo?.discountAmount) || 0;
    const showPaySteps = payableAmount > 0;

    const cardBorder = isDark ? 'border-gray-700/60' : 'border-gray-200';
    const cardBg = isDark ? 'bg-[#111213]' : 'bg-white shadow-sm';

    return (
        <div className={`rounded-2xl overflow-hidden border ${cardBorder} ${cardBg}`}>
            {/* Amount payable — MindSpark pattern */}
            <div className={`px-4 py-4 sm:px-5 ${isDark ? 'bg-linear-to-br from-[#0ECCEE]/10 to-transparent' : 'bg-linear-to-br from-cyan-50 to-white'}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Amount to pay
                </p>
                <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                    <span className="text-3xl sm:text-4xl font-bold tabular-nums text-[#0ECCEE]">
                        ₹{payableAmount.toLocaleString('en-IN')}
                    </span>
                    {couponApplied && saved > 0 ? (
                        <span className={`text-xs font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                            −₹{saved.toLocaleString('en-IN')} saved
                        </span>
                    ) : null}
                </div>
                <p className={`text-[11px] mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {couponApplied && baseFee > payableAmount
                        ? `Was ₹${Number(couponInfo?.amountBeforeDiscount ?? baseFee).toLocaleString('en-IN')}`
                        : people > 1
                            ? `₹${chargePerPerson.toLocaleString('en-IN')} × ${people} people`
                            : '1 person'}
                    {qrAutoConfirm ? ' · Confirms when you submit' : ' · Club approves after you submit'}
                </p>
            </div>

            {/* Coupon */}
            <div className={`px-4 py-3 sm:px-5 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                <p className={`text-[11px] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Have a coupon?</p>
                {couponApplied ? (
                    <div className={`rounded-xl px-3.5 py-3 flex items-center gap-3 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/25' : 'bg-green-50 border border-green-200'}`}>
                        <div className={`shrink-0 size-9 rounded-full flex items-center justify-center ${isDark ? 'bg-emerald-400/20 text-emerald-300' : 'bg-emerald-100 text-emerald-600'}`}>
                            <CheckCircle size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className={`text-sm font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                {couponInfo.couponCode} applied
                            </p>
                            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-emerald-200/70' : 'text-emerald-800/80'}`}>
                                You save ₹{saved.toLocaleString('en-IN')}
                                {payableAmount === 0 ? ' · No UPI needed' : ''}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClearCoupon}
                            className={`text-[11px] font-semibold shrink-0 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            Change
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex gap-2">
                            <input
                                value={couponCode}
                                onChange={(e) => onCouponCodeChange(e.target.value.toUpperCase())}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        onApplyCoupon();
                                    }
                                }}
                                placeholder="Enter code"
                                autoComplete="off"
                                className={`flex-1 min-w-0 px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-[#0ECCEE] ${
                                    isDark
                                        ? 'bg-[#1D1E20] border-gray-700 text-white placeholder:text-gray-600'
                                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
                                }`}
                            />
                            <button
                                type="button"
                                onClick={onApplyCoupon}
                                disabled={couponLoading || !couponCode.trim()}
                                className="shrink-0 px-4 py-2.5 rounded-lg bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-50"
                            >
                                {couponLoading ? '…' : 'Apply'}
                            </button>
                        </div>
                        {couponError ? <p className="text-xs text-red-400 mt-1.5">{couponError}</p> : null}
                    </>
                )}
            </div>

            {showPaySteps ? (
                <>
                    {/* QR + UPI */}
                    <div className={`px-4 py-4 border-t flex gap-4 items-start ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                        {paymentQR ? (
                            <div className="shrink-0 size-[140px] sm:size-[152px] rounded-xl bg-white p-2 shadow-sm">
                                <img src={paymentQR} alt="Scan to pay" className="size-full object-contain" />
                            </div>
                        ) : (
                            <div className={`shrink-0 size-[140px] rounded-xl flex items-center justify-center text-[10px] text-center px-2 ${isDark ? 'bg-gray-800 text-red-400' : 'bg-gray-100 text-red-500'}`}>
                                QR not set
                            </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                            <p className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                1. Scan QR or pay on UPI
                            </p>
                            <p className={`text-[11px] leading-snug ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                Pay exactly ₹{payableAmount.toLocaleString('en-IN')}, then add proof below.
                            </p>
                            {paymentUpiId ? (
                                <button
                                    type="button"
                                    onClick={onCopyUpi}
                                    className={`w-full flex items-center justify-between gap-2 h-10 px-3 rounded-lg text-left ${
                                        isDark ? 'bg-[#0E0E0F] border border-gray-700' : 'bg-gray-50 border border-gray-200'
                                    }`}
                                >
                                    <span className={`text-xs font-mono truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                        {paymentUpiId}
                                    </span>
                                    <span className="text-xs font-bold text-[#0ECCEE] shrink-0">
                                        {upiCopied ? 'Copied' : 'Copy UPI'}
                                    </span>
                                </button>
                            ) : null}
                            {paymentQRMessage ? (
                                <p className={`text-[11px] leading-snug ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {paymentQRMessage}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    {/* Screenshot */}
                    <div className={`border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                        <label
                            className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer ${
                                uploadingProof ? 'opacity-60 pointer-events-none' : ''
                            } ${isDark ? 'active:bg-white/3' : 'active:bg-gray-50'}`}
                        >
                            {paymentScreenshotUrl ? (
                                <img src={paymentScreenshotUrl} alt="" className="size-12 rounded-lg object-cover shrink-0 border border-gray-700" />
                            ) : (
                                <div className={`size-12 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-[#0E0E0F] border border-gray-700' : 'bg-gray-100 border border-gray-200'}`}>
                                    {uploadingProof
                                        ? <Loader className="w-5 h-5 animate-spin text-[#0ECCEE]" />
                                        : <ImagePlus size={20} className="text-[#0ECCEE]" />}
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    2. Payment screenshot
                                </p>
                                <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {uploadingProof
                                        ? 'Uploading…'
                                        : paymentScreenshotUrl
                                            ? 'Tap to change'
                                            : 'Gallery or camera'}
                                </p>
                            </div>
                            {paymentScreenshotUrl ? (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onRemoveScreenshot();
                                    }}
                                    className={`text-[11px] font-medium shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                                >
                                    Remove
                                </button>
                            ) : (
                                <span className="text-xs font-semibold text-[#0ECCEE] shrink-0">Add</span>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                disabled={uploadingProof}
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    onUploadScreenshot(file);
                                }}
                            />
                        </label>

                        {/* Transaction ID */}
                        <div className={`mx-4 mb-4 pt-1 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                            <label htmlFor="run-upi-txn-id" className={`block text-sm font-medium mt-3 mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                3. UTR / transaction ID
                            </label>
                            <p className={`text-[11px] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                Paste the 12-digit (or longer) ID from your UPI app — helps the club verify faster.
                            </p>
                            <input
                                id="run-upi-txn-id"
                                value={transactionId}
                                onChange={(e) => onTransactionIdChange(e.target.value.replace(/\s+/g, ''))}
                                required
                                minLength={4}
                                autoComplete="off"
                                inputMode="text"
                                className={`w-full h-11 px-3 rounded-xl border text-sm font-mono tracking-wide focus:outline-none focus:border-[#0ECCEE] focus:ring-1 focus:ring-[#0ECCEE]/30 ${
                                    isDark
                                        ? 'bg-[#0E0E0F] border-gray-700 text-white placeholder-gray-600'
                                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                                }`}
                                placeholder="e.g. 123456789012"
                            />
                        </div>
                    </div>
                </>
            ) : (
                <div className={`px-4 py-4 border-t text-sm ${isDark ? 'border-gray-800 text-gray-400' : 'border-gray-100 text-gray-600'}`}>
                    Coupon covers the full fee — tap confirm below. No UPI payment needed.
                </div>
            )}
        </div>
    );
}
