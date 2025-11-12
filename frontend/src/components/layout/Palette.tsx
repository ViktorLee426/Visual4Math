export type PaletteItemType = 'bag' | 'ball' | 'child' | 'box' | 'text';

interface PaletteProps {
  onAdd: (type: PaletteItemType) => void;
}

export default function Palette({ onAdd }: PaletteProps) {
  const items: { type: PaletteItemType; label: string }[] = [
    { type: 'bag', label: 'Bag' },
    { type: 'ball', label: 'Ball' },
    { type: 'child', label: 'Child' },
    { type: 'box', label: 'Box' },
    { type: 'text', label: 'Text' },
  ];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-900">Palette</h3>
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <button
            key={item.type}
            onClick={() => onAdd(item.type)}
            className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50"
          >
            + {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}


