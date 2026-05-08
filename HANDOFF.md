# Coach Clips — Handoff.md

## Latest Codex Update - 2026-05-08

Stabilization pass completed in this workspace:

- Fixed the GitHub load lifecycle by normalizing all loaded/imported JSON before rendering or cueing the player.
- Added compatibility for both current app fields (`videoId`, `start`, `end`) and the handoff schema fields (`youtubeId`, `startSeconds`, `endSeconds`), including source-video fallback lookup.
- Replaced the fragile load-time cue path with a canonical `cueCurrentClip()` function and exposed `window.cueClip` as a compatibility alias so older callsites cannot fail with `cueClip is not defined`.
- Restored the selected plan/clip safely from `data.settings.lastSelectedPlaylistId` and `data.settings.lastSelectedClipId`, falling back to the first valid plan clip or first library clip.
- Player cueing now handles missing clips and invalid/missing YouTube IDs without crashing, and valid clips use a plain iframe embed URL with the requested start time.
- Save to GitHub now normalizes data, records the current selected plan/clip in `settings`, updates `updatedAt`, and still sends the GitHub Contents API PUT with the known SHA when available.
- Load from GitHub now shows a friendly message if the JSON file does not exist yet, so Save to GitHub can create it.
- Clip, plan, and settings dialogs now use explicit submit/close button types. Save runs validation and closes on success; Delete and Cancel close without browser validation.
- Plan reorder buttons no longer assign to top-level state directly from inline HTML; they call a small global helper instead.

Verification performed:

- `node --check app.js` passes.
- Script-level harness verified a mocked GitHub GET with handoff-style JSON loads without a `cueClip` error.
- The harness verified the loaded clip rendered, the generated YouTube iframe URL included `/embed/M7lc1UVf-VE?start=35`, and Save to GitHub issued a mocked PUT with the existing SHA.
- The harness verified clip save closes the clip dialog, plan save closes the plan dialog, and Cancel closes an invalid clip dialog without validation.

Remaining notes:

- This workspace is not currently a git repository, so no git diff/status or commit verification was possible here.
- The in-app browser blocked opening the local `127.0.0.1` test URL in this session, so visual/mobile verification on an actual rendered page still needs to be done from GitHub Pages or another browser session.
- Real GitHub save/load was not exercised with a live token; it was verified with mocked GitHub Contents API responses only.

## Project Summary

Coach Clips is a mobile-first web app for organizing and reviewing basketball drill clips from YouTube. The app is meant primarily for pre-practice review, not necessarily for live use during practice. The user wants to build practice plans/playlists, quickly review the clips before practice, and sync the data between desktop and phone without paid services.

GitHub repository: https://github.com/BBuisson188/coach-clips

The chosen architecture is:

- Static web app hosted on GitHub Pages
- Persistent app data stored in a JSON file in the same GitHub repository
- Manual GitHub save/load using GitHub REST API
- Local browser draft storage only for crash protection
- No automatic save to GitHub
- No Firebase/Supabase for the first version
- No paid services

## Windows Git / Codex Permission Recovery

This repo is now properly connected to GitHub over SSH.

Remote:

```text
git@github.com:BBuisson188/coach-clips.git
```

Branch:

```text
main tracks origin/main
```

Future publishing should use normal local Git:

```powershell
git add .
git commit -m "message"
git pull --rebase
git push
```

Do not use GitHub API publishing unless local Git is truly impossible. Do not use HTTPS credentials.

For future ACL, `index.lock`, or `FETCH_HEAD` permission failures, ask the user to run this from normal local PowerShell:

```powershell
cd "C:\Users\bbuis\Local Docs\Codex\coach-clips"

icacls .git /reset /T
icacls .git /inheritance:d /T

git status
```

If `git status` works, continue the normal workflow:

```powershell
git add .
git commit -m "message"
git pull --rebase
git push
```

If a rebase conflict is already in progress, use:

```powershell
git add HANDOFF.md src/game.js src/level1-data.js
git rebase --continue
git status
git push -u origin main
```

