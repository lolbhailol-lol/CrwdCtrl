import { useIsLgUp } from '../../../hooks/useHomeCarousel';
import RunClubDetailPageDesktop from './RunClubDetailPageDesktop';
import RunClubDetailPageMobile from './RunClubDetailPageMobile';

export default function RunClubDetailPage(props) {
    return useIsLgUp() ? <RunClubDetailPageDesktop {...props} /> : <RunClubDetailPageMobile {...props} />;
}
