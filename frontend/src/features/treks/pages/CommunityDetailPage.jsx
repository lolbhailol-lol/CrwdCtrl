import { useIsLgUp } from '../../../hooks/useHomeCarousel';
import CommunityDetailPageDesktop from './CommunityDetailPageDesktop';
import CommunityDetailPageMobile from './CommunityDetailPageMobile';

export default function CommunityDetailPage(props) {
    return useIsLgUp() ? <CommunityDetailPageDesktop {...props} /> : <CommunityDetailPageMobile {...props} />;
}
