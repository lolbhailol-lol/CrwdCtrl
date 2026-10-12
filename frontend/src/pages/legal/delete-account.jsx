import { useIsLgUp } from '../../hooks/useHomeCarousel';
import DeleteAccountDesktop from './DeleteAccountDesktop';
import DeleteAccountMobile from './DeleteAccountMobile';

export default function DeleteAccount(props) {
    return useIsLgUp() ? <DeleteAccountDesktop {...props} /> : <DeleteAccountMobile {...props} />;
}
