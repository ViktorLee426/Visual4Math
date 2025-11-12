import { useState, useEffect } from 'react';

interface HorizontalProgressProps {
  currentPage: number;
}

const pages = [
  { id: 1, name: 'Welcome', path: '/' },
  { id: 2, name: 'Instructions', path: '/instructions' },
  { id: 3, name: 'tool1 - conversational interface', path: '/tool1' },
  { id: 4, name: 'tool2 - layout-based interface', path: '/tool2' },
  { id: 5, name: 'tool3 - free manipulation', path: '/tool3' },
  { id: 6, name: 'Feedback', path: '/feedback' }
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
    <div className="w-full fixed top-0 left-0 bg-white border-b border-gray-200 z-20" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
      <div className="flex justify-between items-center max-w-7xl mx-auto px-4 mb-2">
        {/* Left side - empty for now */}
        <div></div>
        {/* Timer on the right */}
        <div className="text-gray-600 text-xs font-mono">{formatTime(elapsedTime)}</div>
      </div>
      
      {/* Progress bar - cleaner design */}
      <div className="max-w-7xl w-full mx-auto px-4">
        <div className="h-1 bg-gray-100 rounded-full relative">
          <div 
            className="h-1 bg-gray-900 rounded-full absolute top-0 left-0 transition-all duration-300" 
            style={{ width: `${progress}%` }}
          ></div>
          
          {pages.map(page => (
            <div 
              key={page.id}
              className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 cursor-pointer"
              style={{ 
                left: `${((page.id - 1) / (totalPages - 1)) * 100}%`,
              }}
            >
              <div 
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  currentPage === page.id 
                    ? 'bg-gray-900 shadow-md scale-110' 
                    : currentPage > page.id 
                      ? 'bg-gray-600 border-2 border-gray-600' 
                      : 'bg-gray-200 border-2 border-gray-300'
                }`}
              ></div>
              
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                <span className={`text-[11px] transition-colors ${currentPage === page.id 
                  ? 'font-semibold text-gray-900' 
                  : 'font-normal text-gray-500'
                }`}>
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
