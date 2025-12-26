import { useNavigate, useLocation } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import { getCurrentPageNumber } from '../utils/toolOrdering';
import type { ToolOrdering } from '../utils/toolOrdering';

interface PageNavigationProps {
  currentPage?: number; // Make optional, will be calculated if not provided
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  showBack?: boolean;
  showNext?: boolean;
}

export default function PageNavigation({ 
  currentPage: providedCurrentPage, 
  onBack, 
  onNext,
  backLabel,
  nextLabel,
  showBack = true,
  showNext = true
}: PageNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get tool ordering from session
  const toolOrdering = sessionManager.getToolOrdering() || [1, 2, 3];
  
  // Calculate current page if not provided
  const currentPage = providedCurrentPage || getCurrentPageNumber(location.pathname, toolOrdering);
  
  // Build pages dynamically based on tool ordering
  const buildPages = (ordering: ToolOrdering) => {
    const [firstTool, secondTool, thirdTool] = ordering;
    
    // Define tool page groups
    const toolPages = {
      1: [
        { id: 2, path: '/tool1-intro', label: 'Tool A Intro' },
        { id: 3, path: '/tool1', label: 'Tool A Task' },
        { id: 4, path: '/tool1-eval', label: 'Tool A Eval' },
      ],
      2: [
        { id: 5, path: '/tool2-intro', label: 'Tool B Intro' },
        { id: 6, path: '/tool2', label: 'Tool B Task' },
        { id: 7, path: '/tool2-eval', label: 'Tool B Eval' },
      ],
      3: [
        { id: 8, path: '/tool3-intro', label: 'Tool C Intro' },
        { id: 9, path: '/tool3', label: 'Tool C Task' },
        { id: 10, path: '/tool3-eval', label: 'Tool C Eval' },
      ],
    };
    
    // Build pages array with correct ordering
    const pages = [
      { id: 1, path: '/', label: 'Welcome' },
      ...toolPages[firstTool as keyof typeof toolPages],
      ...toolPages[secondTool as keyof typeof toolPages],
      ...toolPages[thirdTool as keyof typeof toolPages],
      { id: 11, path: '/final-comparison', label: 'Final Comparison' },
      { id: 12, path: '/final-survey', label: 'Final Survey' }
    ];
    
    // Reassign IDs sequentially
    return pages.map((page, index) => ({ ...page, id: index + 1 }));
  };
  
  const pages = buildPages(toolOrdering);
  
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
    <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-6 w-full">
      {/* Back button - far left */}
      <div className="flex-shrink-0">
        {showBack && prevPage ? (
          <button
            onClick={handleBack}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            ← {backLabel || `Back to ${prevPage.label}`}
          </button>
        ) : showBack ? (
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            ← Back to Welcome
          </button>
        ) : (
          <div></div>
        )}
      </div>
      
      {/* Next button - far right */}
      <div className="flex-shrink-0 ml-auto">
        {showNext && nextPage ? (
          <button
            onClick={handleNext}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            {nextLabel || `Continue to ${nextPage.label}`} →
          </button>
        ) : showNext ? (
          <div></div>
        ) : (
          <div></div>
        )}
      </div>
    </div>
  );
}

