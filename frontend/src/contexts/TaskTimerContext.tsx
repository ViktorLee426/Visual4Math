import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TaskTimerContextType {
  startTime: number | null;
  setStartTime: (time: number | null) => void;
}

const TaskTimerContext = createContext<TaskTimerContextType | undefined>(undefined);

export function TaskTimerProvider({ children }: { children: ReactNode }) {
  const [startTime, setStartTime] = useState<number | null>(null);

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

