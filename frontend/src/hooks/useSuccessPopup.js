import { useEffect, useRef } from 'react';
import { showBookingConfirmedPopup } from '../utils/appPopup';

/** Fire a global success popup once when a booking/registration succeeds. */
export function useBookingSuccessPopup(showSuccess, { name, paid = false, bookingId, ticketType, ticketQuery } = {}) {
    const shownRef = useRef(false);

    useEffect(() => {
        if (!showSuccess || shownRef.current) return;
        shownRef.current = true;

        const qs = ticketQuery || (ticketType ? `type=${ticketType}` : '');
        const link = bookingId
            ? `/qr-ticket/${bookingId}${qs ? `?${qs}` : ''}`
            : '/booking';

        showBookingConfirmedPopup({ name, paid, link });
    }, [showSuccess, name, paid, bookingId, ticketType, ticketQuery]);
}

export function useRegistrationSuccessPopup(showSuccess, { name, link = '/booking', paid = false } = {}) {
    const shownRef = useRef(false);

    useEffect(() => {
        if (!showSuccess || shownRef.current) return;
        shownRef.current = true;
        showBookingConfirmedPopup({ name, paid, link });
    }, [showSuccess, name, link, paid]);
}
