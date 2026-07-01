/**
 * Global in-app popup toasts for the website (login, booking, check-in, etc.).
 * Handled by NotificationsProvider via the `crwdctrl:app-popup` event.
 */

export function showAppPopup({
    title,
    message = '',
    tone = 'info',
    link = null,
    duration,
} = {}) {
    if (!title || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('crwdctrl:app-popup', {
        detail: { title, message, tone, link, duration },
    }));
}

export function showLoginPopup(message = 'You signed in to CrwdCtrl.') {
    showAppPopup({ title: 'Login successful', message, tone: 'login' });
}

export function showRegistrationConfirmedPopup({ name, link = '/booking' } = {}) {
    showAppPopup({
        title: 'Registration confirmed',
        message: name ? `Your booking for ${name} is confirmed.` : 'Your registration is confirmed.',
        tone: 'registration',
        link,
    });
}

export function showPaymentSuccessPopup({ name, link = '/booking' } = {}) {
    showAppPopup({
        title: 'Payment successful',
        message: name ? `Payment received for ${name}.` : 'Your payment was successful.',
        tone: 'payment',
        link,
    });
}

export function showCheckInPopup({ name, link = '/booking' } = {}) {
    showAppPopup({
        title: 'Checked in!',
        message: name ? `You've been checked in for ${name}.` : "You've been checked in.",
        tone: 'checkin',
        link,
    });
}

export function showBookingConfirmedPopup({ name, paid = false, link = '/booking' } = {}) {
    if (paid) {
        showPaymentSuccessPopup({ name, link });
        return;
    }
    showRegistrationConfirmedPopup({ name, link });
}

export function inferPopupTone({ title = '', type = '' } = {}) {
    const lower = title.toLowerCase();
    if (lower.includes('checked in') || lower.includes('check-in')) return 'checkin';
    if (type === 'registration' || lower.includes('confirmed') || lower.includes('booking')) return 'registration';
    if (lower.includes('payment') || lower.includes('paid')) return 'payment';
    if (lower.includes('login') || lower.includes('signed in')) return 'login';
    if (type === 'reminder') return 'reminder';
    if (type === 'announcement') return 'info';
    return 'info';
}
