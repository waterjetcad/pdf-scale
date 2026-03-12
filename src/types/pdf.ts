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

export type MeasurementUnit = 'ft' | 'm' | 'in';

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
};

export const ARCHITECTURAL_SCALES: ArchitecturalScale[] = [
  { label: '1" = 1\'', ratio: 1, description: 'Full size' },
  { label: '3/4" = 1\'', ratio: 0.75, description: 'Three-quarter inch' },
  { label: '1/2" = 1\'', ratio: 0.5, description: 'Half inch' },
  { label: '3/8" = 1\'', ratio: 0.375, description: 'Three-eighths inch' },
  { label: '1/4" = 1\'', ratio: 0.25, description: 'Quarter inch' },
  { label: '3/16" = 1\'', ratio: 0.1875, description: 'Three-sixteenths inch' },
  { label: '1/8" = 1\'', ratio: 0.125, description: 'Eighth inch' },
  { label: '1/16" = 1\'', ratio: 0.0625, description: 'Sixteenth inch' },
  { label: '1/32" = 1\'', ratio: 0.03125, description: 'Thirty-second inch' },
  { label: '1" = 10\'', ratio: 0.1, description: 'One inch = ten feet' },
  { label: '1" = 20\'', ratio: 0.05, description: 'One inch = twenty feet' },
  { label: '1" = 30\'', ratio: 1/30, description: 'One inch = thirty feet' },
  { label: '1" = 40\'', ratio: 0.025, description: 'One inch = forty feet' },
  { label: '1" = 50\'', ratio: 0.02, description: 'One inch = fifty feet' },
  { label: '1" = 100\'', ratio: 0.01, description: 'One inch = one hundred feet' },
];