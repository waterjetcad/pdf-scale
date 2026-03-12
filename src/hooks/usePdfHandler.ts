import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  PageMeasurements,
  Point,
  MeasurementUnit,
  Tool,
  ScaleCalibration,
  ArchitecturalScale,
} from '@/types/pdf';

// We render the pdf canvas internally at a higher resolution (e.g. 2.0)
// and let CSS handle the visual zooming. This guarantees coordinates don't map to
// a shifting underlying canvas size causing annotations to move.
const BASE_RENDER_SCALE = 2.0;

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PDF_DPI = 72; // Standard PDF DPI

export const usePdfHandler = () => {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [measurements, setMeasurements] = useState<PageMeasurements>({});
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>('ft');
  const [tool, setTool] = useState<Tool>('measure');
  const [isSettingScale, setIsSettingScale] = useState(false);
  const [scaleReference, setScaleReference] = useState<Point | null>(null);
  const [pixelsPerUnit, setPixelsPerUnit] = useState<number | null>(null);
  const [actualLength, setActualLength] = useState('');
  const [measureStart, setMeasureStart] = useState<Point | null>(null);
  const [areaPoints, setAreaPoints] = useState<Point[]>([]);
  const [currentMeasurement, setCurrentMeasurement] = useState<Point[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Scale calibration state
  const [scaleCalibration, setScaleCalibration] = useState<ScaleCalibration | null>(null);
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [calibrationPreviewPoint, setCalibrationPreviewPoint] = useState<Point | null>(null);

  const loadPdf = useCallback(async (file: File) => {
    const fileReader = new FileReader();
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(this.result as ArrayBuffer);
      const loadedPdf = await pdfjsLib.getDocument(typedarray).promise;
      setPdf(loadedPdf);
      setMeasurements({});
      setCurrentPage(1);
    };
    fileReader.readAsArrayBuffer(file);
  }, []);

  const renderPdfPage = useCallback(async () => {
    if (!pdf || !pdfCanvasRef.current) return;

    const page = await pdf.getPage(currentPage);
    const canvas = pdfCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Use our fixed render scale rather than the dynamic UI scale
    const viewport = page.getViewport({ scale: BASE_RENDER_SCALE });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Ensure the annotation canvas matches exact pixel dimensions
    if (annotationCanvasRef.current) {
      annotationCanvasRef.current.width = viewport.width;
      annotationCanvasRef.current.height = viewport.height;
      setCanvasSize({ width: viewport.width, height: viewport.height });
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
  }, [pdf, currentPage]); // Remove `scale` dependency here!

  const calculateDistance = useCallback((points: Point[]) => {
    if (points.length !== 2 || !pixelsPerUnit) return null;
    const [p1, p2] = points;
    const pixels = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    return (pixels / pixelsPerUnit).toFixed(2);
  }, [pixelsPerUnit]);

  const calculateArea = useCallback((points: Point[]) => {
    if (points.length < 3 || !pixelsPerUnit) return null;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    area = Math.abs(area) / 2;
    return ((area / Math.pow(pixelsPerUnit, 2))).toFixed(2);
  }, [pixelsPerUnit]);

  // --- Scale Calibration Methods ---

  const setScaleFromPoints = useCallback((p1: Point, p2: Point, realDistance: number, unit: MeasurementUnit) => {
    const pixelDist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    const ppu = pixelDist / realDistance;

    setPixelsPerUnit(ppu);
    setScaleCalibration({
      points: [p1, p2],
      pixelDistance: pixelDist,
      realDistance,
      unit,
      label: `${realDistance} ${unit} = ${Math.round(pixelDist)}px`,
      pixelsPerUnit: ppu,
    });
    setMeasurementUnit(unit);
  }, []);

  const setScaleFromPreset = useCallback((preset: ArchitecturalScale) => {
    // Architectural scales: ratio = inches on paper per foot in real life
    // PDF is 72 DPI, so 1 inch on paper = 72 pixels.
    // We render at BASE_RENDER_SCALE, so 1 inch on paper = 72 * BASE_RENDER_SCALE pixels.
    
    // pixelsPerUnit (pixels per foot) = ratio * 72 * BASE_RENDER_SCALE
    const ppu = preset.ratio * PDF_DPI * BASE_RENDER_SCALE;

    setPixelsPerUnit(ppu);
    setMeasurementUnit('ft');
    setScaleCalibration({
      points: null,
      pixelDistance: 0,
      realDistance: 0,
      unit: 'ft',
      label: preset.label,
      pixelsPerUnit: ppu,
    });
  }, []); // scale is removed from dependencies 

  const resetScale = useCallback(() => {
    setPixelsPerUnit(null);
    setScaleCalibration(null);
    setCalibrationPoints([]);
    setCalibrationPreviewPoint(null);
    setIsSettingScale(false);
    setScaleReference(null);
    setActualLength('');
  }, []);

  const startCalibration = useCallback(() => {
    setTool('calibrate');
    setIsSettingScale(true);
    setCalibrationPoints([]);
    setCalibrationPreviewPoint(null);
    setScaleReference(null);
  }, []);

  const cancelCalibration = useCallback(() => {
    setCalibrationPoints([]);
    setCalibrationPreviewPoint(null);
    setIsSettingScale(false);
    setScaleReference(null);
    setTool('measure');
  }, []);

  // --- Drawing ---

  const drawCalibrationLine = useCallback((context: CanvasRenderingContext2D, points: Point[], isPreview = false) => {
    if (points.length < 1) return;

    context.save();
    context.setLineDash([8, 4]);
    context.strokeStyle = isPreview ? '#3B82F680' : '#3B82F6';
    context.lineWidth = 2.5;

    // Draw line
    if (points.length >= 2) {
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      context.lineTo(points[1].x, points[1].y);
      context.stroke();
    }

    // Draw endpoint markers
    context.setLineDash([]);
    points.forEach((point) => {
      // Outer circle
      context.beginPath();
      context.arc(point.x, point.y, 7, 0, Math.PI * 2);
      context.fillStyle = 'rgba(59, 130, 246, 0.15)';
      context.fill();
      context.strokeStyle = '#3B82F6';
      context.lineWidth = 2;
      context.stroke();

      // Inner dot
      context.beginPath();
      context.arc(point.x, point.y, 3, 0, Math.PI * 2);
      context.fillStyle = '#3B82F6';
      context.fill();

      // Crosshair
      context.strokeStyle = '#3B82F680';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(point.x - 12, point.y);
      context.lineTo(point.x + 12, point.y);
      context.stroke();
      context.beginPath();
      context.moveTo(point.x, point.y - 12);
      context.lineTo(point.x, point.y + 12);
      context.stroke();
    });

    // Draw pixel distance label
    if (points.length === 2) {
      const pixelDist = Math.sqrt(
        Math.pow(points[1].x - points[0].x, 2) + Math.pow(points[1].y - points[0].y, 2)
      );
      const midX = (points[0].x + points[1].x) / 2;
      const midY = (points[0].y + points[1].y) / 2;

      context.font = 'bold 13px Arial';
      const text = `${Math.round(pixelDist)} px`;
      const textMetrics = context.measureText(text);
      const padding = 4;

      // Background
      context.fillStyle = 'rgba(59, 130, 246, 0.9)';
      const bgX = midX - textMetrics.width / 2 - padding;
      const bgY = midY - 20;
      const bgW = textMetrics.width + padding * 2;
      const bgH = 20;
      context.beginPath();
      context.roundRect(bgX, bgY, bgW, bgH, 4);
      context.fill();

      // Text
      context.fillStyle = '#FFFFFF';
      context.textAlign = 'center';
      context.fillText(text, midX, midY - 7);
    }

    context.restore();
  }, []);

  const drawMeasurement = useCallback((points: Point[], isPreview = false, type: 'linear' | 'area' = 'linear') => {
    if (!annotationCanvasRef.current) return;
    const context = annotationCanvasRef.current.getContext('2d');
    if (!context) return;

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    points.forEach((point, i) => {
      if (i > 0) context.lineTo(point.x, point.y);
    });

    if (type === 'area' && !isPreview) {
      context.closePath();
    }

    context.strokeStyle = type === 'linear' ? 
      (isPreview ? '#FF000080' : '#FF0000') : 
      (isPreview ? '#0000FF80' : '#0000FF');
    context.lineWidth = 2;
    context.stroke();

    if (pixelsPerUnit) {
      const value = type === 'linear' ? calculateDistance(points) : calculateArea(points);
      if (value) {
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        context.font = '14px Arial';
        context.fillStyle = type === 'linear' ? 
          (isPreview ? '#FF000080' : '#FF0000') : 
          (isPreview ? '#0000FF80' : '#0000FF');
        context.fillText(
          `${value} ${measurementUnit}${type === 'area' ? '²' : ''}`, 
          centerX, 
          centerY
        );
      }
    }
  }, [calculateArea, calculateDistance, measurementUnit, pixelsPerUnit]);

  const renderAnnotations = useCallback(() => {
    if (!annotationCanvasRef.current) return;
    const context = annotationCanvasRef.current.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw completed measurements
    const pageMeasurements = measurements[currentPage] || [];
    pageMeasurements.forEach(m => {
      drawMeasurement(m.points, false, m.type);
    });

    // Draw current measurement preview
    if (currentMeasurement.length > 0) {
      drawMeasurement(currentMeasurement, true, tool as 'area' | 'linear');
    }

    // Draw calibration reference line (persisted)
    if (scaleCalibration?.points) {
      drawCalibrationLine(context, scaleCalibration.points, false);
    }

    // Draw calibration preview (while calibrating)
    if (isSettingScale && calibrationPoints.length > 0) {
      const previewPoints = calibrationPreviewPoint
        ? [...calibrationPoints, calibrationPreviewPoint]
        : calibrationPoints;
      drawCalibrationLine(context, previewPoints, true);
    }
  }, [
    measurements, currentPage, currentMeasurement, tool, canvasSize,
    drawMeasurement, drawCalibrationLine, scaleCalibration,
    isSettingScale, calibrationPoints, calibrationPreviewPoint
  ]);

  useEffect(() => {
    if (pdf) {
      renderPdfPage();
    }
  }, [pdf, renderPdfPage]);

  useEffect(() => {
    if (canvasSize.width && canvasSize.height) {
      renderAnnotations();
    }
  }, [canvasSize, renderAnnotations]);

  return {
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
    setIsSettingScale,
    scaleReference,
    setScaleReference,
    pixelsPerUnit,
    setPixelsPerUnit,
    actualLength,
    setActualLength,
    measureStart,
    setMeasureStart,
    areaPoints,
    setAreaPoints,
    currentMeasurement,
    setCurrentMeasurement,
    loadPdf,
    calculateDistance,
    calculateArea,
    renderAnnotations,
    // New calibration exports
    scaleCalibration,
    setScaleCalibration,
    calibrationPoints,
    setCalibrationPoints,
    calibrationPreviewPoint,
    setCalibrationPreviewPoint,
    setScaleFromPoints,
    setScaleFromPreset,
    resetScale,
    startCalibration,
    cancelCalibration,
  };
};