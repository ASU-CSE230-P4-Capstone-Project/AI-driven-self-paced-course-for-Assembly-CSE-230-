// Students browser — teacher-only page
const API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'API request failed');
  }
  return response.json();
}

// ─── DOM refs ───

const rosterEl    = document.getElementById('stu-roster');
const countEl     = document.getElementById('student-count');
const searchEl    = document.getElementById('stu-search');
const placeholder = document.getElementById('stu-placeholder');
const detailEl    = document.getElementById('stu-detail');
const headerCard  = document.getElementById('stu-header-card');
const statsRow    = document.getElementById('stu-stats-row');
const labsList    = document.getElementById('stu-labs-list');

let allStudents = [];
let selectedUserId = null;

 
async function buildDownloadBar() {
  const rosterSection = document.getElementById('roster-section');
  if (!rosterSection) return;

  const bar = document.createElement('div');
  bar.id = 'dl-bar';
  bar.className = 'export-section';
  bar.innerHTML = `
    <div class="export-header">
      <span>Download Submissions &amp; Grades</span>
      <div class="export-controls-inline">
        <select id="dl-lab-sel" class="dl-bar-select">
          <option value="ALL">All Labs</option>
        </select>
      </div>
    </div>
    <div class="export-grid">
      <div class="export-card">
        <h4>Grades (Excel)</h4>
        <p>Best submission per student with manual adjustment column</p>
        <button id="dl-excel" class="btn-primary">Download Grades</button>
      </div>
      <div class="export-card">
        <h4>Source Code (ZIP)</h4>
        <p>All student .asm files in one download</p>
        <button id="dl-zip" class="btn-secondary">Download ZIP</button>
      </div>
      <div class="export-card">
        <h4>Complete History (CSV)</h4>
        <p>Every submission attempt with timestamps</p>
        <button id="dl-csv" class="btn-secondary">Download History</button>
      </div>
    </div>
    <div class="dl-bar-status" id="dl-status"></div>
  `;

  rosterSection.parentElement.insertBefore(bar, rosterSection);

  // Populate lab options
  try {
    const res  = await fetch(`${API_BASE}/labs`, { credentials: 'include' });
    const labs = await res.json();
    const sel  = document.getElementById('dl-lab-sel');
    Object.entries(labs).forEach(([id, lab]) => {
      const o = document.createElement('option');
      o.value       = id;
      o.textContent = `${id} — ${lab.title}`;
      sel.appendChild(o);
    });
  } catch { /* non-fatal */ }

  const setStatus = msg => {
    const el = document.getElementById('dl-status');
    if (el) { el.textContent = msg; setTimeout(() => { el.textContent = ''; }, 3000); }
  };
  const go = url => {
    const a = Object.assign(document.createElement('a'), { href: url, style: 'display:none' });
    document.body.appendChild(a); a.click(); a.remove();
  };
  const lab = () => document.getElementById('dl-lab-sel')?.value || 'ALL';

  document.getElementById('dl-excel')?.addEventListener('click', () => {
    setStatus('Preparing…'); go(`/api/export/grades/${lab()}`);
  });
  document.getElementById('dl-zip')?.addEventListener('click', () => {
    setStatus('Building ZIP…'); go(`/api/export/submissions-zip/${lab()}`);
  });
  document.getElementById('dl-csv')?.addEventListener('click', () => {
    setStatus('Generating…'); go(`/api/export/submissions/${lab()}`);
  });
}

// ─── Roster ───

async function loadRoster() {
  try {
    allStudents = await apiRequest('/students');
    renderRoster(allStudents);
    if (countEl) countEl.textContent = `${allStudents.length} student(s)`;
  } catch (err) {
    rosterEl.innerHTML = `<div class="stu-loading" style="color:#c62828;">Error: ${err.message}</div>`;
  }
}

