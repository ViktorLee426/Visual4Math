import React, { useState, useRef, useEffect } from 'react';
import TimeProportionalProgress from '../components/TimeProportionalProgress';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import LayoutCanvas from '../components/layout/LayoutCanvas';
import type { LayoutNode, LayoutCanvasRef } from '../components/layout/LayoutCanvas';
import { generateImageFromPromptStream } from '../services/imageApi';
import { parseMathWordProblem, type LayoutItem } from '../services/parseApi';
import { toolBProblems } from '../data/mathProblems';

import { API_BASE_URL } from '../utils/apiConfig';

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

// Calculate text box size based on content - uses same logic as object boxes
const calculateTextSize = (text: string, minWidth: number = 50, minHeight: number = 40): { w: number; h: number } => {
  if (!text) return { w: minWidth, h: minHeight };
  
  // Use exact same logic as object boxes in LayoutCanvas
  const padding = 4; // 4px padding on each side
  const typicalFontSize = 14; // Typical font size for initial calculation
  const lineHeight = typicalFontSize * 1.2;
  
  // Use same character-based wrapping as object boxes
  const maxChars = Math.max(4, Math.floor((minWidth - padding * 2) / (typicalFontSize * 0.55))); // Same formula as object boxes
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
  
  // Find longest line to determine width
  const longestLine = Math.max(...lines.map(l => l.length), 4);
  // Use same character width calculation as object boxes: fontSize * 0.55
  const charWidth = typicalFontSize * 0.55;
  const boxWidth = Math.max(minWidth, Math.ceil(longestLine * charWidth + padding * 2));
  
  // Recalculate with actual width to get accurate line count
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
  
  // Calculate height based on number of lines
  const height = Math.max(minHeight, Math.ceil(lines.length * lineHeight + padding * 2));
  
  return { w: boxWidth, h: height };
};

