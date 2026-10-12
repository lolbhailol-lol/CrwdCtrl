import { useIsLgUp } from '../../hooks/useHomeCarousel';
import TermsAndConditionsDesktop from './TermsAndConditionsDesktop';
import TermsAndConditionsMobile from './TermsAndConditionsMobile';

export default function TermsAndConditions(props) {
    return useIsLgUp() ? <TermsAndConditionsDesktop {...props} /> : <TermsAndConditionsMobile {...props} />;
}
