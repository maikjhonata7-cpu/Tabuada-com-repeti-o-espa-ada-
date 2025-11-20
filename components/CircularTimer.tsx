import React, { useEffect, useState } from 'react';

interface CircularTimerProps {
  duration: number; // seconds
  isPlaying: boolean;
  onTimeUp: () => void;
  resetKey: string; // Change this to reset timer
}

const CircularTimer: React.FC<CircularTimerProps> = ({ duration, isPlaying, onTimeUp, resetKey }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  
  const radius = 24; // Slightly smaller radius to match header sizing better
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / duration) * circumference;

  useEffect(() => {
    setTimeLeft(duration);
  }, [resetKey, duration]);

  useEffect(() => {
    if (!isPlaying || timeLeft <= 0) {
        if (timeLeft <= 0 && isPlaying) {
            onTimeUp();
        }
        return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 0.1));
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, timeLeft, onTimeUp]);

  // Color logic: Green > Yellow > Red
  const getColor = () => {
    const percentage = timeLeft / duration;
    if (percentage > 0.5) return 'text-emerald-500'; 
    if (percentage > 0.2) return 'text-amber-400'; 
    return 'text-rose-500'; 
  };

  return (
    <div className="relative flex items-center justify-center">
      <svg className="transform -rotate-90 w-16 h-16">
        {/* Background Circle */}
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-slate-200" 
        />
        {/* Progress Circle */}
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-100 ease-linear ${getColor()}`}
        />
      </svg>
      <span className={`absolute text-sm font-bold ${getColor()}`}>
        {Math.ceil(timeLeft)}
      </span>
    </div>
  );
};

export default CircularTimer;