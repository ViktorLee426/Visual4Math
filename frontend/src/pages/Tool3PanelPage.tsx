import React from 'react';
import HorizontalProgress from '../components/HorizontalProgress';
import { useEffect, useRef, useState } from 'react';
import { exampleItems } from '../data/examples';
import { iconLibrary } from '../components/icons/iconLibrary';
import PageNavigation from '../components/PageNavigation';

type Elem = { id: string; kind: 'icon'|'text'; x: number; y: number; w: number; h: number; svg?: string; text?: string };

export default function Tool3PanelPage() {
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

  const pushHistory = (prev: Elem[]) => {
    setUndoStack(s => [...s, prev].slice(-50));
    setRedoStack([]);
  };
  const addText = () => {
    pushHistory(elems);
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    setElems([...elems, { id, kind: 'text', x: 100, y: 100, w: 160, h: 40, text: 'Text' }]);
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
  const onResize = (id: string, dx: number, dy: number) => setElems(elems.map(e => e.id===id ? { ...e, w: Math.max(20, e.w + dx/scale), h: Math.max(20, e.h + dy/scale) } : e));

  const parseMWP = (text: string) => {
    const t = text.toLowerCase();
    const nums = (t.match(/\b(\d+)\b/g)||[]).map(Number);
    let a=nums[0], b=nums[1];
    const isAdd = /\+|add|plus/.test(t);
    const isSub = /-|minus|subtract/.test(t);
    const isMul = /x|\*|times|multiply/.test(t);
    const isDiv = /÷|\/|divide|divided/.test(t);
    // choose icon based on keywords
    const pickIcon = () => {
      if (/cube/.test(t)) return iconLibrary.find(i=>i.name.startsWith('cube'))?.svg || iconLibrary[0].svg;
      if (/ball|basketball/.test(t)) return iconLibrary.find(i=>i.name==='basketball')?.svg || iconLibrary[0].svg;
      if (/scissor/.test(t)) return iconLibrary.find(i=>i.name==='scissors')?.svg || iconLibrary[0].svg;
      if (/glue/.test(t)) return iconLibrary.find(i=>i.name==='glue stick')?.svg || iconLibrary[0].svg;
      return iconLibrary[0].svg;
    };
    const icon = pickIcon();
    const layout: Elem[] = [];
    const startX = 100, startY = 120, gap = 26;
    const pushIcon = (x:number,y:number) => layout.push({ id:`e_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, kind:'icon', x, y, w:36, h:36, svg:icon });
    // More-than pattern: "how many more ... than ..."
    const howManyMore = /how many more/.test(t);
    if (howManyMore && a && b) {
      for (let i=0;i<a;i++) pushIcon(startX + (i%10)*gap, startY + Math.floor(i/10)*gap);
      for (let i=0;i<b;i++) pushIcon(startX + (i%10)*gap, startY + 50 + Math.floor(i/10)*gap);
      layout.push({ id:`t_${Date.now()}`, kind:'text', x:startX, y:startY-30, w:260, h:40, text:`Top ${a}, bottom ${b}. How many more?` });
    } else if (isSub && a && b) {
      for (let i=0;i<a;i++) pushIcon(startX + (i%5)*gap, startY + Math.floor(i/5)*gap);
      for (let i=0;i<b;i++) pushIcon(startX + (i%5)*gap, startY + 60 + Math.floor(i/5)*gap);
      layout.push({ id:`t_${Date.now()}`, kind:'text', x:startX+130, y:startY+20, w:160, h:40, text:'How many left?' });
    } else if (isAdd && a && b) {
      for (let i=0;i<a;i++) pushIcon(startX + (i%5)*gap, startY);
      for (let i=0;i<b;i++) pushIcon(startX + (i%5)*gap, startY+40);
      layout.push({ id:`t_${Date.now()}`, kind:'text', x:startX+130, y:startY+10, w:160, h:40, text:'Total?' });
    } else if (isMul && a && b) {
      for (let r=0;r<a;r++) for (let c=0;c<b;c++) pushIcon(startX + c*gap, startY + r*gap);
      layout.push({ id:`t_${Date.now()}`, kind:'text', x:startX+130, y:startY+10, w:160, h:40, text:'How many in all?' });
    } else if (isDiv && a && b) {
      for (let i=0;i<a;i++) pushIcon(startX + (i%5)*gap, startY + Math.floor(i/5)*gap);
      layout.push({ id:`t_${Date.now()}`, kind:'text', x:startX+130, y:startY+10, w:160, h:40, text:`Split into ${b} groups` });
    }
    pushHistory(elems);
    setElems(layout);
  };

  // keyboard shortcuts for copy/paste/undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC')>=0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase()==='z') { // undo
        e.preventDefault();
        if (undoStack.length) {
          const prev = undoStack[undoStack.length-1];
          setUndoStack(s=>s.slice(0,-1));
          setRedoStack(s=>[elems, ...s].slice(0,50));
          setElems(prev);
        }
      } else if (e.key.toLowerCase()==='y') { // redo
        e.preventDefault();
        if (redoStack.length) {
          const next = redoStack[0];
          setRedoStack(s=>s.slice(1));
          setUndoStack(s=>[...s, elems].slice(-50));
          setElems(next);
        }
      } else if (e.key.toLowerCase()==='c') {
        e.preventDefault();
        const sel = elems.find(e=>e.id===selectedId);
        if (sel) setCopyBuffer({ ...sel });
      } else if (e.key.toLowerCase()==='v') {
        e.preventDefault();
        if (copyBuffer) {
          pushHistory(elems);
          const dup = { ...copyBuffer, id:`e_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, x: copyBuffer.x+20, y: copyBuffer.y+20 };
          setElems([...elems, dup]);
          setSelectedId(dup.id);
        }
      }
    };
    const delHandler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        pushHistory(elems);
        setElems(prev => prev.filter(el => el.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keydown', delHandler);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keydown', delHandler); };
  }, [elems, selectedId, undoStack, redoStack, copyBuffer]);

  // export current canvas to PNG (without resize handles)
  const exportCanvasToPng = async (): Promise<string> => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', '900');
    svg.setAttribute('height', '520');
    svg.setAttribute('viewBox', '0 0 900 520');
    const g = document.createElementNS(svg.namespaceURI, 'g');
    g.setAttribute('transform', `translate(0,0) scale(1)`);
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
        t.setAttribute('x', String(e.x)); t.setAttribute('y', String(e.y));
        t.setAttribute('font-size', '14'); t.setAttribute('fill', '#111');
        t.textContent = e.text || '';
        g.appendChild(t);
      }
    });
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const pngUrl: string = await new Promise((resolve) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 900; canvas.height = 520;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 900, 520);
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
      <HorizontalProgress currentPage={5} />
      <div className="pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          {/* Tool Title - Top Left */}
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Tool3 - Free manipulation</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Example and parse */}
          <div className="lg:col-span-1 space-y-4">
            {(() => {
              const example = exampleItems.find(e => e.id==='3') || exampleItems[0];
              return (
                <div className="border border-gray-200 rounded-lg p-3 bg-white">
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Example (for inspiration)</h3>
                  <p className="text-xs text-gray-700 leading-relaxed mb-2">{example.problemText}</p>
                  {example.imageUrl && (<img src={example.imageUrl} className="w-full h-auto border rounded" />)}
                  <p className="text-[10px] text-gray-400 mt-2">This is just an example. Feel free to design your own visualization.</p>
                </div>
              );
            })()}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">Problem</h3>
              <textarea id="t3-prompt" className="w-full h-24 border border-gray-300 rounded p-2 text-sm" placeholder="Paste a math word problem (grade 1–3)…" />
              <div className="flex gap-2 mt-2">
                <button className="px-3 py-1.5 border rounded text-sm" onClick={()=>{
                  const el = document.getElementById('t3-prompt') as HTMLTextAreaElement; parseMWP(el?.value || '');
                }}>Parse</button>
                <button className="px-3 py-1.5 border rounded text-sm" onClick={addText}>+ Text</button>
              </div>
            </div>
          </div>

          {/* Center: Canvas */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div>Zoom: {(scale*100).toFixed(0)}%</div>
              <div className="space-x-2">
                <button className="px-2 py-0.5 border rounded" onClick={()=>setScale(s=>Math.max(0.3, s-0.1))}>-</button>
                <button className="px-2 py-0.5 border rounded" onClick={()=>setScale(s=>Math.min(3, s+0.1))}>+</button>
                <button className="px-2 py-0.5 border rounded" onClick={async()=>{
                  const png = await exportCanvasToPng();
                  setSnapshots(prev => [{ url: png, ts: Date.now() }, ...prev].slice(0,50));
                }}>Save Snapshot</button>
              </div>
            </div>
            <svg ref={svgRef} className="w-full h-[520px] border rounded bg-white"
              onWheel={(e)=>{e.preventDefault(); const d=-e.deltaY; setScale(s=>Math.min(3, Math.max(0.3, s + d*0.001)));}}
              onMouseDown={(e)=>{ if ((e.target as Element).tagName==='svg'){ setPanning(true); (window as any)._panStart={ x:e.clientX-pan.x, y:e.clientY-pan.y }; } }}
              onMouseMove={(e)=>{ if (panning && (window as any)._panStart){ const s=(window as any)._panStart; setPan({ x:e.clientX - s.x, y:e.clientY - s.y }); } }}
              onMouseUp={()=>setPanning(false)} onMouseLeave={()=>setPanning(false)}
              onDragOver={(e)=>e.preventDefault()}
              onDrop={(e)=>{ e.preventDefault(); const data=e.dataTransfer?.getData('text/plain'); if(!data || !svgRef.current) return; const rect=svgRef.current.getBoundingClientRect(); const cx = (e.clientX-rect.left - pan.x)/scale; const cy = (e.clientY-rect.top - pan.y)/scale; addIconAt(data, cx, cy); }}
            >
              <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
              {elems.map(e => (
                <Draggable key={e.id} onDrag={(dx,dy)=>onDrag(e.id,dx,dy)}>
                  {e.kind==='icon' && e.svg && (
                    <>
                      <image href={`data:image/svg+xml;utf8,${encodeURIComponent(e.svg)}`} x={e.x} y={e.y} width={e.w} height={e.h} onClick={()=>setSelectedId(e.id)} />
                      <ResizeHandle x={e.x+e.w-8} y={e.y+e.h-8} onResize={(dx,dy)=>onResize(e.id,dx,dy)} />
                    </>
                  )}
                  {e.kind==='text' && (
                    <EditableText x={e.x} y={e.y} w={e.w} h={e.h} text={e.text||''} onChange={(t)=>setElems(prev=>prev.map(it=>it.id===e.id?{...it, text:t}:it))} onResize={(dx,dy)=>onResize(e.id,dx,dy)} onSelect={()=>setSelectedId(e.id)} />
                  )}
                </Draggable>
              ))}
              </g>
            </svg>
            <PageNavigation currentPage={5} />
          </div>

          {/* Right: Icon search */}
          <div className="lg:col-span-1 space-y-3">
            <div className="border rounded p-3">
              <h3 className="text-sm font-medium text-gray-900 mb-1">Snapshots</h3>
              <div className="max-h-[200px] overflow-auto grid grid-cols-2 gap-2">
                {snapshots.length===0 ? (
                  <div className="col-span-2 text-center text-xs text-gray-400">Use Save Snapshot to store canvas images.</div>
                ) : (
                  snapshots.map((s, idx) => (
                    <a key={idx} href={s.url} download={`snapshot-${idx}.png`} className="border rounded overflow-hidden">
                      <img src={s.url} className="w-full h-auto" />
                    </a>
                  ))
                )}
              </div>
            </div>
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
              <div className="grid grid-cols-4 gap-2 mt-2 max-h-[420px] overflow-auto">
                {iconLibrary.map((ic, idx) => (
                  <button key={idx} data-icon-name={ic.name.toLowerCase()} className="border rounded p-1 hover:bg-gray-50" onClick={()=>addIcon(ic.svg)} draggable onDragStart={(e)=>e.dataTransfer?.setData('text/plain', ic.svg)}>
                    <div className="text-[10px] text-gray-500 truncate" title={ic.name}>{ic.name}</div>
                    <img src={`data:image/svg+xml;utf8,${encodeURIComponent(ic.svg)}`} className="h-10 w-auto mx-auto" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Draggable({ children, onDrag }: { children: React.ReactNode; onDrag: (dx:number,dy:number)=>void }) {
  const onMouseDown = (e: React.MouseEvent<SVGElement>) => {
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: MouseEvent) => onDrag(ev.clientX - start.x, ev.clientY - start.y);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  return (
    <g onMouseDown={onMouseDown} style={{ cursor: 'move' }}>
      {children}
    </g>
  );
}

function ResizeHandle({ x, y, onResize }: { x:number; y:number; onResize:(dx:number,dy:number)=>void }) {
  const onMouseDown = (e: React.MouseEvent<SVGRectElement>) => {
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: MouseEvent) => onResize(ev.clientX - start.x, ev.clientY - start.y);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  return <rect x={x} y={y} width={8} height={8} className="fill-gray-600 cursor-se-resize" onMouseDown={onMouseDown} />;
}

function EditableText({ x, y, w, h, text, onChange, onResize, onSelect }: { x:number; y:number; w:number; h:number; text:string; onChange:(t:string)=>void; onResize:(dx:number,dy:number)=>void; onSelect?:()=>void }) {
  const base = 14;
  const onDblClick = () => {
    const t = prompt('Edit text:', text || '') ?? text;
    onChange(t);
  };
  return (
    <>
      <rect x={x-4} y={y-16} width={w} height={h} rx={6} className="fill-white opacity-80 stroke-gray-300" onDoubleClick={onDblClick} onClick={onSelect} />
      <text x={x} y={y} className="fill-gray-800 select-none" style={{ fontSize: base }} onDoubleClick={onDblClick} onClick={onSelect}>{text}</text>
      <ResizeHandle x={x+w-8} y={y+h-8} onResize={onResize} />
    </>
  );
}