function renderRoster(students) {
  rosterEl.innerHTML = '';
  if (!students.length) {
    rosterEl.innerHTML = '<div class="stu-loading">No students found</div>';
    return;
  }
  students.forEach(s => {
    const item = document.createElement('div');
    item.className = 'stu-roster-item';
    item.dataset.userId = s.user_id;
    if (s.user_id === selectedUserId) item.classList.add('active');

    const pct = s.avg_score_pct;
    const barColor = pct >= 80 ? '#4caf50' : pct >= 50 ? '#ff9800' : '#e53935';
    const labRatio = `${s.labs_attempted}/${s.total_labs}`;

    item.innerHTML = `
      <div class="stu-roster-top">
        <span class="stu-roster-name">${s.full_name || s.username}</span>
        <span class="stu-roster-score" style="color:${barColor}">${pct}%</span>
      </div>
      <div class="stu-roster-bottom">
        <span class="stu-roster-id">${s.asu_id || s.username}</span>
        <span class="stu-roster-labs">${labRatio} labs</span>
      </div>
    `;

    item.addEventListener('click', () => selectStudent(s.user_id));
    rosterEl.appendChild(item);
  });
}

// ─── Search / filter ───

if (searchEl) {
  searchEl.addEventListener('input', () => {
    const q = searchEl.value.toLowerCase().trim();
    if (!q) { renderRoster(allStudents); return; }
    const filtered = allStudents.filter(s =>
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.asu_id || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );
    renderRoster(filtered);
  });
}

// ─── Student detail ───

async function selectStudent(userId) {
  selectedUserId = userId;

  rosterEl.querySelectorAll('.stu-roster-item').forEach(el => {
    el.classList.toggle('active', el.dataset.userId === userId);
  });

  placeholder.style.display = 'none';
  detailEl.style.display = '';
  headerCard.innerHTML = '<div class="stu-loading">Loading…</div>';
  statsRow.innerHTML = '';
  labsList.innerHTML = '';

  try {
    const data = await apiRequest(`/students/${userId}`);
    renderDetail(data);
  } catch (err) {
    headerCard.innerHTML = `<div class="stu-loading" style="color:#c62828;">Error: ${err.message}</div>`;
  }
}

