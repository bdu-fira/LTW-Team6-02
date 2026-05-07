import React from 'react';

/**
 * Top Global Progress Bar Component
 */
export const GlobalProgressBar = ({ progress }) => {
    return (
        <div className="progress-bar-container">
            <div 
                className="progress-bar-fill" 
                style={{ 
                    width: `${progress}%`,
                    opacity: progress > 0 && progress < 100 ? 1 : 0
                }} 
            />
        </div>
    );
};

/**
 * Modern Spinner Component
 */
export const Spinner = ({ size = 'md', color = 'primary' }) => {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-8 h-8 border-3',
        lg: 'w-12 h-12 border-4'
    };

    const colorClasses = {
        primary: 'border-[#0f766e] border-t-transparent',
        white: 'border-white border-t-transparent',
        accent: 'border-amber-500 border-t-transparent'
    };

    return (
        <div className={`rounded-full animate-spin-soft ${sizeClasses[size]} ${colorClasses[color]}`} />
    );
};

/**
 * Skeleton Card for Properties
 */
export const SkeletonCard = () => {
    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-elegant flex flex-col h-full border border-neutral-100">
            <div className="w-full h-48 skeleton" />
            <div className="p-5 flex flex-col flex-grow gap-3">
                <div className="h-6 skeleton w-3/4 rounded" />
                <div className="h-4 skeleton w-1/2 rounded" />
                <div className="mt-auto pt-4 flex justify-between items-center">
                    <div className="h-4 skeleton w-1/4 rounded" />
                    <div className="h-6 skeleton w-1/3 rounded" />
                </div>
            </div>
        </div>
    );
};

/**
 * Full page loader with backdrop
 */
export const FullPageLoader = ({ message = 'Đang tải...' }) => {
    return (
        <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <Spinner size="lg" />
            <p className="mt-4 text-charcoal font-medium animate-pulse">{message}</p>
        </div>
    );
};
