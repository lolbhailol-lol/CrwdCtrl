import { useIsLgUp } from '../../../hooks/useHomeCarousel';
import EventCommunityDetailPageDesktop from './EventCommunityDetailPageDesktop';
import EventCommunityDetailPageMobile from './EventCommunityDetailPageMobile';

export default function EventCommunityDetailPage(props) {
    return useIsLgUp() ? <EventCommunityDetailPageDesktop {...props} /> : <EventCommunityDetailPageMobile {...props} />;
}
