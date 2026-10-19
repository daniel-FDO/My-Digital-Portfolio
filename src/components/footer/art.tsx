/* The footer's artwork, converted 1:1 from the original markup:
   the lanyard (woven strap + red edge stitching + "dF", a gunmetal anchor
   and a swivel clasp — idRig.ts redraws its paths every frame) and the
   ID card's QR code (a real one: scanning it opens an email to Daniel). */

export const LanyardSvg = () => (
  <svg className="idrig__rope" aria-hidden="true">
    <defs>
      <path id="idStrapLine" d="" />
      <path id="idEdgeL" d="" /><path id="idEdgeR" d="" />
      <path id="idThreadL" d="" /><path id="idThreadR" d="" />
      <linearGradient id="idMetal" gradientUnits="userSpaceOnUse" x1="-9" y1="0" x2="9" y2="0">
        <stop offset="0" stopColor="#3a3b40" /><stop offset="0.26" stopColor="#8c8e95" /><stop offset="0.42" stopColor="#d0d2d7" />
        <stop offset="0.6" stopColor="#6f7177" /><stop offset="1" stopColor="#34353a" />
      </linearGradient>
      <linearGradient id="idMetalTop" gradientUnits="userSpaceOnUse" x1="0" y1="-9" x2="0" y2="4">
        <stop offset="0" stopColor="#8a8c93" /><stop offset="0.35" stopColor="#56585e" />
        <stop offset="0.75" stopColor="#313237" /><stop offset="1" stopColor="#4c4d53" />
      </linearGradient>
      <pattern id="idBrush" patternUnits="userSpaceOnUse" width="34" height="2.2">
        <rect y="0.2" width="34" height="0.3" fill="#fff" opacity="0.09" /><rect x="6" y="1.2" width="19" height="0.25" fill="#fff" opacity="0.06" />
        <rect x="2" y="1.7" width="30" height="0.2" fill="#000" opacity="0.18" />
      </pattern>
      <filter id="idSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" /></filter>
    </defs>
    {/* strap: shadow, body shading, weave, threads, stitching */}
    <use className="idrig__shadow" href="#idStrapLine" />
    <use className="idrig__strap" href="#idStrapLine" />
    <use className="idrig__strap-mid" href="#idStrapLine" />
    <use className="idrig__strap-hi" href="#idStrapLine" />
    <use className="idrig__weave" href="#idStrapLine" />
    <use className="idrig__weave idrig__weave--b" href="#idStrapLine" />
    <use className="idrig__thread" href="#idThreadL" /><use className="idrig__thread" href="#idThreadR" />
    <use className="idrig__stitch-hole" href="#idEdgeL" /><use className="idrig__stitch-hole" href="#idEdgeR" />
    <use className="idrig__stitch" href="#idEdgeL" /><use className="idrig__stitch" href="#idEdgeR" />
    {/* handwritten "dF", traced (viewBox 24 × 16, centred on 0 0) */}
    <g id="idLogo"><g transform="translate(-12 -8)">
      <path className="idrig__logo idrig__logo--shade" d="M9.1 9.6C8.5 8.4 6.6 8 5.3 9.1 3.8 10.4 3.9 13 5.6 13.1 7.3 13.2 8.8 10.6 10 7.4 11 4.8 11.6 2.6 11.2 2 10.7 1.4 9.9 3.6 9.5 6 9.1 8.6 8.6 11.4 9.1 12.7 9.5 13.6 10.6 13 11.4 12.1M13.6 4.6C13 3.6 14.2 2.8 15.6 2.6 17.6 2.3 19.9 2.4 22.4 2.1M18.6 2.5C18 5.6 17.2 9 15.6 11.6 14.6 13.2 13.2 13.9 12.4 13M15.9 7.9C17 7.6 18.2 7.4 19.6 7.4" />
      <path className="idrig__logo" d="M9.1 9.6C8.5 8.4 6.6 8 5.3 9.1 3.8 10.4 3.9 13 5.6 13.1 7.3 13.2 8.8 10.6 10 7.4 11 4.8 11.6 2.6 11.2 2 10.7 1.4 9.9 3.6 9.5 6 9.1 8.6 8.6 11.4 9.1 12.7 9.5 13.6 10.6 13 11.4 12.1M13.6 4.6C13 3.6 14.2 2.8 15.6 2.6 17.6 2.3 19.9 2.4 22.4 2.1M18.6 2.5C18 5.6 17.2 9 15.6 11.6 14.6 13.2 13.2 13.9 12.4 13M15.9 7.9C17 7.6 18.2 7.4 19.6 7.4" />
    </g></g>
    {/* swivel clasp, in two parts that pivot at the swivel eye (y 9.7): the D-ring
         follows the end of the strap, the snap hook points at the badge clip (y 26) */}
    <g id="idClaspTop">
      <rect className="idrig__hw-shadow" x="-9" y="0" width="19" height="10" rx="3" filter="url(#idSoft)" />
      <rect className="idrig__ring-edge" x="-9.5" y="-1" width="19" height="9" rx="2.8" />
      <rect className="idrig__metal-line" x="-9.5" y="-1" width="19" height="9" rx="2.8" />
      <rect className="idrig__fold" x="-9" y="-4" width="18" height="5.6" rx="1.4" />
      <path className="idrig__fold-edge" d="M-8.2 1.3H8.2" />
    </g>
    <g id="idClaspHook">
      <rect className="idrig__hw-shadow" x="-4" y="10" width="9" height="17" rx="4" filter="url(#idSoft)" />
      <circle className="idrig__metal-line idrig__metal-line--thin" cx="0" cy="9.7" r="1.8" />
      <rect className="idrig__metal" x="-2.3" y="10.9" width="4.6" height="3.4" rx="1.1" />
      <rect className="idrig__metal" x="-3.1" y="13.9" width="6.2" height="1.7" rx="0.8" />
      <path className="idrig__hook-edge" d="M-2.4 15.5L-3.9 22.2Q-4 26.2 0 26.2 4 26.2 3.9 22.2V21" />
      <path className="idrig__metal-line" d="M-2.4 15.5L-3.9 22.2Q-4 26.2 0 26.2 4 26.2 3.9 22.2V21" />
      <path className="idrig__hook-edge idrig__hook-edge--thin" d="M3.9 21L2.5 15.8" />
      <path className="idrig__metal-line idrig__metal-line--thin" d="M3.9 21L2.5 15.8" />
      <rect className="idrig__metal" x="2.2" y="17.2" width="2.6" height="1.5" rx="0.6" transform="rotate(-15 3.5 17.9)" />
      <path className="idrig__glint" d="M-3 17.4L-3.6 21.8" />
    </g>
    {/* brushed gunmetal anchor on the hairline (the strap tucks in behind it) */}
    <g id="idHook">
      <rect className="idrig__hw-shadow" x="-16" y="-7" width="32" height="13" rx="6.5" filter="url(#idSoft)" />
      <rect className="idrig__mount" x="-17" y="-9" width="34" height="13" rx="6.5" />
      <rect x="-17" y="-9" width="34" height="13" rx="6.5" fill="url(#idBrush)" />
      <path className="idrig__mount-hi" d="M-11.5 -8.3H11.5" />
      <rect className="idrig__slot" x="-10.6" y="0.4" width="21.2" height="1.8" rx="0.9" />
    </g>
  </svg>
);

