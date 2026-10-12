import { useIsLgUp } from '../../../hooks/useHomeCarousel';
import TrekDetailPageDesktop from './TrekDetailPageDesktop';
import TrekDetailPageMobile from './TrekDetailPageMobile';

export default function TrekDetailPage(props) {
    return useIsLgUp() ? <TrekDetailPageDesktop {...props} /> : <TrekDetailPageMobile {...props} />;
}
