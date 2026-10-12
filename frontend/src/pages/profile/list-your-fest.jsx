import { useIsLgUp } from '../../hooks/useHomeCarousel';
import ListYourFestDesktop from './ListYourFestDesktop';
import ListYourFestMobile from './ListYourFestMobile';

export default function ListYourFest(props) {
    return useIsLgUp() ? <ListYourFestDesktop {...props} /> : <ListYourFestMobile {...props} />;
}
