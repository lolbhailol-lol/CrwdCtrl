import { Route } from 'react-router-dom';
import ConnectionStatus from '../../components/ConnectionStatus';
import {
  Dashboard,
  Booking,
  CulturalFestPage,
  TechFestPage,
  SportsFestPage,
  SportsCategoryPage,
  ViewDetailsPage,
  FavoritesPage,
  EditProfile,
  HelpCenter,
  ListYourFest,
  NotificationsPanel,
  ProfilePage,
  CrwdCtrlLogin,
  CrwdCtrlRegister,
  EmailVerification,
  CompetitionsViewDetails,
  CompetitionListPage,
  TermsAndConditions,
  PrivacyPolicy,
  ContactUs,
  RefundsAndCancellations,
  DeleteAccount,
  ProductsAndServices,
  About,
  FestsPage,
  FestRegistration,
  CompetitionRegistration,
  RegistrationDetails,
  TrekDetailPage,
  TrekBookingPage,
  QRTicketPage,
  PaymentInvoicePage,
  PublicTreksPage,
  PublicEventsPage,
  EventDetailsPage,
  EventRegistrationPage,
  CommunityDetailPage,
  RunClubDetailPage,
  RunEventDetailPage,
  RunEventBookingPage,
  TrekCategoryPage,
  PaymentCheckoutPage,
} from './lazyPages';
import FestStallInterestPage from '../../pages/stall/FestStallInterestPage';
import {
  paymentReturnRedirect,
  dashboardRedirect,
  theatreRedirect,
  registeredFestRedirect,
} from './redirects';

export const publicRoutes = (
  <>
      <Route path="/stall/:festSlugOrId" element={<FestStallInterestPage />} />
      <Route path="/s/:festSlugOrId" element={<FestStallInterestPage />} />
      <Route path="/payment/checkout" element={<PaymentCheckoutPage />} />
      {paymentReturnRedirect}
      <Route path="/" element={<Dashboard />} />
      {dashboardRedirect}
      <Route path="/login" element={<CrwdCtrlLogin />} />
      <Route path="/admin/login" element={<CrwdCtrlLogin />} />
      <Route path="/register" element={<CrwdCtrlRegister />} />
      <Route path="/verify-email" element={<EmailVerification />} />
      <Route path="/fests" element={<FestsPage />} />
      <Route path="/cultural-fest" element={<CulturalFestPage />} />
      <Route path="/tech-fest" element={<TechFestPage />} />
      <Route path="/sports" element={<SportsCategoryPage />} />
      <Route path="/sports-fest" element={<SportsFestPage />} />
      <Route path="/treks" element={<PublicTreksPage />} />
      <Route path="/events" element={<PublicEventsPage />} />
      <Route path="/events/:eventId" element={<EventDetailsPage />} />
      <Route path="/events/:eventId/register" element={<EventRegistrationPage />} />
      {theatreRedirect}
      <Route path="/treks/community/:id" element={<CommunityDetailPage />} />
      <Route path="/sports/run-club/:id" element={<RunClubDetailPage />} />
      <Route path="/sports/run/:id" element={<RunEventDetailPage />} />
      <Route path="/sports/run/:id/book" element={<RunEventBookingPage />} />
      <Route path="/treks/category/:category" element={<TrekCategoryPage />} />
      <Route path="/trek/:id" element={<TrekDetailPage />} />
      <Route path="/trek/:id/book" element={<TrekBookingPage />} />
      <Route path="/favorites" element={<FavoritesPage />} />
      <Route path="/view-details/:eventId" element={<ViewDetailsPage />} />
      <Route path="/view-details" element={<ViewDetailsPage />} />
      <Route path="/competitions-view-details/:competitionId" element={<CompetitionsViewDetails />} />
      <Route path="/competitions-view-details" element={<CompetitionsViewDetails />} />
      <Route path="/competition-list/:eventId" element={<CompetitionListPage />} />
      <Route path="/competition-register" element={<CompetitionRegistration />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/edit-profile" element={<EditProfile />} />
      <Route path="/booking" element={<Booking />} />
      {registeredFestRedirect}
      <Route path="/help-center" element={<HelpCenter />} />
      <Route path="/list-your-fest" element={<ListYourFest />} />
      <Route path="/notifications" element={<NotificationsPanel />} />
      <Route path="/connection-status" element={<ConnectionStatus />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/contact-us" element={<ContactUs />} />
      <Route path="/refunds-and-cancellations" element={<RefundsAndCancellations />} />
      <Route path="/delete-account" element={<DeleteAccount />} />
      <Route path="/products-and-services" element={<ProductsAndServices />} />
      <Route path="/about" element={<About />} />
      <Route path="/fest/:festId/register" element={<FestRegistration />} />
      <Route path="/competition-registration/:competitionId" element={<CompetitionRegistration />} />
      <Route path="/registration-details/:registrationId" element={<RegistrationDetails />} />
      <Route path="/qr-ticket/:registrationId" element={<QRTicketPage />} />
      <Route path="/payment-invoice/:id" element={<PaymentInvoicePage />} />
  </>
);
