import { useIsLgUp } from '../../hooks/useHomeCarousel';
import PrivacyPolicyDesktop from './PrivacyPolicyDesktop';
import PrivacyPolicyMobile from './PrivacyPolicyMobile';

export default function PrivacyPolicy(props) {
    return useIsLgUp() ? <PrivacyPolicyDesktop {...props} /> : <PrivacyPolicyMobile {...props} />;
}