export default function Tool2LayoutPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [nodes, setNodes] = useState<LayoutNode[]>([]);
  type GenItem = { url: string; ts: number; generationTime?: number; isPartial?: boolean };
  const [generationHistory, setGenerationHistory] = useState<GenItem[]>([]);
  const [, setSelectedIdx] = useState<number>(-1);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [relations] = useState<{ id: string; from: string; to: string; type: 'inside'|'next-to'|'on-top-of' }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const parseAbortControllerRef = useRef<AbortController | null>(null);
  const parseStartTimeRef = useRef<number | null>(null);
  const parseTimerIntervalRef = useRef<number | null>(null);
  const [parsingTime, setParsingTime] = useState<number>(0);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [generationTime, setGenerationTime] = useState<number>(0);
  const [copiedNode, setCopiedNode] = useState<LayoutNode | null>(null);
  const [history, setHistory] = useState<LayoutNode[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [currentProblem, setCurrentProblem] = useState<{ problemText: string; imageUrl: string } | null>(null);
  const layoutCanvasRef = useRef<LayoutCanvasRef>(null);
  
  // Initialize phase
  useEffect(() => {
    const session = sessionManager.getParticipantData();
    if (!session) {
      console.warn('No session found, but continuing in dev mode');
      // In dev mode, don't redirect - just continue
    } else {
      sessionManager.updatePhase('tool2-task');
    }
    
    // Load selected problem if available, otherwise default to Subtraction
    const taskData = sessionManager.getPhaseData('tool2-task');
    const savedProblemId = taskData?.selected_problem_id;
    const defaultProblemId = 'toolB-sub'; // Subtraction by default
    const problemIdToUse = savedProblemId || defaultProblemId;
    const problem = toolBProblems.find(p => p.id === problemIdToUse);
    if (problem) {
      setSelectedProblemId(problemIdToUse);
      setCurrentProblem({
        problemText: problem.problemText,
        imageUrl: problem.imageUrl
      });
      // Don't auto-fill text input - user should copy manually
      // Save default if not already saved
      if (!savedProblemId) {
        sessionManager.savePhaseData('tool2-task', {
          ...taskData,
          selected_problem_id: defaultProblemId
        });
      }
    }
    
    // Load generation history if available
    const savedHistory = taskData?.generation_history;
    if (savedHistory && Array.isArray(savedHistory) && savedHistory.length > 0) {
      setGenerationHistory(savedHistory);
      if (savedHistory.length > 0) {
        setSelectedIdx(0);
      }
    }
    
    // Load final outputs if selected (per operation)
    const finalOutputs = taskData?.final_outputs || {};
    if (finalOutputs && Object.keys(finalOutputs).length > 0) {
      setFinalOutputSelected(finalOutputs);
    }
    
    // Load saved canvas state (nodes and prompt)
    if (taskData?.nodes && Array.isArray(taskData.nodes) && taskData.nodes.length > 0) {
      setNodes(taskData.nodes);
      // Reset history to start from loaded nodes
      setHistory([taskData.nodes]);
      setHistoryIndex(0);
    }
    if (taskData?.prompt && typeof taskData.prompt === 'string') {
      setPrompt(taskData.prompt);
    }
  }, [navigate]);

  // Handle problem selection
  const handleSelectProblem = (problemId: string) => {
    const problem = toolBProblems.find(p => p.id === problemId);
    if (problem) {
      setSelectedProblemId(problemId);
      setCurrentProblem({
        problemText: problem.problemText,
        imageUrl: problem.imageUrl
      });
      // Don't auto-fill text input - user should copy manually
      // Save selected problem
      const taskData = sessionManager.getPhaseData('tool2-task') || {};
      sessionManager.savePhaseData('tool2-task', {
        ...taskData,
        selected_problem_id: problemId
      });
    }
  };
  
  // Get operation name from problem ID
  const getOperationFromProblemId = (problemId: string): string => {
    const problem = toolBProblems.find(p => p.id === problemId);
    return problem?.operation || '';
  };
  
  // Handle selecting final output for a specific operation
  const handleSelectFinalOutput = (imageUrl: string, operation: string) => {
    const newFinalOutputs = { ...finalOutputSelected, [operation]: imageUrl };
    setFinalOutputSelected(newFinalOutputs);
    const taskData = sessionManager.getPhaseData('tool2-task') || {};
    sessionManager.savePhaseData('tool2-task', {
      ...taskData,
      final_outputs: newFinalOutputs,
      completion_status: Object.keys(newFinalOutputs).length > 0 ? 'completed' : 'in_progress'
    });
  };
  
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
  const [finalOutputSelected, setFinalOutputSelected] = useState<Record<string, string>>({}); // Map: operation -> imageUrl

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


  const addNode = (type: 'object' | 'text') => {
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    
    // Calculate offset to prevent overlap - find existing nodes and add offset
    const baseX = 40;
    const baseY = 40;
    const offsetX = nodes.length * 30; // 30px offset per existing node
    const offsetY = nodes.length * 30;
    
    const newNode = type === 'object' 
      ? { id, type: 'object' as const, x: baseX + offsetX, y: baseY + offsetY, w: 140, h: 90, label: 'object', color: '#ffffff' }
      : (() => {
          const initialText = 'text';
          const size = calculateTextSize(initialText);
          return { 
            id, 
            type: 'text' as const, 
            x: baseX + offsetX + 20, 
            y: baseY + offsetY + 20, 
            ...size, 
            label: initialText, 
            color: '#ffffff', // White background
            textColor: '#000000', // Black text
            borderColor: '#374151', // Dark gray border for better visibility
            borderWidth: 2, // Thicker border
            fontSize: 16 // Default font size
          };
        })();
    
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
    setSelectedNodeIds(prev => prev.filter(selectedId => selectedId !== id));
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
    setSelectedNodeIds([id]);
    setJustAdded(id);
    setTimeout(() => setJustAdded(null), 600);
  };

  // Update nodes with history tracking (for drag/resize end)
  const handleNodesChange = (newNodes: LayoutNode[]) => {
    setNodes(newNodes);
    // History is saved in drag/resize handlers
  };


  const parseMWP = async () => {
    if (!prompt.trim()) {
      alert('Please enter a math word problem first.');
      return;
    }
    
    // Cancel any existing parse request
    if (parseAbortControllerRef.current) {
      parseAbortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    const abortController = new AbortController();
    parseAbortControllerRef.current = abortController;
    
    setIsParsing(true);
    setParsingTime(0);
    parseStartTimeRef.current = Date.now();
    
    // Start parsing timer
    parseTimerIntervalRef.current = window.setInterval(() => {
      if (parseStartTimeRef.current) {
        const elapsed = (Date.now() - parseStartTimeRef.current) / 1000;
        setParsingTime(elapsed);
      }
    }, 100); // Update every 100ms for smooth display
    
    try {
      const response = await parseMathWordProblem(prompt, abortController.signal);
      const layoutItems = response.layout;
      
      // Convert layout items to LayoutNode format
      const newNodes: LayoutNode[] = layoutItems.map((item: LayoutItem, idx: number) => {
        // Map 'box' type from API to 'object' type
        const nodeType = item.type === 'box' ? 'object' : item.type;
        const node: LayoutNode = {
          id: `n_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          type: nodeType,
          label: item.label,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          color: item.color || '#ffffff',
        };
        // Set defaults for text boxes (white background, visible border, black text)
        if (item.type === 'text') {
          node.color = '#ffffff'; // White background
          node.borderColor = '#374151'; // Dark gray border for better visibility
          node.borderWidth = 2; // Thicker border
          node.textColor = '#000000'; // Black text
          node.fontSize = 16; // Default font size
          // Auto-resize text boxes
          const size = calculateTextSize(item.label || '');
          node.w = size.w;
          node.h = size.h;
        }
        return node;
      });
      
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
    } catch (error: any) {
      if (error.name === 'CanceledError' || error.name === 'AbortError') {
        console.log('Parse cancelled by user');
        // Clear canvas when cancelled
        setHistory([[]]);
        setHistoryIndex(0);
        setNodes([]);
      } else {
        console.error('Parse error:', error);
        alert('Failed to parse problem. Please try again.');
      }
    } finally {
      setIsParsing(false);
      setParsingTime(0);
      parseStartTimeRef.current = null;
      if (parseTimerIntervalRef.current) {
        clearInterval(parseTimerIntervalRef.current);
        parseTimerIntervalRef.current = null;
      }
      parseAbortControllerRef.current = null;
    }
  };


  const clearCanvas = () => {
    if (window.confirm('Are you sure you want to clear the canvas? This will remove all elements.')) {
      setHistory([[]]);
      setHistoryIndex(0);
      setNodes([]);
      setSelectedNodeIds([]);
    }
  };

  // Build detailed text-based layout prompt from canvas
  const buildLayoutPrompt = (): string => {
    // Get the problem text to use: user's prompt, or current problem text, or empty
    let problemText = prompt.trim();
    
    // If prompt is empty, use the current problem text as default
    if (!problemText && currentProblem?.problemText) {
      problemText = currentProblem.problemText;
    } else if (!problemText && selectedProblemId) {
      // Fallback: find problem by selectedProblemId
      const problem = toolBProblems.find(p => p.id === selectedProblemId);
      if (problem) {
        problemText = problem.problemText;
      }
    }
    
    if (nodes.length === 0) {
      return problemText; // Just use problem text if no layout
    }

    // Analyze canvas to create explicit layout description
    const layoutItems: string[] = [];
    const textItems: Array<{text: string; x: number; y: number}> = [];
    const spatialRelations: string[] = [];

    // Separate text boxes from object boxes
    nodes.forEach((n) => {
      const itemName = n.label || n.type;
      
      if (n.type === 'text') {
        // Text boxes - store text content and position
        textItems.push({
          text: itemName,
          x: Math.round((n.x / 800) * 100),
          y: Math.round((n.y / 600) * 100)
        });
      } else {
        // Object boxes - each box represents exactly ONE object
        let itemDesc = `${itemName}`;
        
        // Add color info if available (skip white/default colors)
        if (n.color && n.color.toLowerCase() !== '#ffffff' && n.color.toLowerCase() !== '#fff') {
          itemDesc += ` (color: ${n.color})`;
        }
        
        // Add position info
        const relativeX = Math.round((n.x / 800) * 100);
        const relativeY = Math.round((n.y / 600) * 100);
        itemDesc += ` at ${relativeX}% from left, ${relativeY}% from top`;
        
        layoutItems.push(itemDesc);
      }
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
            spatialRelations.push(`${n2Name} is contained inside ${n1Name}`);
          }
        }
      });
    });

    // Build structured prompt with clear sections
    let layoutPrompt = `=== ORIGINAL MATH PROBLEM ===\n`;
    layoutPrompt += `${problemText}\n\n`;
    
    layoutPrompt += `=== TASK ===\n`;
    layoutPrompt += `You will receive TWO inputs:\n`;
    layoutPrompt += `1. LAYOUT IMAGE: A diagram showing boxes and text elements positioned on a canvas\n`;
    layoutPrompt += `2. LAYOUT PROMPT (below): Detailed text specification of the layout and generation guidelines\n\n`;
    layoutPrompt += `Your task is to generate an educational visualization for the math problem above, following the layout specification.\n\n`;
    
    layoutPrompt += `=== LAYOUT SPECIFICATION (MUST FOLLOW EXACTLY) ===\n\n`;
    
    // Count objects by type for verification
    const objectCounts: Record<string, number> = {};
    layoutItems.forEach(item => {
      const objectType = item.split(' ')[0] + ' ' + (item.split(' ')[1] || '');
      objectCounts[objectType] = (objectCounts[objectType] || 0) + 1;
    });
    
    layoutPrompt += `OBJECTS TO RENDER (EACH BOX = EXACTLY ONE OBJECT):\n`;
    layoutItems.forEach((item, idx) => {
      layoutPrompt += `${idx + 1}. ${item}\n`;
    });
    layoutPrompt += `\n`;
    
    // Add count summary for clarity
    if (Object.keys(objectCounts).length > 0) {
      layoutPrompt += `OBJECT COUNT SUMMARY:\n`;
      Object.entries(objectCounts).forEach(([type, count]) => {
        layoutPrompt += `- ${count} × ${type}\n`;
      });
      layoutPrompt += `\n`;
    }
    
    // Add text elements separately
    if (textItems.length > 0) {
      layoutPrompt += `TEXT ELEMENTS (DISPLAY AS TEXT ONLY, DO NOT RENDER AS OBJECTS):\n`;
      textItems.forEach((item, idx) => {
        layoutPrompt += `${idx + 1}. Text: "${item.text}" at ${item.x}% from left, ${item.y}% from top\n`;
      });
      layoutPrompt += `\n`;
      layoutPrompt += `IMPORTANT: The text elements above are LABELS/DESCRIPTIONS only. Do NOT render them as objects.\n`;
      layoutPrompt += `Only render the objects listed in "OBJECTS TO RENDER" section above.\n\n`;
    }
    
    if (spatialRelations.length > 0) {
      layoutPrompt += `SPATIAL RELATIONSHIPS:\n`;
      spatialRelations.forEach(rel => layoutPrompt += `- ${rel}\n`);
      layoutPrompt += `\n`;
    }
    
    layoutPrompt += `=== END LAYOUT SPECIFICATION ===\n\n`;
    
    layoutPrompt += `=== GENERATION GUIDELINES ===\n\n`;
    layoutPrompt += `CRITICAL REQUIREMENTS:\n\n`;
    layoutPrompt += `1. OBJECT COUNTING - EXACT MATCH:\n`;
    layoutPrompt += `   - Render EXACTLY the number of objects specified in "OBJECT COUNT SUMMARY" above\n`;
    layoutPrompt += `   - Each object box in the layout image = EXACTLY ONE rendered object\n`;
    layoutPrompt += `   - Do NOT duplicate objects or add extra objects\n`;
    layoutPrompt += `   - Example: If there are 3 "green apple" boxes, render exactly 3 green apples, no more, no less\n\n`;
    layoutPrompt += `2. REPLACE LAYOUT BOXES WITH OBJECTS:\n`;
    layoutPrompt += `   - Each box in the layout image represents ONE object (e.g., "green apple" box → render ONE green apple)\n`;
    layoutPrompt += `   - Do NOT show the layout boxes/borders - replace them completely with rendered objects\n`;
    layoutPrompt += `   - Objects can be cartoon-style, illustrated, or realistic - your choice, but make them clear and recognizable\n`;
    layoutPrompt += `   - Objects should match their labels (e.g., green apples should be green apples)\n`;
    layoutPrompt += `   - Maintain the spatial positions from the layout image\n\n`;
    layoutPrompt += `3. TEXT ELEMENTS - NO BOXES:\n`;
    layoutPrompt += `   - For text elements listed above, display ONLY the text content\n`;
    layoutPrompt += `   - Do NOT show rectangular boxes, borders, or backgrounds around text\n`;
    layoutPrompt += `   - Display text naturally as floating text, positioned where specified\n`;
    layoutPrompt += `   - Text should be readable and integrated into the scene\n\n`;
    layoutPrompt += `4. COLOR AND BACKGROUND:\n`;
    layoutPrompt += `   - Use the colors specified for objects (e.g., green apples should be green)\n`;
    layoutPrompt += `   - Use a neutral, clean background (white or light gray)\n`;
    layoutPrompt += `   - Background should be plain and unobtrusive\n\n`;
    layoutPrompt += `5. OVERALL STYLE:\n`;
    layoutPrompt += `   - Create a clear, educational visualization suitable for primary/elementary mathematics\n`;
    layoutPrompt += `   - Style can be cartoon, illustrated, or realistic - choose what works best\n`;
    layoutPrompt += `   - Objects should be clearly visible and countable\n`;
    layoutPrompt += `   - Render as a finished, polished educational image\n`;

    // Add console log for debugging in browser
    console.log("=".repeat(80));
    console.log("COMPLETE LAYOUT PROMPT BEING SENT:");
    console.log("=".repeat(80));
    console.log(layoutPrompt);
    console.log("=".repeat(80));

    return layoutPrompt;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationTime(0);
    generationStartTimeRef.current = Date.now();
    
    // Add placeholder for generating image
    const placeholderItem: GenItem = {
      url: '', // Empty URL for placeholder
      ts: Date.now(),
      isPartial: true // Mark as partial so it gets replaced
    };
    setGenerationHistory(prev => {
      // Remove any existing partials and add placeholder at the beginning
      const filtered = prev.filter(item => !item.isPartial);
      return [placeholderItem, ...filtered].slice(0, 30);
    });
    
    // Start timer
    timerIntervalRef.current = window.setInterval(() => {
      if (generationStartTimeRef.current) {
        const elapsed = (Date.now() - generationStartTimeRef.current) / 1000;
        setGenerationTime(elapsed);
      }
    }, 100); // Update every 100ms for smooth display
    
    try {
      // Capture canvas as PNG image
      let layoutImageDataUrl: string | null = null;
      if (layoutCanvasRef.current && nodes.length > 0) {
        try {
          layoutImageDataUrl = await layoutCanvasRef.current.exportAsPNG();
          console.log('Canvas exported as PNG, size:', layoutImageDataUrl.length, 'chars');
        } catch (error) {
          console.error('Failed to export canvas:', error);
          alert('Failed to capture canvas layout. Using text-only prompt.');
        }
      }
      
      // Build detailed text-based layout prompt from canvas
      const layoutPrompt = buildLayoutPrompt();
      
      // Prepare layout info for metadata storage
      const layoutInfo = {
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type,
          label: n.label,
          x: n.x,
          y: n.y,
          w: n.w,
          h: n.h,
          color: n.color
        })),
        prompt: prompt,
        canvas_size: { width: 800, height: 600 }
      };
      
      // Use streaming API to get partial images (with layout image if available)
      await generateImageFromPromptStream(
        layoutPrompt,
        layoutInfo,
        layoutImageDataUrl, // Pass the layout image
        // onPartialImage callback
        (imageB64: string) => {
          // Convert base64 to data URL
          const dataUrl = `data:image/png;base64,${imageB64}`;
          const partialItem: GenItem = {
            url: dataUrl,
            ts: Date.now(),
            isPartial: true
          };
          // Add partial image to history (at the beginning, but after any other partials)
          setGenerationHistory(prev => {
            // Remove any existing partials for this generation
            const filtered = prev.filter(item => !item.isPartial);
            return [partialItem, ...filtered].slice(0, 30);
          });
        },
        // onComplete callback
        (imageUrl: string) => {
          const finalTime = generationStartTimeRef.current ? (Date.now() - generationStartTimeRef.current) / 1000 : 0;
          const fullUrl = getImageUrl(imageUrl);
          const finalItem: GenItem = {
            url: fullUrl,
            ts: Date.now(),
            generationTime: finalTime,
            isPartial: false
          };
          // Replace partial images with final image
          setGenerationHistory(prev => {
            const filtered = prev.filter(item => !item.isPartial);
            const newHistory = [finalItem, ...filtered].slice(0, 30);
            
            // Save generation history to session using the updated state
            const taskData = sessionManager.getPhaseData('tool2-task') || {};
            sessionManager.savePhaseData('tool2-task', {
              ...taskData,
              generation_history: newHistory,
              nodes: nodes,
              prompt: prompt
            });
            
            return newHistory;
          });
          setSelectedIdx(-1);
        },
        // onError callback
        (error: string) => {
          console.error('Image generation failed:', error);
          alert(`Image generation failed: ${error}`);
        }
      );
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (parseTimerIntervalRef.current) {
        clearInterval(parseTimerIntervalRef.current);
      }
    };
  }, []);

  // Auto-save canvas state (nodes and prompt) whenever they change
  useEffect(() => {
    const taskData = sessionManager.getPhaseData('tool2-task') || {};
    sessionManager.savePhaseData('tool2-task', {
      ...taskData,
      nodes: nodes, // Save current canvas layout
      prompt: prompt, // Save text input
      generation_history: generationHistory, // Keep existing history
      final_outputs: finalOutputSelected, // Keep existing final outputs
      selected_problem_id: selectedProblemId // Keep selected problem
    });
  }, [nodes, prompt, generationHistory, finalOutputSelected, selectedProblemId]); // Save whenever state changes

  // Save state on unmount (when navigating away)
  useEffect(() => {
    return () => {
      // Cleanup: save state before component unmounts
      const taskData = sessionManager.getPhaseData('tool2-task') || {};
      sessionManager.savePhaseData('tool2-task', {
        ...taskData,
        nodes: nodes,
        prompt: prompt,
        generation_history: generationHistory,
        final_outputs: finalOutputSelected,
        selected_problem_id: selectedProblemId
      });
    };
  }, [nodes, prompt, generationHistory, finalOutputSelected, selectedProblemId]);

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
    <div className="min-h-screen bg-white">
      <TimeProportionalProgress currentPhase="tool2-task" />
      <div className="pt-16 pb-12 overflow-x-auto ml-56">
        <div className="min-w-[1024px] max-w-7xl mx-auto px-6">
          {/* Tool Title - Top Left */}
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Tool B - Layout-based</h1>
          
          <div className="grid grid-cols-4 gap-6">
          {/* Left column: Problem Selection + Example Image + Text Input + Elements */}
          <div className="col-span-1 space-y-5">
            {/* Problems Selection - Compact Operation Buttons */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">Select a Problem</h3>
              <div className="grid grid-cols-2 gap-2">
                {toolBProblems.map((problem) => {
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
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <img src={currentProblem.imageUrl} alt="Example" className="w-full h-auto rounded" />
                  </div>
                </div>
              </div>
            )}

            {/* Text Input Panel */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Text Input</h3>
              <textarea
                className="w-full h-24 border border-gray-300 rounded-lg p-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                placeholder="Enter the math word problem here in text..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onPaste={(e) => {
                  // Handle paste event (works with Cmd+V and right-click paste)
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const textarea = e.currentTarget;
                  const start = textarea.selectionStart || 0;
                  const end = textarea.selectionEnd || 0;
                  const newValue = prompt.substring(0, start) + pastedText + prompt.substring(end);
                  setPrompt(newValue);
                  // Set cursor position after pasted text
                  setTimeout(() => {
                    const newCursorPos = start + pastedText.length;
                    textarea.selectionStart = newCursorPos;
                    textarea.selectionEnd = newCursorPos;
                    textarea.focus();
                  }, 0);
                }}
              />
              <div className="mt-3">
                {isParsing ? (
                  <button 
                    disabled
                    className="w-full px-4 py-2 bg-gray-400 text-white rounded-lg text-sm font-medium cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Generating Layout...
                    {parsingTime > 0 && (
                      <span className="ml-1 opacity-80">({parsingTime.toFixed(1)}s)</span>
                    )}
                  </button>
                ) : (
                  <button 
                    onClick={parseMWP}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    Generate Layout
                  </button>
                )}
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Layout generation may take around 10 seconds, please be patient...
                </p>
              </div>
            </div>
            
            {/* Back button */}
            <button
              onClick={() => navigate('/tool2-intro')}
              className="w-full px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              ← Back to Tool B Intro
            </button>
          </div>

          {/* Main canvas */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Canvas</h3>
              {/* Add Elements buttons in the middle */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={()=>addNode('object')}
                  className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  Add Object
                </button>
                <button 
                  onClick={()=>addNode('text')}
                  className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  Add Text
                </button>
              </div>
              <button
                onClick={clearCanvas}
                disabled={nodes.length === 0}
                className="px-3 py-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Canvas
              </button>
            </div>
            <LayoutCanvas 
              ref={layoutCanvasRef}
              nodes={nodes} 
              setNodes={handleNodesChange} 
              relations={relations} 
              justAdded={justAdded}
              selectedId={selectedNodeIds.length === 1 ? selectedNodeIds[0] : null}
              selectedIds={selectedNodeIds}
              onSelect={(id, event) => {
                // Support multi-selection with Ctrl/Cmd key
                const isMultiSelect = event?.ctrlKey || event?.metaKey;
                if (isMultiSelect) {
                  setSelectedNodeIds(prev => 
                    prev.includes(id) 
                      ? prev.filter(selectedId => selectedId !== id)
                      : [...prev, id]
                  );
                } else {
                  setSelectedNodeIds([id]);
                }
              }}
              onDeselect={() => setSelectedNodeIds([])}
              onDelete={handleDeleteNode}
              onCopy={handleCopyNode}
              onPaste={handlePasteNode}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
              onHistorySave={saveToHistory}
              isParsing={isParsing}
              parsingTime={parsingTime}
            />
            <div className="space-y-4">
              <ObjectList nodes={nodes} setNodes={setNodes} onUpdate={saveToHistory} selectedNodeIds={selectedNodeIds} />
              
              {/* Generate Image button */}
              <div className="flex justify-center">
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || nodes.length === 0}
                  className="w-[400px] px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                      <span>Generating...</span>
                      {generationTime > 0 && (
                        <span className="ml-1 opacity-80">({generationTime.toFixed(1)}s)</span>
                      )}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Generate Image
                    </>
                  )}
                </button>
              </div>
              {nodes.length === 0 && !isGenerating && (
                <p className="text-[10px] text-gray-400 text-center">Generate a layout first to create an image</p>
              )}
            </div>
          </div>

          {/* Right panel: Generated Images */}
          <div className="col-span-1 flex flex-col">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-24 flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
              <h3 className="text-sm font-medium text-gray-700 mb-4">Generated Images</h3>
              
              {/* Generated Images Grid */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {generationHistory.length === 0 ? (
                  <div className="text-center text-xs text-gray-400 py-8">
                    <p>No images generated yet</p>
                    <p className="text-[10px] mt-1">Images will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-y-auto flex-1">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Reverse order so oldest is first (top-left) */}
                      {[...generationHistory].reverse().map((it, idx) => {
                        const originalIdx = generationHistory.length - 1 - idx;
                        // Check if this image is selected for any operation
                        const selectedForOperation = Object.entries(finalOutputSelected).find(
                          ([_, url]) => url === it.url
                        )?.[0];
                        
                        return (
                          <div 
                            key={originalIdx}
                            className={`relative rounded-lg overflow-hidden border-2 transition-colors cursor-pointer ${
                              selectedForOperation
                                ? 'border-green-500'
                                : it.isPartial
                                ? 'border-blue-300 border-dashed'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => it.url && setEnlargedImageIdx(originalIdx)}
                          >
                            {!it.url ? (
                              // Placeholder with spinner when generating
                              <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                                <div className="text-center">
                                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto mb-2" />
                                  <p className="text-xs text-gray-500">Generating...</p>
                                  {isGenerating && generationTime > 0 && (
                                    <p className="text-xs text-gray-600 mt-1 font-medium">{generationTime.toFixed(1)}s</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                                <img 
                                  src={it.url} 
                                  className="w-full h-auto" 
                                  alt={`Generated ${originalIdx + 1}`} 
                                />
                                {/* Spinner and timer overlay for partial images */}
                                {it.isPartial && it.url && (
                                  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                                    <div className="text-center">
                                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent mx-auto mb-2" />
                                      <p className="text-xs text-white font-medium">Generating...</p>
                                      {isGenerating && generationTime > 0 && (
                                        <p className="text-xs text-white mt-1 font-medium">{generationTime.toFixed(1)}s</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                            {it.isPartial && it.url && (
                              <div className="absolute top-1 left-1 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded z-20">
                                Partial
                              </div>
                            )}
                            {/* Timer badge - show on top */}
                            {it.generationTime && (
                              <div className="absolute top-1 left-1 bg-black bg-opacity-60 text-white text-[9px] px-1.5 py-0.5 rounded z-10">
                                {it.generationTime.toFixed(1)}s
                              </div>
                            )}
                            {selectedForOperation && (
                              <div className="absolute top-1 right-1 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                                ✓ {selectedForOperation.charAt(0).toUpperCase() + selectedForOperation.slice(1)}
                              </div>
                            )}
                            {/* Show "Most Recent" badge on the newest image (originalIdx === 0 means newest) - only if no timer */}
                            {originalIdx === 0 && !it.isPartial && !it.generationTime && (
                              <div className="absolute top-1 left-1 bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded">
                                Most Recent
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Continue button */}
              <div className="pt-4 border-t border-gray-200 mt-auto">
                <button
                  onClick={() => navigate('/tool2-eval')}
                  className="w-full px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors"
                >
                  Continue to Evaluation →
                </button>
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
            
            {/* Image info and selection */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg text-xs space-y-2">
              <div>
                Image {enlargedImageIdx + 1} of {generationHistory.length}
                {generationHistory[enlargedImageIdx].generationTime && (
                  <span className="ml-2 opacity-80">• {generationHistory[enlargedImageIdx].generationTime.toFixed(1)}s</span>
                )}
              </div>
              {currentProblem && selectedProblemId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const operation = getOperationFromProblemId(selectedProblemId);
                    if (operation) {
                      handleSelectFinalOutput(generationHistory[enlargedImageIdx].url, operation);
                    }
                  }}
                  className="w-full mt-2 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium transition-colors"
                >
                  {finalOutputSelected[getOperationFromProblemId(selectedProblemId)] === generationHistory[enlargedImageIdx].url
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

// Color picker button component with proper positioning
function ColorPickerButton({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    // Trigger the color input directly
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

function ObjectList({ nodes, setNodes, onUpdate, relations = [], setRelations, selectedNodeIds }: { 
  nodes: LayoutNode[]; 
  setNodes: (n: LayoutNode[]) => void; 
  onUpdate?: (newNodes: LayoutNode[]) => void;
  relations?: { id: string; from: string; to: string; type: 'inside'|'next-to'|'on-top-of' }[];
  setRelations?: (r: { id: string; from: string; to: string; type: 'inside'|'next-to'|'on-top-of' }[]) => void;
  selectedNodeIds?: string[];
}) {
  // Update single node
  const update = (id: string, patch: Partial<LayoutNode>) => {
    const newNodes = nodes.map((n: LayoutNode) => {
      if (n.id !== id) return n;
      const updated = { ...n, ...patch };
      
      // Auto-resize text boxes when label changes
      if (n.type === 'text' && patch.label !== undefined) {
        const newSize = calculateTextSize(patch.label as string);
        updated.w = newSize.w;
        updated.h = newSize.h;
      }
      
      return updated;
    });
    setNodes(newNodes);
    onUpdate && onUpdate(newNodes);
  };

  // Update multiple selected nodes at once
  const updateMultiple = (patch: Partial<LayoutNode>) => {
    if (selectedNodeIds && selectedNodeIds.length > 0) {
      const newNodes = nodes.map((n: LayoutNode) => {
        if (!selectedNodeIds.includes(n.id)) return n;
        const updated = { ...n, ...patch };
        
        // Auto-resize text boxes when label changes
        if (n.type === 'text' && patch.label !== undefined) {
          const newSize = calculateTextSize(patch.label as string);
          updated.w = newSize.w;
          updated.h = newSize.h;
        }
        
        return updated;
      });
      setNodes(newNodes);
      onUpdate && onUpdate(newNodes);
    }
  };

  const remove = (id: string) => {
    const newNodes = nodes.filter(n => n.id !== id);
    setNodes(newNodes);
    onUpdate && onUpdate(newNodes);
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
  
  // Get relations for selected nodes
  const selectedRelations = selectedNodeIds && selectedNodeIds.length > 0 
    ? relations.filter(r => selectedNodeIds.includes(r.from) || selectedNodeIds.includes(r.to))
    : [];
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

  // Get selected nodes
  const selectedNodes = selectedNodeIds && selectedNodeIds.length > 0
    ? nodes.filter(n => selectedNodeIds.includes(n.id))
    : [];

  // Get common values for multi-selection editing
  const getCommonValue = (key: keyof LayoutNode): string | undefined => {
    if (selectedNodes.length === 0) return undefined;
    const values = selectedNodes.map(n => n[key]).filter(v => v !== undefined);
    if (values.length === 0) return undefined;
    // If all selected nodes have the same value, return it; otherwise return undefined
    const firstValue = values[0];
    return values.every(v => v === firstValue) ? String(firstValue) : undefined;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-2 max-h-64 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {nodes.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="text-xs text-gray-400">Add elements from the palette</p>
          </div>
        ) : selectedNodes.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-[10px] text-gray-400">Select one or more elements to edit their properties</p>
            <p className="text-[9px] text-gray-300 mt-0.5">Hold Ctrl/Cmd to select multiple</p>
          </div>
        ) : selectedNodes.length > 1 ? (
          /* Multi-selection editing panel - only show this, no individual cards */
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <p className="text-[10px] font-medium text-blue-900 mb-1.5">
              Editing {selectedNodes.length} selected elements
            </p>
            <div className="space-y-1.5">
              {/* Color palette for multi-selection (only for object boxes, not text boxes) */}
              {!selectedNodes.some(n => n.type === 'text') && (
                <div>
                  <label className="text-[9px] text-gray-600 mb-0.5 block">Object Color</label>
                  <div className="flex flex-wrap gap-1 items-center">
                    {COLOR_PALETTE.map(color => (
                      <button
                        key={color}
                        onClick={() => updateMultiple({ color })}
                        className="w-5 h-5 rounded border border-gray-300 hover:border-gray-400 transition-colors"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <ColorPickerButton
                      value={getCommonValue('color') || '#ffffff'}
                      onChange={(color) => updateMultiple({ color })}
                    />
                  </div>
                </div>
              )}
              {/* Label for multi-selection */}
              <div>
                <label className="text-[9px] text-gray-600 mb-0.5 block">
                  {selectedNodes.some(n => n.type === 'text') ? 'Text' : 'Label'}
                </label>
                <input 
                  type="text"
                  className="w-full border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all bg-white" 
                  value={getCommonValue('label') || ''} 
                  placeholder={selectedNodes.length > 1 ? 'Mixed values' : selectedNodes.some(n => n.type === 'text') ? 'Enter text...' : 'Label'} 
                  onChange={(e) => {
                    updateMultiple({ label: e.target.value });
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onFocus={(e) => {
                    e.stopPropagation();
                  }}
                  onBlur={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Single selection - compact display */
          (() => {
            const n = selectedNodes[0];
            
            // Text box properties panel - simplified (only text content)
            if (n.type === 'text') {
              return (
                <div className="space-y-1.5">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Properties of Text Box</h3>
                  <div className="grid grid-cols-[100px_1fr] gap-x-6 gap-y-1.5 items-start">
                    <label className="text-[11px] font-semibold text-gray-600 mb-0.5 block pt-0.5">Text</label>
                    <div>
                      <input
                        type="text"
                        autoComplete="off"
                        className="w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                        value={n.label || ''} 
                        placeholder="Enter text..." 
                        onChange={(e) => {
                          e.stopPropagation();
                          const newValue = e.target.value;
                          update(n.id, { label: newValue });
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onFocus={(e) => {
                          e.stopPropagation();
                        }}
                        onBlur={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  
                  {/* Font size slider */}
                  <div className="grid grid-cols-[100px_1fr] gap-x-6 gap-y-1.5 items-center pt-1">
                    <label className="text-[11px] font-semibold text-gray-600 mb-0.5 block pt-0.5">Font Size</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range"
                        min="10"
                        max="48"
                        step="1"
                        className="w-full"
                        value={n.fontSize !== undefined ? n.fontSize : 16}
                        onChange={(e) => {
                          update(n.id, { fontSize: Number(e.target.value) });
                        }} 
                      />
                      <span className="text-[10px] text-gray-400 whitespace-nowrap min-w-[35px]">
                        {n.fontSize !== undefined ? n.fontSize : 16}px
                      </span>
                    </div>
                  </div>
                  
                  {/* Size info */}
                  <div className="flex items-center justify-between text-[9px] text-gray-400 pt-2 border-t border-gray-200">
                    <span>Size: {n.w}×{n.h}</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => duplicate(n.id)}
                        className="p-0.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Duplicate"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => remove(n.id)}
                        className="p-0.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
            
            // Object box properties panel - reorganized with two-column layout
            return (
              <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Properties of Object Box</h3>
                {/* Two-column layout: Labels | Inputs */}
                <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1.5 items-start">
                  {/* Label */}
                  <label className="text-[11px] font-semibold text-gray-600 mb-0.5 block pt-0.5">Label</label>
                  <div>
                    <input 
                      type="text"
                      autoComplete="off"
                      className="w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all bg-white" 
                      value={n.label || ''} 
                      placeholder="Label" 
                      onChange={(e) => {
                        const newValue = e.target.value;
                        update(n.id, { label: newValue });
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onFocus={(e) => {
                        e.stopPropagation();
                      }}
                      onBlur={(e) => e.stopPropagation()}
                    />
                  </div>
                  
                  {/* Object Color */}
                  <label className="text-[11px] font-semibold text-gray-600 mb-0.5 block pt-0.5">Object Color</label>
                  <div className="flex flex-wrap gap-1 items-center">
                    {COLOR_PALETTE.map(color => (
                      <button
                        key={color}
                        onClick={() => update(n.id, { color })}
                        className={`w-5 h-5 rounded border transition-colors ${
                          (n.color || '#ffffff') === color ? 'border-gray-600 border-2' : 'border-gray-300 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <ColorPickerButton
                      value={n.color || '#ffffff'}
                      onChange={(color) => update(n.id, { color })}
                    />
                  </div>
                </div>
                
                {/* Size info */}
                <div className="flex items-center justify-between text-[9px] text-gray-400">
                  <span>Size: {n.w}×{n.h}</span>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => duplicate(n.id)}
                      className="p-0.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Duplicate"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => remove(n.id)}
                      className="p-0.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        )}
        
        {/* Relations section */}
        {selectedNodeIds && selectedNodeIds.length === 1 && selectedRelations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Relationships</h4>
            <div className="space-y-2">
              {selectedRelations.map(rel => {
                const selectedId = selectedNodeIds[0];
                const otherNode = nodes.find(n => n.id === (rel.from === selectedId ? rel.to : rel.from));
                const isFrom = rel.from === selectedId;
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