function renderDetail(data) {
  const stu = data.student;
  const labs = data.labs;

  const joined = stu.created_at ? new Date(stu.created_at).toLocaleDateString() : '—';
  const lastLogin = stu.last_login ? new Date(stu.last_login).toLocaleString() : 'Never';

  headerCard.innerHTML = `
    <div class="stu-hdr-left">
      <div class="stu-hdr-avatar">${(stu.full_name || stu.username).charAt(0).toUpperCase()}</div>
      <div>
        <div class="stu-hdr-name">${stu.full_name || stu.username}</div>
        <div class="stu-hdr-meta">${stu.asu_id || stu.username} · ${stu.email || ''}</div>
      </div>
    </div>
    <div class="stu-hdr-right">
      <div class="stu-hdr-label">Joined</div><div class="stu-hdr-val">${joined}</div>
      <div class="stu-hdr-label">Last login</div><div class="stu-hdr-val">${lastLogin}</div>
    </div>
  `;

  const attempted = labs.filter(l => l.attempt_count > 0).length;
  const totalLabs = labs.length;
  const totalSubs = labs.reduce((n, l) => n + l.attempt_count, 0);

  const scoresWithAttempts = labs.filter(l => l.best_score !== null);
  const avgPct = scoresWithAttempts.length
    ? (scoresWithAttempts.reduce((a, l) => a + (l.best_score / l.best_possible) * 100, 0) / scoresWithAttempts.length).toFixed(1)
    : 0;

  const perfect = scoresWithAttempts.filter(l => l.best_score === l.best_possible).length;

  const allSubs = labs.flatMap(l => l.submissions || []);
  const subsWithTime = allSubs.filter(s => s.duration_seconds != null);
  
  const totalRuns = allSubs.reduce((a, s) => a + (s.run_count || 0), 0);

  const avgTimeSec = subsWithTime.length
    ? Math.round(subsWithTime.reduce((a, s) => a + s.duration_seconds, 0) / subsWithTime.length)
    : null;
  const avgRuns = subsWithTime.length
    ? (totalRuns / subsWithTime.length).toFixed(1)
    : null;
  const flaggedCount = allSubs.filter(s => s.timing_flagged).length;

  statsRow.innerHTML = `
    <div class="stu-stat">
      <div class="stu-stat-num">${attempted}<small>/${totalLabs}</small></div>
      <div class="stu-stat-label">Labs attempted</div>
    </div>
    <div class="stu-stat">
      <div class="stu-stat-num">${totalSubs}</div>
      <div class="stu-stat-label">Total submissions</div>
    </div>
    <div class="stu-stat">
      <div class="stu-stat-num">${totalRuns}</div>
      <div class="stu-stat-label">Total runs (all labs)</div>
    </div>
    <div class="stu-stat">
      <div class="stu-stat-num">${avgPct}%</div>
      <div class="stu-stat-label">Avg best score</div>
    </div>
    <div class="stu-stat">
      <div class="stu-stat-num">${perfect}</div>
      <div class="stu-stat-label">Perfect scores</div>
    </div>
    <div class="stu-stat">
      <div class="stu-stat-num">${avgTimeSec != null ? formatDuration(avgTimeSec) : '—'}</div>
      <div class="stu-stat-label">Avg time / attempt</div>
    </div>
    <div class="stu-stat">
      <div class="stu-stat-num">${avgRuns != null ? avgRuns : '—'}</div>
      <div class="stu-stat-label">Avg runs / attempt</div>
    </div>
    ${flaggedCount > 0 ? `<div class="stu-stat">
      <div class="stu-stat-num" style="color:#e53935;">&#9873; ${flaggedCount}</div>
      <div class="stu-stat-label">Timing flagged</div>
    </div>` : ''}
  `;

  labsList.innerHTML = '';
  labs.forEach(lab => {
    const card = document.createElement('div');
    card.className = 'stu-lab-card';

    const hasAttempt = lab.attempt_count > 0;
    const pct = hasAttempt ? ((lab.best_score / lab.best_possible) * 100).toFixed(0) : null;
    const barColor = !hasAttempt ? '#bbb' : pct >= 80 ? '#4caf50' : pct >= 50 ? '#ff9800' : '#e53935';
    const statusText = !hasAttempt ? 'Not attempted' : pct == 100 ? 'Perfect' : `${pct}%`;
    const statusClass = !hasAttempt ? 'stu-status-none' : pct == 100 ? 'stu-status-perfect' : '';

    card.innerHTML = `
      <div class="stu-lab-header">
        <div class="stu-lab-header-left">
          <span class="stu-lab-title">${lab.title}</span>
          <span class="stu-lab-id">${lab.lab_id}</span>
        </div>
        <div class="stu-lab-header-right">
          <span class="stu-lab-status ${statusClass}" style="color:${barColor}">${statusText}</span>
          <span class="stu-lab-score" id="lab-score-display-${lab.lab_id}-${stu.user_id}">${hasAttempt ? lab.best_score + '/' + lab.best_possible : '—'}</span>
          ${hasAttempt && window.__currentUser && window.__currentUser.role === 'instructor' ? `<button class="btn-ghost stu-reset-btn" data-lab-id="${lab.lab_id}" style="color:#e53935;font-size:11px;" title="Delete all submissions and reset attempt counter">Reset Attempts</button>` : ''}
          <span class="stu-lab-toggle">▾</span>
        </div>
      </div>
      <div class="stu-lab-body">
        ${!hasAttempt ? '<div class="stu-lab-empty">No submissions yet</div>' : renderSubmissionTable(lab, stu.user_id)}
        
        <div class="stu-run-history" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
          <details class="stu-run-details">
            <summary style="cursor:pointer; font-size: 13px; color: #666; font-weight: 600;">View Run History (${lab.telemetry ? lab.telemetry.length : 0} runs)</summary>
            ${renderRunTable(lab.telemetry || [])}
          </details>
        </div>
      </div>
    `;

    card.querySelector('.stu-lab-header').addEventListener('click', (e) => {
      if (e.target.classList.contains('stu-reset-btn')) return;
      card.querySelector('.stu-lab-body').classList.toggle('open');
    });

    labsList.appendChild(card);
    const isInstructor = window.__currentUser?.role === 'instructor';
    if (hasAttempt && isInstructor){
      attachOverrideUI(card, lab, stu.user_id);
    }
  });
}

