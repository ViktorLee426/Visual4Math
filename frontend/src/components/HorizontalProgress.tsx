import { useState, useEffect } from 'react';

interface HorizontalProgressProps {
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

export default function HorizontalProgress({ currentPage }: HorizontalProgressProps) {
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
  
  const totalPages = pages.length;
  const progress = ((currentPage - 1) / (totalPages - 1)) * 100;
  
  return (
    <div className="w-full fixed top-10 left-0 px-4 pt-1 pb-1 bg-white shadow-sm z-10">
      <div className="flex justify-end items-center max-w-7xl mx-auto">
        {/* Timer only on the right side */}
        <div className="text-gray-700 text-xs font-mono">{formatTime(elapsedTime)}</div>
      </div>
      
      {/* Progress bar - stretched and smaller */}
      <div className="max-w-screen-xl w-full mx-auto mt-1">
        <div className="h-1 bg-gray-200 rounded-full relative">
          <div 
            className="h-1 bg-blue-500 rounded-full absolute top-0 left-0" 
            style={{ width: `${progress}%` }}
          ></div>
          
          {pages.map(page => (
            <div 
              key={page.id}
              className="absolute top-1/2 transform -translate-y-1/2"
              style={{ 
                left: `${((page.id - 1) / (totalPages - 1)) * 100}%`,
              }}
            >
              <div 
                className={`w-2 h-2 rounded-full border ${currentPage === page.id 
                  ? 'bg-blue-500 border-white' 
                  : currentPage > page.id 
                    ? 'bg-blue-500 border-blue-500' 
                    : 'bg-white border-gray-300'
                }`}
              ></div>
              
              <div className="absolute top-3 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                <span className={`text-[10px] ${currentPage === page.id 
                  ? 'font-bold text-blue-700' 
                  : 'font-normal text-gray-500'
                } bg-white px-1`}>
                  {page.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
