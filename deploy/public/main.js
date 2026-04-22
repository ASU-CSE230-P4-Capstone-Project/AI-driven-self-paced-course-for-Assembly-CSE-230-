import init, { WasmCPU } from "./pkg/mips_emu_wasm.js";

// API Configuration
const API_BASE = '/api';

const MAX_ATTEMPTS = 5;

// Fetch lessons from API (database only)
async function fetchLessonsFromAPI() {
  try {
    const response = await fetch(`${API_BASE}/labs`, {
      credentials: 'include'
    });
    if (response.ok) {
      const labs = await response.json();
      console.log('Fetched labs from database:', Object.keys(labs).length, 'labs');
      return labs;
    }
  } catch (error) {
    console.warn('Could not fetch labs from API:', error);
  }
  return {};
}

async function allLessons() {
  return await fetchLessonsFromAPI();
}

function normalizeTestCases(raw) {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];

  return raw.map((tc, i) => {
    const inp = tc.input_data     || {};
    const exp = tc.expected_output || {};

    return {
      name:           tc.test_name || tc.name || `Test Case ${i + 1}`,
      points:         tc.points || 0,
      inputs:         inp.registers || {},
      initialMemory:  inp.memory    || {},
      expected:       exp.registers || {},
      expectedMemory: exp.memory    || {},
      is_hidden:      tc.is_hidden  || false,
    };
  });
}

// lesson underlined in hedder
const lessonContainer = document.getElementById("lesson-container");
const lessonTitle = document.getElementById("lesson-title");
const lessonBody = document.getElementById("lesson-body");
const lessonToggle = document.getElementById("lesson-toggle");
const lessonPopout = document.getElementById("lesson-popout");