Additional Windows Git notes:

- If Git opens the commit message editor during `git rebase --continue`, it may be Vim.
- To save and exit Vim:
  1. Press `Esc`
  2. Type `:wq`
  3. Press Enter
- LF -> CRLF warnings on Windows are normal and can usually be ignored.
- If Git opens a long output pager and shows `(END)`, press `q` to return to PowerShell.

Working app name: **Coach Clips**

---

## Current State

The app has gone through several early zipped versions in ChatGPT:

- `coach-clips.zip`
- `coach-clips-v2.zip`
- `coach-clips-v3.zip`

The current user reports:

1. **Save to GitHub works.**
2. **Load from GitHub fails** with:
   - `Load failed. cueClip is not defined`
3. This happens on both desktop and phone when running from GitHub Pages.
4. This strongly suggests:
   - GitHub credentials are correct.
   - The app can reach GitHub.
   - The JSON file is being fetched and parsed.
   - The failure happens after load, while rebuilding state or trying to restore/cue the current player clip.

Codex should start by inspecting and fixing the `cueClip` reference/lifecycle issue.

---

## Most Important Known Bug

### Bug: `cueClip is not defined` after Load from GitHub

User clicks **Load from GitHub** and receives:

```text
Load failed. cueClip is not defined
```

Likely causes:

- `cueClip(...)` is called but the function no longer exists.
- Function was renamed but callsite was not updated.
- Function exists inside a scope but is not available where the load handler calls it.
- Load runs before player initialization has completed.
- App tries to cue a clip immediately after replacing state, but player state/render state is not ready.

Desired behavior:

- Load from GitHub should fetch the JSON file.
- Validate and normalize the data.
- Replace current app state.
- Render the Library/Plans/Review UI.
- Select a reasonable current clip if one exists.
- Cue/load the clip safely only after the player iframe/render elements exist.
- If there are no clips, show a friendly empty state.
- Loading should not crash if no current clip exists.

Implementation recommendation:

- Search for all references to `cueClip`.
- Either restore a single canonical `cueClip(clipId)` / `cueCurrentClip()` function or replace all references with the current player-loading function.
- Keep all player loading behind a safe guard:
  - no selected clip → render empty player state
  - invalid YouTube ID → show link/error state
  - valid YouTube ID → set iframe `src`
- Avoid using a function before declaration if using `const cueClip = ...` style.
- Prefer named function declarations for app-level functions that are called from multiple places.

---

## Core Product Requirements

### Primary use case

The user wants to prepare for basketball practice by reviewing a short list of drill clips. Example:

> “These are the five drills we’re doing today. I want to quickly watch the useful part of each video so I remember how I want to teach them.”

This is not primarily a live-practice playback tool, though it may be used courtside sometimes.

---

## Main Concepts

### 1. Source Video

A source video represents one YouTube video.

A single YouTube video may contain several useful drill clips.

Suggested fields:

