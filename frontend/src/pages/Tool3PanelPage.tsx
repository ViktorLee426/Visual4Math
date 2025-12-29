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
};

export default function Tool3PanelPage() {
  const navigate = useNavigate();
  const [elems, setElems] = useState<Elem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // zoom (pan removed)
  const [scale, setScale] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
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
    // Remove myicon- or heroicon- prefix
    let displayName = iconName.replace(/^(myicon-|heroicon-)/, '');
    // Remove trailing -number pattern (e.g., "donut-2" -> "donut")
    displayName = displayName.replace(/-\d+$/, '');
    return displayName;
  };

  // Get default icon keywords based on operation
  const getDefaultIconKeywords = (operation: string): string[] => {
    const keywords: Record<string, string[]> = {
      'addition': ['myicon-strawberry', 'myicon-chocolate', 'myicon-ice-cream', 'myicon-add', 'myicon-addition', 'myicon-equal', 'myicon-question', 'myicon-rectangle', 'myicon-rect', 'myicon-circle'],
      'subtraction': ['myicon-donut', 'myicon-plate', 'myicon-boy', 'myicon-ate', 'myicon-subtract', 'myicon-equal', 'myicon-question', 'myicon-rectangle', 'myicon-rect', 'myicon-circle'],
      'multiplication': ['myicon-cupcake', 'myicon-tray', 'myicon-multiply', 'myicon-equal', 'myicon-question', 'myicon-rectangle', 'myicon-rect', 'myicon-circle'],
      'division': ['myicon-cupcake', 'myicon-plate', 'myicon-divide', 'myicon-division', 'myicon-equal', 'myicon-question', 'myicon-rectangle', 'myicon-rect', 'myicon-circle'],
    };
    return keywords[operation] || [];
  };

  // Filter icons to show: all my_icons + operation-specific icons + search matches
  const getFilteredIcons = (): SvgIcon[] => {
    if (svgIcons.length === 0) {
      return svgIcons;
    }

    const searchQuery = iconSearchQuery.toLowerCase().trim();

    // If searching, show all matching icons
    if (searchQuery) {
      return svgIcons.filter(icon => 
        icon.name.toLowerCase().includes(searchQuery)
      );
    }

    // Otherwise, show: all my_icons + operation-specific icons + some common icons
    const myIcons = svgIcons.filter(icon => icon.name.startsWith('myicon-'));
    
    // If no problem selected, just show my_icons + some common ones
    if (!selectedProblemId) {
      const commonIcons = svgIcons
        .filter(icon => !icon.name.startsWith('myicon-') && !icon.name.startsWith('heroicon-'))
        .slice(0, 20);
      return [...myIcons, ...commonIcons];
    }

    const operation = getOperationFromProblemId(selectedProblemId);
    const defaultKeywords = getDefaultIconKeywords(operation);
    
    // Get operation-specific icons (these might overlap with myIcons, but that's fine)
    const defaultIcons = svgIcons.filter(icon => 
      defaultKeywords.some(keyword => icon.name.toLowerCase().includes(keyword.toLowerCase()))
    );
    
    // Add some common icons from other datasets (limit to 20)
    const commonIcons = svgIcons
      .filter(icon => !icon.name.startsWith('myicon-') && !icon.name.startsWith('heroicon-'))
      .slice(0, 20);

    // Combine: all my_icons first, then operation-specific, then common
    // Remove duplicates (keep first occurrence)
    const combined = [...myIcons, ...defaultIcons, ...commonIcons];
    const unique = combined.filter((icon, index, self) => 
      index === self.findIndex(i => i.name === icon.name)
    );
    
    return unique;
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
      w: 160, 
      h: 40, 
      text: 'Text',
      fontSize: textFontSize,
      fontFamily: textFontFamily,
      textColor: textColor,
      borderColor: '#cccccc',
      borderWidth: 1
    }]);
  };
  const addIcon = (svg: string) => {
    pushHistory(elems);
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    setElems([...elems, { id, kind: 'icon', x: 120, y: 120, w: 80, h: 80, svg }]);
  };
  const addIconAt = (svg: string, x:number, y:number) => {
    pushHistory(elems);
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    setElems([...elems, { id, kind: 'icon', x, y, w: 80, h: 80, svg }]);
  };

  const onDrag = (id: string, dx: number, dy: number) => {
    setElems(prevElems => prevElems.map(e => e.id===id ? { ...e, x: e.x + dx, y: e.y + dy } : e));
  };
  const onResize = (id: string, dx: number, dy: number, corner: 'nw'|'ne'|'sw'|'se') => {
    setElems(elems.map(e => {
      if (e.id !== id) return e;
      const minSize = 20;
      let newX = e.x, newY = e.y, newW = e.w, newH = e.h;
      
      if (corner === 'nw') {
        // Top-left: adjust x, y, width, height
        newW = Math.max(minSize, e.w - dx/scale);
        newH = Math.max(minSize, e.h - dy/scale);
        newX = e.x + (e.w - newW);
        newY = e.y + (e.h - newH);
      } else if (corner === 'ne') {
        // Top-right: adjust y, width, height
        newW = Math.max(minSize, e.w + dx/scale);
        newH = Math.max(minSize, e.h - dy/scale);
        newY = e.y + (e.h - newH);
      } else if (corner === 'sw') {
        // Bottom-left: adjust x, width, height
        newW = Math.max(minSize, e.w - dx/scale);
        newH = Math.max(minSize, e.h + dy/scale);
        newX = e.x + (e.w - newW);
      } else if (corner === 'se') {
        // Bottom-right: adjust width, height
        newW = Math.max(minSize, e.w + dx/scale);
        newH = Math.max(minSize, e.h + dy/scale);
      }
      
      return { ...e, x: newX, y: newY, w: newW, h: newH };
    }));
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
      const layout: Elem[] = [];
      
      for (const elem of response.elements) {
        if (elem.type === 'icon' && elem.svg_content) {
          // Icon element (items, operators, equals, question mark)
          layout.push({
            id: elem.id,
            kind: 'icon' as const,
            x: elem.x,
            y: elem.y,
            w: elem.w,
            h: elem.h,
            svg: elem.svg_content,
            text: elem.count ? `${elem.label} (${elem.count})` : elem.label
          });
        } else if (elem.type === 'text') {
          // Text element (multipliers, etc.)
          layout.push({
            id: elem.id,
            kind: 'text' as const,
            x: elem.x,
            y: elem.y,
            w: elem.w,
            h: elem.h,
            text: elem.label || '',
            fontSize: 14,
            fontFamily: 'Arial',
            textColor: '#000000'
          });
        }
      }
      
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
      
      if (e.key.toLowerCase()==='z') { // undo
        if (!isInputElement && !isTextSelectable) {
          e.preventDefault();
          if (undoStack.length) {
            const prev = undoStack[undoStack.length-1];
            setUndoStack(s=>s.slice(0,-1));
            setRedoStack(s=>[elems, ...s].slice(0,50));
            setElems(prev);
          }
        }
      } else if (e.key.toLowerCase()==='y') { // redo
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
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !isInputElement) {
        // Only delete if there's no text selection (user wants to delete element, not text)
        const selection = window.getSelection();
        const hasTextSelection = selection ? selection.toString().length > 0 : false;
        if (!hasTextSelection) {
          e.preventDefault();
          pushHistory(elems);
          setElems(prev => prev.filter(el => el.id !== selectedId));
          setSelectedId(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keydown', delHandler);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keydown', delHandler); };
  }, [elems, selectedId, undoStack, redoStack, copyBuffer]);

  // export current canvas to PNG (cropped and centered around elements)
  const exportCanvasToPng = async (): Promise<string> => {
    if (elems.length === 0) {
      // If no elements, return a small white image
      const canvas = document.createElement('canvas');
      canvas.width = 100; canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 100, 100);
      return canvas.toDataURL('image/png');
    }

    // Calculate bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    elems.forEach(e => {
      if (e.kind === 'icon' && e.svg) {
        minX = Math.min(minX, e.x);
        minY = Math.min(minY, e.y);
        maxX = Math.max(maxX, e.x + e.w);
        maxY = Math.max(maxY, e.y + e.h);
      } else if (e.kind === 'text') {
        // Text elements have padding (x-4, y-16)
        minX = Math.min(minX, e.x - 4);
        minY = Math.min(minY, e.y - 16);
        maxX = Math.max(maxX, e.x - 4 + e.w);
        maxY = Math.max(maxY, e.y - 16 + e.h);
      }
    });

    // Calculate content dimensions
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Add minimal padding (5% on each side, minimum 15px) - just enough to cover elements
    const padding = Math.max(15, Math.max(contentWidth * 0.05, contentHeight * 0.05));
    
    // Use rectangular canvas with natural aspect ratio
    const canvasWidth = contentWidth + padding * 2;
    const canvasHeight = contentHeight + padding * 2;

    // Calculate offset to center elements
    const offsetX = padding - minX;
    const offsetY = padding - minY;

    // Create SVG with rectangular dimensions (preserving aspect ratio)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(Math.ceil(canvasWidth)));
    svg.setAttribute('height', String(Math.ceil(canvasHeight)));
    svg.setAttribute('viewBox', `0 0 ${Math.ceil(canvasWidth)} ${Math.ceil(canvasHeight)}`);
    const g = document.createElementNS(svg.namespaceURI, 'g');
    g.setAttribute('transform', `translate(${offsetX},${offsetY}) scale(1)`);
    svg.appendChild(g);
    
    elems.forEach(e => {
      if (e.kind === 'icon' && e.svg) {
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', `data:image/svg+xml;utf8,${encodeURIComponent(e.svg)}`);
        img.setAttribute('x', String(e.x)); img.setAttribute('y', String(e.y));
        img.setAttribute('width', String(e.w)); img.setAttribute('height', String(e.h));
        g.appendChild(img);
      } else if (e.kind === 'text') {
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('x', String(e.x-4)); r.setAttribute('y', String(e.y-16));
        r.setAttribute('width', String(e.w)); r.setAttribute('height', String(e.h));
        r.setAttribute('rx', '6'); 
        r.setAttribute('fill', 'white'); 
        r.setAttribute('fill-opacity', '0.8');
        r.setAttribute('stroke', e.borderColor || '#cccccc');
        r.setAttribute('stroke-width', String(e.borderWidth ?? 1));
        g.appendChild(r);
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const fontSize = e.fontSize || 14;
        const boxTop = e.y - 16;
        const textPadding = 4;
        const textStartY = boxTop + textPadding + fontSize; // Match the rendering logic
        t.setAttribute('x', String(e.x + e.w/2)); 
        t.setAttribute('y', String(textStartY));
        t.setAttribute('font-size', String(fontSize)); 
        t.setAttribute('font-family', e.fontFamily || 'Arial');
        t.setAttribute('fill', e.textColor || '#000000');
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('dominant-baseline', 'hanging');
        
        // Apply word wrapping using the same logic as display
        const textLines = wrapText(e.text || '', e.w, fontSize, textPadding);
        const lineHeight = fontSize * 1.2;
        textLines.forEach((line, idx) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', String(e.x + e.w/2));
          tspan.setAttribute('dy', idx === 0 ? '0' : String(lineHeight));
          tspan.textContent = line || '\u00A0'; // Use non-breaking space for empty lines
          t.appendChild(tspan);
        });
        g.appendChild(t);
        
        // Update border color and width if specified
        if (e.borderColor) {
          r.setAttribute('stroke', e.borderColor);
        }
        if (e.borderWidth !== undefined) {
          r.setAttribute('stroke-width', String(e.borderWidth));
        }
      }
    });
    
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const pngUrl: string = await new Promise((resolve) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(canvasWidth);
        canvas.height = Math.ceil(canvasHeight);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
        URL.revokeObjectURL(url);
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
                    if (confirm('Are you sure you want to clear the entire canvas? This cannot be undone.')) {
                      pushHistory(elems);
                      setElems([]);
                      setSelectedId(null);
                    }
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
              {elems.map(e => {
                if (e.kind === 'icon' && e.svg) {
                  const handleMouseDown = (ev: React.MouseEvent<SVGImageElement>) => {
                    ev.stopPropagation();
                    setSelectedId(e.id);
                    
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
                      
                      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                        onDrag(e.id, dx, dy);
                        startPoint.x = currentPoint.x;
                        startPoint.y = currentPoint.y;
                      }
                    };
                    
                    const up = () => {
                      window.removeEventListener('mousemove', move);
                      window.removeEventListener('mouseup', up);
                    };
                    
                    window.addEventListener('mousemove', move);
                    window.addEventListener('mouseup', up);
                  };
                  
                  return (
                    <g key={e.id}>
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
                      {selectedId === e.id && (
                        <>
                          <CornerHandle x={e.x} y={e.y} onResize={(dx,dy)=>onResize(e.id,dx,dy,'nw')} cursor="nwse-resize" />
                          <CornerHandle x={e.x+e.w} y={e.y} onResize={(dx,dy)=>onResize(e.id,dx,dy,'ne')} cursor="nesw-resize" />
                          <CornerHandle x={e.x} y={e.y+e.h} onResize={(dx,dy)=>onResize(e.id,dx,dy,'sw')} cursor="nesw-resize" />
                          <CornerHandle x={e.x+e.w} y={e.y+e.h} onResize={(dx,dy)=>onResize(e.id,dx,dy,'se')} cursor="nwse-resize" />
                        </>
                      )}
                    </g>
                  );
                } else if (e.kind === 'text') {
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
                        onChange={(t)=>setElems(prev=>prev.map(it=>it.id===e.id?{...it, text:t}:it))}
                        onPropertyChange={(props)=>setElems(prev=>prev.map(it=>it.id===e.id?{...it, ...props}:it))}
                        onResize={(dx,dy,corner)=>onResize(e.id,dx,dy,corner)} 
                        onSelect={()=>setSelectedId(e.id)} 
                        selected={selectedId === e.id}
                        onDrag={(dx,dy)=>onDrag(e.id,dx,dy)}
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

function CornerHandle({ x, y, onResize, cursor = 'nwse-resize' }: { x:number; y:number; onResize:(dx:number,dy:number)=>void; cursor?:string }) {
  const onMouseDown = (e: React.MouseEvent<SVGCircleElement>) => {
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: MouseEvent) => onResize(ev.clientX - start.x, ev.clientY - start.y);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
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

function EditableText({ 
  x, y, w, h, text, fontSize, fontFamily, textColor, borderColor, borderWidth, onChange, onPropertyChange, onResize, onSelect, selected, onDrag
}: { 
  x:number; y:number; w:number; h:number; text:string; fontSize?:number; fontFamily?:string; textColor?:string; 
  borderColor?:string; borderWidth?:number;
  onChange:(t:string)=>void; onPropertyChange?:(props:{fontSize?:number; fontFamily?:string; textColor?:string})=>void;
  onResize:(dx:number,dy:number,corner:'nw'|'ne'|'sw'|'se')=>void; onSelect?:()=>void; selected?:boolean;
  onDrag?:(dx:number,dy:number)=>void;
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
  
  const onDblClick = () => {
    setEditValue(text);
    setIsEditing(true);
  };
  
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
    // Shift+Enter also creates new line (default behavior)
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
  
  // Handle dragging similar to icons
  const handleMouseDown = (e: React.MouseEvent<SVGElement>) => {
    if (isEditing) return; // Don't drag while editing
    
    e.stopPropagation();
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
    
    const move = (moveEv: MouseEvent) => {
      pt.x = moveEv.clientX;
      pt.y = moveEv.clientY;
      const currentPoint = pt.matrixTransform(ctm.inverse());
      
      const dx = currentPoint.x - startPoint.x;
      const dy = currentPoint.y - startPoint.y;
      
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        onDrag(dx, dy);
        startPoint.x = currentPoint.x;
        startPoint.y = currentPoint.y;
      }
    };
    
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  
  return (
    <>
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
        onDoubleClick={onDblClick} 
        onMouseDown={handleMouseDown} 
        style={{ cursor: 'move' }} 
      />
      {isEditing ? (
        <foreignObject x={x-4} y={boxTop} width={w} height={h}>
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={handleTextareaChange}
            onBlur={handleSubmit}
            onKeyDown={handleKeyDown}
            className="w-full h-full text-sm border border-blue-500 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
            style={{ 
              fontSize: `${baseFontSize}px`,
              fontFamily: baseFontFamily,
              color: baseTextColor,
              lineHeight: '1.2',
              padding: `${textPadding}px 4px`,
              margin: 0,
              boxSizing: 'border-box',
              textAlign: 'center'
            }}
            placeholder="Enter text (Enter for new line)"
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
          onDoubleClick={onDblClick} 
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
          <CornerHandle x={x-4} y={y-16} onResize={(dx,dy)=>onResize(dx,dy,'nw')} cursor="nwse-resize" />
          <CornerHandle x={x-4+w} y={y-16} onResize={(dx,dy)=>onResize(dx,dy,'ne')} cursor="nesw-resize" />
          <CornerHandle x={x-4} y={y-16+h} onResize={(dx,dy)=>onResize(dx,dy,'sw')} cursor="nesw-resize" />
          <CornerHandle x={x-4+w} y={y-16+h} onResize={(dx,dy)=>onResize(dx,dy,'se')} cursor="nwse-resize" />
        </>
      )}
    </>
  );
}


