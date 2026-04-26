import React from 'react';
import { useStore, hexToRgba } from '../../store/useStore';
import ColorPicker from '../shared/ColorPicker';
import * as LucideIcons from 'lucide-react';

const OptionsBar: React.FC = () => {
  const { 
    activeTool, brushSize, setBrushSize, 
    strokeWidth, setStrokeWidth,
    brushColor, setBrushColor, primaryOpacity, setPrimaryOpacity,
    secondaryColor, setSecondaryColor, secondaryOpacity, setSecondaryOpacity,
    penMode, setPenMode, setVectorPaths, setActivePathIndex, setLassoPaths,
    recordHistory, addLayer,
    undo, redo, activeLayerId, removeLayer, duplicateLayer,
    setSelectionRect, inverseSelection,
    selectionRect, lassoPaths
  } = useStore();

  const handleDeselect = () => {
    setSelectionRect(null);
    setLassoPaths([]);
    recordHistory('Deselect');
  };

  return (
    <div className="options-bar">
      <div className="tool-indicator">{activeTool.toUpperCase()}</div>
      <div className="options-divider" />
      
      {(activeTool === 'pen' || activeTool === 'path_select') && (
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
                  const closedPaths = paths.filter(p => p.points.length > 2).map(p => p.points);
                  setLassoPaths(closedPaths);
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
                          strokeWidth: strokeWidth
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
      
      {(activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'text' || activeTool === 'shape') && (
        <div className="option-control">
          <label>
            {activeTool === 'text' ? 'Font Size' : 'Size'}
          </label>
          <input 
            type="range" 
            min="1" 
            max={activeTool === 'text' ? "500" : "200"} 
            value={brushSize} 
            onChange={(e) => setBrushSize(parseInt(e.target.value))} 
          />
          <span className="value-label">{brushSize}px</span>
        </div>
      )}

      {(activeTool === 'brush' || activeTool === 'text' || activeTool === 'shape') && (
        <div className="option-control">
          <label>Stroke Width</label>
          <input 
            type="range" 
            min="0" 
            max="50" 
            value={strokeWidth} 
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))} 
          />
          <span className="value-label">{strokeWidth}px</span>
        </div>
      )}

      {(activeTool === 'brush' || activeTool === 'text' || activeTool === 'shape' || activeTool === 'eyedropper') && (
        <ColorPicker 
          label={activeTool === 'shape' ? 'Fill' : (activeTool === 'eyedropper' ? 'Sampled' : 'Color')}
          color={brushColor}
          opacity={primaryOpacity}
          onColorChange={setBrushColor}
          onOpacityChange={setPrimaryOpacity}
        />
      )}

      {(activeTool === 'brush' || activeTool === 'text' || activeTool === 'shape') && (
        <ColorPicker 
          label="Stroke"
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