```json
{
  "id": "src_...",
  "type": "youtube",
  "youtubeId": "abc123",
  "url": "https://www.youtube.com/watch?v=abc123",
  "title": "Original video title or user title",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

The app does not need to fetch official YouTube metadata in v1. User-entered titles are fine.

---

### 2. Clip / Drill

A clip is the actual usable drill segment.

Suggested fields:

```json
{
  "id": "clip_...",
  "sourceId": "src_...",
  "title": "Closeout drill",
  "category": "Defense",
  "tags": ["closeouts", "footwork"],
  "startSeconds": 35,
  "endSeconds": 70,
  "notes": "Emphasize chopping feet and high hands.",
  "favorite": false,
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

Rules:

- Start time is required.
- End time is optional.
- Accept time entry formats like:
  - `35`
  - `0:35`
  - `1:05`
  - `1:02:10`
- Store times as seconds internally.

---

### 3. Playlist / Practice Plan

A playlist is an ordered list of clip IDs.

Suggested fields:

```json
{
  "id": "plan_...",
  "title": "Practice Plan for Today",
  "notes": "Emphasis: spacing, passing angles, and communication.",
  "clipIds": ["clip_1", "clip_2", "clip_3"],
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

Rules:

- Playlists must support reordering clips.
- Reordering should be easy on desktop and usable on phone.
- Drag-and-drop is nice, but up/down buttons are acceptable and often more reliable on mobile.
- A clip can appear in multiple playlists.
- A playlist should have its own notes field.

---

## JSON Data File

Default repo file path should be something like:

```text
data/coach-clips.json
```

Suggested top-level structure:

```json
{
  "schemaVersion": 1,
  "appName": "Coach Clips",
  "updatedAt": "ISO timestamp",
  "subjects": [
    {
      "id": "basketball",
      "name": "Basketball"
    }
  ],
  "sources": [],
  "clips": [],
  "playlists": [],
  "settings": {
    "defaultSubjectId": "basketball",
    "lastSelectedPlaylistId": null,
    "lastSelectedClipId": null
  }
}
```

The `subjects` field is future-proofing only. Do not overbuild UI around it in v1. The app can simply default to Basketball.

---

## GitHub Storage Requirements

The app should allow the user to enter:

- GitHub owner
- Repo name
- Branch, probably `main`
- JSON path, default `data/coach-clips.json`
- Fine-grained GitHub token or classic token with repo contents write permission

### Load from GitHub

Desired behavior:

- Fetch the configured file from GitHub using the Contents API.
- If the file exists:
  - decode base64 content
  - parse JSON
  - normalize data
  - render app
- If the file does not exist:
  - show a friendly message explaining that save can create it
  - do not crash

### Save to GitHub

Desired behavior:

- Save only when user clicks **Save to GitHub**.
- Do not auto-save to GitHub.
- Use GitHub Contents API to create/update the JSON file.
- If updating an existing file, include the file SHA.
- Show clear success/failure messages.
- Do not expose token in UI logs or error messages.

### Local storage

Local storage is allowed only for:

- GitHub settings
- User’s token, if the user chooses to store it locally
- Unsaved draft app data for crash protection

Do not treat local storage as canonical once GitHub save/load is configured.

---

## UI Requirements

### App tabs / sections

Recommended tabs:

1. **Review**
2. **Library**
3. **Plans**
4. **Settings**

---

## Review Screen

This is the most important screen.

The user wants to quickly review the current practice plan.

### Portrait phone layout

Top:

- Video player
- Current clip title
- Big buttons:
  - Play Clip
  - Replay
  - Previous
  - Next

Middle:

- Selected plan name
- Ordered clip list
- Each row should be compact:
  - title
  - category
  - start/end time
  - maybe thumbnail
  - reorder controls if in plan edit mode

Bottom / collapsible:

- Clip notes
- Playlist notes
- Edit controls

### Landscape phone layout

Goal: bigger video, less clutter.

- Video should get most of the screen.
- Clip list can be a narrow side panel or collapsible panel.
- Notes should be hidden/collapsed by default.

### Notes behavior

Notes should be tidy:

- Default collapsed or 2-line preview.
- Tap to expand.
- Allow long notes to be readable without dominating the screen.
- Playlist notes and clip notes should both exist.

---

## Library Screen

The Library is the master list of saved clips.

Required features:

- Add clip
- Edit clip
- Delete clip
- Duplicate clip
- Favorite clip
- Search clips
- Filter by category
- Filter by tag
- Add clip to playlist/practice plan

### Important modal/form behavior

User reported current modal behavior is glitchy.

Required fixes:

- After clicking **Save Clip**, save and close the modal/dialog.
- After clicking **Delete**, delete and close the modal/dialog.
- **Cancel** must always close the modal/dialog, even if required fields are empty.
- Cancel should not trigger browser form validation.
- Buttons that should not submit the form must use `type="button"`.
- Save buttons should be the only submit buttons.

---

## Plans Screen

Required features:

- Create playlist/practice plan
- Edit plan title
- Edit plan notes
- Delete plan
- Add clips to plan
- Remove clips from plan
- Reorder clips in plan
- Open plan in Review mode

Reordering is important. If drag-and-drop is used, also consider up/down controls for reliable mobile use.

---

## YouTube Playback Requirements

The app needs reliable YouTube playback inside GitHub Pages.

Supported URL inputs:

- `https://www.youtube.com/watch?v=VIDEOID`
- `https://youtu.be/VIDEOID`
- `https://www.youtube.com/shorts/VIDEOID`
- URLs with extra query params such as `&t=35s`

Playback behavior:

- Embed video with start time.
- Optional end time can be handled by embed query parameter or JavaScript timer.
- Replay should reload/cue the same clip from `startSeconds`.
- Next/Previous should move through selected playlist.
- If embed fails because YouTube disallows embedding, show a friendly fallback link to watch on YouTube.

### Known video/player issues so far

Earlier versions showed:

- YouTube Error 153 / player configuration error
- Black player area with no playback

Codex should test and simplify the embed approach.

Recommended robust approach:

- Use a plain iframe embed URL:

```text
https://www.youtube.com/embed/VIDEO_ID?start=START_SECONDS&rel=0&modestbranding=1&playsinline=1
```

- Only add `end=END_SECONDS` if it works reliably.
- Make sure iframe includes:

```html
allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
allowfullscreen
```

- Do not depend on autoplay; mobile browsers may require the user to tap play.
- A black player may be due to invalid ID, bad iframe src, CSS sizing issue, or YouTube restrictions.

---

## iPhone Photo Library Videos

This is a future feature, not required for current v1 stabilization.

Possible future behavior:

- Let user pick a local video from iPhone using a file input with `accept="video/*"`.
- Let user review it locally in the app.

Caution:

- GitHub is not a good video hosting/storage backend.
- Do not upload large personal videos to the GitHub repo in v1.
- Local/private video sync should be handled later with a different storage approach if needed.

---

## What Not To Build Yet

Do not spend time on these unless the user asks later:

- Printing practice plans
- Sharing practice plans
- Player-facing notes vs coach-only notes
- Multiple user accounts
- Firebase/Supabase
- Paid services
- Complex subject/sport UI
- Uploading personal videos to GitHub

---

## Immediate Codex Task List

1. Inspect the current app files.
2. Reproduce or trace the `cueClip is not defined` load error.
3. Fix the load lifecycle so GitHub loading cannot crash after parsing JSON.
4. Verify Save to GitHub still works.
5. Verify Load from GitHub works after saving.
6. Fix/verify modal form behavior:
   - Save closes modal
   - Delete closes modal
   - Cancel always closes modal without validation
7. Verify YouTube player behavior on GitHub Pages:
   - valid YouTube link loads
   - start time works
   - replay works
   - next/previous works
8. Make sure the app remains mobile-friendly.
9. Update this `HANDOFF.md` with what was changed and any remaining issues.

---

## Development Preference

The user prefers clean, maintainable development over quick throwaway prototypes. Avoid creating fragile patches that make the app convoluted. Keep the code organized and simple.

The user is okay with Codex refactoring the app if needed to make it more stable.

Prioritize:

1. Reliability
2. Clean state management
3. Mobile usability
4. Clear GitHub save/load behavior
5. Simple UI

---

## Suggested Acceptance Test

After Codex changes, this should work:

1. Open app from GitHub Pages.
2. Enter GitHub settings.
3. Add a YouTube clip with title, category, start time, and note.
4. Save clip.
5. Confirm modal closes.
6. Create a practice plan.
7. Add the clip to the plan.
8. Save to GitHub.
9. Refresh the browser.
10. Click Load from GitHub.
11. Confirm no `cueClip` error.
12. Confirm clip and plan appear.
13. Open Review mode.
14. Confirm video loads.
15. Click Replay, Next, Previous.
16. Test on desktop and phone.
