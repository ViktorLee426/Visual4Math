import type { LayoutNode } from './LayoutCanvas';

interface InspectorProps {
  node: LayoutNode | null;
  onChange: (patch: Partial<LayoutNode>) => void;
  onDelete: () => void;
}

export default function Inspector({ node, onChange, onDelete }: InspectorProps) {
  if (!node) {
    return (
      <div className="text-xs text-gray-400">Select an object to edit its properties.</div>
    );
  }

  // Text box properties panel
  if (node.type === 'text') {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900">Inspector</h3>
        <div className="space-y-2 text-xs">
          {/* Text input */}
          <div>
            <label className="block text-gray-600 mb-0.5">Text</label>
            <input className="w-full border rounded px-2 py-1 text-gray-900 bg-white" value={node.label || ''} onChange={(e)=>onChange({ label: e.target.value })} />
          </div>
          
          {/* Background color (inpainting color) */}
          <div>
            <label className="block text-gray-600 mb-0.5">Background color</label>
            <input type="color" className="w-10 h-6" value={node.color || '#ffffff'} onChange={(e)=>onChange({ color: e.target.value })} />
          </div>
          
          {/* Text color */}
          <div>
            <label className="block text-gray-600 mb-0.5">Text color</label>
            <input type="color" className="w-10 h-6" value={node.textColor || '#000000'} onChange={(e)=>onChange({ textColor: e.target.value })} />
          </div>
          
          {/* Border */}
          <div className="space-y-1">
            <label className="block text-gray-600 mb-0.5">Border</label>
            <div className="flex items-center gap-2">
              <input type="color" className="w-10 h-6" value={node.borderColor || '#000000'} onChange={(e)=>onChange({ borderColor: e.target.value })} />
              <input 
                type="number" 
                className="w-16 border rounded px-2 py-1 text-gray-900 bg-white" 
                value={node.borderWidth ?? 1} 
                min="0"
                max="10"
                onChange={(e)=>onChange({ borderWidth: Number(e.target.value) || 0 })} 
                placeholder="Width"
              />
            </div>
          </div>
          
          <button className="px-2 py-1 border rounded text-red-600" onClick={onDelete}>Delete</button>
        </div>
      </div>
    );
  }

  // Object box properties panel (original)
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-900">Inspector</h3>
      <div className="space-y-2 text-xs">
        <div>
          <label className="block text-gray-600 mb-0.5">Label</label>
          <input className="w-full border rounded px-2 py-1 text-gray-900 bg-white" value={node.label || ''} onChange={(e)=>onChange({ label: e.target.value })} />
        </div>
        <div>
          <label className="block text-gray-600 mb-0.5">Count</label>
          <input className="w-24 border rounded px-2 py-1 text-gray-900 bg-white" value={node.count ?? ''} onChange={(e)=>onChange({ count: Number(e.target.value)||undefined })} />
        </div>
        <div>
          <label className="block text-gray-600 mb-0.5">Object color</label>
          <input type="color" className="w-10 h-6" value={node.color || '#ffffff'} onChange={(e)=>onChange({ color: e.target.value })} />
        </div>
        <button className="px-2 py-1 border rounded text-red-600" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}


