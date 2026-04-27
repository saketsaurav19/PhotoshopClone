import React from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Tool } from '../../store/useStore';
import ToolButton from './ToolButton';
import CustomColorPicker from '../shared/ColorPicker';

import ToolContextMenu from './ToolContextMenu';

interface ToolbarProps {
  onAction?: () => void;
}

interface ToolInfo {
  id: Tool;
  icon: any;
  label: string;
  shortcut: string;
}

interface ToolGroup {
  id: string;
  tools: ToolInfo[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'move',
    tools: [
      { id: 'move', icon: LucideIcons.Move, label: 'Move Tool', shortcut: 'V' },
      { id: 'artboard', icon: LucideIcons.Layout, label: 'Artboard Tool', shortcut: 'V' },
    ],
  },
  {
    id: 'marquee',
    tools: [
      { id: 'marquee', icon: LucideIcons.BoxSelect, label: 'Rectangle Select', shortcut: 'M' },
      { id: 'ellipse_marquee', icon: LucideIcons.Circle, label: 'Ellipse Select', shortcut: 'M' },
    ],
  },
  {
    id: 'lasso',
    tools: [
      { id: 'lasso', icon: LucideIcons.Spline, label: 'Lasso Select', shortcut: 'L' },
      { id: 'polygonal_lasso', icon: LucideIcons.Triangle, label: 'Polygonal Lasso', shortcut: 'L' },
      { id: 'magnetic_lasso', icon: LucideIcons.Zap, label: 'Magnetic Lasso', shortcut: 'L' },
    ],
  },
  {
    id: 'selection',
    tools: [
      { id: 'quick_selection', icon: LucideIcons.Sparkles, label: 'Quick Selection', shortcut: 'W' },
      { id: 'magic_wand', icon: LucideIcons.Wand2, label: 'Magic Wand', shortcut: 'W' },
      { id: 'object_selection', icon: LucideIcons.Focus, label: 'Object Selection', shortcut: 'W' },
    ],
  },
  {
    id: 'crop',
    tools: [
      { id: 'crop', icon: LucideIcons.Crop, label: 'Crop Tool', shortcut: 'C' },
      { id: 'perspective_crop', icon: LucideIcons.Maximize, label: 'Perspective Crop', shortcut: 'C' },
      { id: 'slice', icon: LucideIcons.Scissors, label: 'Slice Tool', shortcut: 'C' },
      { id: 'slice_select', icon: LucideIcons.Pointer, label: 'Slice Select Tool', shortcut: 'C' },
    ],
  },
  {
    id: 'eyedropper',
    tools: [
      { id: 'eyedropper', icon: LucideIcons.Pipette, label: 'Eyedropper', shortcut: 'I' },
      { id: 'color_sampler', icon: LucideIcons.Crosshair, label: 'Color Sampler', shortcut: 'I' },
      { id: 'ruler', icon: LucideIcons.Ruler, label: 'Ruler', shortcut: 'I' },
    ],
  },
  {
    id: 'healing',
    tools: [
      { id: 'healing', icon: LucideIcons.Bandage, label: 'Spot Healing Brush', shortcut: 'J' },
      { id: 'healing_brush', icon: LucideIcons.Sticker, label: 'Healing Brush', shortcut: 'J' },
      { id: 'patch', icon: LucideIcons.Wand2, label: 'Patch Tool', shortcut: 'J' },
    ],
  },
  {
    id: 'brush',
    tools: [
      { id: 'brush', icon: LucideIcons.Brush, label: 'Brush Tool', shortcut: 'B' },
      { id: 'pencil', icon: LucideIcons.Pencil, label: 'Pencil Tool', shortcut: 'B' },
      { id: 'color_replacement', icon: LucideIcons.Paintbrush, label: 'Color Replacement', shortcut: 'B' },
    ],
  },
  {
    id: 'clone',
    tools: [
      { id: 'clone', icon: LucideIcons.Copy, label: 'Clone Tool', shortcut: 'S' },
      { id: 'pattern_stamp', icon: LucideIcons.Stamp, label: 'Pattern Stamp', shortcut: 'S' },
    ],
  },
  {
    id: 'eraser',
    tools: [
      { id: 'eraser', icon: LucideIcons.Eraser, label: 'Eraser Tool', shortcut: 'E' },
      { id: 'background_eraser', icon: LucideIcons.Trash, label: 'Background Eraser', shortcut: 'E' },
    ],
  },
  {
    id: 'gradient',
    tools: [
      { id: 'gradient', icon: LucideIcons.Layers, label: 'Gradient Tool', shortcut: 'G' },
      { id: 'paint_bucket', icon: LucideIcons.PaintBucket, label: 'Paint Bucket Tool', shortcut: 'G' },
    ],
  },
  {
    id: 'blur',
    tools: [
      { id: 'blur', icon: LucideIcons.Droplets, label: 'Blur Tool', shortcut: '' },
      { id: 'sharpen', icon: LucideIcons.Zap, label: 'Sharpen Tool', shortcut: '' },
      { id: 'smudge', icon: LucideIcons.Fingerprint, label: 'Smudge Tool', shortcut: '' },
    ],
  },
  {
    id: 'dodge',
    tools: [
      { id: 'dodge', icon: LucideIcons.Sun, label: 'Dodge Tool', shortcut: 'O' },
      { id: 'burn', icon: LucideIcons.Moon, label: 'Burn Tool', shortcut: 'O' },
      { id: 'sponge', icon: LucideIcons.Cloud, label: 'Sponge Tool', shortcut: 'O' },
    ],
  },
  {
    id: 'text',
    tools: [
      { id: 'text', icon: LucideIcons.Type, label: 'Type Tool', shortcut: 'T' },
      { id: 'vertical_text', icon: LucideIcons.CaseSensitive, label: 'Vertical Type Tool', shortcut: 'T' },
    ],
  },
  {
    id: 'pen',
    tools: [
      { id: 'pen', icon: LucideIcons.PenTool, label: 'Pen', shortcut: 'P' },
      { id: 'free_pen', icon: LucideIcons.Edit3, label: 'Free Pen', shortcut: 'P' },
      { id: 'add_anchor', icon: LucideIcons.Plus, label: 'Add Anchor Point', shortcut: 'P' },
      { id: 'delete_anchor', icon: LucideIcons.Minus, label: 'Delete Anchor Point', shortcut: 'P' },
    ],
  },
  {
    id: 'path',
    tools: [
      { id: 'path_select', icon: LucideIcons.MousePointer2, label: 'Path Select', shortcut: 'A' },
      { id: 'direct_select', icon: LucideIcons.MousePointer, label: 'Direct Select', shortcut: 'A' },
    ],
  },
  {
    id: 'shape',
    tools: [
      { id: 'shape', icon: LucideIcons.Square, label: 'Rectangle', shortcut: 'U' },
      { id: 'ellipse_shape', icon: LucideIcons.Circle, label: 'Ellipse', shortcut: 'U' },
      { id: 'line_shape', icon: LucideIcons.Minus, label: 'Line', shortcut: 'U' },
    ],
  },
  {
    id: 'hand',
    tools: [
      { id: 'hand', icon: LucideIcons.Hand, label: 'Hand Tool', shortcut: 'H' },
      { id: 'rotate_view', icon: LucideIcons.RefreshCw, label: 'Rotate View', shortcut: 'R' },
    ],
  },
  {
    id: 'zoom',
    tools: [
      { id: 'zoom_tool', icon: LucideIcons.Search, label: 'Zoom Tool', shortcut: 'Z' },
    ],
  },
];

