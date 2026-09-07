import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';

export type LabelSizeKey = '50x30' | '60x40' | '80x50';

export const LABEL_SIZES: Record<LabelSizeKey, { width: number; height: number }> = {
  '50x30': { width: 50, height: 30 },
  '60x40': { width: 60, height: 40 },
  '80x50': { width: 80, height: 50 },
};

export interface LabelFields {
  barcode: string;
  name: string;
  sub?: string;
}

export function selectFormat(value: string): 'EAN13' | 'UPCA' | 'CODE128' {
  const digits = value.replace(/\D/g, '');
  if (digits === value && digits.length === 13) return 'EAN13';
  if (digits === value && digits.length === 12) return 'UPCA';
  return 'CODE128';
}

function renderBarcode(canvas: HTMLCanvasElement, value: string): void {
  const options = {
    width: 2,
    height: 70,
    displayValue: true,
    fontSize: 14,
    margin: 2,
  };
  try {
    JsBarcode(canvas, value, { ...options, format: selectFormat(value) });
  } catch {
    JsBarcode(canvas, value, { ...options, format: 'CODE128' });
  }
}

function renderBarcodePng(value: string): { dataUrl: string; width: number; height: number } {
  const canvas = document.createElement('canvas');
  renderBarcode(canvas, value);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  };
}

export function buildLabelsPdf(fields: LabelFields, sizeKey: LabelSizeKey, copies: number): jsPDF {
  const { width, height } = LABEL_SIZES[sizeKey];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 8;
  const cols = Math.floor((pageW - margin * 2) / width);
  const rows = Math.floor((pageH - margin * 2) / height);
  const perPage = Math.max(1, cols * rows);
  const barcode = renderBarcodePng(fields.barcode);

  const nameLines = doc.splitTextToSize(fields.name, width - 6);
  const nameLinesPx = Math.min(nameLines.length, 2);
  const lineHmm = 2.6;
  const headerHmm = 3.5 + nameLinesPx * lineHmm + (fields.sub ? 2.6 : 0);
  const barcodeAspect = barcode.width / barcode.height;
  let barcodeW = width - 8;
  let barcodeH = barcodeW / barcodeAspect;
  const availH = height - headerHmm - 2;
  if (barcodeH > availH) {
    barcodeH = availH;
    barcodeW = barcodeH * barcodeAspect;
  }

  for (let i = 0; i < copies; i++) {
    const page = Math.floor(i / perPage);
    if (page > 0) doc.addPage();
    const idx = i % perPage;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = margin + col * width;
    const y = margin + row * height;

    doc.setDrawColor(190);
    doc.setLineWidth(0.2);
    doc.rect(x, y, width, height);

    doc.setTextColor(40);
    doc.setFontSize(7);
    const nameY = y + 3.5;
    for (let line = 0; line < nameLinesPx; line++) {
      doc.text(nameLines[line], x + 3, nameY + line * lineHmm);
    }

    if (fields.sub) {
      doc.setFontSize(5.5);
      doc.setTextColor(120);
      const sub = doc.splitTextToSize(fields.sub, width - 6);
      doc.text(sub[0], x + 3, nameY + nameLinesPx * lineHmm + 2);
    }

    const bx = x + (width - barcodeW) / 2;
    const by = y + headerHmm;
    doc.addImage(barcode.dataUrl, 'PNG', bx, by, barcodeW, barcodeH);
  }

  doc.autoPrint();
  return doc;
}