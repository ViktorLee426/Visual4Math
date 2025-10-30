import { useState, useEffect } from 'react';

interface PageProgressProps {
  currentPage: number;
}

const pages = [
  { id: 1, name: 'Welcome', path: '/' },
  { id: 2, name: 'Consent Form', path: '/consent' },
  { id: 3, name: 'Background Survey', path: '/background' },
  { id: 4, name: 'Closed Task Instructions', path: '/closed-instructions' },
  { id: 5, name: 'Closed Task 1', path: '/closed-task/1' },
  { id: 6, name: 'Closed Task 2', path: '/closed-task/2' },
  { id: 7, name: 'Open Task Instructions', path: '/open-instructions' },
  { id: 8, name: 'Open Task 1', path: '/open-task/1' },
  { id: 9, name: 'Open Task 2', path: '/open-task/2' },
  { id: 10, name: 'Feedback Survey', path: '/final-survey' },
  { id: 11, name: 'Completion', path: '/completion' }
];

export default function PageProgress({ currentPage }: PageProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  
  useEffect(() => {
    const startTime = sessionStorage.getItem('sessionStartTime');
    
    if (!startTime) {
      const now = new Date().getTime();
      sessionStorage.setItem('sessionStartTime', now.toString());
    }
    
    const timer = setInterval(() => {
      const start = parseInt(sessionStorage.getItem('sessionStartTime') || new Date().getTime().toString());
      const now = new Date().getTime();
      const elapsed = Math.floor((now - start) / 1000);
      setElapsedTime(elapsed);
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Format elapsed time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };
  
  return (
    <div className="w-full flex justify-between items-start px-4 pt-4 text-sm">
      {/* Milestones */}
      <div className="text-gray-600 max-w-xs">
        <div className="font-medium mb-1">Study Progress:</div>
        <ul className="space-y-1">
          {pages.map((page) => (
            <li 
              key={page.id}
              className={`${currentPage === page.id 
                ? 'text-blue-600 font-semibold' 
                : 'text-gray-500'}`}
            >
              {page.id}. {page.name}
              {currentPage === page.id && <span className="ml-1">←</span>}
            </li>
          ))}
        </ul>
      </div>
      
      {/* Timer */}
      <div className="bg-gray-100 px-4 py-2 rounded-lg">
        <div className="text-gray-500 font-medium">Session Time</div>
        <div className="text-xl font-mono">{formatTime(elapsedTime)}</div>
      </div>
    </div>
  );
}
