// src/components/ImageEditorModal.tsx
import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../services/chatApi';

interface ImageEditorModalProps {
  imageUrl: string;
  imageId?: string;
  imageHistory: ChatMessage[]; // All messages with images
  onClose: () => void;
  onSendModification: (instruction: string, maskData?: string, imageUrl?: string) => void;
  onLike?: (imageId: string) => void;
  onDislike?: (imageId: string) => void;
}

export default function ImageEditorModal({
  imageUrl,
  imageId,
  imageHistory,
  onClose,
  onSendModification,
  onLike,
  onDislike
}: ImageEditorModalProps) {
  const [isPainting, setIsPainting] = useState(false);
  const [brushHistory, setBrushHistory] = useState<string[]>([]); // For undo functionality
  const [currentMask, setCurrentMask] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const brushSize = 20; // Reduced brush size for better precision
  const [selectedHistoryImage, setSelectedHistoryImage] = useState<string>(imageUrl);

  // Filter images from history and remove duplicates based on image_url
  const seenUrls = new Set<string>();
  const historyImages = imageHistory
    .filter(msg => {
      if (!msg.image_url) return false;
      if (seenUrls.has(msg.image_url)) return false;
      seenUrls.add(msg.image_url);
      return true;
    })
    .map(msg => ({
      id: msg.message_id || '',
      url: msg.image_url!,
      content: msg.content
    }));

    useEffect(() => {
        const overlayCanvas = overlayCanvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        const image = imageRef.current;
        if (!overlayCanvas || !maskCanvas || !image) return;

        const setupCanvas = () => {
            // Use natural image dimensions for canvas (actual pixel size)
            const width = image.naturalWidth || image.width || 1024;
            const height = image.naturalHeight || image.height || 1024;
            
            // Set canvas internal size to match image natural size
            overlayCanvas.width = width;
            overlayCanvas.height = height;
            maskCanvas.width = width;
            maskCanvas.height = height;

            // Clear mask canvas (start with all black - nothing selected)
            const maskCtx = maskCanvas.getContext('2d');
            if (maskCtx) {
                maskCtx.fillStyle = 'black';
                maskCtx.fillRect(0, 0, width, height);
                maskCtx.globalCompositeOperation = 'lighten'; // Set default composite operation
            }

            // Clear overlay canvas (transparent)
            const overlayCtx = overlayCanvas.getContext('2d');
            if (overlayCtx) {
                overlayCtx.clearRect(0, 0, width, height);
            }
            
            // Update canvas display size after image loads (handled by useEffect)
            
            // Reset brush history when image changes
            setBrushHistory([]);
            setCurrentMask(null);
        };

        if (image.complete) {
            setupCanvas();
        } else {
            image.onload = setupCanvas;
        }
    }, [selectedHistoryImage]);

    // Update canvas display size when window resizes or image changes
    useEffect(() => {
        const updateCanvasSize = () => {
            const overlayCanvas = overlayCanvasRef.current;
            const image = imageRef.current;
            if (!overlayCanvas || !image) return;
            
            // Wait for image to be fully rendered
            requestAnimationFrame(() => {
                const imageRect = image.getBoundingClientRect();
                if (imageRect.width > 0 && imageRect.height > 0) {
                    overlayCanvas.style.width = `${imageRect.width}px`;
                    overlayCanvas.style.height = `${imageRect.height}px`;
                    overlayCanvas.style.left = '0';
                    overlayCanvas.style.top = '0';
                }
            });
        };

        // Update on window resize
        window.addEventListener('resize', updateCanvasSize);
        
        // Update after image loads
        const timer = setTimeout(updateCanvasSize, 200);
        
        return () => {
            window.removeEventListener('resize', updateCanvasSize);
            clearTimeout(timer);
        };
    }, [selectedHistoryImage, isPainting]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return { x: 0, y: 0 };
    
    // Get the actual displayed image dimensions and position
    const imageRect = image.getBoundingClientRect();
    
    // Get canvas dimensions (should match image natural size)
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate scale factors based on displayed size vs natural size
    const scaleX = canvasWidth / imageRect.width;
    const scaleY = canvasHeight / imageRect.height;
    
    // Get mouse position relative to the displayed image
    // Account for the image's position on screen
    const x = (e.clientX - imageRect.left) * scaleX;
    const y = (e.clientY - imageRect.top) * scaleY;
    
    // Ensure coordinates are within canvas bounds
    return { 
      x: Math.max(0, Math.min(canvasWidth, x)), 
      y: Math.max(0, Math.min(canvasHeight, y)) 
    };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isPainting) return;
    
    const overlayCanvas = overlayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas?.getContext('2d');
    
    if (!overlayCanvas || !maskCanvas || !maskCtx) return;

    const { x, y } = getCoordinates(e);
    
    // Only update mask - we'll redraw overlay after
    // Use composite operation to prevent darkening
    maskCtx.globalCompositeOperation = 'lighten'; // Only lightens, won't darken white pixels
    
    // Enable smooth rendering
    maskCtx.imageSmoothingEnabled = true;
    maskCtx.imageSmoothingQuality = 'high';
    
    // Create smoother brush edges using shadow blur
    maskCtx.shadowBlur = 4;
    maskCtx.shadowColor = 'white';
    maskCtx.fillStyle = 'white';
    maskCtx.beginPath();
    maskCtx.arc(x, y, brushSize / 2, 0, 2 * Math.PI);
    maskCtx.fill();
    
    // Reset shadow to prevent affecting other operations
    maskCtx.shadowBlur = 0;
    maskCtx.shadowColor = 'transparent';
    
    // Redraw overlay with homogeneous color
    // Use requestAnimationFrame to batch redraws for better performance
    if (!overlayCanvas.dataset.redrawScheduled) {
      overlayCanvas.dataset.redrawScheduled = 'true';
      requestAnimationFrame(() => {
        redrawOverlay();
        overlayCanvas.dataset.redrawScheduled = '';
      });
    }
  };
  
  // Function to redraw overlay with homogeneous color (no edges)
  const redrawOverlay = () => {
    const overlayCanvas = overlayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!overlayCanvas || !maskCanvas) return;
    
    const overlayCtx = overlayCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!overlayCtx || !maskCtx) return;
    
    // Clear overlay
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    // Get mask data
    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    
    // Create a temporary canvas for efficient drawing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = maskCanvas.width;
    tempCanvas.height = maskCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    // Enable smooth rendering on overlay
    overlayCtx.imageSmoothingEnabled = true;
    overlayCtx.imageSmoothingQuality = 'high';
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    
    // Draw homogeneous blue overlay for all white pixels
    // Use a single color that won't darken on overlap
    // Slightly darker color for better visibility
    const imageData = tempCtx.createImageData(maskCanvas.width, maskCanvas.height);
    for (let i = 0; i < maskData.data.length; i += 4) {
      if (maskData.data[i] > 128) { // White pixel (selected)
        imageData.data[i] = 80;     // R (darker)
        imageData.data[i + 1] = 150; // G (darker)
        imageData.data[i + 2] = 235; // B (darker)
        imageData.data[i + 3] = 64;  // A (0.25 opacity)
      } else {
        // Transparent for unselected areas
        imageData.data[i + 3] = 0;
      }
    }
    tempCtx.putImageData(imageData, 0, 0);
    
    // Copy to overlay canvas
    overlayCtx.drawImage(tempCanvas, 0, 0);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPainting) return;
    setIsDrawing(true);
    // Save state for undo
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas) {
      const maskData = maskCanvas.toDataURL('image/png');
      setBrushHistory(prev => [...prev, maskData]);
    }
    // Reset composite operation for new stroke
    const maskCtx = maskCanvas?.getContext('2d');
    if (maskCtx) {
      maskCtx.globalCompositeOperation = 'lighten'; // Prevents darkening
    }
    draw(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    draw(e);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    // Redraw overlay after finishing brush stroke
    redrawOverlay();
    // Update current mask
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas) {
      const maskData = maskCanvas.toDataURL('image/png');
      setCurrentMask(maskData);
    }
  };

  const handleUndo = () => {
    if (brushHistory.length === 0) return;
    
    const overlayCanvas = overlayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!overlayCanvas || !maskCanvas) return;

    // Remove last history item
    const newHistory = [...brushHistory];
    newHistory.pop();
    setBrushHistory(newHistory);

    // Restore previous mask state
    if (newHistory.length > 0) {
      const prevMask = newHistory[newHistory.length - 1];
      const img = new Image();
      img.onload = () => {
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          // Clear and restore mask
          maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
          maskCtx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height);
          maskCtx.globalCompositeOperation = 'lighten'; // Reset composite operation
        }
        // Redraw overlay using the new system
        redrawOverlay();
        const maskData = maskCanvas.toDataURL('image/png');
        setCurrentMask(maskData);
      };
      img.src = prevMask;
    } else {
      // Clear everything
      const maskCtx = maskCanvas.getContext('2d');
      const overlayCtx = overlayCanvas.getContext('2d');
      if (maskCtx && overlayCtx) {
        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.globalCompositeOperation = 'lighten'; // Reset composite operation
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
      setCurrentMask(null);
    }
  };

  const handleClear = () => {
    const overlayCanvas = overlayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!overlayCanvas || !maskCanvas) return;

    const overlayCtx = overlayCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!overlayCtx || !maskCtx) return;

    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskCtx.globalCompositeOperation = 'lighten'; // Reset composite operation
    setCurrentMask(null);
    setBrushHistory([]);
  };

  const handleSend = () => {
    if (!instruction.trim() && !currentMask) {
      // Can send without instruction if mask is present
      return;
    }
    const maskData = currentMask || undefined;
    onSendModification(instruction.trim() || "Edit this image", maskData, selectedHistoryImage);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex">
      {/* Main Image Area */}
      <div className="flex-1 flex flex-col relative bg-white">
        {/* Top Right Buttons */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {imageId && onLike && (
            <button
              onClick={() => onLike(imageId)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Like"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            </button>
          )}
          {imageId && onDislike && (
            <button
              onClick={() => onDislike(imageId)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Dislike"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
            </button>
          )}
          <button
            onClick={() => {
              setIsPainting(!isPainting);
              if (isPainting) {
                handleClear();
              }
            }}
            className={`p-2 rounded-lg transition-colors ${
              isPainting 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title="Brush the image to make modification"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </button>
          {isPainting && brushHistory.length > 0 && (
            <button
              onClick={handleUndo}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
              title="Undo"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Image Display Area */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-white">
          <div className="relative inline-block">
            <img
              ref={imageRef}
              src={selectedHistoryImage}
              alt="Image to edit"
              className="block"
              style={{ 
                maxWidth: '100%', 
                maxHeight: 'calc(100vh - 200px)',
                width: 'auto',
                height: 'auto',
                display: 'block'
              }}
            />
            {isPainting && (
              <>
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute top-0 left-0 cursor-crosshair pointer-events-auto"
                  style={{ 
                    touchAction: 'none',
                    pointerEvents: 'auto'
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
                <canvas
                  ref={maskCanvasRef}
                  className="hidden"
                />
              </>
            )}
          </div>
        </div>

        {/* Bottom Input Area - GPT Style */}
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-2 bg-white rounded-2xl p-3 border border-gray-300 shadow-sm">
              <textarea
                value={instruction}
                onChange={(e) => {
                  setInstruction(e.target.value);
                  // Auto-resize textarea
                  e.target.style.height = 'auto';
                  const newHeight = Math.min(e.target.scrollHeight, 8 * 24); // Max 8 lines (24px per line)
                  e.target.style.height = `${newHeight}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Describe how to modify this image..."
                className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 resize-none focus:outline-none text-sm"
                rows={1}
                style={{ 
                  minHeight: '44px', 
                  maxHeight: `${8 * 24}px`, // 8 lines max
                  overflowY: 'auto'
                }}
              />
              <button
                onClick={handleSend}
                disabled={!instruction.trim() && !currentMask}
                className="p-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:opacity-50 rounded-full transition-colors"
                title="Send"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            {isPainting && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Paint over the region you want to modify. The selected area will be highlighted in blue.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Image History Sidebar - Smaller */}
      {historyImages.length > 1 && (
        <div className="w-48 bg-gray-50 border-l border-gray-200 overflow-y-auto">
          <div className="p-3">
            <h3 className="text-xs font-semibold text-gray-700 mb-2">History</h3>
            <div className="space-y-2">
              {historyImages.map((img, index) => (
                <button
                  key={img.id || index}
                  onClick={() => setSelectedHistoryImage(img.url)}
                  className={`w-full p-1.5 rounded border-2 transition-colors ${
                    selectedHistoryImage === img.url
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <img
                    src={img.url}
                    alt={`History ${index + 1}`}
                    className="w-full h-auto rounded"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

