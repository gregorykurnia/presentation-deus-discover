# Indonesian site (Asesmen Berbasis Game DEUS)

A second Vercel project builds this folder (Root Directory `sites/id`). It serves the deck
from `content/deck-id.json`, the Indonesian version of the Canva "Asesmen Berbasis Game
DEUS", with the same layouts as the English deck. Rules that only the Indonesian copy needs
live in `src/styles/lang-id.css` (scoped to `html[lang="id"]`).

- Build locally: `npm run build:id` (output in `dist/id/offline/`), check with `npm run qa:id`.
- Production deploys from `main`, like the English deck; `staging` is ignored.
