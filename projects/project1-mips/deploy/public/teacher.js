// API Configuration
const API_BASE = '/api';

const STORAGE_KEY = "customLessons";
const AUTH_KEY = "professorAuthed";

// API helper functions
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

async function fetchLessonsFromAPI() {
  try {
    const labs = await apiRequest('/labs');
    console.log('Fetched from database:', Object.keys(labs).length, 'labs');
    return labs;
  } catch (error) {
    console.warn('Could not fetch labs from API:', error);
    return {};
  }
}

async function saveLessonToAPI(labId, title, html, starterCode) {
  try {
    const labData = {
      lab_id: labId,
      title: title,
      instructions: html,
      starter_code: starterCode || null,
      solution_code: solutionCode || null,
      is_published: true,
      difficulty: 'beginner',
      points: 100
    };
    
    // Try to update first
    try {
      await apiRequest(`/labs/${labId}`, {
        method: 'PUT',
        body: JSON.stringify(labData)
      });
      console.log('Lab updated in database');
      return true;
    } catch (updateError) {
      // If update fails, try to create
      await apiRequest('/labs', {
        method: 'POST',
        body: JSON.stringify(labData)
      });
      console.log('Lab created in database');
      return true;
    }
  } catch (error) {
    console.error('Failed to save lab to database:', error);
    alert('Failed to save to database: ' + error.message + '\n\nSaved locally only.');
    return false;
  }
}

async function deleteLessonFromAPI(labId) {
  try {
    await apiRequest(`/labs/${labId}`, {
      method: 'DELETE'
    });
    console.log('Lab deleted from database');
    return true;
  } catch (error) {
    console.error('Failed to delete lab from database:', error);
    alert('Failed to delete from database: ' + error.message);
    return false;
  }
}

// ─── Test Case API helpers ───

async function fetchTestCases(labId) {
  try {
    const data = await apiRequest(`/labs/${labId}/test-cases`);
    return data.test_cases || [];
  } catch (error) {
    console.warn('Could not fetch test cases:', error);
    return [];
  }
}