function renderSubmissionTable(lab, userId) {
  let rows = '';
  let bestFound = false;

  lab.submissions.forEach((sub, idx) => {
    const date = new Date(sub.submitted_at).toLocaleString();
    const pct = sub.total_possible > 0 ? ((sub.score / sub.total_possible) * 100).toFixed(0) : 0;

    const isBest = !bestFound && sub.score === lab.best_score;
    if (isBest) bestFound = true;

    const rowClass = isBest ? 'stu-sub-best' : '';
    const uniqueId = `sub-${lab.lab_id}-${idx}`;

    let detailHTML = '';
    let results = sub.test_results;
    if (typeof results === 'string') { try { results = JSON.parse(results); } catch(_) { results = []; } }

    if (results && results.length) {
      detailHTML += '<div class="stu-sub-tests">';
      results.forEach(t => {
        const icon = t.status === 'PASS' ? '✓' : '✗';
        const color = t.status === 'PASS' ? '#2e7d32' : '#d32f2f';
        detailHTML += `<div class="stu-sub-test-row">
          <span style="color:${color};font-weight:700;width:16px;">${icon}</span>
          <span>${t.name}</span>
          <span style="margin-left:auto;color:#666;">${t.earned}/${t.points}</span>
        </div>`;

        if (t.mismatches && t.mismatches.length) {
          t.mismatches.forEach(m => {
            detailHTML += `<div class="stu-sub-mismatch">
              ${m.register}: expected <b>${m.expected}</b>, got <b>${m.actual}</b>
            </div>`;
          });
        }
      });
      detailHTML += '</div>';
    }

    const codeTruncated = (sub.source_code || '').replace(/\\n/g, '\n');
    detailHTML += `<details class="stu-sub-code-details">
      <summary>View source code</summary>
      <pre class="stu-sub-code">${escapeHTML(codeTruncated)}</pre>
    </details>`;

    const flagIcon = sub.timing_flagged
      ? ' <span title="Timing data was adjusted by the server — client values were inconsistent" style="color:#e53935;cursor:help;">&#9873;</span>'
      : '';
    const adjId = `adj-cell-${lab.lab_id}-${userId}-${idx}`;
    const pctId = `pct-cell-${lab.lab_id}-${userId}-${idx}`;

    rows += `
      <tr class="${rowClass}" data-is-best="${isBest}">
        <td>${isBest ? '★ ' : ''}#${lab.submissions.length - idx}</td>
        <td>${date}</td>
        <td>${sub.score}/${sub.total_possible}</td>
        <td class="sub-adj-display" id="${adjId}">—</td>
        <td style="font-weight:600;" id="${pctId}">${pct}%</td>
        <td>${formatDuration(sub.duration_seconds)}${flagIcon}</td>
        <td>${sub.run_count != null ? sub.run_count : '—'}</td>
        <td><button class="btn-ghost stu-expand-btn" data-target="${uniqueId}">Details</button></td>
      </tr>
      <tr class="stu-sub-detail-row" id="${uniqueId}">
        <td colspan="8">${detailHTML}</td>
      </tr>
    `;
  });

  return `
    <table class="stu-sub-table">
      <thead>
        <tr><th>#</th><th>Submitted</th><th>Score</th><th>Adjusted</th><th>%</th><th>Time Spent</th><th>Runs</th><th></th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderRunTable(telemetry) {
  if (!telemetry.length) return '<div class="stu-lab-empty">No run history recorded</div>';
  
  let rows = '';
  telemetry.forEach((t, idx) => {
    const date = new Date(t.executed_at).toLocaleString();
    const type = t.is_step ? 'Step' : 'Run';
    const code = (t.source_code || '').replace(/\\n/g, '\n');

    rows += `
      <tr>
        <td style="font-size: 12px;">${date}</td>
        <td><span class="chip" style="font-size: 10px; padding: 2px 6px; background: #eee; border-radius: 4px;">${type}</span></td>
        <td>
          <details class="stu-sub-code-details">
            <summary style="font-size: 11px; color: #3498db; cursor: pointer;">Code</summary>
            <pre class="stu-sub-code" style="max-height: 150px; overflow-y: auto;">${escapeHTML(code)}</pre>
          </details>
        </td>
      </tr>
    `;
  });

  return `
    <table class="stu-sub-table" style="margin-top: 10px;">
      <thead><tr><th>Timestamp</th><th>Type</th><th>Code Snapshot</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDuration(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('stu-expand-btn')) {
    const target = document.getElementById(e.target.dataset.target);
    if (target) target.classList.toggle('open');
  }
});

