import { useState } from 'react';
import HorizontalProgress from '../components/HorizontalProgress';
import LayoutCanvas from '../components/layout/LayoutCanvas';
import type { LayoutNode } from '../components/layout/LayoutCanvas';
import { generateImageFromPrompt } from '../services/imageApi';
import { exampleItems } from '../data/examples';
import PageNavigation from '../components/PageNavigation';

export default function Tool2LayoutPage() {
  const [prompt, setPrompt] = useState("");
  const [nodes, setNodes] = useState<LayoutNode[]>([]);
  type GenItem = { url: string; ts: number };
  const [generationHistory, setGenerationHistory] = useState<GenItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [relations] = useState<{ id: string; from: string; to: string; type: 'inside'|'next-to'|'on-top-of' }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  // reserved for future export improvements (intentionally unused)
  /* const svgWrapperRef = useRef<HTMLDivElement>(null); */

  const addNode = (type: 'box' | 'text') => {
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (type === 'box') {
      setNodes(prev => ([...prev, { id, type: 'box', x: 40, y: 40, w: 140, h: 90, label: 'object', count: undefined, color: '#ffffff' }]))
    } else {
      setNodes(prev => ([...prev, { id, type: 'text', x: 60, y: 60, w: 160, h: 40, label: 'text', color: '#ffffff' }]))
    }
  };

  const parseMWP = () => {
    // Minimal client-side stub for MVP (replace with /api/parse_mwp)
    // Heuristic: scan for numbers and simple objects
    const objs: LayoutNode[] = [];
    const text = prompt.toLowerCase();
    const push = (type: string, count?: number) => {
      const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      objs.push({ id, type, x: 60 + objs.length*30, y: 60 + objs.length*30, w: 120, h: 80, label: type, count });
    };
    // Look for simple counts: glue sticks, scissors
    const glueMatch = text.match(/(glue\s*sticks?|sticks?)/);
    const scissorMatch = text.match(/scissors?/);
    const nums = (text.match(/\b(\d+)\b/g)||[]).map(Number);
    if (glueMatch) push('glue sticks', nums[0]);
    if (scissorMatch) push('scissors', nums[1] ?? nums[0]);
    // Replace canvas with proposal
    setNodes(objs.length ? objs : [{ id: `n_${Date.now()}`, type: 'box', x: 80, y: 80, w: 160, h: 100, label: 'object' }]);
  };

  const exportSvgToPng = async (): Promise<string> => {
    // Render a temporary SVG element similar to LayoutCanvas for export
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', '800');
    svg.setAttribute('height', '600');
    svg.setAttribute('viewBox', '0 0 800 600');
    // background
    const bg = document.createElementNS(svg.namespaceURI, 'rect');
    bg.setAttribute('x', '-2000');
    bg.setAttribute('y', '-2000');
    bg.setAttribute('width', '4000');
    bg.setAttribute('height', '4000');
    bg.setAttribute('fill', 'white');
    svg.appendChild(bg);

    nodes.forEach(n => {
      const g = document.createElementNS(svg.namespaceURI, 'g');
      g.setAttribute('transform', `translate(${n.x},${n.y})`);
      const r = document.createElementNS(svg.namespaceURI, 'rect');
      r.setAttribute('x', '0'); r.setAttribute('y', '0');
      r.setAttribute('width', String(n.w)); r.setAttribute('height', String(n.h));
      r.setAttribute('rx', '6'); r.setAttribute('fill', 'white'); r.setAttribute('stroke', '#666');
      const t = document.createElementNS(svg.namespaceURI, 'text');
      t.setAttribute('x', '6'); t.setAttribute('y', '14'); t.setAttribute('font-size', '10'); t.textContent = `${n.label || n.type}${n.count ? ` ×${n.count}` : ''}`;
      g.appendChild(r); g.appendChild(t); svg.appendChild(g);
    });

    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const pngUrl: string = await new Promise((resolve) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800; canvas.height = 600;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 800, 600);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
    return pngUrl;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await exportSvgToPng();
      const sceneSpec = nodes.map(n => ({ type: n.type, label: n.label, count: n.count, x: n.x, y: n.y, w: n.w, h: n.h, color: n.color }));
      const guidance = `Follow this scene specification EXACTLY (object names and exact counts). Maintain relative positions and sizes.\nscene_spec=${JSON.stringify(sceneSpec)}`;
      const combined = `${prompt}\n\n${guidance}`;
      const url = await generateImageFromPrompt(combined);
      setGenerationHistory(prev => [{ url, ts: Date.now() }, ...prev].slice(0, 30));
      setSelectedIdx(0);
    } catch (e) {
      console.error(e);
      alert('Image generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <HorizontalProgress currentPage={4} />
      <div className="pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          {/* Tool Title - Top Left */}
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Tool2 - Layout-based interface</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left column: example + prompt + minimal palette */}
          <div className="lg:col-span-1 space-y-4">
            {/* Example card (uses image 2.png) */}
            {(() => {
              const example = exampleItems.find(e => e.id === '2') || exampleItems[0];
              return (
                <div className="border border-gray-200 rounded-lg p-3 bg-white">
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Example (for inspiration)</h3>
                  <p className="text-xs text-gray-700 leading-relaxed mb-2">{example.problemText}</p>
                  {example.imageUrl ? (
                    <img src={example.imageUrl} alt="Example" className="w-full h-auto rounded border" />
                  ) : (
                    <div className="text-center text-gray-400 text-xs py-6 border rounded">Example image will be provided</div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-2">This is just an example. Feel free to design your own layout.</p>
                </div>
              );
            })()}
            {/* Minimal palette */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900">Palette</h3>
              <div className="grid grid-cols-2 gap-2">
                <button className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50" onClick={()=>addNode('box')}>+ Box</button>
                <button className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50" onClick={()=>addNode('text')}>+ Text</button>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">Prompt</h3>
              <textarea
                className="w-full h-32 border border-gray-300 rounded p-2 text-sm"
                placeholder="Paste the math word problem here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <button onClick={parseMWP} className="px-3 py-1.5 border rounded text-sm">Parse Text</button>
                <button onClick={handleGenerate} className="px-3 py-1.5 bg-gray-900 text-white rounded text-sm">Generate</button>
              </div>
            </div>
            
          </div>

          {/* Main canvas */}
          <div className="lg:col-span-2 space-y-3">
            <LayoutCanvas nodes={nodes} setNodes={setNodes} relations={relations} />
            <ObjectList nodes={nodes} setNodes={setNodes} />
            <PageNavigation currentPage={4} />
          </div>

          {/* Right panel: generation history */}
          <div className="lg:col-span-1 space-y-3">
            <div className="border rounded p-3">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Generated Images</h3>
              {/* Selected preview + controls (always shown) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {selectedIdx>=0 && generationHistory[selectedIdx] ? new Date(generationHistory[selectedIdx].ts).toLocaleTimeString() : 'No selection'}
                  </span>
                  <div className="flex gap-1">
                    <button disabled={selectedIdx<=0} onClick={()=>setSelectedIdx(i=>Math.max(0,i-1))} className="px-2 py-0.5 border rounded text-xs disabled:opacity-40">Prev</button>
                    <button disabled={selectedIdx<0 || selectedIdx>=generationHistory.length-1} onClick={()=>setSelectedIdx(i=>Math.min(generationHistory.length-1, i+1))} className="px-2 py-0.5 border rounded text-xs disabled:opacity-40">Next</button>
                    {selectedIdx>=0 && generationHistory[selectedIdx] && (
                      <a href={generationHistory[selectedIdx].url} download className="px-2 py-0.5 border rounded text-xs">Download</a>
                    )}
                  </div>
                </div>
                {selectedIdx>=0 && generationHistory[selectedIdx] ? (
                  <img src={generationHistory[selectedIdx].url} className="w-full h-auto border rounded" />
                ) : (
                  <div className="w-full h-40 border border-dashed rounded flex items-center justify-center text-xs text-gray-400">No image yet</div>
                )}
              </div>
              {/* Thumbnails grid (always shown) */}
              <div className="max-h-[360px] overflow-auto grid grid-cols-2 gap-2 mt-3">
                {generationHistory.length === 0 ? (
                  <div className="col-span-2 text-center text-xs text-gray-400">History will appear here after generation.</div>
                ) : (
                  generationHistory.map((it, idx) => (
                    <button key={idx} onClick={()=>setSelectedIdx(idx)} className={`border rounded overflow-hidden ${idx===selectedIdx?'ring-2 ring-gray-900':''}`}>
                      <img src={it.url} className="w-full h-auto" />
                      <div className="text-[10px] text-gray-500 px-1 py-0.5 text-left">{new Date(it.ts).toLocaleTimeString()}</div>
                    </button>
                  ))
                )}
              </div>
              {isGenerating && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                  Generating image...
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ObjectList({ nodes, setNodes }: { nodes: LayoutNode[]; setNodes: (n: LayoutNode[]) => void }) {
  const update = (id: string, patch: Partial<LayoutNode>) => setNodes(nodes.map(n => n.id === id ? { ...n, ...patch } : n));
  const remove = (id: string) => setNodes(nodes.filter(n => n.id !== id));
  const duplicate = (id: string) => {
    const src = nodes.find(n => n.id === id); if (!src) return;
    const copy = { ...src, id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, x: src.x + 20, y: src.y + 20 };
    setNodes([...nodes, copy]);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <h3 className="text-sm font-medium text-gray-900 mb-2">Objects</h3>
      <div className="space-y-2">
        {nodes.map(n => (
          <div key={n.id} className="flex items-start gap-2 text-xs">
            <span className="px-1.5 py-0.5 bg-gray-100 rounded border self-center">{n.type}</span>
            {n.type === 'text' ? (
              <textarea className="border px-1 py-0.5 rounded w-40 h-12" value={n.label || ''} placeholder="text" onChange={(e) => update(n.id, { label: e.target.value })} />
            ) : (
              <input className="border px-1 py-0.5 rounded w-28" value={n.label || ''} placeholder="label" onChange={(e) => update(n.id, { label: e.target.value })} />
            )}
            {n.type !== 'text' && (
              <input className="border px-1 py-0.5 rounded w-16" value={n.count ?? ''} placeholder="count" onChange={(e) => update(n.id, { count: Number(e.target.value) || undefined })} />
            )}
            <input type="color" className="w-8 h-6 self-center" value={n.color || '#ffffff'} onChange={(e)=>update(n.id, { color: e.target.value })} />
            <span className="text-gray-400 self-center">({n.w}×{n.h})</span>
            <button className="border rounded px-1 self-center" onClick={() => duplicate(n.id)}>Duplicate</button>
            <button className="border rounded px-1 self-center" onClick={() => remove(n.id)}>Delete</button>
          </div>
        ))}
        {nodes.length === 0 && <p className="text-xs text-gray-400">Add objects from the palette to start.</p>}
      </div>
    </div>
  );
}

/*
function RelationEditor({ nodes, relations, setRelations }: { nodes: LayoutNode[]; relations: { id: string; from: string; to: string; type: 'inside'|'next-to'|'on-top-of' }[]; setRelations: (r: any)=>void }) {
  const add = () => {
    if (nodes.length < 2) return alert('Add at least two objects');
    setRelations([ ...relations, { id: `r_${Date.now()}`, from: nodes[0].id, to: nodes[1].id, type: 'next-to' } ]);
  };
  const update = (id: string, patch: Partial<{ from: string; to: string; type: 'inside'|'next-to'|'on-top-of' }>) => {
    setRelations(relations.map(r => r.id===id ? { ...r, ...patch } : r));
  };
  const remove = (id: string) => setRelations(relations.filter(r => r.id!==id));
  return (
    <div className="space-y-2 text-xs">
      <button className="border rounded px-2 py-1" onClick={add}>+ Add relation</button>
      {relations.map(r => (
        <div key={r.id} className="flex items-center gap-2">
          <select className="border rounded px-1 py-0.5" value={r.from} onChange={(e)=>update(r.id,{ from: e.target.value })}>
            {nodes.map(n => (<option key={n.id} value={n.id}>{n.label||n.type}</option>))}
          </select>
          <span className="text-gray-500">→</span>
          <select className="border rounded px-1 py-0.5" value={r.to} onChange={(e)=>update(r.id,{ to: e.target.value })}>
            {nodes.map(n => (<option key={n.id} value={n.id}>{n.label||n.type}</option>))}
          </select>
          <select className="border rounded px-1 py-0.5" value={r.type} onChange={(e)=>update(r.id,{ type: e.target.value as any })}>
            <option value="inside">inside</option>
            <option value="next-to">next to</option>
            <option value="on-top-of">on top of</option>
          </select>
          <button className="border rounded px-1" onClick={()=>remove(r.id)}>Delete</button>
        </div>
      ))}
      {relations.length===0 && <p className="text-gray-400">No relations.</p>}
    </div>
  );
}
*/


