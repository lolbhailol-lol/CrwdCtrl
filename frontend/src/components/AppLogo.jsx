import markLogo from '../assets/crwdctrl-mark.png';
import { LOGO_SOURCE_PX } from '../constants/logo';

/** Unified ctrl. mark — 500×500 source; header size from CSS, optional `size` override */
export default function AppLogo({ className = '', size, onClick, ...props }) {
    const sizeStyle = size
        ? { width: size, height: size, maxWidth: size, maxHeight: size }
        : undefined;

    return (
        <img
            src={markLogo}
            alt="CrwdCtrl"
            width={LOGO_SOURCE_PX}
            height={LOGO_SOURCE_PX}
            style={sizeStyle}
            className={`app-logo-mark${className ? ` ${className}` : ''}`}
            draggable={false}
            decoding="sync"
            onClick={onClick}
            {...props}
        />
    );
}
