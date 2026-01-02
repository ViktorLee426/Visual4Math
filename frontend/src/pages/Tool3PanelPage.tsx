import React from 'react';
import TimeProportionalProgress from '../components/TimeProportionalProgress';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import { useEffect, useRef, useState } from 'react';
import { toolCProblems } from '../data/mathProblems';
import PageNavigation from '../components/PageNavigation';
import { generateManipulatives, getSvgIcons, type SvgIcon } from '../services/manipulativesApi';
import { useTaskTimer } from '../contexts/TaskTimerContext';
import { submitToolCCanvas, submitToolCImage } from '../services/trackingApi';

// Helper function to wrap text based on available width
const wrapText = (text: string, maxWidth: number, fontSize: number, textPadding: number = 4): string[] => {
  if (!text) return [''];
  
  // First split by manual line breaks
  const manualLines = text.split('\n');
  const wrappedLines: string[] = [];
  
  // Character width estimation (similar to Tool2LayoutPage)
  const charWidth = fontSize * 0.55;
  const availableWidth = maxWidth - (textPadding * 2);
  const maxChars = Math.max(4, Math.floor(availableWidth / charWidth));
  
  for (const manualLine of manualLines) {
    if (!manualLine.trim()) {
      wrappedLines.push('');
      continue;
    }
    
    const words = manualLine.split(/\s+/);
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      
      // If adding this word would exceed the width, start a new line
      if (testLine.length > maxChars && currentLine) {
        wrappedLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      wrappedLines.push(currentLine);
    }
  }
  
  return wrappedLines.length > 0 ? wrappedLines : [''];
};

// Predefined color palette - R default palette
const COLOR_PALETTE = [
  '#000000', // Black
  '#DF536B', // Pink/Red
  '#61D04F', // Green
  '#2297E6', // Blue
  '#28E2E5', // Cyan
  '#CD0BBC', // Magenta/Purple
  '#F5C710', // Yellow/Orange
  '#9E9E9E', // Gray
  '#FFFFFF', // White
];

// Color picker button component with lab tube icon
function ColorPickerButton({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        className="w-5 h-5 rounded border border-gray-300 hover:border-gray-400 transition-colors flex items-center justify-center bg-white relative"
        title="Color picker"
        type="button"
      >
        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      </button>
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ zIndex: 1 }}
      />
    </div>
  );
}

type Elem = { 
  id: string; 
  kind: 'icon'|'text'; 
  x: number; 
  y: number; 
  w: number; 
  h: number; 
  svg?: string; 
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  iconColor?: string;
  borderColor?: string;
  borderWidth?: number;
  rotation?: number; // Rotation angle in degrees
};

