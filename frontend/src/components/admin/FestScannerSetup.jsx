import ScannerSetupForm from './ScannerSetupForm';

export default function FestScannerSetup({ festId, festName }) {
  return (
    <ScannerSetupForm
      variant="fest"
      eventId={festId}
      eventName={festName}
      apiPath={`/admin/fests/${festId}/scanner-access`}
    />
  );
}
