Build a 16:9 HTML slide deck for "DEUS Game-Based Assessment," a sales pitch to HR teams at Indonesian companies. It must present well in a browser and export cleanly to PDF.

The content below is final. The visual design is up to you: colors, typography, layout, imagery, overall style.

## Step 1: Propose a design direction first
Before building anything, propose 2–3 distinct design directions. For each one, give:
- A name and one-line concept
- Color palette (with hex codes) and fonts
- How a typical content slide is laid out
- Why it suits this audience and this pitch

Then wait for me to pick one (or mix them) before you build.

## Context for the design
- **Audience:** HR managers, HR directors and in-house psikolog at Indonesian corporates and BUMN. They see many vendor pitches, so the deck needs to feel credible and professional, not like a startup gimmick.
- **Product:** game-based psychological assessment that measures how well candidates fit a specific role and a company's culture. The product is playful (real games), but the buyer cares about accuracy and trust. The design should balance those two.
- **How it's used:** presented on a screen in a meeting room, then sent as a PDF afterward.
- **Brand assets:** the DEUS logo is at `assets/logo.png`. Use it, and let it inform your palette if that makes sense.
- **Problems in our previous deck. Avoid these:**
  - Every slide was a grid of 3–6 small cards with dense text, so nothing stood out
  - Inconsistent title styles and backgrounds that made it feel stitched together
  - Text too small to read from across a room
  - Generic stock photos
  - Dashboard screenshots shown so small they were unreadable
- **Design principles to keep:**
  - One clear focal point per slide
  - Readable from the back of a meeting room
  - A consistent visual system across all slides
  - Real product screenshots and real photos only, never stock imagery

## Technical requirements
1. `deck.html`: a single self-contained HTML file (inline CSS and JS). Each slide is 1920×1080px; in the browser, scale slides to fit the window and keep the aspect ratio. Arrow keys / space move between slides, "N" toggles speaker notes, "F" toggles fullscreen.
2. `export-pdf.js`: a Node script using Playwright that exports the deck to `DEUS-Pitch.pdf`, one slide per page, with backgrounds printed. Wait for fonts and images to load. Fonts must work offline (bundle them in `assets/fonts/` if needed). Hide navigation and speaker notes in print.
3. `placeholders.md`: a checklist of every [bracketed placeholder] left in the deck, listed by slide number.

Other rules:
- Images come from `assets/`. If a file is missing, render a clean labeled placeholder box describing what goes there.
- Store speaker notes per slide in a `data-notes` attribute.
- Highlight [bracketed placeholders] so they're easy to spot, with a `SHOW_PLACEHOLDER_HIGHLIGHT` flag at the top of the script to turn the highlight off for the final version.

## Content rules
- Use the text below exactly as written. Don't add claims, numbers, features or bullet points.
- Never invent numbers. Leave every [placeholder] as is.
- Keep the Bahasa Indonesia quotes word for word.
- Each slide's purpose tells you what the slide needs to achieve; design to serve that purpose.
- If something doesn't fit legibly, tell me rather than shrinking the text.

## Slides

