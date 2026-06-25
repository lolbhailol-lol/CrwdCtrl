import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, ListChecks, Clock, ShieldCheck, Mail, Loader2 } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { authService } from '../../services/authService';
import Seo from '../../components/Seo';
import { breadcrumbSchema, webPageSchema } from '../../utils/seo';

export default function DeleteAccount() {
  const { isDark } = useDarkMode();
  const { isAuthenticated, token, logout } = useAuth();
  const { confirm, toast } = useDialog();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const card = isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200';

  const handleDeleteAccount = async () => {
    const confirmed = await confirm({
      title: 'Delete your account?',
      message:
        'This permanently deactivates your account and removes your profile data. Your booking records are kept as required by law. This cannot be undone.',
      confirmText: 'Delete account',
      cancelText: 'Keep account',
      tone: 'danger',
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      await authService.deleteAccount(token);
      await logout();
      toast('Your account has been deleted.');
      navigate('/', { replace: true });
    } catch (err) {
      toast(err?.message || 'Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300">
      <Seo
        title="Delete Your Account"
        description="Learn how to request deletion of your CrwdCtrl account and associated personal data, what is removed, what is retained, and how long it takes."
        canonical="/delete-account"
        jsonLd={[
          webPageSchema({ name: 'Delete Your CrwdCtrl Account', url: '/delete-account' }),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Delete Account', path: '/delete-account' },
          ]),
        ]}
      />
      <div className={`crwdctrl-sticky-header ${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center relative">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className={`lg:hidden absolute left-0 p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} transition-colors`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h1 className="text-xl font-bold">Delete Your Account</h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                CrwdCtrl account &amp; data deletion
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className={`${card} border rounded-lg p-6`}>
          <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            This page explains how to request deletion of your CrwdCtrl account and the personal data
            associated with it. CrwdCtrl is operated at{' '}
            <a href="https://www.crwdctrl.in" className="text-blue-500 underline">
              www.crwdctrl.in
            </a>
            . You can request deletion at any time using the steps below.
          </p>
        </div>

        {isAuthenticated && (
          <div className={`${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'} border rounded-lg p-6`}>
            <div className="flex items-center gap-3 mb-3">
              <Trash2 className="w-6 h-6 text-red-500" />
              <h2 className="text-lg font-semibold">Delete account now</h2>
            </div>
            <p className={`text-sm mb-4 ${isDark ? 'text-red-200' : 'text-red-800'}`}>
              You&apos;re signed in. You can delete your account instantly from here. This deactivates your
              account, removes your profile data, and signs you out. Booking records are retained as
              described below.
            </p>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete my account
                </>
              )}
            </button>
          </div>
        )}

        <div className={`${card} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <ListChecks className="w-6 h-6 text-blue-500" />
            <h2 className="text-lg font-semibold">{isAuthenticated ? 'Prefer to request by email?' : 'How to request deletion'}</h2>
          </div>
          <ol className={`list-decimal pl-5 space-y-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <li>
              Email us at{' '}
              <a href="mailto:crwdctrl.in@gmail.com?subject=Delete%20my%20CrwdCtrl%20account" className="text-blue-500 underline font-medium">
                crwdctrl.in@gmail.com
              </a>{' '}
              from the email address registered with your account, with the subject{' '}
              <strong>&quot;Delete my CrwdCtrl account&quot;</strong>.
            </li>
            <li>
              Include your registered <strong>name</strong> and <strong>email/phone number</strong> so we can
              verify the account.
            </li>
            <li>
              We verify your identity and process the request. You will receive a confirmation once your
              account and associated data have been deleted.
            </li>
          </ol>
        </div>

        <div className={`${card} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
            <h2 className="text-lg font-semibold">What gets deleted</h2>
          </div>
          <ul className={`list-disc pl-5 space-y-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <li>Your account profile — name, email address, phone number, college/institution, and profile photo</li>
            <li>Your saved/favourite events and in-app preferences</li>
            <li>Authentication data linked to your account (including Google sign-in association)</li>
          </ul>
        </div>

        <div className={`${card} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
            <h2 className="text-lg font-semibold">What may be retained</h2>
          </div>
          <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Certain records must be kept to meet legal, accounting, tax, and fraud-prevention
            obligations, or to honour event organizers&apos; records:
          </p>
          <ul className={`list-disc pl-5 space-y-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <li>
              Transaction and payment records for completed registrations (handled by our payment partner
              Cashfree) are retained for up to <strong>7 years</strong> as required by law.
            </li>
            <li>
              Records needed to resolve disputes or enforce our terms may be retained for the duration
              required, then deleted.
            </li>
          </ul>
        </div>

        <div className={`${card} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-blue-500" />
            <h2 className="text-lg font-semibold">How long it takes</h2>
          </div>
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            We acknowledge deletion requests within <strong>2–3 business days</strong> and complete
            deletion of your account and associated data (except records we are legally required to
            retain, as described above) within <strong>30 days</strong>.
          </p>
        </div>

        <div className={`${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-3">
            <Mail className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Contact us</h2>
          </div>
          <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
            Email:{' '}
            <a href="mailto:crwdctrl.in@gmail.com?subject=Delete%20my%20CrwdCtrl%20account" className="underline font-medium">
              crwdctrl.in@gmail.com
            </a>
          </p>
          <p className={`text-sm mt-2 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
            Or visit our{' '}
            <Link to="/contact-us" className="underline font-medium">
              Contact Us
            </Link>{' '}
            page.
          </p>
        </div>
      </div>
    </div>
  );
}
