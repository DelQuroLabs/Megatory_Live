/**
 * Phone-browser barcode reading.
 *
 * expo-camera on web only runs jsQR (QR codes). Med bottles are 1D
 * (EAN / UPC / Code-128). This uses the native BarcodeDetector when the
 * browser has it (Chrome on Android) and ZXing otherwise (iPhone Safari).
 */
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

const DETECTOR_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'codabar',
  'itf',
  'qr_code',
  'data_matrix',
];

const ZXING_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.RSS_14,
];

let fastReader: BrowserMultiFormatReader | null = null;
let hardReader: BrowserMultiFormatReader | null = null;

function reader(tryHarder: boolean): BrowserMultiFormatReader {
  const existing = tryHarder ? hardReader : fastReader;
  if (existing) return existing;
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, tryHarder);
  const created = new BrowserMultiFormatReader(hints);
  if (tryHarder) hardReader = created;
  else fastReader = created;
  return created;
}

function nativeDetector(): { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> } | null {
  const Ctor = (typeof window !== 'undefined' && (window as any).BarcodeDetector) as
    | (new (opts?: { formats?: string[] }) => { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> })
    | undefined;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: DETECTOR_FORMATS });
  } catch {
    try {
      return new Ctor();
    } catch {
      return null;
    }
  }
}

export function drawVideoFrame(
  video: HTMLVideoElement,
  opts: { crop?: boolean; maxWidth?: number } = {},
): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  let sx = 0;
  let sy = 0;
  let sw = vw;
  let sh = vh;
  if (opts.crop !== false) {
    sw = Math.max(1, Math.floor(vw * 0.82));
    sh = Math.max(1, Math.floor(vh * 0.38));
    sx = Math.floor((vw - sw) / 2);
    sy = Math.floor((vh - sh) / 2);
  }
  let dw = sw;
  let dh = sh;
  if (opts.maxWidth && dw > opts.maxWidth) {
    const scale = opts.maxWidth / dw;
    dw = opts.maxWidth;
    dh = Math.max(1, Math.floor(sh * scale));
  }
  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
  return canvas;
}

function zxingCanvas(canvas: HTMLCanvasElement, tryHarder: boolean): string | null {
  try {
    const result = reader(tryHarder).decodeFromCanvas(canvas);
    const text = result?.getText?.();
    return text ? String(text).trim() : null;
  } catch {
    return null;
  }
}

async function detectorSource(source: CanvasImageSource): Promise<string | null> {
  const det = nativeDetector();
  if (!det) return null;
  try {
    const codes = await det.detect(source);
    const text = codes?.[0]?.rawValue;
    return text ? String(text).trim() : null;
  } catch {
    return null;
  }
}

export async function decodeFromVideo(
  video: HTMLVideoElement,
  opts: { tryHarder?: boolean } = {},
): Promise<string | null> {
  const fromNative = await detectorSource(video);
  if (fromNative) return fromNative;

  const cropped = drawVideoFrame(video, { crop: true, maxWidth: opts.tryHarder ? 1280 : 640 });
  if (cropped) {
    const hit = zxingCanvas(cropped, !!opts.tryHarder);
    if (hit) return hit;
    const nativeCrop = await detectorSource(cropped);
    if (nativeCrop) return nativeCrop;
  }

  if (opts.tryHarder) {
    const full = drawVideoFrame(video, { crop: false, maxWidth: 1280 });
    if (full) {
      const hit = zxingCanvas(full, true);
      if (hit) return hit;
    }
  }
  return null;
}

export async function decodeImageFile(file: Blob): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    if (!canvas.width || !canvas.height) return null;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const fromNative = await detectorSource(canvas);
    if (fromNative) return fromNative;
    return zxingCanvas(canvas, true);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}
