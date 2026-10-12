import { useIsLgUp } from '../../../../hooks/useHomeCarousel';
import CompetitionsViewDetailsDesktop from './CompetitionsViewDetailsDesktop';
import CompetitionsViewDetailsMobile from './CompetitionsViewDetailsMobile';

export default function CompetitionsViewDetails(props) {
    return useIsLgUp() ? <CompetitionsViewDetailsDesktop {...props} /> : <CompetitionsViewDetailsMobile {...props} />;
}
