# Ventura Himself // GitHub Pages

Personal GitHub Pages site with live stats from the GitHub API
(repos, stars, followers, recent commits).

## Deploy

1. Repo must be named `venturahimself.github.io`.
2. Put `index.html`, `style.css`, `script.js`, `logo.svg` in the **root** of the repo (not in a subfolder).
3. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.

Site appears at https://venturahimself.github.io

No build step or dependencies. Stats are fetched in the visitor's browser
from the unauthenticated GitHub API (cached 10 min in localStorage).
