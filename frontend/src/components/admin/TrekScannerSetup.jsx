import ScannerSetupForm from './ScannerSetupForm';

export default function TrekScannerSetup({ trekId, trekName }) {
  return (
    <ScannerSetupForm
      variant="trek"
      eventId={trekId}
      eventName={trekName}
      apiPath={`/admin/treks/${trekId}/scanner-access`}
    />
  );
}
