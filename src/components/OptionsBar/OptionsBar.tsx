import React from 'react';
import { useStore, hexToRgba } from '../../store/useStore';
import ColorPicker from '../shared/ColorPicker';
import * as LucideIcons from 'lucide-react';

interface EditableValueProps {
  value: number;
  unit: string;
  onCommit: (val: number) => void;
}

const EditableValue: React.FC<EditableValueProps> = ({ value, unit, onCommit }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempValue, setTempValue] = React.useState('');
  const setIsTyping = useStore(state => state.setIsTyping);

  React.useEffect(() => {
    if (isEditing) {
      setIsTyping(true);
    } else {
      setIsTyping(false);
    }
    return () => setIsTyping(false);
  }, [isEditing, setIsTyping]);

  if (isEditing) {
    return (
      <input
        type="text"
        className="value-input"
        autoFocus
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          setIsEditing(false);
          const val = unit === '%' ? parseFloat(tempValue) : parseInt(tempValue);
          if (!isNaN(val)) onCommit(val);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setIsEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="value-label"
      onDoubleClick={() => {
        setTempValue(value.toString());
        setIsEditing(true);
      }}
      title="Double-click to type exact value"
    >
      {value}{unit}
    </span>
  );
};

const OptionsBar: React.FC = () => {
  const {
    activeTool, brushSize, setBrushSize,
    strokeWidth, setStrokeWidth,
    brushColor, setBrushColor, primaryOpacity, setPrimaryOpacity,
    secondaryColor, setSecondaryColor, secondaryOpacity, setSecondaryOpacity,
    penMode, setPenMode, setVectorPaths, setActivePathIndex, setLassoPaths,
    recordHistory, addLayer,
    undo, redo, activeLayerId, removeLayer, duplicateLayer,
    zoom, setZoom,
    setSelectionRect, setIsInverseSelection, inverseSelection,
    selectionRect, lassoPaths,
    selectionTolerance, setSelectionTolerance,
    selectionContiguous, setSelectionContiguous,
    selectionMode, setSelectionMode,
    customPattern,
    toolStrength, setToolStrength,
    toolHardness, setToolHardness,
    polygonSides, setPolygonSides,
    starPoints, setStarPoints,
    starInnerRadius, setStarInnerRadius,
    cornerRadius, setCornerRadius,
    canvasRotation, setCanvasRotation,
    redEyePupilSize, setRedEyePupilSize,
    redEyeDarkenAmount, setRedEyeDarkenAmount,
    selectionFeather, setSelectionFeather,
    selectionAntiAlias, setSelectionAntiAlias,
    gradientType, setGradientType,
    healingSourceMode, setHealingSourceMode,
    patchMode, setPatchMode,
    contentAwareMoveMode, setContentAwareMoveMode,
    moveAutoSelect, setMoveAutoSelect,
    moveShowTransform, setMoveShowTransform,
    textFontFamily, setTextFontFamily,
    textAlign, setTextAlign
  } = useStore();

  const handleDeselect = () => {
    setSelectionRect(null);
    setLassoPaths([]);
    setIsInverseSelection(false);
    recordHistory('Deselect');
  };

  return (
    <div className="options-bar">
      <div className="tool-indicator">{activeTool.toUpperCase()}</div>
      <div className="options-divider" />

      {(['pen', 'free_pen', 'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool)) && (
        <>
          <div className="option-control">
            <label>Mode</label>
            <div className="segmented-control" style={{ display: 'flex', background: '#1a1a1a', borderRadius: '4px', padding: '2px' }}>
              {['path', 'shape'].map(m => (
                <button
                  key={m}
                  onClick={() => setPenMode(m as any)}
                  style={{
                    padding: '2px 10px', fontSize: '11px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                    background: penMode === m ? '#444' : 'transparent', color: penMode === m ? '#fff' : '#888'
                  }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="options-divider" />
          {penMode === 'path' ? (
            <button
              className="premium-btn-sm"
              onClick={() => {
                const paths = useStore.getState().vectorPaths;
                if (paths.length > 0) {
                  const subdividedPaths = paths.map(path => {
                    if (!path.smooth || path.points.length < 3) return path.points;
                    
                    const result: { x: number, y: number }[] = [];
                    const steps = 12; // High resolution for selection
                    const points = path.points;
                    const len = points.length;
                    
                    for (let i = 0; i < (path.closed ? len : len - 1); i++) {
                      const p0 = points[(i - 1 + len) % len];
                      const p1 = points[i % len];
                      const p2 = points[(i + 1) % len];
                      const p3 = points[(i + 2) % len];
                      
                      for (let t = 0; t < steps; t++) {
                        const u = t / steps;
                        const x = 0.5 * (
                          (2 * p1.x) +
                          (-p0.x + p2.x) * u +
                          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u * u +
                          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u * u * u
                        );
                        const y = 0.5 * (
                          (2 * p1.y) +
                          (-p0.y + p2.y) * u +
                          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u * u +
                          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u * u * u
                        );
                        result.push({ x, y });
                      }
                    }
                    if (!path.closed) result.push(points[len - 1]);
                    return result;
                  });
                  
                  setLassoPaths(subdividedPaths);
                  setVectorPaths([]);
                  setActivePathIndex(null);
                  recordHistory('Make Selection from Path');
                }
              }}
              style={{ padding: '4px 12px', fontSize: '11px', background: '#0078d7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Make Selection
            </button>
          ) : (
            <button
              className="premium-btn-sm"
              onClick={() => {
                const paths = useStore.getState().vectorPaths;
                if (paths.length > 0) {
                  paths.forEach(path => {
                    if (path.points.length > 2) {
                      addLayer({
                        name: 'Shape',
                        type: 'shape',
                        visible: true,
                        opacity: 1,
                        position: { x: 0, y: 0 },
                        shapeData: {
                          type: 'path',
                          points: [...path.points],
                          fill: hexToRgba(brushColor, primaryOpacity),
                          stroke: hexToRgba(secondaryColor, secondaryOpacity),
                          strokeWidth: strokeWidth,
                          smooth: path.smooth,
                          closed: path.closed
                        }
                      });
                    }
                  });
                  setVectorPaths([]);
                  setActivePathIndex(null);
                  recordHistory('Create Shape from Pen');
                }
              }}
              style={{ padding: '4px 12px', fontSize: '11px', background: '#a051ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Create Shape
            </button>
          )}
          <button
            className="premium-btn-sm"
            onClick={() => {
              setVectorPaths([]);
              setActivePathIndex(null);
            }}
            style={{ padding: '4px 12px', fontSize: '11px', background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', marginLeft: '8px' }}
          >
            Clear
          </button>
          <div className="options-divider" />
        </>
      )}
      {(activeTool === 'marquee' || activeTool === 'ellipse_marquee' || activeTool === 'lasso' || activeTool === 'polygonal_lasso' || activeTool === 'magnetic_lasso' || activeTool === 'magic_wand' || activeTool === 'quick_selection' || activeTool === 'object_selection') && (
        <>
          <div className="option-control">
            <label>Mode</label>
            <div className="segmented-control" style={{ display: 'flex', background: '#1a1a1a', borderRadius: '4px', padding: '2px' }}>
              {[
                { id: 'new', icon: LucideIcons.Square, label: 'New' },
                { id: 'add', icon: LucideIcons.PlusSquare, label: 'Add' },
                { id: 'subtract', icon: LucideIcons.MinusSquare, label: 'Subtract' },
                { id: 'intersect', icon: LucideIcons.Layers, label: 'Intersect' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectionMode(m.id as any)}
                  title={m.label}
                  style={{
                    padding: '4px', fontSize: '11px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                    background: selectionMode === m.id ? '#444' : 'transparent', color: selectionMode === m.id ? '#fff' : '#888',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <m.icon size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="options-divider" />
          <div className="option-control">
            <label>Feather</label>
            <EditableValue value={selectionFeather} unit="px" onCommit={setSelectionFeather} />
          </div>
          <div className="option-control">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectionAntiAlias}
                onChange={(e) => setSelectionAntiAlias(e.target.checked)}
              />
              Anti-alias
            </label>
          </div>
          <div className="options-divider" />
        </>
      )}

      {activeTool === 'move' && (
        <>
          <div className="option-control">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={moveAutoSelect}
                onChange={(e) => setMoveAutoSelect(e.target.checked)}
              />
              Auto-Select
            </label>
          </div>
          <div className="option-control">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={moveShowTransform}
                onChange={(e) => setMoveShowTransform(e.target.checked)}
              />
              Show Transform Controls
            </label>
          </div>
          <div className="options-divider" />
        </>
      )}

      {activeTool === 'color_sampler' && (
        <>
          <div className="option-control">
            <button
              className="premium-btn-sm"
              onClick={() => { useStore.getState().clearColorSamplers(); recordHistory('Clear Samplers'); }}
              style={{ padding: '4px 12px', fontSize: '11px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Clear Samplers
            </button>
            <div style={{ marginLeft: '12px', display: 'flex', gap: '8px' }}>
              {useStore.getState().colorSamplers.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#1a1a1a', padding: '2px 6px', borderRadius: '3px', fontSize: '10px' }}>
                  <span style={{ color: '#888' }}>{s.id}:</span>
                  <div style={{ width: '8px', height: '8px', background: s.color, border: '1px solid #444' }} />
                  <span>{s.color.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="options-divider" />
        </>
      )}

      {activeTool === 'ruler' && (
        <>
          <div className="option-control">
            {useStore.getState().rulerData ? (
              (() => {
                const { start, end } = useStore.getState().rulerData!;
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const dist = Math.sqrt(dx * dx + dy * dy).toFixed(1);
                const angle = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1);
                return (
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#ccc' }}>
                    <span>L1: {dist}px</span>
                    <span>A: {angle}°</span>
                    <span>ΔX: {dx.toFixed(1)}</span>
                    <span>ΔY: {dy.toFixed(1)}</span>
                  </div>
                );
              })()
            ) : (
              <span style={{ fontSize: '11px', color: '#666' }}>Drag to measure</span>
            )}
          </div>
          <div className="options-divider" />
        </>
      )}

      {(activeTool === 'slice' || activeTool === 'slice_select') && (
        <>
          <div className="option-control">
            <button
              className="premium-btn-sm"
              onClick={() => { useStore.getState().clearSlices(); recordHistory('Clear Slices'); }}
              style={{ padding: '4px 12px', fontSize: '11px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Clear Slices
            </button>
            {activeTool === 'slice_select' && (window as any)._sliceLastClickedIdx !== undefined && (
              <button
                className="premium-btn-sm"
                onClick={() => {
                  const idx = (window as any)._sliceLastClickedIdx;
                  const slices = [...useStore.getState().slices];
                  slices.splice(idx, 1);
                  useStore.getState().setSlices(slices);
                  delete (window as any)._sliceLastClickedIdx;
                  recordHistory('Delete Slice');
                }}
                style={{ padding: '4px 12px', fontSize: '11px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '8px' }}
              >
                Delete Slice
              </button>
            )}
          </div>
          <div className="options-divider" />
        </>
      )}

      {activeTool === 'crop' && (
        <>
          <div className="option-control">
            <button
              className="premium-btn-sm"
              onClick={() => window.dispatchEvent(new CustomEvent('crop-fit-doc'))}
              style={{ padding: '4px 12px', fontSize: '11px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Fit Document
            </button>
            <button
              className="premium-btn-sm"
              onClick={() => window.dispatchEvent(new CustomEvent('crop-fit-layer'))}
              style={{ padding: '4px 12px', fontSize: '11px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '8px' }}
              disabled={!activeLayerId}
            >
              Fit Layer
            </button>
          </div>
          <div className="options-divider" />
        </>
      )}

      {(activeTool === 'magic_wand' || activeTool === 'quick_selection' || activeTool === 'object_selection' || activeTool === 'paint_bucket' || activeTool === 'magic_eraser') && (
        <>
          <div className="option-control">
            <label>Tolerance</label>
            <input
              type="range" min="1" max="255"
              value={selectionTolerance}
              onChange={(e) => setSelectionTolerance(parseInt(e.target.value))}
            />
            <EditableValue value={selectionTolerance} unit="" onCommit={setSelectionTolerance} />
          </div>
          {(activeTool === 'magic_wand' || activeTool === 'paint_bucket' || activeTool === 'magic_eraser') && (
            <div className="option-control">
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectionContiguous}
                  onChange={(e) => setSelectionContiguous(e.target.checked)}
                />
                Contiguous
              </label>
            </div>
          )}
          <div className="options-divider" />
        </>
      )}

      {activeTool === 'zoom_tool' && (
        <>
          <div className="option-control">
            <label>Zoom</label>
            <input
              type="range" min="0.1" max="10" step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
            <EditableValue value={Math.round(zoom * 100)} unit="%" onCommit={(val) => setZoom(val / 100)} />
          </div>
          <button className="option-btn" onClick={() => setZoom(1)}>100%</button>
          <button className="option-btn" onClick={() => window.dispatchEvent(new CustomEvent('zoom-fit'))} style={{ marginLeft: '8px' }}>Fit Screen</button>
          <div className="options-divider" />
        </>
      )}

      {activeTool === 'pattern_stamp' && (
        <div className="option-control">
          <button
            className="action-button secondary"
            onClick={() => document.getElementById('pattern-upload')?.click()}
            title="Upload a custom image or SVG as a texture"
          >
            Load Texture
          </button>
          {customPattern && (
            <div className="pattern-preview" title="Current custom pattern">
              <img src={customPattern} alt="Custom pattern" />
            </div>
          )}
          <input
            id="pattern-upload"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  useStore.getState().setCustomPattern(event.target?.result as string);
                };
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>
      )}

      {activeTool === 'marquee' && selectionRect && (
        <div className="option-control">
          <button
            className="action-button primary"
            onClick={() => window.dispatchEvent(new CustomEvent('define-pattern'))}
            title="Use selection as a repeating pattern"
          >
            Define Pattern
          </button>
        </div>
      )}

      {activeTool === 'polygon_shape' && (
        <div className="option-control">
          <label>Sides</label>
          <input
            type="range" min="3" max="20"
            value={polygonSides}
            onChange={(e) => setPolygonSides(parseInt(e.target.value))}
          />
          <EditableValue value={polygonSides} unit="" onCommit={setPolygonSides} />
        </div>
      )}

      {activeTool === 'custom_shape' && (
        <>
          <div className="option-control">
            <label>Points</label>
            <input
              type="range" min="3" max="20"
              value={starPoints}
              onChange={(e) => setStarPoints(parseInt(e.target.value))}
            />
            <EditableValue value={starPoints} unit="" onCommit={setStarPoints} />
          </div>
          <div className="option-control">
            <label>Inner Radius</label>
            <input
              type="range" min="5" max="95"
              value={starInnerRadius}
              onChange={(e) => setStarInnerRadius(parseInt(e.target.value))}
            />
            <EditableValue value={starInnerRadius} unit="%" onCommit={setStarInnerRadius} />
          </div>
        </>
      )}

      {(activeTool === 'shape' || activeTool === 'triangle_shape') && (
        <div className="option-control">
          <label>Radius</label>
          <input
            type="range" min="0" max="100"
            value={cornerRadius}
            onChange={(e) => setCornerRadius(parseInt(e.target.value))}
          />
          <EditableValue value={cornerRadius} unit="px" onCommit={setCornerRadius} />
        </div>
      )}

      {activeTool === 'ellipse_shape' && (
        <div className="option-control">
          <span style={{ fontSize: '11px', color: '#888' }}>Drag to draw ellipse</span>
        </div>
      )}

      {activeTool === 'rotate_view' && (
        <>
          <div className="option-control">
            <label>Rotation</label>
            <input
              type="range" min="-180" max="180"
              value={canvasRotation}
              onChange={(e) => setCanvasRotation(parseInt(e.target.value))}
            />
            <EditableValue value={Math.round(canvasRotation)} unit="°" onCommit={setCanvasRotation} />
          </div>
          <button 
            className="option-btn"
            onClick={() => setCanvasRotation(0)}
            style={{ marginLeft: '10px', padding: '4px 12px' }}
          >
            Reset View
          </button>
        </>
      )}

      {activeTool === 'hand' && (
        <button 
          className="option-btn"
          onClick={() => {
            useStore.getState().setCanvasOffset({ x: 0, y: 0 });
            useStore.getState().setZoom(1);
          }}
          style={{ padding: '4px 12px' }}
        >
          Reset View & Zoom
        </button>
      )}

      {activeTool === 'gradient' && (
        <div className="option-control">
          <label>Type</label>
          <div className="segmented-control" style={{ display: 'flex', background: '#1a1a1a', borderRadius: '4px', padding: '2px' }}>
            {[
              { id: 'linear', icon: LucideIcons.ArrowRight, label: 'Linear' },
              { id: 'radial', icon: LucideIcons.Circle, label: 'Radial' },
              { id: 'angle', icon: LucideIcons.RotateCw, label: 'Angle' },
              { id: 'reflected', icon: LucideIcons.Spline, label: 'Reflected' },
              { id: 'diamond', icon: LucideIcons.Diamond, label: 'Diamond' }
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setGradientType(m.id as any)}
                title={m.label}
                style={{
                  padding: '4px', fontSize: '11px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                  background: gradientType === m.id ? '#444' : 'transparent', color: gradientType === m.id ? '#fff' : '#888',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <m.icon size={14} />
              </button>
            ))}
          </div>
        </div>
      )}

      {(activeTool === 'healing_brush' || activeTool === 'patch' || activeTool === 'content_aware_move') && (
        <>
          {activeTool === 'healing_brush' && (
            <div className="option-control">
              <label>Source</label>
              <select value={healingSourceMode} onChange={(e) => setHealingSourceMode(e.target.value as any)} className="premium-select">
                <option value="sampled">Sampled</option>
                <option value="pattern">Pattern</option>
              </select>
            </div>
          )}
          {activeTool === 'patch' && (
            <div className="option-control">
              <label>Patch</label>
              <select value={patchMode} onChange={(e) => setPatchMode(e.target.value as any)} className="premium-select">
                <option value="source">Source</option>
                <option value="destination">Destination</option>
              </select>
            </div>
          )}
          {activeTool === 'content_aware_move' && (
            <div className="option-control">
              <label>Mode</label>
              <select value={contentAwareMoveMode} onChange={(e) => setContentAwareMoveMode(e.target.value as any)} className="premium-select">
                <option value="move">Move</option>
                <option value="extend">Extend</option>
              </select>
            </div>
          )}
          <div className="options-divider" />
        </>
      )}

      {(activeTool === 'text' || activeTool === 'vertical_text') && (
        <>
          <div className="option-control">
            <select value={textFontFamily} onChange={(e) => setTextFontFamily(e.target.value)} className="premium-select" style={{ width: '120px' }}>
              <option value="Inter, system-ui, sans-serif">Inter</option>
              <option value="'Roboto', sans-serif">Roboto</option>
              <option value="'Playfair Display', serif">Playfair</option>
              <option value="'Courier New', monospace">Courier</option>
            </select>
          </div>
          <div className="option-control">
            <div className="segmented-control" style={{ display: 'flex', background: '#1a1a1a', borderRadius: '4px', padding: '2px' }}>
              {[
                { id: 'left', icon: LucideIcons.AlignLeft },
                { id: 'center', icon: LucideIcons.AlignCenter },
                { id: 'right', icon: LucideIcons.AlignRight }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setTextAlign(m.id as any)}
                  style={{
                    padding: '4px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                    background: textAlign === m.id ? '#444' : 'transparent', color: textAlign === m.id ? '#fff' : '#888'
                  }}
                >
                  <m.icon size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="options-divider" />
        </>
      )}

      {activeTool === 'red_eye' && (
        <>
          <div className="option-control">
            <label>Pupil Size</label>
            <input
              type="range" min="1" max="100"
              value={redEyePupilSize}
              onChange={(e) => setRedEyePupilSize(parseInt(e.target.value))}
            />
            <EditableValue value={redEyePupilSize} unit="%" onCommit={setRedEyePupilSize} />
          </div>
          <div className="option-control">
            <label>Darken Amount</label>
            <input
              type="range" min="1" max="100"
              value={redEyeDarkenAmount}
              onChange={(e) => setRedEyeDarkenAmount(parseInt(e.target.value))}
            />
            <EditableValue value={redEyeDarkenAmount} unit="%" onCommit={setRedEyeDarkenAmount} />
          </div>
          <div className="options-divider" />
        </>
      )}

      {(activeTool === 'brush' || activeTool === 'pencil' || activeTool === 'color_replacement' || activeTool === 'mixer_brush' || activeTool === 'clone' || activeTool === 'pattern_stamp' || activeTool === 'eraser' || activeTool === 'background_eraser' || activeTool === 'magic_eraser' || activeTool === 'history_brush' || activeTool === 'art_history_brush' || (activeTool === 'text' || activeTool === 'vertical_text') || ['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool) || activeTool === 'quick_selection' || activeTool === 'blur' || activeTool === 'sharpen' || activeTool === 'smudge' || activeTool === 'dodge' || activeTool === 'burn' || activeTool === 'sponge' || activeTool === 'healing' || activeTool === 'healing_brush' || activeTool === 'patch' || activeTool === 'red_eye' || ['pen', 'free_pen', 'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool)) && (
        <>
          <div className="option-control">
            <label>
              {(activeTool === 'text' || activeTool === 'vertical_text') ? 'Font Size' : 'Size'}
            </label>
            <input
              type="range"
              min="1"
              max={(activeTool === 'text' || activeTool === 'vertical_text') ? "500" : "500"}
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
            />
            <EditableValue value={brushSize} unit="px" onCommit={setBrushSize} />
          </div>

          {(activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'blur' || activeTool === 'sharpen' || activeTool === 'smudge' || activeTool === 'dodge' || activeTool === 'burn' || activeTool === 'sponge' || activeTool === 'clone' || activeTool === 'history_brush') && (
            <div className="option-control">
              <label>Hardness</label>
              <input
                type="range" min="0" max="100"
                value={toolHardness}
                onChange={(e) => setToolHardness(parseInt(e.target.value))}
              />
              <EditableValue value={toolHardness} unit="%" onCommit={setToolHardness} />
            </div>
          )}

          {(activeTool === 'blur' || activeTool === 'sharpen' || activeTool === 'smudge' || activeTool === 'dodge' || activeTool === 'burn' || activeTool === 'sponge' || activeTool === 'healing_brush') && (
            <div className="option-control">
              <label>Strength</label>
              <input
                type="range" min="1" max="100"
                value={toolStrength}
                onChange={(e) => setToolStrength(parseInt(e.target.value))}
              />
              <EditableValue value={toolStrength} unit="%" onCommit={setToolStrength} />
            </div>
          )}

          {(activeTool === 'dodge' || activeTool === 'burn') && (
            <div className="option-control">
              <label>Range</label>
              <select 
                value={useStore.getState().toningRange} 
                onChange={(e) => useStore.getState().setToningRange(e.target.value as any)}
                style={{ background: '#1a1a1a', color: '#ccc', border: '1px solid #444', borderRadius: '3px', fontSize: '11px', padding: '2px' }}
              >
                <option value="shadows">Shadows</option>
                <option value="midtones">Midtones</option>
                <option value="highlights">Highlights</option>
              </select>
            </div>
          )}

          {activeTool === 'sponge' && (
            <div className="option-control">
              <label>Mode</label>
              <select 
                value={useStore.getState().spongeMode} 
                onChange={(e) => useStore.getState().setSpongeMode(e.target.value as any)}
                style={{ background: '#1a1a1a', color: '#ccc', border: '1px solid #444', borderRadius: '3px', fontSize: '11px', padding: '2px' }}
              >
                <option value="desaturate">Desaturate</option>
                <option value="saturate">Saturate</option>
              </select>
            </div>
          )}
        </>
      )}

      {(activeTool === 'brush' || activeTool === 'pencil' || activeTool === 'color_replacement' || activeTool === 'mixer_brush' || (activeTool === 'text' || activeTool === 'vertical_text') || ['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool) || ['pen', 'free_pen', 'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool)) && (
        <div className="option-control">
          <label>Stroke Width</label>
          <input
            type="range"
            min="0"
            max="50"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
          />
          <EditableValue value={strokeWidth} unit="px" onCommit={setStrokeWidth} />
        </div>
      )}

      {(activeTool === 'brush' || activeTool === 'pencil' || activeTool === 'color_replacement' || activeTool === 'mixer_brush' || activeTool === 'clone' || activeTool === 'pattern_stamp' || activeTool === 'history_brush' || activeTool === 'art_history_brush' || (activeTool === 'text' || activeTool === 'vertical_text') || ['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool) || activeTool === 'eyedropper' || ['pen', 'free_pen', 'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool)) && (
        <ColorPicker
          label={['shape', 'ellipse_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool as string) ? 'Fill' : (activeTool === 'eyedropper' ? 'Sampled' : 'Color')}
          color={brushColor}
          opacity={primaryOpacity}
          onColorChange={setBrushColor}
          onOpacityChange={setPrimaryOpacity}
        />
      )}

      {(activeTool === 'brush' || activeTool === 'pencil' || activeTool === 'color_replacement' || activeTool === 'mixer_brush' || (activeTool === 'text' || activeTool === 'vertical_text') || ['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool) || ['pen', 'free_pen', 'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool)) && (
        <ColorPicker
          label={['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool) || ['pen', 'free_pen', 'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool) ? 'Stroke' : 'Secondary'}
          color={secondaryColor}
          opacity={secondaryOpacity}
          onColorChange={setSecondaryColor}
          onOpacityChange={setSecondaryOpacity}
        />
      )}

      {/* Quick Actions - Very important for mobile */}
      <div className="options-divider" />
      <div className="quick-actions">
        <button className="action-btn" onClick={() => undo()} title="Undo (Ctrl+Z)">
          <LucideIcons.RotateCcw size={16} />
        </button>
        <button className="action-btn" onClick={() => redo()} title="Redo (Ctrl+Y)">
          <LucideIcons.RotateCw size={16} />
        </button>
        <div className="action-divider" />
        <button className="action-btn" onClick={handleDeselect} title="Deselect (Ctrl+D)">
          <LucideIcons.SquareX size={16} />
        </button>
        <button
          className="action-btn"
          onClick={() => { inverseSelection(); recordHistory('Inverse Selection'); }}
          title="Inverse Selection (Shift+Ctrl+I)"
        >
          <LucideIcons.Expand size={16} />
        </button>
        <button
          className="action-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('select-subject'))}
          title="Select Subject (Ctrl+Alt+S)"
          disabled={!activeLayerId}
        >
          <LucideIcons.Target size={16} />
        </button>
        <div className="action-divider" />
        <button
          className="action-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('invert-layer'))}
          disabled={!activeLayerId}
          title="Invert Colors (Ctrl+I)"
        >
          <LucideIcons.Contrast size={16} />
        </button>
        <div className="action-divider" />
        <button
          className="action-btn"
          onClick={() => activeLayerId && duplicateLayer(activeLayerId)}
          disabled={!activeLayerId}
          title="Duplicate Layer (Ctrl+J)"
        >
          <LucideIcons.Copy size={16} />
        </button>
        <button
          className="action-btn delete-btn"
          onClick={() => {
            if (selectionRect || (lassoPaths && lassoPaths.length > 0)) {
              window.dispatchEvent(new CustomEvent('delete-selection'));
            } else if (activeLayerId) {
              removeLayer(activeLayerId);
              recordHistory('Delete Layer');
            }
          }}
          disabled={!activeLayerId}
          title={selectionRect || (lassoPaths && lassoPaths.length > 0) ? "Delete Selection" : "Delete Layer"}
        >
          <LucideIcons.Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default OptionsBar;