function openLessonPopup() {
  if (!lessonTitle || !lessonBody) return;

  const title = lessonTitle.textContent || "Lesson";
  const bodyHtml = lessonBody.innerHTML || "<p>No lesson loaded.</p>";

  const popup = window.open("", "lessonPopup", "width=1000,height=800,resizable=yes,scrollbars=yes");

  if (!popup) {
    alert("Popup blocked. Please allow popups for this site.");
    return;
  }

  popup.document.open();
  popup.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
      <style>
        body {
          font-family: "Segoe UI", Arial, sans-serif;
          background: #dcdcdc;
          margin: 0;
          color: #000;
        }

        .popup-wrap {
          max-width: 1000px;
          margin: 0 auto;
          padding: 24px 32px 40px;
          background: #e5e5e5;
          min-height: 100vh;
        }

        h1 {
          font-size: 26px;
          text-align: center;
          margin: 0 0 20px;
        }

        .center-table {
          display: flex;
          justify-content: center;
          margin: 12px 0;
        }

        table {
          border-collapse: collapse;
          font-size: 13px;
        }

        th, td {
          border: 1px solid #888;
          padding: 6px 12px;
          text-align: center;
        }

        th {
          background-color: #d6d6d6;
        }

        pre {
          max-width: 700px;
          margin: 16px auto;
          padding: 14px 18px;
          text-align: left;
          white-space: pre-wrap;
          overflow-x: auto;
          background: #f3f3f3;
          border: 1px solid #999;
          border-radius: 4px;
          font-family: Consolas, monospace;
          font-size: 13px;
        }

        ul, ol {
          width: fit-content;
          margin: 12px auto;
          text-align: left;
          padding-left: 24px;
        }

        p, h2, h3, h4, .lesson-example {
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="popup-wrap">
        <h1>${title}</h1>
        ${bodyHtml}
      </div>
    </body>
    </html>
  `);
  popup.document.close();
}

if (lessonPopout) {
  lessonPopout.addEventListener("click", () => {
    openLessonPopup();
  });
}

const filesListEl = document.getElementById("labs-menu-list");
const labsMenuButton = document.getElementById("labs-menu-button");
const labsMenu = document.getElementById("labs-menu");

async function renderFiles(selectedId) {
  const lessons = await allLessons();
  if (!filesListEl) return;

  filesListEl.innerHTML = "";

  Object.entries(lessons)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([id, info]) => {
      const item = document.createElement("div");
      item.className = "file-item";
      item.dataset.lesson = id;
      item.textContent = info.title || id;

      if (id === selectedId) {
        item.classList.add("active");
      }

      item.addEventListener("click", async () => {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("lesson", id);
        window.history.replaceState({}, "", nextUrl);
        await showLesson(id);
        // Close the hamburger menu after selection
        if (labsMenu) {
          labsMenu.classList.add("hidden");
          labsMenuButton.setAttribute("aria-expanded", "false");
        }
      });

      filesListEl.appendChild(item);
    });
}

// Hamburger menu toggle
if (labsMenuButton && labsMenu) {
  labsMenuButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    labsMenu.classList.toggle("hidden");
    const expanded = !labsMenu.classList.contains("hidden");
    labsMenuButton.setAttribute("aria-expanded", String(expanded));
  });

  labsMenu.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", () => {
    labsMenu.classList.add("hidden");
    labsMenuButton.setAttribute("aria-expanded", "false");
  });
}

function applyInitialValues(labData) {
  if (!cpu || !wasmReady) return;

  // Student-set values (from the UI) override lab/test-case defaults
  const studentRegs = readInitKV('student-init-regs');
  const studentMem  = readInitKV('student-init-mem');

  const merged = studentRegs;

  for (const [reg, val] of Object.entries(merged)) {
    try {
      cpu.set_register(reg, Number(val));
    } catch (e) {
      console.warn(`Could not set initial register ${reg}:`, e);
    }
  }

  // Also apply initial memory values if present
  const mergedMem = studentMem;

  for (const [addr, val] of Object.entries(mergedMem)) {
    try {
      cpu.set_memory_word(Number(addr), Number(val));
    } catch (e) {
      console.warn(`Could not set initial memory at ${addr}:`, e);
    }
  }

  // Track initial values as baseline for runtime change detection,
  // but do NOT paint them into the Registers panel — that's for runtime only.
  const regCount = Object.keys(merged).length;
  const memCount = Object.keys(mergedMem).length;
  if (regCount > 0) {
    const baseline = {};
    for (const [reg, val] of Object.entries(merged)) {
      baseline[reg] = Number(val) >>> 0;
    }
    lastRegs = baseline;
  }

  if (regCount > 0 || memCount > 0) {
    const parts = [];
    if (regCount > 0) parts.push(`${regCount} register(s)`);
    if (memCount > 0) parts.push(`${memCount} memory value(s)`);
    log(`Applied ${parts.join(', ')}.`);
  }

  updateMemoryView();
}

// ── Student Initial Values (register & memory KV rows) ───────────────────────

function addInitKVRow(containerId, keyPH, valPH, keyVal, valVal) {
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

function readInitKV(containerId) {
  const container = document.getElementById(containerId);
  const obj = {};
  if (!container) return obj;
  container.querySelectorAll('.tc-kv-row').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const k = inputs[0].value.trim();
    const v = inputs[1].value.trim();
    if (k) {
      // Support hex values (0x...) and decimal
      let numVal;
      if (v.startsWith('0x') || v.startsWith('0X')) {
        numVal = parseInt(v, 16);
      } else {
        numVal = Number(v);
      }
      obj[k] = isNaN(numVal) ? 0 : numVal;
    }
  });
  return obj;
}

// Populate the Initial Values UI from a lab's data (called on lab switch)
function populateInitialValuesUI(labData) {
  const regsContainer = document.getElementById('student-init-regs');
  const memContainer = document.getElementById('student-init-mem');
  if (!regsContainer || !memContainer) return;

  // Clear existing rows
  regsContainer.innerHTML = '';
  memContainer.innerHTML = '';

  // Gather lab-level + first test case initial values
  const labInitial = labData.initial_values || labData.initialValues || {};
  const rawCases = labData.test_cases || labData.testCases || [];
  const testCases = normalizeTestCases(rawCases);
  const tcInitial = testCases.length > 0 ? (testCases[0].inputs || {}) : {};
  const mergedRegs = { ...tcInitial, ...labInitial };

  const labMem = labData.initial_memory || labData.initialMemory || {};
  const tcMem = testCases.length > 0 ? (testCases[0].initialMemory || {}) : {};
  const mergedMem = { ...tcMem, ...labMem };

  // Create register rows
  for (const [reg, val] of Object.entries(mergedRegs)) {
    addInitKVRow('student-init-regs', '$t0', '0', reg, String(val));
  }

  // Create memory rows (display addresses in hex for readability)
  for (const [addr, val] of Object.entries(mergedMem)) {
    const addrNum = Number(addr);
    const addrStr = isNaN(addrNum) ? addr : '0x' + addrNum.toString(16).toUpperCase();
    addInitKVRow('student-init-mem', '0x10000000', '0', addrStr, String(val));
  }
}

// Wire up "+ register" and "+ address" buttons (tc-add-row class, shared pattern)
document.querySelectorAll('.tc-add-row').forEach(btn => {
  btn.addEventListener('click', () => {
    addInitKVRow(
      btn.dataset.target,
      btn.dataset.placeholderKey || 'key',
      btn.dataset.placeholderVal || 'value',
      '', ''
    );
  });
});

// Toggle collapse
const initValuesToggle = document.getElementById('init-values-toggle');
const initValuesBody = document.getElementById('init-values-body');
if (initValuesToggle && initValuesBody) {
  initValuesToggle.addEventListener('click', () => {
    const collapsed = initValuesBody.classList.toggle('collapsed');
    initValuesToggle.textContent = collapsed ? '▶' : '▼';
  });
}

// Apply & Reset: resets the emulator then applies student-set + lab initial values
const initApplyBtn = document.getElementById('init-apply-btn');
if (initApplyBtn) {
  initApplyBtn.addEventListener('click', () => {
    if (!cpu || !wasmReady) {
      log('WASM not initialized yet.');
      return;
    }
    if (isProgramLoaded) {
      log('Stopping current execution to apply initial values.');
    }
    resetEmulator();
    if (currentLabData) {
      applyInitialValues(currentLabData);
    } else {
      // No lab loaded — just apply raw student values
      const regs = readInitKV('student-init-regs');
      const mem  = readInitKV('student-init-mem');
      for (const [reg, val] of Object.entries(regs)) {
        try { cpu.set_register(reg, Number(val)); } catch(e) { log(`Error: ${reg}: ${e.message}`); }
      }
      for (const [addr, val] of Object.entries(mem)) {
        try { cpu.set_memory_word(Number(addr), Number(val)); } catch(e) { log(`Error: mem[${addr}]: ${e.message}`); }
      }
      if (Object.keys(regs).length || Object.keys(mem).length) {
        // Track as baseline for change detection, but don't paint
        const baseline = {};
        for (const [reg, val] of Object.entries(regs)) {
          baseline[reg] = Number(val) >>> 0;
        }
        lastRegs = baseline;
        log(`Applied ${Object.keys(regs).length} register(s), ${Object.keys(mem).length} memory value(s).`);
      }
      updateMemoryView();
    }
  });
}

// Clear: removes all student-set initial value rows AND resets the emulator
// so CPU state doesn't still hold previously-applied values
const initClearBtn = document.getElementById('init-clear-btn');
if (initClearBtn) {
  initClearBtn.addEventListener('click', () => {
    const regsContainer = document.getElementById('student-init-regs');
    const memContainer = document.getElementById('student-init-mem');
    if (regsContainer) regsContainer.innerHTML = '';
    if (memContainer) memContainer.innerHTML = '';

    // Reset emulator so stale values don't linger in CPU state
    if (cpu && wasmReady) {
      resetEmulator();
      // Re-apply just the lab defaults (without student overrides)
      if (currentLabData) {
        populateInitialValuesUI(currentLabData);
        applyInitialValues(currentLabData);
      }
    }
    log('Cleared student initial values and reset emulator.');
  });
}

// ── Attempts display ──────────────────────────────────────────────────────────

async function updateAttemptsDisplay(labId) {
  const gradeBtn = document.getElementById('grade-button');
  const attemptsEl = document.getElementById('attempts-display');

  // Reset display while loading
  if (attemptsEl) attemptsEl.textContent = '';
  if (gradeBtn) {
    gradeBtn.disabled = false;
    gradeBtn.style.background = '#27ae60';
    gradeBtn.textContent = 'Grade Me';
  }

  try {
    const res = await fetch(`${API_BASE}/grade/attempts/${labId}`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();

    const used = data.attempts_used;
    const remaining = data.attempts_remaining;
    const limitReached = data.limit_reached;
    const unlimited = data.unlimited;

    if (attemptsEl) {
      if (unlimited) {
        attemptsEl.textContent = `Attempts: ${used} (no limit)`;
        attemptsEl.style.color = '#27ae60';
      } else {
        attemptsEl.textContent = `Attempts: ${used} / ${MAX_ATTEMPTS}`;
        if (limitReached) {
          attemptsEl.style.color = '#e74c3c';
        } else if (remaining === 1) {
          attemptsEl.style.color = '#e67e22';
        } else {
          attemptsEl.style.color = '#27ae60';
        }
      }
    }

    if (gradeBtn) {
      if (unlimited) {
        gradeBtn.disabled = false;
        gradeBtn.textContent = 'Grade Me';
        gradeBtn.style.background = '#27ae60';
      } else if (limitReached) {
        gradeBtn.disabled = true;
        gradeBtn.textContent = 'No Attempts Remaining';
        gradeBtn.style.background = '#95a5a6';
      } else {
        gradeBtn.disabled = false;
        gradeBtn.textContent = `Grade Me (${remaining} left)`;
        gradeBtn.style.background = '#27ae60';
      }
    }

    return data;
  } catch (err) {
    console.warn('Could not fetch attempts:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function showLesson(id) {
  const lessons = await allLessons();
  const data = lessons[id];
  if (!data) return;

  lessonTitle.textContent = data.title || id;

  lessonBody.innerHTML = data.html || data.instructions || "";
  setLessonVisible(true);

  if (filesListEl) {
    filesListEl.querySelectorAll(".file-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.lesson === id);
    });
  }

  // Save current lab's code to localStorage before switching
  if (cpuEditor && currentLessonId) {
    localStorage.setItem(`mips_code_${currentLessonId}`, cpuEditor.getValue());
  }

  // Reset emulator state when switching labs
  if (cpu && wasmReady) {
    resetEmulator();
  }

  // clear grade view
  document.getElementById('grade-results').innerHTML = '';

  currentLabData = data;
  currentLessonId = id;

  // Load saved code if available, otherwise fall back to starter code
  if (cpuEditor) {
    const saved = localStorage.getItem(`mips_code_${id}`);
    cpuEditor.setValue(saved !== null ? saved : (data.starter_code || ""));
  }
  labOpenedAt = Date.now();   // start the clock for this lab session
  runCount = 0;               // reset run counter
  loadLatestSubmission(id); 

  // Update attempts counter for the newly selected lab
  updateAttemptsDisplay(id);

  const url = new URL(window.location);
  url.searchParams.set('lesson', id);
  window.history.replaceState({}, '', url);

  // Populate the Initial Values panel with this lab's defaults
  populateInitialValuesUI(data);

  applyInitialValues(data);

  // Normalize before rendering
  const rawCases = data.test_cases || data.testCases || [];
  renderTestCases(normalizeTestCases(rawCases));

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setLessonVisible(visible) {
  if (!lessonContainer || !lessonToggle) return;

  if (visible) {
    lessonContainer.classList.remove("hidden");
    lessonToggle.textContent = "Hide lesson";
  } else {
    lessonContainer.classList.add("hidden");
    lessonToggle.textContent = "Show lesson";
  }
}

if (lessonToggle) {
  lessonToggle.addEventListener("click", () => {
    const isHidden = lessonContainer.classList.contains("hidden");
    setLessonVisible(isHidden);
  });
}

// Test cases rendering
const testCasesSection = document.getElementById("test-cases-section");
const testCasesToggle = document.getElementById("test-cases-toggle");
const testCasesContent = document.getElementById("test-cases-content");
const testCasesList = document.getElementById("test-cases-list");

if (testCasesToggle) {
  testCasesToggle.addEventListener("click", () => {
    const isHidden = testCasesContent.classList.toggle("hidden");
    testCasesToggle.textContent = isHidden ? "▼ Show Test Cases" : "▲ Hide Test Cases";
  });
}

// testCases here are already normalized via normalizeTestCases()
function renderTestCases(testCases) {
  if (!testCasesSection || !testCasesList) return;

  // 1. Get the current user role
  const user = window.__currentUser;
  const isTeacher = user && (user.role === 'instructor' || user.role === 'ta');
  
  // 2. Hide section if no test cases OR if the user is a student
  if (!testCases || testCases.length === 0 || !isTeacher) {
    testCasesSection.classList.add("hidden");
    return;
  }
  
  // 3. Only if isTeacher is true, the code reaches here to show the section
  testCasesSection.classList.remove("hidden");
  testCasesList.innerHTML = "";

  testCases.forEach((testCase, index) => {
    const item = document.createElement("div");
    item.className = "test-case-item";
    
    // These are now the normalized keys
    const initialRegs = testCase.inputs || {};
    const expectedRegs = testCase.expected || {};
    const initialMem = testCase.initialMemory || {};
    const expectedMem = testCase.expectedMemory || {};
    
    // Build inputs section (registers + memory)
    let inputsHTML = "";
    
    // Initial registers table
    if (Object.keys(initialRegs).length > 0) {
      inputsHTML += `
        <table class="test-case-table">
          <thead><tr><th>Register</th><th>Value</th></tr></thead>
          <tbody>
            ${Object.entries(initialRegs).map(([reg, val]) => `<tr><td>${reg}</td><td>${val}</td></tr>`).join('')}
          </tbody>
        </table>
      `;
    }
    
    // Initial memory table
    if (Object.keys(initialMem).length > 0) {
      inputsHTML += `
        <table class="test-case-table" style="margin-top: 10px;">
          <thead><tr><th>Address</th><th>Value</th></tr></thead>
          <tbody>
            ${Object.entries(initialMem).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([addr, val]) => `<tr><td>${addr}</td><td>${val}</td></tr>`).join('')}
          </tbody>
        </table>
      `;
    }
    
    if (inputsHTML === "") {
      inputsHTML = '<p style="font-size: 12px; color: #666;">No input values</p>';
    }
    
    // Build expected outputs section (registers + memory)
    let outputsHTML = "";
    
    // Expected registers table
    if (Object.keys(expectedRegs).length > 0) {
      outputsHTML += `
        <table class="test-case-table">
          <thead><tr><th>Register</th><th>Expected Value</th></tr></thead>
          <tbody>
            ${Object.entries(expectedRegs).map(([reg, val]) => `<tr><td>${reg}</td><td>${val}</td></tr>`).join('')}
          </tbody>
        </table>
      `;
    }
    
    // Expected memory table
    if (Object.keys(expectedMem).length > 0) {
      outputsHTML += `
        <table class="test-case-table" style="margin-top: 10px;">
          <thead><tr><th>Address</th><th>Expected Value</th></tr></thead>
          <tbody>
            ${Object.entries(expectedMem).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([addr, val]) => `<tr><td>${addr}</td><td>${val}</td></tr>`).join('')}
          </tbody>
        </table>
      `;
    }
    
    // Check if we should show a hidden message (student view)
    if (outputsHTML === "") {
       if (user && user.role === 'student') {
          // If it's a student, the server probably stripped the data
          outputsHTML = '<p style="font-size: 12px; color: #666;">Hidden (Student View)</p>';
       } else {
          outputsHTML = '<p style="font-size: 12px; color: #666;">No expected outputs</p>';
       }
    }
    
    item.innerHTML = `
      <div class="test-case-header">
        <div class="test-case-name">${testCase.name || `Test Case ${index + 1}`}</div>
        <div class="test-case-points">${testCase.points || 0} points</div>
      </div>
      <div class="test-case-body">
        <div class="test-case-column">
          <h4>Initial Values</h4>
          ${inputsHTML}
        </div>
        <div class="test-case-column">
          <h4>Expected Outputs</h4>
          ${outputsHTML}
        </div>
      </div>
    `;
    
    testCasesList.appendChild(item);
  });
}

// console and reg ui

const consoleOut = document.getElementById("console-output");
const runBtn = document.getElementById("run");
const stepBtn = document.getElementById("step");
const stopBtn = document.getElementById("stop");
const registersDiv = document.getElementById("registers");
const codeEl = document.querySelector(".assembler textarea");

// emultor stuff
function log(msg) {
  if (!consoleOut) return;
  consoleOut.textContent += msg + "\n";
  consoleOut.scrollTop = consoleOut.scrollHeight;
}

// Helpers for numbers / registers
function toNumber(v) {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

function hex32(n) {
  const d = toNumber(n) >>> 0;
  return "0x" + d.toString(16).toUpperCase().padStart(8, "0");
}

function fmt(n) {
  const d = toNumber(n) >>> 0;
  const signed = d > 0x7FFFFFFF ? d - 0x100000000 : d;
  return `${signed} (${hex32(d)})`;
}

function coerceRegs(raw) {
  if (!raw) return {};
  if (raw instanceof Map) return Object.fromEntries(raw);
  if (Array.isArray(raw)) return Object.fromEntries(raw);
  if (typeof raw === "object") return raw;
  return {};
}

// filters to show the used regs

// show in tab
const INTERESTING = /^\$(?:s[0-7]|t[0-9]|a[0-3]|v[0-1])$/i;
// hide unless changed
const SYSTEM = /^\$(?:zero|gp|sp|fp|ra|at|k0|k1|lo|hi)$/i;

function filterForTab(curr, prev, usedNames) {
  const out = {};

  for (const [name, val] of Object.entries(curr)) {
    const now = toNumber(val);
    const hadPrev = Object.prototype.hasOwnProperty.call(prev, name);
    const was = hadPrev ? toNumber(prev[name]) : now;

    const changed = now !== was;
    const nonZero = now !== 0;
    const isExplicitlyUsed = usedNames.has(name.toLowerCase());

    // Show if: 1. Used in code/initial values, 2. Value changed, 3. Interesting & non-zero
    if (isExplicitlyUsed || changed) {
      out[name] = now;
    } else if (INTERESTING.test(name) && nonZero) {
      out[name] = now;
    }
  }

  return out;
}

function getUsedRegisterNames() {
  const names = new Set();
  
  // Scan code in editor
  const code = cpuEditor.getValue();
  const codeMatches = code.match(/\$[a-z0-9]+/gi);
  if (codeMatches) {
    codeMatches.forEach(m => names.add(m.toLowerCase()));
  }

  // Scan Initial Values UI
  const initRegs = readInitKV('student-init-regs');
  Object.keys(initRegs).forEach(k => names.add(k.toLowerCase()));

  return names;
}

// add 11/14 (make reg table editable)

function paintRegisters(regObj) {
  if (!registersDiv) return;

  const entries = Object.entries(regObj).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  if (!entries.length) {
    registersDiv.innerHTML = "<p>(no relevant registers changed)</p>";
    return;
  }

  let html = `
    <table class="reg-table">
      <thead>
        <tr><th>Register</th><th>Value(decimal)</th><th>Hex</th></tr>
      </thead>
      <tbody>
  `;

  for (const [name, val] of entries) {
    const d = toNumber(val);
    const signed = d >>> 0 > 0x7FFFFFFF ? d - 0x100000000 : d;

    html += `
      <tr>
        <td class="reg-name">${name}</td>
        <td>
          <input
            class="reg-edit"
            data-reg="${name}"
            type="number"
            value="${signed}"
            style="width:70px"
          >
        </td>
        <td>${hex32(val)}</td>
      </tr>
    `;
  }

  html += "</tbody></table>";
  registersDiv.innerHTML = html;

  // hook up "change" handlers: editing input changes register value
  registersDiv.querySelectorAll(".reg-edit").forEach((input) => {
    input.addEventListener("change", () => {
      const regName = input.dataset.reg;
      const newVal = Number(input.value) || 0;

      // updates the CPU if API supports it
      try {
        if (cpu && typeof cpu.set_register === "function") {
          cpu.set_register(regName, newVal);
          log(`Set ${regName} = ${newVal}`);
        } else {
          log(`(UI only) ${regName} = ${newVal}`);
        }
      } catch (e) {
        console.error("Error setting register:", e);
        log("Error setting register: " + e.message);
      }

      // keeps local snapshots in sync until next run/step
      regObj[regName] = newVal;
      lastRegs[regName] = newVal;
    });
  });
}

// easm and cpu

let cpu = null;
let wasmReady = false;
let isProgramLoaded = false;
let lastRegs = {};
let breakpoints = new Set();
let currentLineMarker = null;
let currentLabData = null;
let currentLessonId = null;
let labOpenedAt = null;   // timestamp when student opened/switched to this lab
let runCount = 0;         // number of Run/Step clicks since opening the lab

// Helper to log telemetry only at start of execution
async function logRunTelemetry(isStep = false) {
  if (!currentLessonId) return;
  const sourceCode = cpuEditor.getValue();
  try {
    await fetch('/api/grade/log-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lab_id: currentLessonId,
        source_code: sourceCode,
        is_step: isStep
      }),
      credentials: 'include'
    });
  } catch (err) {
    console.warn("Telemetry log failed", err);
  }
}

// uses coldmirror

CodeMirror.defineSimpleMode("mips-custom", {
  start: [
    {
      // instructions
      regex:
        /(?:add|addu|addi|addiu|sub|subu|li|sw|lw|sb|lb|sh|lh|lui|la|j|jal|jr|or|ori|and|andi|beq|bne|slt|slti|sltiu|sltu|blt|bgt|ble|bge|move|mult|multu|mflo|mfhi|xor|xori|div|divu|nor|sll|srl|sra)\b/i,
      token: "keyword",
    },
    {
      // registers
      regex: /\$(?:zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|k[01]|gp|sp|fp|ra)\b/,
      token: "variable-2",
    },
    { regex: /#.*/, token: "comment" },
    { regex: /0x[0-9a-fA-F]+|-?\d+/, token: "number" },
    {
      regex: /\.(?:data|text|globl|asciiz|word|space|align|extern)/,
      token: "meta",
    },
    { regex: /[a-zA-Z_]\w*:/, token: "tag" },
    { regex: /"(?:[^\\]|\\.)*?"/, token: "string" },
  ],
});

const cpuEditor = CodeMirror.fromTextArea(codeEl, {
  lineNumbers: true,
  mode: "mips-custom",
  theme: "default",
  autoCloseBrackets: true,
  gutters: ["CodeMirror-linenumbers", "breakpoints"],
});

// Limit the vertical size of the code editor
const editorLineHeight = cpuEditor.defaultTextHeight();
const maxEditorHeight = editorLineHeight * 70;

cpuEditor.setSize("100%", null);
cpuEditor.getWrapperElement().style.width = "100%";
cpuEditor.getWrapperElement().style.height = `${maxEditorHeight}px`;
cpuEditor.getScrollerElement().style.maxHeight = `${maxEditorHeight}px`;
cpuEditor.getScrollerElement().style.overflowY = "auto";
cpuEditor.getScrollerElement().style.overflowX = "auto";
cpuEditor.refresh();

// Autosave code to localStorage on every change
cpuEditor.on('change', () => {
  if (currentLessonId) {
    localStorage.setItem(`mips_code_${currentLessonId}`, cpuEditor.getValue());
  }
});

// Draggable vertical resizer between assembler and right panel
(function initResizer() {
  const resizer = document.getElementById("v-resizer");
  const workspace = document.querySelector(".workspace");
  const assembler = document.querySelector(".assembler");
  const rightPanel = document.querySelector(".right-panel");
  if (!resizer || !workspace || !assembler || !rightPanel) return;

  let startX, startAsmWidth, startRightWidth, totalWidth;

  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;
    startAsmWidth = assembler.getBoundingClientRect().width;
    startRightWidth = rightPanel.getBoundingClientRect().width;
    totalWidth = startAsmWidth + startRightWidth;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMouseMove(e) {
      const dx = e.clientX - startX;
      let newAsm = startAsmWidth + dx;
      let newRight = startRightWidth - dx;
      // enforce minimums
      if (newAsm < 250) { newAsm = 250; newRight = totalWidth - 250; }
      if (newRight < 200) { newRight = 200; newAsm = totalWidth - 200; }

      const asmFr = newAsm / totalWidth;
      const rightFr = newRight / totalWidth;
      workspace.style.gridTemplateColumns = `${asmFr}fr 6px ${rightFr}fr`;
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      cpuEditor.refresh();
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
})();

const memStartInput = document.getElementById("mem-start-input");
const memGoBtn = document.getElementById("mem-go-btn");
const memView = document.getElementById("memory-view");

const MEM_CHUNK_SIZE = 128; // 128 bytes at a time max

function getSafeChar(code) {
  if (code >= 32 && code <= 126) {
    return String.fromCharCode(code);
  }

  return ".";
}

function updateMemoryView(highlightAddr = null, highlightSize = 0) {
  if (!cpu || !wasmReady || !memView) return;

  // get address
  let addrStr = memStartInput ? memStartInput.value.trim() : "0x10000000";
  let startAddr;

  // Support both Hex (0x...) and Decimal
  if (addrStr.toLowerCase().startsWith('0x')) {
    startAddr = parseInt(addrStr, 16);
  } else {
    startAddr = parseInt(addrStr, 10);
  }

  // default to 0x10000000 if input is empty or garbage (NaN)
  if (isNaN(startAddr)) {
    startAddr = 0x10000000;
  }

  // fix go button so check if number type
  if (typeof highlightAddr === 'number') {
      const rowStart = Math.floor(highlightAddr / 16) * 16;
      startAddr = rowStart;
      
      if (memStartInput) {
        memStartInput.value = "0x" + startAddr.toString(16).toUpperCase();
      }
  }

  // read memory
  let bytes;
  try {
    bytes = cpu.get_memory(startAddr, MEM_CHUNK_SIZE || 128);
  } catch (e) {
    console.error("Memory read error:", e);
    return;
  }

  // render
  let html = "";
  
  for (let i = 0; i < bytes.length; i += 16) {
    const currentAddr = startAddr + i;
    const slice = bytes.subarray(i, i + 16);

    const addrFmt = "0x" + currentAddr.toString(16).toUpperCase().padStart(8, "0");

    let hexFmt = "";
    let asciiFmt = "";

    for (let j = 0; j < 16; j++) {
      const byteAddr = currentAddr + j;
      let classStr = "byte-val";

      if (typeof highlightAddr === 'number' && 
          byteAddr >= highlightAddr && 
          byteAddr < highlightAddr + highlightSize) {
            
        classStr += " mem-highlight";
      }

      if (j < slice.length) {
        const val = slice[j];
        hexFmt += `<span class="${classStr}">${val.toString(16).toUpperCase().padStart(2, "0")}</span> `;
        asciiFmt += getSafeChar(val);
      } else {
        hexFmt += "   "; 
      }
      if (j === 7) hexFmt += " "; 
    }

    html += `
      <div class="mem-row">
        <span class="m-addr">${addrFmt}</span>
        <span class="m-hex">${hexFmt}</span>
        <span class="m-ascii">${asciiFmt}</span>
      </div>
    `;
  }
  
  memView.innerHTML = html;
}

if (memGoBtn) {
  memGoBtn.addEventListener("click", () => updateMemoryView());
}

// highlight current line
function clearHighlight() {
  if (currentLineMarker != null) {
    cpuEditor.removeLineClass(
      currentLineMarker,
      "background",
      "cm-highlighted-line"
    );
    currentLineMarker = null;
  }
}

function highlightCurrentLine() {
  clearHighlight();
  if (!cpu) return;
  const line = cpu.get_current_line();
  if (line >= 0) {
    currentLineMarker = cpuEditor.addLineClass(
      line,
      "background",
      "cm-highlighted-line"
    );
    cpuEditor.scrollIntoView({ line, ch: 0 }, 50);
  }
}

// breakpoints via gutter click
cpuEditor.on("gutterClick", (cm, lineIndex, gutter) => {
  if (gutter !== "breakpoints") return;

  const info = cm.lineInfo(lineIndex);
  if (info.gutterMarkers && info.gutterMarkers.breakpoints) {
    cm.setGutterMarker(lineIndex, "breakpoints", null);
    breakpoints.delete(lineIndex);
  } else {
    const marker = document.createElement("div");
    marker.innerHTML = "●";
    marker.style.cursor = "pointer";
    marker.style.padding = "0 3px";
    marker.style.fontSize = "13px";
    marker.style.color = "#f00";
    cm.setGutterMarker(lineIndex, "breakpoints", marker);
    breakpoints.add(lineIndex);
  }
});

// control for the emulator

function resetEmulator() {
  if (cpu && wasmReady) {
    cpu.reset();
  }
  if (consoleOut) {
    consoleOut.textContent = "Ready to load program.\n";
  }
  paintRegisters({});
  lastRegs = {};
  isProgramLoaded = false;
  if (stepBtn) stepBtn.disabled = false;
  if (runBtn) runBtn.disabled = false;

  breakpoints.clear();
  cpuEditor.clearGutter("breakpoints");
  clearHighlight();
  updateMemoryView();

  if (cpu && wasmReady) {
    updateWidgets(cpu.get_mmio_state());
    console.log("MMIO state:", cpu.get_mmio_state());
  } else {
    updateWidgets({});
  }
}

function loadProgram() {
  if (!cpu || !wasmReady) {
    log("WASM not initialized yet.");
    return false;
  }

  if (consoleOut) {
    consoleOut.textContent = "Loading program...\n";
  }
  paintRegisters({});
  lastRegs = {};

  const src = cpuEditor.getValue() || "";
  const result = cpu.load_source(src);

  if (result && result.error) {
    log("Load error: " + result.error);
    isProgramLoaded = false;
    return false;
  }

  log("Program loaded successfully.");
  isProgramLoaded = true;

  // Re-apply initial values since load_source resets the CPU
  if (currentLabData) {
    applyInitialValues(currentLabData);
  }

  cpu.set_breakpoints(Array.from(breakpoints));
  highlightCurrentLine();
  updateWidgets(cpu.get_mmio_state());

  return true;
}

function handleWasmResult(result, { fromRun = false } = {}) {
  // Support both result formats (raw registers or snapshot object)
  const rawRegs = (result && result.snapshot && result.snapshot.registers) || 
                  (result && result.registers) || {};
                  
  const allRegs = coerceRegs(rawRegs);

  const usedNames = getUsedRegisterNames();
  const tabRegs = filterForTab(allRegs, lastRegs, usedNames);
  
  paintRegisters(tabRegs);

  // handle memory read/write
  let hlAddr = null;
  let hlSize = 0;

  if (result && result.snapshot && 
      typeof result.snapshot.memory_access_addr === 'number') {
      
      hlAddr = result.snapshot.memory_access_addr;
      hlSize = result.snapshot.memory_access_size || 4;
  }

  updateMemoryView(hlAddr, hlSize);

  if (cpu && wasmReady) {
    updateWidgets(cpu.get_mmio_state());
    console.log("MMIO state:", cpu.get_mmio_state());
  }

  if (result && result.error) {
    // we have some kind of status / error string
    if (result.error === "Termination") {
      clearHighlight();

      if (Object.keys(allRegs).length) {
        log("All Registers (decimal + hex):");
        log("--------------------------------");

        for (const [r, v] of Object.entries(allRegs).sort(([a, b]) =>
          a.localeCompare(b)
        )) {
          log(`  ${r}: ${fmt(v)}`);
        }
        log("\nProgram Finished");
      }
      isProgramLoaded = false;
      
      if (stepBtn) stepBtn.disabled = true;
      if (runBtn) runBtn.disabled = true;

    } else if (result.error === "Breakpoint") {
      log("\n--- Hit Breakpoint ---");
      highlightCurrentLine();
      isProgramLoaded = true;
      if (stepBtn) stepBtn.disabled = false;
      if (runBtn) runBtn.disabled = false;

    } else {
      clearHighlight();

      log(`\n--- ${result.error} ---`);
      if (Object.keys(allRegs).length) {
        log("All Registers (decimal + hex):");
        log("--------------------------------");

        for (const [r, v] of Object.entries(allRegs).sort(([a, b]) =>
          a.localeCompare(b)
        )) {
          log(`  ${r}: ${fmt(v)}`);
        }
      }
      isProgramLoaded = false;

      if (stepBtn) stepBtn.disabled = true;
      if (runBtn) runBtn.disabled = true;
    }
  } else if (fromRun) {
    clearHighlight();

    if (Object.keys(allRegs).length) {
      log("All Registers (decimal + hex):");
      log("--------------------------------");
      for (const [r, v] of Object.entries(allRegs).sort(([a, b]) =>
        a.localeCompare(b)
      )) {
        log(`  ${r}: ${fmt(v)}`);
      }
    }

    isProgramLoaded = false;

    if (stepBtn) stepBtn.disabled = true;
    if (runBtn) runBtn.disabled = true;

    log("\nProgram Finished");
  }

  // keep snapshots in sync
  lastRegs = allRegs;
}


// buttons
if (runBtn) {
  runBtn.addEventListener("click", async () => {
    if (!wasmReady || !cpu) {
      log("WASM not initialized yet.");
      return;
    }

    clearHighlight();

    if (!isProgramLoaded) {
      if (!loadProgram()) return;
      // Log the code used for this Run session
      logRunTelemetry(false);
    } else {
      cpu.set_breakpoints(Array.from(breakpoints));
    }

    log("Running program...");
    runCount++;
    await new Promise(requestAnimationFrame);
    const result = cpu.run();
    handleWasmResult(result, { fromRun: true });

  });
}

if (stepBtn) {
  stepBtn.addEventListener("click", async () => {
    if (!wasmReady || !cpu) {
      log("WASM not initialized yet.");
      return;
    }

    if (!isProgramLoaded) {
      // This is the initial Step: log the source code now
      logRunTelemetry(true);
      if (!loadProgram()) return;
    }

    cpu.set_breakpoints(Array.from(breakpoints));

    const nextInsn = cpu.next_instruction();
    runCount++;
    log(`\n${nextInsn}`);

    if (nextInsn === "---") {
      handleWasmResult({
        error: "Termination",
        snapshot: { registers: lastRegs },
      });
      return;
    }

    await new Promise(requestAnimationFrame);
    const result = cpu.step();
    handleWasmResult(result);

    if (isProgramLoaded) {
      highlightCurrentLine();
    }
  });
}

if (stopBtn) {
  stopBtn.addEventListener("click", () => {
    resetEmulator();
  });
}

document.getElementById('grade-button')?.addEventListener('click', async () => {
    if (!currentLessonId) {
        alert('Please open a lesson first!');
        return;
    }
    
    // Get the student's MIPS source code from the editor
    const sourceCode = cpuEditor.getValue();
    
    if (!sourceCode || sourceCode.trim().length === 0) {
        alert('Please write some code first!');
        return;
    }
    
    console.log('DEBUG: Submitting source code:', sourceCode);
    
    // Submit for grading
    const resultsDiv = document.getElementById('grade-results');
    resultsDiv.innerHTML = '<p style="text-align:center; padding: 20px;">⏳ Grading...</p>';
    
    try {
        const response = await fetch('/api/grade/submit', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lab_id: currentLessonId,
                student_id: window.__currentUser?.username || 'anonymous',
                source_code: sourceCode,
                duration_seconds: labOpenedAt ? Math.round((Date.now() - labOpenedAt) / 1000) : null,
                run_count: runCount,
                started_at: labOpenedAt ? new Date(labOpenedAt).toISOString() : null
            })
        });
        
        const result = await response.json();
        console.log('DEBUG: Server response:', result);

        // Handle limit-reached rejection from server
        if (response.status === 403 && result.limit_reached) {
            resultsDiv.innerHTML = `<p style="color: #e74c3c; padding: 20px; font-weight: bold;">
                ${result.error}
            </p>`;
            // Refresh attempts display to make sure UI is in sync
            updateAttemptsDisplay(currentLessonId);
            return;
        }
        
        if (result.success) {
            displayGradeReport(result.grade_report);
            loadLatestSubmission(currentLessonId); 
            // Update the attempts counter after a successful submission
            updateAttemptsDisplay(currentLessonId);
            // Reset session tracking for the next attempt
            labOpenedAt = Date.now();
            runCount = 0;
        } else {
            resultsDiv.innerHTML = '<p style="color:red; padding: 20px;">Error: ' + result.error + '</p>';
        }
    } catch (error) {
        console.error('Grading error:', error);
        resultsDiv.innerHTML = '<p style="color:red; padding: 20px;">Network error: ' + error.message + '</p>';
    }
});


function displayGradeReport(report) {
    const resultsDiv = document.getElementById('grade-results');
    
    let html = `
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h3>Grade Report</h3>
            <div style="font-size: 2em; font-weight: bold; margin: 10px 0;">
                ${report.earned_points} / ${report.total_points}
            </div>
            <div style="font-size: 1.5em; color: ${report.percentage >= 70 ? '#27ae60' : '#e74c3c'};">
                ${report.percentage}%
            </div>
            <div style="margin: 15px 0;">
                <span style="color: #27ae60;">✓ ${report.passed} Passed</span> | 
                <span style="color: #e74c3c;">✗ ${report.failed} Failed</span>
            </div>
            <hr>
            <h4>Test Results:</h4>
    `;
    
    report.results.forEach(test => {
        const statusColor = test.status === 'PASS' ? '#27ae60' : '#e74c3c';
        const statusIcon = test.status === 'PASS' ? '✓' : '✗';
        
        html += `
            <div style="padding: 10px; margin: 10px 0; background: #f8f9fa; border-left: 4px solid ${statusColor};">
                <div style="font-weight: bold;">
                    <span style="color: ${statusColor};">${statusIcon}</span>
                    ${test.name}
                    <span style="float: right;">${test.earned}/${test.points} pts</span>
                </div>
                <div style="color: #666; font-size: 0.9em;">${test.message}</div>
        `;
        
        if (test.mismatches && test.mismatches.length > 0) {
            html += '<div style="margin-top: 8px; font-family: monospace; font-size: 0.9em;">';
            test.mismatches.forEach(m => {
                if (m.expected !== undefined) {
                    html += `<div style="color: #e74c3c;">
                        ${m.register}: expected ${m.expected}, got ${m.actual}
                    </div>`;
                } else {
                    html += `<div style="color: #e74c3c;">
                        ${m.register}: got ${m.actual} (incorrect)
                    </div>`;
                }
            });
            html += '</div>';
        }
        
        html += '</div>';
    });
    
    html += '</div>';
    resultsDiv.innerHTML = html;
}


async function loadLatestSubmission(labId) {
  const container = document.getElementById('latest-submission-container');
  if (!container) return;

  // Clear previous state
  container.innerHTML = '';
  container.classList.add('hidden');

  try {
    const response = await fetch(`/api/grade/latest/${labId}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      // no submission yet
      return; 
    }

    const data = await response.json();
    renderLatestSubmission(data);
    container.classList.remove('hidden');

  } catch (err) {
    console.warn("Error fetching latest submission:", err);
  }
}

