import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';

interface TimeProportionalProgressProps {
  currentPhase: string;
}

// Phase definitions for navigation
const phases = [
  { id: 'welcome', name: 'Welcome', path: '/' },
  { id: 'instructions', name: 'Instructions', path: '/instructions' },
  { id: 'tool1-intro', name: 'Tool A Intro', path: '/tool1-intro' },
  { id: 'tool1-task', name: 'Tool A Task', path: '/tool1' },
  { id: 'tool1-eval', name: 'Tool A Eval', path: '/tool1-eval' },
  { id: 'tool2-intro', name: 'Tool B Intro', path: '/tool2-intro' },
  { id: 'tool2-task', name: 'Tool B Task', path: '/tool2' },
  { id: 'tool2-eval', name: 'Tool B Eval', path: '/tool2-eval' },
  { id: 'tool3-intro', name: 'Tool C Intro', path: '/tool3-intro' },
  { id: 'tool3-task', name: 'Tool C Task', path: '/tool3' },
  { id: 'tool3-eval', name: 'Tool C Eval', path: '/tool3-eval' },
  { id: 'final-survey', name: 'Final Survey', path: '/final-survey' },
];

export default function TimeProportionalProgress({ currentPhase }: TimeProportionalProgressProps) {
  const navigate = useNavigate();
  
  // Check if user is authenticated (has valid session)
  const isAuthenticated = () => {
    const sessionId = sessionStorage.getItem('tracking_session_id');
    const session = sessionManager.getParticipantData();
    return !!(sessionId && session);
  };
  
  const authenticated = isAuthenticated();
  
  return (
    <div className="fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 z-20 w-56 overflow-y-auto">
      <div className="p-4">
        {/* Navigation title */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900">Navigation</h2>
        </div>
        
        {/* Navigation buttons */}
        <div>
          {phases.map((phase) => {
            const isCurrent = phase.id === currentPhase;
            
            // Add spacing after Instructions, Tool A Eval, Tool B Eval, and Tool C Eval
            // These mark the end of each phase group
            const needsSpacing = 
              phase.id === 'instructions' || 
              phase.id === 'tool1-eval' || 
              phase.id === 'tool2-eval' || 
              phase.id === 'tool3-eval';
            
            // Only allow navigation to Welcome page if not authenticated
            // All other pages require authentication
            const isDisabled = !authenticated && phase.id !== 'welcome';
            
            const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Block navigation if not authenticated (except Welcome page)
              if (isDisabled) {
                return;
              }
              
              // Use window.location for more reliable navigation
              if (phase.path === '/') {
                navigate('/', { replace: false });
              } else {
                navigate(phase.path, { replace: false });
              }
            };
            
            return (
              <button
                key={phase.id}
                type="button"
                onClick={handleClick}
                disabled={isDisabled}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                  isCurrent
                    ? 'bg-gray-900 text-white font-medium shadow-sm'
                    : isDisabled
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                } ${needsSpacing ? 'mb-6' : 'mb-0.5'}`}
              >
                <span className="text-sm">{phase.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