### Slide 1: Title
Purpose: hook them in the first 10 seconds.
- Headline: "Fit the role, they perform. Fit your company, they stay."
- Subtitle: "DEUS Game-Based Assessment · Built around your roles and your culture"
- "Prepared for" + client logo (the logo carries the company name, so it isn't repeated in the text)
- DEUS logo
Notes: Open with: "Most tests only check if someone can do the job. We also check if they belong in your company."

### Slide 2: Proof
Purpose: build credibility immediately. The numbers should hit hard.
- Headline: "Two years in a row, Telkom Group and its subsidiaries have run their MT selection with DEUS."
- Stats: 1,000+ MT candidates · 7 companies (Telkom + 6 subsidiaries) · 30+ provinces, all at once · Results in 1 day
- Photo: assets/telkom-photo.jpg, no caption
Notes: "Before I explain anything, this is what it looks like at scale."

### Slide 3: Problem
Purpose: make them recognize their own pain.
- Headline: "Today's assessments check if they can do the job. Not if they'll fit, or stay."
- Candidates memorize the answers
- Results aren't tied to your roles or your culture
- Wrong fits leave after you've invested in them
Notes: Ask: "How many of your last MT batch are still with you?" Then listen.

### Slide 4: How we define fit
Purpose: this is the core idea and our main differentiator. It should be the most memorable slide in the deck.
- Headline: "Two kinds of fit. One score."
- Role fit: "Can they succeed in this job?"
- Culture fit: "Do they share your values and way of working?"
- Process: Your roles + your values → Success profile → Candidates play → Suitability score
- Footer: "Profiles ready in 1 day."
Notes: "Same games, different definition of success. Culture fit means your values written down, not 'people like us.'"

### Slide 5: Video
Purpose: a trailer of the games, showing what candidates actually play.
- Headline: "This is what your candidates play."
- Video: assets/demo.mp4, the game trailer (with controls), centred and as large as the margins allow. When presenting it plays from the start, with sound, each time the slide is shown (forward or back), and pauses when you leave. No quote, link or QR code. In the PDF, show the poster image assets/demo-poster.jpg.
Notes: "While she played the balloon game, it measured how she takes risks and learns from mistakes. That feeds directly into her fit."

### Slide 6: What it measures
Purpose: answer "what exactly do you measure?" without overwhelming them.
- Headline: "Four games, each measuring something different."
- Personality: Work style, values, teamwork → Culture fit
- Cognitive: Memory, logic, numbers, speed → Role fit
- Drive & Risk: Motivation, risk-taking, reading people → What drives them
- Job Simulation: Your real business case → Role fit
- Screenshots: assets/module-personality.jpg, module-cognitive.jpg, module-drive.jpg, module-simulation.jpg
Notes: "You don't need all four. I'll show you what we'd recommend for you."

### Slide 7: What you get
Purpose: show the output HR actually uses. The screenshot must be readable.
- Headline: "Can they do the job? Will they fit in? What drives them?"
- Screenshot: assets/report-suitability.jpg, with these four labels pointing to the relevant parts: Role fit · Culture fit · Motivation drivers · Recommendation
- Video (presenting only): assets/report-demo.mp4 plays muted and looping in place of the screenshot, without the labels. The PDF keeps the screenshot and labels.
- Footer: "Ready the next day."
Notes: "This is what your team opens the next morning."

### Slide 8: Why trust it
Purpose: answer the skeptical psikolog in the room.
- Headline: "The science behind the games."
- Four pillars, each a title and one proof line:
  - Proven science: "Built on the Big Five and established cognitive science."
  - Built by psychologists: "A rigorous four-step process: theory, items, validation, norming."
  - Measured against traditional tests: "Game validity lines up with established psychological tests."
  - Established local norms: "Benchmarked on thousands of Indonesian candidates. 100% local data."
Notes: "Don't just trust us. Check it in a pilot."

### Slide 9: Personality Assessment packages
Purpose: make the decision easy: show the packages and their prices together.
- Headline: "Personality Assessment Packages"
- Four package cards (name, candidates, price, price per candidate, validity):
  - Pilot: 5 candidates, Rp999,000, ≈ Rp199,800 per candidate, valid 1 month
  - Business: 28 candidates, Rp4,999,000, ≈ Rp178,500 per candidate, valid 3 months
  - Growth: 60 candidates, Rp9,999,000, ≈ Rp166,700 per candidate, valid 4 months
  - Enterprise: 100 candidates, Rp15,999,000, ≈ Rp160,000 per candidate, valid 6 months
- "Every package includes": Personality profile, Competency profile, Suitability recommendation, 50–60 minute test, Report in 1 working day
Notes: Every package has the same test and report. Bigger packages cost less per candidate and stay valid longer.

### Slide 10: Cognitive Assessment packages
Purpose: the same decision for Cognitive, and show that adding Drive & Risk makes each test cheaper.
- Headline: "Cognitive Assessment Packages"
- Two package cards (name, candidates, price, price per test, tests and duration); price per test is the highlighted line on both, so they compare directly:
  - Cognitive: 100 candidates, Rp9,900,000, Rp99,000 per test, 1 test · 30 minutes
  - Cognitive + Drive & Risk: 60 candidates, Rp9,999,000, ≈ Rp83,300 per test, then a smaller "≈ Rp166,700 per candidate", 2 tests · 1 hour
- "Both packages include": Summarized batch report, Report in 1 working day, 3-month validity
Notes: Cognitive alone is Rp99,000 per test. Adding Drive & Risk brings each test down to about Rp83,300.

### Slide 11: Pilot
Purpose: the ask. They should leave knowing exactly what the next step is: a free trial, then a profile built for their roles.
- Headline: "Try it free. We'll tailor it to your roles."
- Free trial: see a real report before you buy
- Free sampling: a few of your best people play the games
- From them, we build a suitability profile for each role
- No long-term contract. Buy a package when you need it.
- Contact: [Name] · [WhatsApp] · admin@deushcs.com · www.deushcs.com
Notes: Offer one free candidate for the trial. "Which role is hardest for you to hire right now? Let's start there."

### Appendix
Purpose: reference slides, opened only when someone asks. Design them simpler than the main deck but in the same visual system. Start with an "Appendix" divider slide.
- A1: Example role & culture profiles (e.g., Finance vs Sales; example using company values): placeholder
- A2–A5: One slide per module (Personality, Cognitive, Drive & Risk, Job Simulation): full measures list + screenshot + matching report section, as placeholders
- A6: Report types: Individual report · Batch ranking by role / MT track · Interactive dashboard
- A7: Platform features: bulk upload, automatic reminders, live progress tracking, cut-off flagging, role-based access
- A8: How we built it: Theory → Item development → Validation → Norming
- A9: Full pricing table (price per candidate, IDR):
  | Modules | Starter (≤250 candidates) | Growth (251–10,000 candidates) |
  | 1 | 99,000 | 69,000 |
  | 2 | 169,000 | 119,000 |
  | 3 | 229,000 | 159,000 |
  | 4 (full suite) | 279,000 | 199,000 |
  Footer: "Minimum order Rp10 juta."
- A10: Candidate data handling under UU PDP: "[confirm details with team]"
- A11: Research: fit and retention: "[summary + source]"

## Step 2: After I pick a direction
1. Build deck.html in the chosen direction.
2. Run the export script and produce the PDF.
3. Screenshot every page of the PDF and check it: no text overflow, nothing overlapping or cut off, consistent styling across slides, backgrounds printed. Fix any problems and re-export.
4. Generate placeholders.md.
5. Report back: which assets were missing, and any design trade-offs you made.
