const STAMP_SVG_MARKUP = `
<svg class="smcf-compliance-svg" viewBox="0 0 260 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SMCF compliance stamp and signature">
  <g>
    <circle cx="130" cy="58" r="42" fill="none" stroke="#1f55c6" stroke-width="4" />
    <circle cx="130" cy="58" r="33" fill="none" stroke="#1f55c6" stroke-width="2.4" />
    <rect x="86" y="44" width="88" height="28" rx="6" fill="none" stroke="#1f55c6" stroke-width="3" />
    <text x="118" y="62" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#c8a32f">S</text>
    <text x="142" y="62" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#1c834a">MCF</text>
  </g>
  <path d="M48 122 C78 114, 104 116, 132 110 C153 105, 172 106, 214 98" fill="none" stroke="#1f55c6" stroke-width="3" stroke-linecap="round" />
  <path d="M80 120 C85 108, 92 109, 99 121 C107 106, 114 107, 121 120 C129 105, 136 108, 143 119 C151 108, 160 111, 168 117" fill="none" stroke="#1f55c6" stroke-width="2.4" stroke-linecap="round" />
  <path d="M142 126 C157 141, 180 141, 196 125" fill="none" stroke="#1f55c6" stroke-width="2" stroke-linecap="round" />
</svg>
`;

export const getSmcfPrintStampStyles = () => `
    .smcf-compliance-block { margin-top: 24px; display: flex; justify-content: flex-end; }
    .smcf-compliance-svg { width: 220px; max-width: 100%; height: auto; display: block; }
`;

export const getSmcfPrintStampMarkup = () => `
  <div class="smcf-compliance-block">
    ${STAMP_SVG_MARKUP}
  </div>
`;