const Toolbar: React.FC<ToolbarProps> = ({ onAction }) => {
  const { activeTool, setActiveTool, activeToolVariants, setToolVariant } = useStore();
  const [contextMenu, setContextMenu] = React.useState<{ groupId: string; x: number; y: number } | null>(null);

  const handleToolClick = (_groupId: string, toolId: Tool) => {
    setActiveTool(toolId);
    onAction?.();
  };

  const handleContextMenu = (e: React.MouseEvent, groupId: string) => {
    setContextMenu({
      groupId,
      x: e.clientX,
      y: e.clientY
    });
  };

  return (
    <aside className="left-toolbar">
      <div className="tools-container">
        {TOOL_GROUPS.map((group) => {
          const activeVariantId = activeToolVariants[group.id] || group.tools[0].id;
          const activeVariant = group.tools.find(t => t.id === activeVariantId) || group.tools[0];
          const isGroupActive = group.tools.some(t => t.id === activeTool);

          return (
            <ToolButton
              key={group.id}
              id={activeVariant.id}
              active={isGroupActive}
              icon={activeVariant.icon}
              label={activeVariant.label}
              shortcut={activeVariant.shortcut}
              hasVariants={group.tools.length > 1}
              onClick={() => handleToolClick(group.id, activeVariant.id)}
              onContextMenu={(e) => handleContextMenu(e, group.id)}
            />
          );
        })}
      </div>
      
      {contextMenu && (
        <ToolContextMenu
          tools={TOOL_GROUPS.find(g => g.id === contextMenu.groupId)?.tools || []}
          activeTool={activeTool}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onSelect={(toolId) => setToolVariant(contextMenu.groupId, toolId)}
          onClose={() => setContextMenu(null)}
        />
      )}

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
