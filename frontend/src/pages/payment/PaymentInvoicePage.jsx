import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Receipt, Download } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';

import { API_BASE_URL } from '../../services/api/client';
const getToken = () => localStorage.getItem('crwdctrl_token');

const formatAmount = (amount) =>
  `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PaymentInvoicePage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isTrek = searchParams.get('type') === 'trek';
  const { isDark } = useDarkMode();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const token = getToken();
        const url = isTrek
          ? `${API_BASE_URL}/registrations/trek-booking/${id}/invoice`
          : `${API_BASE_URL}/registrations/invoice/${id}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load payment receipt');
        setInvoice(data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id, isTrek]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading receipt...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Receipt not found'}</p>
          <Link to="/booking" className="text-[#0ECCEE] hover:underline">
            Back to Bookings
          </Link>
        </div>
      </div>
    );
  }

  const rows = [
    { label: 'Event', value: invoice.eventName },
    ...(invoice.festName && invoice.eventType === 'Competition'
      ? [{ label: 'Fest', value: invoice.festName }]
      : []),
    { label: 'Type', value: invoice.eventType },
    ...(invoice.eventDate ? [{ label: 'Event Date', value: invoice.eventDate }] : []),
    ...(invoice.venue ? [{ label: 'Venue', value: invoice.venue }] : []),
    ...(invoice.people > 1 ? [{ label: 'People', value: String(invoice.people) }] : []),
    { label: 'Amount Paid', value: formatAmount(invoice.amountPaid), highlight: true },
    { label: 'Payment Date', value: invoice.paidAtFormatted },
    { label: 'Order ID', value: invoice.orderId, mono: true },
    ...(invoice.paymentId ? [{ label: 'Payment ID', value: invoice.paymentId, mono: true }] : []),
    { label: 'Gateway', value: (invoice.paymentGateway || 'cashfree').toUpperCase() },
  ];

  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen py-8 px-4 print:py-0 print:px-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #payment-invoice-print, #payment-invoice-print * { visibility: visible; }
          #payment-invoice-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-md mx-auto">
        <Link
          to="/booking"
          className={`no-print inline-flex items-center gap-1.5 mb-6 text-sm transition-colors ${
            isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ArrowLeft size={16} />
          Back to Bookings
        </Link>

        <div
          id="payment-invoice-print"
          className={`rounded-2xl border overflow-hidden ${
            isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          <div className="bg-linear-to-r from-[#0ECCEE]/20 to-[#0ECCEE]/5 px-6 py-4 border-b border-gray-800/50">
            <div className="flex items-center gap-2 text-[#0ECCEE] mb-1">
              <Receipt size={18} />
              <span className="text-sm font-semibold uppercase tracking-wide">Payment Receipt</span>
            </div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>CrwdCtrl</h1>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Receipt #{String(invoice.invoiceNumber).slice(-12)}
            </p>
          </div>

          <div className="px-6 py-4 border-b border-gray-800/50">
            <p className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Billed to
            </p>
            <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{invoice.customerName}</p>
            {invoice.customerEmail && (
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{invoice.customerEmail}</p>
            )}
            {invoice.customerPhone && (
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{invoice.customerPhone}</p>
            )}
          </div>

          <div className="px-6 py-4 space-y-3">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4 text-sm">
                <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>{row.label}</span>
                <span
                  className={`text-right shrink-0 ${
                    row.highlight
                      ? 'text-[#0ECCEE] font-bold text-base'
                      : row.mono
                        ? `font-mono text-xs ${isDark ? 'text-gray-300' : 'text-gray-800'}`
                        : isDark
                          ? 'text-white font-medium'
                          : 'text-gray-900 font-medium'
                  }`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className={`px-6 py-3 border-t text-center ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
            <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
              This is a payment confirmation receipt for your online booking on CrwdCtrl.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="no-print mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
        >
          <Download size={18} />
          Download / Print Receipt
        </button>
      </div>
    </div>
  );
}
