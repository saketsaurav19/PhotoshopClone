import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import './Canvas.css';
import { getCoordinates as getCoordsUtil, getSnappedCoords as getSnappedCoordsUtil } from './utils/coordUtils';
import { applySelectionClip as applySelectionClipUtil, getSelectionPathData as getSelectionPathDataUtil, clearSelection as clearSelectionUtil } from './utils/selectionUtils';
import { getSvgPathData as getSvgPathDataUtil } from './utils/pathUtils';
import { handleEyedropper as handleEyedropperUtil, hexToRgba } from './utils/colorUtils';
import { applyCrop as applyCropUtil, isCropUiTarget } from './utils/cropUtils';
import { applyGradient as applyGradientUtil } from './utils/gradientUtils';
import { commitText as commitTextUtil, cancelText as cancelTextUtil } from './utils/textUtils';
import { findBestEdgePoint as findBestEdgePointUtil } from './utils/edgeUtils';
import { handlePaintBucket as handlePaintBucketUtil } from './utils/paintBucketUtils';
import { getCursor as getCursorUtil } from './utils/cursorUtils';
import { startAction as startActionHandler, moveAction as moveActionHandler, endAction as endActionHandler, handleDoubleClick as handleDoubleClickUtil } from './handlers/interactionHandlers';
import { handleTouchStart as handleTouchStartUtil, handleTouchMove as handleTouchMoveUtil } from './handlers/touchHandlers';
import { BRUSH_TOOLS } from './utils/toolUtils';
import { useLayerRendering } from './hooks/useLayerRendering';
import { useThumbnailGeneration } from './hooks/useThumbnailGeneration';
import { useSelectionAnimation } from './hooks/useSelectionAnimation';
import { useTextRendering } from './hooks/useTextRendering';
import { CanvasLayer } from './components/CanvasLayer';
import { SelectionOverlay } from './components/SelectionOverlay';
import { VectorOverlay } from './components/VectorOverlay';
import { CropOverlay } from './components/CropOverlay';
import { TextEditorOverlay } from './components/TextEditorOverlay';
import { RulerOverlay } from './components/RulerOverlay';
import { DraftOverlay } from './components/DraftOverlay';
import { PerspectiveCropOverlay } from './components/PerspectiveCropOverlay';
import { SVGFilters } from './components/SVGFilters';

/**
 * The main Canvas component that acts as the primary viewport for the Photoshop clone.
 * It manages the layer stack, tool interactions, and coordinates the rendering of various overlays.
 */
