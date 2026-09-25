import { Suspense } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { PaymentReturn } from './lazyPages';

export const paymentReturnRedirect = (
  <Route
    path="/payment/return"
    element={(
      <Suspense fallback={null}>
        <PaymentReturn />
      </Suspense>
    )}
  />
);
export const dashboardRedirect = <Route path="/dashboard" element={<Navigate to="/" replace />} />;
export const theatreRedirect = <Route path="/theatre" element={<Navigate to="/events" replace />} />;
export const registeredFestRedirect = <Route path="/registered-fest" element={<Navigate to="/booking" replace />} />;
export const adminTheatreRedirect = <Route path="theatre" element={<Navigate to="/admin/events" replace />} />;

/** MindSpark-only short links (separate from generic fest/organizer paths). */
export const mindsparkRedirects = (
  <>
    <Route path="/mindspark" element={<Navigate to="/view-details/mindspark-2026" replace />} />
    <Route path="/mindspark/" element={<Navigate to="/view-details/mindspark-2026" replace />} />
    <Route
      path="/mindspark/organizer"
      element={<Navigate to="/fest-organizer/fests/6a7f1010ed26d983b34e55c2" replace />}
    />
    <Route path="/mindspark/payments" element={<Navigate to="/mindspark-payments" replace />} />
  </>
);
