import { useIsLgUp } from '../../../hooks/useHomeCarousel';
import EventCommunityEventPageDesktop from './EventCommunityEventPageDesktop';
import EventCommunityEventPageMobile from './EventCommunityEventPageMobile';

export default function EventCommunityEventPage(props) {
    return useIsLgUp() ? <EventCommunityEventPageDesktop {...props} /> : <EventCommunityEventPageMobile {...props} />;
}
