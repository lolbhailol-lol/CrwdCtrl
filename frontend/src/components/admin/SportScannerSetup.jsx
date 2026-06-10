import ScannerSetupForm from './ScannerSetupForm';

export default function SportScannerSetup({ sportEventId, eventTitle }) {
  return (
    <ScannerSetupForm
      variant="sport"
      eventId={sportEventId}
      eventName={eventTitle}
      apiPath={`/admin/sports/${sportEventId}/scanner-access`}
    />
  );
}
