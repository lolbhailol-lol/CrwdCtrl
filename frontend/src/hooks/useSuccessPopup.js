import { useEffect, useRef } from 'react';
import { showBookingConfirmedPopup } from '../utils/appPopup';

/** Fire a global success popup once when a booking/registration succeeds. */
export function useBookingSuccessPopup(showSuccess, { name, paid = false, bookingId, ticketType } = {}) {
    const shownRef = useRef(false);

    useEffect(() => {
        if (!showSuccess || shownRef.current) return;
        shownRef.current = true;

        const link = bookingId
            ? `/qr-ticket/${bookingId}${ticketType ? `?type=${ticketType}` : ''}`
            : '/booking';

        showBookingConfirmedPopup({ name, paid, link });
    }, [showSuccess, name, paid, bookingId, ticketType]);
}

export function useRegistrationSuccessPopup(showSuccess, { name, link = '/booking', paid = false } = {}) {
    const shownRef = useRef(false);

    useEffect(() => {
        if (!showSuccess || shownRef.current) return;
        shownRef.current = true;
        showBookingConfirmedPopup({ name, paid, link });
    }, [showSuccess, name, link, paid]);
}