const Canvas: React.FC = () => {
  const store = useStore();
  const {
    activeTool, brushSize, strokeWidth, brushColor, secondaryColor,
    primaryOpacity, secondaryOpacity,
    zoom, setZoom, layers, activeLayerId,
    updateLayer, addLayer, recordHistory, setActiveLayer, setLayers,
    canvasOffset, setCanvasOffset, canvasRotation, setCanvasRotation, setBrushColor,
    history, historyIndex,
    lassoPaths, setLassoPaths, selectionRect, setSelectionRect,
    isInverseSelection, setIsInverseSelection,
    documentSize, setDocumentSize,
    vectorPaths, setVectorPaths, activePathIndex, setActivePathIndex, penMode,
    slices, setSlices, addSlice,
    colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData,
    setIsTyping, toolStrength, toolHardness,
    redEyePupilSize, redEyeDarkenAmount,
    textEditor, setTextEditor
  } = store;
  // --- UI & Interaction State ---
  const [isInteracting, setIsInteracting] = useState(false); // True during active mouse/touch drag
  const [currentMousePos, setCurrentMousePos] = useState<{ x: number, y: number } | null>(null); // Real-time snapped coordinates
  const [draftShape, setDraftShape] = useState<{ x: number, y: number, w: number, h: number } | null>(null); // Shape tool preview
  const [draftLasso, setDraftLasso] = useState<{ x: number, y: number }[] | null>(null); // Lasso tool preview
  const [cropRect, setCropRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null); // Crop tool bounding box
  const [gradientStart, setGradientStart] = useState<{ x: number, y: number } | null>(null); // Gradient tool start point
  const [cloneSource, setCloneSource] = useState<{ x: number, y: number } | null>(null); // Clone stamp source point
  const [selectedPoint, setSelectedPoint] = useState<{ pathIdx: number, pointIdx: number } | null>(null); // Vector path anchor selection
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // --- Touch Gestures State (for mobile/tablet support) ---
  const [initialTouchDistance, setInitialTouchDistance] = useState<number | null>(null);
  const [initialTouchMidpoint, setInitialTouchMidpoint] = useState<{ x: number, y: number } | null>(null);
  const [initialTouchZoom, setInitialTouchZoom] = useState<number>(1);
  const [initialTouchOffset, setInitialTouchOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [activeCropHandle, setActiveCropHandle] = useState<string | null>(null);

  // --- DOM & Canvas References ---
  const canvasRefs = useRef<{ [key: string]: HTMLCanvasElement | null }>({}); // References to individual layer canvases
  const lastPointRef = useRef<{ x: number; y: number } | null>(null); // Tracking mouse delta for movement tools
  const startMouseRef = useRef<{ x: number; y: number } | null>(null); // Coordinate where the current action began
  const startOffsetRef = useRef<{ x: number, y: number } | null>(null); // Canvas offset when drag began
  const draftTextCanvasRef = useRef<HTMLCanvasElement>(null); // Overlay for live text preview
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null); // Overlay for animated selection (marching ants)
  const stackRef = useRef<HTMLDivElement>(null); // The scaled/rotated container of all canvases
  const hiddenTextInputRef = useRef<HTMLTextAreaElement>(null); // Hidden input to capture keyboard events for text tool


  useEffect(() => {
    const input = hiddenTextInputRef.current;
    if (!textEditor && input) {
      input.blur();
    }
  }, [textEditor]);

  useEffect(() => {
    setIsTyping(!!textEditor);
    return () => setIsTyping(false);
  }, [textEditor, setIsTyping]);

  /**
   * Converts screen (clientX/Y) coordinates to document-space coordinates.
   * Accounts for canvas zoom, rotation, and offset.
   */
  const getCoordinates = useCallback((clientX: number, clientY: number) => 
    getCoordsUtil(clientX, clientY, stackRef.current, documentSize), [documentSize]);

  /**
   * Snaps coordinates to nearby anchor points, edges, or paths.
   * Used by vector and selection tools for precision.
   */
  const getSnappedCoords = useCallback((coords: { x: number, y: number }, exclude?: { pathIdx: number, pointIdx: number }, threshold: number = 12) =>
    getSnappedCoordsUtil(coords, vectorPaths, lassoPaths, zoom, exclude, threshold), [vectorPaths, lassoPaths, zoom]);

  /**
   * Applies the current selection as a clipping mask to a 2D context.
   * Used when painting inside or clearing a selection.
   */
  const applySelectionClip = useCallback((ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, canvasWidth: number, canvasHeight: number) =>
    applySelectionClipUtil(ctx, selectionRect, isInverseSelection, lassoPaths, store.selectionShape, offsetX, offsetY, canvasWidth, canvasHeight), [selectionRect, isInverseSelection, lassoPaths, store.selectionShape]);

  const handleEyedropper = useCallback((x: number, y: number) =>
    handleEyedropperUtil(x, y, activeLayerId, layers, canvasRefs, setBrushColor), [activeLayerId, layers, setBrushColor]);

  const applyCrop = useCallback(() =>
    applyCropUtil(cropRect, layers, lassoPaths, canvasRefs, setLayers, setLassoPaths, setSelectionRect, setDocumentSize, setCanvasOffset, setCropRect, recordHistory, setIsInverseSelection), 
    [cropRect, layers, lassoPaths, setLayers, setLassoPaths, setSelectionRect, setDocumentSize, setCanvasOffset, recordHistory, setIsInverseSelection]);

  const applyGradient = useCallback((start: { x: number, y: number }, end: { x: number, y: number }) =>
    applyGradientUtil(start, end, activeLayerId, layers, canvasRefs, brushColor, secondaryColor, recordHistory), 
    [activeLayerId, layers, brushColor, secondaryColor, recordHistory]);

  const getSvgPathData = (points: { x: number, y: number }[], closed: boolean, smooth: boolean = false) =>
    getSvgPathDataUtil(points, closed, smooth);

  const getSelectionPathData = useCallback(() =>
    getSelectionPathDataUtil(selectionRect, lassoPaths, store.selectionShape), [selectionRect, lassoPaths, store.selectionShape]);

  const commitText = useCallback(() =>
    commitTextUtil(textEditor, brushSize, brushColor, primaryOpacity, strokeWidth, secondaryColor, secondaryOpacity, hexToRgba, addLayer, recordHistory, setTextEditor, hiddenTextInputRef),
    [textEditor, brushSize, brushColor, primaryOpacity, strokeWidth, secondaryColor, secondaryOpacity, hexToRgba, addLayer, recordHistory, setTextEditor]);

  const cancelText = useCallback(() =>
    cancelTextUtil(setTextEditor, hiddenTextInputRef), [setTextEditor]);

  const clearSelection = useCallback(() =>
    clearSelectionUtil(activeLayerId, layers, canvasRefs, selectionRect, lassoPaths, isInverseSelection, store.selectionShape, updateLayer, recordHistory, setSelectionRect, setLassoPaths, setIsInverseSelection),
    [activeLayerId, layers, selectionRect, lassoPaths, isInverseSelection, store.selectionShape, updateLayer, recordHistory, setSelectionRect, setLassoPaths, setIsInverseSelection]);

  const findBestEdgePoint = useCallback((x: number, y: number, radius: number) =>
    findBestEdgePointUtil(x, y, radius, activeLayerId, layers, canvasRefs), [activeLayerId, layers]);

  const handlePaintBucket = useCallback((x: number, y: number) =>
    handlePaintBucketUtil(x, y, activeLayerId, layers, canvasRefs, brushColor, primaryOpacity, updateLayer, recordHistory),
    [activeLayerId, layers, brushColor, primaryOpacity, updateLayer, recordHistory]);

  // --- Modular Rendering Hooks ---
  
  // Handles the periodic rendering of all layers to their respective canvases
  useLayerRendering(layers, documentSize, canvasRefs);
  
  // Asynchronously generates layer thumbnails for the sidebar
  useThumbnailGeneration(layers, documentSize, canvasRefs, updateLayer);
  
  // Manages the high-performance animation frame for selection "marching ants"
  useSelectionAnimation(selectionCanvasRef, {
    lassoPaths, vectorPaths, selectionRect, isInverseSelection,
    isInteracting, activeTool, currentMousePos, zoom,
    selectionShape: store.selectionShape, activePathIndex, penMode,
    findBestEdgePoint
  });
  
  // Renders the live preview of text while typing
  useTextRendering(draftTextCanvasRef, {
    textEditor, brushSize, brushColor, primaryOpacity, strokeWidth,
    secondaryColor, secondaryOpacity, hexToRgba
  });




  // --- Global Event Listeners ---

  // Listens for 'delete-selection' custom event to clear the current selection
  React.useEffect(() => {
    const onDelete = () => clearSelection();
    window.addEventListener('delete-selection', onDelete);
    return () => window.removeEventListener('delete-selection', onDelete);
  }, [clearSelection]);

  useEffect(() => {
    const onDefinePattern = () => {
      if (!selectionRect || !activeLayerId) return;
      const canvas = canvasRefs.current[activeLayerId];
      if (!canvas) return;

      const { x, y, w, h } = selectionRect;
      const absW = Math.round(Math.abs(w));
      const absH = Math.round(Math.abs(h));
      if (absW < 2 || absH < 2) return;

      const layer = layers.find(l => l.id === activeLayerId);
      const lx = (w >= 0 ? x : x + w) - (layer?.position.x || 0);
      const ly = (h >= 0 ? y : y + h) - (layer?.position.y || 0);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = absW;
      tempCanvas.height = absH;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCtx.drawImage(canvas, lx, ly, absW, absH, 0, 0, absW, absH);
      useStore.getState().setCustomPattern(tempCanvas.toDataURL());
      setSelectionRect(null);
    };

    window.addEventListener('define-pattern', onDefinePattern);
    return () => window.removeEventListener('define-pattern', onDefinePattern);
  }, [selectionRect, activeLayerId, layers, setSelectionRect]);
  useEffect(() => {
    const handleDrawDraft = (e: any) => setDraftShape(e.detail);
    const handleClearDraft = () => setDraftShape(null);
    const handleDrawLasso = (e: any) => setDraftLasso(e.detail);
    const handleClearLasso = () => setDraftLasso(null);
    const handleSetGradStart = (e: any) => {
      setGradientStart(e.detail);
      (window as any)._gradientStart = e.detail;
    };
    const handleSetGradEnd = (e: any) => setCurrentMousePos(e.detail);
    const handleClearGrad = () => {
      setGradientStart(null);
      delete (window as any)._gradientStart;
    };

    window.addEventListener('draw-draft-rect', handleDrawDraft);
    window.addEventListener('clear-draft-rect', handleClearDraft);
    window.addEventListener('draw-draft-lasso', handleDrawLasso);
    window.addEventListener('clear-draft-lasso', handleClearLasso);
    window.addEventListener('set-gradient-start', handleSetGradStart);
    window.addEventListener('set-gradient-end', handleSetGradEnd);
    window.addEventListener('clear-gradient', handleClearGrad);

    return () => {
      window.removeEventListener('draw-draft-rect', handleDrawDraft);
      window.removeEventListener('clear-draft-rect', handleClearDraft);
      window.removeEventListener('draw-draft-lasso', handleDrawLasso);
      window.removeEventListener('clear-Lasso', handleClearLasso);
      window.removeEventListener('set-gradient-start', handleSetGradStart);
      window.removeEventListener('set-gradient-end', handleSetGradEnd);
      window.removeEventListener('clear-gradient', handleClearGrad);
    };
  }, []);


  /**
   * --- Interaction Engine ---
   * These functions manage the lifecycle of a tool interaction (Click/Touch -> Drag -> Release).
   */

  /**
   * Initiates a tool action.
   * Creates a 'CanvasContext' containing all necessary state and methods for the tool modules.
   */
  const startAction = useCallback((clientX: number, clientY: number, e: React.MouseEvent | React.TouchEvent) => {
    const rawCoords = getCoordinates(clientX, clientY);
    if (!rawCoords) return;

    const isStartToolVector = ['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool as string);
    const coords = isStartToolVector ? getSnappedCoords(rawCoords) : rawCoords;

    const context: any = {
      canvas: (activeLayerId ? canvasRefs.current[activeLayerId] : null),
      ctx: (activeLayerId ? canvasRefs.current[activeLayerId]?.getContext('2d', { willReadFrequently: true }) : null),
      coords,
      startCoords: coords,
      lastPoint: lastPointRef.current,
      isShift: (e as any).shiftKey || false,
      isAlt: (e as any).altKey || false,
      isCtrl: (e as any).ctrlKey || (e as any).metaKey || false,
      brushSize, brushColor, zoom,
      activeLayerId, layers,
      selectionMode: store.selectionMode,
      selectionTolerance: store.selectionTolerance,
      selectionContiguous: store.selectionContiguous,
      selectionRect, lassoPaths, isInverseSelection,
      setLassoPaths, setSelectionRect, setCropRect, updateLayer, recordHistory, setIsInteracting,
      setBrushColor, addLayer, setDocumentSize,
      slices, setSlices, addSlice,
      colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData,
      history, historyIndex,
      cloneSource: store.cloneSource,
      setCloneSource: store.setCloneSource,
      customPattern: store.customPattern,
      secondaryColor: store.secondaryColor,
      primaryOpacity, secondaryOpacity, hexToRgba, applySelectionClip,
      redEyePupilSize, redEyeDarkenAmount, isInteracting, setIsTyping,
      cropRect
    };

    startActionHandler(clientX, clientY, e, context, {
      setIsInteracting, setZoom, setTextEditor, setCropRect, setDraftShape, setVectorPaths, setActivePathIndex, setSelectedPoint, recordHistory, handleEyedropper
    }, {
      lastPointRef, startMouseRef, startOffsetRef, hiddenTextInputRef
    });
  }, [getCoordinates, activeTool, textEditor, commitText, layers, setActiveLayer, zoom, setZoom, handleEyedropper, activeLayerId, canvasOffset, lassoPaths, vectorPaths, activePathIndex, setActivePathIndex, setLassoPaths, setSelectionRect, cropRect, setCropRect, setDraftShape, setVectorPaths, setGradientStart, handlePaintBucket, setCloneSource, brushSize, brushColor, primaryOpacity, recordHistory, setIsInteracting, addLayer, strokeWidth, hexToRgba, secondaryColor, secondaryOpacity, setSelectedPoint, isAltPressed, isCtrlPressed, slices, setSlices, addSlice, colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData, history, historyIndex, applySelectionClip]);

  const handleDoubleClick = useCallback(() => {
    const id = activeLayerId || layers[0]?.id;
    const canvas = canvasRefs.current[id];
    const ctx = canvas?.getContext('2d');

    const context: any = {
      canvas, ctx, coords: currentMousePos || { x: 0, y: 0 },
      startCoords: null, lastPoint: lastPointRef.current,
      brushSize, brushColor, zoom,
      activeLayerId, layers,
      selectionMode: store.selectionMode,
      selectionTolerance: store.selectionTolerance,
      selectionContiguous: store.selectionContiguous,
      selectionRect, lassoPaths, isInverseSelection,
      setLassoPaths, setSelectionRect, setCropRect, updateLayer, recordHistory, setIsInteracting,
      setBrushColor, addLayer, setDocumentSize,
      slices, setSlices, addSlice,
      colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData,
      customPattern: store.customPattern,
      secondaryColor: store.secondaryColor,
      primaryOpacity, secondaryOpacity, hexToRgba, applySelectionClip,
      isShift: false, isAlt: isAltPressed, isCtrl: isCtrlPressed,
      cropRect
    };

    handleDoubleClickUtil(context);
  }, [activeTool, recordHistory, currentMousePos, brushSize, brushColor, zoom, activeLayerId, layers, selectionRect, setLassoPaths, setSelectionRect, setCropRect, updateLayer, setIsInteracting, setBrushColor, addLayer, setDocumentSize, isAltPressed, isCtrlPressed, vectorPaths, activePathIndex, lassoPaths, isInverseSelection, slices, setSlices, addSlice, colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData, history, historyIndex, secondaryColor, primaryOpacity, secondaryOpacity, applySelectionClip]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (activeTool === 'polygonal_lasso' || activeTool === 'magnetic_lasso') {
          if (lassoPaths.length > 0) {
            setLassoPaths(prev => {
              const next = [...prev];
              const currentPath = [...next[next.length - 1]];
              if (currentPath.length > 1) {
                currentPath.pop();
                next[next.length - 1] = currentPath;
              } else {
                next.pop();
                setIsInteracting(false);
              }
              return next;
            });
          }
        }
      } else if (e.key === 'Escape') {
        if (activeTool === 'polygonal_lasso' || activeTool === 'magnetic_lasso') {
          setLassoPaths([]);
          setIsInteracting(false);
        }
      } else if (e.key === 'Enter') {
        if (activeTool === 'polygonal_lasso' || activeTool === 'magnetic_lasso') {
          setIsInteracting(false);
          recordHistory(activeTool === 'polygonal_lasso' ? 'Polygonal Lasso' : 'Magnetic Lasso');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, lassoPaths, recordHistory, setLassoPaths, isInteracting]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleTouchStartUtil(e, zoom, canvasOffset, {
      setInitialTouchDistance, setInitialTouchMidpoint, setInitialTouchZoom, setInitialTouchOffset, setIsInteracting, startAction, isCropUiTarget
    });
  }, [zoom, canvasOffset, startAction]);


  /**
   * Manages the mouse/touch move phase of an interaction.
   * Responsible for real-time previews (drawing, resizing, moving).
   */
  const moveAction = useCallback((clientX: number, clientY: number) => {
    const rawCoords = getCoordinates(clientX, clientY);
    if (!rawCoords) return;

    const isVectorTool = ['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool as string);
    const coords = isVectorTool ? getSnappedCoords(rawCoords) : rawCoords;

    const context: any = {
      canvas: (activeLayerId ? canvasRefs.current[activeLayerId] : null),
      ctx: (activeLayerId ? canvasRefs.current[activeLayerId]?.getContext('2d', { willReadFrequently: true }) : null),
      coords,
      startCoords: startMouseRef.current ? getCoordinates(startMouseRef.current.x, startMouseRef.current.y) : null,
      lastPoint: lastPointRef.current,
      brushSize, brushColor, zoom,
      activeLayerId, layers,
      selectionMode: store.selectionMode,
      selectionTolerance: store.selectionTolerance,
      selectionContiguous: store.selectionContiguous,
      selectionRect, lassoPaths, isInverseSelection,
      setLassoPaths, setSelectionRect, setCropRect, updateLayer, recordHistory, setIsInteracting,
      setBrushColor, addLayer, setDocumentSize,
      slices, setSlices, addSlice,
      colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData,
      history, historyIndex,
      cloneSource: store.cloneSource,
      setCloneSource: store.setCloneSource,
      customPattern: store.customPattern,
      secondaryColor: store.secondaryColor,
      primaryOpacity, secondaryOpacity, hexToRgba, applySelectionClip,
      isShift: false, isAlt: isAltPressed, isCtrl: isCtrlPressed,
      cropRect
    };

    moveActionHandler(clientX, clientY, context, {
      setCurrentMousePos, setCanvasOffset, setCanvasRotation, setCropRect, setDraftShape, setSelectionRect, setVectorPaths, setIsInteracting
    }, {
      lastPointRef, startMouseRef, startOffsetRef, getCoordinates, getSnappedCoords
    }, {
      isInteracting, activeCropHandle, selectedPoint, activePathIndex
    });
  }, [getCoordinates, isInteracting, activeTool, activeLayerId, layers, brushSize, strokeWidth, hexToRgba, secondaryColor, secondaryOpacity, brushColor, primaryOpacity, updateLayer, canvasOffset, setCanvasOffset, cloneSource, selectionRect, lassoPaths, activeCropHandle, cropRect, applySelectionClip, findBestEdgePoint, vectorPaths, activePathIndex, selectedPoint, isAltPressed, isCtrlPressed]);


  const handleTouchMove = useCallback((e: TouchEvent) => {
    handleTouchMoveUtil(e, initialTouchDistance, initialTouchMidpoint, initialTouchZoom, initialTouchOffset, zoom, {
      setZoom, setCanvasOffset, moveAction: (x: number, y: number) => moveActionRef.current(x, y)
    });
  }, [initialTouchDistance, initialTouchMidpoint, initialTouchZoom, initialTouchOffset, zoom, setZoom, setCanvasOffset]);


  /**
   * Finalizes a tool action.
   * Commits changes to the history and cleans up temporary interaction state.
   */
  const endAction = useCallback(() => {
    const context: any = {
      canvas: (activeLayerId ? canvasRefs.current[activeLayerId] : null),
      ctx: (activeLayerId ? canvasRefs.current[activeLayerId]?.getContext('2d', { willReadFrequently: true }) : null),
      coords: currentMousePos || { x: 0, y: 0 },
      startCoords: startMouseRef.current ? getCoordinates(startMouseRef.current.x, startMouseRef.current.y) : null,
      lastPoint: lastPointRef.current,
      brushSize, brushColor, zoom, toolStrength, toolHardness,
      activeLayerId, layers,
      selectionMode: store.selectionMode,
      selectionTolerance: store.selectionTolerance,
      selectionContiguous: store.selectionContiguous,
      selectionRect, lassoPaths, isInverseSelection,
      setLassoPaths, setSelectionRect, setCropRect, updateLayer, recordHistory, setIsInteracting,
      setBrushColor, addLayer, setDocumentSize,
      slices, setSlices, addSlice,
      colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData,
      history, historyIndex,
      cloneSource: store.cloneSource,
      setCloneSource: store.setCloneSource,
      customPattern: store.customPattern,
      secondaryColor: store.secondaryColor,
      primaryOpacity, secondaryOpacity, hexToRgba, applySelectionClip,
      isShift: false, isAlt: isAltPressed, isCtrl: isCtrlPressed,
      setIsTyping,
      redEyePupilSize, redEyeDarkenAmount,
      cropRect
    };

    endActionHandler(context, {
      setIsInteracting, updateLayer, recordHistory, addLayer, setDraftShape, setGradientStart, applyGradient
    }, {
      lastPointRef, canvasRefs
    }, {
      isInteracting, draftShape, gradientStart
    });
  }, [isInteracting, activeTool, activeLayerId, layers, updateLayer, draftShape, addLayer, hexToRgba, brushColor, primaryOpacity, secondaryColor, secondaryOpacity, strokeWidth, recordHistory, currentMousePos, gradientStart, applyGradient, selectionRect, lassoPaths]);


  // Handles mouse wheel zooming
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(Math.min(32, Math.max(0.01, zoom + delta)));
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [zoom, setZoom]);

  const moveActionRef = useRef(moveAction);
  const endActionRef = useRef(endAction);

  useEffect(() => {
    moveActionRef.current = moveAction;
    endActionRef.current = endAction;
  });

  // Sets up global mouse/touch move and up listeners when an interaction is active.
  // Using refs for move/end ensures the listeners always use the latest logic without re-binding.
  useEffect(() => {
    const onMoveGlobal = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      moveActionRef.current(clientX, clientY);
    };

    const onUp = () => {
      endActionRef.current();
      setInitialTouchDistance(null);
      setInitialTouchMidpoint(null);
      setActiveCropHandle(null);
    };

    window.addEventListener('mousemove', onMoveGlobal);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    if (isInteracting || initialTouchDistance !== null) {
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchend', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMoveGlobal);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [isInteracting, initialTouchDistance, handleTouchMove]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(true);
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(true);

      if (textEditor) {
        if (e.key === 'Escape') {
          commitText();
          return;
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          commitText();
          return;
        }
        return;
      }
      if (e.key === 'Enter' && cropRect) {
        applyCrop();
      }
      if (e.key === 'Escape') {
        setCropRect(null);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(false);
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(false);
    };
    const preventScroll = (e: KeyboardEvent) => {
      if (textEditor && e.key === 'Escape') {
        // e.preventDefault(); // Don't prevent escape
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keydown', preventScroll, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', preventScroll, { capture: true });
    };
  }, [clearSelection, textEditor, commitText, cropRect, applyCrop, setCropRect]);

  useEffect(() => {
    const canvas = draftTextCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (textEditor) {
      const fs = brushSize * 2;
      ctx.fillStyle = hexToRgba(brushColor, primaryOpacity);
      ctx.font = `${fs}px Arial`;
      const lines = textEditor.value.split('\n');
      let maxWidth = 10;
      lines.forEach((line) => {
        const w = ctx.measureText(line).width;
        if (w > maxWidth) maxWidth = w;
      });
      const padding = 10;
      ctx.strokeStyle = '#aaaaaa';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(textEditor.x - padding, textEditor.y, maxWidth + padding * 2 + 10, lines.length * fs + padding);
      ctx.setLineDash([]);
      const isVertical = (window as any)._lastTextTool === 'vertical_text';
      lines.forEach((line, i) => {
        if (isVertical) {
          const chars = line.split('');
          const xPos = textEditor.x + i * fs * 1.2;
          chars.forEach((char, j) => {
            const yPos = textEditor.y + (j + 1) * fs;
            if (strokeWidth > 0) {
              ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
              ctx.lineWidth = strokeWidth;
              ctx.strokeText(char, xPos, yPos);
            }
            ctx.fillText(char, xPos, yPos);
          });
        } else {
          const yPos = textEditor.y + (i + 1) * fs;
          if (strokeWidth > 0) {
            ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
            ctx.lineWidth = strokeWidth;
            ctx.strokeText(line, textEditor.x, yPos);
          }
          ctx.fillText(line, textEditor.x, yPos);
        }
      });
      const lastLine = lines[lines.length - 1];
      const textWidth = ctx.measureText(lastLine).width;
      const time = Date.now();
      if (Math.floor(time / 500) % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(textEditor.x + textWidth + 2, textEditor.y + (lines.length - 1) * fs + fs * 0.2);
        ctx.lineTo(textEditor.x + textWidth + 2, textEditor.y + lines.length * fs + fs * 0.2);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [textEditor, brushSize, brushColor]);




  const getCursor = () => getCursorUtil(isInteracting, activeTool, isAltPressed, isCtrlPressed, BRUSH_TOOLS);


  const [mouseClientPos, setMouseClientPos] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

  return (
    <div
      className="canvas-container"
      style={{ cursor: getCursor() }}
      onMouseMove={(e) => {
        setMouseClientPos({ x: e.clientX, y: e.clientY });
        const rawCoords = getCoordinates(e.clientX, e.clientY);
        if (rawCoords) {
          const isVectorTool = ['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool as string);
          const snapped = isVectorTool ? getSnappedCoords(rawCoords) : rawCoords;
          setCurrentMousePos(snapped);
        }
      }}
      onMouseDown={(e) => {
        if (e.button === 0) {
          if (isCropUiTarget(e.target)) {
            return;
          }
          startAction(e.clientX, e.clientY, e);
        }
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Brush Size Preview Cursor */}
      {BRUSH_TOOLS.includes(activeTool as string) && (
        <div
          className="brush-cursor"
          style={{
            position: 'fixed',
            left: mouseClientPos.x,
            top: mouseClientPos.y,
            width: (brushSize * zoom) / 2,
            height: (brushSize * zoom) / 2,
            border: '1px solid #fff',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 10000,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 2px rgba(0,0,0,0.5)',
            mixBlendMode: 'difference'
          }}
        />
      )}
      <div
        ref={stackRef}
        className="canvas-stack"
        style={{
          transform: `scale(${zoom}) translate(${canvasOffset.x / 2}px, ${canvasOffset.y / 2}px) rotate(${canvasRotation}deg)`,
          width: `${documentSize.w / 2}px`,
          height: `${documentSize.h / 2}px`,
          overflow: 'hidden'
        }}
        onTouchStart={handleTouchStart}
      >
        {layers.map((layer, index) => (
          <CanvasLayer
            key={layer.id}
            layer={layer}
            documentSize={documentSize}
            canvasRef={(el) => { canvasRefs.current[layer.id] = el; }}
            layersCount={layers.length}
            layerIndex={index}
          />
        ))}

        {activeLayerId && (
          <SelectionOverlay
            selectionRect={selectionRect}
            lassoPaths={lassoPaths}
            isInverseSelection={isInverseSelection}
            documentSize={documentSize}
            activeLayerPosition={layers.find(l => l.id === activeLayerId)?.position || { x: 0, y: 0 }}
            getSelectionPathData={getSelectionPathData}
          />
        )}

        <VectorOverlay
          vectorPaths={vectorPaths}
          activePathIndex={activePathIndex}
          activeTool={activeTool}
          currentMousePos={currentMousePos}
          zoom={zoom}
          getSvgPathData={getSvgPathData}
          selectedPoint={selectedPoint}
        />

        <CropOverlay
          cropRect={cropRect}
          getCoordinates={getCoordinates}
          lastPointRef={lastPointRef}
          setActiveCropHandle={setActiveCropHandle}
          setIsInteracting={setIsInteracting}
          applyCrop={applyCrop}
          setCropRect={setCropRect}
        />

        <PerspectiveCropOverlay
          lassoPaths={lassoPaths}
          getCoordinates={getCoordinates}
          setIsInteracting={setIsInteracting}
          lastPointRef={lastPointRef}
          handleDoubleClick={handleDoubleClick}
          setLassoPaths={setLassoPaths}
        />

        <DraftOverlay
          draftShape={draftShape}
          draftLasso={draftLasso}
          gradientStart={gradientStart}
          currentMousePos={currentMousePos}
          activeTool={activeTool}
          brushColor={brushColor}
          secondaryColor={secondaryColor}
          strokeWidth={strokeWidth}
          primaryOpacity={primaryOpacity}
        />

        <RulerOverlay
          rulerData={rulerData}
          slices={slices}
          colorSamplers={colorSamplers}
        />


        <TextEditorOverlay
          textEditor={textEditor}
          setTextEditor={setTextEditor}
          hiddenTextInputRef={hiddenTextInputRef}
          draftTextCanvasRef={draftTextCanvasRef}
          documentSize={documentSize}
          commitText={commitText}
          cancelText={cancelText}
        />

        {currentMousePos && ['brush', 'pencil', 'eraser', 'blur', 'sharpen', 'dodge', 'burn', 'healing', 'healing_brush', 'smudge', 'clone'].includes(activeTool) && (
          <div className="brush-cursor" style={{ left: currentMousePos.x / 2, top: currentMousePos.y / 2, width: brushSize / 2, height: brushSize / 2 }} />
        )}

        {cloneSource && activeTool === 'clone' && (
          <div className="source-cursor" style={{ position: 'absolute', left: cloneSource.x / 2, top: cloneSource.y / 2, width: '20px', height: '20px', border: '1px solid white', borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1000 }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '1px', background: 'white' }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, width: '1px', height: '100%', background: 'white' }} />
          </div>
        )}

        {(window as any)._healingSource && activeTool === 'healing_brush' && (
          <div className="source-cursor" style={{ position: 'absolute', left: (window as any)._healingSource.x / 2, top: (window as any)._healingSource.y / 2, width: '20px', height: '20px', border: '1px solid #00ff00', borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1000 }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '1px', background: '#00ff00' }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, width: '1px', height: '100%', background: '#00ff00' }} />
          </div>
        )}

        {/* Selection rendering is now handled globally via SVG mask inside the layer loop or at doc level */}


        {/* Other cursors and indicators */}
        <SVGFilters />
      </div>
    </div>
  );
};

export default Canvas;