async function createTestCase(labId, payload) {
  return apiRequest(`/labs/${labId}/test-cases`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function updateTestCase(labId, tcId, payload) {
  return apiRequest(`/labs/${labId}/test-cases/${tcId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

async function deleteTestCase(labId, tcId) {
  return apiRequest(`/labs/${labId}/test-cases/${tcId}`, {
    method: 'DELETE',
  });
}

// Local storage fallback
const getCustom = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (_) {
    return {};
  }
};

const setCustom = (obj) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
};

const allLessons = async () => {
  const apiLessons = await fetchLessonsFromAPI();
  return apiLessons; 
};

// DOM elements
const idEl = document.getElementById("lesson-id");
const titleEl = document.getElementById("lesson-title");
const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const saveBtn = document.getElementById("btn-save");
const newBtn = document.getElementById("btn-new");
const deleteBtn = document.getElementById("btn-delete");
const openBtn = document.getElementById("btn-open");
const exportBtn = document.getElementById("btn-export");
const importInput = document.getElementById("file-import");
const lessonListEl = document.getElementById("lesson-list");
const docChipTitle = document.getElementById("doc-title");
const timeEl = document.getElementById("doc-time");
const countEl = document.getElementById("doc-count");
const saveStatus = document.getElementById("save-status");
const collapseBtn = document.getElementById("btn-collapse-library");
const libraryEl = document.getElementById("library");
const starterCodeSection = document.getElementById("starter-code-section");
const starterCodeEditor = document.getElementById("starter-code-editor");
const starterCodeBody = document.getElementById("starter-code-body");
const btnCollapseStarter = document.getElementById("btn-collapse-starter");

const solutionCodeSection = document.getElementById("solution-code-section");
const solutionCodeEditor  = document.getElementById("solution-code-editor");
const solutionCodeBody    = document.getElementById("solution-code-body");
const btnCollapseSolution = document.getElementById("btn-collapse-solution");

let currentId = null;

// Helper functions
async function updateCount() {
  const customCount = Object.keys(getCustom()).length;
  
  try {
    const apiLessons = await fetchLessonsFromAPI();
    const dbCount = Object.keys(apiLessons).length;
    
    if (countEl) {
      countEl.textContent = `Database: ${dbCount} lab(s) · Local drafts: ${customCount}`;
    }
  } catch (error) {
    if (countEl) {
      countEl.textContent = `Local drafts: ${customCount}`;
    }
  }
}

function renderPreview() {
  const title = titleEl.value.trim() || "(Untitled document)";
  preview.innerHTML = `
    <h3 style="text-align:center;margin:12px 0;">${title}</h3>
    ${editor.innerHTML || '<p style="text-align:center;color:#666">(Empty lesson)</p>'}
  `;
  docChipTitle.textContent = title;
}

function selectListItem(id) {
  const nodes = lessonListEl.querySelectorAll(".lesson-item");
  nodes.forEach((n) => {
    n.classList.toggle("active", n.dataset.lessonId === id);
  });
}

async function loadLesson(id) {
  const lessons = await allLessons();
  const data = lessons[id];
  if (!data) return;

  currentId = id;
  idEl.value = id;
  titleEl.value = data.title || id;
  editor.innerHTML = data.html || data.instructions || "";

  // Load starter code
  if (starterCodeEditor) {
    starterCodeEditor.value = data.starter_code || "";
  }
  if (starterCodeSection) {
    starterCodeSection.style.display = "";
  }

  if (solutionCodeEditor) {
    solutionCodeEditor.value = data.solution_code || "";
  }
  if (solutionCodeSection) {
    solutionCodeSection.style.display = "";
  }

  renderPreview();
  selectListItem(id);
  if (timeEl) {
    timeEl.textContent = "";
  }
  if (saveStatus) {
    saveStatus.textContent = "Loaded";
  }

  updateStarterLineNums();
}

async function renderList(selectId = null) {
  const lessons = await allLessons();
  lessonListEl.innerHTML = "";

  Object.entries(lessons)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([id, data]) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "lesson-item";
      item.dataset.lessonId = id;

      item.innerHTML = `
        <span class="ltitle">${data.title || id}</span>
        <span class="lid">${id}</span>
      `;

      item.addEventListener("click", () => loadLesson(id));

      if (id === selectId) {
        item.classList.add("active");
      }

      lessonListEl.appendChild(item);
    });

  updateCount();
}

// Actions
function ensureId() {
  let id = idEl.value.trim();
  if (!id) {
    const t = titleEl.value.trim() || "lesson";
    id = t.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
    idEl.value = id;
  }
  return id;
}

async function saveCurrent() {
  const id = ensureId();
  if (!id) return;

  const title = titleEl.value.trim() || id;
  const html = editor.innerHTML;
  const starterCode = starterCodeEditor ? starterCodeEditor.value : "";

  // Save to API first
  const solutionCode = solutionCodeEditor ? solutionCodeEditor.value : "";
  const apiSuccess = await saveLessonToAPI(id, title, html, starterCode, solutionCode);
  
  // Also save to local storage as backup
  const custom = getCustom();
  custom[id] = { title, html, starter_code: starterCode };
  setCustom(custom);

  currentId = id;
  await renderList(id);
  renderPreview();

  const now = new Date().toLocaleString();
  if (timeEl) {
    timeEl.textContent = "Last saved " + now + (apiSuccess ? " (database)" : " (local only)");
  }
  if (saveStatus) {
    saveStatus.textContent = "Saved " + now + (apiSuccess ? " ✓ DB" : " ⚠ Local");
  }
}

function newLesson() {
  currentId = null;
  idEl.value = "";
  titleEl.value = "";
  editor.innerHTML = "";
  if (starterCodeEditor) starterCodeEditor.value = "";
  if (starterCodeSection) starterCodeSection.style.display = "";
  renderPreview();
  selectListItem(null);
  if (timeEl) timeEl.textContent = "";
  if (saveStatus) saveStatus.textContent = "New lesson (unsaved)";
}

async function deleteCurrent() {
  const id = idEl.value.trim();
  if (!id) return;

  if (!confirm(`Are you sure you want to delete "${id}"?`)) {
    return;
  }

  // Try to delete from API
  await deleteLessonFromAPI(id);

  // Also delete from local storage
  const custom = getCustom();
  if (id in custom) {
    delete custom[id];
    setCustom(custom);
  }

  newLesson();
  await renderList(null);
}

function openInLabs() {
  const id = idEl.value.trim();
  if (!id) return;
  window.location.href = `index.html?lesson=${encodeURIComponent(id)}`;
}

function exportCurrent() {
  const id = idEl.value.trim();
  if (!id) return;

  const title = titleEl.value.trim() || id;
  const html = editor.innerHTML;
  const starter_code = starterCodeEditor ? starterCodeEditor.value : "";

  const payload = { id, title, html, starter_code };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${id}.lesson.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = String(e.target.result || "");
      const obj = JSON.parse(text);

      let toSave = {};
      if (obj && typeof obj === "object" && obj.id && obj.html) {
        toSave[obj.id] = { title: obj.title || obj.id, html: obj.html, starter_code: obj.starter_code || "" };
      } else {
        for (const [id, val] of Object.entries(obj)) {
          if (val && typeof val === "object" && val.html) {
            toSave[id] = { title: val.title || id, html: val.html, starter_code: val.starter_code || "" };
          }
        }
      }

      if (!Object.keys(toSave).length) {
        alert("File did not look like a lesson export.");
        return;
      }

      // Save to API and local storage
      for (const [id, data] of Object.entries(toSave)) {
        await saveLessonToAPI(id, data.title, data.html, data.starter_code);
      }

      const custom = getCustom();
      const merged = { ...custom, ...toSave };
      setCustom(merged);
      
      await renderList(null);
      await updateCount();
      alert("Imported lesson(s).");
    } catch (err) {
      console.error(err);
      alert("Could not read lesson file.");
    }
  };
  reader.readAsText(file);
}

// Collapse/expand library
if (collapseBtn && libraryEl) {
  collapseBtn.addEventListener("click", () => {
    const collapsed = libraryEl.classList.toggle("collapsed");
    collapseBtn.textContent = collapsed ? "Show" : "Hide";
  });
}

// Wire up events
if (saveBtn) saveBtn.addEventListener("click", saveCurrent);
if (newBtn) newBtn.addEventListener("click", newLesson);
if (deleteBtn) deleteBtn.addEventListener("click", deleteCurrent);
if (openBtn) openBtn.addEventListener("click", openInLabs);
if (exportBtn) exportBtn.addEventListener("click", exportCurrent);

if (importInput) {
  importInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      importFromFile(file);
      importInput.value = "";
    }
  });
}

if (editor) {
  editor.addEventListener("input", () => {
    renderPreview();
    if (saveStatus) saveStatus.textContent = "Unsaved changes";
  });
}

// add formatting to the toolbar

document.querySelectorAll('.fmt-btn[data-cmd]').forEach(btn => {
  btn.addEventListener('mousedown', (e) => {
    // mousedown instead of click preserves the editor selection
    e.preventDefault();
    const cmd = btn.dataset.cmd;
    const val = btn.dataset.val || null;
    document.execCommand(cmd, false, val);
    renderPreview();
    if (saveStatus) saveStatus.textContent = 'Unsaved changes';
  });
});

document.getElementById('fmt-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  const sel = window.getSelection();
  const existing = sel?.anchorNode?.parentElement?.closest('a');
  const current = existing?.href || 'https://';
  const url = prompt('Enter URL:', current);
  if (url === null) return;
  editor.focus();
  if (url.trim() === '') {
    document.execCommand('unlink', false, null);
  } else {
    if (existing) {
      existing.href = url;
    } else {
      document.execCommand('createLink', false, url);
    }
    // Ensure new links open in a new tab
    editor.querySelectorAll('a[href]').forEach(a => { a.target = '_blank'; });
  }
  renderPreview();
  if (saveStatus) saveStatus.textContent = 'Unsaved changes';
});

document.getElementById('fmt-table')?.addEventListener('click', (e) => {
  e.preventDefault();
  const rows = parseInt(prompt('Rows (including header):', '3'));
  if (!rows || rows < 1) return;
  const cols = parseInt(prompt('Columns:', '3'));
  if (!cols || cols < 1) return;

  let html = '<table><thead><tr>';
  for (let c = 0; c < cols; c++) html += `<th>Header ${c + 1}</th>`;
  html += '</tr></thead><tbody>';
  for (let r = 1; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) html += '<td>Cell</td>';
    html += '</tr>';
  }
  html += '</tbody></table><p><br></p>';

  editor.focus();
  document.execCommand('insertHTML', false, html);
  renderPreview();
  if (saveStatus) saveStatus.textContent = 'Unsaved changes';
});

if (titleEl) {
  titleEl.addEventListener("input", () => {
    renderPreview();
    if (saveStatus) saveStatus.textContent = "Unsaved changes";
  });
}

// Starter code collapse toggle
if (btnCollapseStarter && starterCodeBody) {
  btnCollapseStarter.addEventListener("click", () => {
    const collapsed = starterCodeBody.classList.toggle("collapsed");
    btnCollapseStarter.textContent = collapsed ? "Show" : "Hide";
  });
}

document.getElementById('btn-verify-solution')?.addEventListener('click', () => {
  if (!currentId) { alert('No lab selected.'); return; }
  window.location.href = `testgen.html?lab=${encodeURIComponent(currentId)}`;
});

// Line numbers + unsaved tracking for starter code editor
function updateStarterLineNums() {
  const lineNumEl = document.getElementById('starter-line-nums');
  if (!starterCodeEditor || !lineNumEl) return;
  const count = starterCodeEditor.value.split('\n').length;
  lineNumEl.innerHTML = Array.from({ length: count }, (_, i) =>
    `<span>${i + 1}</span>`
  ).join('');
  lineNumEl.scrollTop = starterCodeEditor.scrollTop;
}

// Starter code Save and Clear buttons
document.getElementById('btn-save-starter')?.addEventListener('click', async () => {
  if (!currentId) { alert('No lab selected.'); return; }
  const code = starterCodeEditor ? starterCodeEditor.value : '';
  try {
    await apiRequest(`/labs/${currentId}`, {
      method: 'PUT',
      body: JSON.stringify({ starter_code: code }),
    });
    if (saveStatus) saveStatus.textContent = 'Starter code saved ✓';
    setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 2000);
  } catch (err) {
    alert('Failed to save starter code: ' + err.message);
  }
});

document.getElementById('btn-clear-starter')?.addEventListener('click', () => {
  if (!confirm('Clear the starter code for this lab?')) return;
  if (starterCodeEditor) starterCodeEditor.value = '';
  if (saveStatus) saveStatus.textContent = 'Unsaved changes';
});

if (btnCollapseSolution && solutionCodeBody) {
  btnCollapseSolution.addEventListener("click", () => {
    const collapsed = solutionCodeBody.classList.toggle("collapsed");
    btnCollapseSolution.textContent = collapsed ? "Show" : "Hide";
  });
}

document.getElementById('btn-save-solution')?.addEventListener('click', async () => {
  if (!currentId) { alert('No lab selected.'); return; }
  const code = solutionCodeEditor ? solutionCodeEditor.value : '';
  try {
    await apiRequest(`/labs/${currentId}`, {
      method: 'PUT',
      body: JSON.stringify({ solution_code: code }),
    });
    if (saveStatus) saveStatus.textContent = 'Solution code saved ✓';
    setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 2000);
  } catch (err) {
    alert('Failed to save solution code: ' + err.message);
  }
});

document.getElementById('btn-clear-solution')?.addEventListener('click', () => {
  if (!confirm('Clear the solution code for this lab?')) return;
  if (solutionCodeEditor) solutionCodeEditor.value = '';
  if (saveStatus) saveStatus.textContent = 'Unsaved changes';
});

if (solutionCodeEditor) {
  solutionCodeEditor.addEventListener("input", () => {
    if (saveStatus) saveStatus.textContent = "Unsaved changes";
  });

  solutionCodeEditor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = solutionCodeEditor.selectionStart;
      const end   = solutionCodeEditor.selectionEnd;
      solutionCodeEditor.value =
        solutionCodeEditor.value.substring(0, start) + "    " +
        solutionCodeEditor.value.substring(end);
      solutionCodeEditor.selectionStart = solutionCodeEditor.selectionEnd = start + 4;
    }
  });
}

// Track unsaved changes in starter code
if (starterCodeEditor) {
  starterCodeEditor.addEventListener("input", () => {
    if (saveStatus) saveStatus.textContent = "Unsaved changes";
  });

  starterCodeEditor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = starterCodeEditor.selectionStart;
      const end   = starterCodeEditor.selectionEnd;
      starterCodeEditor.value =
        starterCodeEditor.value.substring(0, start) + "    " +
        starterCodeEditor.value.substring(end);
      starterCodeEditor.selectionStart = starterCodeEditor.selectionEnd = start + 4;
    }
  });
}

// ─── Test Case Manager ───

const tcManager    = document.getElementById('tc-manager');
const tcListEl     = document.getElementById('tc-list');
const btnAddTC     = document.getElementById('btn-add-tc');
const btnCollapseTC = document.getElementById('btn-collapse-tc');
const tcModal      = document.getElementById('tc-modal-overlay');
const tcModalTitle = document.getElementById('tc-modal-title');
const tcModalSave  = document.getElementById('tc-modal-save');
const tcModalCancel = document.getElementById('tc-modal-cancel');

let editingTestCaseId = null;   // null = creating new, string = editing existing

// Show / hide test case list
if (btnCollapseTC) {
  btnCollapseTC.addEventListener('click', () => {
    const collapsed = tcListEl.classList.toggle('collapsed');
    btnCollapseTC.textContent = collapsed ? 'Show' : 'Hide';
  });
}

// ─ Key-value row helpers (used inside modal) ─

function addKVRow(containerId, keyPH, valPH, keyVal, valVal) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'tc-kv-row';
  row.innerHTML = `
    <input placeholder="${keyPH}" value="${keyVal || ''}" />
    <input placeholder="${valPH}" value="${valVal || ''}" />
    <button type="button" class="tc-remove-row" title="Remove">×</button>
  `;
  row.querySelector('.tc-remove-row').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

// Wire the "+ register" / "+ address" buttons
document.querySelectorAll('.tc-add-row').forEach(btn => {
  btn.addEventListener('click', () => {
    addKVRow(
      btn.dataset.target,
      btn.dataset.placeholderKey || 'key',
      btn.dataset.placeholderVal || 'value',
      '', ''
    );
  });
});

function readKV(containerId) {
  const container = document.getElementById(containerId);
  const obj = {};
  if (!container) return obj;
  container.querySelectorAll('.tc-kv-row').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const k = inputs[0].value.trim();
    const v = inputs[1].value.trim();
    if (k) {
      // Try to parse as number; keep as string if it's not numeric
      const num = Number(v);
      obj[k] = isNaN(num) ? v : num;
    }
  });
  return obj;
}

function clearKV(containerId) {
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = '';
}

// ─ Rendering test case cards ─

function objToMiniTable(obj, colA, colB) {
  const entries = Object.entries(obj || {});
  if (!entries.length) return '<em style="color:#999;font-size:11px;">none</em>';
  let html = `<table><thead><tr><th>${colA}</th><th>${colB}</th></tr></thead><tbody>`;
  entries.forEach(([k, v]) => { html += `<tr><td>${k}</td><td>${v}</td></tr>`; });
  html += '</tbody></table>';
  return html;
}

function renderTestCaseCards(testCases) {
  if (!tcListEl) return;
  if (!testCases || !testCases.length) {
    tcListEl.innerHTML = '<div class="tc-empty">No test cases for this lab</div>';
    return;
  }

  tcListEl.innerHTML = '';
  testCases.forEach(tc => {
    const inp = tc.input_data   || {};
    const exp = tc.expected_output || {};
    const initRegs = inp.registers || {};
    const initMem  = inp.memory    || {};
    const expRegs  = exp.registers || {};
    const expMem   = exp.memory    || {};

    const card = document.createElement('div');
    card.className = 'tc-card';
    card.dataset.tcId = tc.test_case_id;

    const hiddenBadge = tc.is_hidden
      ? '<span class="tc-badge tc-badge-hidden">hidden</span>' : '';

    card.innerHTML = `
      <div class="tc-card-header">
        <span class="tc-card-name">${tc.test_name}</span>
        <span class="tc-card-meta">
          <span class="tc-badge">${tc.points} pts</span>
          ${hiddenBadge}
          <span>▾</span>
        </span>
      </div>
      <div class="tc-card-body">
        <div class="tc-card-body-grid">
          <div class="tc-card-section">
            <h5>Initial Registers</h5>
            ${objToMiniTable(initRegs, 'Register', 'Value')}
          </div>
          <div class="tc-card-section">
            <h5>Expected Registers</h5>
            ${objToMiniTable(expRegs, 'Register', 'Value')}
          </div>
          <div class="tc-card-section">
            <h5>Initial Memory</h5>
            ${objToMiniTable(initMem, 'Address', 'Value')}
          </div>
          <div class="tc-card-section">
            <h5>Expected Memory</h5>
            ${objToMiniTable(expMem, 'Address', 'Value')}
          </div>
        </div>
        ${tc.description ? `<div style="font-size:11px;color:#666;margin-bottom:6px;">${tc.description}</div>` : ''}
        <div class="tc-card-actions">
          <button class="tc-btn-edit" data-tc-id="${tc.test_case_id}">Edit</button>
          <button class="tc-btn-delete" data-tc-id="${tc.test_case_id}">Delete</button>
        </div>
      </div>
    `;

    // Toggle body open/close on header click
    card.querySelector('.tc-card-header').addEventListener('click', () => {
      card.querySelector('.tc-card-body').classList.toggle('open');
    });

    // Edit
    card.querySelector('.tc-btn-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      openModalForEdit(tc);
    });

    // Delete
    card.querySelector('.tc-btn-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete test case "${tc.test_name}"?`)) return;
      try {
        await deleteTestCase(currentId, tc.test_case_id);
        await refreshTestCases();
      } catch (err) {
        alert('Failed to delete: ' + err.message);
      }
    });

    tcListEl.appendChild(card);
  });
}

