import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';

interface ColorPickerProps {
  label?: string;
  color: string;
  opacity: number;
  onColorChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
  renderTrigger?: (onClick: () => void) => React.ReactNode;
  popoverDirection?: 'bottom' | 'right' | 'top';
}

// --- Utilities ---
const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { r, g, b };
};

const rgbToHsv = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, v };
};

const hsvToRgb = (h: number, s: number, v: number) => {
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;
  if (max === min) h = s = 0;
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const hslToRgb = (h: number, s: number, l: number) => {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) r = g = b = l;
  else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

const ColorPicker: React.FC<ColorPickerProps> = ({
  label, color, opacity, onColorChange, onOpacityChange, renderTrigger, popoverDirection = 'bottom'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'rgb' | 'hex' | 'hsl'>('rgb');
  const [inputValue, setInputValue] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);

  const [internalHue, setInternalHue] = useState(0);

  const { r, g, b } = hexToRgb(color);
  const { h: derivedH, s, v } = rgbToHsv(r, g, b);
  
  // Sync internal hue with prop-derived hue ONLY if the color has saturation
  // This prevents the hue from snapping to 0 when clicking grayscale areas
  useEffect(() => {
    if (s > 0) {
      setInternalHue(derivedH);
    }
  }, [derivedH, s]);

  const h = internalHue;
  const hsl = rgbToHsl(r, g, b);
  const rgbaString = `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`;

  useEffect(() => {
    setInputValue(rgbaString);
  }, [rgbaString]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSvChange = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const ns = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const nv = Math.min(1, Math.max(0, 1 - (e.clientY - rect.top) / rect.height));
    const { r: nr, g: ng, b: nb } = hsvToRgb(internalHue, ns, nv);
    onColorChange(`#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`);
  }, [internalHue, onColorChange]);

  const onSvMouseDown = (e: React.MouseEvent) => {
    handleSvChange(e);
    const onMouseMove = (me: MouseEvent) => handleSvChange(me);
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleTextChange = (value: string) => {
    setInputValue(value);
    const match = value.match(/(?:rgba?\(|)?(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s]+([\d.]+))?\)??/);
    if (match) {
      const nr = Math.min(255, Math.max(0, parseInt(match[1])));
      const ng = Math.min(255, Math.max(0, parseInt(match[2])));
      const nb = Math.min(255, Math.max(0, parseInt(match[3])));
      const na = match[4] ? Math.min(1, Math.max(0, parseFloat(match[4]))) : 1;
      onColorChange(`#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`);
      onOpacityChange(na);
    }
  };

  const cycleViewMode = () => {
    if (viewMode === 'rgb') setViewMode('hex');
    else if (viewMode === 'hex') setViewMode('hsl');
    else setViewMode('rgb');
  };

  const getPopoverStyle = (): React.CSSProperties => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    
    const base: React.CSSProperties = {
      position: 'absolute',
      width: isMobile ? 'calc(100vw - 40px)' : '240px',
      maxWidth: '300px',
      background: '#2d2d2d',
      borderRadius: '12px',
      padding: '12px',
      zIndex: 10000,
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      border: '1px solid #444'
    };

    if (isMobile) {
      return { 
        ...base, 
        position: 'fixed',
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        margin: 0
      };
    }

    if (popoverDirection === 'bottom') {
      return { ...base, top: '100%', left: 0, marginTop: '10px' };
    } else if (popoverDirection === 'right') {
      return { ...base, top: '50%', left: '100%', marginLeft: '15px', transform: 'translateY(-50%)' };
    } else if (popoverDirection === 'top') {
      return { ...base, bottom: '100%', left: 0, marginBottom: '10px' };
    }
    return base;
  };

  return (
    <div className="option-control premium-picker" style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
      {renderTrigger ? (
        renderTrigger(() => setIsOpen(!isOpen))
      ) : (
        <>
          {label && <label style={{ fontSize: '11px', color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>}

          <div className="picker-glass" style={{
            display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(45, 45, 45, 0.8)',
            backdropFilter: 'blur(10px)', padding: '2px 8px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div className="color-preview-wrapper" onClick={() => setIsOpen(!isOpen)}
              style={{ position: 'relative', width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}>
              <div className="transparency-grid" style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)', backgroundSize: '6px 6px', backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px', opacity: 0.5 }} />
              <div className="color-fill" style={{ position: 'absolute', inset: 0, backgroundColor: rgbaString }} />
            </div>
            <input type="text" value={inputValue} onChange={(e) => handleTextChange(e.target.value)} spellCheck={false}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', fontFamily: 'monospace', width: '130px', outline: 'none' }} />
          </div>
        </>
      )}

      {isOpen && (
        <ColorPickerPopover
          ref={popoverRef}
          style={getPopoverStyle()}
          onClose={() => setIsOpen(false)}
          h={h} s={s} v={v}
          r={r} g={g} b={b}
          color={color}
          opacity={opacity}
          onColorChange={onColorChange}
          onOpacityChange={onOpacityChange}
          rgbaString={rgbaString}
          hsl={hsl}
          viewMode={viewMode}
          cycleViewMode={cycleViewMode}
          onSvMouseDown={onSvMouseDown}
          svRef={svRef}
          handleTextChange={handleTextChange}
          setInternalHue={setInternalHue}
        />
      )}
    </div>
  );
};

const ColorPickerPopover = React.forwardRef<HTMLDivElement, any>((props, ref) => {
  const {
    style, h, s, v, r, g, b, color, opacity,
    onColorChange, onOpacityChange, rgbaString, hsl,
    viewMode, cycleViewMode, onSvMouseDown, svRef, onClose,
    setInternalHue
  } = props;

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    // Only drag if clicking the top area or background, not inputs/sliders
    if ((e.target as HTMLElement).closest('.sv-container')) return;
    if ((e.target as HTMLElement).closest('.picker-controls')) return;
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;

    setIsDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  useEffect(() => {
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging) return;
      setPos({ x: moveEvent.clientX - dragStart.current.x, y: moveEvent.clientY - dragStart.current.y });
    };
    const onMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={ref}
      className="color-popover"
      onMouseDown={onMouseDown}
      style={{
        ...style,
        transform: `${style.transform || ''} translate(${pos.x}px, ${pos.y}px)`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Header with drag handle and close button */}
      <div className="picker-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ height: '6px', cursor: 'grab', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.2 }}>
          <div style={{ width: '40px', height: '3px', background: '#fff', borderRadius: '2px' }} />
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', borderRadius: '50%' }}
        >
          <LucideIcons.X size={14} />
        </button>
      </div>

      <div ref={svRef} className="sv-container" onMouseDown={onSvMouseDown} style={{
        position: 'relative', width: '100%', height: '150px', borderRadius: '4px', cursor: 'crosshair',
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${h * 360}, 100%, 50%)`
      }}>
        <div style={{ position: 'absolute', left: `${s * 100}%`, top: `${(1 - v) * 100}%`, width: '12px', height: '12px', border: '2px solid white', borderRadius: '50%', transform: 'translate(-50%, -50%)', boxShadow: '0 0 2px rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
      </div>

      <div className="picker-controls" onMouseDown={e => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Custom Hue Slider */}
            <div 
              style={{ 
                position: 'relative', width: '100%', height: '12px', borderRadius: '6px', cursor: 'pointer',
                background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)'
              }}
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const update = (ex: number) => {
                  const val = Math.min(1, Math.max(0, (ex - rect.left) / rect.width));
                  setInternalHue(val);
                  const { r: nr, g: ng, b: nb } = hsvToRgb(val, s, v);
                  onColorChange(`#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`);
                };
                update(e.clientX);
                const onMove = (me: MouseEvent) => update(me.clientX);
                const onUp = () => {
                  document.removeEventListener('mousemove', onMove);
                  document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
            >
              <div style={{ 
                position: 'absolute', left: `${h * 100}%`, top: '50%', transform: 'translate(-50%, -50%)',
                width: '14px', height: '14px', background: '#fff', border: '2px solid #2d2d2d', borderRadius: '50%',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)', pointerEvents: 'none'
              }} />
            </div>

            {/* Custom Opacity Slider */}
            <div 
              style={{ 
                position: 'relative', width: '100%', height: '12px', borderRadius: '6px', cursor: 'pointer',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)', overflow: 'hidden'
              }}
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const update = (ex: number) => {
                  const val = Math.min(1, Math.max(0, (ex - rect.left) / rect.width));
                  onOpacityChange(val);
                };
                update(e.clientX);
                const onMove = (me: MouseEvent) => update(me.clientX);
                const onUp = () => {
                  document.removeEventListener('mousemove', onMove);
                  document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
            >
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)', backgroundSize: '6px 6px', opacity: 0.5 }} />
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, transparent, ${color})` }} />
              <div style={{ 
                position: 'absolute', left: `${opacity * 100}%`, top: '50%', transform: 'translate(-50%, -50%)',
                width: '14px', height: '14px', background: '#fff', border: '2px solid #2d2d2d', borderRadius: '50%',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)', pointerEvents: 'none', zIndex: 2
              }} />
            </div>
          </div>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', position: 'relative', overflow: 'hidden', border: '2px solid #444' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)', backgroundSize: '6px 6px', opacity: 0.5 }} />
            <div style={{ position: 'absolute', inset: 0, background: rgbaString }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '12px' }}>
          <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
            {viewMode === 'rgb' && [
              { label: 'R', val: r, max: 255, fn: (nv: number) => onColorChange(`#${nv.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`) },
              { label: 'G', val: g, max: 255, fn: (nv: number) => onColorChange(`#${r.toString(16).padStart(2, '0')}${nv.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`) },
              { label: 'B', val: b, max: 255, fn: (nv: number) => onColorChange(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${nv.toString(16).padStart(2, '0')}`) },
              { label: 'A', val: Math.round(opacity * 100), max: 100, fn: (nv: number) => onOpacityChange(nv / 100) }
            ].map(item => (
              <div key={item.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input type="number" value={item.val} min={0} max={item.max} onChange={(e) => item.fn(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', background: '#1a1a1a', border: '1px solid #444', color: '#fff', fontSize: '10px', padding: '4px', textAlign: 'center', borderRadius: '4px', outline: 'none' }} />
                <span style={{ fontSize: '9px', color: '#666', textAlign: 'center' }}>{item.label}</span>
              </div>
            ))}

            {viewMode === 'hex' && (
              <>
                <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <input type="text" value={color.toUpperCase()} onChange={(e) => onColorChange(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)}
                    style={{ width: '100%', background: '#1a1a1a', border: '1px solid #444', color: '#fff', fontSize: '10px', padding: '4px', textAlign: 'center', borderRadius: '4px', outline: 'none', fontFamily: 'monospace' }} />
                  <span style={{ fontSize: '9px', color: '#666', textAlign: 'center' }}>HEX</span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <input type="number" value={Math.round(opacity * 100)} min={0} max={100} onChange={(e) => onOpacityChange((parseInt(e.target.value) || 0) / 100)}
                    style={{ width: '100%', background: '#1a1a1a', border: '1px solid #444', color: '#fff', fontSize: '10px', padding: '4px', textAlign: 'center', borderRadius: '4px', outline: 'none' }} />
                  <span style={{ fontSize: '9px', color: '#666', textAlign: 'center' }}>A%</span>
                </div>
              </>
            )}

            {viewMode === 'hsl' && [
              { label: 'H', val: hsl.h, max: 360, fn: (nv: number) => { const { r, g, b } = hslToRgb(nv, hsl.s, hsl.l); onColorChange(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`); } },
              { label: 'S', val: hsl.s, max: 100, fn: (nv: number) => { const { r, g, b } = hslToRgb(hsl.h, nv, hsl.l); onColorChange(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`); } },
              { label: 'L', val: hsl.l, max: 100, fn: (nv: number) => { const { r, g, b } = hslToRgb(hsl.h, hsl.s, nv); onColorChange(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`); } },
              { label: 'A', val: Math.round(opacity * 100), max: 100, fn: (nv: number) => onOpacityChange(nv / 100) }
            ].map(item => (
              <div key={item.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input type="number" value={item.val} min={0} max={item.max} onChange={(e) => item.fn(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', background: '#1a1a1a', border: '1px solid #444', color: '#fff', fontSize: '10px', padding: '4px', textAlign: 'center', borderRadius: '4px', outline: 'none' }} />
                <span style={{ fontSize: '9px', color: '#666', textAlign: 'center' }}>{item.label}</span>
              </div>
            ))}
          </div>

          <button onClick={cycleViewMode} title="Switch Mode" style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px 0 0 0', display: 'flex', alignItems: 'center' }}>
            <LucideIcons.ArrowDownUp size={14} />
          </button>
        </div>
      </div>
    </div>
  );
});

export default ColorPicker;
