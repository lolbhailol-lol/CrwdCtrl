import React, { useState, useEffect } from 'react';
import LoadingBar from './LoadingBar';

const withPageLoading = (WrappedComponent, { 
    loadingMessage = "Loading page...", 
    minLoadingTime = 200,
    showPoweredBy = true 
} = {}) => {
    return function WithPageLoadingComponent(props) {
        const [isLoading, setIsLoading] = useState(true);
        const [startTime] = useState(Date.now());

        useEffect(() => {
            const handlePageLoad = () => {
                const elapsedTime = Date.now() - startTime;
                const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

                // Ensure minimum loading time for better UX
                setTimeout(() => {
                    setIsLoading(false);
                }, remainingTime);
            };

            // If document is already loaded
            if (document.readyState === 'complete') {
                handlePageLoad();
            } else {
                // Wait for page to load
                window.addEventListener('load', handlePageLoad);
                
                // Fallback timeout
                const fallbackTimer = setTimeout(handlePageLoad, 3000);
                
                return () => {
                    window.removeEventListener('load', handlePageLoad);
                    clearTimeout(fallbackTimer);
                };
            }
        }, [startTime]);

        if (isLoading) {
            return (
                <LoadingBar 
                    message={loadingMessage} 
                    showPoweredBy={showPoweredBy}
                />
            );
        }

        return <WrappedComponent {...props} />;
    };
};

export default withPageLoading;