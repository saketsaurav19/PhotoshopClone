import React from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore, hexToRgba } from './store/useStore';
import Canvas from './components/Canvas/Canvas';
import Toolbar from './components/Toolbar/Toolbar';
import OptionsBar from './components/OptionsBar/OptionsBar';
import ColorPicker from './components/shared/ColorPicker';
import { removeBackground } from '@imgly/background-removal';
import './App.css';

const App: React.FC = () => {
  const {
    layers,
    activeLayerId,
    setActiveLayer,
    toggleLayerVisibility,
    addLayer,
    removeLayer,
    updateLayer,
    zoom,
    history,
    historyIndex,
    undo,
    redo,
    recordHistory,
    inverseSelection,
    duplicateLayer,
    setActiveTool,
    setToolVariant,
    setZoom,
    setSelectionRect,
    setIsInverseSelection,
    setCropRect,
    setLassoPaths,
    setDocumentSize,
    moveLayer,
    reorderLayers,
    documentSize,
    activeTool,
    setIsTyping
  } = useStore();

  const handleSave = (asNew: boolean = false) => {
    const { w, h } = documentSize;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Draw layers from bottom to top
    [...layers].reverse().forEach(layer => {
      if (!layer.visible) return;
      const layerCanvas = document.querySelector(`canvas[data-layer-id="${layer.id}"]`) as HTMLCanvasElement;
      if (layerCanvas) {
        ctx.globalAlpha = layer.opacity || 1;
        ctx.globalCompositeOperation = (layer.blendMode || 'source-over') as any;
        ctx.drawImage(layerCanvas, layer.position.x, layer.position.y);
      }
    });

    const filename = asNew ? prompt('Save as...', 'photoshop_clone_project.png') : 'photoshop_clone_project.png';
    if (!filename) return;

    const link = document.createElement('a');
    link.download = filename;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processingText, setProcessingText] = React.useState('');

  // Mobile UI state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isToolsOpen, setIsToolsOpen] = React.useState(false);
  const [isPanelsOpen, setIsPanelsOpen] = React.useState(false);
  const [activeMobileSubmenu, setActiveMobileSubmenu] = React.useState<string | null>(null);
  const [isFillPickerOpen, setIsFillPickerOpen] = React.useState(false);
  const [fillColor, setFillColor] = React.useState('#ffffff');
  const [fillOpacity, setFillOpacity] = React.useState(1);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [isEditingOpacity, setIsEditingOpacity] = React.useState(false);
  const [tempOpacityValue, setTempOpacityValue] = React.useState('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea or custom text editor
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || useStore.getState().isTyping) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      // File operations
      if (isCtrl && e.key === 'o') {
        e.preventDefault();
        document.getElementById('global-file-input')?.click();
      }
      if (isCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave(e.shiftKey);
      }

      // Undo/Redo
      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (isCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }

      // Tool selection & Cycling
      if (!isCtrl) {
        const key = e.key.toLowerCase();
        const toolGroups: Record<string, { id: string; tools: string[] }> = {
          'v': { id: 'move', tools: ['move', 'artboard'] },
          'm': { id: 'marquee', tools: ['marquee', 'ellipse_marquee'] },
          'l': { id: 'lasso', tools: ['lasso', 'polygonal_lasso', 'magnetic_lasso'] },
          'w': { id: 'selection', tools: ['quick_selection', 'magic_wand', 'object_selection'] },
          'c': { id: 'crop', tools: ['crop', 'perspective_crop', 'slice', 'slice_select'] },
          'i': { id: 'eyedropper', tools: ['eyedropper', 'color_sampler', 'ruler'] },
          'j': { id: 'healing', tools: ['healing', 'healing_brush', 'patch', 'content_aware_move', 'red_eye'] },
          'b': { id: 'brush', tools: ['brush', 'pencil', 'color_replacement', 'mixer_brush'] },
          'y': { id: 'history', tools: ['history_brush', 'art_history_brush'] },
          's': { id: 'clone', tools: ['clone', 'pattern_stamp'] },
          'e': { id: 'eraser', tools: ['eraser', 'background_eraser', 'magic_eraser'] },
          'g': { id: 'gradient', tools: ['gradient', 'paint_bucket'] },
          'o': { id: 'dodge', tools: ['dodge', 'burn', 'sponge'] },
          't': { id: 'text', tools: ['text', 'vertical_text'] },
          'p': { id: 'pen', tools: ['pen', 'free_pen', 'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point'] },
          'a': { id: 'path', tools: ['path_select', 'direct_select'] },
          'u': { id: 'shape', tools: ['shape', 'ellipse_shape', 'triangle_shape', 'polygon_shape', 'line_shape', 'custom_shape'] },
          'h': { id: 'hand', tools: ['hand', 'rotate_view'] },
          'z': { id: 'zoom', tools: ['zoom_tool'] }
        };

        if (toolGroups[key]) {
          const group = toolGroups[key];
          const toolsInGroup = group.tools;
          const currentTool = useStore.getState().activeTool;
          const { setToolVariant } = useStore.getState();

          let nextTool = toolsInGroup[0];
          if (toolsInGroup.includes(currentTool)) {
            const currentIndex = toolsInGroup.indexOf(currentTool);
            nextTool = toolsInGroup[(currentIndex + 1) % toolsInGroup.length];
          }

          setToolVariant(group.id, nextTool as any);
        }
      }

      // Layer Selection (Alt + [ and Alt + ])
      if (e.altKey && !isCtrl) {
        if (e.key === '[' || e.key === ']') {
          e.preventDefault();
          const { layers, activeLayerId, setActiveLayer } = useStore.getState();
          if (layers.length <= 1) return;

          const currentIndex = layers.findIndex(l => l.id === activeLayerId);
          let nextIndex = 0;

          if (e.key === '[') {
            // Select backward (visually down the list)
            nextIndex = (currentIndex + 1) % layers.length;
          } else if (e.key === ']') {
            // Select forward (visually up the list)
            nextIndex = (currentIndex - 1 + layers.length) % layers.length;
          }

          setActiveLayer(layers[nextIndex].id);
        }
      }

      // Zoom
      if (isCtrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom(Math.min(32, zoom + 0.05));
      }
      if (isCtrl && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        setZoom(Math.max(0.01, zoom - 0.05));
      }
      if (isCtrl && e.key === '0') {
        e.preventDefault();
        setZoom(1);
      }

      // Layer management
      if (isCtrl && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (activeLayerId) {
          duplicateLayer(activeLayerId);
          recordHistory('Duplicate Layer');
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.shiftKey && activeLayerId) {
          const layer = layers.find(l => l.id === activeLayerId);
          if (layer && !layer.locked) {
            removeLayer(activeLayerId);
            recordHistory('Delete Layer');
          }
        } else if (activeTool === 'slice_select' && (window as any)._sliceLastClickedIdx !== undefined) {
          const idx = (window as any)._sliceLastClickedIdx;
          const { slices, setSlices } = useStore.getState();
          const nextSlices = slices.filter((_, i) => i !== idx);
          setSlices(nextSlices);
          delete (window as any)._sliceLastClickedIdx;
          recordHistory('Delete Slice');
        } else {
          window.dispatchEvent(new CustomEvent('delete-selection'));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    zoom, activeLayerId, layers, undo, redo,
    setActiveTool,
    setToolVariant,
    setZoom,
    duplicateLayer,
    removeLayer,
    recordHistory,
    activeTool
  ]);

  const handleFile = (file: File | Blob, name?: string) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const isDefaultBackground = layers.length === 1 && layers[0].name === 'Background' && layers[0].type === 'paint';
        if (layers.length === 0 || isDefaultBackground) {
          setDocumentSize({ w: img.width, h: img.height });
        }
        addLayer({
          name: name || (file as File).name || 'Pasted Image',
          type: 'image',
          dataUrl,
          position: (layers.length === 0 || isDefaultBackground) ? { x: 0, y: 0 } : { x: (documentSize.w - img.width) / 2, y: (documentSize.h - img.height) / 2 }
        });
        recordHistory(`Import ${name || 'Image'}`);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) handleFile(blob, 'Pasted Image');
        }
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          handleFile(files[i]);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', handleDragOver);
    };
  }, [layers, documentSize, addLayer, recordHistory, setDocumentSize]);

  const handleInvert = () => {
    if (!activeLayerId) return;
    const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { selectionRect, lassoPaths, isInverseSelection } = useStore.getState();

    // Store the original state
    ctx.save();

    // Create a temporary canvas for the inverted result
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Apply clipping if selection exists
    if (selectionRect) {
      const layer = layers.find(l => l.id === activeLayerId);
      const offX = layer?.position.x || 0;
      const offY = layer?.position.y || 0;
      ctx.beginPath();
      if (isInverseSelection) {
        ctx.rect(0, 0, canvas.width, canvas.height);
      }
      ctx.rect(selectionRect.x - offX, selectionRect.y - offY, selectionRect.w, selectionRect.h);
      ctx.clip(isInverseSelection ? 'evenodd' : 'nonzero');
    } else if (lassoPaths.length > 0) {
      const layer = layers.find(l => l.id === activeLayerId);
      const offX = layer?.position.x || 0;
      const offY = layer?.position.y || 0;
      ctx.beginPath();
      if (isInverseSelection) {
        ctx.rect(0, 0, canvas.width, canvas.height);
      }
      lassoPaths.forEach(path => {
        if (path.length < 3) return;
        ctx.moveTo(path[0].x - offX, path[0].y - offY);
        path.forEach(p => ctx.lineTo(p.x - offX, p.y - offY));
        ctx.closePath();
      });
      ctx.clip('evenodd');
    }

    // Get image data, invert it, and put it back
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }

    // We need to only apply the inverted data to the clipped area
    // A simple way is to use putImageData on the whole thing while clipped
    // But putImageData ignores clipping! 
    // So we put it on the temp canvas and then draw that back to the original with the clip active.
    tempCtx.putImageData(imageData, 0, 0);

    // Clear the clipped area first (optional but safer for some blend modes)
    // Then draw the inverted version from the temp canvas
    ctx.drawImage(tempCanvas, 0, 0);

    ctx.restore();
    updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
    recordHistory('Invert Colors');
  };

  React.useEffect(() => {
    const onInvert = () => handleInvert();
    const onSelectSubject = () => handleSelectSubject();
    const onCropFitDoc = () => {
      setCropRect({ x: 0, y: 0, w: documentSize.w, h: documentSize.h });
    };
    const onCropFitLayer = () => {
      if (!activeLayerId) return;
      const layer = layers.find(l => l.id === activeLayerId);
      if (layer) {
        setCropRect({ x: layer.position.x, y: layer.position.y, w: documentSize.w, h: documentSize.h });
      }
    };

    window.addEventListener('invert-layer', onInvert);
    window.addEventListener('select-subject', onSelectSubject);
    window.addEventListener('crop-fit-doc', onCropFitDoc);
    window.addEventListener('crop-fit-layer', onCropFitLayer);
    return () => {
      window.removeEventListener('invert-layer', onInvert);
      window.removeEventListener('select-subject', onSelectSubject);
      window.removeEventListener('crop-fit-doc', onCropFitDoc);
      window.removeEventListener('crop-fit-layer', onCropFitLayer);
    };
  }, [activeLayerId, layers, updateLayer, recordHistory, documentSize]);

  const handleRemoveBackground = async () => {
    if (!activeLayerId) return;
    const layer = layers.find(l => l.id === activeLayerId);
    if (!layer || !layer.dataUrl) return;

    try {
      setIsProcessing(true);
      setProcessingText('AI is removing background...');

      const blob = await removeBackground(layer.dataUrl);

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        updateLayer(activeLayerId, { dataUrl: result });
        recordHistory('Remove Background');
        setIsProcessing(false);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Failed to remove background:', error);
      setIsProcessing(false);
      alert('Failed to remove background. Please try again.');
    }
  };

  const handleSelectSubject = () => {
    if (!activeLayerId) return;
    const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    let found = false;

    // Fast scan
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const alpha = data[(y * canvas.width + x) * 4 + 3];
        if (alpha > 20) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (found) {
      // Add a small 2px padding
      setSelectionRect({
        x: Math.max(0, minX - 2),
        y: Math.max(0, minY - 2),
        w: Math.min(canvas.width - minX, maxX - minX + 4),
        h: Math.min(canvas.height - minY, maxY - minY + 4)
      });
      setIsInverseSelection(false);
      setLassoPaths([]); // Clear lasso paths if using rect
      recordHistory('Select Subject');
    } else {
      alert('No subject found on this layer.');
    }
  };

  return (
    <div className={`app-layout ${isMobileMenuOpen || isToolsOpen || isPanelsOpen ? 'mobile-panel-active' : ''}`}>
      <input type="file" id="global-file-input" accept="image/*" hidden onChange={handleImageUpload} />

      {(isMobileMenuOpen || isToolsOpen || isPanelsOpen) && (
        <div
          className="mobile-backdrop"
          onClick={() => {
            setIsMobileMenuOpen(false);
            setIsToolsOpen(false);
            setIsPanelsOpen(false);
            setActiveMobileSubmenu(null);
          }}
        />
      )}

      <header className="app-header">
        <div className="header-left">
          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <LucideIcons.Menu size={20} />
          </button>
          <div className="app-logo">
            <img src="./icon1.png" width={24} height={24} alt="icon" />
            <span>Pixelite</span>
          </div>
        </div>

        <nav className={`main-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          {isMobileMenuOpen && (
            <div className="mobile-menu-header">
              <span>Menu</span>
              <button onClick={() => setIsMobileMenuOpen(false)}><LucideIcons.X size={20} /></button>
            </div>
          )}
          <div className={`menu-item-container ${activeMobileSubmenu === 'file' ? 'active' : ''}`}
            onClick={() => setActiveMobileSubmenu(activeMobileSubmenu === 'file' ? null : 'file')}>
            <span>File</span>
            <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); document.getElementById('global-file-input')?.click(); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}>
                <span>Open</span> <span className="shortcut">Ctrl+O</span>
              </div>
              <div className="menu-divider" />
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); handleSave(false); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}>
                <span>Save</span> <span className="shortcut">Ctrl+S</span>
              </div>
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); handleSave(true); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}>
                <span>Save As...</span> <span className="shortcut">Ctrl+Shift+S</span>
              </div>
            </div>
          </div>
          <div className={`menu-item-container ${activeMobileSubmenu === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveMobileSubmenu(activeMobileSubmenu === 'edit' ? null : 'edit')}>
            <span>Edit</span>
            <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); undo(); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }} style={{ opacity: historyIndex <= 0 ? 0.5 : 1 }}>
                <span>Undo</span> <span className="shortcut">Ctrl+Z</span>
              </div>
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); redo(); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }} style={{ opacity: historyIndex >= history.length - 1 ? 0.5 : 1 }}>
                <span>Redo</span> <span className="shortcut">Ctrl+Y</span>
              </div>
              <div className="menu-divider" />
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}><span>Cut</span> <span className="shortcut">Ctrl+X</span></div>
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}><span>Copy</span> <span className="shortcut">Ctrl+C</span></div>
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}><span>Paste</span> <span className="shortcut">Ctrl+V</span></div>
            </div>
          </div>
          <div className={`menu-item-container ${activeMobileSubmenu === 'image' ? 'active' : ''}`}
            onClick={() => setActiveMobileSubmenu(activeMobileSubmenu === 'image' ? null : 'image')}>
            <span>Image</span>
            <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="menu-option submenu-parent">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Adjustments</span>
                <LucideIcons.ChevronRight size={12} />
                <div className="menu-submenu">
                  <div className="menu-option" onClick={(e) => { e.stopPropagation(); handleInvert(); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}>
                    <span>Invert</span> <span className="shortcut">Ctrl+I</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={`menu-item-container ${activeMobileSubmenu === 'layer' ? 'active' : ''}`}
            onClick={() => setActiveMobileSubmenu(activeMobileSubmenu === 'layer' ? null : 'layer')}>
            <span>Layer</span>
            <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); setIsFillPickerOpen(true); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}>
                <span>Fill Layer...</span>
              </div>
              <div className="menu-divider" />
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); activeLayerId && duplicateLayer(activeLayerId); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}>
                <span>Duplicate Layer</span> <span className="shortcut">Ctrl+J</span>
              </div>
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); activeLayerId && removeLayer(activeLayerId); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}>
                <span>Delete Layer</span> <span className="shortcut">Del</span>
              </div>
            </div>
          </div>
          <div className={`menu-item-container ${activeMobileSubmenu === 'select' ? 'active' : ''}`}
            onClick={() => setActiveMobileSubmenu(activeMobileSubmenu === 'select' ? null : 'select')}>
            <span>Select</span>
            <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); handleSelectSubject(); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}>
                <span>Select Subject</span> <span className="shortcut">Ctrl+Alt+S</span>
              </div>
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); handleRemoveBackground(); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}>
                <span>Remove Bg</span>
              </div>
              <div className="menu-divider" />
              <div className="menu-option"><span>All</span> <span className="shortcut">Ctrl+A</span></div>
              <div className="menu-option"><span>Deselect</span> <span className="shortcut">Ctrl+D</span></div>
              <div className="menu-option" onClick={(e) => { e.stopPropagation(); inverseSelection(); recordHistory('Inverse Selection'); setIsMobileMenuOpen(false); setActiveMobileSubmenu(null); }}>
                <span>Inverse Selection</span> <span className="shortcut">Shift+Ctrl+I</span>
              </div>
            </div>
          </div>
          <div className="menu-item-container"><span>Filter</span></div>
          <div className="menu-item-container"><span>View</span></div>
          <div className="menu-item-container"><span>Window</span></div>
        </nav>

        <div className="header-right">
          {/* Mobile toggle buttons */}
          <button
            className={`mobile-panel-toggle ${isToolsOpen ? 'active' : ''}`}
            onClick={() => { setIsToolsOpen(!isToolsOpen); setIsPanelsOpen(false); }}
          >
            <LucideIcons.Wrench size={18} />
          </button>
          <button
            className={`mobile-panel-toggle ${isPanelsOpen ? 'active' : ''}`}
            onClick={() => { setIsPanelsOpen(!isPanelsOpen); setIsToolsOpen(false); }}
          >
            <LucideIcons.PanelRight size={18} />
          </button>
        </div>
      </header>
      <OptionsBar />
      <div className="app-body">
        <div className={`toolbar-wrapper ${isToolsOpen ? 'mobile-open' : ''}`}>
          {isToolsOpen && (
            <div className="mobile-panel-header">
              <span>Tools</span>
              <button onClick={() => setIsToolsOpen(false)}><LucideIcons.ChevronDown size={20} /></button>
            </div>
          )}
          <Toolbar onAction={() => setIsToolsOpen(false)} />
        </div>

        <main className="workspace">
          <div className="canvas-viewport">
            {/* Welcome Screen / Empty State */}
            {layers.length === 0 && (
              <div className="empty-workspace-overlay">
                <div className="welcome-card">
                  <div className="welcome-icon">
                    <LucideIcons.Image size={48} />
                  </div>
                  <h2>Welcome to Pixelite</h2>
                  <p>Start a new project or open an existing image to begin.</p>
                  <div className="welcome-actions">
                    <button
                      className="welcome-btn primary"
                      onClick={() => {
                        addLayer({
                          name: 'Background',
                          type: 'paint',
                          visible: true,
                          locked: false,
                          opacity: 1,
                          position: { x: 0, y: 0 },
                          blendMode: 'source-over'
                        });
                        recordHistory('New Blank Project');
                      }}
                    >
                      <LucideIcons.Plus size={18} />
                      New Blank Document
                    </button>
                    <button
                      className="welcome-btn secondary"
                      onClick={() => document.getElementById('global-file-input')?.click()}
                    >
                      <LucideIcons.FolderOpen size={18} />
                      Open Image
                    </button>
                  </div>
                </div>
              </div>
            )}

            <Canvas />
          </div>

          {isProcessing && (
            <div className="processing-overlay">
              <div className="processing-spinner" />
              <div className="processing-message">{processingText}</div>
            </div>
          )}

          <footer className="status-bar">
            <div className="status-item">Zoom: {(zoom * 100).toFixed(0)}%</div>
            <div className="status-item">GPU: Active</div>
            <div className="status-item status-ready">Ready</div>
          </footer>
        </main>

        <aside className={`side-panels ${isPanelsOpen ? 'mobile-open' : ''}`}>
          {isPanelsOpen && (
            <div className="mobile-panel-header">
              <span>History & Layers</span>
              <button onClick={() => setIsPanelsOpen(false)}><LucideIcons.ChevronDown size={20} /></button>
            </div>
          )}
          <div className="side-panel history-panel">
            <div className="panel-tab">History</div>
            <div className="panel-content">
              {history.map((entry, idx) => (
                <div key={idx} className={`history-item ${idx === historyIndex ? 'active' : ''} ${idx > historyIndex ? 'undone' : ''}`}>
                  {entry.name}
                </div>
              ))}
            </div>
          </div>

          <div className="side-panel layers-panel">
            <div className="panel-tab">Layers</div>
            
            {/* Global Layer Properties - Only visible if a layer is active */}
            {activeLayerId && (() => {
              const activeLayer = layers.find(l => l.id === activeLayerId);
              if (!activeLayer) return null;
              return (
                <div className="layer-global-properties">
                  <select 
                    className="blend-select" 
                    value={activeLayer.blendMode || 'source-over'} 
                    onChange={(e) => updateLayer(activeLayerId, { blendMode: e.target.value as any })}
                  >
                    <option value="source-over">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                    <option value="overlay">Overlay</option>
                  </select>
                  <div className="opacity-control">
                    <span>Op:</span>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.01"
                      value={activeLayer.opacity || 1}
                      onChange={(e) => updateLayer(activeLayerId, { opacity: parseFloat(e.target.value) })}
                    />
                    {isEditingOpacity ? (
                      <input 
                        type="text"
                        className="opacity-input"
                        autoFocus
                        value={tempOpacityValue}
                        onChange={(e) => setTempOpacityValue(e.target.value)}
                        onFocus={(e) => {
                          e.target.select();
                          setIsTyping(true);
                        }}
                        onBlur={() => {
                          setIsEditingOpacity(false);
                          setIsTyping(false);
                          const val = parseInt(tempOpacityValue);
                          if (!isNaN(val)) {
                            updateLayer(activeLayerId, { opacity: Math.max(0, Math.min(1, val / 100)) });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                          if (e.key === 'Escape') {
                            setIsEditingOpacity(false);
                            setIsTyping(false);
                          }
                        }}
                      />
                    ) : (
                      <span 
                        className="opacity-val" 
                        onDoubleClick={() => {
                          setTempOpacityValue(Math.round((activeLayer.opacity || 1) * 100).toString());
                          setIsEditingOpacity(true);
                        }}
                        title="Double-click to type exact value"
                      >
                        {Math.round((activeLayer.opacity || 1) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="panel-content">
              {layers.map((layer, idx) => (
                <div
                  key={layer.id}
                  className={`layer-node ${draggedIndex === idx ? 'dragging' : ''}`}
                  draggable={true}
                  onDragStart={() => setDraggedIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedIndex !== null && draggedIndex !== idx) {
                      reorderLayers(draggedIndex, idx);
                      recordHistory('Reorder Layers');
                    }
                    setDraggedIndex(null);
                  }}
                  onDragEnd={() => setDraggedIndex(null)}
                >
                  <div className={`layer-row ${activeLayerId === layer.id ? 'active' : ''}`} onClick={() => setActiveLayer(layer.id)}>
                    <div className="layer-eye" onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}>
                      {layer.visible ? <LucideIcons.Eye size={12} /> : <LucideIcons.EyeOff size={12} />}
                    </div>
                    <div className="layer-thumb">
                      {layer.thumbnail && <img src={layer.thumbnail} alt="" />}
                    </div>
                    <span className="layer-title">{layer.name}</span>
                    <div className="layer-order-btns">
                      <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'up'); recordHistory('Move Layer Up'); }} title="Move Up"><LucideIcons.ChevronUp size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'down'); recordHistory('Move Layer Down'); }} title="Move Down"><LucideIcons.ChevronDown size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="panel-footer">
              <button onClick={() => addLayer({ name: `Layer ${layers.length + 1}` })}><LucideIcons.Plus size={14} /></button>
              <button onClick={() => activeLayerId && removeLayer(activeLayerId)} disabled={layers.length <= 1}><LucideIcons.Trash2 size={14} /></button>
            </div>
          </div>
        </aside>
      </div>
      {/* Fill Color Picker Modal */}
      {isFillPickerOpen && (
        <div className="modal-overlay" onClick={() => setIsFillPickerOpen(false)}>
          <div className="modal-content color-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Fill Layer</h3>
              <button className="modal-close-btn" onClick={() => setIsFillPickerOpen(false)}>
                <LucideIcons.X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <ColorPicker
                label="Fill Color"
                color={fillColor}
                opacity={fillOpacity}
                onColorChange={setFillColor}
                onOpacityChange={setFillOpacity}
              />
            </div>
            <div className="modal-actions">
              <button className="premium-btn-sm secondary" onClick={() => setIsFillPickerOpen(false)}>Cancel</button>
              <button className="premium-btn-sm" onClick={() => {
                if (!activeLayerId) return;
                const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
                const ctx = canvas?.getContext('2d');
                if (ctx) {
                  const { lassoPaths, selectionRect } = useStore.getState();
                  ctx.save();
                  ctx.fillStyle = hexToRgba(fillColor, fillOpacity);

                  if (lassoPaths.length > 0) {
                    ctx.beginPath();
                    lassoPaths.forEach(path => {
                      if (path.length < 3) return;
                      ctx.moveTo(path[0].x, path[0].y);
                      path.forEach(p => ctx.lineTo(p.x, p.y));
                      ctx.closePath();
                    });
                    ctx.clip('evenodd');
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                  } else if (selectionRect) {
                    ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
                  } else {
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                  }

                  ctx.restore();
                  updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
                  recordHistory('Fill Layer');
                  setIsFillPickerOpen(false);
                }
              }}>Fill Layer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
