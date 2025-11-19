import { useState, useEffect } from 'react';

interface TimeProportionalProgressProps {
  currentPhase: string;
}

// Phase definitions with time allocations (in minutes)
const phases = [
  { id: 'welcome', name: 'Welcome', time: 3, path: '/' },
  { id: 'tool1-intro', name: 'Tool 1 Intro', time: 2, path: '/tool1-intro' },
  { id: 'tool1-task', name: 'Tool 1 Task', time: 12, path: '/tool1' },
  { id: 'tool1-eval', name: 'Tool 1 Eval', time: 2, path: '/tool1-eval' },
  { id: 'tool2-intro', name: 'Tool 2 Intro', time: 2, path: '/tool2-intro' },
  { id: 'tool2-task', name: 'Tool 2 Task', time: 12, path: '/tool2' },
  { id: 'tool2-eval', name: 'Tool 2 Eval', time: 2, path: '/tool2-eval' },
  { id: 'tool3-intro', name: 'Tool 3 Intro', time: 2, path: '/tool3-intro' },
  { id: 'tool3-task', name: 'Tool 3 Task', time: 12, path: '/tool3' },
  { id: 'tool3-eval', name: 'Tool 3 Eval', time: 2, path: '/tool3-eval' },
  { id: 'final-comparison', name: 'Final Comparison', time: 2, path: '/final-comparison' },
  { id: 'final-survey', name: 'Final Survey', time: 10, path: '/final-survey' },
];

// Total time: 63 minutes
const totalTime = phases.reduce((sum, phase) => sum + phase.time, 0);

export default function TimeProportionalProgress({ currentPhase }: TimeProportionalProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  
  useEffect(() => {
    try {
      const startTime = sessionStorage.getItem('sessionStartTime');
      
      if (!startTime) {
        const now = new Date().getTime();
        sessionStorage.setItem('sessionStartTime', now.toString());
      }
      
      const timer = setInterval(() => {
        try {
          const start = parseInt(sessionStorage.getItem('sessionStartTime') || new Date().getTime().toString());
          const now = new Date().getTime();
          const elapsed = Math.floor((now - start) / 1000);
          setElapsedTime(elapsed);
        } catch (error) {
          console.error('Error updating elapsed time:', error);
        }
      }, 1000);
      
      return () => clearInterval(timer);
    } catch (error) {
      console.error('Error setting up timer:', error);
    }
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
  
  // Calculate cumulative positions based on time
  let cumulativeTime = 0;
  const phasePositions = phases.map(phase => {
    const startPercent = (cumulativeTime / totalTime) * 100;
    cumulativeTime += phase.time;
    const endPercent = (cumulativeTime / totalTime) * 100;
    return {
      ...phase,
      startPercent,
      endPercent,
      centerPercent: (startPercent + endPercent) / 2
    };
  });
  
  // Find current phase index
  const currentPhaseIndex = phases.findIndex(p => p.id === currentPhase);
  const progressPercent = currentPhaseIndex >= 0 && phasePositions[currentPhaseIndex]
    ? phasePositions[currentPhaseIndex].endPercent 
    : 0;
  
  // Log for debugging
  if (currentPhaseIndex === -1) {
    console.warn('TimeProportionalProgress: Phase not found:', currentPhase);
  }
  
  return (
    <div className="w-full fixed top-0 left-0 bg-white border-b border-gray-200 z-20" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
      <div className="flex justify-between items-center max-w-7xl mx-auto px-4 mb-2">
        <div className="text-xs text-gray-500">
          {currentPhaseIndex >= 0 && (
            <span>Phase {currentPhaseIndex + 1} of {phases.length}</span>
          )}
        </div>
        <div className="text-gray-600 text-xs font-mono">{formatTime(elapsedTime)}</div>
      </div>
      
      {/* Progress bar - time-proportional */}
      <div className="max-w-7xl w-full mx-auto px-4">
        <div className="h-1 bg-gray-100 rounded-full relative">
          {/* Progress fill */}
          <div 
            className="h-1 bg-gray-900 rounded-full absolute top-0 left-0 transition-all duration-300" 
            style={{ width: `${progressPercent}%` }}
          ></div>
          
          {/* Phase markers - only show major phases */}
          {phasePositions.map((phase, idx) => {
            // Show markers for: welcome, tool tasks, final comparison, final survey
            const showMarker = idx === 0 || 
                              phase.id.includes('task') || 
                              phase.id === 'final-comparison' || 
                              phase.id === 'final-survey';
            
            if (!showMarker) return null;
            
            const isCurrent = phase.id === currentPhase;
            const isPast = currentPhaseIndex > idx;
            
            return (
              <div 
                key={phase.id}
                className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${phase.centerPercent}%` }}
              >
                <div 
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    isCurrent 
                      ? 'bg-gray-900 shadow-md scale-110' 
                      : isPast 
                        ? 'bg-gray-600 border-2 border-gray-600' 
                        : 'bg-gray-200 border-2 border-gray-300'
                  }`}
                ></div>
                
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  <span className={`text-[10px] transition-colors ${
                    isCurrent 
                      ? 'font-semibold text-gray-900' 
                      : 'font-normal text-gray-500'
                  }`}>
                    {phase.name.replace(' Tool ', ' T').replace(' Eval', ' E')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

