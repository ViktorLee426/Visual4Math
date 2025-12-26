// src/components/ImageBrushTool.tsx
import { useRef, useState, useEffect } from 'react';

interface ImageBrushToolProps {
  imageUrl: string;
  onSave: (maskData: string, instruction: string) => void;
  onCancel: () => void;
}

export default function ImageBrushTool({ imageUrl, onSave, onCancel }: ImageBrushToolProps) {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const brushSize = 30; // Fixed brush size
  const [instruction, setInstruction] = useState("");

  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const image = imageRef.current;
    if (!overlayCanvas || !maskCanvas || !image) return;

    const setupCanvas = () => {
      const width = image.width || 800;
      const height = image.height || 800;
      
      overlayCanvas.width = width;
      overlayCanvas.height = height;
      maskCanvas.width = width;
      maskCanvas.height = height;

      // Clear mask canvas (start with all black - nothing selected)
      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) {
        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, width, height);
      }

      // Clear overlay canvas (transparent)
      const overlayCtx = overlayCanvas.getContext('2d');
      if (overlayCtx) {
        overlayCtx.clearRect(0, 0, width, height);
      }
    };

    if (image.complete) {
      setupCanvas();
    } else {
      image.onload = setupCanvas;
    }
  }, [imageUrl]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const overlayCanvas = overlayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const overlayCtx = overlayCanvas?.getContext('2d');
    const maskCtx = maskCanvas?.getContext('2d');
    
    if (!overlayCanvas || !maskCanvas || !overlayCtx || !maskCtx) return;

    const { x, y } = getCoordinates(e);
    
    // Draw blue overlay for visual feedback
    overlayCtx.globalCompositeOperation = 'source-over';
    overlayCtx.fillStyle = 'rgba(59, 130, 246, 0.4)'; // Blue with transparency
    overlayCtx.beginPath();
    overlayCtx.arc(x, y, brushSize / 2, 0, 2 * Math.PI);
    overlayCtx.fill();
    
    // Draw white on mask (selected region for editing)
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = 'white';
    maskCtx.beginPath();
    maskCtx.arc(x, y, brushSize / 2, 0, 2 * Math.PI);
    maskCtx.fill();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    draw(e);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleSave = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    // Convert mask canvas to base64 PNG
    // White = region to edit, Black = region to keep
    const maskBase64 = maskCanvas.toDataURL('image/png');
    // Auto-send if instruction is provided, otherwise just save the mask
    onSave(maskBase64, instruction.trim());
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleClear = () => {
    const overlayCanvas = overlayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!overlayCanvas || !maskCanvas) return;

    const overlayCtx = overlayCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!overlayCtx || !maskCtx) return;

    // Clear overlay (red visual feedback)
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    // Reset mask to all black (nothing selected)
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-4 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-semibold text-gray-900">Select Region to Edit</h3>
        </div>
        
        <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-gray-100 mb-3 max-h-[50vh]">
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Image to edit"
            className="w-full h-auto block max-h-[50vh] object-contain"
            style={{ display: 'block' }}
          />
          <canvas
            ref={overlayCanvasRef}
            className="absolute top-0 left-0 cursor-crosshair pointer-events-auto w-full h-full"
            style={{ touchAction: 'none' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          {/* Hidden canvas for mask generation */}
          <canvas
            ref={maskCanvasRef}
            className="hidden"
          />
        </div>
        
        {/* Instruction input */}
        <div className="mb-3">
          <label className="block text-xs text-gray-600 mb-1">Describe your edit</label>
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Make the banner blue and increase the font size"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-gray-900 bg-white"
            autoFocus
          />
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs font-medium"
            >
              Clear
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-xs font-medium"
            >
              Continue
            </button>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 mt-2">
          Paint over the region you want to modify. The selected area will be highlighted in blue.
        </p>
      </div>
    </div>
  );
}