export default function Tool3PanelPage() {
  const navigate = useNavigate();
  const [elems, setElems] = useState<Elem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); // Multi-select support
  const [selectionRect, setSelectionRect] = useState<{x1: number, y1: number, x2: number, y2: number} | null>(null);
  // zoom (pan removed)
  const [scale, setScale] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const rafIdRef = useRef<number | null>(null); // For smooth animation
  // undo/redo
  const [undoStack, setUndoStack] = useState<Elem[][]>([]);
  const [redoStack, setRedoStack] = useState<Elem[][]>([]);
  const [copyBuffer, setCopyBuffer] = useState<Elem | null>(null);
  const [snapshots, setSnapshots] = useState<{ url:string; ts:number }[]>([]);
  const [svgIcons, setSvgIcons] = useState<SvgIcon[]>([]);
  const [iconsLoading, setIconsLoading] = useState(true);
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [problemText, setProblemText] = useState('');
  const [viewingImageIndex, setViewingImageIndex] = useState<number | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [currentProblem, setCurrentProblem] = useState<{ problemText: string; imageUrl: string } | null>(null);
  const [finalOutputSelected, setFinalOutputSelected] = useState<Record<string, string>>({}); // Map: operation -> imageUrl
  // Text properties for new text boxes (currently unused but reserved for future features)
  const [textFontSize] = useState(14);
  const [textFontFamily] = useState('Arial');
  const [textColor] = useState('#000000');
  
  // Timer context
  const { setStartTime } = useTaskTimer();
  
  // Initialize phase
  useEffect(() => {
    const session = sessionManager.getParticipantData();
    if (!session) {
      console.warn('No session found, but continuing in dev mode');
      // In dev mode, don't redirect - just continue
    } else {
      sessionManager.updatePhase('tool3-task');
    }

    // Restore timer if it exists, otherwise start new timer
    try {
      const TIMER_KEY = 'task_timer_tool3-task';
      const savedTimer = sessionStorage.getItem(TIMER_KEY);
      if (savedTimer) {
        const savedTime = parseInt(savedTimer, 10);
        if (!isNaN(savedTime)) {
          console.log('✅ Restored timer from previous session');
          setStartTime(savedTime, 'tool3-task');
        } else {
          setStartTime(Date.now(), 'tool3-task');
        }
      } else {
        setStartTime(Date.now(), 'tool3-task');
      }
    } catch (e) {
      console.warn('Error restoring timer:', e);
      setStartTime(Date.now(), 'tool3-task');
    }

    // Don't clear timer on unmount - keep it running

    // Load selected problem if available, otherwise default to Multiplication
    const taskData = sessionManager.getPhaseData('tool3-task');
    const savedProblemId = taskData?.selected_problem_id;
    const defaultProblemId = 'toolC-mult'; // Multiplication by default
    const problemIdToUse = savedProblemId || defaultProblemId;
    const problem = toolCProblems.find(p => p.id === problemIdToUse);
    if (problem) {
      setSelectedProblemId(problemIdToUse);
      setCurrentProblem({
        problemText: problem!.problemText,
        imageUrl: problem!.imageUrl
      });
      // Don't auto-fill text input - user should copy manually
      // Save default if not already saved
      if (!savedProblemId) {
        sessionManager.savePhaseData('tool3-task', {
          ...taskData,
          selected_problem_id: defaultProblemId
        });
      }
    }
    
    // Load snapshots if available
    const savedSnapshots = taskData?.snapshots;
    if (savedSnapshots && Array.isArray(savedSnapshots) && savedSnapshots.length > 0) {
      setSnapshots(savedSnapshots);
    }
    
    // Load final outputs if selected (per operation)
    const finalOutputs = taskData?.final_outputs || {};
    if (finalOutputs && Object.keys(finalOutputs).length > 0) {
      setFinalOutputSelected(finalOutputs);
    }
    
    // Load saved canvas state (elems and problemText)
    if (taskData?.elems && Array.isArray(taskData.elems) && taskData.elems.length > 0) {
      setElems(taskData.elems);
      // Initialize undo stack with loaded elements
      setUndoStack([taskData.elems]);
      setRedoStack([]);
    }
    if (taskData?.problemText && typeof taskData.problemText === 'string') {
      setProblemText(taskData.problemText);
    }
  }, [navigate]);

  // Handle problem selection
  const handleSelectProblem = (problemId: string) => {
    const problem = toolCProblems.find(p => p.id === problemId);
    if (problem) {
      setSelectedProblemId(problemId);
      setCurrentProblem({
        problemText: problem.problemText,
        imageUrl: problem.imageUrl
      });
      // Don't auto-fill text input - user should copy manually
      // Save selected problem
      const taskData = sessionManager.getPhaseData('tool3-task') || {};
      sessionManager.savePhaseData('tool3-task', {
        ...taskData,
        selected_problem_id: problemId
      });
    }
  };
  
  // Get operation name from problem ID
  const getOperationFromProblemId = (problemId: string): string => {
    const problem = toolCProblems.find(p => p.id === problemId);
    return problem?.operation || '';
  };

  // Clean icon display name: remove myicon- prefix and trailing -number patterns
  const getIconDisplayName = (iconName: string): string => {
    // Remove myicon- prefix
    let displayName = iconName.replace(/^myicon-/, '');
    // Remove trailing -number pattern (e.g., "donut-2" -> "donut")
    displayName = displayName.replace(/-\d+$/, '');
    return displayName;
  };

  // Filter icons to show: only my_icons folder icons (no math2visual, no additional icons)
  const getFilteredIcons = (): SvgIcon[] => {
    if (svgIcons.length === 0) {
      return svgIcons;
    }

    const searchQuery = iconSearchQuery.toLowerCase().trim();

    // Filter to only show icons from my_icons folder (myicon- prefix)
    const myIcons = svgIcons.filter(icon => icon.name.startsWith('myicon-'));

    // If searching, show only matching my_icons
    if (searchQuery) {
      return myIcons.filter(icon => 
        icon.name.toLowerCase().includes(searchQuery)
      );
    }

    // Otherwise, show all my_icons
    return myIcons;
  };
  
  // Handle selecting/unselecting final output for a specific operation
  const handleSelectFinalOutput = (imageUrl: string, operation: string) => {
    const isCurrentlySelected = finalOutputSelected[operation] === imageUrl;
    const newFinalOutputs = { ...finalOutputSelected };
    
    if (isCurrentlySelected) {
      // Unselect: remove from final outputs
      delete newFinalOutputs[operation];
    } else {
      // Select: set as final output for this operation
      newFinalOutputs[operation] = imageUrl;
    }
    
    setFinalOutputSelected(newFinalOutputs);
    const taskData = sessionManager.getPhaseData('tool3-task') || {};
    sessionManager.savePhaseData('tool3-task', {
      ...taskData,
      final_outputs: newFinalOutputs,
      completion_status: Object.keys(newFinalOutputs).length > 0 ? 'completed' : 'in_progress'
    });
    
    // Track final image selection/unselection
    const session = sessionManager.getParticipantData();
    const sessionId = sessionStorage.getItem('tracking_session_id');
    if (session && sessionId) {
      submitToolCImage(
        session.participantId,
        parseInt(sessionId),
        imageUrl,
        operation,
        !isCurrentlySelected // is_final: true if selecting, false if unselecting
      ).catch(err => console.error('Failed to track Tool C final image:', err));
    }
  };

  const pushHistory = (prev: Elem[]) => {
    setUndoStack(s => [...s, prev].slice(-50));
    setRedoStack([]);
  };
  const addText = () => {
    pushHistory(elems);
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    setElems([...elems, { 
      id, 
      kind: 'text', 
      x: 100, 
      y: 100, 
      w: 120, 
      h: 120, 
      text: 'Text',
      fontSize: textFontSize,
      fontFamily: textFontFamily,
      textColor: textColor,
      borderColor: '#cccccc',
      borderWidth: 1,
      rotation: 0
    }]);
  };
  const addIcon = (svg: string) => {
    pushHistory(elems);
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    setElems([...elems, { id, kind: 'icon', x: 120, y: 120, w: 80, h: 80, svg, rotation: 0 }]);
  };
  const addIconAt = (svg: string, x:number, y:number) => {
    pushHistory(elems);
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    setElems([...elems, { id, kind: 'icon', x, y, w: 80, h: 80, svg, rotation: 0 }]);
  };

  // Track if we're currently dragging/resizing/rotating to save state on mouseup
  const isDraggingRef = useRef(false);
  const dragStartStateRef = useRef<Elem[] | null>(null);

  const onDrag = (id: string, dx: number, dy: number) => {
    // Save state on drag start
    if (!isDraggingRef.current) {
      isDraggingRef.current = true;
      dragStartStateRef.current = elems.map(e => ({ ...e }));
    }
    
    // Cancel any pending animation
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    // Use requestAnimationFrame for smooth updates
    rafIdRef.current = requestAnimationFrame(() => {
      setElems(prevElems => {
        const isMultiSelect = selectedIds.has(id);
        if (isMultiSelect) {
          // Move all selected elements together
          return prevElems.map(e => 
            selectedIds.has(e.id) ? { ...e, x: e.x + dx, y: e.y + dy } : e
          );
        } else {
          return prevElems.map(e => e.id===id ? { ...e, x: e.x + dx, y: e.y + dy } : e);
        }
      });
      rafIdRef.current = null;
    });
  };
  
  const onDragEnd = () => {
    if (isDraggingRef.current && dragStartStateRef.current) {
      pushHistory(dragStartStateRef.current);
      isDraggingRef.current = false;
      dragStartStateRef.current = null;
    }
  };
  const isResizingRef = useRef(false);
  const resizeStartStateRef = useRef<Elem[] | null>(null);
  
  const onResize = (id: string, dx: number, dy: number, corner: 'nw'|'ne'|'sw'|'se') => {
    // Save state on resize start
    if (!isResizingRef.current) {
      isResizingRef.current = true;
      resizeStartStateRef.current = elems.map(e => ({ ...e }));
    }
    
    // Cancel any pending animation
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    rafIdRef.current = requestAnimationFrame(() => {
      setElems(prevElems => {
        const isMultiSelect = selectedIds.has(id) && selectedIds.size > 1;
        
        if (isMultiSelect) {
          // Multi-resize: calculate bounding box of all selected elements
          const selected = prevElems.filter(e => selectedIds.has(e.id));
          if (selected.length === 0) return prevElems;
          
          let minX = Math.min(...selected.map(e => e.x));
          let minY = Math.min(...selected.map(e => e.y));
          let maxX = Math.max(...selected.map(e => e.x + e.w));
          let maxY = Math.max(...selected.map(e => e.y + e.h));
          
          const oldWidth = maxX - minX;
          const oldHeight = maxY - minY;
          const minSize = 20;
          
          let newWidth = oldWidth, newHeight = oldHeight, offsetX = 0, offsetY = 0;
          
          if (corner === 'nw') {
            newWidth = Math.max(minSize, oldWidth - dx/scale);
            newHeight = Math.max(minSize, oldHeight - dy/scale);
            offsetX = oldWidth - newWidth;
            offsetY = oldHeight - newHeight;
          } else if (corner === 'ne') {
            newWidth = Math.max(minSize, oldWidth + dx/scale);
            newHeight = Math.max(minSize, oldHeight - dy/scale);
            offsetY = oldHeight - newHeight;
          } else if (corner === 'sw') {
            newWidth = Math.max(minSize, oldWidth - dx/scale);
            newHeight = Math.max(minSize, oldHeight + dy/scale);
            offsetX = oldWidth - newWidth;
          } else if (corner === 'se') {
            newWidth = Math.max(minSize, oldWidth + dx/scale);
            newHeight = Math.max(minSize, oldHeight + dy/scale);
          }
          
          const scaleX = newWidth / oldWidth;
          const scaleY = newHeight / oldHeight;
          
          // Apply scaling to all selected elements
          return prevElems.map(e => {
            if (!selectedIds.has(e.id)) return e;
            const relX = e.x - minX;
            const relY = e.y - minY;
            return {
              ...e,
              x: minX + relX * scaleX + offsetX,
              y: minY + relY * scaleY + offsetY,
              w: e.w * scaleX,
              h: e.h * scaleY,
              fontSize: e.fontSize ? e.fontSize * scaleY : undefined
            };
          });
        } else {
          // Single element resize
          return prevElems.map(e => {
      if (e.id !== id) return e;
      const minSize = 20;
      let newX = e.x, newY = e.y, newW = e.w, newH = e.h;
      
      if (corner === 'nw') {
        newW = Math.max(minSize, e.w - dx/scale);
        newH = Math.max(minSize, e.h - dy/scale);
        newX = e.x + (e.w - newW);
        newY = e.y + (e.h - newH);
      } else if (corner === 'ne') {
        newW = Math.max(minSize, e.w + dx/scale);
        newH = Math.max(minSize, e.h - dy/scale);
        newY = e.y + (e.h - newH);
      } else if (corner === 'sw') {
        newW = Math.max(minSize, e.w - dx/scale);
        newH = Math.max(minSize, e.h + dy/scale);
        newX = e.x + (e.w - newW);
      } else if (corner === 'se') {
        newW = Math.max(minSize, e.w + dx/scale);
        newH = Math.max(minSize, e.h + dy/scale);
      }
      
      return { ...e, x: newX, y: newY, w: newW, h: newH };
          });
        }
      });
      rafIdRef.current = null;
    });
  };
  
  const onResizeEnd = () => {
    if (isResizingRef.current && resizeStartStateRef.current) {
      pushHistory(resizeStartStateRef.current);
      isResizingRef.current = false;
      resizeStartStateRef.current = null;
    }
  };
  
  const isRotatingRef = useRef(false);
  const rotateStartStateRef = useRef<Elem[] | null>(null);
  
  const onRotate = (id: string, angleDelta: number) => {
    // Save state on rotate start
    if (!isRotatingRef.current) {
      isRotatingRef.current = true;
      rotateStartStateRef.current = elems.map(e => ({ ...e }));
    }
    
    // Slow down rotation - reduce sensitivity by 60%
    const slowedAngleDelta = angleDelta * 0.4;
    
    setElems(prevElems => {
      const isMultiSelect = selectedIds.has(id) && selectedIds.size > 1;
      if (isMultiSelect) {
        // Rotate all selected elements around their center
        const selected = prevElems.filter(e => selectedIds.has(e.id));
        if (selected.length === 0) return prevElems;
        
        // Calculate center of all selected elements
        let minX = Math.min(...selected.map(e => e.x));
        let minY = Math.min(...selected.map(e => e.y));
        let maxX = Math.max(...selected.map(e => e.x + e.w));
        let maxY = Math.max(...selected.map(e => e.y + e.h));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        return prevElems.map(e => {
          if (!selectedIds.has(e.id)) return e;
          const elemCenterX = e.x + e.w / 2;
          const elemCenterY = e.y + e.h / 2;
          const dx = elemCenterX - centerX;
          const dy = elemCenterY - centerY;
          const angle = Math.atan2(dy, dx) + angleDelta * Math.PI / 180;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const newX = centerX + Math.cos(angle) * distance - e.w / 2;
          const newY = centerY + Math.sin(angle) * distance - e.h / 2;
          return {
            ...e,
            x: newX,
            y: newY,
            rotation: (e.rotation || 0) + angleDelta
          };
        });
      } else {
        return prevElems.map(e => {
          if (e.id !== id) return e;
          return { ...e, rotation: (e.rotation || 0) + slowedAngleDelta };
        });
      }
    });
  };
  
  const onRotateEnd = () => {
    if (isRotatingRef.current && rotateStartStateRef.current) {
      pushHistory(rotateStartStateRef.current);
      isRotatingRef.current = false;
      rotateStartStateRef.current = null;
    }
  };

  // Function to modify SVG colors
  const modifySvgColor = (svgString: string, newColor: string): string => {
    // Replace all fill attributes with the new color
    let modified = svgString;
    
    // Replace fill="#..." patterns
    modified = modified.replace(/fill="#[^"]*"/g, `fill="${newColor}"`);
    
    // Replace fill="rgb(...)" patterns
    modified = modified.replace(/fill="rgb\([^)]*\)"/g, `fill="${newColor}"`);
    
    // Replace fill="rgba(...)" patterns
    modified = modified.replace(/fill="rgba\([^)]*\)"/g, `fill="${newColor}"`);
    
    // Also handle stroke colors if needed
    modified = modified.replace(/stroke="#[^"]*"/g, `stroke="${newColor}"`);
    
    return modified;
  };

  const [isParsing, setIsParsing] = useState(false);

  // Load SVG icons from math2visual dataset on mount
  useEffect(() => {
    const loadIcons = async () => {
      try {
        setIconsLoading(true);
        const icons = await getSvgIcons();
        if (icons && icons.length > 0) {
          setSvgIcons(icons);
          console.log(`✅ Loaded ${icons.length} SVG icons`);
        } else {
          console.warn('⚠️ No icons returned from API');
          setSvgIcons([]);
        }
      } catch (error) {
        console.error('Failed to load icons:', error);
        // Fallback to empty array
        setSvgIcons([]);
      } finally {
        setIconsLoading(false);
      }
    };
    loadIcons();
  }, []);

  // Auto-save canvas state (elems and problemText) whenever they change
  useEffect(() => {
    const taskData = sessionManager.getPhaseData('tool3-task') || {};
    sessionManager.savePhaseData('tool3-task', {
      ...taskData,
      elems: elems, // Save current canvas elements
      problemText: problemText, // Save text input
      snapshots: snapshots, // Keep existing snapshots
      final_outputs: finalOutputSelected, // Keep existing final outputs
      selected_problem_id: selectedProblemId // Keep selected problem
    });
  }, [elems, problemText, snapshots, finalOutputSelected, selectedProblemId]); // Save whenever state changes

  // Save state on unmount (when navigating away)
  useEffect(() => {
    return () => {
      // Cleanup: save state before component unmounts
      const taskData = sessionManager.getPhaseData('tool3-task') || {};
      sessionManager.savePhaseData('tool3-task', {
        ...taskData,
        elems: elems,
        problemText: problemText,
        snapshots: snapshots,
        final_outputs: finalOutputSelected,
        selected_problem_id: selectedProblemId
      });
    };
  }, [elems, problemText, snapshots, finalOutputSelected, selectedProblemId]);

  const parseMWP = async (text: string) => {
    if (!text.trim()) {
      alert('Please enter a math word problem first.');
      return;
    }
    
    setIsParsing(true);
    try {
      // Use math2visual API to generate formal visual elements
      const response = await generateManipulatives(text);
      
      // Convert formal visual elements to Elem[] format
      // Elements can be: "icon" or "text"
      // Calculate bounding box of all elements first to check if we need to scale
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const tempLayout: Elem[] = [];
      
      for (const elem of response.elements) {
        if (elem.type === 'icon' && elem.svg_content) {
          // Icon element - use default size (80x80) instead of API size to match manual icons
          tempLayout.push({
            id: elem.id,
            kind: 'icon' as const,
            x: elem.x,
            y: elem.y,
            w: 80, // Use default size instead of elem.w
            h: 80, // Use default size instead of elem.h
            svg: elem.svg_content,
            text: elem.count ? `${elem.label} (${elem.count})` : elem.label,
            rotation: 0
          });
          minX = Math.min(minX, elem.x);
          minY = Math.min(minY, elem.y);
          maxX = Math.max(maxX, elem.x + 80);
          maxY = Math.max(maxY, elem.y + 80);
        } else if (elem.type === 'text') {
          // Text element (multipliers, etc.)
          tempLayout.push({
            id: elem.id,
            kind: 'text' as const,
            x: elem.x,
            y: elem.y,
            w: elem.w,
            h: elem.h,
            text: elem.label || '',
            fontSize: 14,
            fontFamily: 'Arial',
            textColor: '#000000',
            rotation: 0
          });
          minX = Math.min(minX, elem.x);
          minY = Math.min(minY, elem.y);
          maxX = Math.max(maxX, elem.x + elem.w);
          maxY = Math.max(maxY, elem.y + elem.h);
        }
      }
      
      // Auto-fit: Check if content is too wide for canvas (assuming canvas width ~800px at scale 1)
      // Get actual canvas dimensions
      const canvasWidth = svgRef.current?.clientWidth || 800;
      const canvasHeight = svgRef.current?.clientHeight || 520;
      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      
      // Calculate scale needed to fit content within canvas (with 20px padding)
      const scaleX = (canvasWidth - 40) / contentWidth;
      const scaleY = (canvasHeight - 40) / contentHeight;
      const fitScale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
      
      // If content is too wide/tall, scale and center it
      if (fitScale < 1 && tempLayout.length > 0) {
        const scaledContentWidth = contentWidth * fitScale;
        const scaledContentHeight = contentHeight * fitScale;
        const offsetX = (canvasWidth - scaledContentWidth) / 2 - minX * fitScale;
        const offsetY = (canvasHeight - scaledContentHeight) / 2 - minY * fitScale;
        
        // Apply scaling and centering to all elements
        tempLayout.forEach(e => {
          e.x = e.x * fitScale + offsetX;
          e.y = e.y * fitScale + offsetY;
          if (e.kind === 'icon') {
            e.w = e.w * fitScale;
            e.h = e.h * fitScale;
          } else {
            e.w = e.w * fitScale;
            e.h = e.h * fitScale;
            if (e.fontSize) {
              e.fontSize = e.fontSize * fitScale;
            }
          }
        });
      }
      
      const layout = tempLayout;
      
      console.log(`✅ Parsed ${layout.length} formal visual elements`);
      
      pushHistory(elems);
      setElems(layout);
    } catch (error) {
      console.error('Parse error:', error);
      alert('Failed to parse problem. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  // Keyboard support for image viewer
  useEffect(() => {
    if (viewingImageIndex === null) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setViewingImageIndex(null);
      } else if (e.key === 'ArrowLeft' && viewingImageIndex > 0) {
        setViewingImageIndex(viewingImageIndex - 1);
      } else if (e.key === 'ArrowRight' && viewingImageIndex < snapshots.length - 1) {
        setViewingImageIndex(viewingImageIndex + 1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingImageIndex, snapshots.length]);

  // keyboard shortcuts for copy/paste/undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept keyboard shortcuts when viewing images
      if (viewingImageIndex !== null) return;
      // Don't intercept if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      // Check if target is inside a text-selectable element (like the example paragraph)
      const isTextSelectable = target.closest('.select-text') !== null || 
                               target.classList.contains('select-text') ||
                               getComputedStyle(target).userSelect === 'text';
      
      const isMac = navigator.platform.toUpperCase().indexOf('MAC')>=0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      
      if (e.key.toLowerCase()==='z') { // undo or redo
        if (!isInputElement && !isTextSelectable) {
          e.preventDefault();
          if (e.shiftKey) {
            // Ctrl+Shift+Z or Cmd+Shift+Z = Redo
            if (redoStack.length) {
              const next = redoStack[0];
              setRedoStack(s=>s.slice(1));
              setUndoStack(s=>[...s, elems].slice(-50));
              setElems(next);
            }
          } else {
            // Ctrl+Z or Cmd+Z = Undo
          if (undoStack.length) {
            const prev = undoStack[undoStack.length-1];
            setUndoStack(s=>s.slice(0,-1));
            setRedoStack(s=>[elems, ...s].slice(0,50));
            setElems(prev);
          }
        }
        }
      } else if (e.key.toLowerCase()==='y') { // redo (alternative)
        if (!isInputElement && !isTextSelectable) {
          e.preventDefault();
          if (redoStack.length) {
            const next = redoStack[0];
            setRedoStack(s=>s.slice(1));
            setUndoStack(s=>[...s, elems].slice(-50));
            setElems(next);
          }
        }
      } else if (e.key.toLowerCase()==='c') {
        // Only intercept copy if:
        // 1. NOT in input/textarea
        // 2. NOT in text-selectable element (like example paragraph)
        // 3. AND there's a selected canvas element
        // 4. AND there's NO text selection (user wants to copy canvas element, not text)
        if (!isInputElement && !isTextSelectable) {
          const selection = window.getSelection();
          const hasTextSelection = selection ? selection.toString().length > 0 : false;
          if (!hasTextSelection && selectedId) {
            e.preventDefault();
            const sel = elems.find(e=>e.id===selectedId);
            if (sel) setCopyBuffer({ ...sel });
          }
          // If there's text selection, allow normal copy to proceed
        }
        // If in text-selectable element, always allow normal copy
      } else if (e.key.toLowerCase()==='v') {
        // Only intercept paste if NOT in input/textarea and NOT in text-selectable element
        if (!isInputElement && !isTextSelectable) {
          e.preventDefault();
          if (copyBuffer) {
            pushHistory(elems);
            const dup = { ...copyBuffer, id:`e_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, x: copyBuffer.x+20, y: copyBuffer.y+20 };
            setElems([...elems, dup]);
            setSelectedId(dup.id);
          }
        }
      }
    };
    const delHandler = (e: KeyboardEvent) => {
      // Don't delete element if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
        // Only delete if there's no text selection (user wants to delete element, not text)
        const selection = window.getSelection();
        const hasTextSelection = selection ? selection.toString().length > 0 : false;
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputElement && !hasTextSelection) {
        // Check if we have multiple items selected
        if (selectedIds.size > 1) {
          e.preventDefault();
          pushHistory(elems);
          setElems(prev => prev.filter(el => !selectedIds.has(el.id)));
          setSelectedIds(new Set());
          setSelectedId(null);
        } else if (selectedId) {
          // Single item selected
          e.preventDefault();
          pushHistory(elems);
          setElems(prev => prev.filter(el => el.id !== selectedId));
          setSelectedId(null);
          setSelectedIds(new Set());
        }
      }
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keydown', delHandler);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keydown', delHandler); };
  }, [elems, selectedId, selectedIds, undoStack, redoStack, copyBuffer]);

  // export current canvas to PNG - captures exactly what's shown on screen
  const exportCanvasToPng = async (): Promise<string> => {
    if (!svgRef.current) {
      // Fallback: return white image if SVG ref not available
      const canvas = document.createElement('canvas');
      canvas.width = 100; canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 100, 100);
      return canvas.toDataURL('image/png');
    }

    // Clone the actual SVG element to avoid modifying the original
    const svgElement = svgRef.current;
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    
    // Remove selection rectangles, handles, and other UI elements that shouldn't be in the export
    const removeElements = (element: Element) => {
      // Remove selection rectangles (dashed borders) - any rect with stroke-dasharray
      const allRects = element.querySelectorAll('rect');
      allRects.forEach(rect => {
        const strokeDash = rect.getAttribute('stroke-dasharray');
        const fill = rect.getAttribute('fill');
        // Remove selection rectangles (dashed borders with no fill or transparent fill)
        if (strokeDash && (fill === 'none' || fill === 'rgba(59, 130, 246, 0.5)' || !fill)) {
          rect.remove();
        }
      });
      
      // Remove selection rectangle fill (semi-transparent blue)
      const selectionFills = element.querySelectorAll('rect[fill="rgba(59, 130, 246, 0.1)"]');
      selectionFills.forEach(rect => rect.remove());
      
      // Remove corner handles (circles used for resizing)
      const handles = element.querySelectorAll('circle');
      handles.forEach(handle => {
        const fill = handle.getAttribute('fill');
        const stroke = handle.getAttribute('stroke');
        // Remove white circles with blue stroke (corner handles) or blue circles (rotation handles)
        if (fill === 'white' || fill === 'rgba(59, 130, 246, 1)' || stroke === 'rgba(59, 130, 246, 1)') {
          handle.remove();
        }
      });
      
      // Remove rotation handles (lines above elements)
      const lines = element.querySelectorAll('line');
      lines.forEach(line => {
        const stroke = line.getAttribute('stroke');
        if (stroke && stroke.includes('59, 130, 246')) {
          line.remove();
        }
      });
      
      // Remove any foreignObject elements (editing textareas)
      const foreignObjects = element.querySelectorAll('foreignObject');
      foreignObjects.forEach(fo => fo.remove());
      
      // Remove empty groups that might have been used for UI
      const groups = element.querySelectorAll('g');
      groups.forEach(group => {
        const children = Array.from(group.children);
        const hasOnlyUI = children.every(child => {
          const tag = child.tagName.toLowerCase();
          if (tag === 'rect' && (child.getAttribute('stroke-dasharray') || child.getAttribute('fill') === 'none')) return true;
          if (tag === 'circle' && (child.getAttribute('fill') === 'white' || child.getAttribute('fill') === 'rgba(59, 130, 246, 1)')) return true;
          if (tag === 'line' && child.getAttribute('stroke')?.includes('59, 130, 246')) return true;
          return false;
        });
        if (hasOnlyUI && children.length > 0) {
          group.remove();
        }
      });
    };
    
    // Remove UI elements from cloned SVG
    removeElements(clonedSvg);
    
    // Get the actual dimensions of the visible SVG
    const rect = svgElement.getBoundingClientRect();
    const svgWidth = Math.ceil(rect.width);
    const svgHeight = Math.ceil(rect.height);
    
    // Set cloned SVG dimensions
    clonedSvg.setAttribute('width', String(svgWidth));
    clonedSvg.setAttribute('height', String(svgHeight));
    clonedSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    
    // Serialize to SVG string
    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Convert to PNG
    const img = new Image();
    const pngUrl: string = await new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = svgWidth;
        canvas.height = svgHeight;
        const ctx = canvas.getContext('2d')!;
        
        // Fill with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the SVG image
        ctx.drawImage(img, 0, 0);
        
        resolve(canvas.toDataURL('image/png'));
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image'));
      };
      img.src = url;
    });
    
    return pngUrl;
  };

  return (
    <div className="min-h-screen bg-white">
      <TimeProportionalProgress currentPhase="tool3-task" />
      <div className="pt-16 pb-8 overflow-x-auto ml-56">
        <div className="min-w-[1024px] max-w-7xl mx-auto px-6">
          {/* Tool Title - Top Left */}
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Tool C - Free manipulation</h1>
          
          <div className="grid grid-cols-4 gap-6">
          {/* Left: Problem Selection + Example Image + Text Input */}
          <div className="col-span-1 space-y-5">
            {/* Problems Selection - Compact Operation Buttons */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">Select a Problem</h3>
              <div className="grid grid-cols-2 gap-2">
                {toolCProblems.map((problem) => {
                  const isSelected = selectedProblemId === problem.id;
                  const operationLabels = {
                    addition: 'Addition',
                    subtraction: 'Subtraction',
                    multiplication: 'Multiplication',
                    division: 'Division'
                  };
                  return (
                    <button
                      key={problem.id}
                      onClick={() => handleSelectProblem(problem.id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected 
                          ? 'border-gray-900 bg-gray-50' 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {operationLabels[problem.operation]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Problem Display */}
            {currentProblem && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-500">Problem</h3>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(currentProblem.problemText);
                      }}
                      className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
                      title="Copy problem text"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <p className="text-sm text-gray-900 leading-relaxed">{currentProblem.problemText}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Example Image</h3>
                  <img src={currentProblem.imageUrl} alt="Example" className="w-full h-auto rounded" />
                </div>
              </div>
            )}

            {/* Text Input Panel */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">Text Input</h3>
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setProblemText(text);
                    } catch (err) {
                      console.error('Failed to paste:', err);
                      // Fallback: try to read from clipboard using older API
                      const textarea = document.createElement('textarea');
                      document.body.appendChild(textarea);
                      textarea.focus();
                      document.execCommand('paste');
                      const pastedText = textarea.value;
                      document.body.removeChild(textarea);
                      if (pastedText) {
                        setProblemText(pastedText);
                      }
                    }
                  }}
                  className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                  title="Paste from clipboard"
                  disabled={isParsing}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Paste
                </button>
              </div>
              <textarea 
                id="t3-prompt" 
                className="w-full h-24 border border-gray-300 rounded-lg p-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none" 
                placeholder="Enter the math word problem here in text..."
                value={problemText}
                onChange={(e) => setProblemText(e.target.value)}
                onPaste={(e) => {
                  // Allow pasting - don't prevent default
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  // Allow Ctrl+C, Ctrl+V, Ctrl+X in textarea
                  const isMac = navigator.platform.toUpperCase().indexOf('MAC')>=0;
                  const mod = isMac ? e.metaKey : e.ctrlKey;
                  if (mod && (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'a')) {
                    e.stopPropagation(); // Don't let parent handler interfere
                  }
                }}
                disabled={isParsing}
              />
              <p className="text-xs text-gray-500 mb-2 mt-2">Note: Parsing may take up to 5 seconds, please wait.</p>
              <button 
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" 
                onClick={()=>{
                  parseMWP(problemText);
                }}
                disabled={isParsing}
              >
                {isParsing ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  'Generate AI Suggestion'
                )}
              </button>
            </div>

          </div>

          {/* Center: Canvas */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div>Zoom: {(scale*100).toFixed(0)}%</div>
              <div className="space-x-2 flex items-center gap-2">
                <button 
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={addText}
                  disabled={isParsing}
                  title="Add Text Box"
                >
                  + Text
                </button>
                <button 
                  className="px-2 py-0.5 border border-red-300 rounded text-red-600 hover:bg-red-50 transition-colors" 
                  onClick={()=>{
                      pushHistory(elems);
                      setElems([]);
                      setSelectedId(null);
                    setSelectedIds(new Set());
                  }}
                  title="Clear Canvas"
                >
                  Clear Canvas
                </button>
                <button 
                  className="px-2 py-0.5 border rounded disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={()=>{
                    if (undoStack.length) {
                      const prev = undoStack[undoStack.length-1];
                      setUndoStack(s=>s.slice(0,-1));
                      setRedoStack(s=>[elems, ...s].slice(0,50));
                      setElems(prev);
                    }
                  }}
                  disabled={undoStack.length === 0}
                  title="Undo (Ctrl+Z)"
                >
                  ↶ Undo
                </button>
                <button 
                  className="px-2 py-0.5 border rounded disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={()=>{
                    if (redoStack.length) {
                      const next = redoStack[0];
                      setRedoStack(s=>s.slice(1));
                      setUndoStack(s=>[...s, elems].slice(-50));
                      setElems(next);
                    }
                  }}
                  disabled={redoStack.length === 0}
                  title="Redo (Ctrl+Y)"
                >
                  ↷ Redo
                </button>
                <button className="px-2 py-0.5 border rounded" onClick={()=>setScale(s=>Math.max(0.3, s-0.1))}>-</button>
                <button className="px-2 py-0.5 border rounded" onClick={()=>setScale(s=>Math.min(3, s+0.1))}>+</button>
              </div>
            </div>
            <svg ref={svgRef} className="w-full h-[520px] border rounded bg-white"
              onClick={(e)=>{
                // Deselect when clicking directly on SVG background (not on elements)
                const target = e.target as Element;
                // Only deselect if clicking on SVG itself or the transform group (not on images, rects, text, or circles)
                if (target === svgRef.current || (target.tagName === 'g' && target === svgRef.current?.querySelector('g'))) {
                  setSelectedId(null);
                  setSelectedIds(new Set());
                }
              }}
              onMouseDown={(e)=>{
                // Start rectangle selection if clicking on empty canvas
                const target = e.target as Element;
                if (target === svgRef.current || (target.tagName === 'g' && target === svgRef.current?.querySelector('g'))) {
                  if (!svgRef.current) return;
                  const rect = svgRef.current.getBoundingClientRect();
                  const startX = (e.clientX - rect.left) / scale;
                  const startY = (e.clientY - rect.top) / scale;
                  let currentRect = { x1: startX, y1: startY, x2: startX, y2: startY };
                  setSelectionRect(currentRect);
                  
                  const move = (moveEv: MouseEvent) => {
                    if (!svgRef.current) return;
                    const rect = svgRef.current.getBoundingClientRect();
                    const currentX = (moveEv.clientX - rect.left) / scale;
                    const currentY = (moveEv.clientY - rect.top) / scale;
                    currentRect = { x1: startX, y1: startY, x2: currentX, y2: currentY };
                    setSelectionRect(currentRect);
                  };
                  
                  const up = () => {
                    if (!svgRef.current) return;
                    // Find all elements within selection rectangle
                    const minX = Math.min(currentRect.x1, currentRect.x2);
                    const maxX = Math.max(currentRect.x1, currentRect.x2);
                    const minY = Math.min(currentRect.y1, currentRect.y2);
                    const maxY = Math.max(currentRect.y1, currentRect.y2);
                    
                    const selected = elems.filter(e => {
                      if (e.kind === 'icon') {
                        return e.x < maxX && e.x + e.w > minX && e.y < maxY && e.y + e.h > minY;
                      } else {
                        return e.x - 4 < maxX && e.x - 4 + e.w > minX && e.y - 16 < maxY && e.y - 16 + e.h > minY;
                      }
                    }).map(e => e.id);
                    
                    if (selected.length > 0) {
                      setSelectedIds(new Set(selected));
                      if (selected.length === 1) {
                        setSelectedId(selected[0]);
                      } else {
                        setSelectedId(null);
                      }
                    } else {
                      setSelectedIds(new Set());
                      setSelectedId(null);
                    }
                    
                    setSelectionRect(null);
                    window.removeEventListener('mousemove', move);
                    window.removeEventListener('mouseup', up);
                  };
                  
                  window.addEventListener('mousemove', move);
                  window.addEventListener('mouseup', up);
                }
              }}
              onDragOver={(e)=>{e.preventDefault(); e.stopPropagation();}}
              onDrop={(e)=>{ 
                e.preventDefault(); 
                e.stopPropagation(); 
                const data=e.dataTransfer?.getData('text/plain'); 
                if(!data || !svgRef.current) return; 
                const rect=svgRef.current.getBoundingClientRect(); 
                const cx = (e.clientX-rect.left)/scale; 
                const cy = (e.clientY-rect.top)/scale; 
                addIconAt(data, cx, cy); 
              }}
            >
              <g transform={`scale(${scale})`}>
              {/* Selection rectangle */}
              {selectionRect && (
                <rect
                  x={Math.min(selectionRect.x1, selectionRect.x2)}
                  y={Math.min(selectionRect.y1, selectionRect.y2)}
                  width={Math.abs(selectionRect.x2 - selectionRect.x1)}
                  height={Math.abs(selectionRect.y2 - selectionRect.y1)}
                  fill="rgba(59, 130, 246, 0.1)"
                  stroke="rgba(59, 130, 246, 0.5)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              )}
              {elems.map(e => {
                const isSelected = selectedId === e.id || selectedIds.has(e.id);
                const rotation = e.rotation || 0;
                
                if (e.kind === 'icon' && e.svg) {
                  const handleMouseDown = (ev: React.MouseEvent<SVGImageElement | SVGGElement>) => {
                    ev.stopPropagation();
                    if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
                      // Multi-select: toggle selection
                      setSelectedIds(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(e.id)) {
                          newSet.delete(e.id);
                          if (newSet.size === 1) {
                            setSelectedId(Array.from(newSet)[0]);
                          } else {
                            setSelectedId(null);
                          }
                        } else {
                          newSet.add(e.id);
                          setSelectedId(null);
                        }
                        return newSet;
                      });
                    } else {
                    setSelectedId(e.id);
                      setSelectedIds(new Set([e.id]));
                    }
                    
                    const svg = ev.currentTarget.ownerSVGElement;
                    if (!svg) return;
                    
                    const pt = svg.createSVGPoint();
                    pt.x = ev.clientX;
                    pt.y = ev.clientY;
                    const ctm = svg.getScreenCTM();
                    if (!ctm) return;
                    const startPoint = pt.matrixTransform(ctm.inverse());
                    
                    const move = (moveEv: MouseEvent) => {
                      pt.x = moveEv.clientX;
                      pt.y = moveEv.clientY;
                      const currentPoint = pt.matrixTransform(ctm.inverse());
                      
                      const dx = currentPoint.x - startPoint.x;
                      const dy = currentPoint.y - startPoint.y;
                      
                      // Remove threshold for smoother movement
                        onDrag(e.id, dx, dy);
                        startPoint.x = currentPoint.x;
                        startPoint.y = currentPoint.y;
                    };
                    
                    const up = () => {
                      onDragEnd(); // Save state to undo stack
                      window.removeEventListener('mousemove', move);
                      window.removeEventListener('mouseup', up);
                    };
                    
                    window.addEventListener('mousemove', move);
                    window.addEventListener('mouseup', up);
                  };
                  
                  const cx = e.x + e.w / 2;
                  const cy = e.y + e.h / 2;
                  
                  return (
                    <g key={e.id} transform={rotation !== 0 ? `translate(${cx},${cy}) rotate(${rotation}) translate(${-cx},${-cy})` : undefined}>
                      <image 
                        href={`data:image/svg+xml;utf8,${encodeURIComponent(
                          e.iconColor && e.svg ? modifySvgColor(e.svg, e.iconColor) : e.svg || ''
                        )}`} 
                        x={e.x} 
                        y={e.y} 
                        width={e.w} 
                        height={e.h}
                        preserveAspectRatio="none"
                        onMouseDown={handleMouseDown}
                        data-id={e.id}
                        style={{ cursor: 'move' }}
                      />
                      {isSelected && (
                        <>
                          <rect
                            x={e.x}
                            y={e.y}
                            width={e.w}
                            height={e.h}
                            fill="none"
                            stroke="rgba(59, 130, 246, 0.5)"
                            strokeWidth={1}
                            strokeDasharray="4 4"
                          />
                          <CornerHandle x={e.x} y={e.y} onResize={(dx,dy)=>onResize(e.id,dx,dy,'nw')} onResizeEnd={onResizeEnd} cursor="nwse-resize" />
                          <CornerHandle x={e.x+e.w} y={e.y} onResize={(dx,dy)=>onResize(e.id,dx,dy,'ne')} onResizeEnd={onResizeEnd} cursor="nesw-resize" />
                          <CornerHandle x={e.x} y={e.y+e.h} onResize={(dx,dy)=>onResize(e.id,dx,dy,'sw')} onResizeEnd={onResizeEnd} cursor="nesw-resize" />
                          <CornerHandle x={e.x+e.w} y={e.y+e.h} onResize={(dx,dy)=>onResize(e.id,dx,dy,'se')} onResizeEnd={onResizeEnd} cursor="nwse-resize" />
                          {/* Rotation handle - positioned above the element */}
                          <RotateHandle 
                            x={cx} 
                            y={e.y - 20} 
                            onRotate={(angleDelta) => onRotate(e.id, angleDelta)}
                            onRotateEnd={onRotateEnd}
                          />
                        </>
                      )}
                    </g>
                  );
                } else if (e.kind === 'text') {
                  const isTextSelected = selectedId === e.id || selectedIds.has(e.id);
                  return (
                    <g key={e.id}>
                      <EditableText 
                        x={e.x} 
                        y={e.y} 
                        w={e.w} 
                        h={e.h} 
                        text={e.text||''} 
                        fontSize={e.fontSize || 14}
                        fontFamily={e.fontFamily || 'Arial'}
                        textColor={e.textColor || '#000000'}
                        borderColor={e.borderColor || '#cccccc'}
                        borderWidth={e.borderWidth ?? 1}
                        rotation={e.rotation || 0}
                        onChange={(t)=>setElems(prev=>prev.map(it=>it.id===e.id?{...it, text:t}:it))}
                        onPropertyChange={(props)=>setElems(prev=>prev.map(it=>it.id===e.id?{...it, ...props}:it))}
                        onResize={(dx,dy,corner)=>onResize(e.id,dx,dy,corner)} 
                        onResizeEnd={onResizeEnd}
                        onSelect={()=>{
                          setSelectedId(e.id);
                          setSelectedIds(new Set([e.id]));
                        }} 
                        selected={isTextSelected}
                        onDrag={(dx,dy)=>onDrag(e.id,dx,dy)}
                        onDragEnd={onDragEnd}
                      />
                    </g>
                  );
                }
                return null;
              })}
              </g>
            </svg>
            
            {/* Property Panel - Shows when text element is selected */}
            {selectedId && elems.find(e => e.id === selectedId && e.kind === 'text') && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <h4 className="text-xs font-medium text-gray-700 mb-2">
                  Properties: Text
                </h4>
                {(() => {
                  const selectedElem = elems.find(e => e.id === selectedId);
                  if (!selectedElem || selectedElem.kind !== 'text') return null;
                  
                  if (selectedElem.kind === 'text') {
                    // Text element properties
                    const currentText = selectedElem.text || '';
                    const currentFontSize = selectedElem.fontSize || 14;
                    const currentTextColor = selectedElem.textColor || '#000000';
                    const currentBorderColor = selectedElem.borderColor || '#cccccc';
                    const currentBorderWidth = selectedElem.borderWidth ?? 1;
                    
                    return (
                      <div className="space-y-2">
                        {/* Text Input Field */}
                        <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1.5 items-center">
                          <label className="text-xs font-semibold text-gray-600">Text</label>
                          <input
                            type="text"
                            value={currentText}
                            onChange={(e) => {
                              setElems(prev => prev.map(it => 
                                it.id === selectedId ? { ...it, text: e.target.value } : it
                              ));
                            }}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Enter text..."
                          />
                        </div>
                        
                        {/* Font Size Slider */}
                        <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1.5 items-center">
                          <label className="text-xs font-semibold text-gray-600">Font Size</label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="range"
                              min="10"
                              max="48"
                              step="1"
                              className="w-full"
                              value={currentFontSize}
                              onChange={(e) => {
                                const newSize = Number(e.target.value);
                                setElems(prev => prev.map(it => 
                                  it.id === selectedId ? { ...it, fontSize: newSize } : it
                                ));
                              }} 
                            />
                            <span className="text-[10px] text-gray-400 whitespace-nowrap min-w-[35px]">
                              {currentFontSize}px
                            </span>
                          </div>
                        </div>
                        
                        {/* Text Color with Palette */}
                        <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1.5 items-center">
                          <label className="text-xs font-semibold text-gray-600">Text Color</label>
                          <div className="flex flex-wrap gap-1 items-center">
                            {COLOR_PALETTE.map(color => (
                              <button
                                key={color}
                                onClick={() => {
                                  setElems(prev => prev.map(it => 
                                    it.id === selectedId ? { ...it, textColor: color } : it
                                  ));
                                }}
                                className={`w-5 h-5 rounded border transition-colors ${
                                  currentTextColor === color ? 'border-gray-600 border-2' : 'border-gray-300 hover:border-gray-400'
                                }`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                            <ColorPickerButton
                              value={currentTextColor}
                              onChange={(color) => {
                                setElems(prev => prev.map(it => 
                                  it.id === selectedId ? { ...it, textColor: color } : it
                                ));
                              }}
                            />
                          </div>
                        </div>
                        
                        {/* Border Color */}
                        <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1.5 items-center">
                          <label className="text-xs font-semibold text-gray-600">Border Color</label>
                          <div className="flex flex-wrap gap-1 items-center">
                            {COLOR_PALETTE.map(color => (
                              <button
                                key={color}
                                onClick={() => {
                                  setElems(prev => prev.map(it => 
                                    it.id === selectedId ? { ...it, borderColor: color } : it
                                  ));
                                }}
                                className={`w-5 h-5 rounded border transition-colors ${
                                  currentBorderColor === color ? 'border-gray-600 border-2' : 'border-gray-300 hover:border-gray-400'
                                }`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                            <ColorPickerButton
                              value={currentBorderColor}
                              onChange={(color) => {
                                setElems(prev => prev.map(it => 
                                  it.id === selectedId ? { ...it, borderColor: color } : it
                                ));
                              }}
                            />
                          </div>
                        </div>
                        
                        {/* Border Width */}
                        <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1.5 items-center">
                          <label className="text-xs font-semibold text-gray-600">Border Width</label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="range"
                              min="0"
                              max="10"
                              step="1"
                              className="w-full"
                              value={currentBorderWidth}
                              onChange={(e) => {
                                const newWidth = Number(e.target.value);
                                setElems(prev => prev.map(it => 
                                  it.id === selectedId ? { ...it, borderWidth: newWidth } : it
                                ));
                              }} 
                            />
                            <span className="text-[10px] text-gray-400 whitespace-nowrap min-w-[35px]">
                              {currentBorderWidth}px
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            
            <PageNavigation 
              currentPage={9} 
              onBack={() => navigate('/tool3-intro')}
              backLabel="Back to Tool C Intro"
              onNext={() => navigate('/tool3-eval')}
              nextLabel="Continue to Evaluation"
              showBack={true}
            />
          </div>

          {/* Right: Icon search */}
          <div className="col-span-1 space-y-3">
            <div className="border rounded p-3">
              <h3 className="text-sm font-medium text-gray-900 mb-1">Search Icons</h3>
              <input 
                id="t3-search" 
                className="w-full border rounded px-2 py-1 text-sm" 
                placeholder={selectedProblemId ? `Search or see defaults for ${getOperationFromProblemId(selectedProblemId)}` : "Search icons..."}
                value={iconSearchQuery}
                onChange={(e) => {
                  setIconSearchQuery(e.target.value);
                }} 
              />
              <div className="grid grid-cols-4 gap-2 mt-2 max-h-[280px] overflow-auto">
                {iconsLoading ? (
                  <div className="col-span-4 text-center text-xs text-gray-400 py-4">
                    <div className="animate-pulse">Loading icons from dataset...</div>
                  </div>
                ) : svgIcons.length === 0 ? (
                  <div className="col-span-4 text-center text-xs text-gray-500 py-4">
                    <p>No icons available</p>
                    <p className="text-[10px] text-gray-400 mt-1">Check backend logs for errors</p>
                  </div>
                ) : (
                  getFilteredIcons().map((ic, idx) => (
                    <button 
                      key={`${ic.name}-${idx}`}
                      data-icon-name={ic.name.toLowerCase()} 
                      className="border rounded p-1 hover:bg-gray-50 transition-colors" 
                      onClick={()=>addIcon(ic.svg_content)} 
                      draggable 
                      onDragStart={(e)=>e.dataTransfer?.setData('text/plain', ic.svg_content)}
                      title={ic.name}
                    >
                      <div className="text-[10px] text-gray-500 truncate" title={ic.name}>
                        {getIconDisplayName(ic.name)}
                      </div>
                      <img 
                        src={`data:image/svg+xml;utf8,${encodeURIComponent(ic.svg_content)}`} 
                        className="h-10 w-auto mx-auto" 
                        alt={ic.name}
                        onError={(e) => {
                          console.error(`Failed to load icon: ${ic.name}`);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="border rounded p-3">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Saved Images</h3>
              <button 
                className="w-full px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium mb-3 hover:bg-gray-800 transition-colors" 
                onClick={async()=>{
                  const png = await exportCanvasToPng();
                  const newSnapshots = [{ url: png, ts: Date.now() }, ...snapshots].slice(0,50);
                  setSnapshots(newSnapshots);
                  
                  // Save snapshots to session (preserve canvas state)
                  const taskData = sessionManager.getPhaseData('tool3-task') || {};
                  sessionManager.savePhaseData('tool3-task', {
                    ...taskData,
                    snapshots: newSnapshots,
                    elems: elems, // Preserve canvas elements
                    problemText: problemText // Preserve text input
                  });
                  
                  // Track canvas state and image
                  const session = sessionManager.getParticipantData();
                  const sessionId = sessionStorage.getItem('tracking_session_id');
                  if (session && sessionId) {
                    const operation = selectedProblemId ? getOperationFromProblemId(selectedProblemId) : undefined;
                    try {
                      // Track canvas state
                      await submitToolCCanvas(
                        session.participantId,
                        parseInt(sessionId),
                        { elems, problemText, selectedProblemId },
                        operation
                      );
                      // Track saved image
                      await submitToolCImage(
                        session.participantId,
                        parseInt(sessionId),
                        png,
                        operation,
                        false // not final yet
                      );
                    } catch (err) {
                      console.error('Failed to track Tool C image:', err);
                    }
                  }
                }}
              >
                Save Image
              </button>
              
              <div className="max-h-[200px] overflow-auto grid grid-cols-2 gap-2">
                {snapshots.length===0 ? (
                  <div className="col-span-2 text-center text-xs text-gray-400">No saved images yet. Click "Save Image" to save your canvas.</div>
                ) : (
                  snapshots.map((s, idx) => {
                    // Find which operation this image is selected for
                    const normalizeUrl = (url: string) => url.split('?')[0].split('#')[0];
                    const selectedForOperation = Object.entries(finalOutputSelected).find(
                      ([_, url]) => normalizeUrl(url) === normalizeUrl(s.url)
                    )?.[0];
                    const formatOp = (op: string) => op.charAt(0).toUpperCase() + op.slice(1);
                    
                    return (
                      <div 
                        key={idx} 
                        className={`relative border rounded overflow-hidden cursor-pointer transition-colors bg-gray-50 ${
                          selectedForOperation
                            ? 'border-green-500 hover:border-green-600'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                        onClick={()=>{
                          setViewingImageIndex(idx);
                        }}
                        style={{ aspectRatio: '1' }}
                      >
                        <div className="p-2 h-full flex items-center justify-center">
                          <img 
                            src={s.url} 
                            className="w-full h-full object-contain" 
                            alt={`Saved image ${idx + 1}`}
                            style={{ maxHeight: '100%' }}
                          />
                        </div>
                        {selectedForOperation && (
                          <div className="absolute top-1 right-1 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                            ✓ {formatOp(selectedForOperation)}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
      
      {/* Image Viewer Modal */}
      {viewingImageIndex !== null && snapshots[viewingImageIndex] && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center"
          onClick={() => setViewingImageIndex(null)}
        >
          <div 
            className="relative max-w-[99vw] max-h-[98vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setViewingImageIndex(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full p-2 transition-colors z-10"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Previous button */}
            {snapshots.length > 1 && viewingImageIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingImageIndex(viewingImageIndex - 1);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full p-3 transition-colors z-10"
                aria-label="Previous image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            
            {/* Next button */}
            {snapshots.length > 1 && viewingImageIndex < snapshots.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingImageIndex(viewingImageIndex + 1);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full p-3 transition-colors z-10"
                aria-label="Next image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            
            {/* Image */}
            <img 
              src={snapshots[viewingImageIndex].url} 
              alt={`Saved image ${viewingImageIndex + 1}`}
              className="object-contain"
              style={{ 
                display: 'block',
                WebkitUserSelect: 'none',
                margin: 'auto',
                backgroundColor: 'hsl(0, 0%, 90%)',
                transition: 'background-color 300ms',
                maxWidth: '99vw',
                maxHeight: '96vh',
                width: 'auto',
                height: 'auto'
              }}
            />
            
            {/* Image counter and selection - moved below image */}
            <div className="mt-4 bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg text-xs space-y-2">
              {snapshots.length > 1 && (
                <div className="text-center">
                  Image {viewingImageIndex + 1} of {snapshots.length}
                </div>
              )}
              {selectedProblemId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const operation = getOperationFromProblemId(selectedProblemId);
                    if (operation) {
                      handleSelectFinalOutput(snapshots[viewingImageIndex].url, operation);
                    }
                  }}
                  className="w-full px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium transition-colors"
                >
                  {finalOutputSelected[getOperationFromProblemId(selectedProblemId)] === snapshots[viewingImageIndex].url
                    ? '✓ Selected for ' + getOperationFromProblemId(selectedProblemId)
                    : 'Mark as final (' + (selectedProblemId.includes('add') ? 'Addition' : selectedProblemId.includes('sub') ? 'Subtraction' : selectedProblemId.includes('mult') ? 'Multiplication' : 'Division') + ')'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CornerHandle({ x, y, onResize, onResizeEnd, cursor = 'nwse-resize' }: { x:number; y:number; onResize:(dx:number,dy:number)=>void; onResizeEnd?:()=>void; cursor?:string }) {
  const onMouseDown = (e: React.MouseEvent<SVGCircleElement>) => {
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: MouseEvent) => {
      onResize(ev.clientX - start.x, ev.clientY - start.y);
      start.x = ev.clientX;
      start.y = ev.clientY;
    };
    const up = () => {
      onResizeEnd?.(); // Save state to undo stack
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  return (
    <circle 
      cx={x} 
      cy={y} 
      r={6} 
      className="fill-white stroke-2 stroke-blue-500" 
      onMouseDown={onMouseDown}
      style={{ cursor, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
    />
  );
}

function RotateHandle({ x, y, onRotate, onRotateEnd }: { x: number; y: number; onRotate: (angleDelta: number) => void; onRotateEnd?: () => void }) {
  const onMouseDown = (e: React.MouseEvent<SVGCircleElement>) => {
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const centerX = rect.left + x;
    const centerY = rect.top + y;
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    let lastAngle = startAngle;
    
    const move = (ev: MouseEvent) => {
      const currentAngle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
      let angleDelta = (currentAngle - lastAngle) * 180 / Math.PI;
      // Normalize to -180 to 180 range
      if (angleDelta > 180) angleDelta -= 360;
      if (angleDelta < -180) angleDelta += 360;
      if (Math.abs(angleDelta) > 0.5) { // Only update if significant change
        onRotate(angleDelta);
        lastAngle = currentAngle;
      }
    };
    
    const up = () => {
      if (onRotateEnd) onRotateEnd(); // Save state to undo stack
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  
  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={x}
        y2={y + 15}
        stroke="rgba(59, 130, 246, 0.5)"
        strokeWidth={1}
      />
      <circle
        cx={x}
        cy={y}
        r={6}
        fill="white"
        stroke="rgba(59, 130, 246, 1)"
        strokeWidth={2}
        onMouseDown={onMouseDown}
        style={{ cursor: 'grab', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
      />
      <circle
        cx={x}
        cy={y}
        r={3}
        fill="rgba(59, 130, 246, 1)"
      />
    </g>
  );
}

function EditableText({ 
  x, y, w, h, text, fontSize, fontFamily, textColor, borderColor, borderWidth, rotation, onChange, onPropertyChange, onResize, onResizeEnd, onSelect, selected, onDrag, onDragEnd
}: { 
  x:number; y:number; w:number; h:number; text:string; fontSize?:number; fontFamily?:string; textColor?:string; 
  borderColor?:string; borderWidth?:number; rotation?:number;
  onChange:(t:string)=>void; onPropertyChange?:(props:{fontSize?:number; fontFamily?:string; textColor?:string})=>void;
  onResize:(dx:number,dy:number,corner:'nw'|'ne'|'sw'|'se')=>void; onResizeEnd?:()=>void; onSelect?:()=>void; selected?:boolean;
  onDrag?:(dx:number,dy:number)=>void; onDragEnd?:()=>void;
}) {
  // onPropertyChange is available for future use (e.g., font size/color changes)
  void onPropertyChange;
  const baseFontSize = fontSize || 14;
  const baseFontFamily = fontFamily || 'Arial';
  const baseTextColor = textColor || '#000000';
  const baseBorderColor = borderColor || '#cccccc';
  const baseBorderWidth = borderWidth ?? 1;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Sync editValue with text prop when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(text);
    }
  }, [text, isEditing]);
  
  
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      // Auto-resize textarea to fit content
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, h)}px`;
    }
  }, [isEditing, h]);
  
  const handleSubmit = () => {
    onChange(editValue);
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditValue(text);
      setIsEditing(false);
    }
    // Allow Enter for new lines (PowerPoint-like behavior)
    // Allow Space - no need to prevent default, it works naturally
    // Shift+Enter also creates new line (default behavior)
    // All other keys work normally in textarea
  };
  
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, h)}px`;
    }
  };
  
  // Padding for text inside box
  const textPadding = 4;
  
  // Wrap text to fit within box width using the shared wrapText function
  const textLines = wrapText(text || '', w, baseFontSize, textPadding);
  const lineHeight = baseFontSize * 1.2;
  // Box coordinates: rect starts at (x-4, y-16) with dimensions (w, h)
  // Text should be positioned consistently from the top-left of the box
  // SVG text y coordinate is the baseline of the first line
  // So we need: boxTop + padding + fontSize (to get to baseline)
  const boxTop = y - 16;
  // Start Y position: top of box + padding + font size for baseline
  // This allows leading newlines/spaces to push text down naturally
  const textStartY = boxTop + textPadding + baseFontSize;
  
  // Handle clicking and dragging
  const handleMouseDown = (e: React.MouseEvent<SVGElement>) => {
    if (isEditing) return; // Don't drag while editing
    
    e.stopPropagation();
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      // Multi-select handled by parent
      onSelect?.();
      return;
    }
    onSelect?.();
    
    if (!onDrag) return;
    
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const startPoint = pt.matrixTransform(ctm.inverse());
    let hasMoved = false;
    
    const move = (moveEv: MouseEvent) => {
      pt.x = moveEv.clientX;
      pt.y = moveEv.clientY;
      const currentPoint = pt.matrixTransform(ctm.inverse());
      
      const dx = currentPoint.x - startPoint.x;
      const dy = currentPoint.y - startPoint.y;
      
      // If moved more than 3 pixels, start dragging instead of editing
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
        if (isEditing) {
          setIsEditing(false);
        }
      }
      
      if (hasMoved && onDrag) {
        onDrag(dx, dy);
        startPoint.x = currentPoint.x;
        startPoint.y = currentPoint.y;
      }
    };
    
    const up = () => {
      if (!hasMoved && selected && !isEditing) {
        // Single click without movement - start editing
        setIsEditing(true);
      } else if (hasMoved && onDragEnd) {
        onDragEnd(); // Save state to undo stack
      }
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  
  const rotationAngle = rotation || 0;
  const cx = x + w / 2;
  const cy = y + h / 2 - 8; // Adjust for text offset
  
  return (
    <g transform={rotationAngle !== 0 ? `translate(${cx},${cy}) rotate(${rotationAngle}) translate(${-cx},${-cy})` : undefined}>
      {selected && (
        <rect
          x={x-4}
          y={y-16}
          width={w}
          height={h}
          fill="none"
          stroke="rgba(59, 130, 246, 0.5)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}
      <rect 
        x={x-4} 
        y={y-16} 
        width={w} 
        height={h} 
        rx={6} 
        className="fill-white opacity-80" 
        fill="white"
        fillOpacity="0.8"
        stroke={baseBorderColor}
        strokeWidth={baseBorderWidth}
        onClick={(e) => {
          e.stopPropagation();
          if (!isEditing && selected) {
            setIsEditing(true);
          }
        }}
        onMouseDown={handleMouseDown} 
        style={{ cursor: isEditing ? 'text' : 'move' }} 
      />
      {isEditing ? (
        <foreignObject x={x-4} y={boxTop} width={w} height={h}>
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={handleTextareaChange}
            onBlur={handleSubmit}
            onKeyDown={handleKeyDown}
            className="w-full h-full text-sm border border-blue-500 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-auto"
            style={{ 
              fontSize: `${baseFontSize}px`,
              fontFamily: baseFontFamily,
              color: baseTextColor,
              lineHeight: '1.2',
              padding: `${textPadding}px 4px`,
              margin: 0,
              boxSizing: 'border-box',
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}
            autoFocus
          />
        </foreignObject>
      ) : (
        <text 
          x={x + w/2} 
          y={textStartY} 
          textAnchor="middle"
          dominantBaseline="hanging"
          className="select-none" 
          style={{ 
            fontSize: baseFontSize, 
            fontFamily: baseFontFamily,
            fill: baseTextColor
          }} 
          onClick={(e) => {
            e.stopPropagation();
            if (!isEditing && selected) {
              setIsEditing(true);
            }
          }}
          onMouseDown={handleMouseDown}
        >
          {textLines.map((line, idx) => (
            <tspan key={idx} x={x + w/2} dy={idx === 0 ? 0 : lineHeight}>
              {line || '\u00A0'}
            </tspan>
          ))}
        </text>
      )}
      {selected && (
        <>
          <CornerHandle x={x-4} y={y-16} onResize={(dx,dy)=>onResize(dx,dy,'nw')} onResizeEnd={onResizeEnd} cursor="nwse-resize" />
          <CornerHandle x={x-4+w} y={y-16} onResize={(dx,dy)=>onResize(dx,dy,'ne')} onResizeEnd={onResizeEnd} cursor="nesw-resize" />
          <CornerHandle x={x-4} y={y-16+h} onResize={(dx,dy)=>onResize(dx,dy,'sw')} onResizeEnd={onResizeEnd} cursor="nesw-resize" />
          <CornerHandle x={x-4+w} y={y-16+h} onResize={(dx,dy)=>onResize(dx,dy,'se')} onResizeEnd={onResizeEnd} cursor="nwse-resize" />
          {/* Text boxes don't have rotation handle */}
        </>
      )}
    </g>
  );
}


