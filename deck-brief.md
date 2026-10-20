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
- "Prepared for [Company]" + client logo placeholder
- DEUS logo
Notes: Open with: "Most tests only check if someone can do the job. We also check if they belong in your company."

### Slide 2: Proof
Purpose: build credibility immediately. The numbers should hit hard.
- Headline: "Telkom Group trusts us with its MT selection. 2 years running."
- Stats: 1,000+ MT candidates · 7 companies (Telkom + 6 subsidiaries) · 30+ provinces, all at once · Results in 1 day
- Quote: "Kami sangat terbantu dengan profesionalitas sepanjang persiapan hingga proses akhirnya." — Ibu Lina, Telkom Group Selection
- Photo: assets/telkom-photo.jpg, caption "Graha Merah Putih, Bandung"
Notes: "Before I explain anything, this is what it looks like at scale."

### Slide 3: Problem
Purpose: make them recognize their own pain.
- Headline: "Today's psikotes checks if they can do the job. Not if they'll fit, or stay."
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
- Footer: "Profiles ready in [X] days."
Notes: "Same games, different definition of success. Culture fit means your values written down, not 'people like us.'"

### Slide 5: Video
Purpose: show the product working, from game to result.
- Headline: "From game to fit score in 60 seconds."
- Video: assets/demo.mp4 (with controls). In the PDF, show the poster image assets/demo-poster.jpg plus "Watch the demo: [link]" and a QR code placeholder.
- Quote: "Tidak terasa seperti psikotest. Sangat menyenangkan!" — Telkom MT candidate
Notes: "While she played the balloon game, it measured how she takes risks and learns from mistakes. That feeds directly into her fit."

### Slide 6: What it measures
Purpose: answer "what exactly do you measure?" without overwhelming them.
- Headline: "Four modules feed the suitability score."
- Personality: work style, values, teamwork → culture fit
- Cognitive: memory, logic, numbers, speed → role fit
- Drive & Risk: motivation, risk-taking, reading people → what drives them
- Job Simulation: your real business case → role fit
- Screenshots: assets/module-personality.jpg, module-cognitive.jpg, module-drive.jpg, module-simulation.jpg
- Footer: "Bahasa Indonesia · Any phone · [X] minutes · Anti-cheat built in"
Notes: "You don't need all four. I'll show you what we'd recommend for you."

### Slide 7: What you get
Purpose: show the output HR actually uses. The screenshot must be readable.
- Headline: "Can they do the job? Will they fit in? What drives them?"
- Screenshot: assets/report-suitability.jpg, with these four labels pointing to the relevant parts: Role fit · Culture fit · Motivation drivers · Recommendation
- Footer: "Ready the next day."
Notes: "This is what your team opens the next morning."

### Slide 8: Why trust it
Purpose: answer the skeptical psikolog in the room.
- Headline: "Built for Indonesians. Built by psikolog."
- Big Five + established cognitive science
- Benchmarked on [X,000] Indonesian candidates
- Matches [test name] (r = [X])
- Designed by [names, M.Psi., Psikolog]
Notes: "Don't just trust us. Check it in a pilot."

### Slide 9: Your package
Purpose: make the decision easy: show the value and the price together.
- "What it changes":
  - Hires who fit the role and your culture
  - See what drives each person before you hire
  - Shortlist in 1 day, not [X weeks]
  - [Telkom: X% of MT hires still with the company after Y years]
- "Recommended for your [MT program]":
  - All applicants: Cognitive + Drive & Risk
  - Finalists: + Job Simulation
  - Rp119,000 per candidate
  - 1,000 applicants ≈ Rp119 juta
- Small print: "Role setup [included]. Minimum order Rp10 juta."
Notes: Swap the package for each client. Campus: Personality + Cognitive. Leadership: Personality + Drive & Risk.

### Slide 10: Pilot
Purpose: the ask. They should leave knowing exactly what the next step is.
- Headline: "Start with one role. See if we pick who you'd pick."
- [30–50] candidates, [free]
- Your best long-serving people play too, so we can check our profile matches them
- We follow up on pilot hires after [6–12] months
- No contract
- Contact: [Name] · [WhatsApp] · admin@deushcs.com · www.deushcs.com
Notes: "Which role is hardest for you to hire right now? Let's start there."

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
