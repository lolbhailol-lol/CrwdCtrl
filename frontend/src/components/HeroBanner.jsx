import { useIsLgUp } from '../hooks/useHomeCarousel';
import HeroBannerDesktop from './HeroBannerDesktop';
import HeroBannerMobile from './HeroBannerMobile';

export default function HeroBanner(props) {
    return useIsLgUp() ? <HeroBannerDesktop {...props} /> : <HeroBannerMobile {...props} />;
}