function renderLatestSubmission(data) {
  const container = document.getElementById('latest-submission-container');
  
  // Format Date
  const dateObj = new Date(data.submitted_at);
  const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();

  // Parse Test Results
  let results = data.test_results;
  if (typeof results === 'string') {
    try { results = JSON.parse(results); } catch(e) { results = []; }
  }

  // Calculate Color
  const isPerfect = data.score === data.total_possible;
  const scoreClass = isPerfect ? 'score-green' : 'score-red';

  let html = `
    <div class="submission-header">
      <div class="sub-meta">
        <span>Latest submission - ${dateStr}</span>
        <button id="btn-restore-code" class="btn-restore" title="Replace editor content with this submission">Load Code</button>
      </div>
      <div class="sub-score ${scoreClass}">
        Total score: ${data.score} / ${data.total_possible}
      </div>
    </div>
    <div class="submission-body">
  `;

  // Generate list of tests
  results.forEach((test, index) => {
    const icon = test.status === 'PASS' ? '&#10003;' : '&#10007;'; 
    const color = test.status === 'PASS' ? '#2e7d32' : '#d32f2f';
    const uniqueId = `sub-detail-${index}`;
    let detailsHtml = '';
    
    // Mismatch Table
    if (test.status !== 'PASS' && test.mismatches && test.mismatches.length > 0) {
      const hasExpected = test.mismatches.some(m => m.expected !== undefined);

      if (hasExpected) {
        // Teacher/TA view — show full comparison table
        detailsHtml += `
          <div style="margin-bottom:5px; font-weight:600; color:#555;">Comparison</div>
          <table class="diff-table">
            <thead><tr><th>Item</th><th>Yours</th><th>Expected</th></tr></thead>
            <tbody>
        `;
        test.mismatches.forEach(m => {
          detailsHtml += `
            <tr class="diff-row-error">
              <td>${m.register}</td>
              <td class="val-error">${m.actual}</td>
              <td class="val-error">${m.expected}</td>
            </tr>
          `;
        });
        detailsHtml += `</tbody></table>`;
      } else {
        // Student view — only show their values, not expected
        detailsHtml += `
          <div style="margin-bottom:5px; font-weight:600; color:#555;">Incorrect Values</div>
          <table class="diff-table">
            <thead><tr><th>Item</th><th>Your Value</th></tr></thead>
            <tbody>
        `;
        test.mismatches.forEach(m => {
          detailsHtml += `
            <tr class="diff-row-error">
              <td>${m.register}</td>
              <td class="val-error">${m.actual}</td>
            </tr>
          `;
        });
        detailsHtml += `</tbody></table>`;
      }
    } else if (test.status !== 'PASS') {
      detailsHtml = `<div style="color:#d32f2f;">${test.message}</div>`;
    } else {
        detailsHtml = `<div style="color:#2e7d32;">Test passed successfully.</div>`;
    }

    html += `
      <div class="sub-test-item">
        <div class="sub-test-header" onclick="toggleSubDetail('${uniqueId}')">
          <div class="sub-test-title">
            <span style="color: ${color}; font-weight: bold; width: 15px;">${icon}</span>
            <span>${test.name}</span>
          </div>
          <div style="font-size: 12px; color: #666;">
             ${test.earned}/${test.points} <span style="margin-left:5px;">▼</span>
          </div>
        </div>
        <div id="${uniqueId}" class="sub-details">
          ${detailsHtml}
        </div>
      </div>
    `;
  });

  html += `</div>`; 
  container.innerHTML = html;

  const loadBtn = document.getElementById('btn-restore-code');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      // confirm before overwriting
      if (confirm("This will replace your current code with the code from this submission.\n\nAre you sure?")) {
        if (cpuEditor && data.source_code) {
            
          // We must replace them with actual newline characters for the editor.
          const formattedCode = data.source_code.replace(/\\n/g, '\n');
          
          cpuEditor.setValue(formattedCode);
          if (typeof clearHighlight === 'function') clearHighlight();
        }
      }
    });
  }
}

