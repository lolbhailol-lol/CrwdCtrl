import { useIsLgUp } from '../../hooks/useHomeCarousel';
import ContactUsDesktop from './ContactUsDesktop';
import ContactUsMobile from './ContactUsMobile';

export default function ContactUs(props) {
    return useIsLgUp() ? <ContactUsDesktop {...props} /> : <ContactUsMobile {...props} />;
}