document.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('stu-reset-btn')) return;

  e.stopPropagation();

  const user = window.__currentUser;
  if (!user || user.role !== 'instructor') return;

  const labId = e.target.dataset.labId;
  const userId = selectedUserId;
  if (!labId || !userId) return;

  if (!confirm(`This will permanently delete all submissions for this student on "${labId}".\n\nAre you sure?`)) return;

  try {
    await apiRequest(`/grade/attempts/${labId}/${userId}`, { method: 'DELETE' });
    selectStudent(userId);
  } catch (err) {
    alert('Failed to reset attempts: ' + err.message);
  }
});


// ─── Override UI — appended below the submission table inside the card body ───
 
function updateAdjCells(card, lab, userId, adj, finalScore, possible) {
  const tbody = card.querySelector('tbody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr.stu-sub-best, tr[data-is-best="true"]');
  rows.forEach(tr => {
    const adjCell = tr.querySelector('.sub-adj-display');
    const pctCell = tr.querySelector('td[id^="pct-cell"]');
    if (adjCell) {
      adjCell.textContent = adj === 0 ? '—'
        : (adj > 0 ? `+${adj.toFixed(1)}` : adj.toFixed(1));
      adjCell.style.color      = adj !== 0 ? '#0d6efd' : '';
      adjCell.style.fontWeight = adj !== 0 ? '700' : '';
    }
    if (pctCell && possible > 0) {
      pctCell.textContent = `${((finalScore / possible) * 100).toFixed(0)}%`;
      pctCell.style.color = adj !== 0 ? '#0d6efd' : '';
    }
  });
}

