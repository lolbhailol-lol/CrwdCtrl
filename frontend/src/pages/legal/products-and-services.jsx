import { useIsLgUp } from '../../hooks/useHomeCarousel';
import ProductsAndServicesDesktop from './ProductsAndServicesDesktop';
import ProductsAndServicesMobile from './ProductsAndServicesMobile';

export default function ProductsAndServices(props) {
    return useIsLgUp() ? <ProductsAndServicesDesktop {...props} /> : <ProductsAndServicesMobile {...props} />;
}
