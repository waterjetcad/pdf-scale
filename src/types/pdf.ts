export type Point = {
  x: number;
  y: number;
};

export type Measurement = {
  id: string;
  type: 'linear' | 'area';
  points: Point[];
  value: number;
};

export type PageMeasurements = {
  [pageNumber: number]: Measurement[];
};

export type MeasurementUnit = 'ft' | 'm' | 'in' | 'cm' | 'mm' | 'yd';

export type Tool = 'measure' | 'area' | 'calibrate' | 'pan';

export type ScaleCalibration = {
  points: [Point, Point] | null;
  pixelDistance: number;
  realDistance: number;
  unit: MeasurementUnit;
  label: string;
  pixelsPerUnit: number;
};

export type ArchitecturalScale = {
  label: string;
  ratio: number; // inches on paper per foot in real life
  description: string;
  group: 'architectural' | 'engineering' | 'metric';
};

export const ARCHITECTURAL_SCALES: ArchitecturalScale[] = [
  // ── Architectural Scales ──
  { label: '1\" = 1\'', ratio: 1, description: 'Full size', group: 'architectural' },
  { label: '3/4\" = 1\'', ratio: 0.75, description: 'Three-quarter inch', group: 'architectural' },
  { label: '1/2\" = 1\'', ratio: 0.5, description: 'Half inch', group: 'architectural' },
  { label: '3/8\" = 1\'', ratio: 0.375, description: 'Three-eighths inch', group: 'architectural' },
  { label: '1/4\" = 1\'', ratio: 0.25, description: 'Quarter inch', group: 'architectural' },
  { label: '3/16\" = 1\'', ratio: 0.1875, description: 'Three-sixteenths inch', group: 'architectural' },
  { label: '1/8\" = 1\'', ratio: 0.125, description: 'Eighth inch', group: 'architectural' },
  { label: '3/32\" = 1\'', ratio: 3/32, description: 'Three-thirty-seconds inch', group: 'architectural' },
  { label: '1/16\" = 1\'', ratio: 0.0625, description: 'Sixteenth inch', group: 'architectural' },
  { label: '1/32\" = 1\'', ratio: 0.03125, description: 'Thirty-second inch', group: 'architectural' },

  // ── Engineering / Civil Scales ──
  { label: '1\" = 10\'', ratio: 0.1, description: 'One inch = ten feet', group: 'engineering' },
  { label: '1\" = 20\'', ratio: 0.05, description: 'One inch = twenty feet', group: 'engineering' },
  { label: '1\" = 30\'', ratio: 1/30, description: 'One inch = thirty feet', group: 'engineering' },
  { label: '1\" = 40\'', ratio: 0.025, description: 'One inch = forty feet', group: 'engineering' },
  { label: '1\" = 50\'', ratio: 0.02, description: 'One inch = fifty feet', group: 'engineering' },
  { label: '1\" = 60\'', ratio: 1/60, description: 'One inch = sixty feet', group: 'engineering' },
  { label: '1\" = 100\'', ratio: 0.01, description: 'One inch = one hundred feet', group: 'engineering' },
  { label: '1\" = 200\'', ratio: 1/200, description: 'One inch = two hundred feet', group: 'engineering' },
  { label: '1\" = 300\'', ratio: 1/300, description: 'One inch = three hundred feet', group: 'engineering' },
  { label: '1\" = 400\'', ratio: 1/400, description: 'One inch = four hundred feet', group: 'engineering' },
  { label: '1\" = 500\'', ratio: 1/500, description: 'One inch = five hundred feet', group: 'engineering' },

  // ── Metric Scales ──
  { label: '1:1', ratio: 1, description: 'Full size metric', group: 'metric' },
  { label: '1:5', ratio: 1/5, description: 'One to five', group: 'metric' },
  { label: '1:10', ratio: 1/10, description: 'One to ten', group: 'metric' },
  { label: '1:20', ratio: 1/20, description: 'One to twenty', group: 'metric' },
  { label: '1:25', ratio: 1/25, description: 'One to twenty-five', group: 'metric' },
  { label: '1:50', ratio: 1/50, description: 'One to fifty', group: 'metric' },
  { label: '1:75', ratio: 1/75, description: 'One to seventy-five', group: 'metric' },
  { label: '1:100', ratio: 1/100, description: 'One to one hundred', group: 'metric' },
  { label: '1:150', ratio: 1/150, description: 'One to one hundred fifty', group: 'metric' },
  { label: '1:200', ratio: 1/200, description: 'One to two hundred', group: 'metric' },
  { label: '1:250', ratio: 1/250, description: 'One to two hundred fifty', group: 'metric' },
  { label: '1:300', ratio: 1/300, description: 'One to three hundred', group: 'metric' },
  { label: '1:500', ratio: 1/500, description: 'One to five hundred', group: 'metric' },
  { label: '1:1000', ratio: 1/1000, description: 'One to one thousand', group: 'metric' },
  { label: '1:1250', ratio: 1/1250, description: 'One to twelve fifty', group: 'metric' },
  { label: '1:2500', ratio: 1/2500, description: 'One to twenty-five hundred', group: 'metric' },
];