const STORAGE_KEY = 'coachClipsData.v1';
const SETTINGS_KEY = 'coachClipsGithub.v1';

const defaultData = {
  schemaVersion: 1,
  appName: 'Coach Clips',
  subjects: ['basketball'],
  sources: [],
  clips: [
    {
      id: crypto.randomUUID(),
      sourceId: 'sample-source-1',
      title: 'Sample: Defensive Closeout',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      start: 35,
      end: 55,
      category: 'Defense',
      tags: ['closeout', 'footwork'],
      notes: 'Replace this sample with your own YouTube drill. Notes stay collapsed until you need them.',
      favorite: false,
      subject: 'basketball',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  playlists: [
    {
      id: 'sample-plan-1',
      title: 'Practice Plan for Today',
      notes: 'Emphasis: effort, spacing, and communication.',
      clipIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  updatedAt: new Date().toISOString()
};
defaultData.playlists[0].clipIds = [defaultData.clips[0].id];

let data = loadLocal() || structuredClone(defaultData);
let settings = loadSettings();
let currentClipId = data.playlists[0]?.clipIds[0] || data.clips[0]?.id || null;
let currentPlanId = data.playlists[0]?.id || null;
let githubSha = null;
let dirty = false;

function $(id) { return document.getElementById(id); }
function saveLocal() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function loadLocal() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; } }
function markDirty(message = 'Unsaved local changes') { dirty = true; data.updatedAt = new Date().toISOString(); saveLocal(); setStatus(message); renderAll(); }
function setStatus(text) { $('statusText').textContent = text; }
function getClip(id = currentClipId) { return data.clips.find(c => c.id === id); }
function getPlan(id = currentPlanId) { return data.playlists.find(p => p.id === id); }
function nowIso() { return new Date().toISOString(); }
function formatTime(seconds = 0) {
  seconds = Number(seconds) || 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}
function parseTime(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value.trim())) return Number(value.trim());
  const parts = value.split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((acc, part) => acc * 60 + part, 0);
}
function parseYouTubeId(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.split('/').filter(Boolean)[0];
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    if (u.pathname.includes('/embed/')) return u.pathname.split('/embed/')[1]?.split('/')[0];
  } catch {}
  return url.trim().match(/^[a-zA-Z0-9_-]{11}$/) ? url.trim() : '';
}
function thumbnail(videoId) { return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`; }

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map(t => t.trim()).filter(Boolean);
  return [];
}
function normalizeAppData(raw = {}) {
  const now = nowIso();
  const sources = Array.isArray(raw.sources) ? raw.sources : [];
  const sourceById = new Map(sources.map(source => [source.id, source]));
  const clips = (Array.isArray(raw.clips) ? raw.clips : []).map(clip => {
    const source = sourceById.get(clip.sourceId) || {};
    const youtubeUrl = clip.youtubeUrl || clip.url || source.url || '';
    const videoId = clip.videoId || clip.youtubeId || source.youtubeId || parseYouTubeId(youtubeUrl);
    return {
      id: clip.id || crypto.randomUUID(),
      sourceId: clip.sourceId || source.id || '',
      title: clip.title || source.title || 'Untitled clip',
      youtubeUrl,
      videoId,
      start: Number(clip.start ?? clip.startSeconds ?? 0) || 0,
      end: clip.end ?? clip.endSeconds ?? null,
      category: clip.category || '',
      tags: normalizeTags(clip.tags),
      notes: clip.notes || '',
      favorite: Boolean(clip.favorite),
      subject: clip.subject || raw.settings?.defaultSubjectId || 'basketball',
      createdAt: clip.createdAt || now,
      updatedAt: clip.updatedAt || clip.createdAt || now
    };
  }).map(clip => ({ ...clip, end: clip.end === '' || clip.end == null ? null : Number(clip.end) || null }));
  const clipIds = new Set(clips.map(clip => clip.id));
  const playlists = (Array.isArray(raw.playlists) ? raw.playlists : []).map(plan => ({
    id: plan.id || crypto.randomUUID(),
    title: plan.title || 'Untitled plan',
    notes: plan.notes || '',
    clipIds: Array.isArray(plan.clipIds) ? plan.clipIds.filter(id => clipIds.has(id)) : [],
    createdAt: plan.createdAt || now,
    updatedAt: plan.updatedAt || plan.createdAt || now
  }));
  const subjects = Array.isArray(raw.subjects) && raw.subjects.length ? raw.subjects : ['basketball'];
  return {
    schemaVersion: raw.schemaVersion || 1,
    appName: raw.appName || 'Coach Clips',
    subjects,
    sources,
    clips,
    playlists,
    settings: {
      defaultSubjectId: raw.settings?.defaultSubjectId || 'basketball',
      lastSelectedPlaylistId: raw.settings?.lastSelectedPlaylistId || null,
      lastSelectedClipId: raw.settings?.lastSelectedClipId || null
    },
    updatedAt: raw.updatedAt || now
  };
}
function rememberSelection() {
  data.settings = data.settings || {};
  data.settings.lastSelectedPlaylistId = currentPlanId || null;
  data.settings.lastSelectedClipId = currentClipId || null;
}
function setCurrentFromData() {
  const requestedPlanId = data.settings?.lastSelectedPlaylistId;
  currentPlanId = data.playlists.some(p => p.id === requestedPlanId) ? requestedPlanId : data.playlists[0]?.id || null;
  const plan = getPlan();
  const requestedClipId = data.settings?.lastSelectedClipId;
  currentClipId = data.clips.some(c => c.id === requestedClipId)
    ? requestedClipId
    : plan?.clipIds.find(id => data.clips.some(c => c.id === id)) || data.clips[0]?.id || null;
}

function getSafeOriginParam() {
  return window.location.protocol === 'http:' || window.location.protocol === 'https:'
    ? `&origin=${encodeURIComponent(window.location.origin)}`
    : '';
}
function getEmbedUrl(clip, autoplay = false) {
  if (!clip?.videoId) return '';
  const params = [
    `start=${Number(clip.start) || 0}`,
    clip.end ? `end=${Number(clip.end)}` : '',
    autoplay ? 'autoplay=1' : '',
    'playsinline=1',
    'rel=0',
    'modestbranding=1'
  ].filter(Boolean).join('&');
  return `https://www.youtube.com/embed/${encodeURIComponent(clip.videoId)}?${params}${getSafeOriginParam()}`;
}
function setPlayerFrame(clip, autoplay = false) {
  const wrap = document.querySelector('.video-wrap');
  if (!wrap) return;
  if (!clip?.videoId) {
    const message = clip ? 'This clip needs a valid YouTube link' : 'Choose a clip';
    wrap.innerHTML = `<div id="player" class="player-placeholder">${escapeHtml(message)}</div>`;
    return;
  }
  wrap.innerHTML = `<iframe id="player" src="${getEmbedUrl(clip, autoplay)}" title="${escapeHtml(clip.title || 'YouTube clip')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  $(`${name}Tab`).classList.add('active');
}
function renderAll(keepPlayer = true) {
  renderPlanSelects(); renderCategoryFilter(); renderReview(); renderLibrary(); renderPlans();
  if (!keepPlayer) return;
  const clip = getClip();
  if (clip) {
    $('nowCategory').textContent = `${clip.category || 'Uncategorized'} • ${formatTime(clip.start)}${clip.end ? `–${formatTime(clip.end)}` : ''}`;
    $('nowTitle').textContent = clip.title;
    $('clipNotes').textContent = clip.notes || 'No notes yet.';
    $('favoriteBtn').textContent = clip.favorite ? '★' : '☆';
  } else {
    $('nowCategory').textContent = 'No clip selected';
    $('nowTitle').textContent = 'Choose a clip';
    $('clipNotes').textContent = 'No notes yet.';
    $('favoriteBtn').textContent = '☆';
  }
}
function renderPlanSelects() {
  const html = data.playlists.map(p => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
  $('reviewPlanSelect').innerHTML = html;
  $('reviewPlanSelect').value = currentPlanId || data.playlists[0]?.id || '';
  $('clipPlanSelect').innerHTML = `<option value="">Do not add now</option>${html}`;
  const plan = getPlan();
  $('planNotesField').value = plan?.notes || '';
}
function renderCategoryFilter() {
  const categories = [...new Set(data.clips.map(c => c.category).filter(Boolean))].sort();
  const current = $('categoryFilter').value;
  $('categoryFilter').innerHTML = `<option value="">All categories</option>${categories.map(c => `<option>${escapeHtml(c)}</option>`).join('')}`;
  $('categoryFilter').value = current;
}
function clipCard(clip, context = 'library', index = -1) {
  const selected = clip.id === currentClipId ? 'style="border-color: rgba(56,189,248,.65)"' : '';
  return `<article class="clip-card" ${selected}>
    <div class="clip-main">
      <img class="thumb" src="${clip.videoId ? thumbnail(clip.videoId) : ''}" alt="" loading="lazy">
      <div>
        <div class="clip-title">${clip.favorite ? '★ ' : ''}${escapeHtml(clip.title)}</div>
        <div class="clip-meta">${escapeHtml(clip.category || 'Uncategorized')} • ${formatTime(clip.start)}${clip.end ? `–${formatTime(clip.end)}` : ''} ${clip.tags?.length ? '• #' + clip.tags.map(escapeHtml).join(' #') : ''}</div>
      </div>
      <button onclick="selectClip('${clip.id}', true)">Play</button>
    </div>
    ${clip.notes ? `<details><summary>Notes</summary><p>${escapeHtml(clip.notes)}</p></details>` : ''}
    <div class="card-actions">
      ${context === 'review' ? `<button onclick="moveClipInPlan('${clip.id}', -1)">↑</button><button onclick="moveClipInPlan('${clip.id}', 1)">↓</button><button onclick="removeFromPlan('${clip.id}')">Remove</button>` : ''}
      <button onclick="openClipDialog('${clip.id}')">Edit</button>
      <button onclick="duplicateClip('${clip.id}')">Duplicate</button>
      <button onclick="addClipToCurrentPlan('${clip.id}')">Add to Plan</button>
    </div>
  </article>`;
}
function renderReview() {
  const plan = getPlan();
  const clips = plan ? plan.clipIds.map(id => getClip(id)).filter(Boolean) : [];
  $('reviewList').innerHTML = clips.length ? clips.map(c => clipCard(c, 'review')).join('') : '<p class="clip-meta">No clips in this plan yet.</p>';
}
function renderLibrary() {
  const q = $('searchInput').value.toLowerCase();
  const cat = $('categoryFilter').value;
  const clips = data.clips.filter(c => {
    const hay = `${c.title} ${c.category} ${c.notes} ${(c.tags || []).join(' ')}`.toLowerCase();
    return (!q || hay.includes(q)) && (!cat || c.category === cat);
  });
  $('libraryList').innerHTML = clips.length ? clips.map(c => clipCard(c)).join('') : '<p class="clip-meta">No clips found.</p>';
}
function renderPlans() {
  $('plansList').innerHTML = data.playlists.map(plan => {
    const clips = plan.clipIds.map(id => getClip(id)).filter(Boolean);
    return `<article class="plan-card">
      <div class="plan-header"><div><strong>${escapeHtml(plan.title)}</strong><div class="clip-meta">${clips.length} clips</div></div><button onclick="openPlanDialog('${plan.id}')">Edit</button></div>
      ${plan.notes ? `<details><summary>Notes</summary><p>${escapeHtml(plan.notes)}</p></details>` : ''}
      <div class="plan-clips">${clips.map((c,i) => `<div class="drag-row"><span>${i+1}</span><span>${escapeHtml(c.title)}</span><button onclick="moveClipInSpecificPlan('${plan.id}', '${c.id}', -1)">↑</button><button onclick="moveClipInSpecificPlan('${plan.id}', '${c.id}', 1)">↓</button></div>`).join('')}</div>
    </article>`;
  }).join('');
}
function escapeHtml(str = '') { return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }


function cueCurrentClip(autoplay = false) {
  const clip = getClip();
  setPlayerFrame(clip, autoplay);
  renderAll(false);
  if (!clip) {
    $('nowCategory').textContent = 'No clip selected';
    $('nowTitle').textContent = 'Choose a clip';
    $('clipNotes').textContent = 'No notes yet.';
    $('favoriteBtn').textContent = '☆';
    return;
  }
  $('nowCategory').textContent = `${clip.category || 'Uncategorized'} • ${formatTime(clip.start)}${clip.end ? `–${formatTime(clip.end)}` : ''}`;
  $('nowTitle').textContent = clip.title || 'Untitled clip';
  $('clipNotes').textContent = clip.notes || 'No notes yet.';
  $('favoriteBtn').textContent = clip.favorite ? '★' : '☆';
}
function cueClip(autoplay = false) { cueCurrentClip(autoplay); }
window.cueClip = cueCurrentClip;

window.selectClip = function(id, autoplay = false) { currentClipId = id; rememberSelection(); cueCurrentClip(autoplay); };
window.moveClipInPlan = function(clipId, direction) {
  const plan = getPlan(); if (!plan) return;
  const i = plan.clipIds.indexOf(clipId); const j = i + direction;
  if (i < 0 || j < 0 || j >= plan.clipIds.length) return;
  [plan.clipIds[i], plan.clipIds[j]] = [plan.clipIds[j], plan.clipIds[i]];
  markDirty('Plan order changed');
};
window.moveClipInSpecificPlan = function(planId, clipId, direction) {
  currentPlanId = planId;
  rememberSelection();
  window.moveClipInPlan(clipId, direction);
};
window.removeFromPlan = function(clipId) {
  const plan = getPlan(); if (!plan) return;
  plan.clipIds = plan.clipIds.filter(id => id !== clipId);
  markDirty('Clip removed from plan');
};
window.addClipToCurrentPlan = function(clipId) {
  const plan = getPlan(); if (!plan || plan.clipIds.includes(clipId)) return;
  plan.clipIds.push(clipId); markDirty('Clip added to current plan');
};
window.duplicateClip = function(id) {
  const original = getClip(id); if (!original) return;
  const copy = { ...structuredClone(original), id: crypto.randomUUID(), title: `${original.title} copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  data.clips.push(copy); currentClipId = copy.id; rememberSelection(); markDirty('Clip duplicated'); cueCurrentClip(false);
};

