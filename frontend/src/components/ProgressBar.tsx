// frontend/src/components/ProgressBar.tsx
import React from 'react';

interface ProgressBarProps {
  currentPhase: number;
  totalPhases: number;
  phaseName: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentPhase, totalPhases, phaseName }) => {
  const progressPercentage = (currentPhase / totalPhases) * 100;

  return (
    <div className="fixed top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-50 min-w-64">
      <div className="text-sm font-medium text-gray-700 mb-2">
        Phase {currentPhase} of {totalPhases}: {phaseName}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {Math.round(progressPercentage)}% Complete
      </div>
    </div>
  );
};

export default ProgressBar;
