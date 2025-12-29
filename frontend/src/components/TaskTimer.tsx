import { useState, useEffect } from 'react';

interface TaskTimerProps {
  startTime: number;
}

export default function TaskTimer({ startTime }: TaskTimerProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000); // elapsed time in seconds
      setElapsedTime(elapsed);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
      <span className="text-gray-500">Time:</span>
      <span className="font-mono">{formatTime(elapsedTime)}</span>
    </div>
  );
}