async function refreshTestCases() {
  if (!currentId) return;
  const cases = await fetchTestCases(currentId);
  renderTestCaseCards(cases);
}

// ─ Modal open / close / save ─

function resetModal() {
  editingTestCaseId = null;
  document.getElementById('tc-name').value = '';
  document.getElementById('tc-points').value = '10';
  document.getElementById('tc-desc').value = '';
  document.getElementById('tc-hidden').checked = false;
  document.getElementById('tc-timeout').value = '5';
  clearKV('tc-init-regs');
  clearKV('tc-init-mem');
  clearKV('tc-exp-regs');
  clearKV('tc-exp-mem');
}

function openModalForNew() {
  resetModal();
  tcModalTitle.textContent = 'Add Test Case';
  tcModal.style.display = 'flex';
}

function openModalForEdit(tc) {
  resetModal();
  editingTestCaseId = tc.test_case_id;
  tcModalTitle.textContent = 'Edit Test Case';

  document.getElementById('tc-name').value   = tc.test_name || '';
  document.getElementById('tc-points').value = tc.points ?? 10;
  document.getElementById('tc-desc').value   = tc.description || '';
  document.getElementById('tc-hidden').checked = !!tc.is_hidden;
  document.getElementById('tc-timeout').value  = tc.timeout_seconds ?? 5;

  const inp = tc.input_data      || {};
  const exp = tc.expected_output || {};

  Object.entries(inp.registers || {}).forEach(([k, v]) => addKVRow('tc-init-regs', '$t0', '0', k, v));
  Object.entries(inp.memory    || {}).forEach(([k, v]) => addKVRow('tc-init-mem',  '268435456', '0', k, v));
  Object.entries(exp.registers || {}).forEach(([k, v]) => addKVRow('tc-exp-regs',  '$t0', '30', k, v));
  Object.entries(exp.memory    || {}).forEach(([k, v]) => addKVRow('tc-exp-mem',   '268435456', '30', k, v));

  tcModal.style.display = 'flex';
}

