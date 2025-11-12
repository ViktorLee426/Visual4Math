import React, { useRef, useState } from 'react';

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
}

export default function LayoutCanvas({ nodes, setNodes, selectedId, onSelect, relations = [] }: LayoutCanvasProps) {
  const [scale, setScale] = useState(1);
  const [panning, setPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

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
    onSelect && onSelect(id);
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: MouseEvent) => onDrag(id, ev.clientX - start.x, ev.clientY - start.y);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const handleMouseDownHandle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: MouseEvent) => onResize(id, ev.clientX - start.x, ev.clientY - start.y);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="flex items-center justify-between px-2 py-1 border-b text-xs text-gray-600">
        <div>Zoom: {(scale * 100).toFixed(0)}%</div>
        <div className="space-x-2">
          <button className="px-2 py-0.5 border rounded" onClick={() => setScale(s => Math.max(0.3, s - 0.1))}>-</button>
          <button className="px-2 py-0.5 border rounded" onClick={() => setScale(s => Math.min(3, s + 0.1))}>+</button>
        </div>
      </div>
      <svg
        ref={svgRef}
        className="w-full h-[480px] cursor-move"
        onWheel={onWheel}
        onMouseDown={startPan}
        onMouseMove={movePan}
        onMouseUp={endPan}
        onMouseLeave={endPan}
      >
        {/* Grid */}
        <defs>
          <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#eee" strokeWidth="1" />
          </pattern>
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#smallGrid)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#ddd" strokeWidth="1" />
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
          {nodes.map(n => (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}>
              <rect
                x={0}
                y={0}
                width={n.w}
                height={n.h}
                rx={6}
                className={`stroke-gray-500 ${selectedId===n.id ? 'stroke-2' : 'stroke'} drop-shadow-sm`}
                fill={n.color || 'white'}
                onMouseDown={(e) => handleMouseDownNode(e, n.id)}
              />
              {
                // Dynamic font size + naive wrapping to keep text inside the box
                (() => {
                  const base = Math.max(10, Math.min(24, Math.floor(n.h / 4)));
                  const content = `${n.label || n.type}${n.count ? ` ×${n.count}` : ''}`;
                  // estimate chars per line based on width and font size (0.55 factor)
                  const maxChars = Math.max(4, Math.floor((n.w - 12) / (base * 0.55)));
                  const wrapped: string[] = [];
                  const words = String(content).split(/\s+/);
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
                  // clamp number of lines to fit box height
                  const maxLines = Math.max(1, Math.floor((n.h - 8) / (base + 2)));
                  const lines = wrapped.slice(0, maxLines);
                  return (
                    <text x={6} y={base} className="fill-gray-700 select-none" style={{ fontSize: base }}>
                      {lines.map((ln, i) => (
                        <tspan key={i} x={6} dy={i === 0 ? 0 : base + 2}>{ln}</tspan>
                      ))}
                    </text>
                  );
                })()
              }
              <title>{(n.label || n.type) + (n.count ? ` ×${n.count}` : '')}</title>
              {/* resize handle */}
              <rect
                x={n.w - 8}
                y={n.h - 8}
                width={8}
                height={8}
                className="fill-gray-600 cursor-se-resize"
                onMouseDown={(e) => handleMouseDownHandle(e, n.id)}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}