async function attachOverrideUI(card, lab, userId) {
  const labId    = lab.lab_id;
  const possible = lab.best_possible ?? lab.total_points ?? 0;
  const autoScore = lab.best_score ?? 0;

  // load existing override
  let currentOverride = null;
  let currentNote     = '';
  let currentSavedAt  = null;
  try {
    const res = await fetch(`${API_BASE}/students/${userId}/score-override/${labId}`, {
      credentials: 'include',
    });
    if (res.ok) {
      const d = await res.json();
      if (d.override_score != null) {
        currentOverride = d.override_score;
        currentNote     = d.note ?? '';
        currentSavedAt  = d.created_at ?? null;
      }
    }
  } catch { /* no override yet */ }

  const currentAdj = currentOverride != null
    ? parseFloat((currentOverride - autoScore).toFixed(2))
    : 0;

  const strip = document.createElement('div');
  strip.className = 'stu-override-strip';
  strip.innerHTML = `
    <div class="stu-override-header">
      <span class="stu-override-title">Grade Override</span>
      ${currentOverride != null ? `<span class="stu-override-tag">adjusted</span>` : ''}
    </div>
    <div class="stu-override-body">
      <div class="stu-override-row">
        <label class="stu-override-field-label">Auto score</label>
        <span class="stu-override-auto">${autoScore} / ${possible}</span>
      </div>
      <div class="stu-override-row">
        <label class="stu-override-field-label">Adjustment</label>
        <div class="stu-override-adj-controls">
          <button class="stu-adj-btn stu-adj-minus" type="button">−</button>
          <input class="stu-adj-input" type="number" step="0.1"
                 value="${currentAdj.toFixed(1)}"
                 min="${(-autoScore).toFixed(1)}"
                 max="${(possible - autoScore).toFixed(1)}" />
          <button class="stu-adj-btn stu-adj-plus" type="button">+</button>
          <span class="stu-adj-preview" id="adj-preview-${labId}-${userId}">
            = ${(autoScore + currentAdj).toFixed(1)} / ${possible}
            (${possible > 0 ? (((autoScore + currentAdj) / possible) * 100).toFixed(1) : 0}%)
          </span>
        </div>
      </div>
      <div class="stu-override-row">
        <label class="stu-override-field-label">Reason</label>
        <input class="stu-adj-note" type="text" placeholder="Note for this adjustment…" />
      </div>
      ${currentSavedAt != null ? `
      <div class="stu-override-row">
        <label class="stu-override-field-label">Last saved</label>
        <span class="stu-override-saved-at">${new Date(currentSavedAt).toLocaleString()}</span>
      </div>` : ''}
      <div class="stu-override-actions">
        <button class="stu-adj-save btn-primary" type="button">Save override</button>
        ${currentOverride != null ? `<button class="stu-adj-clear btn-ghost" type="button">Clear override</button>` : ''}
        <span class="stu-adj-status" id="adj-status-${labId}-${userId}"></span>
      </div>
    </div>
  `;

  const runHistory = card.querySelector('.stu-run-history');
  const body       = card.querySelector('.stu-lab-body');
  if (runHistory) body.insertBefore(strip, runHistory);
  else body.appendChild(strip);

  // Set note via DOM property to avoid attribute injection
  strip.querySelector('.stu-adj-note').value = currentNote;

  const adjInput  = strip.querySelector('.stu-adj-input');
  const noteInput = strip.querySelector('.stu-adj-note');
  const saveBtn   = strip.querySelector('.stu-adj-save');
  const clearBtn  = strip.querySelector('.stu-adj-clear');
  const statusEl  = strip.querySelector('.stu-adj-status');
  const previewEl = strip.querySelector(`#adj-preview-${labId}-${userId}`);
  const overrideTag = () => strip.querySelector('.stu-override-tag');

  function clamp(v) {
    return Math.max(-autoScore, Math.min(possible - autoScore, +parseFloat(v || 0).toFixed(2)));
  }

  function updatePreview(adj) {
    const final = Math.round((autoScore + adj) * 10) / 10;
    const pct   = possible > 0 ? ((final / possible) * 100).toFixed(1) : '0.0';
    if (previewEl) previewEl.textContent = `= ${final} / ${possible} (${pct}%)`;
    updateAdjCells(card, lab, userId, adj, final, possible);
  }

  strip.querySelector('.stu-adj-minus').addEventListener('click', () => {
    const v = clamp(parseFloat(adjInput.value || 0) - 0.1);
    adjInput.value = v.toFixed(1); updatePreview(v);
  });
  strip.querySelector('.stu-adj-plus').addEventListener('click', () => {
    const v = clamp(parseFloat(adjInput.value || 0) + 0.1);
    adjInput.value = v.toFixed(1); updatePreview(v);
  });
  adjInput.addEventListener('input', () => updatePreview(clamp(adjInput.value)));

  if (currentAdj !== 0) updateAdjCells(card, lab, userId, currentAdj, autoScore + currentAdj, possible);

  async function saveOverride(overrideScore, note) {
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true; statusEl.textContent = '';
    try {
      const res = await fetch(`${API_BASE}/students/${userId}/score-override`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_id: labId, override_score: overrideScore, note }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }

      const scoreDisplay = document.getElementById(`lab-score-display-${labId}-${userId}`);
      if (scoreDisplay) {
        scoreDisplay.textContent = `${overrideScore} / ${possible}`;
        scoreDisplay.style.color = overrideScore !== autoScore ? '#0d6efd' : '';
      }

      const adj = overrideScore - autoScore;
      updateAdjCells(card, lab, userId, adj, overrideScore, possible);

      if (!overrideTag()) {
        const header = strip.querySelector('.stu-override-header');
        const tag = document.createElement('span');
        tag.className = 'stu-override-tag'; tag.textContent = 'adjusted';
        header.appendChild(tag);
      }

      // Update or insert last-saved row
      let savedAtRow = strip.querySelector('.stu-override-saved-at-row');
      if (!savedAtRow) {
        savedAtRow = document.createElement('div');
        savedAtRow.className = 'stu-override-row stu-override-saved-at-row';
        savedAtRow.innerHTML = `<label class="stu-override-field-label">Last saved</label><span class="stu-override-saved-at"></span>`;
        strip.querySelector('.stu-override-actions').insertAdjacentElement('beforebegin', savedAtRow);
      }
      savedAtRow.querySelector('.stu-override-saved-at').textContent = new Date().toLocaleString();

      if (!strip.querySelector('.stu-adj-clear')) {
        const cb = document.createElement('button');
        cb.className = 'stu-adj-clear btn-ghost'; cb.type = 'button';
        cb.textContent = 'Clear override';
        saveBtn.insertAdjacentElement('afterend', cb);
        cb.addEventListener('click', () => clearOverride());
      }

      statusEl.textContent = 'Saved'; statusEl.className = 'stu-adj-status ok';
      saveBtn.textContent = 'Save override';
      setTimeout(() => { saveBtn.disabled = false; statusEl.textContent = ''; }, 2000);
    } catch (err) {
      saveBtn.textContent = 'Save override'; saveBtn.disabled = false;
      statusEl.textContent = err.message; statusEl.className = 'stu-adj-status err';
    }
  }

  async function clearOverride() {
    if (!confirm('Remove the manual grade adjustment for this lab?')) return;
    try {
      const res = await fetch(`${API_BASE}/students/${userId}/score-override/${labId}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to clear override');

      adjInput.value = '0.0';
      updatePreview(0);
      const tag = overrideTag(); if (tag) tag.remove();
      const cb  = strip.querySelector('.stu-adj-clear'); if (cb) cb.remove();
      const savedAtRow = strip.querySelector('.stu-override-saved-at-row'); if (savedAtRow) savedAtRow.remove();
      const scoreDisplay = document.getElementById(`lab-score-display-${labId}-${userId}`);
      if (scoreDisplay) {
        scoreDisplay.textContent = `${autoScore}/${possible}`;
        scoreDisplay.style.color = '';
      }
      statusEl.textContent = 'Cleared'; statusEl.className = 'stu-adj-status ok';
      setTimeout(() => { statusEl.textContent = ''; }, 2000);
    } catch (err) {
      alert(err.message);
    }
  }

  saveBtn.addEventListener('click', () => {
    const adj = clamp(parseFloat(adjInput.value) || 0);
    adjInput.value = adj.toFixed(1);
    saveOverride(Math.round((autoScore + adj) * 10) / 10, noteInput.value.trim());
  });
  if (clearBtn) clearBtn.addEventListener('click', () => clearOverride());
}
 

// ─── Roster Management ───

const rosterFileInput  = document.getElementById('roster-file-input');
const rosterTableEl    = document.getElementById('roster-table');
const rosterTbody      = document.getElementById('roster-tbody');
const rosterEmptyEl    = document.getElementById('roster-empty');
const rosterCountEl    = document.getElementById('roster-count');
const rosterStatusEl   = document.getElementById('roster-status');
const rosterClearBtn   = document.getElementById('roster-clear-btn');

async function loadCourseRoster() {
  try {
    const entries = await apiRequest('/roster');
    renderCourseRoster(entries);
  } catch (err) {
    if (rosterEmptyEl) {
      rosterEmptyEl.style.display = '';
      rosterEmptyEl.textContent = 'Error: ' + err.message;
      rosterEmptyEl.style.color = '#c62828';
    }
  }
}

// Roster search filter
document.getElementById('roster-search')?.addEventListener('input', function () {
  const q = this.value.toLowerCase().trim();
  if (!q) { renderCourseRoster(allRosterEntries); return; }
  const filtered = allRosterEntries.filter(e =>
    (e.full_name  || '').toLowerCase().includes(q) ||
    (e.asurite    || '').toLowerCase().includes(q) ||
    (e.asu_id     || '').toLowerCase().includes(q) ||
    (e.email      || '').toLowerCase().includes(q)
  );
  // Render without overwriting allRosterEntries
  _renderRosterTable(filtered);
});

// Roster CSV download
document.getElementById('roster-export-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  const a = Object.assign(document.createElement('a'),
    { href: `${API_BASE}/roster/export`, style: 'display:none' });
  document.body.appendChild(a); a.click(); a.remove();
});

let allRosterEntries = [];

function _renderRosterTable(entries) {
  if (!rosterTbody) return;
  rosterTbody.innerHTML = '';
  entries.forEach(e => {
    const tr = document.createElement('tr');
    if (e.is_registered) tr.className = 'roster-row-registered';

    const statusColor = e.is_registered ? '#2e7d32' : '#888';
    const statusLabel = e.is_registered ? 'Registered' : 'Pending';
    const statusDot   = e.is_registered
      ? '<span class="roster-dot roster-dot-green"></span>'
      : '<span class="roster-dot roster-dot-gray"></span>';

    tr.innerHTML = `
      <td style="font-weight:600;">${escapeHTML(e.full_name || '—')}</td>
      <td><code>${escapeHTML(e.asurite)}</code></td>
      <td>${escapeHTML(e.asu_id || '—')}</td>
      <td>${escapeHTML(e.email || '—')}</td>
      <td>${statusDot} <span style="color:${statusColor};">${statusLabel}</span></td>
      <td>${window.__currentUser && window.__currentUser.role === 'instructor' ? `<button class="btn-ghost roster-delete-btn" data-id="${e.roster_id}">Remove</button>` : ''}</td>
    `;
    rosterTbody.appendChild(tr);
  });
}

function renderCourseRoster(entries) {
  allRosterEntries = entries;
  if (!rosterCountEl || !rosterTbody) return;

  const registered = entries.filter(e => e.is_registered).length;
  rosterCountEl.textContent = `${registered} / ${entries.length} registered`;

  if (!entries.length) {
    rosterTableEl.style.display = 'none';
    rosterEmptyEl.style.display = '';
    rosterEmptyEl.textContent = 'No roster uploaded yet. Use the upload button above to import your class list.';
    rosterEmptyEl.style.color = '';
    return;
  }

  rosterEmptyEl.style.display = 'none';
  rosterTableEl.style.display = '';
  _renderRosterTable(entries);
}

if (rosterFileInput) {
  rosterFileInput.addEventListener('change', async () => {
    const file = rosterFileInput.files[0];
    if (!file) return;

    rosterStatusEl.textContent = 'Uploading…';
    rosterStatusEl.className = 'roster-status';

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/roster/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      rosterStatusEl.className = 'roster-status roster-status-ok';
      rosterStatusEl.textContent = data.message;
      loadCourseRoster();
      loadRoster();
    } catch (err) {
      rosterStatusEl.className = 'roster-status roster-status-err';
      rosterStatusEl.textContent = err.message;
    }

    rosterFileInput.value = '';
  });
}

document.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('roster-delete-btn')) return;
  const id = e.target.dataset.id;
  if (!id) return;
  try {
    await apiRequest(`/roster/${id}`, { method: 'DELETE' });
    loadCourseRoster();
  } catch (err) {
    alert('Failed to delete: ' + err.message);
  }
});

if (rosterClearBtn) {
  rosterClearBtn.addEventListener('click', async () => {
    if (!confirm('This will remove ALL roster entries. Students who already signed up will keep their accounts.\n\nAre you sure?')) return;
    try {
      await apiRequest('/roster/clear', { method: 'DELETE' });
      loadCourseRoster();
      rosterStatusEl.className = 'roster-status roster-status-ok';
      rosterStatusEl.textContent = 'Roster cleared.';
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  });
}

// ─── Init ───

(async () => {
  await buildDownloadBar();
  await loadRoster();
  loadCourseRoster();

  const user = window.__currentUser;
  if (user && user.role === 'ta') {
    const uploadBtn = document.querySelector('.roster-upload-btn');
    if (uploadBtn) uploadBtn.style.display = 'none';
    const templateLink = document.querySelector('a[href="/api/roster/template"]');
    if (templateLink) templateLink.style.display = 'none';
    if (rosterClearBtn) rosterClearBtn.style.display = 'none';
  }
})();