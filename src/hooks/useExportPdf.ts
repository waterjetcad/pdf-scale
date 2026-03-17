'use client';

import { useCallback } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PageTextAnnotations } from '@/types/pdf';

// Must match the value in usePdfHandler
const BASE_RENDER_SCALE = 2.0;

export function useExportPdf() {
  /**
   * Export a PDF with text annotations burned in.
   * @param pdfBytes  The original PDF file bytes
   * @param textAnnotations  Per-page text annotations
   * @param pages  Array of 1-indexed page numbers, or 'all'
   * @param fileName  Output file name
   */
  const exportPdf = useCallback(async (
    pdfBytes: Uint8Array,
    textAnnotations: PageTextAnnotations,
    pages: number[] | 'all',
    fileName: string = 'export.pdf'
  ) => {
    const srcDoc = await PDFDocument.load(pdfBytes);
    const totalPages = srcDoc.getPageCount();

    // Determine which pages to include (0-indexed internally)
    const pageIndices: number[] = pages === 'all'
      ? Array.from({ length: totalPages }, (_, i) => i)
      : pages.map(p => p - 1).filter(i => i >= 0 && i < totalPages);

    // Create a new document with only the selected pages
    const outDoc = await PDFDocument.create();
    const copiedPages = await outDoc.copyPages(srcDoc, pageIndices);

    const font = await outDoc.embedFont(StandardFonts.Helvetica);

    copiedPages.forEach((page, idx) => {
      outDoc.addPage(page);
      const pageNum = pageIndices[idx] + 1; // back to 1-indexed
      const annotations = textAnnotations[pageNum] || [];
      const { height } = page.getSize();

      annotations.forEach(ann => {
        if (!ann.text) return;

        // Convert canvas coords to PDF coords
        // Canvas is rendered at BASE_RENDER_SCALE, so divide by that.
        // PDF coordinate system has Y-axis going UP from bottom-left.
        const pdfX = ann.x / BASE_RENDER_SCALE;
        const pdfY = height - (ann.y / BASE_RENDER_SCALE) - (ann.fontSize / BASE_RENDER_SCALE);

        // Parse hex color to RGB
        const hex = ann.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;

        page.drawText(ann.text, {
          x: pdfX,
          y: pdfY,
          size: ann.fontSize / BASE_RENDER_SCALE,
          font,
          color: rgb(r, g, b),
        });
      });
    });

    const pdfBytesOut = await outDoc.save();
    const blob = new Blob([pdfBytesOut.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return { exportPdf };
}
