import { useIsLgUp } from '../../hooks/useHomeCarousel';
import AboutDesktop from './AboutDesktop';
import AboutMobile from './AboutMobile';

export default function About(props) {
    return useIsLgUp() ? <AboutDesktop {...props} /> : <AboutMobile {...props} />;
}
