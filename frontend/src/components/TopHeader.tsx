// TopHeader component - displays timer and ETH PEACH logo in top right corner
import ethPeach from '../assets/eth_peach.png';
import TaskTimer from './TaskTimer';
import { useTaskTimer } from '../contexts/TaskTimerContext';

export default function TopHeader() {
  const { startTime } = useTaskTimer();

  return (
    <div className="fixed top-0 right-0 bg-white z-30 h-16 flex items-center justify-end pr-6 gap-4">
      {/* Timer on the left, ETH PEACH logo on the right */}
      <div className="flex items-center gap-4">
        {startTime && <TaskTimer startTime={startTime} />}
        <div className="flex items-center">
          <img 
            src={ethPeach} 
            alt="ETH Zurich PEACH Lab" 
            className="h-8 w-auto" 
          />
        </div>
      </div>
    </div>
  );
}

