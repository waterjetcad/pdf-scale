import { ChangeEvent, MouseEvent, PointerEvent, WheelEvent, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScaleCalibrationPanel } from '@/components/ScaleCalibrationPanel';
import { usePdfHandler } from '@/hooks/usePdfHandler';
import { Point } from '@/types/pdf';
import {
  Ruler, Move, ZoomIn, ZoomOut, RotateCcw, Hand,
  Upload, ChevronLeft, ChevronRight, FileText,
  Crosshair, Trash2, X, LayoutGrid, Undo2, Check
} from 'lucide-react';

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
  } = usePdfHandler();

  // Pan and Zoom — use refs for real-time transform to avoid React re-render jank
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [zoomDisplay, setZoomDisplay] = useState(100); // display-only zoom %
  const lastMousePos = useRef<Point | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Refs that hold the "live" transform values — written synchronously, no re-render
  const scaleRef = useRef(1);
  const panRef = useRef<Point>({ x: 0, y: 0 });
  const rafId = useRef<number>(0);
  const isAnimating = useRef(false);

  /** Push the current ref values into the DOM in one rAF pass */
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

  // Handle Spacebar for temporary pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
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

  // Keep React state in sync for things that need it (annotation canvas, clamp checks)
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    panRef.current = panOffset;
    applyTransform();
  }, [panOffset]);

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
    const scaleX = annotationCanvasRef.current.width / rect.width;
    const scaleY = annotationCanvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (activeTool === 'pan') {
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const point = getCanvasPoint(e);
    if (!point) return;

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
      // Update ref directly for instant feedback
      panRef.current = {
        x: panRef.current.x + dx,
        y: panRef.current.y + dy
      };
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      scheduleTransform();
      return;
    }

    if (activeTool === 'pan') return;

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
      // Sync React state with the ref so subsequent renders are correct
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

    // Smoother zoom factor — use deltaY magnitude for proportional zoom
    const delta = -e.deltaY;
    const zoomIntensity = 0.0015;
    const factor = Math.exp(delta * zoomIntensity);

    const prevScale = scaleRef.current;
    const newScale = Math.max(0.1, Math.min(10, prevScale * factor));

    if (newScale !== prevScale) {
      const ratio = newScale / prevScale;
      const distX = mouseX - panRef.current.x;
      const distY = mouseY - panRef.current.y;

      // Update refs directly — no React re-render needed
      scaleRef.current = newScale;
      panRef.current = {
        x: mouseX - distX * ratio,
        y: mouseY - distY * ratio
      };

      scheduleTransform();

      // Debounce the React state sync so the zoom % label updates smoothly
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
                        // Finish shape
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

            {displayMeasurements.length === 0 && pixelsPerUnit && (
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
        </div>
      </div>

      {/* ===== RIGHT CONTENT ===== */}
      <div className="pdf-viewer-main">
        {/* Toolbar */}
        <div className="pdf-toolbar">
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
    </div>
  );
}