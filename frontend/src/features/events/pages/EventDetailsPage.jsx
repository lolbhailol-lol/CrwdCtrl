import { useIsLgUp } from '../../../hooks/useHomeCarousel';
import EventDetailsPageDesktop from './EventDetailsPageDesktop';
import EventDetailsPageMobile from './EventDetailsPageMobile';

export default function EventDetailsPage(props) {
    return useIsLgUp() ? <EventDetailsPageDesktop {...props} /> : <EventDetailsPageMobile {...props} />;
}
