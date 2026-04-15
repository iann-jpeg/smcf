// Favicon Badge Manager
// Updates the favicon to show notification count

let originalFavicon: string | null = null;
let faviconCanvas: HTMLCanvasElement | null = null;
let faviconCtx: CanvasRenderingContext2D | null = null;
const FALLBACK_FAVICON = '/favicon.ico';

// Initialize canvas for favicon manipulation
function initFaviconCanvas(): void {
  if (!faviconCanvas) {
    faviconCanvas = document.createElement('canvas');
    faviconCanvas.width = 32;
    faviconCanvas.height = 32;
    faviconCtx = faviconCanvas.getContext('2d');
  }
}

// Get the original favicon
function getOriginalFavicon(): string {
  if (!originalFavicon) {
    const link = document.querySelector("link[rel~='icon'], link[rel='shortcut icon']") as HTMLLinkElement;
    originalFavicon = link?.href || FALLBACK_FAVICON;
  }
  return originalFavicon;
}

// Update the favicon with a badge count
export function updateFaviconBadge(count: number): void {
  initFaviconCanvas();
  
  if (!faviconCtx || !faviconCanvas) return;
  
  const favicon = getOriginalFavicon();
  const img = document.createElement('img') as HTMLImageElement;
  img.crossOrigin = 'anonymous';
  
  img.onload = () => {
    if (!faviconCtx || !faviconCanvas) return;
    
    // Clear canvas
    faviconCtx.clearRect(0, 0, 32, 32);
    
    // Draw original favicon
    faviconCtx.drawImage(img, 0, 0, 32, 32);
    
    if (count > 0) {
      // Draw badge circle
      const badgeSize = count > 9 ? 16 : 14;
      const x = 32 - badgeSize / 2 - 2;
      const y = badgeSize / 2 + 2;
      
      // Red circle background
      faviconCtx.beginPath();
      faviconCtx.arc(x, y, badgeSize / 2, 0, 2 * Math.PI);
      faviconCtx.fillStyle = '#ef4444';
      faviconCtx.fill();
      
      // White border
      faviconCtx.strokeStyle = '#ffffff';
      faviconCtx.lineWidth = 2;
      faviconCtx.stroke();
      
      // Badge text
      faviconCtx.fillStyle = '#ffffff';
      faviconCtx.font = `bold ${count > 9 ? 9 : 10}px Arial`;
      faviconCtx.textAlign = 'center';
      faviconCtx.textBaseline = 'middle';
      faviconCtx.fillText(count > 99 ? '99+' : String(count), x, y);
    }
    
    // Update favicon
    updateFaviconElement(faviconCanvas.toDataURL('image/png'));
  };
  
  img.onerror = () => {
    // If original favicon fails to load, create a simple one with badge
    if (!faviconCtx || !faviconCanvas) return;
    
    faviconCtx.clearRect(0, 0, 32, 32);
    
    // Draw a simple "S" for SMCF
    faviconCtx.fillStyle = '#3b82f6';
    faviconCtx.beginPath();
    faviconCtx.arc(16, 16, 14, 0, 2 * Math.PI);
    faviconCtx.fill();
    
    faviconCtx.fillStyle = '#ffffff';
    faviconCtx.font = 'bold 18px Arial';
    faviconCtx.textAlign = 'center';
    faviconCtx.textBaseline = 'middle';
    faviconCtx.fillText('S', 16, 16);
    
    if (count > 0) {
      // Draw badge
      const badgeSize = count > 9 ? 14 : 12;
      const x = 32 - badgeSize / 2 - 1;
      const y = badgeSize / 2 + 1;
      
      faviconCtx.beginPath();
      faviconCtx.arc(x, y, badgeSize / 2, 0, 2 * Math.PI);
      faviconCtx.fillStyle = '#ef4444';
      faviconCtx.fill();
      
      faviconCtx.fillStyle = '#ffffff';
      faviconCtx.font = `bold ${count > 9 ? 8 : 9}px Arial`;
      faviconCtx.fillText(count > 99 ? '99+' : String(count), x, y);
    }
    
    updateFaviconElement(faviconCanvas.toDataURL('image/png'));
  };
  
  img.src = favicon;
}

// Update the favicon link element
function updateFaviconElement(dataUrl: string): void {
  const links = Array.from(document.querySelectorAll("link[rel~='icon'], link[rel='shortcut icon']")) as HTMLLinkElement[];

  if (links.length === 0) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = dataUrl;
    document.head.appendChild(link);
    return;
  }

  links.forEach((link) => {
    link.href = dataUrl;
  });
}

// Reset favicon to original (no badge)
export function resetFavicon(): void {
  const original = originalFavicon || getOriginalFavicon() || FALLBACK_FAVICON;
  updateFaviconElement(original);
}

// Update document title with notification count
export function updateTitleBadge(count: number, originalTitle?: string): void {
  const baseTitle = originalTitle || document.title.replace(/^\(\d+\)\s*/, '');
  
  if (count > 0) {
    document.title = `(${count}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
}
