import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface TaskTimerContextType {
  startTime: number | null;
  setStartTime: (time: number | null, phase?: string) => void;
}

const TaskTimerContext = createContext<TaskTimerContextType | undefined>(undefined);

// Storage key for timer state per tool
const getTimerKey = (phase: string) => `task_timer_${phase}`;

export function TaskTimerProvider({ children }: { children: ReactNode }) {
  // Initialize from sessionStorage if available - restore based on current phase
  const [startTime, setStartTimeState] = useState<number | null>(null);

  // Restore timer when component mounts
  useEffect(() => {
    // Check if sessionStorage is available (not available in SSR)
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return;
    }
    
    try {
      const session = sessionStorage.getItem('visual4math_session');
      if (session) {
        try {
          const parsed = JSON.parse(session);
          const phase = parsed.currentPhase;
          if (phase && (phase === 'tool1-task' || phase === 'tool2-task' || phase === 'tool3-task')) {
            const saved = sessionStorage.getItem(getTimerKey(phase));
            if (saved) {
              const time = parseInt(saved, 10);
              if (!isNaN(time)) {
                setStartTimeState(time);
              }
            }
          }
        } catch (e) {
          console.warn('Error parsing session data:', e);
        }
      }
    } catch (e) {
      console.warn('Error accessing sessionStorage:', e);
    }
  }, []);

  // Wrapper to persist timer state
  const setStartTime = (time: number | null, phase?: string) => {
    setStartTimeState(time);
    if (time !== null && phase && typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(getTimerKey(phase), time.toString());
      } catch (e) {
        console.warn('Error saving timer to sessionStorage:', e);
      }
    }
    // Don't clear on null - keep the timer running if user navigates away
  };

  return (
    <TaskTimerContext.Provider value={{ startTime, setStartTime }}>
      {children}
    </TaskTimerContext.Provider>
  );
}

export function useTaskTimer() {
  const context = useContext(TaskTimerContext);
  if (context === undefined) {
    throw new Error('useTaskTimer must be used within a TaskTimerProvider');
  }
  return context;
}

