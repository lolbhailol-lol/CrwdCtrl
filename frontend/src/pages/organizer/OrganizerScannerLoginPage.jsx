import { useIsLgUp } from '../../hooks/useHomeCarousel';
import OrganizerScannerLoginPageDesktop from './OrganizerScannerLoginPageDesktop';
import OrganizerScannerLoginPageMobile from './OrganizerScannerLoginPageMobile';

export default function OrganizerScannerLoginPage(props) {
    return useIsLgUp() ? <OrganizerScannerLoginPageDesktop {...props} /> : <OrganizerScannerLoginPageMobile {...props} />;
}
