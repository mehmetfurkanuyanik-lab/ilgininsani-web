# Ilgın İnsanı — city and newsroom

The original logo is `logo.jpeg`. The homepage uses a real-time Three.js city illustration and native scroll-driven camera journey. The model is an artistic interpretation inspired by Ilgın, not a surveyed digital twin. Photographic city guide assets are preserved from the existing repository. Three.js 0.186.1 is vendored locally under its MIT license. Reduced-motion and WebGL fallback layouts remain readable.

## Runtime and deployment

Dockerfile → Python 3.13 / Gunicorn / Flask. Container port **8080**. Coolify build pack **Dockerfile**, base directory `/`, Dockerfile `/Dockerfile`, domain `https://ilgininsani.com`. Add a **persistent named volume at `/data`** before deployment. No host port mapping, elevated Docker capabilities or pre/post commands are required. `/api/health` is the health endpoint. Set `PUBLIC_ORIGIN=https://ilgininsani.com` (also the default). One Gunicorn worker with four threads owns the hourly importer; do not increase worker count without separating the scheduler.

SQLite (`/data/news.sqlite`) stores articles, publication settings, audit history and server-side sessions; uploaded/imported photographs live in `/data/media`. Back up the complete volume regularly and before migrations. Deploying a new image preserves this volume. Source code stays in GitHub.

## News and admin

`/admin/` is the newsroom. It verifies the existing administrator password against the existing `dashboard-login` n8n webhook; no new password is embedded or created. Passwords are not stored. Sessions are random, hashed in SQLite and sent in HttpOnly/Secure/SameSite cookies. Mutations require both an exact origin and CSRF token. Login has a persistent attempt limit. Admin APIs fail closed when the auth gateway is unavailable.

The Ilgın Kaymakamlığı homepage is checked on startup and hourly. New articles and photos are imported once; dates and source links remain visible. Short source excerpts link to the complete original. The importer fetches only the allowlisted official host, with bounded sizes/timeouts and redirect validation. Images are decoded and re-encoded as WebP. Automatic publication is initially enabled and can be switched off to collect drafts. Editing or archiving imported stories persists across later imports. Archive is reversible through the editor. New original articles and photos can be created in the panel.

`/api/news` supplies published stories. `/haber/<id>` renders shareable server-side article pages. `/sitemap-news.xml` lists published articles. `sitemap.xml` contains main pages. Existing `esnaf.html`, `dashboard.html`, `istatistik.html` and their flows are preserved. All 15 original advertising prices and application query parameters are preserved at `/reklam/`. The previous application presentation is at `/uygulama.html`.

Existing city-service webhooks and Open-Meteo weather remain integrated. Empty pharmacy data is reported honestly; it is not fabricated. Contact tests use mocks and never send test messages. The service worker caches neither APIs nor page HTML, and clears old page caches.

## Recovery

Before redesign production was `0559196bc9ca5554a584b3503a472ef1d4c91f92`. A full Git bundle was saved outside the repo. Coolify also held an image at that SHA (2026-06-26 21:08:47 UTC). Previous runtime: Static, nginx:alpine, exposed port80, base `/`, no port mappings/options/deployment hooks. To restore the prior image, restore exposed port80 and select that SHA under Rollback; reverting source requires returning the build pack to Static before rebuilding. Preserve `/data` during rollback.

## Illustration

`creative-3d.webp` was generated with the built-in image-generation tool: an abstract orange ribbon around a porcelain arch, aluminium sphere and amber glass slab on an off-white studio background. It is decorative artwork, not a photograph of Ilgın.
