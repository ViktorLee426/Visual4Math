import React, { useState, useRef, useEffect } from 'react';
import HorizontalProgress from '../components/HorizontalProgress';
import LayoutCanvas from '../components/layout/LayoutCanvas';
import type { LayoutNode } from '../components/layout/LayoutCanvas';
import { generateImageFromPrompt } from '../services/imageApi';
import { parseMathWordProblem, type LayoutItem } from '../services/parseApi';
import { exampleItems } from '../data/examples';
import PageNavigation from '../components/PageNavigation';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const API_BASE_URL = rawBaseUrl !== undefined
  ? rawBaseUrl.trim().replace(/\/$/, "")
  : "http://localhost:8000";

// Helper function to ensure image URLs work locally
const getImageUrl = (url: string): string => {
  // If it's already a full URL (http/https), use as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // If it's a relative URL (starts with /), prepend API base URL
  if (url.startsWith('/')) {
    return `${API_BASE_URL}${url}`;
  }
  // Otherwise, assume it's relative and prepend API base URL
  return `${API_BASE_URL}/${url}`;
};

export default function Tool2LayoutPage() {
  const [prompt, setPrompt] = useState("");
  const [nodes, setNodes] = useState<LayoutNode[]>([]);
  type GenItem = { url: string; ts: number; generationTime?: number };
  const [generationHistory, setGenerationHistory] = useState<GenItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [relations, setRelations] = useState<{ id: string; from: string; to: string; type: 'inside'|'next-to'|'on-top-of' }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [generationTime, setGenerationTime] = useState<number>(0);
  const [copiedNode, setCopiedNode] = useState<LayoutNode | null>(null);
  const [history, setHistory] = useState<LayoutNode[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  
  // Initialize history when nodes change externally (e.g., from parse)
  useEffect(() => {
    // Only initialize if history is empty or if we're at the start
    if (history.length === 1 && history[0].length === 0 && nodes.length > 0) {
      setHistory([nodes]);
      setHistoryIndex(0);
    }
  }, [nodes.length]); // Only check length to avoid infinite loops
  const [enlargedImageIdx, setEnlargedImageIdx] = useState<number | null>(null);
  const generationStartTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Save state to history
  const saveToHistory = (newNodes: LayoutNode[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push([...newNodes]);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  };

  // Undo/Redo handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setNodes([...history[newIndex]]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setNodes([...history[newIndex]]);
    }
  };

  const addNode = (type: 'box' | 'text') => {
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newNode = type === 'box' 
      ? { id, type: 'box' as const, x: 40, y: 40, w: 140, h: 90, label: 'object', count: undefined, color: '#ffffff' }
      : { id, type: 'text' as const, x: 60, y: 60, w: 160, h: 40, label: 'text', color: '#ffffff' };
    
    const newNodes = [...nodes, newNode];
    saveToHistory(newNodes);
    setNodes(newNodes);
    // Visual feedback: highlight newly added element
    setJustAdded(id);
    setTimeout(() => setJustAdded(null), 600);
  };

  // Delete selected node
  const handleDeleteNode = (id: string) => {
    const newNodes = nodes.filter(n => n.id !== id);
    saveToHistory(newNodes);
    setNodes(newNodes);
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
    }
  };

  // Copy selected node
  const handleCopyNode = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (node) {
      setCopiedNode(node);
    }
  };

  // Paste copied node with offset
  const handlePasteNode = () => {
    if (!copiedNode) return;
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newNode: LayoutNode = {
      ...copiedNode,
      id,
      x: copiedNode.x + 20, // Offset by 20px
      y: copiedNode.y + 20,
    };
    const newNodes = [...nodes, newNode];
    saveToHistory(newNodes);
    setNodes(newNodes);
    setSelectedNodeId(id);
    setJustAdded(id);
    setTimeout(() => setJustAdded(null), 600);
  };

  // Update nodes with history tracking (for drag/resize end)
  const handleNodesChange = (newNodes: LayoutNode[]) => {
    setNodes(newNodes);
    // History is saved in drag/resize handlers
  };

  // Handle relation creation
  const handleRelationCreate = (from: string, to: string) => {
    // Default to 'inside' relationship - can be changed later
    const newRelation = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      from,
      to,
      type: 'inside' as const,
    };
    setRelations(prev => [...prev, newRelation]);
  };

  const parseMWP = async () => {
    if (!prompt.trim()) {
      alert('Please enter a math word problem first.');
      return;
    }
    
    setIsParsing(true);
    try {
      const response = await parseMathWordProblem(prompt);
      const layoutItems = response.layout;
      
      // Convert layout items to LayoutNode format
      const newNodes: LayoutNode[] = layoutItems.map((item: LayoutItem, idx: number) => ({
        id: `n_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        type: item.type,
        label: item.label,
        count: item.count ?? undefined,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        color: item.color || '#ffffff',
      }));
      
      // Save to history and update nodes
      // Reset history when parsing (new starting point)
      setHistory([newNodes]);
      setHistoryIndex(0);
      setNodes(newNodes);
      
      // Visual feedback
      if (newNodes.length > 0) {
        setJustAdded(newNodes[0].id);
        setTimeout(() => setJustAdded(null), 600);
      }
    } catch (error) {
      console.error('Parse error:', error);
      alert('Failed to parse problem. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  // Build detailed text-based layout prompt from canvas
  const buildLayoutPrompt = (): string => {
    if (nodes.length === 0) {
      return prompt; // Just use original prompt if no layout
    }

    // Analyze canvas to create explicit layout description
    const layoutItems: string[] = [];
    const countRequirements: string[] = [];
    const spatialRelations: string[] = [];

    // Process each node
    nodes.forEach((n, idx) => {
      const itemName = n.label || n.type;
      const itemCount = n.count;
      
      // Build item description
      let itemDesc = `${idx + 1}. ${itemName}`;
      if (itemCount !== undefined && itemCount !== null) {
        itemDesc += `: EXACTLY ${itemCount} ${itemName}${itemCount === 1 ? '' : 's'}`;
        // Add explicit count requirement
        countRequirements.push(`- Show EXACTLY ${itemCount} ${itemName}${itemCount === 1 ? '' : 's'} (not ${itemCount - 1}, not ${itemCount + 1}, precisely ${itemCount} items)`);
      } else {
        itemDesc += `: ${itemName}`;
      }
      
      // Add position info
      const relativeX = Math.round((n.x / 800) * 100);
      const relativeY = Math.round((n.y / 600) * 100);
      itemDesc += ` positioned at approximately ${relativeX}% from left, ${relativeY}% from top`;
      
      // Add size info
      if (n.w && n.h) {
        const sizeDesc = n.w > n.h ? 'wide' : n.w < n.h ? 'tall' : 'square';
        itemDesc += `, ${sizeDesc} shape`;
      }
      
      layoutItems.push(itemDesc);
    });

    // Detect spatial relationships (containment)
    nodes.forEach(n1 => {
      nodes.forEach(n2 => {
        if (n1.id !== n2.id) {
          const n2CenterX = n2.x + n2.w / 2;
          const n2CenterY = n2.y + n2.h / 2;
          const isInside = n2CenterX > n1.x && n2CenterX < n1.x + n1.w &&
                           n2CenterY > n1.y && n2CenterY < n1.y + n1.h;
          if (isInside) {
            const n1Name = n1.label || n1.type;
            const n2Name = n2.label || n2.type;
            const n2Count = n2.count ? ` (${n2.count} ${n2Name}${n2.count === 1 ? '' : 's'})` : '';
            spatialRelations.push(`${n2Name}${n2Count} is contained inside ${n1Name}`);
          }
        }
      });
    });

    // Build comprehensive prompt
    let layoutPrompt = `${prompt}\n\n`;
    layoutPrompt += `=== LAYOUT SPECIFICATION (MUST FOLLOW EXACTLY) ===\n\n`;
    
    if (countRequirements.length > 0) {
      layoutPrompt += `CRITICAL COUNT REQUIREMENTS:\n`;
      countRequirements.forEach(req => layoutPrompt += `${req}\n`);
      layoutPrompt += `\nVERIFY: Count each object type and ensure the numbers match EXACTLY.\n\n`;
    }
    
    layoutPrompt += `OBJECTS IN SCENE:\n`;
    layoutItems.forEach(item => layoutPrompt += `${item}\n`);
    layoutPrompt += `\n`;
    
    if (spatialRelations.length > 0) {
      layoutPrompt += `SPATIAL RELATIONSHIPS:\n`;
      spatialRelations.forEach(rel => layoutPrompt += `- ${rel}\n`);
      layoutPrompt += `\n`;
    }
    
    layoutPrompt += `=== END LAYOUT SPECIFICATION ===\n\n`;
    layoutPrompt += `Generate the visualization following this layout EXACTLY. Pay special attention to object counts - they must be precise.`;

    return layoutPrompt;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationTime(0);
    generationStartTimeRef.current = Date.now();
    
    // Start timer
    timerIntervalRef.current = window.setInterval(() => {
      if (generationStartTimeRef.current) {
        const elapsed = (Date.now() - generationStartTimeRef.current) / 1000;
        setGenerationTime(elapsed);
      }
    }, 100); // Update every 100ms for smooth display
    
    try {
      // Build detailed text-based layout prompt from canvas
      const layoutPrompt = buildLayoutPrompt();
      
      // Generate image using text-based layout prompt (no reference image)
      const url = await generateImageFromPrompt(layoutPrompt);
      const finalTime = generationStartTimeRef.current ? (Date.now() - generationStartTimeRef.current) / 1000 : 0;
      
      // Ensure URL works locally
      const fullUrl = getImageUrl(url);
      
      setGenerationHistory(prev => [{ url: fullUrl, ts: Date.now(), generationTime: finalTime }, ...prev].slice(0, 30));
      setSelectedIdx(0);
    } catch (e) {
      console.error(e);
      alert('Image generation failed.');
    } finally {
      setIsGenerating(false);
      setGenerationTime(0);
      generationStartTimeRef.current = null;
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Keyboard navigation for enlarged image
  useEffect(() => {
    if (enlargedImageIdx === null) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEnlargedImageIdx(null);
      } else if (e.key === 'ArrowLeft' && enlargedImageIdx > 0) {
        setEnlargedImageIdx(enlargedImageIdx - 1);
      } else if (e.key === 'ArrowRight' && enlargedImageIdx < generationHistory.length - 1) {
        setEnlargedImageIdx(enlargedImageIdx + 1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enlargedImageIdx, generationHistory.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <HorizontalProgress currentPage={4} />
      <div className="pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-6">
          {/* Tool Title - Elegant header */}
          <div className="mb-8">
            <h1 className="text-3xl font-light text-gray-800 mb-2">Tool2 - Layout-based</h1>
            <p className="text-sm text-gray-500">Create visual layouts by arranging elements on the canvas</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left column: example + prompt + palette */}
          <div className="lg:col-span-1 space-y-5">
            {/* Example card - Elevated design */}
            {(() => {
              const example = exampleItems.find(e => e.id === '2') || exampleItems[0];
              return (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow duration-200">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Example</h3>
                  <p className="text-xs text-gray-600 leading-relaxed mb-3">{example.problemText}</p>
                  {example.imageUrl ? (
                    <img src={example.imageUrl} alt="Example" className="w-full h-auto rounded-lg shadow-sm" />
                  ) : (
                    <div className="text-center text-gray-400 text-xs py-8 border-2 border-dashed border-gray-200 rounded-lg">Example image</div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-3 italic">Design your own layout freely</p>
                </div>
              );
            })()}
            
            {/* Palette - Interactive buttons */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Elements</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <button 
                  onClick={()=>addNode('box')}
                  className="group relative px-4 py-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-lg text-sm font-medium text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  <span className="relative z-10 flex items-center justify-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    Box
                  </span>
                </button>
                <button 
                  onClick={()=>addNode('text')}
                  className="group relative px-4 py-3 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-lg text-sm font-medium text-purple-700 hover:from-purple-100 hover:to-pink-100 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  <span className="relative z-10 flex items-center justify-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Text
                  </span>
                </button>
              </div>
            </div>
            
            {/* Prompt section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Problem</h3>
              <textarea
                className="w-full h-32 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                placeholder="Paste the math word problem here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="flex gap-2 mt-3">
                <button 
                  onClick={parseMWP}
                  disabled={isParsing}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isParsing ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-600 border-t-transparent" />
                      <span>Parsing...</span>
                    </>
                  ) : (
                    'Parse'
                  )}
                </button>
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-lg text-sm font-medium hover:from-gray-800 hover:to-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                >
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>

          {/* Main canvas */}
          <div className="lg:col-span-2 space-y-4">
            <LayoutCanvas 
              nodes={nodes} 
              setNodes={handleNodesChange} 
              relations={relations} 
              justAdded={justAdded}
              selectedId={selectedNodeId}
              onSelect={setSelectedNodeId}
              onDelete={handleDeleteNode}
              onCopy={handleCopyNode}
              onPaste={handlePasteNode}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
              onHistorySave={saveToHistory}
              isParsing={isParsing}
            />
            <ObjectList nodes={nodes} setNodes={setNodes} onUpdate={saveToHistory} />
            <PageNavigation currentPage={4} />
          </div>

          {/* Right panel: generation history */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sticky top-24">
              <h3 className="text-xs font-semibold text-gray-700 mb-4 uppercase tracking-wide">Gallery</h3>
              
              {/* Selected preview */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent" />
                        <span className="text-xs text-gray-600 font-medium">
                          {generationTime.toFixed(1)}s
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {selectedIdx>=0 && generationHistory[selectedIdx] 
                          ? `${generationHistory[selectedIdx].generationTime ? `${generationHistory[selectedIdx].generationTime.toFixed(1)}s` : ''}`
                          : 'No selection'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button 
                      disabled={selectedIdx<=0 || isGenerating} 
                      onClick={()=>setSelectedIdx(i=>Math.max(0,i-1))} 
                      className="px-2 py-1 border border-gray-200 rounded text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      ←
                    </button>
                    <button 
                      disabled={(selectedIdx<0 || selectedIdx>=generationHistory.length-1) || isGenerating} 
                      onClick={()=>setSelectedIdx(i=>Math.min(generationHistory.length-1, i+1))} 
                      className="px-2 py-1 border border-gray-200 rounded text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      →
                    </button>
                    {selectedIdx>=0 && generationHistory[selectedIdx] && !isGenerating && (
                      <a 
                        href={generationHistory[selectedIdx].url} 
                        download 
                        className="px-2 py-1 border border-gray-200 rounded text-xs hover:bg-gray-50 transition-colors"
                      >
                        ↓
                      </a>
                    )}
                  </div>
                </div>
                {isGenerating ? (
                  <div className="w-full h-40 border-2 border-dashed border-blue-200 rounded-lg flex items-center justify-center bg-blue-50">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto mb-2" />
                      <p className="text-xs text-gray-600">Generating...</p>
                      <p className="text-[10px] text-gray-500 mt-1">{generationTime.toFixed(1)}s</p>
                    </div>
                  </div>
                ) : selectedIdx>=0 && generationHistory[selectedIdx] ? (
                  <button
                    onClick={() => setEnlargedImageIdx(selectedIdx)}
                    className="w-full rounded-lg overflow-hidden shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <img src={generationHistory[selectedIdx].url} className="w-full h-auto" alt="Generated" />
                  </button>
                ) : (
                  <div className="w-full h-40 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400 bg-gray-50">
                    <div className="text-center">
                      <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p>No image yet</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Thumbnails grid */}
              <div className="max-h-[360px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {generationHistory.length === 0 ? (
                    <div className="col-span-2 text-center text-xs text-gray-400 py-8">
                      <p>History will appear here</p>
                      <p className="text-[10px] mt-1">after generation</p>
                    </div>
                  ) : (
                    generationHistory.map((it, idx) => (
                      <button 
                        key={idx} 
                        onClick={()=>setEnlargedImageIdx(idx)} 
                        className={`group relative rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                          idx===selectedIdx 
                            ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' 
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <img src={it.url} className="w-full h-auto" alt={`Generated ${idx + 1}`} />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity duration-200" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                          <div className="text-[9px] text-white text-left">
                            {it.generationTime && <span>{it.generationTime.toFixed(1)}s</span>}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
              
            </div>
          </div>
          </div>
        </div>
      </div>
      
      {/* Enlarged Image Modal */}
      {enlargedImageIdx !== null && generationHistory[enlargedImageIdx] && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setEnlargedImageIdx(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden">
            {/* Close button */}
            <button
              onClick={() => setEnlargedImageIdx(null)}
              className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
              title="Close (Esc)"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Navigation buttons */}
            {generationHistory.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEnlargedImageIdx(prev => prev !== null ? Math.max(0, prev - 1) : null);
                  }}
                  disabled={enlargedImageIdx === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-3 shadow-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous (←)"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEnlargedImageIdx(prev => prev !== null ? Math.min(generationHistory.length - 1, prev + 1) : null);
                  }}
                  disabled={enlargedImageIdx === generationHistory.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-3 shadow-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next (→)"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            
            {/* Image */}
            <div className="p-4">
              <img 
                src={generationHistory[enlargedImageIdx].url} 
                className="max-w-full max-h-[85vh] mx-auto rounded-lg" 
                alt={`Generated image ${enlargedImageIdx + 1}`}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            
            {/* Image info */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg text-xs">
              Image {enlargedImageIdx + 1} of {generationHistory.length}
              {generationHistory[enlargedImageIdx].generationTime && (
                <span className="ml-2 opacity-80">• {generationHistory[enlargedImageIdx].generationTime.toFixed(1)}s</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Auto-expanding textarea component
function AutoExpandingTextarea({ value, placeholder, onChange }: { value: string; placeholder?: string; onChange: (value: string) => void }) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height based on content, with min and max constraints
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 32), 200); // Min 32px (1 line), max 200px (~8 lines)
      textarea.style.height = `${newHeight}px`;
    }
  }, [value]);
  
  return (
    <textarea
      ref={textareaRef}
      className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white resize-none overflow-y-auto"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      style={{ minHeight: '32px', maxHeight: '200px' }}
    />
  );
}

function ObjectList({ nodes, setNodes, onUpdate, relations = [], setRelations, selectedNodeId }: { 
  nodes: LayoutNode[]; 
  setNodes: (n: LayoutNode[]) => void; 
  onUpdate?: (newNodes: LayoutNode[]) => void;
  relations?: { id: string; from: string; to: string; type: 'inside'|'next-to'|'on-top-of' }[];
  setRelations?: (r: { id: string; from: string; to: string; type: 'inside'|'next-to'|'on-top-of' }[]) => void;
  selectedNodeId?: string | null;
}) {
  const update = (id: string, patch: Partial<LayoutNode>) => {
    const newNodes = nodes.map(n => n.id === id ? { ...n, ...patch } : n);
    setNodes(newNodes);
    onUpdate && onUpdate(newNodes);
  };
  const remove = (id: string) => {
    const newNodes = nodes.filter(n => n.id !== id);
    setNodes(newNodes);
    onUpdate && onUpdate(newNodes);
    // Also remove relations involving this node
    if (setRelations) {
      setRelations(relations.filter(r => r.from !== id && r.to !== id));
    }
  };
  const duplicate = (id: string) => {
    const src = nodes.find(n => n.id === id); if (!src) return;
    const copy = { ...src, id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, x: src.x + 20, y: src.y + 20 };
    const newNodes = [...nodes, copy];
    setNodes(newNodes);
    onUpdate && onUpdate(newNodes);
  };
  
  // Get relations for selected node
  const selectedRelations = selectedNodeId ? relations.filter(r => r.from === selectedNodeId || r.to === selectedNodeId) : [];
  const updateRelation = (relId: string, newType: 'inside'|'next-to'|'on-top-of') => {
    if (setRelations) {
      setRelations(relations.map(r => r.id === relId ? { ...r, type: newType } : r));
    }
  };
  const deleteRelation = (relId: string) => {
    if (setRelations) {
      setRelations(relations.filter(r => r.id !== relId));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Properties</h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {nodes.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="text-xs text-gray-400">Add elements from the palette</p>
          </div>
        ) : (
          nodes.map(n => (
            <div key={n.id} className="group bg-gray-50 rounded-lg p-2 border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all duration-200">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-white rounded-md text-[10px] font-medium text-gray-600 border border-gray-200 uppercase whitespace-nowrap">
                  {n.type}
                </span>
                <input 
                  type="color" 
                  className="w-6 h-6 rounded border border-gray-200 cursor-pointer flex-shrink-0" 
                  value={n.color || '#ffffff'} 
                  onChange={(e)=>update(n.id, { color: e.target.value })} 
                />
                <span className="text-[10px] text-gray-400 whitespace-nowrap">({n.w}×{n.h})</span>
                {n.type === 'text' ? (
                  <div className="flex-1 flex items-center gap-2">
                    <AutoExpandingTextarea
                      value={n.label || ''} 
                      placeholder="Enter text..." 
                      onChange={(value) => update(n.id, { label: value })} 
                    />
                    <input 
                      className="w-20 border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white flex-shrink-0" 
                      value={n.count ?? ''} 
                      placeholder="Count" 
                      onChange={(e) => update(n.id, { count: Number(e.target.value) || undefined })} 
                    />
                  </div>
                ) : (
                  <>
                    <input 
                      className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white" 
                      value={n.label || ''} 
                      placeholder="Label" 
                      onChange={(e) => update(n.id, { label: e.target.value })} 
                    />
                    <input 
                      className="w-16 border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white" 
                      value={n.count ?? ''} 
                      placeholder="Count" 
                      onChange={(e) => update(n.id, { count: Number(e.target.value) || undefined })} 
                    />
                  </>
                )}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button 
                    onClick={() => duplicate(n.id)}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Duplicate"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => remove(n.id)}
                    className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Relations section */}
        {selectedNodeId && selectedRelations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Relationships</h4>
            <div className="space-y-2">
              {selectedRelations.map(rel => {
                const otherNode = nodes.find(n => n.id === (rel.from === selectedNodeId ? rel.to : rel.from));
                const isFrom = rel.from === selectedNodeId;
                return (
                  <div key={rel.id} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-600">
                        {isFrom ? '→' : '←'} {otherNode?.label || otherNode?.type || 'Unknown'}
                      </span>
                      <button
                        onClick={() => deleteRelation(rel.id)}
                        className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete relation"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <select
                      value={rel.type}
                      onChange={(e) => updateRelation(rel.id, e.target.value as 'inside'|'next-to'|'on-top-of')}
                      className="w-full text-[10px] border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="inside">Inside</option>
                      <option value="next-to">Next to</option>
                      <option value="on-top-of">On top of</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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


