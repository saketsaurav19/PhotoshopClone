import { create } from 'zustand';
import { nanoid } from 'nanoid';

export const hexToRgba = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export type Tool =
  | 'move' | 'artboard'
  | 'marquee' | 'ellipse_marquee'
  | 'lasso' | 'polygonal_lasso' | 'magnetic_lasso'
  | 'quick_selection' | 'magic_wand' | 'object_selection'
  | 'crop' | 'perspective_crop' | 'slice' | 'slice_select'
  | 'eyedropper' | 'color_sampler' | 'ruler'
  | 'healing' | 'healing_brush' | 'patch' | 'content_aware_move' | 'red_eye'
  | 'brush' | 'pencil' | 'color_replacement' | 'mixer_brush'
  | 'history_brush' | 'art_history_brush'
  | 'clone' | 'pattern_stamp'
  | 'eraser' | 'background_eraser' | 'magic_eraser' | 'rectangle_eraser' | 'lasso_eraser'
  | 'gradient' | 'paint_bucket'
  | 'blur' | 'sharpen' | 'smudge'
  | 'dodge' | 'burn' | 'sponge'
  | 'text' | 'vertical_text'
  | 'pen' | 'free_pen' | 'curvature_pen' | 'add_anchor' | 'delete_anchor' | 'convert_point'
  | 'path_select' | 'direct_select'
  | 'shape' | 'ellipse_shape' | 'line_shape' | 'triangle_shape' | 'polygon_shape' | 'parametric_shape' | 'custom_shape'
  | 'hand' | 'rotate_view'
  | 'zoom_tool'
  | 'select'; // select is used for general purpose selection if needed

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  dataUrl?: string; // For image layers
  type: 'image' | 'paint' | 'text' | 'shape';
  position: { x: number; y: number };
  blendMode: GlobalCompositeOperation;
  textContent?: string;
  fontSize?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  isVertical?: boolean;
  shapeData?: {
    type: 'rect' | 'path' | 'ellipse';
    w?: number; h?: number;
    points?: { x: number; y: number }[];
    fill: string; stroke: string; strokeWidth: number;
    smooth?: boolean;
    closed?: boolean;
    cornerRadius?: number;
  };
  thumbnail?: string;
}

interface HistoryEntry {
  name: string;
  state: {
    layers: Layer[];
    activeLayerId: string | null;
    lassoPaths: { x: number; y: number }[][];
    selectionRect: { x: number; y: number; w: number; h: number } | null;
    isInverseSelection: boolean;
    documentSize: { w: number; h: number };
    selectionTolerance: number;
    selectionContiguous: boolean;
    slices: { id: string; rect: { x: number; y: number; w: number; h: number } }[];
    colorSamplers: { id: string; x: number; y: number; color: string }[];
    toolStrength: number;
    toolHardness: number;
    canvasRotation: number;
    gradientType: 'linear' | 'radial' | 'angle' | 'reflected' | 'diamond';
    selectionMode: 'new' | 'add' | 'subtract' | 'intersect';
    selectionFeather: number;
    selectionAntiAlias: boolean;
    healingSourceMode: 'sampled' | 'pattern';
    patchMode: 'source' | 'destination';
    contentAwareMoveMode: 'move' | 'extend';
    moveAutoSelect: boolean;
    moveShowTransform: boolean;
    textFontFamily: string;
    textAlign: 'left' | 'center' | 'right';
  };
}

interface EditorState {
  activeTool: Tool;
  activeToolVariants: Record<string, Tool>;
  zoom: number;
  layers: Layer[];
  activeLayerId: string | null;
  brushSize: number;
  strokeWidth: number;
  brushColor: string;
  secondaryColor: string;
  primaryOpacity: number;
  secondaryOpacity: number;
  canvasOffset: { x: number; y: number };
  canvasRotation: number;
  setCanvasRotation: (rotation: number) => void;
  lassoPaths: { x: number; y: number }[][];
  selectionRect: { x: number; y: number; w: number; h: number } | null;
  selectionShape: 'rect' | 'ellipse' | 'lasso';
  isInverseSelection: boolean;
  selectionTolerance: number;
  selectionContiguous: boolean;
  cropRect: { x: number; y: number; w: number; h: number } | null;
  documentSize: { w: number; h: number };
  history: HistoryEntry[];
  historyIndex: number;
  cloneSource: { x: number; y: number } | null;
  setCloneSource: (source: { x: number; y: number } | null) => void;
  customPattern: string | null;
  setCustomPattern: (pattern: string | null) => void;
  toolStrength: number;
  setToolStrength: (strength: number) => void;
  toolHardness: number;
  setToolHardness: (hardness: number) => void;
  toningRange: 'shadows' | 'midtones' | 'highlights';
  setToningRange: (range: 'shadows' | 'midtones' | 'highlights') => void;
  spongeMode: 'desaturate' | 'saturate';
  setSpongeMode: (mode: 'desaturate' | 'saturate') => void;
  redEyePupilSize: number;
  setRedEyePupilSize: (val: number) => void;
  redEyeDarkenAmount: number;
  setRedEyeDarkenAmount: (val: number) => void;
  isTyping: boolean;
  setIsTyping: (val: boolean) => void;