function updateWidgets(mmioMap) {
  const widgetsDiv = document.getElementById("widgets");
  if (!widgetsDiv) return;

  let entries = [];
  if (mmioMap instanceof Map) {
    entries = Array.from(mmioMap.entries());
  } else if (Array.isArray(mmioMap)) {
    entries = mmioMap;
  } else if (mmioMap && typeof mmioMap === "object") {
    entries = Object.entries(mmioMap);
  }

  if (entries.length === 0) {
    widgetsDiv.innerHTML = `<div style="padding:15px; color:#aaa; font-size:11px; text-align:center;">No active MMIO peripherals</div>`;
    return;
  }

  let html = "";
  for (const [addrKey, device] of entries) {
    const address = typeof addrKey === "string" ? parseInt(addrKey, 10) : addrKey;
    const hexAddr = "0x" + address.toString(16).toUpperCase();

    if (device && device.type === "Led") {
      const isOn = (device.data?.value ?? 0) !== 0;
      const colorInt = device.data?.color ?? 0x00FF00; 
      const colorHex = colorInt.toString(16).toUpperCase().padStart(6, "0");
      
      const dotColor = isOn ? `#${colorHex}` : "#444444";
      const glow = isOn ? `0 0 8px #${colorHex}AA` : "inset 0 1px 2px rgba(0,0,0,0.5)";

      html += `
        <div class="widget-item">
          <div class="led-status-dot" style="background: ${dotColor}; box-shadow: ${glow};"></div>
          
          <div class="widget-main">
            <span class="widget-label">LED Indicator</span>
            <span class="widget-meta">${hexAddr}</span>
          </div>

          <div class="widget-right">
            <span class="hex-chip" style="color: ${isOn ? `#${colorHex}` : '#888'};">#${colorHex}</span>
            <span class="status-text" style="color: ${isOn ? '#2e7d32' : '#757575'};">
              ${isOn ? "ACTIVE" : "OFF"}
            </span>
          </div>
        </div>
      `;
    }
  }

  widgetsDiv.innerHTML = html;
}

// init wasm

const urlParams = new URLSearchParams(window.location.search);
const requestedLessonId = urlParams.get("lesson") || null;

// Initialize lessons async — pick first from DB if no ?lesson= param
(async () => {
  // Hide "Professor View" nav link for TAs — they can only see Students tab
  const user = window.__currentUser;
  if (user && user.role === 'ta') {
    const profLink = document.querySelector('a[href="teacher.html"]');
    if (profLink) profLink.style.display = 'none';
  }

  const lessons = await allLessons();
  const sortedIds = Object.keys(lessons).sort();
  const initialLessonId = (requestedLessonId && lessons[requestedLessonId])
    ? requestedLessonId
    : (sortedIds[0] || null);

  await renderFiles(initialLessonId);
  if (initialLessonId && lessons[initialLessonId]) {
    showLesson(initialLessonId);
  }
})();

init()
  .then(() => {
    cpu = new WasmCPU();
    wasmReady = true;
    resetEmulator();
    log("WASM initialized.");
  })
  .catch((err) => {
    console.error("Error initializing WASM:", err);
    log("Error initializing WASM: " + err);
  });

window.toggleSubDetail = function(id) {
  const detailEl = document.getElementById(id);
  if (detailEl) {
    detailEl.classList.toggle('open');
  }
};