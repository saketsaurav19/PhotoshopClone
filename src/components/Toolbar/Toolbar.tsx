import React from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Tool } from '../../store/useStore';
import ToolButton from './ToolButton';
import CustomColorPicker from '../shared/ColorPicker';

interface ToolbarProps {
  onAction?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onAction }) => {
  const { activeTool, setActiveTool } = useStore();

  const tools: { id: Tool; icon: any; label: string; shortcut: string }[] = [
    { id: 'move', icon: LucideIcons.Move, label: 'Move Tool', shortcut: 'V' },
    { id: 'marquee', icon: LucideIcons.BoxSelect, label: 'Rectangle Select', shortcut: 'M' },
    { id: 'lasso', icon: LucideIcons.Spline, label: 'Lasso Select', shortcut: 'L' },
    { id: 'quick_select', icon: LucideIcons.Sparkles, label: 'Quick Selection', shortcut: 'W' },
    { id: 'crop', icon: LucideIcons.Crop, label: 'Perspective Crop', shortcut: 'C' },
    { id: 'eyedropper', icon: LucideIcons.Pipette, label: 'Eyedropper', shortcut: 'I' },
    { id: 'healing', icon: LucideIcons.Bandage, label: 'Spot Healing Brush', shortcut: 'J' },
    { id: 'brush', icon: LucideIcons.Brush, label: 'Brush Tool', shortcut: 'B' },
    { id: 'clone', icon: LucideIcons.Copy, label: 'Clone Tool', shortcut: 'S' },
    { id: 'eraser', icon: LucideIcons.Eraser, label: 'Eraser Tool', shortcut: 'E' },
    { id: 'gradient', icon: LucideIcons.PaintBucket, label: 'Gradient Tool', shortcut: 'G' },
    { id: 'blur', icon: LucideIcons.Droplets, label: 'Blur Tool', shortcut: '' },
    { id: 'dodge', icon: LucideIcons.Sun, label: 'Dodge Tool', shortcut: 'O' },
    { id: 'text', icon: LucideIcons.Type, label: 'Type Tool', shortcut: 'T' },
    { id: 'pen', icon: LucideIcons.PenTool, label: 'Pen', shortcut: 'P' },
    { id: 'path_select', icon: LucideIcons.MousePointer2, label: 'Path Select', shortcut: 'A' },
    { id: 'shape', icon: LucideIcons.Square, label: 'Rectangle', shortcut: 'U' },
    { id: 'hand', icon: LucideIcons.Hand, label: 'Hand Tool', shortcut: 'H' },
    { id: 'zoom_tool', icon: LucideIcons.Search, label: 'Zoom Tool', shortcut: 'Z' },
  ];

  return (
    <aside className="left-toolbar">
      <div className="tools-container">
        {tools.map((tool) => (
          <ToolButton
            key={tool.id}
            id={tool.id}
            active={activeTool === tool.id}
            icon={tool.icon}
            label={tool.label}
            shortcut={tool.shortcut}
            onClick={() => {
              setActiveTool(tool.id);
              onAction?.();
            }}
          />
        ))}
      </div>
      <ColorPickerSection />
    </aside>
  );
};

const ColorPickerSection: React.FC = () => {
  const {
    brushColor, setBrushColor,
    secondaryColor, setSecondaryColor,
    primaryOpacity, setPrimaryOpacity,
    secondaryOpacity, setSecondaryOpacity
  } = useStore();

  const handleSwap = () => {
    const tempColor = brushColor;
    const tempOpacity = primaryOpacity;
    setBrushColor(secondaryColor);
    setPrimaryOpacity(secondaryOpacity);
    setSecondaryColor(tempColor);
    setSecondaryOpacity(tempOpacity);
  };

  const handleDefault = () => {
    setBrushColor('#000000');
    setSecondaryColor('#ffffff');
    setPrimaryOpacity(1);
    setSecondaryOpacity(1);
  };

  return (
    <div className="toolbar-colors">
      <div className="color-squares-container">
        <CustomColorPicker
          color={secondaryColor}
          opacity={secondaryOpacity}
          onColorChange={setSecondaryColor}
          onOpacityChange={setSecondaryOpacity}
          popoverDirection="right"
          renderTrigger={(onClick) => (
            <div
              className="color-square secondary"
              style={{ backgroundColor: secondaryColor, opacity: secondaryOpacity }}
              onClick={onClick}
            />
          )}
        />
        <CustomColorPicker
          color={brushColor}
          opacity={primaryOpacity}
          onColorChange={setBrushColor}
          onOpacityChange={setPrimaryOpacity}
          popoverDirection="right"
          renderTrigger={(onClick) => (
            <div
              className="color-square primary"
              style={{ backgroundColor: brushColor, opacity: primaryOpacity }}
              onClick={onClick}
            />
          )}
        />
      </div>

      <div className="color-actions">
        <button className="color-action-btn" title="Default Colors (D)" onClick={handleDefault}>
          <LucideIcons.Grid size={12} />
        </button>
        <button className="color-action-btn" title="Swap Colors (X)" onClick={handleSwap}>
          <LucideIcons.Repeat size={12} />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
