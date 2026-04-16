import { ChangeEvent, MouseEvent, PointerEvent, WheelEvent, useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ScaleCalibrationPanel } from '@/components/ScaleCalibrationPanel';
import { usePdfHandler } from '@/hooks/usePdfHandler';
import { useExportPdf } from '@/hooks/useExportPdf';
import { Point } from '@/types/pdf';
import {
  Ruler, Move, ZoomIn, ZoomOut, RotateCcw, Hand,
  Upload, ChevronLeft, ChevronRight, FileText,
  Crosshair, Trash2, X, LayoutGrid, Undo2, Check, Home,
  Type, Download, Palette, Receipt
} from 'lucide-react';

const TEXT_COLORS = [
  { label: 'Red', value: '#EF4444' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Green', value: '#22C55E' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Purple', value: '#A855F7' },
  { label: 'Black', value: '#1E293B' },
  { label: 'White', value: '#FFFFFF' },
];

export function PdfViewer() {
  const {
    pdfCanvasRef,
    annotationCanvasRef,
    pdf,
    currentPage,
    setCurrentPage,
    scale,
    setScale,
    measurements,
    setMeasurements,
    measurementUnit,
    setMeasurementUnit,
    tool,
    setTool,
    isSettingScale,
    pixelsPerUnit,
    measureStart,
    setMeasureStart,
    areaPoints,
    setAreaPoints,
    setCurrentMeasurement,
    loadPdf,
    calculateDistance,
    calculateArea,
    // Calibration
    scaleCalibration,
    calibrationPoints,
    setCalibrationPoints,
    setCalibrationPreviewPoint,
    setScaleFromPoints,
    setScaleFromPreset,
    resetScale,
    startCalibration,
    cancelCalibration,
    // Text annotations
    textAnnotations,
    editingTextId,
    setEditingTextId,
    addTextAnnotation,
    updateTextAnnotation,
    deleteTextAnnotation,
    pdfBytesRef,
  } = usePdfHandler();

  const { exportPdf } = useExportPdf();

  // Pan and Zoom
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [zoomDisplay, setZoomDisplay] = useState(100);
  const lastMousePos = useRef<Point | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Text style state
  const [textColor, setTextColor] = useState('#EF4444');
  const [textFontSize, setTextFontSize] = useState(16);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportPages, setSelectedExportPages] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Refs for real-time transform
  const scaleRef = useRef(1);
  const panRef = useRef<Point>({ x: 0, y: 0 });
  const rafId = useRef<number>(0);
  const isAnimating = useRef(false);

  const applyTransform = () => {
    if (!wrapperRef.current) return;
    const s = scaleRef.current;
    const p = panRef.current;
    wrapperRef.current.style.transform = `translate(${p.x}px, ${p.y}px) scale(${s})`;
  };

  const scheduleTransform = () => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    rafId.current = requestAnimationFrame(() => {
      applyTransform();
      isAnimating.current = false;
    });
  };

  // Spacebar for pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsDragging(false);
        lastMousePos.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    panRef.current = panOffset;
    applyTransform();
  }, [panOffset]);

  // Focus text input when editing — use rAF delay so pointer events settle first
  useEffect(() => {
    if (editingTextId && textInputRef.current) {
      const el = textInputRef.current;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.focus();
        });
      });
    }
  }, [editingTextId]);

  const handleUndo = () => {
    if (tool === 'calibrate' && isSettingScale) {
      if (calibrationPoints.length > 0) {
        setCalibrationPoints(calibrationPoints.slice(0, -1));
        setCalibrationPreviewPoint(null);
      }
    } else if (tool === 'measure') {
      if (measureStart) {
        setMeasureStart(null);
        setCurrentMeasurement([]);
      }
    } else if (tool === 'area') {
      if (areaPoints.length > 0) {
        const newPoints = areaPoints.slice(0, -1);
        setAreaPoints(newPoints);
        setCurrentMeasurement(newPoints);
      }
    }
  };

  const canUndo = (tool === 'calibrate' && isSettingScale && calibrationPoints.length > 0) ||
                  (tool === 'measure' && measureStart !== null) ||
                  (tool === 'area' && areaPoints.length > 0);

  const activeTool = isSpacePressed ? 'pan' : tool;
  const cursorStyle = activeTool === 'pan'
    ? (isDragging ? 'grabbing' : 'grab')
    : activeTool === 'text'
    ? 'text'
    : 'crosshair';

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadPdf(file);
      setFileName(file.name);
      panRef.current = { x: 0, y: 0 };
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const getCanvasPoint = (e: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>): Point | null => {
    if (!annotationCanvasRef.current) return null;
    const rect = annotationCanvasRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scaleX = annotationCanvasRef.current.width / rect.width;
    const scaleY = annotationCanvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // ------ Text annotation editing helpers ------

  const getEditingAnnotation = () => {
    if (!editingTextId) return null;
    const pageAnns = textAnnotations[currentPage] || [];
    return pageAnns.find(a => a.id === editingTextId) || null;
  };

  const commitTextEdit = useCallback(() => {
    if (!editingTextId) return;
    const ann = (textAnnotations[currentPage] || []).find(a => a.id === editingTextId);
    if (ann && !ann.text.trim()) {
      // Delete empty annotations when user explicitly commits
      deleteTextAnnotation(editingTextId);
    }
    setEditingTextId(null);
  }, [editingTextId, textAnnotations, currentPage, deleteTextAnnotation, setEditingTextId]);

  // Separate blur handler that does NOT delete empty annotations
  // (so the input doesn't vanish on accidental blur)
  const handleTextInputBlur = useCallback(() => {
    // Use a timeout so that if user is clicking back on the input
    // or on another part of the canvas, we don't prematurely commit
    setTimeout(() => {
      // Only commit if we're still in editing mode and the ref isn't focused
      if (editingTextId && textInputRef.current && document.activeElement !== textInputRef.current) {
        const ann = (textAnnotations[currentPage] || []).find(a => a.id === editingTextId);
        if (ann && !ann.text.trim()) {
          deleteTextAnnotation(editingTextId);
        }
        setEditingTextId(null);
      }
    }, 200);
  }, [editingTextId, textAnnotations, currentPage, deleteTextAnnotation, setEditingTextId]);

  const handleTextInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTextEdit();
    } else if (e.key === 'Escape') {
      // Delete if empty, otherwise just stop editing
      commitTextEdit();
    }
    e.stopPropagation();
  };

  // ------ Pointer handlers ------

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (activeTool === 'pan') {
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const point = getCanvasPoint(e);
    if (!point) return;

    // Text tool
    if (activeTool === 'text') {
      if (!pdf) return; // Require a loaded PDF

      // If currently editing, commit first
      if (editingTextId) {
        commitTextEdit();
      }

      // Check if clicking on an existing text annotation
      const pageAnns = textAnnotations[currentPage] || [];
      const clicked = pageAnns.find(ann => {
        const canvasEl = annotationCanvasRef.current;
        if (!canvasEl) return false;
        const ctx = canvasEl.getContext('2d');
        if (!ctx) return false;
        ctx.font = `bold ${ann.fontSize}px Arial`;
        const metrics = ctx.measureText(ann.text || 'Text');
        const padding = 4;
        return (
          point.x >= ann.x - padding &&
          point.x <= ann.x + metrics.width + padding &&
          point.y >= ann.y - padding &&
          point.y <= ann.y + ann.fontSize + padding
        );
      });

      if (clicked) {
        setEditingTextId(clicked.id);
      } else {
        const id = addTextAnnotation(currentPage, point.x, point.y);
        // Apply the currently selected color and font size
        updateTextAnnotation(id, { color: textColor, fontSize: textFontSize });
      }
      return;
    }

    // Calibration mode
    if (isSettingScale && tool === 'calibrate') {
      if (calibrationPoints.length === 0) {
        setCalibrationPoints([point]);
      } else if (calibrationPoints.length === 1) {
        setCalibrationPoints([calibrationPoints[0], point]);
        setCalibrationPreviewPoint(null);
      }
      return;
    }

    if (tool === 'measure') {
      if (!pixelsPerUnit) return;
      if (!measureStart) {
        setMeasureStart(point);
        setCurrentMeasurement([point]);
      } else {
        const newMeasurement = {
          id: Date.now().toString(),
          type: 'linear' as const,
          points: [measureStart, point],
          value: parseFloat(calculateDistance([measureStart, point]) || '0')
        };
        setMeasurements(prev => ({
          ...prev,
          [currentPage]: [...(prev[currentPage] || []), newMeasurement]
        }));
        setMeasureStart(null);
        setCurrentMeasurement([]);
      }
    } else if (tool === 'area') {
      if (!pixelsPerUnit) return;
      if (
        areaPoints.length > 2 &&
        Math.abs(point.x - areaPoints[0].x) < 10 / scale &&
        Math.abs(point.y - areaPoints[0].y) < 10 / scale
      ) {
        const newMeasurement = {
          id: Date.now().toString(),
          type: 'area' as const,
          points: areaPoints,
          value: parseFloat(calculateArea(areaPoints) || '0')
        };
        setMeasurements(prev => ({
          ...prev,
          [currentPage]: [...(prev[currentPage] || []), newMeasurement]
        }));
        setAreaPoints([]);
        setCurrentMeasurement([]);
      } else {
        const newPoints = [...areaPoints, point];
        setAreaPoints(newPoints);
        setCurrentMeasurement(newPoints);
      }
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (isDragging && activeTool === 'pan' && lastMousePos.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      panRef.current = {
        x: panRef.current.x + dx,
        y: panRef.current.y + dy
      };
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      scheduleTransform();
      return;
    }

    if (activeTool === 'pan' || activeTool === 'text') return;

    const point = getCanvasPoint(e);
    if (!point) return;

    if (isSettingScale && tool === 'calibrate' && calibrationPoints.length === 1) {
      setCalibrationPreviewPoint(point);
      return;
    }

    if (!pixelsPerUnit) return;

    if (!measureStart && areaPoints.length === 0) return;

    if (tool === 'measure' && measureStart) {
      setCurrentMeasurement([measureStart, point]);
    } else if (tool === 'area' && areaPoints.length > 0) {
      setCurrentMeasurement([...areaPoints, point]);
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      lastMousePos.current = null;
      setPanOffset({ ...panRef.current });
    }
  };

  const handlePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      lastMousePos.current = null;
      setPanOffset({ ...panRef.current });
    }
    setCalibrationPreviewPoint(null);
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = -e.deltaY;
    const zoomIntensity = 0.0015;
    const factor = Math.exp(delta * zoomIntensity);

    const prevScale = scaleRef.current;
    const newScale = Math.max(0.1, Math.min(10, prevScale * factor));

    if (newScale !== prevScale) {
      const ratio = newScale / prevScale;
      const distX = mouseX - panRef.current.x;
      const distY = mouseY - panRef.current.y;

      scaleRef.current = newScale;
      panRef.current = {
        x: mouseX - distX * ratio,
        y: mouseY - distY * ratio
      };

      scheduleTransform();
      setZoomDisplay(Math.round(newScale * 100));
      setScale(newScale);
      setPanOffset({ ...panRef.current });
    }
  };

  const zoomIn = () => {
    const prevScale = scaleRef.current;
    const newScale = Math.min(10, prevScale * 1.2);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const ratio = newScale / prevScale;
      scaleRef.current = newScale;
      panRef.current = {
        x: cx - (cx - panRef.current.x) * ratio,
        y: cy - (cy - panRef.current.y) * ratio
      };
      applyTransform();
    }
    setScale(newScale);
    setPanOffset({ ...panRef.current });
    setZoomDisplay(Math.round(newScale * 100));
  };

  const zoomOut = () => {
    const prevScale = scaleRef.current;
    const newScale = Math.max(0.1, prevScale / 1.2);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const ratio = newScale / prevScale;
      scaleRef.current = newScale;
      panRef.current = {
        x: cx - (cx - panRef.current.x) * ratio,
        y: cy - (cy - panRef.current.y) * ratio
      };
      applyTransform();
    }
    setScale(newScale);
    setPanOffset({ ...panRef.current });
    setZoomDisplay(Math.round(newScale * 100));
  };

  const resetZoom = () => {
    scaleRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    applyTransform();
    setScale(1);
    setPanOffset({ x: 0, y: 0 });
    setZoomDisplay(100);
  };

  const deleteMeasurement = (id: string) => {
    setMeasurements(prev => ({
      ...prev,
      [currentPage]: (prev[currentPage] || []).filter(m => m.id !== id)
    }));
  };

  // ------ Export handlers ------

  const openExportModal = () => {
    if (!pdf) return;
    const all = new Set<number>();
    for (let i = 1; i <= pdf.numPages; i++) all.add(i);
    setSelectedExportPages(all);
    setShowExportModal(true);
  };

  const toggleExportPage = (page: number) => {
    setSelectedExportPages(prev => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  };

  const toggleAllExportPages = () => {
    if (!pdf) return;
    if (selectedExportPages.size === pdf.numPages) {
      setSelectedExportPages(new Set());
    } else {
      const all = new Set<number>();
      for (let i = 1; i <= pdf.numPages; i++) all.add(i);
      setSelectedExportPages(all);
    }
  };

  const handleExport = async () => {
    if (!pdfBytesRef.current || selectedExportPages.size === 0) return;
    setIsExporting(true);
    try {
      const pages = Array.from(selectedExportPages).sort((a, b) => a - b);
      const exportName = fileName ? fileName.replace('.pdf', '-annotated.pdf') : 'export.pdf';
      await exportPdf(pdfBytesRef.current, textAnnotations, pages, exportName);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  // ------ Display data ------

  const pageMeasurements = measurements[currentPage] || [];
  const displayMeasurements = [...pageMeasurements];
  
  const isDrawingArea = tool === 'area' && areaPoints.length > 2;
  if (isDrawingArea) {
    displayMeasurements.push({
      id: 'preview-area',
      type: 'area' as const,
      points: areaPoints,
      value: parseFloat(calculateArea(areaPoints) || '0')
    });
  }

  const linearMeasurements = displayMeasurements.filter(m => m.type === 'linear' && m.id !== 'preview-area');
  const linearTotal = linearMeasurements.reduce((sum, m) => sum + m.value, 0);

  const pageTextAnns = textAnnotations[currentPage] || [];

  // Compute editing annotation screen position.
  // We compute the screen position from the canvas bounding rect 
  // so the input is rendered as a fixed-position overlay on the viewport.
  const editingAnn = getEditingAnnotation();
  let editingStyle: React.CSSProperties | null = null;
  if (editingAnn && annotationCanvasRef.current && annotationCanvasRef.current.width > 0) {
    const canvasRect = annotationCanvasRef.current.getBoundingClientRect();
    const viewportRect = containerRef.current?.getBoundingClientRect();
    if (canvasRect.width > 0 && viewportRect) {
      // Map canvas pixel coords to screen CSS coords
      const cssScaleX = canvasRect.width / annotationCanvasRef.current.width;
      const cssScaleY = canvasRect.height / annotationCanvasRef.current.height;
      const screenX = canvasRect.left - viewportRect.left + editingAnn.x * cssScaleX;
      const screenY = canvasRect.top - viewportRect.top + editingAnn.y * cssScaleY;
      const screenFontSize = Math.max(10, editingAnn.fontSize * cssScaleY);
      editingStyle = {
        position: 'absolute' as const,
        left: screenX,
        top: screenY,
        fontSize: screenFontSize,
        color: editingAnn.color,
        zIndex: 100,
      };
    }
  }

  return (
    <div className="pdf-viewer-layout">
      {/* ===== LEFT SIDEBAR ===== */}
      <div className="measurements-sidebar">
        <div className="sidebar-header">
          <h2>
            <div className="sidebar-header-icon">
              <Ruler className="w-4 h-4" />
            </div>
            Measurements
          </h2>
          <p className="sidebar-page-label">Page {currentPage}{pdf ? ` of ${pdf.numPages}` : ''}</p>
        </div>

        <div className="sidebar-body">
          {!pixelsPerUnit && (
            <div className="scale-warning-banner">
              <div className="scale-warning-icon">
                <Crosshair className="w-3.5 h-3.5" />
              </div>
              <span className="scale-warning-text">
                Set the scale in the toolbar to begin measuring your blueprints.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {displayMeasurements.map((m, i) => {
              const isPreview = m.id === 'preview-area';
              return (
              <div
                key={m.id}
                className={`measurement-card ${m.type === 'linear' ? 'measurement-card-linear' : 'measurement-card-area'} ${isPreview ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
              >
                <div className="measurement-card-header">
                  <span className="measurement-card-label">
                    <div className={m.type === 'linear' ? 'measurement-card-dot-linear' : 'measurement-card-dot-area'} />
                    {m.type === 'linear' ? 'Distance' : 'Area'} {isPreview ? '(Drawing)' : i + 1}
                  </span>
                  {isPreview ? (
                    <button
                      className="measurement-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newMeasurement = {
                          id: Date.now().toString(),
                          type: 'area' as const,
                          points: areaPoints,
                          value: parseFloat(calculateArea(areaPoints) || '0')
                        };
                        setMeasurements(prev => ({
                          ...prev,
                          [currentPage]: [...(prev[currentPage] || []), newMeasurement]
                        }));
                        setAreaPoints([]);
                        setCurrentMeasurement([]);
                      }}
                      title="Finish Shape"
                      style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)' }}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      className="measurement-delete-btn"
                      onClick={() => deleteMeasurement(m.id)}
                      title="Delete measurement"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="measurement-card-value">
                  {m.value}
                  <span className="measurement-card-unit">
                    {measurementUnit}{m.type === 'area' ? '²' : ''}
                  </span>
                </div>
              </div>
            )})}

            {displayMeasurements.length === 0 && pixelsPerUnit && pageTextAnns.length === 0 && (
              <div className="measurements-empty-state">
                <div className="measurements-empty-icon">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <span className="measurements-empty-text">
                  No measurements yet. Select a tool and click on the drawing.
                </span>
              </div>
            )}
          </div>

          {/* Totals */}
          {linearMeasurements.length > 1 && (
            <div className="measurement-total-card">
              <div className="measurement-total-label">Total Distance</div>
              <div className="measurement-total-value">
                {linearTotal.toFixed(2)} {measurementUnit}
              </div>
            </div>
          )}

          {/* Text Annotations List */}
          {pageTextAnns.length > 0 && (
            <div className="text-annotations-section">
              <div className="text-annotations-header">
                <Type className="w-3.5 h-3.5" />
                <span>Text Annotations</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {pageTextAnns.map((ann, i) => (
                  <div
                    key={ann.id}
                    className={`measurement-card text-annotation-card ${editingTextId === ann.id ? 'text-annotation-card-editing' : ''}`}
                    onClick={() => {
                      setTool('text');
                      setEditingTextId(ann.id);
                    }}
                  >
                    <div className="measurement-card-header">
                      <span className="measurement-card-label">
                        <div className="text-annotation-dot" />
                        Text {i + 1}
                      </span>
                      <button
                        className="measurement-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTextAnnotation(ann.id);
                        }}
                        title="Delete annotation"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-annotation-preview">
                      {ann.text || '(empty)'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== RIGHT CONTENT ===== */}
      <div className="pdf-viewer-main">
        {/* Toolbar */}
        <div className="pdf-toolbar">
         <div className="pdf-toolbar-inner">
          {/* Nav */}
          <div className="toolbar-section">
            <Link 
              href="/" 
              className="tool-btn flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors w-9 h-9 rounded-md" 
              title="Return to Home"
            >
              <Home className="w-4 h-4" />
            </Link>
          </div>
          <div className="toolbar-divider" />
          
          {/* Upload */}
          <div className="toolbar-section">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload" className="upload-btn">
              <Upload className="w-4 h-4" />
              {fileName ? 'Change PDF' : 'Open PDF'}
            </label>
            {fileName && (
              <span className="upload-btn-filename">
                <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                {fileName}
              </span>
            )}
          </div>

          <div className="toolbar-divider" />

          {/* Scale */}
          <div className="toolbar-section toolbar-section-grow">
            <ScaleCalibrationPanel
              isSettingScale={isSettingScale}
              scaleCalibration={scaleCalibration}
              calibrationPoints={calibrationPoints}
              pixelsPerUnit={pixelsPerUnit}
              measurementUnit={measurementUnit}
              scale={scale}
              onStartCalibration={startCalibration}
              onCancelCalibration={cancelCalibration}
              onSetScaleFromPoints={setScaleFromPoints}
              onSetScaleFromPreset={setScaleFromPreset}
              onResetScale={resetScale}
              onSetMeasurementUnit={setMeasurementUnit}
            />
          </div>

          <div className="toolbar-divider" />

          {/* Tools */}
          <div className="toolbar-section">
            <Button
              onClick={() => {
                if (isSettingScale) cancelCalibration();
                commitTextEdit();
                setTool('pan');
              }}
              variant="outline"
              size="sm"
              title="Pan (Spacebar)"
              className={`tool-btn ${tool === 'pan' && !isSettingScale ? 'tool-btn-active' : ''}`}
            >
              <Hand className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => {
                if (isSettingScale) cancelCalibration();
                commitTextEdit();
                setTool('measure');
              }}
              variant="outline"
              size="sm"
              disabled={!pixelsPerUnit}
              title={!pixelsPerUnit ? "Set scale first" : "Linear measurement"}
              className={`tool-btn ${tool === 'measure' && !isSettingScale ? 'tool-btn-active' : ''}`}
            >
              <Ruler className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => {
                if (isSettingScale) cancelCalibration();
                commitTextEdit();
                setTool('area');
              }}
              variant="outline"
              size="sm"
              disabled={!pixelsPerUnit}
              title={!pixelsPerUnit ? "Set scale first" : "Area measurement"}
              className={`tool-btn ${tool === 'area' && !isSettingScale ? 'tool-btn-active' : ''}`}
            >
              <Move className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => {
                if (isSettingScale) cancelCalibration();
                setTool('text');
              }}
              variant="outline"
              size="sm"
              title="Add text annotation"
              className={`tool-btn ${tool === 'text' && !isSettingScale ? 'tool-btn-active' : ''}`}
            >
              <Type className="w-4 h-4" />
            </Button>
            {/* Color picker for text tool */}
            {tool === 'text' && (
              <div className="color-picker-wrapper">
                <button
                  className="color-picker-trigger"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  title="Text color"
                >
                  <div className="color-picker-swatch" style={{ background: textColor }} />
                  <Palette className="w-3.5 h-3.5" />
                </button>
                {showColorPicker && (
                  <div className="color-picker-dropdown">
                    <div className="color-picker-label">Text Color</div>
                    <div className="color-picker-grid">
                      {TEXT_COLORS.map(c => (
                        <button
                          key={c.value}
                          className={`color-picker-option ${textColor === c.value ? 'color-picker-option-active' : ''}`}
                          style={{ background: c.value }}
                          onClick={() => {
                            setTextColor(c.value);
                            setShowColorPicker(false);
                          }}
                          title={c.label}
                        />
                      ))}
                    </div>
                    <div className="color-picker-custom">
                      <label className="color-picker-custom-label">Custom:</label>
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => {
                          setTextColor(e.target.value);
                        }}
                        className="color-picker-input"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Font size selector for text tool */}
            {tool === 'text' && (
              <div className="text-size-wrapper">
                <input
                  type="number"
                  className="text-size-input"
                  value={textFontSize}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(999, Number(e.target.value) || 16));
                    setTextFontSize(v);
                  }}
                  min={1}
                  max={999}
                  title="Text size (px)"
                />
                <span className="text-size-unit">px</span>
              </div>
            )}
            <div className="toolbar-divider" />
            <Button
              onClick={handleUndo}
              variant="outline"
              size="sm"
              disabled={!canUndo}
              title="Undo last point"
              className="tool-btn"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="toolbar-divider" />

          {/* Zoom */}
          <div className="toolbar-section">
            <div className="zoom-controls">
              <button onClick={zoomOut} className="zoom-btn" title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="zoom-label">{zoomDisplay}%</span>
              <button onClick={zoomIn} className="zoom-btn" title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={resetZoom} className="zoom-btn" title="Reset view">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Export & Quote */}
          {pdf && (
            <>
              <div className="toolbar-divider" />
              <div className="toolbar-section">
                <button
                  onClick={openExportModal}
                  className="export-btn"
                  title="Export PDF"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  onClick={() => {
                    const quoteData = {
                      measurements,
                      measurementUnit,
                      fileName: fileName,
                    };
                    localStorage.setItem('easyarch_quote_data', JSON.stringify(quoteData));
                    window.open('/quotes', '_blank');
                  }}
                  className="quote-toolbar-btn"
                  title="Create a quote from measurements"
                >
                  <Receipt className="w-4 h-4" />
                  Create Quote
                </button>
              </div>
            </>
          )}

          {pageMeasurements.length > 0 && (
            <>
              <div className="toolbar-divider" />
              <div className="toolbar-section">
                <Button
                  onClick={() => {
                    setMeasurements({});
                    setMeasureStart(null);
                    setAreaPoints([]);
                    setCurrentMeasurement([]);
                  }}
                  variant="outline"
                  size="sm"
                  title="Clear all measurements"
                  className="tool-btn"
                  style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </>
          )}

          {/* Page Navigation */}
          {pdf && (
            <div className="toolbar-section toolbar-section-right">
              <div className="page-nav">
                <button
                  onClick={() => {
                    commitTextEdit();
                    setCurrentPage(Math.max(1, currentPage - 1));
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  disabled={currentPage === 1}
                  className="page-nav-btn"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="page-indicator">
                  {currentPage} / {pdf.numPages}
                </span>
                <button
                  onClick={() => {
                    commitTextEdit();
                    setCurrentPage(Math.min(pdf.numPages, currentPage + 1));
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  disabled={currentPage === pdf.numPages}
                  className="page-nav-btn"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Canvas Area */}
        <div
          className="pdf-viewport"
          ref={containerRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{ cursor: cursorStyle }}
        >
          {!pdf && (
            <div className="canvas-empty-state">
              <div className="canvas-empty-icon">
                <FileText className="w-7 h-7" />
              </div>
              <span className="canvas-empty-text">No PDF loaded</span>
              <span className="canvas-empty-hint">Click &ldquo;Open PDF&rdquo; to get started</span>
            </div>
          )}
          <div
            ref={wrapperRef}
            className="pdf-canvas-wrapper"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
              display: pdf ? 'block' : 'none'
            }}
          >
            <canvas
              ref={pdfCanvasRef}
              className="pdf-canvas"
            />
            <canvas
              ref={annotationCanvasRef}
              className="pdf-annotation-canvas"
            />
          </div>

          {/* Floating text input for editing — rendered in the viewport, not inside the transformed wrapper */}
          {editingAnn && editingStyle && (
            <input
              ref={textInputRef}
              type="text"
              className="text-annotation-input"
              style={editingStyle}
              value={editingAnn.text}
              onChange={(e) => updateTextAnnotation(editingAnn.id, { text: e.target.value })}
              onKeyDown={handleTextInputKeyDown}
              onBlur={handleTextInputBlur}
              placeholder="Type here..."
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          )}
        </div>
      </div>

      {/* Calibration Toast */}
      {isSettingScale && tool === 'calibrate' && (
        <div className="calibration-toast">
          <div className="calibration-toast-icon">
            <Ruler className="w-3.5 h-3.5" />
          </div>
          {calibrationPoints.length === 0 && "Click the first endpoint of a known dimension"}
          {calibrationPoints.length === 1 && "Now click the second endpoint"}
          {calibrationPoints.length === 2 && "Enter the real-world distance above and confirm"}
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && pdf && (
        <div className="export-overlay" onClick={() => setShowExportModal(false)}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <div className="export-modal-header">
              <h3>
                <Download className="w-5 h-5" />
                Export PDF
              </h3>
              <button className="export-modal-close" onClick={() => setShowExportModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="export-modal-body">
              <p className="export-modal-subtitle">
                Select which pages to include in the exported PDF. Text annotations will be embedded.
              </p>

              <div className="export-select-all">
                <label className="export-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedExportPages.size === pdf.numPages}
                    onChange={toggleAllExportPages}
                    className="export-checkbox"
                  />
                  <span>Select All ({pdf.numPages} pages)</span>
                </label>
              </div>

              <div className="export-page-grid">
                {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map(page => {
                  const hasText = (textAnnotations[page] || []).length > 0;
                  const hasMeasurements = (measurements[page] || []).length > 0;
                  return (
                    <label
                      key={page}
                      className={`export-page-card ${selectedExportPages.has(page) ? 'export-page-card-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedExportPages.has(page)}
                        onChange={() => toggleExportPage(page)}
                        className="export-checkbox"
                      />
                      <div className="export-page-info">
                        <span className="export-page-number">Page {page}</span>
                        <div className="export-page-badges">
                          {hasText && <span className="export-badge export-badge-text">Text</span>}
                          {hasMeasurements && <span className="export-badge export-badge-measure">Measures</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="export-modal-footer">
              <button className="export-cancel-btn" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button
                className="export-confirm-btn"
                onClick={handleExport}
                disabled={selectedExportPages.size === 0 || isExporting}
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Exporting...' : `Export ${selectedExportPages.size} Page${selectedExportPages.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}