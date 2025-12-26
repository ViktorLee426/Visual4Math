import React from 'react';
import TimeProportionalProgress from '../components/TimeProportionalProgress';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import { useEffect, useRef, useState } from 'react';
import { toolCProblems } from '../data/mathProblems';
import PageNavigation from '../components/PageNavigation';
import { generateManipulatives, getSvgIcons, type SvgIcon } from '../services/manipulativesApi';

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
};

export default function Tool3PanelPage() {
  const navigate = useNavigate();
  const [elems, setElems] = useState<Elem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // zoom/pan
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  // undo/redo
  const [undoStack, setUndoStack] = useState<Elem[][]>([]);
  const [redoStack, setRedoStack] = useState<Elem[][]>([]);
  const [copyBuffer, setCopyBuffer] = useState<Elem | null>(null);
  const [snapshots, setSnapshots] = useState<{ url:string; ts:number }[]>([]);
  const [svgIcons, setSvgIcons] = useState<SvgIcon[]>([]);
  const [iconsLoading, setIconsLoading] = useState(true);
  const [problemText, setProblemText] = useState('');
  const [viewingImageIndex, setViewingImageIndex] = useState<number | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [currentProblem, setCurrentProblem] = useState<{ problemText: string; imageUrl: string } | null>(null);
  const [finalOutputSelected, setFinalOutputSelected] = useState<Record<string, string>>({}); // Map: operation -> imageUrl
  // Text properties for new text boxes
  const [textFontSize, setTextFontSize] = useState(14);
  const [textFontFamily, setTextFontFamily] = useState('Arial');
  const [textColor, setTextColor] = useState('#000000');
  
  // Initialize phase
  useEffect(() => {
    const session = sessionManager.getParticipantData();
    if (!session) {
      console.warn('No session found, but continuing in dev mode');
      // In dev mode, don't redirect - just continue
    } else {
      sessionManager.updatePhase('tool3-task');
    }

    // Load selected problem if available, otherwise default to Multiplication
    const taskData = sessionManager.getPhaseData('tool3-task');
    const savedProblemId = taskData?.selected_problem_id;
    const defaultProblemId = 'toolC-mult'; // Multiplication by default
    const problemIdToUse = savedProblemId || defaultProblemId;
    const problem = toolCProblems.find(p => p.id === problemIdToUse);
    if (problem) {
      setSelectedProblemId(problemIdToUse);
      setCurrentProblem({
        problemText: problem.problemText,
        imageUrl: problem.imageUrl
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
  
  // Handle selecting final output for a specific operation
  const handleSelectFinalOutput = (imageUrl: string, operation: string) => {
    const newFinalOutputs = { ...finalOutputSelected, [operation]: imageUrl };
    setFinalOutputSelected(newFinalOutputs);
    const taskData = sessionManager.getPhaseData('tool3-task') || {};
    sessionManager.savePhaseData('tool3-task', {
      ...taskData,
      final_outputs: newFinalOutputs,
      completion_status: Object.keys(newFinalOutputs).length > 0 ? 'completed' : 'in_progress'
    });
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
      textColor: textColor
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

  const onDrag = (id: string, dx: number, dy: number) => setElems(elems.map(e => e.id===id ? { ...e, x: e.x + dx/scale, y: e.y + dy/scale } : e));
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

    // Add padding (20% on each side, minimum 40px)
    const padding = Math.max(40, Math.max((maxX - minX) * 0.2, (maxY - minY) * 0.2));
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const canvasWidth = contentWidth + padding * 2;
    const canvasHeight = contentHeight + padding * 2;

    // Calculate offset to center elements
    const offsetX = padding - minX;
    const offsetY = padding - minY;

    // Create SVG with calculated dimensions
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
        r.setAttribute('rx', '6'); r.setAttribute('fill', 'white'); r.setAttribute('stroke', '#ccc');
        g.appendChild(r);
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const fontSize = e.fontSize || 14;
        const boxTop = e.y - 16;
        const textPadding = 4;
        const textStartY = boxTop + textPadding + fontSize; // Match the rendering logic
        t.setAttribute('x', String(e.x)); 
        t.setAttribute('y', String(textStartY));
        t.setAttribute('font-size', String(fontSize)); 
        t.setAttribute('font-family', e.fontFamily || 'Arial');
        t.setAttribute('fill', e.textColor || '#000000');
        const textLines = (e.text || '').split('\n');
        const lineHeight = fontSize * 1.2;
        textLines.forEach((line, idx) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', String(e.x));
          tspan.setAttribute('dy', idx === 0 ? '0' : String(lineHeight));
          tspan.textContent = line || '\u00A0'; // Use non-breaking space for empty lines
          t.appendChild(tspan);
        });
        g.appendChild(t);
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
              <h3 className="text-sm font-medium text-gray-500 mb-2">Text Input</h3>
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
                    <span>Parsing...</span>
                  </>
                ) : (
                  'Parse'
                )}
              </button>
            </div>

            {/* Text Properties Panel */}
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <h4 className="text-xs font-medium text-gray-700 mb-2">Text Properties</h4>
              {selectedId && elems.find(e => e.id === selectedId && e.kind === 'text') ? (
                // Show properties for selected text element
                (() => {
                  const selectedText = elems.find(e => e.id === selectedId && e.kind === 'text');
                  const currentFontSize = selectedText?.fontSize || 14;
                  const currentFontFamily = selectedText?.fontFamily || 'Arial';
                  const currentTextColor = selectedText?.textColor || '#000000';
                  
                  return (
                    <div className="space-y-2">
                      {/* Font Size - compact row */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 w-16">Font Size:</label>
                        <input
                          type="number"
                          min="8"
                          max="72"
                          value={currentFontSize}
                          onChange={(e) => {
                            const newSize = Number(e.target.value);
                            setElems(prev => prev.map(it => 
                              it.id === selectedId ? { ...it, fontSize: newSize } : it
                            ));
                          }}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                        />
                      </div>
                      
                      {/* Font Family - compact row */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 w-16">Font:</label>
                        <select
                          value={currentFontFamily}
                          onChange={(e) => {
                            setElems(prev => prev.map(it => 
                              it.id === selectedId ? { ...it, fontFamily: e.target.value } : it
                            ));
                          }}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                        >
                          <option value="Arial">Arial</option>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Courier New">Courier New</option>
                          <option value="Verdana">Verdana</option>
                          <option value="Georgia">Georgia</option>
                          <option value="Comic Sans MS">Comic Sans MS</option>
                        </select>
                      </div>
                      
                      {/* Text Color - compact row */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 w-16">Color:</label>
                        <input
                          type="color"
                          value={currentTextColor}
                          onChange={(e) => {
                            setElems(prev => prev.map(it => 
                              it.id === selectedId ? { ...it, textColor: e.target.value } : it
                            ));
                          }}
                          className="w-16 h-8 border border-gray-300 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })()
              ) : (
                // Show default properties for new text boxes
                <div className="space-y-2">
                  {/* Font Size - compact row */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-16">Font Size:</label>
                    <input
                      type="number"
                      min="8"
                      max="72"
                      value={textFontSize}
                      onChange={(e) => setTextFontSize(Number(e.target.value))}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  </div>
                  
                  {/* Font Family - compact row */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-16">Font:</label>
                    <select
                      value={textFontFamily}
                      onChange={(e) => setTextFontFamily(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Verdana">Verdana</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Comic Sans MS">Comic Sans MS</option>
                    </select>
                  </div>
                  
                  {/* Text Color - compact row */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-16">Color:</label>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-16 h-8 border border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
            
            <button 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm mt-2 hover:bg-gray-50 transition-colors" 
              onClick={addText}
              disabled={isParsing}
            >
              + Text
            </button>
          </div>

          {/* Center: Canvas */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div>Zoom: {(scale*100).toFixed(0)}%</div>
              <div className="space-x-2 flex items-center gap-2">
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
              // Zoom is now only controlled by buttons, not trackpad/wheel
              // Removed onWheel handler to prevent accidental zooming
              onMouseDown={(e)=>{ 
                const target = e.target as Element;
                // If clicking on SVG background (not on an element), deselect and start panning
                if (target.tagName==='svg' || (target.tagName==='g' && !target.closest('image') && !target.closest('rect') && !target.closest('text') && !target.closest('circle'))) {
                  setSelectedId(null); // Deselect when clicking empty area
                  setPanning(true); 
                  (window as any)._panStart={ x:e.clientX-pan.x, y:e.clientY-pan.y }; 
                }
              }}
              onMouseMove={(e)=>{ if (panning && (window as any)._panStart){ const s=(window as any)._panStart; setPan({ x:e.clientX - s.x, y:e.clientY - s.y }); } }}
              onMouseUp={()=>setPanning(false)} onMouseLeave={()=>setPanning(false)}
              onDragOver={(e)=>{e.preventDefault(); e.stopPropagation();}}
              onDrop={(e)=>{ e.preventDefault(); e.stopPropagation(); const data=e.dataTransfer?.getData('text/plain'); if(!data || !svgRef.current) return; const rect=svgRef.current.getBoundingClientRect(); const cx = (e.clientX-rect.left - pan.x)/scale; const cy = (e.clientY-rect.top - pan.y)/scale; addIconAt(data, cx, cy); }}
              onClick={(e)=>{
                // Deselect when clicking directly on SVG background (not on elements)
                const target = e.target as Element;
                // Only deselect if clicking on SVG itself or the transform group (not on images, rects, text, or circles)
                if (target === svgRef.current || (target.tagName === 'g' && target === svgRef.current?.querySelector('g'))) {
                  setSelectedId(null);
                }
              }}
            >
              <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
              {elems.map(e => (
                <Draggable key={e.id} onDrag={(dx,dy)=>onDrag(e.id,dx,dy)}>
                  {e.kind==='icon' && e.svg && (
                    <>
                      <image href={`data:image/svg+xml;utf8,${encodeURIComponent(e.svg)}`} x={e.x} y={e.y} width={e.w} height={e.h} onMouseDown={(e)=>{e.stopPropagation(); setSelectedId(e.currentTarget.getAttribute('data-id') || null);}} data-id={e.id} />
                      {selectedId === e.id && (
                        <>
                          <CornerHandle x={e.x} y={e.y} onResize={(dx,dy)=>onResize(e.id,dx,dy,'nw')} cursor="nwse-resize" />
                          <CornerHandle x={e.x+e.w} y={e.y} onResize={(dx,dy)=>onResize(e.id,dx,dy,'ne')} cursor="nesw-resize" />
                          <CornerHandle x={e.x} y={e.y+e.h} onResize={(dx,dy)=>onResize(e.id,dx,dy,'sw')} cursor="nesw-resize" />
                          <CornerHandle x={e.x+e.w} y={e.y+e.h} onResize={(dx,dy)=>onResize(e.id,dx,dy,'se')} cursor="nwse-resize" />
                        </>
                      )}
                    </>
                  )}
                  {e.kind==='text' && (
                    <EditableText 
                      x={e.x} 
                      y={e.y} 
                      w={e.w} 
                      h={e.h} 
                      text={e.text||''} 
                      fontSize={e.fontSize || 14}
                      fontFamily={e.fontFamily || 'Arial'}
                      textColor={e.textColor || '#000000'}
                      onChange={(t)=>setElems(prev=>prev.map(it=>it.id===e.id?{...it, text:t}:it))}
                      onPropertyChange={(props)=>setElems(prev=>prev.map(it=>it.id===e.id?{...it, ...props}:it))}
                      onResize={(dx,dy,corner)=>onResize(e.id,dx,dy,corner)} 
                      onSelect={()=>setSelectedId(e.id)} 
                      selected={selectedId === e.id} 
                    />
                  )}
                </Draggable>
              ))}
              </g>
            </svg>
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
              <input id="t3-search" className="w-full border rounded px-2 py-1 text-sm" placeholder="Search (e.g., basketball, cake)" onChange={(e)=>{
                const q = e.target.value.toLowerCase();
                const items = document.querySelectorAll('[data-icon-name]') as NodeListOf<HTMLButtonElement>;
                items.forEach(btn => {
                  const name = btn.getAttribute('data-icon-name') || '';
                  btn.style.display = name.includes(q) ? '' : 'none';
                });
              }} />
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
                  svgIcons.map((ic, idx) => (
                    <button 
                      key={`${ic.name}-${idx}`}
                      data-icon-name={ic.name.toLowerCase()} 
                      className="border rounded p-1 hover:bg-gray-50 transition-colors" 
                      onClick={()=>addIcon(ic.svg_content)} 
                      draggable 
                      onDragStart={(e)=>e.dataTransfer?.setData('text/plain', ic.svg_content)}
                      title={ic.name}
                    >
                      <div className="text-[10px] text-gray-500 truncate" title={ic.name}>{ic.name}</div>
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
                }}
              >
                Save Image
              </button>
              
              {/* Final output indicators per operation */}
              {Object.keys(finalOutputSelected).length > 0 && (
                <div className="mb-3 space-y-2">
                  {Object.entries(finalOutputSelected).map(([operation, imageUrl]) => (
                    <div key={operation} className="p-2 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-xs font-medium text-green-800 mb-1">
                        ✓ Selected: {operation.charAt(0).toUpperCase() + operation.slice(1)}
                      </div>
                      <img 
                        src={imageUrl} 
                        alt={`Final output for ${operation}`} 
                        className="w-full h-auto rounded border border-green-300"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="max-h-[200px] overflow-auto grid grid-cols-2 gap-2">
                {snapshots.length===0 ? (
                  <div className="col-span-2 text-center text-xs text-gray-400">No saved images yet. Click "Save Image" to save your canvas.</div>
                ) : (
                  snapshots.map((s, idx) => {
                    // Check if this image is selected for any operation
                    const selectedForOperation = Object.entries(finalOutputSelected).find(
                      ([_, url]) => url === s.url
                    )?.[0];
                    
                    return (
                      <div 
                        key={idx} 
                        className={`relative border rounded overflow-hidden cursor-pointer transition-colors ${
                          selectedForOperation
                            ? 'border-green-500 hover:border-green-600'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                        onClick={()=>{
                          setViewingImageIndex(idx);
                        }}
                      >
                        <img src={s.url} className="w-full h-auto" alt={`Saved image ${idx + 1}`} />
                        {selectedForOperation && (
                          <div className="absolute top-1 right-1 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                            ✓ {selectedForOperation.charAt(0).toUpperCase() + selectedForOperation.slice(1)}
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
            className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
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
            
            {/* Image counter and selection */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg text-xs space-y-2">
              {snapshots.length > 1 && (
                <div>
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
                  className="w-full mt-2 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium transition-colors"
                >
                  {finalOutputSelected[getOperationFromProblemId(selectedProblemId)] === snapshots[viewingImageIndex].url
                    ? '✓ Selected for ' + getOperationFromProblemId(selectedProblemId)
                    : 'Mark as final (' + (selectedProblemId.includes('add') ? 'Addition' : selectedProblemId.includes('sub') ? 'Subtraction' : selectedProblemId.includes('mult') ? 'Multiplication' : 'Division') + ')'}
                </button>
              )}
            </div>
            
            {/* Image */}
            <img 
              src={snapshots[viewingImageIndex].url} 
              alt={`Saved image ${viewingImageIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain"
              style={{ 
                display: 'block',
                WebkitUserSelect: 'none',
                margin: 'auto',
                backgroundColor: 'hsl(0, 0%, 90%)',
                transition: 'background-color 300ms'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Draggable({ children, onDrag }: { children: React.ReactNode; onDrag: (dx:number,dy:number)=>void }) {
  const onMouseDown = (e: React.MouseEvent<SVGElement>) => {
    e.stopPropagation(); // Prevent event bubbling
    const start = { x: e.clientX, y: e.clientY };
    let hasMoved = false; // Track if mouse moved (drag occurred)
    const move = (ev: MouseEvent) => {
      const dx = Math.abs(ev.clientX - start.x);
      const dy = Math.abs(ev.clientY - start.y);
      if (dx > 3 || dy > 3) { // Threshold to distinguish click from drag
        hasMoved = true;
      }
      onDrag(ev.clientX - start.x, ev.clientY - start.y);
    };
    const up = () => {
      // If we dragged, prevent click event from interfering with selection
      if (hasMoved) {
        // Small delay to let click event pass
        setTimeout(() => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
        }, 0);
      } else {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      }
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  return (
    <g onMouseDown={onMouseDown} style={{ cursor: 'move' }}>
      {children}
    </g>
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
  x, y, w, h, text, fontSize, fontFamily, textColor, onChange, onPropertyChange, onResize, onSelect, selected 
}: { 
  x:number; y:number; w:number; h:number; text:string; fontSize?:number; fontFamily?:string; textColor?:string; 
  onChange:(t:string)=>void; onPropertyChange?:(props:{fontSize?:number; fontFamily?:string; textColor?:string})=>void;
  onResize:(dx:number,dy:number,corner:'nw'|'ne'|'sw'|'se')=>void; onSelect?:()=>void; selected?:boolean 
}) {
  // onPropertyChange is available for future use (e.g., font size/color changes)
  void onPropertyChange;
  const baseFontSize = fontSize || 14;
  const baseFontFamily = fontFamily || 'Arial';
  const baseTextColor = textColor || '#000000';
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
  
  // Split text by newlines for multi-line rendering
  const textLines = text.split('\n');
  const lineHeight = baseFontSize * 1.2;
  // Box coordinates: rect starts at (x-4, y-16) with dimensions (w, h)
  // Text should be positioned consistently from the top-left of the box
  // SVG text y coordinate is the baseline of the first line
  // So we need: boxTop + padding + fontSize (to get to baseline)
  const boxTop = y - 16;
  const textPadding = 4;
  // Start Y position: top of box + padding + font size for baseline
  // This allows leading newlines/spaces to push text down naturally
  const textStartY = boxTop + textPadding + baseFontSize;
  
  return (
    <>
      <rect x={x-4} y={y-16} width={w} height={h} rx={6} className="fill-white opacity-80 stroke-gray-300" onDoubleClick={onDblClick} onMouseDown={(e)=>{e.stopPropagation(); onSelect?.();}} />
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
              boxSizing: 'border-box'
            }}
            placeholder="Enter text (Enter for new line)"
          />
        </foreignObject>
      ) : (
        <text 
          x={x} 
          y={textStartY} 
          className="select-none" 
          style={{ 
            fontSize: baseFontSize, 
            fontFamily: baseFontFamily,
            fill: baseTextColor
          }} 
          onDoubleClick={onDblClick} 
          onMouseDown={(e)=>{e.stopPropagation(); onSelect?.();}}
        >
          {textLines.map((line, idx) => (
            <tspan key={idx} x={x} dy={idx === 0 ? 0 : lineHeight}>
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