  vectorPaths: { points: { x: number; y: number }[]; closed: boolean; smooth?: boolean }[];
  activePathIndex: number | null;
  penMode: 'path' | 'shape';
  cornerRadius: number;
  setCornerRadius: (radius: number) => void;
  selectionMode: 'new' | 'add' | 'subtract' | 'intersect';
  slices: { id: string; rect: { x: number; y: number; w: number; h: number } }[];
  colorSamplers: { id: string; x: number; y: number; color: string }[];
  rulerData: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
  polygonSides: number;
  setPolygonSides: (sides: number) => void;
  starPoints: number;
  setStarPoints: (points: number) => void;
  starInnerRadius: number;
  setStarInnerRadius: (radius: number) => void;

  // Advanced Tool Settings
  selectionFeather: number;
  setSelectionFeather: (val: number) => void;
  selectionAntiAlias: boolean;
  setSelectionAntiAlias: (val: boolean) => void;
  gradientType: 'linear' | 'radial' | 'angle' | 'reflected' | 'diamond';
  setGradientType: (type: 'linear' | 'radial' | 'angle' | 'reflected' | 'diamond') => void;
  healingSourceMode: 'sampled' | 'pattern';
  setHealingSourceMode: (mode: 'sampled' | 'pattern') => void;
  patchMode: 'source' | 'destination';
  setPatchMode: (mode: 'source' | 'destination') => void;
  contentAwareMoveMode: 'move' | 'extend';
  setContentAwareMoveMode: (mode: 'move' | 'extend') => void;
  moveAutoSelect: boolean;
  setMoveAutoSelect: (val: boolean) => void;
  moveShowTransform: boolean;
  setMoveShowTransform: (val: boolean) => void;
  textFontFamily: string;
  setTextFontFamily: (val: string) => void;
  textAlign: 'left' | 'center' | 'right';
  setTextAlign: (val: 'left' | 'center' | 'right') => void;
  textEditor: { x: number; y: number; value: string } | null;
  setTextEditor: (editor: { x: number; y: number; value: string } | null | ((prev: { x: number; y: number; value: string } | null) => { x: number; y: number; value: string } | null)) => void;

