import type jsPDF from "jspdf";

const SEAL_BLUE: [number, number, number] = [25, 88, 206];
const SEAL_SOFT_BLUE: [number, number, number] = [182, 207, 248];
const STAMP_IMAGE_RELATIVE_PATH = "/assets/stamp-wbg.png";
const SIGNATURE_IMAGE_RELATIVE_PATH = "/assets/signature.jpg";

type SealImageCache = {
  primed: boolean;
  stamp: HTMLImageElement | null;
  signature: HTMLImageElement | null;
};

const sealImageCache: SealImageCache = {
  primed: false,
  stamp: null,
  signature: null,
};

type JsPdfWithOpacity = jsPDF & {
  GState?: new (options: { opacity: number; strokeOpacity: number }) => unknown;
  setGState?: (state: unknown) => void;
};

const normalizeBasePath = (basePath: string | undefined): string => {
  const value = String(basePath || "/").trim();
  if (!value || value === "/") return "";
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
};

const resolveSealAssetUrl = (relativePath: string): string => {
  if (typeof window === "undefined" || !window.location?.origin) {
    return relativePath;
  }

  const cleanPath = relativePath.replace(/^\/+/, "");
  const basePath = normalizeBasePath(import.meta.env.BASE_URL as string);
  return `${window.location.origin}${basePath}/${cleanPath}`;
};

const getUnitScale = (doc: jsPDF): number => {
  const width = doc.internal.pageSize.getWidth();
  return width / 210;
};

const isImageReady = (image: HTMLImageElement | null): image is HTMLImageElement => {
  return Boolean(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
};

const safeAddImage = (
  doc: jsPDF,
  image: HTMLImageElement,
  format: "PNG" | "JPEG",
  x: number,
  y: number,
  width: number,
  height: number
): void => {
  try {
    doc.addImage(image, format, x, y, width, height, undefined, "FAST");
  } catch {
    // Ignore image draw failures and rely on vector fallback.
  }
};

const withOpacity = (doc: jsPDF, opacity: number, draw: () => void): void => {
  const richDoc = doc as JsPdfWithOpacity;
  if (typeof richDoc.GState === "function" && typeof richDoc.setGState === "function") {
    try {
      richDoc.setGState(new richDoc.GState({ opacity, strokeOpacity: opacity }));
      draw();
      richDoc.setGState(new richDoc.GState({ opacity: 1, strokeOpacity: 1 }));
      return;
    } catch {
      // Fall through and draw without opacity if plugin support is unavailable.
    }
  }

  draw();
};

const primeSealAssets = (): void => {
  if (sealImageCache.primed || typeof window === "undefined") {
    return;
  }

  sealImageCache.primed = true;

  const stamp = new Image();
  stamp.crossOrigin = "anonymous";
  stamp.src = resolveSealAssetUrl(STAMP_IMAGE_RELATIVE_PATH);
  sealImageCache.stamp = stamp;

  const signature = new Image();
  signature.crossOrigin = "anonymous";
  signature.src = resolveSealAssetUrl(SIGNATURE_IMAGE_RELATIVE_PATH);
  sealImageCache.signature = signature;
};

primeSealAssets();

export const drawSmcfFooterSeal = (doc: jsPDF, centerX: number, centerY: number): void => {
  primeSealAssets();

  const scale = getUnitScale(doc);
  const stampDiameter = 13.2 * scale;
  const stampX = centerX - stampDiameter / 2;
  const stampY = centerY - stampDiameter / 2 - 0.25 * scale;

  if (isImageReady(sealImageCache.stamp)) {
    safeAddImage(doc, sealImageCache.stamp, "PNG", stampX, stampY, stampDiameter, stampDiameter);
  }

  doc.setDrawColor(...SEAL_BLUE);
  doc.setLineWidth(0.44 * scale);
  doc.circle(centerX, centerY, 6.2 * scale, "S");
  doc.setLineWidth(0.23 * scale);
  doc.circle(centerX, centerY, 5.05 * scale, "S");

  doc.setLineWidth(0.3 * scale);
  doc.roundedRect(
    centerX - 7.8 * scale,
    centerY - 1.7 * scale,
    15.6 * scale,
    3.4 * scale,
    0.8 * scale,
    0.8 * scale,
    "S"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.8 * scale);
  doc.setTextColor(...SEAL_BLUE);
  doc.text("SMCF", centerX, centerY + 1.1 * scale, { align: "center" });

  if (isImageReady(sealImageCache.signature)) {
    safeAddImage(
      doc,
      sealImageCache.signature,
      "JPEG",
      centerX - 8.6 * scale,
      centerY + 2.4 * scale,
      17.2 * scale,
      4.6 * scale
    );
  } else {
    doc.setLineWidth(0.24 * scale);
    doc.line(centerX - 7.2 * scale, centerY + 4.1 * scale, centerX + 7.2 * scale, centerY + 2.3 * scale);
  }

  doc.setTextColor(0);
};

export const drawSmcfPageSealWatermark = (
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number
): void => {
  primeSealAssets();

  const centerX = pageWidth / 2;
  const centerY = pageHeight / 2;
  const markSize = Math.min(pageWidth * 0.52, pageHeight * 0.52);

  withOpacity(doc, 0.08, () => {
    if (isImageReady(sealImageCache.stamp)) {
      safeAddImage(
        doc,
        sealImageCache.stamp,
        "PNG",
        centerX - markSize / 2,
        centerY - markSize / 2,
        markSize,
        markSize
      );
    }
  });

  doc.setDrawColor(...SEAL_SOFT_BLUE);
  doc.setLineWidth(Math.max(0.4, pageWidth * 0.0016));
  doc.circle(centerX, centerY, pageWidth * 0.12, "S");
  doc.setLineWidth(Math.max(0.28, pageWidth * 0.0012));
  doc.circle(centerX, centerY, pageWidth * 0.095, "S");

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...SEAL_SOFT_BLUE);
  doc.setFontSize(Math.max(26, Math.min(52, pageWidth * 0.12)));
  doc.text("SMCF", centerX, centerY + pageHeight * 0.012, { align: "center" });

  doc.setTextColor(0);
};
