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

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-900">Inspector</h3>
      <div className="space-y-2 text-xs">
        <div>
          <label className="block text-gray-600 mb-0.5">Label</label>
          <input className="w-full border rounded px-2 py-1" value={node.label || ''} onChange={(e)=>onChange({ label: e.target.value })} />
        </div>
        <div>
          <label className="block text-gray-600 mb-0.5">Count</label>
          <input className="w-24 border rounded px-2 py-1" value={node.count ?? ''} onChange={(e)=>onChange({ count: Number(e.target.value)||undefined })} />
        </div>
        <div>
          <label className="block text-gray-600 mb-0.5">Color</label>
          <input type="color" className="w-10 h-6" value={node.color || '#ffffff'} onChange={(e)=>onChange({ color: e.target.value })} />
        </div>
        <button className="px-2 py-1 border rounded text-red-600" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}


