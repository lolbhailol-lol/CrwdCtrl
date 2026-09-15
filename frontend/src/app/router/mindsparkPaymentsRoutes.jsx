import { Route } from 'react-router-dom';
import {
    MindSparkPaymentsLoginPage,
    MindSparkPaymentsProtectedRoute,
    MindSparkPaymentsPage,
} from './lazyPages';

export const mindsparkPaymentsRoutes = (
    <>
        <Route path="/mindspark-payments/login" element={<MindSparkPaymentsLoginPage />} />
        <Route
            path="/mindspark-payments"
            element={
                <MindSparkPaymentsProtectedRoute>
                    <MindSparkPaymentsPage />
                </MindSparkPaymentsProtectedRoute>
            }
        />
    </>
);
