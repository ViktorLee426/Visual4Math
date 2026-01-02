import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface LayoutNode {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  count?: number;
  color?: string;
  textColor?: string; // Text color for text boxes
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number; // Font size for text boxes
}

export interface LayoutCanvasRef {
  exportAsPNG: () => Promise<string>; // Returns base64 PNG data URL
}

interface LayoutCanvasProps {
  nodes: LayoutNode[];
  setNodes: (nodes: LayoutNode[]) => void;
  selectedId?: string | null;
  selectedIds?: string[];
  onSelect?: (id: string, event?: React.MouseEvent) => void;
  onDeselect?: () => void;
  relations?: { id: string; from: string; to: string; type: 'inside'|'next-to'|'on-top-of' }[];
  justAdded?: string | null;
  onDelete?: (id: string) => void;
  onCopy?: (id: string) => void;
  onPaste?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onHistorySave?: (nodes: LayoutNode[]) => void;
  isParsing?: boolean;
  parsingTime?: number;
}

const LayoutCanvas = forwardRef<LayoutCanvasRef, LayoutCanvasProps>(({ nodes, setNodes, selectedId, selectedIds = [], onSelect, onDeselect, relations = [], justAdded, onDelete, onCopy, onPaste, onUndo, onRedo, canUndo = false, canRedo = false, onHistorySave, isParsing = false, parsingTime = 0 }, ref) => {
  const [scale, setScale] = useState(1);
  const [panning, setPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<LayoutNode[]>(nodes);
  
  // Keep ref in sync with nodes prop
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const snap = (v: number) => Math.round(v / 10) * 10; // grid 10px

  // Export canvas as PNG with transparent background and margins
  const exportAsPNG = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!svgRef.current) {
        reject(new Error('SVG ref not available'));
        return;
      }

      // Calculate bounding box of all nodes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodes.forEach(n => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.w);
        maxY = Math.max(maxY, n.y + n.h);
      });

      // If no nodes, use default bounds
      if (nodes.length === 0) {
        minX = 0;
        minY = 0;
        maxX = 800;
        maxY = 600;
      }

      // Calculate content dimensions
      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;

      // Add margins (25% padding on each side to ensure nothing is cut off)
      const marginPercent = 0.25;
      const marginX = contentWidth * marginPercent;
      const marginY = contentHeight * marginPercent;

      // Calculate new bounds with margins - don't limit to canvas size, allow expansion
      const paddedMinX = Math.max(0, minX - marginX);
      const paddedMinY = Math.max(0, minY - marginY);
      const paddedMaxX = maxX + marginX; // Allow expansion beyond canvas
      const paddedMaxY = maxY + marginY; // Allow expansion beyond canvas

      // Calculate export dimensions
      const exportWidth = paddedMaxX - paddedMinX;
      const exportHeight = paddedMaxY - paddedMinY;

      const svg = svgRef.current;
      // Clone SVG to avoid modifying the original
      const svgClone = svg.cloneNode(true) as SVGSVGElement;
      
      // Set viewBox to the padded area
      svgClone.setAttribute('viewBox', `${paddedMinX} ${paddedMinY} ${exportWidth} ${exportHeight}`);
      svgClone.setAttribute('width', exportWidth.toString());
      svgClone.setAttribute('height', exportHeight.toString());
      
      // Remove grid pattern from export
      const gridRect = svgClone.querySelector('rect[fill="url(#grid)"]');
      if (gridRect) {
        gridRect.remove();
      }
      const defs = svgClone.querySelector('defs');
      if (defs) {
        defs.remove();
      }
      
      // Set transparent background for export
      svgClone.style.backgroundColor = 'transparent';
      
      const svgData = new XMLSerializer().serializeToString(svgClone);
      
      // Create a canvas to render the SVG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Set canvas size to match export dimensions
      canvas.width = exportWidth;
      canvas.height = exportHeight;

      // Create an image from the SVG
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // Clear canvas with transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw the SVG image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert to PNG with transparent background
        const pngDataUrl = canvas.toDataURL('image/png');
        
        // Clean up
        URL.revokeObjectURL(url);
        
        resolve(pngDataUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image'));
      };

      img.src = url;
    });
  };

  // Expose export function via ref
  useImperativeHandle(ref, () => ({
    exportAsPNG
  }));

  // Zoom is now only controlled by buttons, not trackpad/wheel
  // Removed onWheel handler to prevent accidental zooming

  const startPan: React.MouseEventHandler = (e) => {
    if ((e.target as Element).tagName === 'svg') {
      setPanning(true);
      (svgRef.current as any)._panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };
  const movePan: React.MouseEventHandler = (e) => {
    if (panning && (svgRef.current as any)._panStart) {
      const s = (svgRef.current as any)._panStart;
      setPan({ x: e.clientX - s.x, y: e.clientY - s.y });
    }
  };
  const endPan = () => setPanning(false);

  const onDrag = (id: string, dx: number, dy: number) => {
    setNodes(
      nodes.map(n => (n.id === id ? { ...n, x: snap(n.x + dx / scale), y: snap(n.y + dy / scale) } : n))
    );
  };

  const onResize = (id: string, dx: number, dy: number) => {
    setNodes(
      nodes.map(n => (n.id === id ? { ...n, w: Math.max(20, snap(n.w + dx / scale)), h: Math.max(20, snap(n.h + dy / scale)) } : n))
    );
  };

  // Helper function to calculate text box size
  const calculateTextSize = (text: string, minWidth: number = 50, minHeight: number = 40): { w: number; h: number } => {
    if (!text) return { w: minWidth, h: minHeight };
    
    const padding = 4;
    const typicalFontSize = 14;
    const lineHeight = typicalFontSize * 1.2;
    
    const maxChars = Math.max(4, Math.floor((minWidth - padding * 2) / (typicalFontSize * 0.55)));
    const words = String(text).split(/\s+/);
    let lines: string[] = [];
    let line = '';
    
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (test.length > maxChars) {
        lines.push(line || w);
        line = line ? w : '';
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    
    // Account for newlines
    const newlineSplit = text.split('\n');
    if (newlineSplit.length > 1) {
      lines = [];
      newlineSplit.forEach(nl => {
        const nlWords = nl.split(/\s+/);
        let nlLine = '';
        for (const w of nlWords) {
          const test = nlLine ? nlLine + ' ' + w : w;
          if (test.length > maxChars) {
            lines.push(nlLine || w);
            nlLine = nlLine ? w : '';
          } else {
            nlLine = test;
          }
        }
        if (nlLine) lines.push(nlLine);
      });
    }
    
    const longestLine = Math.max(...lines.map(l => l.length), 4);
    const charWidth = typicalFontSize * 0.55;
    const boxWidth = Math.max(minWidth, Math.ceil(longestLine * charWidth + padding * 2));
    
    const actualMaxChars = Math.max(4, Math.floor((boxWidth - padding * 2) / (typicalFontSize * 0.55)));
    lines = [];
    line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (test.length > actualMaxChars) {
        lines.push(line || w);
        line = line ? w : '';
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    
    // Account for newlines again with actual width
    if (newlineSplit.length > 1) {
      lines = [];
      newlineSplit.forEach(nl => {
        const nlWords = nl.split(/\s+/);
        let nlLine = '';
        for (const w of nlWords) {
          const test = nlLine ? nlLine + ' ' + w : w;
          if (test.length > actualMaxChars) {
            lines.push(nlLine || w);
            nlLine = nlLine ? w : '';
          } else {
            nlLine = test;
          }
        }
        if (nlLine) lines.push(nlLine);
      });
    }
    
    const height = Math.max(minHeight, Math.ceil(lines.length * lineHeight + padding * 2));
    
    return { w: boxWidth, h: height };
  };

  const handleMouseDownNode = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    const node = nodes.find(n => n.id === id);
    const isTextNode = node?.type === 'text';
    const isSelected = selectedIds.length > 0 ? selectedIds.includes(id) : selectedId === id;
    
    // Normal selection and drag - selection is handled by parent via onSelect
    // Pass the event so parent can check for Ctrl/Cmd key
    onSelect && onSelect(id, e);
    containerRef.current?.focus(); // Focus canvas for keyboard shortcuts
    
    // If it's a text node and already selected, don't start drag immediately
    // Wait to see if user wants to edit or drag
    if (isTextNode && isSelected && editingNodeId !== id) {
      const start = { x: e.clientX, y: e.clientY };
      let hasMoved = false;
      
      const move = (ev: MouseEvent) => {
        const dx = Math.abs(ev.clientX - start.x);
        const dy = Math.abs(ev.clientY - start.y);
        if (dx > 3 || dy > 3) { // Threshold to distinguish click from drag
          hasMoved = true;
          // Start drag operation
          const startNodes = JSON.parse(JSON.stringify(nodes));
          let currentId = id;
          
          const dragMove = (dragEv: MouseEvent) => {
            onDrag(currentId, dragEv.clientX - start.x, dragEv.clientY - start.y);
          };
          const dragUp = () => {
            const currentNodes = nodesRef.current;
            const finalNodes = currentNodes.map((n: LayoutNode) => (n.id === currentId ? { ...n, x: snap(n.x), y: snap(n.y) } : n));
            const changed = JSON.stringify(startNodes) !== JSON.stringify(finalNodes);
            if (changed) {
              onHistorySave && onHistorySave(finalNodes);
              setNodes(finalNodes);
            }
            window.removeEventListener('mousemove', dragMove);
            window.removeEventListener('mouseup', dragUp);
          };
          window.addEventListener('mousemove', dragMove);
          window.addEventListener('mouseup', dragUp);
          
          // Remove the click handler
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
        }
      };
      const up = () => {
        // If text node and clicked without moving, start editing
        if (!hasMoved && isTextNode && isSelected && editingNodeId !== id) {
          setEditingNodeId(id);
          setEditValue(node?.label || '');
        }
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      return; // Exit early for text nodes
    }
    
    // For non-text nodes or text nodes that aren't selected, use normal drag
    const startNodes = JSON.parse(JSON.stringify(nodes)); // Deep copy initial state
    const start = { x: e.clientX, y: e.clientY };
    let currentId = id;
    let hasMoved = false; // Track if mouse moved (drag occurred)
    
    const move = (ev: MouseEvent) => {
      const dx = Math.abs(ev.clientX - start.x);
      const dy = Math.abs(ev.clientY - start.y);
      if (dx > 3 || dy > 3) { // Threshold to distinguish click from drag
        hasMoved = true;
        if (editingNodeId === id) {
          setEditingNodeId(null); // Stop editing if dragging
        }
      }
      if (hasMoved) {
        onDrag(currentId, ev.clientX - start.x, ev.clientY - start.y);
      }
    };
    const up = () => {
      // Get current nodes state (may have been updated during drag)
      const currentNodes = nodesRef.current;
      const finalNodes = currentNodes.map((n: LayoutNode) => (n.id === currentId ? { ...n, x: snap(n.x), y: snap(n.y) } : n));
      const changed = JSON.stringify(startNodes) !== JSON.stringify(finalNodes);
      if (changed) {
        onHistorySave && onHistorySave(finalNodes);
        setNodes(finalNodes);
      }
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  
  // Handle text editing
  const handleTextChange = (nodeId: string, newText: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'text') return;
    
    // Update node label and recalculate size
    const size = calculateTextSize(newText, 50, 40);
    const updatedNodes = nodes.map(n => 
      n.id === nodeId 
        ? { ...n, label: newText, w: size.w, h: size.h }
        : n
    );
    setNodes(updatedNodes);
    setEditValue(newText);
  };
  
  const handleTextSubmit = () => {
    if (onHistorySave) {
      const currentNodes = nodesRef.current;
      onHistorySave(currentNodes);
    }
    setEditingNodeId(null);
  };
  
  const handleTextCancel = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    setEditValue(node?.label || '');
    setEditingNodeId(null);
  };
  
  // Auto-focus textarea when editing starts
  useEffect(() => {
    if (editingNodeId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingNodeId]);


  const handleMouseDownHandle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const startNodes = JSON.parse(JSON.stringify(nodes)); // Deep copy initial state
    const start = { x: e.clientX, y: e.clientY };
    let currentId = id;
    const move = (ev: MouseEvent) => {
      onResize(currentId, ev.clientX - start.x, ev.clientY - start.y);
    };
    const up = () => {
      // Get current nodes state (may have been updated during resize)
      // Use ref to get latest nodes value
      const currentNodes = nodesRef.current;
      const finalNodes = currentNodes.map((n: LayoutNode) => (n.id === currentId ? { ...n, w: Math.max(20, snap(n.w)), h: Math.max(20, snap(n.h)) } : n));
      const changed = JSON.stringify(startNodes) !== JSON.stringify(finalNodes);
      if (changed) {
        onHistorySave && onHistorySave(finalNodes);
        setNodes(finalNodes);
      }
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Keyboard shortcuts: Delete, Copy (Ctrl/Cmd+C), Paste (Ctrl/Cmd+V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if canvas is focused or if no input/textarea is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      // Always allow undo/redo in text inputs (browser default)
      if (isInputFocused && ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y'))) {
        return; // Let browser handle undo/redo in inputs
      }
      
      if (isInputFocused) return; // Don't interfere with text input

      // Delete key - remove selected node
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && onDelete) {
          e.preventDefault();
          onDelete(selectedId);
          onDeselect && onDeselect();
        }
      }
      
      // Copy (Ctrl/Cmd + C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedId && onCopy) {
          e.preventDefault();
          onCopy(selectedId);
        }
      }
      
      // Paste (Ctrl/Cmd + V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (onPaste) {
          e.preventDefault();
          onPaste();
        }
      }
      
      // Undo (Ctrl/Cmd + Z)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (onUndo && canUndo) {
          e.preventDefault();
          onUndo();
        }
      }
      
      // Redo (Ctrl/Cmd + Shift + Z)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' && e.shiftKey || e.key === 'y')) {
        if (onRedo && canRedo) {
          e.preventDefault();
          onRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, onDelete, onCopy, onPaste, onSelect, onUndo, onRedo, canUndo, canRedo]);

  // Focus canvas when clicking on it, deselect if clicking empty space
  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as Element;
    // Only deselect if clicking directly on SVG background or grid pattern
    // Check if we're clicking on an actual node element (rect, text, foreignObject, g)
    const isNodeElement = target.closest('g[transform*="translate"]') !== null;
    const isGridPattern = target.tagName === 'rect' && target.getAttribute('fill') === 'url(#grid)';
    
    // Only deselect if clicking on true background (not on any node)
    if (!isNodeElement && (target.tagName === 'svg' || isGridPattern)) {
      containerRef.current?.focus();
      onDeselect && onDeselect();
    }
  };

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium text-gray-600">Zoom: <span className="text-gray-900">{(scale * 100).toFixed(0)}%</span></div>
          <div className="h-4 w-px bg-gray-300"></div>
          <div className="flex items-center gap-1">
            <button 
              className="px-2.5 py-1 border border-gray-200 rounded-md text-xs text-gray-600 hover:bg-white hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" 
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl/Cmd+Z)"
            >
              ↶
            </button>
            <button 
              className="px-2.5 py-1 border border-gray-200 rounded-md text-xs text-gray-600 hover:bg-white hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" 
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl/Cmd+Shift+Z)"
            >
              ↷
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            className="px-2.5 py-1 border border-gray-200 rounded-md text-xs text-gray-600 hover:bg-white hover:border-gray-300 transition-colors" 
            onClick={() => setScale(s => Math.max(0.3, s - 0.1))}
          >
            −
          </button>
          <button 
            className="px-2.5 py-1 border border-gray-200 rounded-md text-xs text-gray-600 hover:bg-white hover:border-gray-300 transition-colors" 
            onClick={() => setScale(s => Math.min(3, s + 0.1))}
          >
            +
          </button>
        </div>
      </div>
      <div className="relative">
        {isParsing && (
          <div className="absolute inset-0 bg-white bg-opacity-90 z-10 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto mb-2" />
              <p className="text-xs text-gray-600 font-medium">Generating layout...</p>
              {parsingTime > 0 && (
                <p className="text-xs text-gray-500 mt-1">{parsingTime.toFixed(1)}s</p>
              )}
            </div>
          </div>
        )}
        <svg
          ref={svgRef}
          className={`w-full h-[400px] bg-gradient-to-br from-gray-50 to-white ${isParsing ? 'opacity-50' : ''}`}
          style={{ 
            cursor: panning ? 'grabbing' : 'grab'
          }}
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={startPan}
          onMouseMove={movePan}
          onMouseUp={endPan}
          onMouseLeave={endPan}
          onClick={handleCanvasClick}
        >
        {/* Grid - Subtle pattern */}
        <defs>
          <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#f3f4f6" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#smallGrid)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
          </pattern>
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
          <rect x={-2000} y={-2000} width={4000} height={4000} fill="url(#grid)" />
          {/* relations as simple lines */}
          {relations.map(r => {
            const from = nodes.find(n => n.id === r.from);
            const to = nodes.find(n => n.id === r.to);
            if (!from || !to) return null;
            const x1 = from.x + from.w / 2; const y1 = from.y + from.h / 2;
            const x2 = to.x + to.w / 2; const y2 = to.y + to.h / 2;
            return (
              <g key={r.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-blue-500" strokeDasharray="4 2" />
                <text x={(x1+x2)/2} y={(y1+y2)/2 - 4} className="text-[9px] fill-blue-600">{r.type}</text>
              </g>
            );
          })}
          {nodes.map((n) => {
            const isJustAdded = justAdded === n.id;
            const isSelected = selectedIds.length > 0 ? selectedIds.includes(n.id) : selectedId === n.id;
            
            // Use original dimensions - no auto-enlarge on overlap
            const adjustedW = n.w;
            const adjustedH = n.h;
            
            return (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}>
              {/* Highlight animation for newly added elements */}
              {isJustAdded && (
                <rect
                  x={-4}
                  y={-4}
                  width={adjustedW + 8}
                  height={adjustedH + 8}
                  rx={8}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.8"
                  style={{
                    animation: 'highlight-pulse 0.6s ease-out forwards',
                  }}
                />
              )}
              <rect
                x={0}
                y={0}
                width={adjustedW}
                height={adjustedH}
                rx={8}
                className={`transition-all duration-200 ${
                  isSelected 
                    ? 'shadow-md' 
                    : 'shadow-sm'
                } ${isJustAdded ? 'shadow-lg' : ''}`}
                fill={n.color || (n.type === 'text' ? '#ffffff' : 'white')}
                stroke={n.type === 'text' 
                  ? (n.borderColor || '#374151') // Dark gray for text boxes
                  : (n.borderColor || (isSelected ? '#3b82f6' : '#d1d5db'))
                }
                strokeWidth={n.type === 'text'
                  ? (n.borderWidth !== undefined ? n.borderWidth : 2) // Default 2px for text boxes
                  : (n.borderWidth !== undefined ? n.borderWidth : (isSelected ? 2 : 1))
                }
                onMouseDown={(e) => handleMouseDownNode(e, n.id)}
                style={{
                  filter: isSelected ? 'drop-shadow(0 4px 6px rgba(59, 130, 246, 0.2))' : undefined,
                  cursor: 'move',
                }}
              />
              {/* Display text or editing textarea */}
              {editingNodeId === n.id && n.type === 'text' ? (
                <foreignObject x={0} y={0} width={adjustedW} height={adjustedH}>
                  <textarea
                    ref={editingNodeId === n.id ? textareaRef : null}
                    value={editValue}
                    onChange={(e) => handleTextChange(n.id, e.target.value)}
                    onBlur={() => handleTextSubmit()}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        handleTextCancel(n.id);
                      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleTextSubmit();
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      padding: '4px',
                      margin: 0,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: `${n.fontSize || 16}px`,
                      fontFamily: 'Arial, sans-serif',
                      color: n.textColor || '#000000',
                      resize: 'none',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                    }}
                  />
                </foreignObject>
              ) : (
                (() => {
                  const labelText = n.label || n.type;
                  // Use fontSize from node if available (for text boxes), otherwise calculate based on height
                  const fontSize = n.type === 'text' && n.fontSize !== undefined 
                    ? n.fontSize 
                    : Math.max(10, Math.min(24, Math.floor(adjustedH / 3)));
                  const lineHeight = fontSize * 1.2;
                  const padding = 4; // Minimal padding from edges (4px)
                  
                  // For text boxes, preserve newlines; for objects, use word wrapping
                  let lines: string[] = [];
                  const maxChars = Math.max(4, Math.floor((adjustedW - padding * 2) / (fontSize * 0.55)));
                  
                  if (n.type === 'text') {
                    // Split by newlines first to preserve them
                    const newlineSplit = String(labelText).split('\n');
                    newlineSplit.forEach((nlLine) => {
                      // Then wrap each line by words if needed
                      const words = nlLine.split(/\s+/);
                      let line = '';
                      for (const w of words) {
                        const test = line ? line + ' ' + w : w;
                        if (test.length > maxChars) {
                          if (line) lines.push(line);
                          line = w;
                        } else {
                          line = test;
                        }
                      }
                      if (line) lines.push(line);
                    });
                  } else {
                    // For objects, use word wrapping only
                    const words = String(labelText).split(/\s+/);
                    let line = '';
                    for (const w of words) {
                      const test = line ? line + ' ' + w : w;
                      if (test.length > maxChars) {
                        lines.push(line || w);
                        line = line ? w : '';
                      } else {
                        line = test;
                      }
                    }
                    if (line) lines.push(line);
                  }
                  
                  // Limit lines based on available height
                  const maxLines = Math.max(1, Math.floor((adjustedH - padding * 2) / (lineHeight)));
                  lines = lines.slice(0, maxLines);
                  
                  // Text positioning - centered for both text and objects
                  const textX = adjustedW / 2; // Center for both text and objects
                  // Start from top with minimal padding
                  const textStartY = 4 + fontSize;
                  
                  return (
                    <g>
                      {/* Label text - start from top, match editing appearance */}
                      {/* Add pointer-events-none to allow clicks to pass through to rect */}
                      {lines.length > 0 && (
                        <text 
                          x={textX} 
                          y={textStartY} 
                          className="select-none" 
                          textAnchor="middle"
                          dominantBaseline="hanging" 
                          fill={n.type === 'text' ? '#000000' : '#374151'}
                          style={{ 
                            fontSize: `${fontSize}px`,
                            fontFamily: 'Arial, sans-serif',
                            lineHeight: `${lineHeight}px`,
                            pointerEvents: 'none', // Allow clicks to pass through to rect underneath
                          }}
                        >
                          {lines.map((ln, i) => (
                            <tspan 
                              key={i} 
                              x={textX} 
                              dy={i === 0 ? 0 : lineHeight}
                            >
                              {ln}
                            </tspan>
                          ))}
                        </text>
                      )}
                    </g>
                  );
                })()
              )}
              <title>{n.label || n.type}</title>
              {/* Resize handle - only visible on hover/selection */}
              {(isSelected || isJustAdded) && (
                <rect
                  x={adjustedW - 10}
                  y={adjustedH - 10}
                  width={10}
                  height={10}
                  rx={2}
                  className="fill-blue-500 cursor-se-resize hover:fill-blue-600 transition-colors"
                  onMouseDown={(e) => handleMouseDownHandle(e, n.id)}
                />
              )}
            </g>
          )})}
        </g>
      </svg>
      </div>
    </div>
  );
});

LayoutCanvas.displayName = 'LayoutCanvas';

export default LayoutCanvas;


