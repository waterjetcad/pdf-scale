import { ChangeEvent, MouseEvent, WheelEvent, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScaleCalibrationPanel } from '@/components/ScaleCalibrationPanel';
import { usePdfHandler } from '@/hooks/usePdfHandler';
import { Point } from '@/types/pdf';
import { Ruler, Move, ZoomIn, ZoomOut, RotateCcw, Hand } from 'lucide-react';

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

  // Pan and Zoom State
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const lastMousePos = useRef<Point | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle Spacebar for temporary pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
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
    };
  }, []);

  const activeTool = isSpacePressed ? 'pan' : tool;
  const cursorStyle = activeTool === 'pan' 
    ? (isDragging ? 'grabbing' : 'grab') 
    : 'crosshair';

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadPdf(file);
      // Reset pan/zoom on new file
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const getCanvasPoint = (e: MouseEvent<HTMLCanvasElement>): Point | null => {
    if (!annotationCanvasRef.current) return null;
    const rect = annotationCanvasRef.current.getBoundingClientRect();
    
    // The CSS transform: scale() is applied to the wrapper, which scales the bounding rect.
    // So (clientX - rect.left) gives us the distance in SCREEN pixels from the left edge of the scaled canvas.
    // To get back to the internal (unscaled) canvas coordinates, we just multiply by (internal width / screen width)
    const scaleX = annotationCanvasRef.current.width / rect.width;
    const scaleY = annotationCanvasRef.current.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'pan') {
      setIsDragging(true);
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

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && activeTool === 'pan' && lastMousePos.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (activeTool === 'pan') return;

    const point = getCanvasPoint(e);
    if (!point) return;

    // Calibration preview
    if (isSettingScale && tool === 'calibrate' && calibrationPoints.length === 1) {
      setCalibrationPreviewPoint(point);
      return;
    }

    if (!measureStart && areaPoints.length === 0) return;

    if (tool === 'measure' && measureStart) {
      setCurrentMeasurement([measureStart, point]);
    } else if (tool === 'area' && areaPoints.length > 0) {
      setCurrentMeasurement([...areaPoints, point]);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      lastMousePos.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      lastMousePos.current = null;
    }
    setCalibrationPreviewPoint(null);
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    // Zoom on Ctrl+Wheel or plain Wheel (depending on preference, we'll allow plain wheel for zooming now
    // since panning is handled via dragging. This makes it feel like Google Maps).
    e.preventDefault();

    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    
    // Mouse position relative to the container viewport
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom delta
    const zoomFactor = 1.1;
    const isZoomIn = e.deltaY < 0;
    
    setScale(prevScale => {
      const newScale = isZoomIn ? prevScale * zoomFactor : prevScale / zoomFactor;
      // Clamp scale between 0.1 and 10
      const clampedScale = Math.max(0.1, Math.min(10, newScale));
      
      if (clampedScale !== prevScale) {
        // We want the point under the mouse to stay in the exact same screen position.
        // Current distance from mouse to the transformed origin:
        const distX = mouseX - panOffset.x;
        const distY = mouseY - panOffset.y;
        
        // When scale changes, that distance is multiplied by (newScale / prevScale)
        const ratio = clampedScale / prevScale;
        const newDistX = distX * ratio;
        const newDistY = distY * ratio;
        
        // The new offset ensures mouseX = newOffset + newDist
        setPanOffset({
          x: mouseX - newDistX,
          y: mouseY - newDistY
        });
      }

      return clampedScale;
    });
  };

  const zoomIn = () => {
    setScale(prev => Math.min(10, prev * 1.2));
    // When zooming via buttons, zoom towards center
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const distX = centerX - panOffset.x;
      const distY = centerY - panOffset.y;
      setPanOffset({
        x: centerX - distX * 1.2,
        y: centerY - distY * 1.2
      });
    }
  };

  const zoomOut = () => {
    setScale(prev => Math.max(0.1, prev / 1.2));
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const distX = centerX - panOffset.x;
      const distY = centerY - panOffset.y;
      setPanOffset({
        x: centerX - distX / 1.2,
        y: centerY - distY / 1.2
      });
    }
  };

  const resetZoom = () => {
    setScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div className="pdf-viewer-layout">
      {/* LEFT SIDEBAR: Measurements Panel */}
      <div className="measurements-sidebar flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Ruler className="w-5 h-5 text-blue-600" />
            Measurements
          </h2>
          <p className="text-sm text-gray-500 mt-1">Page {currentPage}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {!pixelsPerUnit && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-sm text-yellow-800">
                Set the scale first to begin measuring blueprints.
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            {(measurements[currentPage] || []).map((m, i) => (
              <div
                key={m.id}
                className="bg-white border border-gray-200 rounded-md p-3 shadow-sm"
              >
                {m.type === 'linear' ? (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <div className="w-3 h-0.5 bg-blue-500 rounded-full" />
                      Distance {i + 1}
                    </span>
                    <strong className="text-sm text-gray-900">{m.value} {measurementUnit}</strong>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <div className="w-3 h-3 bg-indigo-500/20 border border-indigo-500 rounded-sm" />
                      Area {i + 1}
                    </span>
                    <strong className="text-sm text-gray-900">{m.value} {measurementUnit}²</strong>
                  </div>
                )}
              </div>
            ))}
            
            {(measurements[currentPage] || []).length === 0 && pixelsPerUnit && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">No measurements yet. Select a tool and click on the drawing.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT CONTENT: Toolbars and PDF Canvas */}
      <div className="pdf-viewer-main flex-col">
        {/* Top Toolbar */}
        <div className="pdf-toolbar">
        {/* File Upload */}
        <div className="toolbar-section">
          <Input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="toolbar-file-input"
          />
        </div>

        {/* Scale Calibration */}
        <div className="toolbar-section toolbar-section-grow">
          <ScaleCalibrationPanel
            isSettingScale={isSettingScale}
            scaleCalibration={scaleCalibration}
            calibrationPoints={calibrationPoints}
            pixelsPerUnit={pixelsPerUnit}
            measurementUnit={measurementUnit}
            scale={scale} // Need to pass scale to resolve preset values properly
            onStartCalibration={startCalibration}
            onCancelCalibration={cancelCalibration}
            onSetScaleFromPoints={setScaleFromPoints}
            onSetScaleFromPreset={setScaleFromPreset}
            onResetScale={resetScale}
            onSetMeasurementUnit={setMeasurementUnit}
          />
        </div>
      </div>

      {/* Secondary Toolbar */}
      <div className="pdf-toolbar-secondary">
        {/* Navigation / Panning */}
        <div className="toolbar-section">
          <Button
            onClick={() => {
              if (isSettingScale) cancelCalibration();
              setTool('pan');
            }}
            variant={tool === 'pan' && !isSettingScale ? "default" : "outline"}
            size="sm"
            title="Pan Document (Spacebar)"
            className="tool-btn"
          >
            <Hand className="w-4 h-4 mr-1.5" />
            Pan
          </Button>
        </div>
        
        <div className="toolbar-divider" />

        {/* Measurement Tools */}
        <div className="toolbar-section">
          <Button
            onClick={() => {
              if (isSettingScale) cancelCalibration();
              setTool('measure');
            }}
            variant={tool === 'measure' && !isSettingScale ? "default" : "outline"}
            size="sm"
            disabled={!pixelsPerUnit}
            title={!pixelsPerUnit ? "Set scale first" : "Linear measurement"}
            className="tool-btn"
          >
            <Ruler className="w-4 h-4 mr-1.5" />
            Measure
          </Button>
          <Button
            onClick={() => {
              if (isSettingScale) cancelCalibration();
              setTool('area');
            }}
            variant={tool === 'area' && !isSettingScale ? "default" : "outline"}
            size="sm"
            disabled={!pixelsPerUnit}
            title={!pixelsPerUnit ? "Set scale first" : "Area measurement"}
            className="tool-btn"
          >
            <Move className="w-4 h-4 mr-1.5" />
            Area
          </Button>
          <Button
            onClick={() => {
              setMeasurements({});
              setMeasureStart(null);
              setAreaPoints([]);
              setCurrentMeasurement([]);
            }}
            variant="destructive"
            size="sm"
          >
            Clear All
          </Button>
        </div>

        <div className="toolbar-divider" />

        {/* Zoom Controls */}
        <div className="toolbar-section">
          <div className="zoom-controls">
            <Button onClick={zoomOut} variant="outline" size="sm" title="Zoom out">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="zoom-label">{Math.round(scale * 100)}%</span>
            <Button onClick={zoomIn} variant="outline" size="sm" title="Zoom in">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button onClick={resetZoom} variant="ghost" size="sm" title="Reset zoom/pan">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Page Navigation */}
        {pdf && (
          <div className="toolbar-section toolbar-section-right">
            <Button
              onClick={() => {
                setCurrentPage(Math.max(1, currentPage - 1));
                setPanOffset({ x: 0, y: 0 }); // reset pan on page change
              }}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            <span className="page-indicator">
              Page {currentPage} of {pdf.numPages}
            </span>
            <Button
              onClick={() => {
                setCurrentPage(Math.min(pdf.numPages, currentPage + 1));
                setPanOffset({ x: 0, y: 0 }); // reset pan on page change
              }}
              disabled={currentPage === pdf.numPages}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Canvas Area */}
      <div
        className="pdf-viewport"
        ref={containerRef}
        onWheel={handleWheel}
      >
        <div 
          className="pdf-canvas-wrapper"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
            cursor: cursorStyle
          }}
        >
          <canvas
            ref={pdfCanvasRef}
            className="pdf-canvas"
          />
          <canvas
            ref={annotationCanvasRef}
            className="pdf-annotation-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
        </div>
      </div>

      </div>

      {/* Calibration Toast */}
      {isSettingScale && tool === 'calibrate' && (
        <div className="calibration-toast">
          <Ruler className="w-4 h-4" />
          {calibrationPoints.length === 0 && "Click the first endpoint of a known dimension on your drawing"}
          {calibrationPoints.length === 1 && "Now click the second endpoint"}
          {calibrationPoints.length === 2 && "Enter the real-world distance above and confirm"}
        </div>
      )}
    </div>
  );
}