  // Actions
  setActiveTool: (tool: Tool) => void;
  setToolVariant: (groupId: string, tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setCanvasOffset: (offset: { x: number; y: number }) => void;
  setLassoPaths: (paths: { x: number; y: number }[][] | ((prev: { x: number; y: number }[][]) => { x: number; y: number }[][])) => void;
  setVectorPaths: (paths: { points: { x: number; y: number }[]; closed: boolean; smooth?: boolean }[] | ((prev: { points: { x: number; y: number }[]; closed: boolean; smooth?: boolean }[]) => { points: { x: number; y: number }[]; closed: boolean; smooth?: boolean }[])) => void;
  setActivePathIndex: (index: number | null) => void;
  setPenMode: (mode: 'path' | 'shape') => void;
  setSelectionRect: (rect: { x: number; y: number; w: number; h: number } | null | ((prev: { x: number; y: number; w: number; h: number } | null) => { x: number; y: number; w: number; h: number } | null), shape?: 'rect' | 'ellipse') => void;
  setCropRect: (rect: { x: number; y: number; w: number; h: number } | null | ((prev: { x: number; y: number; w: number; h: number } | null) => { x: number; y: number; w: number; h: number } | null)) => void;
  setIsInverseSelection: (value: boolean) => void;
  inverseSelection: () => void;
  addLayer: (layer: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  setSelectionTolerance: (tolerance: number) => void;
  setSelectionContiguous: (contiguous: boolean) => void;
  setSelectionMode: (mode: 'new' | 'add' | 'subtract' | 'intersect') => void;
  toggleLayerVisibility: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  duplicateLayer: (id: string) => void;
  setBrushSize: (size: number) => void;
  setStrokeWidth: (width: number) => void;
  setBrushColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  setPrimaryOpacity: (opacity: number) => void;
  setSecondaryOpacity: (opacity: number) => void;
  setLayers: (layers: Layer[]) => void;
  setDocumentSize: (size: { w: number; h: number }) => void;
  undo: () => void;
  redo: () => void;
  moveLayer: (id: string, direction: 'up' | 'down') => void;
  reorderLayers: (startIndex: number, endIndex: number) => void;
  recordHistory: (actionName: string) => void;
  setSlices: (slices: { id: string; rect: { x: number; y: number; w: number; h: number } }[]) => void;
  addSlice: (rect: { x: number; y: number; w: number; h: number }) => void;
  clearSlices: () => void;
  addColorSampler: (coords: { x: number; y: number }, color: string) => void;
  removeColorSampler: (id: string) => void;
  clearColorSamplers: () => void;
  setRulerData: (data: { start: { x: number; y: number }; end: { x: number; y: number } } | null) => void;
}

// Initial state for the layers - now empty by default
const initialLayers: Layer[] = [];

export const useStore = create<EditorState>((set) => ({
  activeTool: 'move',
  cloneSource: null,
  customPattern: null,
  toolStrength: 50,
  toolHardness: 50,
  activeToolVariants: {
    move: 'move',
    marquee: 'marquee',
    lasso: 'lasso',
    selection: 'quick_selection',
    crop: 'crop',
    eyedropper: 'eyedropper',
    healing: 'healing',
    brush: 'brush',
    history: 'history_brush',
    clone: 'clone',
    eraser: 'eraser',
    gradient: 'gradient',
    blur: 'blur',
    dodge: 'dodge',
    text: 'text',
    pen: 'pen',
    path: 'path_select',
    shape: 'shape',
    hand: 'hand',
    zoom: 'zoom_tool'
  },
  zoom: 1,
  layers: initialLayers,
  activeLayerId: null,
  brushSize: 40,
  strokeWidth: 2,
  brushColor: '#000000',
  secondaryColor: '#555555',
  primaryOpacity: 1,
  secondaryOpacity: 1,
  canvasOffset: { x: 0, y: 0 },
  canvasRotation: 0,
  setCanvasRotation: (rotation) => set({ canvasRotation: rotation }),
  lassoPaths: [],
  selectionRect: null,
  selectionShape: 'rect',
  isInverseSelection: false,
  selectionTolerance: 32,
  selectionContiguous: true,
  selectionMode: 'new',
  cropRect: null,
  vectorPaths: [],
  activePathIndex: null,
  slices: [],
  colorSamplers: [],
  rulerData: null,
  polygonSides: 5,
  starPoints: 5,
  starInnerRadius: 40,
  cornerRadius: 0,
  penMode: 'path',
  toningRange: 'midtones',
  spongeMode: 'desaturate',
  redEyePupilSize: 50,
  redEyeDarkenAmount: 50,
  textEditor: null,
  isTyping: false,
  
  // Advanced Tool Settings Initial Values
  selectionFeather: 0,
  selectionAntiAlias: true,
  gradientType: 'linear',
  healingSourceMode: 'sampled',
  patchMode: 'source',
  contentAwareMoveMode: 'move',
  moveAutoSelect: true,
  moveShowTransform: false,
  textFontFamily: 'Inter, system-ui, sans-serif',
  textAlign: 'left',
  
  // Advanced Tool Setters
  setSelectionFeather: (val) => set({ selectionFeather: val }),
  setSelectionAntiAlias: (val) => set({ selectionAntiAlias: val }),
  setGradientType: (type) => set({ gradientType: type }),
  setHealingSourceMode: (mode) => set({ healingSourceMode: mode }),
  setPatchMode: (mode) => set({ patchMode: mode }),
  setContentAwareMoveMode: (mode) => set({ contentAwareMoveMode: mode }),
  setMoveAutoSelect: (val) => set({ moveAutoSelect: val }),
  setMoveShowTransform: (val) => set({ moveShowTransform: val }),
  setTextFontFamily: (val) => set({ textFontFamily: val }),
  setTextAlign: (val) => set({ textAlign: val }),
  setPolygonSides: (sides) => set({ polygonSides: sides }),
  setStarPoints: (points) => set({ starPoints: points }),
  setStarInnerRadius: (radius) => set({ starInnerRadius: radius }),
  setCornerRadius: (radius) => set({ cornerRadius: radius }),
  setIsTyping: (val) => set({ isTyping: val }),
  setToolStrength: (strength) => set({ toolStrength: strength }),
  setToolHardness: (hardness) => set({ toolHardness: hardness }),
  setToningRange: (range) => set({ toningRange: range }),
  setSpongeMode: (mode) => set({ spongeMode: mode }),
  setRedEyePupilSize: (val) => set({ redEyePupilSize: val }),
  setRedEyeDarkenAmount: (val) => set({ redEyeDarkenAmount: val }),
  setTextEditor: (updater) => set((state) => ({
    textEditor: typeof updater === 'function' ? updater(state.textEditor) : updater
  })),
  
  // Initialize history with the starting state
  documentSize: { w: 2000, h: 1400 },
  history: [
    {
      name: 'Initial State',
      state: {
        layers: initialLayers,
        activeLayerId: null,
        lassoPaths: [],
        selectionRect: null,
        isInverseSelection: false,
        documentSize: { w: 2000, h: 1400 },
        selectionTolerance: 32,
        selectionContiguous: true,
        slices: [],
        colorSamplers: [],
        toolStrength: 50,
        toolHardness: 50,
        canvasRotation: 0,
        gradientType: 'linear',
        selectionMode: 'new',
        selectionFeather: 0,
        selectionAntiAlias: true,
        healingSourceMode: 'sampled',
        patchMode: 'source',
        contentAwareMoveMode: 'move',
        moveAutoSelect: true,
        moveShowTransform: false,
        textFontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'left',
      },
    },
  ],
  historyIndex: 0,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setToolVariant: (groupId, tool) => set((state) => ({
    activeToolVariants: { ...state.activeToolVariants, [groupId]: tool },
    activeTool: tool
  })),

  setZoom: (zoom) => set({ zoom }),
  setCanvasOffset: (offset) => set({ canvasOffset: offset }),
  setLassoPaths: (updater) => set((state) => ({ 
    lassoPaths: typeof updater === 'function' ? updater(state.lassoPaths) : updater,
    selectionShape: 'lasso',
    isInverseSelection: false,
  })),
  setVectorPaths: (updater) => set((state) => ({ 
    vectorPaths: typeof updater === 'function' ? updater(state.vectorPaths) : updater 
  })),
  setActivePathIndex: (index) => set({ activePathIndex: index }),
  setPenMode: (mode) => set({ penMode: mode }),
  setSelectionRect: (updater, shape) => set((state) => ({ 
    selectionRect: typeof updater === 'function' ? updater(state.selectionRect) : updater,
    selectionShape: shape !== undefined ? shape : state.selectionShape,
    isInverseSelection: false,
  })),
  setCropRect: (updater) => set((state) => ({ 
    cropRect: typeof updater === 'function' ? updater(state.cropRect) : updater 
  })),
  setIsInverseSelection: (value) => set({ isInverseSelection: value }),
  inverseSelection: () => set((state) => {
    const { w, h } = state.documentSize;
    if (!state.selectionRect && state.lassoPaths.length === 0) {
      return {
        selectionRect: { x: 0, y: 0, w, h },
        lassoPaths: [],
        isInverseSelection: false,
      };
    }
    return {
      isInverseSelection: !state.isInverseSelection,
    };
  }),
  addLayer: (layer) => set((state) => {
    const newLayer: Layer = {
      id: nanoid(),
      name: `Layer ${state.layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      type: 'paint',
      position: { x: 0, y: 0 },
      blendMode: 'source-over',
      ...layer,
    };
    return {
      layers: [newLayer, ...state.layers],
      activeLayerId: newLayer.id,
    };
  }),
  updateLayer: (id, updates) => set((state) => ({
    layers: state.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
  })),
  setLayers: (layers) => set({ layers }),
  setDocumentSize: (documentSize) => set({ documentSize }),
  duplicateLayer: (id) => set((state) => {
    const layerToDup = state.layers.find(l => l.id === id);
    if (!layerToDup) return state;
    const newLayer = {
      ...layerToDup,
      id: nanoid(),
      name: `${layerToDup.name} Copy`,
      position: { x: layerToDup.position.x + 20, y: layerToDup.position.y + 20 }
    };
    return {
      layers: [newLayer, ...state.layers],
      activeLayerId: newLayer.id,
    };
  }),
  removeLayer: (id) => set((state) => ({
    layers: state.layers.filter((l) => l.id !== id),
  })),
  setActiveLayer: (id) => set({ activeLayerId: id }),
  toggleLayerVisibility: (id) => set((state) => ({
    layers: state.layers.map((l) => 
      l.id === id ? { ...l, visible: !l.visible } : l
    ),
  })),
  setBrushSize: (size) => set({ brushSize: size }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setBrushColor: (color: string) => set({ brushColor: color }),
  setSecondaryColor: (color: string) => set({ secondaryColor: color }),
  setPrimaryOpacity: (opacity) => set({ primaryOpacity: opacity }),
  setSecondaryOpacity: (opacity) => set({ secondaryOpacity: opacity }),
  
  undo: () => set((state) => {
    if (state.historyIndex <= 0) return state;
    const prevIndex = state.historyIndex - 1;
    return {
      ...state.history[prevIndex].state,
      historyIndex: prevIndex,
    };
  }),
  
  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state;
    const nextIndex = state.historyIndex + 1;
    return {
      ...state.history[nextIndex].state,
      historyIndex: nextIndex,
    };
  }),

  moveLayer: (id, direction) => set((state) => {
    const index = state.layers.findIndex(l => l.id === id);
    if (index === -1) return state;
    const newLayers = [...state.layers];
    if (direction === 'up' && index > 0) {
      [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
    } else if (direction === 'down' && index < newLayers.length - 1) {
      [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
    }
    return { layers: newLayers };
  }),
  reorderLayers: (startIndex, endIndex) => set((state) => {
    const next = [...state.layers];
    const [removed] = next.splice(startIndex, 1);
    next.splice(endIndex, 0, removed);
    return { layers: next };
  }),
  
  setCloneSource: (cloneSource) => set({ cloneSource }),
  setCustomPattern: (customPattern) => set({ customPattern }),

  recordHistory: (name) => set((state) => {
    const newEntry = {
      name,
      state: {
        layers: JSON.parse(JSON.stringify(state.layers)),
        activeLayerId: state.activeLayerId,
        lassoPaths: JSON.parse(JSON.stringify(state.lassoPaths)),
        selectionRect: state.selectionRect ? { ...state.selectionRect } : null,
        isInverseSelection: state.isInverseSelection,
        documentSize: { ...state.documentSize },
        selectionTolerance: state.selectionTolerance,
        selectionContiguous: state.selectionContiguous,
        slices: JSON.parse(JSON.stringify(state.slices)),
        colorSamplers: JSON.parse(JSON.stringify(state.colorSamplers)),
        toolStrength: state.toolStrength,
        toolHardness: state.toolHardness,
        canvasRotation: state.canvasRotation,
        gradientType: state.gradientType,
        selectionMode: state.selectionMode,
        selectionFeather: state.selectionFeather,
        selectionAntiAlias: state.selectionAntiAlias,
        healingSourceMode: state.healingSourceMode,
        patchMode: state.patchMode,
        contentAwareMoveMode: state.contentAwareMoveMode,
        moveAutoSelect: state.moveAutoSelect,
        moveShowTransform: state.moveShowTransform,
        textFontFamily: state.textFontFamily,
        textAlign: state.textAlign,
      },
    };
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    return {
      history: [...newHistory, newEntry],
      historyIndex: newHistory.length,
    };
  }),

  setSelectionTolerance: (selectionTolerance) => set({ selectionTolerance }),
  setSelectionContiguous: (selectionContiguous) => set({ selectionContiguous }),
  setSelectionMode: (selectionMode) => set({ selectionMode }),
  setSlices: (slices) => set({ slices }),
  addSlice: (rect) => set((state) => ({ 
    slices: [...state.slices, { id: (state.slices.length + 1).toString(), rect }] 
  })),
  clearSlices: () => set({ slices: [] }),
  addColorSampler: (coords, color) => set((state) => ({
    colorSamplers: [...state.colorSamplers, { id: (state.colorSamplers.length + 1).toString(), ...coords, color }]
  })),
  removeColorSampler: (id) => set((state) => ({
    colorSamplers: state.colorSamplers.filter(s => s.id !== id)
  })),
  clearColorSamplers: () => set({ colorSamplers: [] }),
  setRulerData: (rulerData) => set({ rulerData }),
}));
