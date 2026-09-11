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