function closeModal() {
  tcModal.style.display = 'none';
}

async function saveModal() {
  const name = document.getElementById('tc-name').value.trim();
  if (!name) { alert('Test case name is required.'); return; }
  if (!currentId) { alert('No lab selected.'); return; }

  const payload = {
    test_name:       name,
    test_type:       'register',
    description:     document.getElementById('tc-desc').value.trim() || null,
    points:          parseInt(document.getElementById('tc-points').value) || 10,
    is_hidden:       document.getElementById('tc-hidden').checked,
    timeout_seconds: parseInt(document.getElementById('tc-timeout').value) || 5,
    input_data: {
      registers: readKV('tc-init-regs'),
      memory:    readKV('tc-init-mem'),
    },
    expected_output: {
      registers: readKV('tc-exp-regs'),
      memory:    readKV('tc-exp-mem'),
    },
  };

  try {
    if (editingTestCaseId) {
      await updateTestCase(currentId, editingTestCaseId, payload);
    } else {
      await createTestCase(currentId, payload);
    }
    closeModal();
    await refreshTestCases();
  } catch (err) {
    alert('Error saving test case: ' + err.message);
  }
}

if (btnAddTC)     btnAddTC.addEventListener('click', openModalForNew);
if (tcModalSave)  tcModalSave.addEventListener('click', saveModal);
if (tcModalCancel) tcModalCancel.addEventListener('click', closeModal);

// Close modal on overlay click
if (tcModal) {
  tcModal.addEventListener('click', (e) => {
    if (e.target === tcModal) closeModal();
  });
}

// ─ Hook into lesson selection to load test cases ─

const _origLoadLesson = loadLesson;
loadLesson = async function(id) {
  await _origLoadLesson(id);
  if (tcManager) tcManager.style.display = '';
  await refreshTestCases();
};

// pick first lab from DB
(async () => {
  const lessons = await allLessons();
  const sortedIds = Object.keys(lessons).sort();
  const firstId = sortedIds[0] || null;

  await renderList(firstId);
  await updateCount();

  if (firstId) {
    loadLesson(firstId);
  }
})();