window.openClipDialog = function(id = '') {
  const clip = id ? getClip(id) : null;
  $('clipDialogTitle').textContent = clip ? 'Edit Clip' : 'Add Clip';
  $('clipId').value = clip?.id || '';
  $('clipTitle').value = clip?.title || '';
  $('clipUrl').value = clip?.youtubeUrl || '';
  $('clipStart').value = clip ? formatTime(clip.start) : '';
  $('clipEnd').value = clip?.end ? formatTime(clip.end) : '';
  $('clipCategory').value = clip?.category || '';
  $('clipTags').value = clip?.tags?.join(', ') || '';
  $('clipNotesInput').value = clip?.notes || '';
  $('deleteClipBtn').style.display = clip ? 'inline-block' : 'none';
  $('clipDialog').showModal();
};
window.openPlanDialog = function(id = '') {
  const plan = id ? data.playlists.find(p => p.id === id) : null;
  $('planDialogTitle').textContent = plan ? 'Edit Plan' : 'New Plan';
  $('planId').value = plan?.id || '';
  $('planName').value = plan?.title || '';
  $('planNotesInput').value = plan?.notes || '';
  $('deletePlanBtn').style.display = plan ? 'inline-block' : 'none';
  $('planDialog').showModal();
};

function normalizeGithubSettings(raw = settings) {
  let owner = (raw.owner || '').trim();
  let repo = (raw.repo || '').trim();
  const branch = (raw.branch || 'main').trim();
  const path = (raw.path || 'data/drills.json').trim().replace(/^\/+/, '');
  const token = (raw.token || '').trim();

  // Accept either separate owner/repo fields or a pasted repo URL/slug.
  const combined = repo ? `${owner}/${repo}` : owner;
  const match = combined.match(/github\.com[/:]([^/]+)\/([^/#?]+)|^([^/]+)\/([^/#?]+)$/i);
  if (match) { owner = match[1] || match[3]; repo = match[2] || match[4]; }
  repo = repo.replace(/\.git$/i, '');

  return { owner, repo, branch, path, token };
}
async function githubRequest(method, body) {
  const { owner, repo, branch, path, token } = normalizeGithubSettings();
  if (!owner || !repo || !path || !token) throw new Error('Missing GitHub settings');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
  const url = method === 'GET' ? `${baseUrl}?ref=${encodeURIComponent(branch)}` : baseUrl;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    throw new Error(`Network request failed. If you opened index.html directly, run it through GitHub Pages or a local web server. Details: ${err.message}`);
  }
  if (!res.ok) {
    if (method === 'GET' && res.status === 404) {
      throw new Error('GitHub data file was not found. Save to GitHub can create it.');
    }
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  return res.json();
}
async function loadFromGithub() {
  setStatus('Loading from GitHub...');
  const file = await githubRequest('GET');
  githubSha = file.sha;
  const text = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ''))));
  data = normalizeAppData(JSON.parse(text));
  saveLocal(); dirty = false;
  setCurrentFromData();
  setStatus('Loaded latest GitHub JSON'); renderAll(false); cueCurrentClip(false);
}
async function saveToGithub() {
  setStatus('Saving to GitHub...');
  data = normalizeAppData(data);
  rememberSelection();
  data.updatedAt = nowIso();
  if (!githubSha) {
    try { const file = await githubRequest('GET'); githubSha = file.sha; } catch {}
  }
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  const body = { message: `Update Coach Clips data ${new Date().toLocaleString()}`, content, branch: settings.branch || 'main', sha: githubSha || undefined };
  const saved = await githubRequest('PUT', body);
  githubSha = saved.content?.sha || null;
  dirty = false; setStatus('Saved to GitHub');
}
function exportJson() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'coach-clips-drills.json'; a.click(); URL.revokeObjectURL(a.href);
}

