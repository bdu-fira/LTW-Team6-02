import React, { createContext, useContext, useState, useEffect } from 'react';
import { GlobalProgressBar } from './components/Loader';

const LoadingContext = createContext();

export const useLoading = () => useContext(LoadingContext);

export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    // Simulate progress when isLoading is true
    useEffect(() => {
        let interval;
        if (isLoading) {
            setProgress(10);
            interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 90) return prev;
                    return prev + Math.random() * 10;
                });
            }, 200);
        } else {
            if (progress > 0) {
                setProgress(100);
                setTimeout(() => {
                    setProgress(0);
                }, 400);
            }
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    const startLoading = () => setIsLoading(true);
    const stopLoading = () => setIsLoading(false);

    return (
        <LoadingContext.Provider value={{ isLoading, startLoading, stopLoading }}>
            <GlobalProgressBar progress={progress} />
            {children}
        </LoadingContext.Provider>
    );
};
