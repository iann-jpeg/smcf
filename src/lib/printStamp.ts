const STAMP_IMAGE_RELATIVE_PATH = "/assets/stamp-wbg.png";
const SIGNATURE_IMAGE_RELATIVE_PATH = "/assets/signature.jpg";

const STAMP_FALLBACK_SVG = `
<svg class="smcf-fallback-svg" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SMCF official seal fallback">
  <circle cx="120" cy="120" r="102" fill="none" stroke="#1958ce" stroke-width="7" />
  <circle cx="120" cy="120" r="82" fill="none" stroke="#1958ce" stroke-width="3.8" />
  <rect x="38" y="95" width="164" height="50" rx="10" fill="none" stroke="#1958ce" stroke-width="5" />
  <text x="120" y="127" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" fill="#1958ce">SMCF</text>
</svg>
`;

const normalizeBasePath = (basePath: string | undefined): string => {
  const value = String(basePath || "/").trim();
  if (!value || value === "/") return "";
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
};

const resolvePrintAssetUrl = (relativePath: string): string => {
  if (typeof window === "undefined" || !window.location?.origin) {
    return relativePath;
  }

  const cleanPath = relativePath.replace(/^\/+/, "");
  const basePath = normalizeBasePath(import.meta.env.BASE_URL as string);
  return `${window.location.origin}${basePath}/${cleanPath}`;
};

export const getSmcfPrintStampStyles = () => `
    body {
      position: relative;
      z-index: 0;
    }

    body > * {
      position: relative;
      z-index: 1;
    }

    .smcf-page-seal-layer {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 0;
    }

    .smcf-page-seal-core {
      position: relative;
      width: min(56vw, 360px);
      aspect-ratio: 1 / 1;
      display: grid;
      place-items: center;
      transform: rotate(-10deg);
      opacity: 0.12;
      filter: saturate(120%) contrast(112%);
    }

    .smcf-page-seal-image,
    .smcf-page-seal-fallback,
    .smcf-stamp-image,
    .smcf-stamp-fallback,
    .smcf-fallback-svg {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .smcf-page-seal-wordmark {
      position: absolute;
      color: #1958ce;
      font-family: Segoe UI, Arial, sans-serif;
      font-weight: 800;
      font-size: clamp(30px, 5.2vw, 56px);
      letter-spacing: 0.3em;
      text-transform: uppercase;
      text-indent: 0.3em;
    }

    .smcf-compliance-block {
      margin-top: 24px;
      display: flex;
      justify-content: center;
      position: relative;
      z-index: 3;
    }

    .smcf-compliance-card {
      width: 262px;
      max-width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 12px 12px 10px;
      border: 1.4px solid rgba(25, 88, 206, 0.4);
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.93), rgba(228, 238, 255, 0.74));
      box-shadow: 0 10px 24px rgba(17, 53, 142, 0.18);
    }

    .smcf-stamp-stage {
      position: relative;
      width: 154px;
      height: 154px;
      display: grid;
      place-items: center;
    }

    .smcf-stamp-wordmark {
      position: absolute;
      color: #1958ce;
      font-family: Segoe UI, Arial, sans-serif;
      font-weight: 800;
      font-size: 33px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      text-indent: 0.22em;
      text-shadow: 0 0 1px rgba(25, 88, 206, 0.35);
    }

    .smcf-signature-image {
      width: 100%;
      max-width: 230px;
      height: 58px;
      object-fit: contain;
      mix-blend-mode: multiply;
    }

    .smcf-seal-caption {
      margin: 0;
      color: #1958ce;
      font-size: 10px;
      font-family: Segoe UI, Arial, sans-serif;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    @media print {
      .smcf-page-seal-core {
        opacity: 0.1;
      }

      .smcf-signature-image {
        filter: saturate(120%) contrast(112%);
      }
    }
`;

export const getSmcfPrintStampMarkup = () => {
  const stampUrl = resolvePrintAssetUrl(STAMP_IMAGE_RELATIVE_PATH);
  const signatureUrl = resolvePrintAssetUrl(SIGNATURE_IMAGE_RELATIVE_PATH);

  return `
  <div class="smcf-page-seal-layer" aria-hidden="true">
    <div class="smcf-page-seal-core">
      <img class="smcf-page-seal-image" src="${stampUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
      <div class="smcf-page-seal-fallback" style="display:none;">${STAMP_FALLBACK_SVG}</div>
      <span class="smcf-page-seal-wordmark">SMCF</span>
    </div>
  </div>

  <div class="smcf-compliance-block">
    <div class="smcf-compliance-card">
      <div class="smcf-stamp-stage" role="img" aria-label="SMCF official digital seal">
        <img class="smcf-stamp-image" src="${stampUrl}" alt="SMCF official stamp" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
        <div class="smcf-stamp-fallback" style="display:none;">${STAMP_FALLBACK_SVG}</div>
        <span class="smcf-stamp-wordmark">SMCF</span>
      </div>
      <img class="smcf-signature-image" src="${signatureUrl}" alt="Authorized signature" />
      <p class="smcf-seal-caption">Official Digital Seal</p>
    </div>
  </div>
`;
};
