# Clinova Healthcare — Design Decisions

## Images: SVG Placeholder Portraits Instead of Photos

**Decision:** Staff portraits use SVG placeholders displaying initials on a coloured background, rather than photographic portraits.

**Reason:** Image generation quota was exhausted during the build. The avatar component (`components/avatar.js`) already includes a robust fallback to initials-based avatars when image files fail to load.

**Impact:** The application is fully functional. The initials-based avatar provides a clean, professional appearance. Photographic portraits can be added later by placing WebP/JPEG files in `assets/images/staff/` and updating seed data.

## Login Hero: SVG Abstract Pattern Instead of Photography

**Decision:** The login page visual panel uses an SVG abstract medical pattern (ECG pulse lines and cross shapes on a navy background) rather than a photographic hospital interior.

**Reason:** Same image generation constraint. The SVG pattern is lightweight, loads instantly, and maintains the clinical/professional aesthetic.

## Font: Inter Variable Font (Single File)

**Decision:** Using the Inter variable weight font (`inter-variable.woff2`) instead of three separate weight files.

**Reason:** A single variable font file covers all weights (400/500/600 and more), reducing HTTP requests and simplifying font management.

## Currency Storage: Integer Paise

All monetary values are stored as integer paise (1 rupee = 100 paise) to avoid floating-point arithmetic errors. Display formatting uses `Intl.NumberFormat('en-IN')` with division by 100.