export const QrCode = () => (
  <svg className="idcard__qr" viewBox="-2 -2 33 33" role="img" aria-label="QR code: email danielfash2007@gmail.com" shapeRendering="crispEdges"><rect x="-2" y="-2" width="33" height="33" fill="#fff"/><path fill="#0b0b0c" d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM8 0h1v1h-1zM10 0h1v1h-1zM11 0h1v1h-1zM12 0h1v1h-1zM13 0h1v1h-1zM14 0h1v1h-1zM15 0h1v1h-1zM18 0h1v1h-1zM20 0h1v1h-1zM22 0h1v1h-1zM23 0h1v1h-1zM24 0h1v1h-1zM25 0h1v1h-1zM26 0h1v1h-1zM27 0h1v1h-1zM28 0h1v1h-1zM0 1h1v1h-1zM6 1h1v1h-1zM9 1h1v1h-1zM11 1h1v1h-1zM12 1h1v1h-1zM13 1h1v1h-1zM14 1h1v1h-1zM15 1h1v1h-1zM18 1h1v1h-1zM20 1h1v1h-1zM22 1h1v1h-1zM28 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM8 2h1v1h-1zM10 2h1v1h-1zM12 2h1v1h-1zM16 2h1v1h-1zM18 2h1v1h-1zM20 2h1v1h-1zM22 2h1v1h-1zM24 2h1v1h-1zM25 2h1v1h-1zM26 2h1v1h-1zM28 2h1v1h-1zM0 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM9 3h1v1h-1zM10 3h1v1h-1zM14 3h1v1h-1zM15 3h1v1h-1zM18 3h1v1h-1zM22 3h1v1h-1zM24 3h1v1h-1zM25 3h1v1h-1zM26 3h1v1h-1zM28 3h1v1h-1zM0 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM12 4h1v1h-1zM13 4h1v1h-1zM15 4h1v1h-1zM17 4h1v1h-1zM19 4h1v1h-1zM22 4h1v1h-1zM24 4h1v1h-1zM25 4h1v1h-1zM26 4h1v1h-1zM28 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM9 5h1v1h-1zM10 5h1v1h-1zM12 5h1v1h-1zM15 5h1v1h-1zM18 5h1v1h-1zM22 5h1v1h-1zM28 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h1v1h-1zM23 6h1v1h-1zM24 6h1v1h-1zM25 6h1v1h-1zM26 6h1v1h-1zM27 6h1v1h-1zM28 6h1v1h-1zM8 7h1v1h-1zM10 7h1v1h-1zM11 7h1v1h-1zM12 7h1v1h-1zM14 7h1v1h-1zM15 7h1v1h-1zM17 7h1v1h-1zM19 7h1v1h-1zM20 7h1v1h-1zM0 8h1v1h-1zM2 8h1v1h-1zM5 8h1v1h-1zM6 8h1v1h-1zM14 8h1v1h-1zM15 8h1v1h-1zM17 8h1v1h-1zM19 8h1v1h-1zM20 8h1v1h-1zM21 8h1v1h-1zM22 8h1v1h-1zM26 8h1v1h-1zM28 8h1v1h-1zM0 9h1v1h-1zM1 9h1v1h-1zM2 9h1v1h-1zM4 9h1v1h-1zM5 9h1v1h-1zM8 9h1v1h-1zM9 9h1v1h-1zM10 9h1v1h-1zM13 9h1v1h-1zM14 9h1v1h-1zM19 9h1v1h-1zM20 9h1v1h-1zM21 9h1v1h-1zM22 9h1v1h-1zM23 9h1v1h-1zM24 9h1v1h-1zM27 9h1v1h-1zM28 9h1v1h-1zM1 10h1v1h-1zM2 10h1v1h-1zM4 10h1v1h-1zM6 10h1v1h-1zM7 10h1v1h-1zM8 10h1v1h-1zM11 10h1v1h-1zM13 10h1v1h-1zM15 10h1v1h-1zM21 10h1v1h-1zM22 10h1v1h-1zM24 10h1v1h-1zM26 10h1v1h-1zM27 10h1v1h-1zM1 11h1v1h-1zM3 11h1v1h-1zM4 11h1v1h-1zM5 11h1v1h-1zM8 11h1v1h-1zM9 11h1v1h-1zM11 11h1v1h-1zM12 11h1v1h-1zM14 11h1v1h-1zM16 11h1v1h-1zM22 11h1v1h-1zM24 11h1v1h-1zM25 11h1v1h-1zM28 11h1v1h-1zM2 12h1v1h-1zM4 12h1v1h-1zM6 12h1v1h-1zM11 12h1v1h-1zM13 12h1v1h-1zM15 12h1v1h-1zM20 12h1v1h-1zM21 12h1v1h-1zM23 12h1v1h-1zM25 12h1v1h-1zM26 12h1v1h-1zM27 12h1v1h-1zM28 12h1v1h-1zM0 13h1v1h-1zM2 13h1v1h-1zM5 13h1v1h-1zM7 13h1v1h-1zM8 13h1v1h-1zM10 13h1v1h-1zM12 13h1v1h-1zM13 13h1v1h-1zM15 13h1v1h-1zM16 13h1v1h-1zM18 13h1v1h-1zM20 13h1v1h-1zM21 13h1v1h-1zM23 13h1v1h-1zM24 13h1v1h-1zM0 14h1v1h-1zM5 14h1v1h-1zM6 14h1v1h-1zM10 14h1v1h-1zM11 14h1v1h-1zM12 14h1v1h-1zM13 14h1v1h-1zM18 14h1v1h-1zM19 14h1v1h-1zM20 14h1v1h-1zM21 14h1v1h-1zM28 14h1v1h-1zM0 15h1v1h-1zM1 15h1v1h-1zM3 15h1v1h-1zM4 15h1v1h-1zM8 15h1v1h-1zM11 15h1v1h-1zM14 15h1v1h-1zM16 15h1v1h-1zM19 15h1v1h-1zM22 15h1v1h-1zM25 15h1v1h-1zM26 15h1v1h-1zM27 15h1v1h-1zM3 16h1v1h-1zM4 16h1v1h-1zM5 16h1v1h-1zM6 16h1v1h-1zM8 16h1v1h-1zM9 16h1v1h-1zM10 16h1v1h-1zM11 16h1v1h-1zM16 16h1v1h-1zM17 16h1v1h-1zM18 16h1v1h-1zM19 16h1v1h-1zM20 16h1v1h-1zM23 16h1v1h-1zM24 16h1v1h-1zM25 16h1v1h-1zM27 16h1v1h-1zM28 16h1v1h-1zM0 17h1v1h-1zM1 17h1v1h-1zM2 17h1v1h-1zM3 17h1v1h-1zM10 17h1v1h-1zM13 17h1v1h-1zM14 17h1v1h-1zM17 17h1v1h-1zM18 17h1v1h-1zM21 17h1v1h-1zM0 18h1v1h-1zM1 18h1v1h-1zM3 18h1v1h-1zM4 18h1v1h-1zM5 18h1v1h-1zM6 18h1v1h-1zM7 18h1v1h-1zM10 18h1v1h-1zM11 18h1v1h-1zM14 18h1v1h-1zM15 18h1v1h-1zM20 18h1v1h-1zM26 18h1v1h-1zM27 18h1v1h-1zM2 19h1v1h-1zM4 19h1v1h-1zM7 19h1v1h-1zM8 19h1v1h-1zM9 19h1v1h-1zM10 19h1v1h-1zM12 19h1v1h-1zM13 19h1v1h-1zM14 19h1v1h-1zM16 19h1v1h-1zM17 19h1v1h-1zM18 19h1v1h-1zM19 19h1v1h-1zM20 19h1v1h-1zM21 19h1v1h-1zM24 19h1v1h-1zM26 19h1v1h-1zM2 20h1v1h-1zM5 20h1v1h-1zM6 20h1v1h-1zM7 20h1v1h-1zM10 20h1v1h-1zM14 20h1v1h-1zM18 20h1v1h-1zM20 20h1v1h-1zM21 20h1v1h-1zM22 20h1v1h-1zM23 20h1v1h-1zM24 20h1v1h-1zM27 20h1v1h-1zM28 20h1v1h-1zM18 21h1v1h-1zM19 21h1v1h-1zM20 21h1v1h-1zM24 21h1v1h-1zM25 21h1v1h-1zM0 22h1v1h-1zM1 22h1v1h-1zM2 22h1v1h-1zM3 22h1v1h-1zM4 22h1v1h-1zM5 22h1v1h-1zM6 22h1v1h-1zM9 22h1v1h-1zM12 22h1v1h-1zM13 22h1v1h-1zM14 22h1v1h-1zM15 22h1v1h-1zM16 22h1v1h-1zM17 22h1v1h-1zM18 22h1v1h-1zM20 22h1v1h-1zM22 22h1v1h-1zM24 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM8 23h1v1h-1zM9 23h1v1h-1zM11 23h1v1h-1zM12 23h1v1h-1zM13 23h1v1h-1zM16 23h1v1h-1zM17 23h1v1h-1zM18 23h1v1h-1zM19 23h1v1h-1zM20 23h1v1h-1zM24 23h1v1h-1zM27 23h1v1h-1zM28 23h1v1h-1zM0 24h1v1h-1zM2 24h1v1h-1zM3 24h1v1h-1zM4 24h1v1h-1zM6 24h1v1h-1zM10 24h1v1h-1zM14 24h1v1h-1zM15 24h1v1h-1zM19 24h1v1h-1zM20 24h1v1h-1zM21 24h1v1h-1zM22 24h1v1h-1zM23 24h1v1h-1zM24 24h1v1h-1zM25 24h1v1h-1zM26 24h1v1h-1zM28 24h1v1h-1zM0 25h1v1h-1zM2 25h1v1h-1zM3 25h1v1h-1zM4 25h1v1h-1zM6 25h1v1h-1zM9 25h1v1h-1zM10 25h1v1h-1zM11 25h1v1h-1zM13 25h1v1h-1zM14 25h1v1h-1zM15 25h1v1h-1zM16 25h1v1h-1zM17 25h1v1h-1zM22 25h1v1h-1zM23 25h1v1h-1zM24 25h1v1h-1zM25 25h1v1h-1zM26 25h1v1h-1zM27 25h1v1h-1zM28 25h1v1h-1zM0 26h1v1h-1zM2 26h1v1h-1zM3 26h1v1h-1zM4 26h1v1h-1zM6 26h1v1h-1zM8 26h1v1h-1zM9 26h1v1h-1zM10 26h1v1h-1zM14 26h1v1h-1zM17 26h1v1h-1zM21 26h1v1h-1zM26 26h1v1h-1zM0 27h1v1h-1zM6 27h1v1h-1zM11 27h1v1h-1zM12 27h1v1h-1zM15 27h1v1h-1zM16 27h1v1h-1zM19 27h1v1h-1zM23 27h1v1h-1zM25 27h1v1h-1zM26 27h1v1h-1zM0 28h1v1h-1zM1 28h1v1h-1zM2 28h1v1h-1zM3 28h1v1h-1zM4 28h1v1h-1zM5 28h1v1h-1zM6 28h1v1h-1zM8 28h1v1h-1zM9 28h1v1h-1zM10 28h1v1h-1zM13 28h1v1h-1zM14 28h1v1h-1zM16 28h1v1h-1zM17 28h1v1h-1zM18 28h1v1h-1zM21 28h1v1h-1zM22 28h1v1h-1zM23 28h1v1h-1zM26 28h1v1h-1zM28 28h1v1h-1z"/></svg>
);
