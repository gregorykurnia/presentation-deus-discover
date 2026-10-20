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
| `module-drive.jpg` | DEUS p11 | 827×495 | Balloon risk game |
| `module-simulation.jpg` | Document (4).pdf p18 | 535×318 | Investigation screen; sidebar with game logo cropped out |
| `report-suitability.jpg` | DEUS p19 | 754×473 | Suitability summary; no distinct culture-fit / motivation sections |
| `extra/report-competency-scores.jpg` | DEUS p19 | 773×524 | Competency vs norm; stitching seam removed |
| `extra/personality-forest.jpg` | DEUS p7 | 755×473 | Alternate Heroes scene |
| `extra/cognitive-*.jpg` | DEUS p8, p9 | — | Alternate cognitive games |
| `client-pizza-hut.png` | Supplied directly (Pizza Hut logo file) | 488×409 | White background made transparent (soft edges kept); untouched copy in `client-pizza-hut-original.png` |
| `fonts/dm-sans-latin-opsz-normal.woff2` | `@fontsource-variable/dm-sans` 5.3.0 (npm) | — | Variable (wght 100–1000, opsz), latin, normal; SIL OFL 1.1, see `fonts/LICENSE-OFL.txt` |

| `demo.mp4` | Supplied directly (Next Chapter Game-Based Assessment Trailer) | 1920×1080, 44 s | Cut at 43.95 s, before the Level Up / Agaté end card; H.264 30 fps, short audio fade-out |
| `demo-poster.jpg` | Frame at 12 s of `demo.mp4` | 1920×1080 | Cognitive & Neuro Assessment game |

Missing (not in either PDF): QR code.
Rule: no Agaté / Level Up branding anywhere in the deck.
