export const getCursor = (
  isInteracting: boolean,
  activeTool: string,
  isAltPressed: boolean,
  isCtrlPressed: boolean,
  BRUSH_TOOLS: string[]
): string => {
  if (isInteracting && activeTool === 'hand') return 'grabbing';
  if (activeTool === 'hand') return 'grab';
  if (activeTool === 'move' || activeTool === 'artboard') return 'move';
  if (activeTool === 'zoom_tool') return isAltPressed ? 'zoom-out' : 'zoom-in';
  if (activeTool === 'eyedropper' || activeTool === 'color_sampler') return 'copy';
  if (activeTool === 'text' || activeTool === 'vertical_text') return 'text';

  let tool = activeTool;
  if (['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor'].includes(activeTool as string)) {
    if (isCtrlPressed) tool = 'direct_select' as any;
    else if (isAltPressed) tool = 'convert_point' as any;
  }

  if (tool === 'pen' || tool === 'curvature_pen' || tool === 'free_pen') {
    return `url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.5 3.5L12 9 8.5 5.5 12 2Z"/><path d="m12 9-.342 6.163a2 2 0 0 1-1.316 1.71l-5.632 1.877L12 22l7.29-3.25-5.632-1.877a2 2 0 0 1-1.316-1.71L12 9Z"/></svg>')}") 0 22, auto`;
  }
  if (tool === 'add_anchor') {
    return `url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 3.5 3.5L8 9 4.5 5.5 8 2Z"/><path d="m8 9-.342 6.163a2 2 0 0 1-1.316 1.71l-5.632 1.877L8 22l7.29-3.25-5.632-1.877a2 2 0 0 1-1.316-1.71L8 9Z"/><line x1="16" y1="8" x2="22" y2="8" stroke="black" stroke-width="2"/><line x1="19" y1="5" x2="19" y2="11" stroke="black" stroke-width="2"/></svg>')}") 0 22, auto`;
  }
  if (tool === 'delete_anchor') {
    return `url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 3.5 3.5L8 9 4.5 5.5 8 2Z"/><path d="m8 9-.342 6.163a2 2 0 0 1-1.316 1.71l-5.632 1.877L8 22l7.29-3.25-5.632-1.877a2 2 0 0 1-1.316-1.71L8 9Z"/><line x1="16" y1="8" x2="22" y2="8" stroke="black" stroke-width="2"/></svg>')}") 0 22, auto`;
  }
  if (tool === 'direct_select') return 'crosshair';
  if (tool === 'path_select') return 'default';
  if (tool === 'convert_point') return 'alias';

  if (BRUSH_TOOLS.includes(activeTool as string)) {
    return 'none';
  }
  return 'crosshair';
};
