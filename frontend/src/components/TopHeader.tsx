// TopHeader component - displays ETH PEACH logo in top right corner
import ethPeach from '../assets/eth_peach.png';

export default function TopHeader() {
  return (
    <div className="fixed top-0 right-0 bg-white z-30 h-16 flex items-center justify-end pr-6">
      {/* ETH PEACH logo on the right */}
      <div className="flex items-center">
        <img 
          src={ethPeach} 
          alt="ETH Zurich PEACH Lab" 
          className="h-8 w-auto" 
        />
      </div>
    </div>
  );
}

