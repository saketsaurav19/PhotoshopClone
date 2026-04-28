export const BRUSH_TOOLS = [
  'brush', 'pencil', 'eraser', 'blur', 'sharpen', 'dodge', 'burn',
  'healing', 'healing_brush', 'patch', 'smudge', 'clone', 'pattern_stamp',
  'mixer_brush', 'color_replacement', 'background_eraser', 'magic_eraser',
  'history_brush', 'art_history_brush', 'sponge'
];

export const isBrushTool = (tool: string) => BRUSH_TOOLS.includes(tool);
