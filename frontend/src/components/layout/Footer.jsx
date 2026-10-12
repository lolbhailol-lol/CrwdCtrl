import { useIsLgUp } from '../../hooks/useHomeCarousel';
import FooterDesktop from './FooterDesktop';
import FooterMobile from './FooterMobile';

export default function Footer(props) {
    return useIsLgUp() ? <FooterDesktop {...props} /> : <FooterMobile {...props} />;
}
