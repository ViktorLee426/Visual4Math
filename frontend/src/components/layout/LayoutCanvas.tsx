import React, { useRef, useState, useEffect } from 'react';

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
}

interface LayoutCanvasProps {
  nodes: LayoutNode[];
  setNodes: (nodes: LayoutNode[]) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
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
}

export default function LayoutCanvas({ nodes, setNodes, selectedId, onSelect, relations = [], justAdded, onDelete, onCopy, onPaste, onUndo, onRedo, canUndo = false, canRedo = false, onHistorySave, isParsing = false }: LayoutCanvasProps) {
  const [scale, setScale] = useState(1);
  const [panning, setPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<LayoutNode[]>(nodes);
  
  // Keep ref in sync with nodes prop
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const snap = (v: number) => Math.round(v / 10) * 10; // grid 10px

  const onWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const newScale = Math.min(3, Math.max(0.3, scale + delta * 0.001));
    setScale(newScale);
  };

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

  const handleMouseDownNode = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    // Normal selection and drag
    onSelect && onSelect(id);
    containerRef.current?.focus(); // Focus canvas for keyboard shortcuts
    const startNodes = JSON.parse(JSON.stringify(nodes)); // Deep copy initial state
    const start = { x: e.clientX, y: e.clientY };
    let currentId = id;
    const move = (ev: MouseEvent) => {
      onDrag(currentId, ev.clientX - start.x, ev.clientY - start.y);
    };
    const up = () => {
      // Get current nodes state (may have been updated during drag)
      // Use ref to get latest nodes value
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
          onSelect && onSelect(null);
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
    // If clicking on SVG background (not on a node), deselect
    if (target.tagName === 'svg' || (target.tagName === 'rect' && target.getAttribute('fill') === 'url(#grid)')) {
      containerRef.current?.focus();
      onSelect && onSelect(null);
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
              <p className="text-xs text-gray-600 font-medium">Parsing problem...</p>
            </div>
          </div>
        )}
        <svg
          ref={svgRef}
          className={`w-full h-[400px] cursor-move bg-gradient-to-br from-gray-50 to-white ${isParsing ? 'opacity-50' : ''}`}
          onWheel={onWheel}
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
          {nodes.map((n, idx) => {
            const isJustAdded = justAdded === n.id;
            const isSelected = selectedId === n.id;
            
            // Detect overlaps and adjust size for lower layer
            // Check if this node overlaps with any other node
            let adjustedW = n.w;
            let adjustedH = n.h;
            
            for (let i = 0; i < nodes.length; i++) {
              if (i === idx) continue; // Skip self
              const other = nodes[i];
              
              // Check if boxes overlap
              const overlaps = !(
                n.x + n.w < other.x ||
                n.x > other.x + other.w ||
                n.y + n.h < other.y ||
                n.y > other.y + other.h
              );
              
              if (overlaps) {
                // Determine which node is "lower" (earlier in array = lower layer)
                // Make the lower node bigger to show all text
                if (idx < i) {
                  // This node is lower, make it bigger
                  // Increase size to accommodate overlapping content
                  // Add padding to ensure text is visible
                  const padding = 30; // Extra space to show text
                  adjustedW = Math.max(adjustedW, other.w + padding);
                  adjustedH = Math.max(adjustedH, other.h + padding);
                }
              }
            }
            
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
                    ? 'stroke-blue-500 stroke-2 shadow-md' 
                    : 'stroke-gray-300 stroke'
                } ${isJustAdded ? 'shadow-lg' : 'shadow-sm'}`}
                fill={n.color || 'white'}
                onMouseDown={(e) => handleMouseDownNode(e, n.id)}
                style={{
                  filter: isSelected ? 'drop-shadow(0 4px 6px rgba(59, 130, 246, 0.2))' : undefined,
                }}
              />
              {
                // Render label at top center and count at bottom center
                (() => {
                  const base = Math.max(10, Math.min(24, Math.floor(adjustedH / 4)));
                  const labelText = n.label || n.type;
                  const countText = n.count ? `×${n.count}` : '';
                  
                  // Estimate chars per line for label wrapping
                  const maxChars = Math.max(4, Math.floor((adjustedW - 12) / (base * 0.55)));
                  const wrapped: string[] = [];
                  const words = String(labelText).split(/\s+/);
                  let line = '';
                  for (const w of words) {
                    const test = line ? line + ' ' + w : w;
                    if (test.length > maxChars) {
                      wrapped.push(line || w);
                      line = line ? w : '';
                    } else {
                      line = test;
                    }
                  }
                  if (line) wrapped.push(line);
                  
                  // Limit lines to fit in top portion of box
                  const maxLines = Math.max(1, Math.floor((adjustedH / 2 - 8) / (base + 2)));
                  const labelLines = wrapped.slice(0, maxLines);
                  const textX = adjustedW / 2; // Center horizontally
                  
                  return (
                    <g>
                      {/* Label text at top center */}
                      {labelLines.length > 0 && (
                        <text 
                          x={textX} 
                          y={base + 4} 
                          className="fill-gray-700 select-none" 
                          textAnchor="middle" 
                          dominantBaseline="hanging" 
                          style={{ fontSize: base }}
                        >
                          {labelLines.map((ln, i) => (
                            <tspan key={i} x={textX} dy={i === 0 ? 0 : base + 2}>{ln}</tspan>
                          ))}
                        </text>
                      )}
                      {/* Count text at bottom center */}
                      {countText && (
                        <text 
                          x={textX} 
                          y={adjustedH - 4} 
                          className="fill-gray-700 select-none" 
                          textAnchor="middle" 
                          dominantBaseline="baseline" 
                          style={{ fontSize: base }}
                        >
                          {countText}
                        </text>
                      )}
                    </g>
                  );
                })()
              }
              <title>{(n.label || n.type) + (n.count ? ` ×${n.count}` : '')}</title>
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
}


