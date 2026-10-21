# Asset sources

All images were extracted from the two reference PDFs in the project root and upscaled 2× with
OpenCV LapSRN super-resolution, then lightly sharpened. Replace with original hi-res files when
available (same filenames).

| File | Source | Extracted | Notes |
|---|---|---|---|
| `logo.png` | DEUS HCS Presentation 8.pdf p1 | 641×641 | Re-rendered from the vector trace at 1282×1282 |
| `logo-original.png` | same | 641×641 | Untouched original |
| `logo-*.svg`, `logo-lockup*.png` | potrace vector trace of the logo | — | Transparent; `-dark` = navy ink for light backgrounds |
| `logo-mark-wordmark-dark.svg` | `logo-mark-wordmark.svg` recoloured to #0F2030 | — | Mark + wordmark, no tagline; content-slide header logo |
| `telkom-photo.jpg` | DEUS p26 (Success Story) | 588×440 | Telkom signing photo, Graha Merah Putih |
| `module-personality.jpg` | DEUS p7 | 766×477 | Heroes of a Fallen Land, festival choice screen |
| `module-cognitive.jpg` | DEUS p9 | 1160×651 | Speed Sorting card game |
| `cognitive-1.jpg` … `cognitive-7.jpg` | Screenshots supplied 2026-10-21 (`11.png` … `17.png`) | 2000×2000 | Black/grey bars trimmed, resized to 1600 wide; A2 Cognitive slideshow (`images.screenshot.cycle`); originals in `Cognitive Game Screenshot/` kept out of git |
| `drive-1.jpg` … `drive-6.jpg` | Screenshots supplied 2026-10-21 (`41.png` … `46.png`) | 2000×2000 | Transparent bars trimmed, resized to 1600 wide; A3 Drive & Risk slideshow (`images.screenshot.cycle`); originals in `Neuroscience Game Screenshot/` kept out of git |
| `module-drive.jpg` | DEUS p11 | 827×495 | Balloon risk game |
| `simulation-1.jpg` | Screenshot supplied 2026-10-21 (`Event Manager Screenshot/37.png`) | 2000×2000 | Black bars trimmed, Next Chapter logo (top left) painted over with nearby background, resized to 1600 wide; A4 Job Simulation game picture; original kept out of git |
| `module-simulation.jpg` | Document (4).pdf p18 | 535×318 | Investigation screen; sidebar with game logo cropped out |
| `report-suitability.jpg` | DEUS p19 | 754×473 | Suitability summary; no distinct culture-fit / motivation sections |
| `report-personality.jpg` | Screenshot supplied 2026-10-21 (Individual Report, Spotlight tab) | 2660×1457 | App sidebar and top bar (with a staff email) cropped out; original `report-personality-original.png` kept out of git |
| `report-personality-thumb.jpg` | Crop of `report-personality.jpg` (top left: profile header, tabs, start of Executive Summary) | 800×462 | A5 Report types card picture |
| `report-batch.jpg` | Screenshot supplied 2026-10-21 (Batch Neuro Report, Cohort Overview) | 1000×389 | Top of the page: header, stat tiles, start of Domain Statistics; black top bar cut off; original `batch-report.png` kept out of git |
| `report-dashboard.jpg` | Screenshot supplied 2026-10-21 (Interactive report, Overview tab) | 1100×428 | Only the tab bar and the Performance Profile and Band Distribution charts, padded top and bottom in the page grey to fit the A5 card: the Level Up / Agaté header, the participant name and ID, and the radar legend (with the name) are left out; original `dashboard-report.png` kept out of git |
| `report-cognitive.jpg` | Cognitive Assessment Report PDF supplied 2026-10-21 (page 6, Domain Profile) | 300 dpi render | Only the Cognitive Domain Breakdown card; the participant's name (percentile line, footer) is left out, and the PDF stays out of git |
| `report-drive.jpg` | Screenshot supplied 2026-10-21 (Sten profile per domain) | 1009×833 | White margins and a stray edge line trimmed; A3 Drive & Risk report section; no participant name in the picture |
| `report-simulation.jpg` | Sample Report Assessment 1 PDF supplied 2026-10-21 (page 3, Competency Detail) | 300 dpi render | Only the Analytical Thinking card; the page header and the footer (with Agate platform name) are left out, and the PDF stays out of git |
| `extra/report-competency-scores.jpg` | DEUS p19 | 773×524 | Competency vs norm; stitching seam removed |
| `extra/personality-forest.jpg` | DEUS p7 | 755×473 | Alternate Heroes scene |
| `extra/cognitive-*.jpg` | DEUS p8, p9 | — | Alternate cognitive games |
| `client-pizza-hut.png` | Supplied directly (Pizza Hut logo file) | 488×409 | White background made transparent (soft edges kept); untouched copy in `client-pizza-hut-original.png` |
| `fonts/dm-sans-latin-opsz-normal.woff2` | `@fontsource-variable/dm-sans` 5.3.0 (npm) | — | Variable (wght 100–1000, opsz), latin, normal; SIL OFL 1.1, see `fonts/LICENSE-OFL.txt` |

| `demo.mp4` | Supplied directly (Next Chapter Game-Based Assessment Trailer) | 1920×1080, 44 s | Cut at 43.95 s, before the Level Up / Agaté end card; H.264 30 fps, short audio fade-out |
| `demo-poster.jpg` | Frame at 12 s of `demo.mp4` | 1920×1080 | Cognitive & Neuro Assessment game |

Missing (not in either PDF): QR code.
Rule: no Agaté / Level Up branding anywhere in the deck.
