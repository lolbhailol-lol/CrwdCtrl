import { useIsLgUp } from '../../hooks/useHomeCarousel';
import RefundsAndCancellationsDesktop from './RefundsAndCancellationsDesktop';
import RefundsAndCancellationsMobile from './RefundsAndCancellationsMobile';

export default function RefundsAndCancellations(props) {
    return useIsLgUp() ? <RefundsAndCancellationsDesktop {...props} /> : <RefundsAndCancellationsMobile {...props} />;
}
