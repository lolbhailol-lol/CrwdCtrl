import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import MobileSearchOverlay from './MobileSearchOverlay';
import { useMobileSearch } from '../context/MobileSearchContext';

export default function MobileSearchHost() {
  const { session, closeSearch } = useMobileSearch();

  useEffect(() => {
    if (session) {
      document.body.classList.add('mobile-search-open');
    }
  }, [session]);

  const handleExitComplete = () => {
    document.body.classList.remove('mobile-search-open');
  };

  return (
    <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
      {session ? (
        <MobileSearchOverlay
          key={session.id}
          session={session}
          onClose={closeSearch}
        />
      ) : null}
    </AnimatePresence>
  );
}
