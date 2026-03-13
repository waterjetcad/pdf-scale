import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MeasurementUnit,
  ScaleCalibration,
  ARCHITECTURAL_SCALES,
  Point,
} from '@/types/pdf';
import { Ruler, RotateCcw, Crosshair, Check, X } from 'lucide-react';

interface ScaleCalibrationPanelProps {
  isSettingScale: boolean;
  scaleCalibration: ScaleCalibration | null;
  calibrationPoints: Point[];
  pixelsPerUnit: number | null;
  measurementUnit: MeasurementUnit;
  scale: number;
  onStartCalibration: () => void;
  onCancelCalibration: () => void;
  onSetScaleFromPoints: (p1: Point, p2: Point, realDistance: number, unit: MeasurementUnit) => void;
  onSetScaleFromPreset: (preset: typeof ARCHITECTURAL_SCALES[number]) => void;
  onResetScale: () => void;
  onSetMeasurementUnit: (unit: MeasurementUnit) => void;
}

const archScales = ARCHITECTURAL_SCALES.filter(s => s.group === 'architectural');
const engScales = ARCHITECTURAL_SCALES.filter(s => s.group === 'engineering');
const metricScales = ARCHITECTURAL_SCALES.filter(s => s.group === 'metric');

export function ScaleCalibrationPanel({
  isSettingScale,
  scaleCalibration,
  calibrationPoints,
  measurementUnit,
  onStartCalibration,
  onCancelCalibration,
  onSetScaleFromPoints,
  onSetScaleFromPreset,
  onResetScale,
  onSetMeasurementUnit,
}: ScaleCalibrationPanelProps) {
  const [calibrationDistance, setCalibrationDistance] = useState('');
  const [calibrationUnit, setCalibrationUnit] = useState<MeasurementUnit>('ft');
  const [calibrationMethod, setCalibrationMethod] = useState<'points' | 'preset'>('points');

  const handleConfirmCalibration = () => {
    if (calibrationPoints.length === 2 && calibrationDistance) {
      const dist = parseFloat(calibrationDistance);
      if (dist > 0) {
        onSetScaleFromPoints(calibrationPoints[0], calibrationPoints[1], dist, calibrationUnit);
        onSetMeasurementUnit(calibrationUnit);
        setCalibrationDistance('');
      }
    }
  };

  const handlePresetSelect = (label: string) => {
    const preset = ARCHITECTURAL_SCALES.find(s => s.label === label);
    if (preset) {
      onSetScaleFromPreset(preset);
    }
  };

  return (
    <div className="scale-calibration-panel">
      {/* Scale Status Badge */}
      {scaleCalibration && !isSettingScale && (
        <div className="scale-badge">
          <div className="scale-badge-icon">
            <Ruler className="w-3.5 h-3.5" />
          </div>
          <div className="scale-badge-info">
            <span className="scale-badge-label">Scale</span>
            <span className="scale-badge-value">{scaleCalibration.label}</span>
          </div>
          <button
            className="scale-badge-reset"
            onClick={onResetScale}
            title="Reset scale"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* No Scale Set */}
      {!scaleCalibration && !isSettingScale && (
        <div className="scale-not-set">
          <div className="scale-not-set-content">
            <Crosshair className="w-4 h-4 text-amber-500" />
            <span className="scale-not-set-text">No scale set</span>
          </div>
          <div className="scale-actions">
            <Button
              onClick={() => {
                setCalibrationMethod('points');
                onStartCalibration();
              }}
              variant="outline"
              size="sm"
              className="scale-btn-calibrate"
            >
              <Crosshair className="w-3.5 h-3.5 mr-1.5" />
              Two-Point
            </Button>
            <span className="scale-divider">or</span>
            <Select onValueChange={handlePresetSelect}>
              <SelectTrigger className="scale-preset-trigger">
                <SelectValue placeholder="Use Preset" />
              </SelectTrigger>
              <SelectContent>
                <div style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Architectural
                </div>
                {archScales.map((s) => (
                  <SelectItem key={s.label} value={s.label}>
                    {s.label}
                  </SelectItem>
                ))}
                <div style={{ padding: '8px 8px 4px', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: '1px solid #e2e8f0', marginTop: '4px' }}>
                  Engineering / Civil
                </div>
                {engScales.map((s) => (
                  <SelectItem key={s.label} value={s.label}>
                    {s.label}
                  </SelectItem>
                ))}
                <div style={{ padding: '8px 8px 4px', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: '1px solid #e2e8f0', marginTop: '4px' }}>
                  Metric
                </div>
                {metricScales.map((s) => (
                  <SelectItem key={s.label} value={s.label}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Calibration In Progress */}
      {isSettingScale && calibrationMethod === 'points' && (
        <div className="scale-calibrating">
          <div className="calibrating-header">
            <Crosshair className="w-4 h-4 text-blue-500 animate-pulse" />
            <span className="calibrating-title">Scale Calibration</span>
          </div>
          
          <div className="calibrating-steps">
            <div className={`calibrating-step ${calibrationPoints.length >= 1 ? 'completed' : 'active'}`}>
              <div className="step-marker">
                {calibrationPoints.length >= 1 ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <span>1</span>
                )}
              </div>
              <span>Click first point on a known dimension</span>
            </div>
            <div className={`calibrating-step ${calibrationPoints.length >= 2 ? 'completed' : calibrationPoints.length === 1 ? 'active' : ''}`}>
              <div className="step-marker">
                {calibrationPoints.length >= 2 ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <span>2</span>
                )}
              </div>
              <span>Click second point</span>
            </div>
            <div className={`calibrating-step ${calibrationPoints.length === 2 && calibrationDistance ? 'active' : ''}`}>
              <div className="step-marker"><span>3</span></div>
              <span>Enter the real-world distance</span>
            </div>
          </div>

          {calibrationPoints.length === 2 && (
            <div className="calibrating-input-row">
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="Distance"
                value={calibrationDistance}
                onChange={(e) => setCalibrationDistance(e.target.value)}
                className="calibrating-distance-input"
                autoFocus
              />
              <Select
                value={calibrationUnit}
                onValueChange={(value) => setCalibrationUnit(value as MeasurementUnit)}
              >
                <SelectTrigger className="calibrating-unit-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ft">Feet</SelectItem>
                  <SelectItem value="in">Inches</SelectItem>
                  <SelectItem value="yd">Yards</SelectItem>
                  <SelectItem value="m">Meters</SelectItem>
                  <SelectItem value="cm">cm</SelectItem>
                  <SelectItem value="mm">mm</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleConfirmCalibration}
                disabled={!calibrationDistance || parseFloat(calibrationDistance) <= 0}
                size="sm"
                className="calibrating-confirm-btn"
              >
                <Check className="w-4 h-4" />
              </Button>
            </div>
          )}

          <Button
            onClick={onCancelCalibration}
            variant="ghost"
            size="sm"
            className="calibrating-cancel-btn"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Cancel
          </Button>
        </div>
      )}

      {/* Unit Selector (shown when scale is calibrated) */}
      {scaleCalibration && !isSettingScale && (
        <div className="scale-unit-row">
          <span className="scale-unit-label">Unit:</span>
          <Select
            value={measurementUnit}
            onValueChange={(value) => onSetMeasurementUnit(value as MeasurementUnit)}
          >
            <SelectTrigger className="scale-unit-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ft">Feet</SelectItem>
              <SelectItem value="in">Inches</SelectItem>
              <SelectItem value="yd">Yards</SelectItem>
              <SelectItem value="m">Meters</SelectItem>
              <SelectItem value="cm">cm</SelectItem>
              <SelectItem value="mm">mm</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setCalibrationMethod('points');
              onResetScale();
              onStartCalibration();
            }}
            variant="ghost"
            size="sm"
            className="scale-recalibrate-btn"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Recalibrate
          </Button>
        </div>
      )}
    </div>
  );
}