function wireEvents() {
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('settingsBtn').addEventListener('click', () => {
    $('ghOwner').value = settings.owner || ''; $('ghRepo').value = settings.repo || ''; $('ghBranch').value = settings.branch || 'main'; $('ghPath').value = settings.path || 'data/drills.json'; $('ghToken').value = settings.token || '';
    $('settingsDialog').showModal();
  });
  $('settingsForm').addEventListener('submit', e => {
    e.preventDefault();
    settings = { owner: $('ghOwner').value.trim(), repo: $('ghRepo').value.trim(), branch: $('ghBranch').value.trim() || 'main', path: $('ghPath').value.trim() || 'data/drills.json', token: $('ghToken').value.trim() };
    saveSettings(); setStatus('GitHub settings saved');
    $('settingsDialog').close();
  });
  $('closeSettingsBtn').addEventListener('click', () => $('settingsDialog').close());
  $('newClipBtn').addEventListener('click', () => openClipDialog());
  $('newPlanBtn').addEventListener('click', () => openPlanDialog());
  $('searchInput').addEventListener('input', renderLibrary);
  $('categoryFilter').addEventListener('change', renderLibrary);
  $('reviewPlanSelect').addEventListener('change', e => { currentPlanId = e.target.value; currentClipId = getPlan()?.clipIds[0] || currentClipId; rememberSelection(); renderAll(false); cueCurrentClip(false); });
  $('planNotesField').addEventListener('change', e => { const p = getPlan(); if (p) { p.notes = e.target.value; markDirty('Plan notes updated'); } });
  $('favoriteBtn').addEventListener('click', () => { const c = getClip(); if (c) { c.favorite = !c.favorite; markDirty('Favorite updated'); } });
  $('playBtn').addEventListener('click', () => cueCurrentClip(true));
  $('replayBtn').addEventListener('click', () => cueCurrentClip(true));
  $('prevBtn').addEventListener('click', () => stepClip(-1));
  $('nextBtn').addEventListener('click', () => stepClip(1));
  $('loadGithubBtn').addEventListener('click', () => loadFromGithub().catch(err => setStatus(`Load failed: ${err.message}`)));
  $('saveGithubBtn').addEventListener('click', () => saveToGithub().catch(err => setStatus(`Save failed: ${err.message}`)));
  $('exportBtn').addEventListener('click', exportJson);
  $('importInput').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    data = normalizeAppData(JSON.parse(await file.text())); setCurrentFromData(); saveLocal(); markDirty('Imported JSON locally'); cueCurrentClip(false);
  });
  $('cancelClipBtn').addEventListener('click', () => $('clipDialog').close());
  $('cancelPlanBtn').addEventListener('click', () => $('planDialog').close());
  $('clipForm').addEventListener('submit', e => {
    e.preventDefault();
    const form = $('clipForm');
    if (!form.reportValidity()) return;
    const saved = saveClipForm();
    if (saved !== false) $('clipDialog').close();
  });
  $('deleteClipBtn').addEventListener('click', () => { deleteClip($('clipId').value); $('clipDialog').close(); });
  $('planForm').addEventListener('submit', e => {
    e.preventDefault();
    const form = $('planForm');
    if (!form.reportValidity()) return;
    const saved = savePlanForm();
    if (saved !== false) $('planDialog').close();
  });
  $('deletePlanBtn').addEventListener('click', () => { deletePlan($('planId').value); $('planDialog').close(); });
}
function stepClip(direction) {
  const plan = getPlan(); const list = plan?.clipIds || data.clips.map(c => c.id);
  const i = Math.max(0, list.indexOf(currentClipId));
  currentClipId = list[Math.min(list.length - 1, Math.max(0, i + direction))] || currentClipId;
  rememberSelection();
  cueCurrentClip(false);
}
function saveClipForm() {
  const id = $('clipId').value || crypto.randomUUID();
  const videoId = parseYouTubeId($('clipUrl').value);
  if (!videoId) { setStatus('Could not read that YouTube link'); return false; }
  const clip = data.clips.find(c => c.id === id) || { id, createdAt: new Date().toISOString(), favorite: false, subject: 'basketball' };
  Object.assign(clip, {
    title: $('clipTitle').value.trim(), youtubeUrl: $('clipUrl').value.trim(), videoId,
    start: parseTime($('clipStart').value), end: $('clipEnd').value ? parseTime($('clipEnd').value) : null,
    category: $('clipCategory').value.trim(), tags: $('clipTags').value.split(',').map(t => t.trim()).filter(Boolean),
    notes: $('clipNotesInput').value.trim(), updatedAt: new Date().toISOString()
  });
  if (!data.clips.some(c => c.id === id)) data.clips.push(clip);
  const addPlanId = $('clipPlanSelect').value;
  if (addPlanId) { const p = data.playlists.find(p => p.id === addPlanId); if (p && !p.clipIds.includes(id)) p.clipIds.push(id); }
  currentClipId = id; rememberSelection(); markDirty('Clip saved locally'); cueCurrentClip(false); return true;
}
function deleteClip(id) {
  data.clips = data.clips.filter(c => c.id !== id); data.playlists.forEach(p => p.clipIds = p.clipIds.filter(cid => cid !== id));
  currentClipId = data.clips[0]?.id || null; rememberSelection(); markDirty('Clip deleted'); cueCurrentClip(false);
}
function savePlanForm() {
  const id = $('planId').value || crypto.randomUUID();
  const plan = data.playlists.find(p => p.id === id) || { id, clipIds: [], createdAt: new Date().toISOString() };
  plan.title = $('planName').value.trim(); plan.notes = $('planNotesInput').value.trim(); plan.updatedAt = new Date().toISOString();
  if (!data.playlists.some(p => p.id === id)) data.playlists.push(plan);
  currentPlanId = id; rememberSelection(); markDirty('Plan saved locally'); return true;
}
function deletePlan(id) {
  data.playlists = data.playlists.filter(p => p.id !== id); currentPlanId = data.playlists[0]?.id || null; rememberSelection(); markDirty('Plan deleted');
}

data = normalizeAppData(data);
setCurrentFromData();
wireEvents(); renderAll(false); cueCurrentClip(false);
if (window.location.protocol === 'file:') setStatus('Opened as a local file. Use GitHub Pages or a local web server for best results.');
if (settings.owner && settings.repo && settings.token) loadFromGithub().catch(err => setStatus(`Using local draft. GitHub auto-load failed: ${err.message}`));
