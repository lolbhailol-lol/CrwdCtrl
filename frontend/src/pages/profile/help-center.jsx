import { useIsLgUp } from '../../hooks/useHomeCarousel';
import HelpCenterDesktop from './HelpCenterDesktop';
import HelpCenterMobile from './HelpCenterMobile';

export default function HelpCenter(props) {
    return useIsLgUp() ? <HelpCenterDesktop {...props} /> : <HelpCenterMobile {...props} />;
}
