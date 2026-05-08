# Coach Clips

A mobile-first web app for saving YouTube drill clips, organizing them into practice plans, and reviewing them quickly before practice.

## What is included

- YouTube clip library with start and optional end times
- Categories, tags, favorites, and notes
- Practice plans / playlists
- Reorder clips inside a plan
- Compact notes that can stay collapsed
- Portrait and landscape-friendly layout
- Manual Load from GitHub and Save to GitHub
- Local browser draft save for crash protection
- Import/export JSON backup

## Suggested GitHub repo structure

```text
coach-clips/
  index.html
  styles.css
  app.js
  data/
    drills.json
```

The app expects the JSON path to be `data/drills.json` unless you change it in the GitHub settings panel.

## GitHub Pages

Enable GitHub Pages from the repository settings and publish from the main branch. This app is fully static, so it does not require a server.

## GitHub token

Create a fine-grained personal access token with Contents read/write access to only this repository. Do not hard-code the token into the app. Paste it into the GitHub settings panel on each device you want to use for editing.

## First use

Important: do not test the app by double-clicking `index.html` and running it as a `file://` page. YouTube embeds and GitHub API saves are more reliable when the app is served over `http://` or `https://`. Best option: publish it with GitHub Pages. For quick local testing, run `python -m http.server 8000` from this folder and open `http://localhost:8000`.

1. Open the app.
2. Click GitHub.
3. Enter owner, repo, branch, JSON path, and token.
4. Click Load from GitHub or start editing locally.
5. Click Save to GitHub when you want to permanently save changes.

## Important note

This app intentionally does not auto-save to GitHub. It only saves locally in the browser until you click Save to GitHub.


## Troubleshooting

### YouTube says Error 153 or Watch on YouTube

This usually happens when the app is opened directly as a local file or when the specific YouTube video blocks embedding. Use GitHub Pages or a local web server first. If one video still fails but others work, that video probably does not allow embedding.

### GitHub Save says Failed to fetch

Use GitHub Pages or a local web server instead of opening `index.html` directly. Also confirm the token is a fine-grained token for this one repo with Contents read/write access, and that the owner, repo, branch, and JSON path are correct.
