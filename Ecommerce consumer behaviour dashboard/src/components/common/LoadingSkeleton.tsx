import React from "react";

interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className = "h-4 w-full" }: LoadingSkeletonProps) {
  return (
    <div 
      className={`bg-gray-200 animate-pulse rounded-md ${className}`}
      aria-hidden="true"
    />
  );
}
