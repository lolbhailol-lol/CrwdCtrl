import { useIsLgUp } from '../../hooks/useHomeCarousel';
import ShippingPolicyDesktop from './ShippingPolicyDesktop';
import ShippingPolicyMobile from './ShippingPolicyMobile';

export default function ShippingPolicy(props) {
    return useIsLgUp() ? <ShippingPolicyDesktop {...props} /> : <ShippingPolicyMobile {...props} />;
}
