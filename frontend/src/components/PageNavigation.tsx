import { useNavigate } from 'react-router-dom';

interface PageNavigationProps {
  currentPage: number;
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  showBack?: boolean;
  showNext?: boolean;
}

export default function PageNavigation({ 
  currentPage, 
  onBack, 
  onNext,
  backLabel,
  nextLabel,
  showBack = true,
  showNext = true
}: PageNavigationProps) {
  const navigate = useNavigate();
  
  const pages = [
    { id: 1, path: '/', label: 'Welcome' },
    { id: 2, path: '/instructions', label: 'Instructions' },
    { id: 3, path: '/tool1', label: 'Tool 1' },
    { id: 4, path: '/tool2', label: 'Tool 2' },
    { id: 5, path: '/tool3', label: 'Tool 3' },
    { id: 6, path: '/feedback', label: 'Feedback' }
  ];
  
  const prevPage = pages.find(p => p.id === currentPage - 1);
  const nextPage = pages.find(p => p.id === currentPage + 1);
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (prevPage) {
      navigate(prevPage.path);
    }
  };
  
  const handleNext = () => {
    if (onNext) {
      onNext();
    } else if (nextPage) {
      navigate(nextPage.path);
    }
  };
  
  if (!showBack && !showNext) return null;
  
  return (
    <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-6">
      {showBack && prevPage && (
        <button
          onClick={handleBack}
          className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
        >
          ← {backLabel || `Back to ${prevPage.label}`}
        </button>
      )}
      {!showBack && <div></div>}
      
      {showNext && nextPage && (
        <button
          onClick={handleNext}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors ml-auto"
        >
          {nextLabel || `Continue to ${nextPage.label}`} →
        </button>
      )}
      {!showNext && <div></div>}
    </div>
  );
}

