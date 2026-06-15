import { Route, Navigate } from 'react-router-dom';

export const paymentReturnRedirect = <Route path="/payment/return" element={<Navigate to="/booking" replace />} />;
export const dashboardRedirect = <Route path="/dashboard" element={<Navigate to="/" replace />} />;
export const theatreRedirect = <Route path="/theatre" element={<Navigate to="/events" replace />} />;
export const registeredFestRedirect = <Route path="/registered-fest" element={<Navigate to="/booking" replace />} />;
export const adminTheatreRedirect = <Route path="theatre" element={<Navigate to="/admin/events" replace />} />;
