
/* Smart Manufacturing OS Visualizer - main script */

// ---------- Global state ----------
let cpuProcesses = [];
let editingCpuIndex = -1;

let storage = { capacity: 10, items: [], produced: 0, consumed: 0 };

const NUM_P = 5;
const NUM_R = 3;
let allocMatrix = [];
let maxMatrix = [];
let availVector = [];
let needMatrix = [];

let memoryBlocks = [100, 500, 200, 300, 600];
let memoryRequests = [];

let eventLogEntries = [];
let raceUnsyncCount = null;
let raceSyncCount = null;

// ---------- Navigation ----------
function showModule(moduleId) {
  const modules = document.querySelectorAll(".module");
  modules.forEach(function (m) { m.classList.add("hidden"); });
  const selected = document.getElementById(moduleId);
  if (selected) selected.classList.remove("hidden");
  if (moduleId === "cpu") renderCpuProcessTable();
  if (moduleId === "producer") { renderStorage(); renderEventLog(); }
  if (moduleId === "banker") { renderBankerTables(); }
  if (moduleId === "memory") { renderMemoryRequests(); renderMemoryBlocksInput(); }
}

// ---------- Helpers ----------
function setStatus(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = "status " + (type || "info");
}
function escapeHtml(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function colorClass(id) {
  let h = 0;
  for (let i = 0; i < String(id).length; i++) h += String(id).charCodeAt(i);
  return "p" + (h % 5);
}
function logEvent(msg) {
  const time = new Date().toLocaleTimeString();
  eventLogEntries.unshift("[" + time + "] " + msg);
  if (eventLogEntries.length > 100) eventLogEntries.pop();
  renderEventLog();
}
function renderEventLog() {
  const el = document.getElementById("eventLog");
  if (!el) return;
  el.innerHTML = eventLogEntries.map(function (e) { return "<div>" + escapeHtml(e) + "</div>"; }).join("");
}

// ---------- CPU SCHEDULING ----------
function renderCpuProcessTable() {
  const tbody = document.querySelector("#cpuProcessTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  cpuProcesses.forEach(function (p, idx) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + escapeHtml(p.id) + "</td><td>" + p.arrival + "</td><td>" + p.burst + "</td>" +
      "<td><button onclick=\"editCpuProcess(" + idx + ")\">Edit</button> " +
      "<button class=\"secondary\" onclick=\"removeCpuProcess(" + idx + ")\">Remove</button></td>";
    tbody.appendChild(tr);
  });
}

function addOrUpdateProcess() {
  const id = document.getElementById("cpuId").value.trim();
  const arrival = parseInt(document.getElementById("cpuArrival").value, 10);
  const burst = parseInt(document.getElementById("cpuBurst").value, 10);
  if (!id) { setStatus("cpuStatus", "Process ID is required.", "error"); return; }
  if (isNaN(arrival) || arrival < 0) { setStatus("cpuStatus", "Arrival time must be a non-negative integer.", "error"); return; }
  if (isNaN(burst) || burst <= 0) { setStatus("cpuStatus", "Burst time must be a positive integer.", "error"); return; }
  const dupIndex = cpuProcesses.findIndex(function (p, i) { return p.id === id && i !== editingCpuIndex; });
  if (dupIndex !== -1) { setStatus("cpuStatus", "Process ID must be unique.", "error"); return; }

  if (editingCpuIndex >= 0 && editingCpuIndex < cpuProcesses.length) {
    cpuProcesses[editingCpuIndex] = { id: id, arrival: arrival, burst: burst };
    editingCpuIndex = -1;
    setStatus("cpuStatus", "Process updated.", "success");
  } else {
    cpuProcesses.push({ id: id, arrival: arrival, burst: burst });
    setStatus("cpuStatus", "Process added.", "success");
  }
  document.getElementById("cpuId").value = "";
  document.getElementById("cpuArrival").value = "";
  document.getElementById("cpuBurst").value = "";
  renderCpuProcessTable();
}

function editCpuProcess(idx) {
  const p = cpuProcesses[idx];
  document.getElementById("cpuId").value = p.id;
  document.getElementById("cpuArrival").value = p.arrival;
  document.getElementById("cpuBurst").value = p.burst;
  editingCpuIndex = idx;
  setStatus("cpuStatus", "Editing process " + p.id + ". Click Add / Update to save.", "info");
}

function removeCpuProcess(idx) {
  cpuProcesses.splice(idx, 1);
  if (editingCpuIndex === idx) editingCpuIndex = -1;
  renderCpuProcessTable();
  setStatus("cpuStatus", "Process removed.", "success");
}

function loadCpuSample() {
  cpuProcesses = [
    { id: "P1", arrival: 0, burst: 5 },
    { id: "P2", arrival: 1, burst: 3 },
    { id: "P3", arrival: 2, burst: 8 },
    { id: "P4", arrival: 3, burst: 6 }
  ];
  editingCpuIndex = -1;
  renderCpuProcessTable();
  setStatus("cpuStatus", "Sample process data loaded.", "success");
}

function resetCpu() {
  cpuProcesses = [];
  editingCpuIndex = -1;
  clearCpuResults();
  renderCpuProcessTable();
  setStatus("cpuStatus", "Process list cleared.", "info");
}

function clearCpuResults() {
  const g = document.getElementById("ganttContainer");
  if (g) g.innerHTML = "";
  const tb = document.querySelector("#cpuResultTable tbody");
  if (tb) tb.innerHTML = "";
  const av = document.getElementById("cpuAverages");
  if (av) av.innerHTML = "";
}

// ---------- CPU Algorithms ----------
function runFCFS(processes) {
  const ps = processes.map(function (p, i) { return { id: p.id, arrival: p.arrival, burst: p.burst, idx: i }; });
  ps.sort(function (a, b) { if (a.arrival !== b.arrival) return a.arrival - b.arrival; return a.idx - b.idx; });
  const gantt = [];
  const resultById = {};
  let time = 0;
  ps.forEach(function (p) {
    if (p.arrival > time) {
      gantt.push({ start: time, end: p.arrival, label: "Idle", idle: true });
      time = p.arrival;
    }
    const start = time;
    time += p.burst;
    gantt.push({ start: start, end: time, label: p.id, idle: false });
    resultById[p.id] = { id: p.id, arrival: p.arrival, burst: p.burst, ct: time, firstStart: start };
  });
  const results = processes.map(function (p) {
    const r = resultById[p.id];
    const tat = r.ct - r.arrival;
    const wt = tat - r.burst;
    const rt = r.firstStart - r.arrival;
    return { id: p.id, arrival: p.arrival, burst: p.burst, ct: r.ct, tat: tat, wt: wt, rt: rt };
  });
  const avgTat = results.reduce((s, r) => s + r.tat, 0) / (results.length || 1);
  const avgWt = results.reduce((s, r) => s + r.wt, 0) / (results.length || 1);
  const avgRt = results.reduce((s, r) => s + r.rt, 0) / (results.length || 1);
  return { gantt: gantt, results: results, avgTat: avgTat, avgWt: avgWt, avgRt: avgRt };
}

function runSJF(processes) {
  const remaining = processes.map(function (p, i) { return { id: p.id, arrival: p.arrival, burst: p.burst, done: false, idx: i }; });
  const gantt = [];
  const resultById = {};
  let time = 0;
  let completed = 0;
  const n = remaining.length;
  while (completed < n) {
    const candidates = remaining.filter(function (p) { return !p.done && p.arrival <= time; });
    if (candidates.length === 0) {
      const nextArr = Math.min.apply(null, remaining.filter(function (p) { return !p.done; }).map(function (p) { return p.arrival; }));
      gantt.push({ start: time, end: nextArr, label: "Idle", idle: true });
      time = nextArr;
      continue;
    }
    candidates.sort(function (a, b) {
      if (a.burst !== b.burst) return a.burst - b.burst;
      if (a.arrival !== b.arrival) return a.arrival - b.arrival;
      return a.idx - b.idx;
    });
    const p = candidates[0];
    const start = time;
    time += p.burst;
    p.done = true;
    completed++;
    gantt.push({ start: start, end: time, label: p.id, idle: false });
    resultById[p.id] = { id: p.id, arrival: p.arrival, burst: p.burst, ct: time, firstStart: start };
  }
  const results = processes.map(function (p) {
    const r = resultById[p.id];
    const tat = r.ct - r.arrival;
    const wt = tat - r.burst;
    const rt = r.firstStart - r.arrival;
    return { id: p.id, arrival: p.arrival, burst: p.burst, ct: r.ct, tat: tat, wt: wt, rt: rt };
  });
  const avgTat = results.reduce((s, r) => s + r.tat, 0) / (results.length || 1);
  const avgWt = results.reduce((s, r) => s + r.wt, 0) / (results.length || 1);
  const avgRt = results.reduce((s, r) => s + r.rt, 0) / (results.length || 1);
  return { gantt: gantt, results: results, avgTat: avgTat, avgWt: avgWt, avgRt: avgRt };
}

function runRR(processes, quantum) {
  const q = Math.max(1, quantum);
  const sorted = processes.map(function (p, i) { return { id: p.id, arrival: p.arrival, burst: p.burst, remaining: p.burst, idx: i }; })
    .sort(function (a, b) { if (a.arrival !== b.arrival) return a.arrival - b.arrival; return a.idx - b.idx; });
  const gantt = [];
  const resultById = {};
  const firstStart = {};
  let time = 0;
  let completed = 0;
  const n = sorted.length;
  const ready = [];
  let i = 0;
  while (i < n && sorted[i].arrival <= time) { ready.push(sorted[i]); i++; }
  while (completed < n) {
    if (ready.length === 0) {
      const nextArr = sorted[i].arrival;
      gantt.push({ start: time, end: nextArr, label: "Idle", idle: true });
      time = nextArr;
      while (i < n && sorted[i].arrival <= time) { ready.push(sorted[i]); i++; }
      continue;
    }
    const p = ready.shift();
    if (firstStart[p.id] === undefined) firstStart[p.id] = time;
    const run = Math.min(q, p.remaining);
    const start = time;
    time += run;
    p.remaining -= run;
    gantt.push({ start: start, end: time, label: p.id, idle: false });
    while (i < n && sorted[i].arrival <= time) { ready.push(sorted[i]); i++; }
    if (p.remaining > 0) {
      ready.push(p);
    } else {
      completed++;
      resultById[p.id] = { id: p.id, arrival: p.arrival, burst: p.burst, ct: time, firstStart: firstStart[p.id] };
    }
  }
  const results = processes.map(function (p) {
    const r = resultById[p.id];
    const tat = r.ct - r.arrival;
    const wt = tat - r.burst;
    const rt = r.firstStart - r.arrival;
    return { id: p.id, arrival: p.arrival, burst: p.burst, ct: r.ct, tat: tat, wt: wt, rt: rt };
  });
  const avgTat = results.reduce((s, r) => s + r.tat, 0) / (results.length || 1);
  const avgWt = results.reduce((s, r) => s + r.wt, 0) / (results.length || 1);
  const avgRt = results.reduce((s, r) => s + r.rt, 0) / (results.length || 1);
  return { gantt: gantt, results: results, avgTat: avgTat, avgWt: avgWt, avgRt: avgRt };
}
function renderGantt(segments, containerId) {
  const container = document.getElementById(containerId || "ganttContainer");
  if (!container) return;
  container.innerHTML = "";
  if (!segments || segments.length === 0) { container.textContent = "No data."; return; }
  const maxEnd = segments[segments.length - 1].end;
  const scale = Math.max(18, Math.min(40, 600 / Math.max(1, maxEnd)));
  segments.forEach(function (seg) {
    const wrap = document.createElement("div");
    wrap.className = "gantt-wrap";
    const block = document.createElement("div");
    block.className = "gantt-block " + (seg.idle ? "idle" : colorClass(seg.label));
    const dur = seg.end - seg.start;
    block.style.width = (dur * scale + 8) + "px";
    block.innerHTML = seg.label + "<br><span style='font-size:10px;font-weight:400'>" + seg.start + "-" + seg.end + "</span>";
    wrap.appendChild(block);
    container.appendChild(wrap);
  });
}

function renderGanttInto(segments, container) {
  if (!container) return;
  if (!segments || segments.length === 0) { container.textContent = "No data."; return; }
  const maxEnd = segments[segments.length - 1].end;
  const scale = Math.max(18, Math.min(40, 600 / Math.max(1, maxEnd)));
  segments.forEach(function (seg) {
    const wrap = document.createElement("div");
    wrap.className = "gantt-wrap";
    const block = document.createElement("div");
    block.className = "gantt-block " + (seg.idle ? "idle" : colorClass(seg.label));
    const dur = seg.end - seg.start;
    block.style.width = (dur * scale + 8) + "px";
    block.innerHTML = seg.label + "<br><span style='font-size:10px;font-weight:400'>" + seg.start + "-" + seg.end + "</span>";
    wrap.appendChild(block);
    container.appendChild(wrap);
  });
}

function renderCpuResults(res, title) {
  const tbody = document.querySelector("#cpuResultTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  res.results.forEach(function (r) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + escapeHtml(r.id) + "</td><td>" + r.arrival + "</td><td>" + r.burst + "</td><td>" + r.ct + "</td><td>" + r.tat + "</td><td>" + r.wt + "</td><td>" + r.rt + "</td>";
    tbody.appendChild(tr);
  });
  const av = document.getElementById("cpuAverages");
  if (av) av.innerHTML = (title ? "<strong>" + title + "</strong><br>" : "") +
    "Average Turnaround Time: " + res.avgTat.toFixed(2) +
    " | Average Waiting Time: " + res.avgWt.toFixed(2) +
    " | Average Response Time: " + res.avgRt.toFixed(2);
}

function runCpu(mode) {
  if (cpuProcesses.length === 0) { setStatus("cpuStatus", "Add at least one process first.", "error"); return; }
  clearCpuResults();
  const container = document.getElementById("ganttContainer");
  if (mode === "fcfs") {
    const res = runFCFS(cpuProcesses);
    renderGantt(res.gantt);
    renderCpuResults(res, "FCFS");
    setStatus("cpuStatus", "FCFS executed.", "success");
  } else if (mode === "sjf") {
    const res = runSJF(cpuProcesses);
    renderGantt(res.gantt);
    renderCpuResults(res, "SJF (Non-preemptive)");
    setStatus("cpuStatus", "SJF executed.", "success");
  } else if (mode === "rr") {
    const q = parseInt(document.getElementById("quantum").value, 10);
    if (isNaN(q) || q <= 0) { setStatus("cpuStatus", "Time quantum must be a positive integer.", "error"); return; }
    const res = runRR(cpuProcesses, q);
    renderGantt(res.gantt);
    renderCpuResults(res, "Round Robin (q=" + q + ")");
    setStatus("cpuStatus", "Round Robin executed.", "success");
  } else if (mode === "compare") {
    const q = parseInt(document.getElementById("quantum").value, 10);
    if (isNaN(q) || q <= 0) { setStatus("cpuStatus", "Time quantum must be a positive integer.", "error"); return; }
    const r1 = runFCFS(cpuProcesses);
    const r2 = runSJF(cpuProcesses);
    const r3 = runRR(cpuProcesses, q);
    container.innerHTML = "";
    const makeTitle = function (t) { const h = document.createElement("div"); h.style.fontWeight = "700"; h.style.margin = "6px 0"; h.textContent = t; return h; };
    container.appendChild(makeTitle("FCFS"));
    const g1 = document.createElement("div"); g1.className = "gantt-container"; container.appendChild(g1); renderGanttInto(r1.gantt, g1);
    container.appendChild(makeTitle("SJF (Non-preemptive)"));
    const g2 = document.createElement("div"); g2.className = "gantt-container"; container.appendChild(g2); renderGanttInto(r2.gantt, g2);
    container.appendChild(makeTitle("Round Robin (q=" + q + ")"));
    const g3 = document.createElement("div"); g3.className = "gantt-container"; container.appendChild(g3); renderGanttInto(r3.gantt, g3);
    const tbody = document.querySelector("#cpuResultTable tbody");
    tbody.innerHTML = "";
    const rows = [["FCFS", r1], ["SJF", r2], ["Round Robin", r3]];
    rows.forEach(function (row) {
      const r = row[1];
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>" + row[0] + "</td><td>-</td><td>-</td><td>-</td><td>" + r.avgTat.toFixed(2) + "</td><td>" + r.avgWt.toFixed(2) + "</td><td>" + r.avgRt.toFixed(2) + "</td>";
      tbody.appendChild(tr);
    });
    document.getElementById("cpuAverages").innerHTML = "Comparison of average metrics (TAT/WT/RT) shown above.";
    setStatus("cpuStatus", "All three algorithms compared.", "success");
  }
}

// ---------- PRODUCER-CONSUMER ----------
function setStorageCapacity() {
  const cap = parseInt(document.getElementById("storageCapacity").value, 10);
  if (isNaN(cap) || cap < 1 || cap > 20) { setStatus("storageStatus", "Capacity must be 1-20.", "error"); return; }
  storage.capacity = cap;
  if (storage.items.length > cap) storage.items = storage.items.slice(0, cap);
  renderStorage();
  setStatus("storageStatus", "Storage capacity set to " + cap + ".", "success");
  logEvent("Storage capacity set to " + cap);
}

function produceItem() {
  const full = storage.items.length >= storage.capacity;
  if (full) { setStatus("storageStatus", "Storage is FULL. Producer must wait (Empty semaphore = 0).", "error"); logEvent("Producer blocked: storage full"); return; }
  const type = document.getElementById("itemType").value;
  const id = "I" + (storage.produced + 1);
  storage.items.push({ id: id, type: type });
  storage.produced++;
  renderStorage();
  setStatus("storageStatus", "Produced " + id + " (" + type + ").", "success");
  logEvent("Produced " + id + " (" + type + ")");
}

function consumeItem() {
  if (storage.items.length === 0) { setStatus("storageStatus", "Storage is EMPTY. Consumer must wait (Full semaphore = 0).", "error"); logEvent("Consumer blocked: storage empty"); return; }
  const item = storage.items.shift();
  storage.consumed++;
  renderStorage();
  setStatus("storageStatus", "Consumed " + item.id + " (" + item.type + ").", "success");
  logEvent("Consumed " + item.id + " (" + item.type + ")");
}

function resetStorage() {
  storage = { capacity: storage.capacity, items: [], produced: 0, consumed: 0 };
  renderStorage();
  setStatus("storageStatus", "Storage reset.", "info");
  logEvent("Storage reset");
}

function renderStorage() {
  const cap = storage.capacity;
  const slots = document.getElementById("storageSlots");
  if (slots) {
    let html = "";
    for (let i = 0; i < cap; i++) {
      const item = storage.items[i];
      if (item) html += "<div class='slot filled " + colorClass(item.id) + "'>" + escapeHtml(item.id) + "</div>";
      else html += "<div class='slot empty'>empty</div>";
    }
    slots.innerHTML = html;
  }
  const sc = document.getElementById("statCapacity"); if (sc) sc.textContent = cap;
  const ss = document.getElementById("statStored"); if (ss) ss.textContent = storage.items.length;
  const sf = document.getElementById("statFree"); if (sf) sf.textContent = cap - storage.items.length;
  const sp = document.getElementById("statProduced"); if (sp) sp.textContent = storage.produced;
  const scon = document.getElementById("statConsumed"); if (scon) scon.textContent = storage.consumed;
}

function toggleRaceMode() {
  const cb = document.getElementById("raceModeToggle");
  const panel = document.getElementById("raceModePanel");
  if (!cb || !panel) return;
  if (cb.checked) panel.classList.remove("hidden");
  else panel.classList.add("hidden");
}

function runRaceDemo(mode) {
  const steps = document.getElementById("raceSteps");
  if (!steps) return;
  const stepsArr = [];
  if (mode === "unsync") {
    let count = 0;
    // two "threads" read stale value
    const a = count;
    const b = count;
    const aNew = a + 1;
    const bNew = b + 1;
    count = aNew; // second update lost
    stepsArr.push("Thread A reads count = " + a);
    stepsArr.push("Thread B reads count = " + b + " (stale)");
    stepsArr.push("Thread A writes count = " + aNew);
    stepsArr.push("Thread B writes count = " + bNew + " (overwrites, update lost)");
    stepsArr.push("Final count = " + count + " (expected 2)");
    raceUnsyncCount = count;
  } else {
    let count = 0;
    // mutex protects
    count = count + 1;
    count = count + 1;
    stepsArr.push("Thread A acquires mutex");
    stepsArr.push("Thread A increments count -> " + (count - 1 + 1));
    stepsArr.push("Thread A releases mutex");
    stepsArr.push("Thread B acquires mutex");
    stepsArr.push("Thread B increments count -> " + count);
    stepsArr.push("Thread B releases mutex");
    stepsArr.push("Final count = " + count + " (expected 2)");
    raceSyncCount = count;
  }
  steps.innerHTML = stepsArr.map(function (s) { return "<div>" + escapeHtml(s) + "</div>"; }).join("");
  if (mode === "unsync") {
    const el = document.getElementById("raceUnsyncCount"); if (el) el.textContent = raceUnsyncCount;
  } else {
    const el = document.getElementById("raceSyncCount"); if (el) el.textContent = raceSyncCount;
  }
  logEvent("Race demo (" + mode + ") final count recorded.");
}

function resetRaceDemo() {
  raceUnsyncCount = null;
  raceSyncCount = null;
  const el1 = document.getElementById("raceUnsyncCount"); if (el1) el1.textContent = "-";
  const el2 = document.getElementById("raceSyncCount"); if (el2) el2.textContent = "-";
  const steps = document.getElementById("raceSteps"); if (steps) steps.innerHTML = "";
  setStatus("storageStatus", "Race demo reset.", "info");
}
// ---------- BANKER'S ALGORITHM ----------
function loadBankerDefault() {
  allocMatrix = [
    [0,1,0],
    [2,0,0],
    [3,0,2],
    [2,1,1],
    [0,0,2]
  ];
  maxMatrix = [
    [7,5,3],
    [3,2,2],
    [9,0,2],
    [2,2,2],
    [4,3,3]
  ];
  availVector = [3,3,2];
  needMatrix = [];
  renderBankerTables();
  setStatus("bankerStatus", "Default safe example loaded. Click Calculate Need then Check Safety.", "info");
  document.getElementById("bankerSteps").innerHTML = "";
  document.getElementById("bankerSequence").innerHTML = "";
}

function loadBankerUnsafe() {
  allocMatrix = [
    [0,1,0],
    [2,0,0],
    [3,0,2],
    [2,1,1],
    [0,0,2]
  ];
  maxMatrix = [
    [7,5,3],
    [3,2,2],
    [9,0,2],
    [2,2,2],
    [4,3,3]
  ];
  availVector = [0,0,0];
  needMatrix = [];
  renderBankerTables();
  setStatus("bankerStatus", "Unsafe example loaded (no available resources).", "info");
  document.getElementById("bankerSteps").innerHTML = "";
  document.getElementById("bankerSequence").innerHTML = "";
}

function setAlloc(i, j, val) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 0) return;
  allocMatrix[i][j] = n;
}
function setMax(i, j, val) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 0) return;
  maxMatrix[i][j] = n;
}
function setAvail(j, val) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 0) return;
  availVector[j] = n;
}

function renderBankerTables() {
  if (!allocMatrix.length) loadBankerDefault();
  const alloc = document.getElementById("allocTable");
  if (alloc) {
    let html = "<table class='matrix-table'><tr><th>Process</th><th>R1</th><th>R2</th><th>R3</th></tr>";
    for (let i = 0; i < NUM_P; i++) {
      html += "<tr><td>P" + i + "</td>";
      for (let j = 0; j < NUM_R; j++) html += "<td><input type='number' min='0' value='" + allocMatrix[i][j] + "' onchange='setAlloc(" + i + "," + j + ",this.value)'></td>";
      html += "</tr>";
    }
    html += "</table>";
    alloc.innerHTML = html;
  }
  const mx = document.getElementById("maxTable");
  if (mx) {
    let html = "<table class='matrix-table'><tr><th>Process</th><th>R1</th><th>R2</th><th>R3</th></tr>";
    for (let i = 0; i < NUM_P; i++) {
      html += "<tr><td>P" + i + "</td>";
      for (let j = 0; j < NUM_R; j++) html += "<td><input type='number' min='0' value='" + maxMatrix[i][j] + "' onchange='setMax(" + i + "," + j + ",this.value)'></td>";
      html += "</tr>";
    }
    html += "</table>";
    mx.innerHTML = html;
  }
  const av = document.getElementById("availTable");
  if (av) {
    let html = "<table class='matrix-table'><tr><th>R1</th><th>R2</th><th>R3</th></tr><tr>";
    for (let j = 0; j < NUM_R; j++) html += "<td><input type='number' min='0' value='" + availVector[j] + "' onchange='setAvail(" + j + ",this.value)'></td>";
    html += "</tr></table>";
    av.innerHTML = html;
  }
}


function calculateNeed() {
  if (!allocMatrix.length) loadBankerDefault();
  needMatrix = [];
  for (let i = 0; i < NUM_P; i++) {
    const row = [];
    for (let j = 0; j < NUM_R; j++) {
      const need = maxMatrix[i][j] - allocMatrix[i][j];
      row.push(need < 0 ? 0 : need);
    }
    needMatrix.push(row);
  }
  renderNeedTable();
  setStatus("bankerStatus", "Need matrix calculated (Need = Max - Allocation).", "success");
}

function renderNeedTable() {
  const container = document.getElementById("needTable");
  if (!container) return;
  if (!needMatrix.length) { container.innerHTML = ""; return; }
  let html = "<table class='matrix-table'><tr><th>Process</th><th>R1</th><th>R2</th><th>R3</th></tr>";
  for (let i = 0; i < NUM_P; i++) {
    html += "<tr><td>P" + i + "</td>";
    for (let j = 0; j < NUM_R; j++) html += "<td>" + needMatrix[i][j] + "</td>";
    html += "</tr>";
  }
  html += "</table>";
  container.innerHTML = html;
}

function checkSafety() {
  if (!allocMatrix.length) loadBankerDefault();
  if (!needMatrix.length) calculateNeed();
  const work = availVector.slice();
  const finish = new Array(NUM_P).fill(false);
  const sequence = [];
  const steps = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < NUM_P; i++) {
      if (finish[i]) continue;
      let ok = true;
      for (let j = 0; j < NUM_R; j++) {
        if (needMatrix[i][j] > work[j]) { ok = false; break; }
      }
      if (ok) {
        for (let j = 0; j < NUM_R; j++) work[j] += allocMatrix[i][j];
        finish[i] = true;
        sequence.push(i);
        steps.push("P" + i + " can finish (Need <= Work). Work becomes [" + work.join(",") + "].");
        progress = true;
      }
    }
  }
  const allFinished = finish.every(function (f) { return f; });
  const stepsEl = document.getElementById("bankerSteps");
  if (stepsEl) stepsEl.innerHTML = steps.map(function (s) { return "<div>" + escapeHtml(s) + "</div>"; }).join("") || "<div>No process could proceed.</div>";
  const seqEl = document.getElementById("bankerSequence");
  if (seqEl) {
    if (allFinished) {
      seqEl.innerHTML = "<strong>Safe sequence: " + sequence.map(function (i) { return "P" + i; }).join(" -> ") + "</strong>";
      setStatus("bankerStatus", "System is in a SAFE state.", "success");
    } else {
      seqEl.innerHTML = "<strong>Unsafe state - no safe sequence exists.</strong>";
      setStatus("bankerStatus", "System is in an UNSAFE state.", "error");
    }
  }
  logEvent(allFinished ? "Banker safety check: SAFE (" + sequence.map(function (i) { return "P" + i; }).join(",") + ")" : "Banker safety check: UNSAFE");
}

function requestResources() {
  if (!allocMatrix.length) loadBankerDefault();
  if (!needMatrix.length) calculateNeed();
  const p = parseInt(document.getElementById("reqProcess").value, 10);
  const req = [
    parseInt(document.getElementById("reqR1").value, 10) || 0,
    parseInt(document.getElementById("reqR2").value, 10) || 0,
    parseInt(document.getElementById("reqR3").value, 10) || 0
  ];
  const statusEl = document.getElementById("requestStatus");
  if (isNaN(p) || p < 0 || p >= NUM_P) { setStatus("requestStatus", "Invalid process index.", "error"); return; }
  if (req.some(function (v) { return isNaN(v) || v < 0; })) { setStatus("requestStatus", "Request values must be non-negative.", "error"); return; }
  for (let j = 0; j < NUM_R; j++) {
    if (req[j] > needMatrix[p][j]) { setStatus("requestStatus", "Request exceeds Need for P" + p + ".", "error"); return; }
    if (req[j] > availVector[j]) { setStatus("requestStatus", "Request exceeds Available resources.", "error"); return; }
  }
  // pretend allocate
  const savedAvail = availVector.slice();
  const savedAlloc = allocMatrix.map(function (r) { return r.slice(); });
  const savedNeed = needMatrix.map(function (r) { return r.slice(); });
  for (let j = 0; j < NUM_R; j++) {
    availVector[j] -= req[j];
    allocMatrix[p][j] += req[j];
    needMatrix[p][j] -= req[j];
  }
  // safety check silently
  const work = availVector.slice();
  const finish = new Array(NUM_P).fill(false);
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < NUM_P; i++) {
      if (finish[i]) continue;
      let ok = true;
      for (let j = 0; j < NUM_R; j++) if (needMatrix[i][j] > work[j]) { ok = false; break; }
      if (ok) {
        for (let j = 0; j < NUM_R; j++) work[j] += allocMatrix[i][j];
        finish[i] = true;
        progress = true;
      }
    }
  }
  const safe = finish.every(function (f) { return f; });
  if (safe) {
    renderBankerTables();
    renderNeedTable();
    setStatus("requestStatus", "Request granted (system remains safe).", "success");
    logEvent("Resource request granted for P" + p + " [" + req.join(",") + "]");
  } else {
    // rollback
    availVector = savedAvail;
    allocMatrix = savedAlloc;
    needMatrix = savedNeed;
    renderBankerTables();
    renderNeedTable();
    setStatus("requestStatus", "Request denied (would lead to unsafe state).", "error");
    logEvent("Resource request denied for P" + p + " [" + req.join(",") + "]");
  }
}

// ---------- MEMORY MANAGEMENT ----------
function setMemoryBlocks() {
  const raw = document.getElementById("memoryBlocks").value;
  const parts = raw.split(",").map(function (s) { return parseInt(s.trim(), 10); }).filter(function (n) { return !isNaN(n) && n > 0; });
  if (parts.length === 0) { setStatus("memoryStatus", "Enter at least one positive block size.", "error"); return; }
  memoryBlocks = parts;
  renderMemoryBlocksInput();
  setStatus("memoryStatus", "Memory blocks set: " + memoryBlocks.join(", "), "success");
}

function loadMemoryExample() {
  memoryBlocks = [100, 500, 200, 300, 600];
  memoryRequests = [
    { name: "P1", size: 120 },
    { name: "P2", size: 350 },
    { name: "P3", size: 80 },
    { name: "P4", size: 200 },
    { name: "P5", size: 250 }
  ];
  document.getElementById("memoryBlocks").value = memoryBlocks.join(", ");
  renderMemoryBlocksInput();
  renderMemoryRequests();
  setStatus("memoryStatus", "Example blocks and requests loaded.", "success");
}

function renderMemoryBlocksInput() {
  const inp = document.getElementById("memoryBlocks");
  if (inp && document.activeElement !== inp) inp.value = memoryBlocks.join(", ");
}

function addMemoryRequest() {
  const name = document.getElementById("memProcess").value.trim();
  const size = parseInt(document.getElementById("memSize").value, 10);
  if (!name) { setStatus("memoryStatus", "Process name is required.", "error"); return; }
  if (isNaN(size) || size <= 0) { setStatus("memoryStatus", "Request size must be positive.", "error"); return; }
  memoryRequests.push({ name: name, size: size });
  document.getElementById("memProcess").value = "";
  document.getElementById("memSize").value = "";
  renderMemoryRequests();
  setStatus("memoryStatus", "Request added.", "success");
}

function removeMemoryRequest(idx) {
  memoryRequests.splice(idx, 1);
  renderMemoryRequests();
}

function renderMemoryRequests() {
  const tbody = document.querySelector("#memRequestTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  memoryRequests.forEach(function (r, idx) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + escapeHtml(r.name) + "</td><td>" + r.size + "</td>" +
      "<td><button class='secondary' onclick='removeMemoryRequest(" + idx + ")'>Remove</button></td>";
    tbody.appendChild(tr);
  });
}

function runMemoryAllocation(strategy, blocks, requests) {
  let segs = blocks.map(function (s, i) { return { id: "B" + (i + 1), size: s, free: true, process: null }; });
  const results = [];
  requests.forEach(function (req) {
    const candidates = segs.map(function (s, idx) { return { seg: s, idx: idx }; })
      .filter(function (x) { return x.seg.free && x.seg.size >= req.size; });
    let chosenIdx = -1;
    if (candidates.length > 0) {
      if (strategy === "first") {
        chosenIdx = candidates[0].idx;
      } else {
        let best = candidates[0];
        candidates.forEach(function (c) { if (c.seg.size < best.seg.size) best = c; });
        chosenIdx = best.idx;
      }
    }
    if (chosenIdx === -1) {
      results.push({ strategy: strategy, process: req.name, size: req.size, block: "-", status: "Fail" });
    } else {
      const seg = segs[chosenIdx];
      const blockLabel = seg.id;
      if (seg.size === req.size) {
        seg.free = false;
        seg.process = req.name;
      } else {
        const remainder = seg.size - req.size;
        segs.splice(chosenIdx, 1,
          { id: blockLabel + "a", size: req.size, free: false, process: req.name },
          { id: blockLabel + "b", size: remainder, free: true, process: null }
        );
      }
      results.push({ strategy: strategy, process: req.name, size: req.size, block: blockLabel, status: "Allocated" });
    }
  });
  return { segments: segs, results: results };
}

function renderMemVis(container, segments) {
  if (!container) return;
  container.innerHTML = "";
  const total = segments.reduce(function (s, seg) { return s + seg.size; }, 0) || 1;
  segments.forEach(function (seg) {
    const div = document.createElement("div");
    div.className = "mem-seg " + (seg.free ? "free" : "alloc");
    const pct = (seg.size / total * 100);
    div.style.width = pct + "%";
    div.innerHTML = (seg.free ? "Free" : seg.process) + "<br>" + seg.size;
    container.appendChild(div);
  });
}

function runMemory(mode) {
  if (memoryBlocks.length === 0) { setStatus("memoryStatus", "Set memory blocks first.", "error"); return; }
  if (memoryRequests.length === 0) { setStatus("memoryStatus", "Add at least one request.", "error"); return; }
  const tbody = document.querySelector("#memResultTable tbody");
  if (tbody) tbody.innerHTML = "";
  if (mode === "first" || mode === "compare") {
    const r = runMemoryAllocation("first", memoryBlocks, memoryRequests);
    renderMemVis(document.getElementById("firstFitVis"), r.segments);
    const allocCount = r.results.filter(function (x) { return x.status === "Allocated"; }).length;
    const failCount = r.results.length - allocCount;
    document.getElementById("firstFitStats").innerHTML = "Allocated: " + allocCount + " | Failed: " + failCount + " | Total segments: " + r.segments.length;
    r.results.forEach(function (res) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>First Fit</td><td>" + escapeHtml(res.process) + "</td><td>" + res.size + "</td><td>" + res.block + "</td><td>" + res.status + "</td>";
      if (tbody) tbody.appendChild(tr);
    });
  }
  if (mode === "best" || mode === "compare") {
    const r = runMemoryAllocation("best", memoryBlocks, memoryRequests);
    renderMemVis(document.getElementById("bestFitVis"), r.segments);
    const allocCount = r.results.filter(function (x) { return x.status === "Allocated"; }).length;
    const failCount = r.results.length - allocCount;
    document.getElementById("bestFitStats").innerHTML = "Allocated: " + allocCount + " | Failed: " + failCount + " | Total segments: " + r.segments.length;
    r.results.forEach(function (res) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>Best Fit</td><td>" + escapeHtml(res.process) + "</td><td>" + res.size + "</td><td>" + res.block + "</td><td>" + res.status + "</td>";
      if (tbody) tbody.appendChild(tr);
    });
  }
  setStatus("memoryStatus", "Memory allocation executed (" + mode + ").", "success");
}

function resetMemory() {
  memoryBlocks = [100, 500, 200, 300, 600];
  memoryRequests = [];
  document.getElementById("memoryBlocks").value = memoryBlocks.join(", ");
  renderMemoryRequests();
  const ff = document.getElementById("firstFitVis"); if (ff) ff.innerHTML = "";
  const bf = document.getElementById("bestFitVis"); if (bf) bf.innerHTML = "";
  const fs = document.getElementById("firstFitStats"); if (fs) fs.innerHTML = "";
  const bs = document.getElementById("bestFitStats"); if (bs) bs.innerHTML = "";
  const tb = document.querySelector("#memResultTable tbody"); if (tb) tb.innerHTML = "";
  setStatus("memoryStatus", "Memory reset.", "info");
}

// ---------- AUTOMATED TESTS ----------
function runAutomatedTests() {
  const tbody = document.querySelector("#testTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const rows = [];
  function record(id, desc, input, expected, actual, pass) {
    rows.push({ id: id, desc: desc, input: input, expected: expected, actual: actual, pass: pass });
  }
  // T1: FCFS single process
  (function () {
    const res = runFCFS([{ id: "P1", arrival: 0, burst: 5 }]);
    const r = res.results[0];
    record("T1", "FCFS single process", "P1 AT=0 BT=5", "WT=0, TAT=5", "WT=" + r.wt + ", TAT=" + r.tat, r.wt === 0 && r.tat === 5);
  })();
  // T2: FCFS average waiting time
  (function () {
    const res = runFCFS([{ id: "P1", arrival: 0, burst: 5 }, { id: "P2", arrival: 1, burst: 3 }]);
    record("T2", "FCFS average waiting time", "P1(0,5),P2(1,3)", "avgWT=2.00", "avgWT=" + res.avgWt.toFixed(2), Math.abs(res.avgWt - 2) < 0.001);
  })();
  // T3: SJF average waiting time
  (function () {
    const res = runSJF([{ id: "P1", arrival: 0, burst: 5 }, { id: "P2", arrival: 0, burst: 3 }]);
    record("T3", "SJF (non-preemptive) avg WT", "P1(0,5),P2(0,3)", "avgWT=1.50", "avgWT=" + res.avgWt.toFixed(2), Math.abs(res.avgWt - 1.5) < 0.001);
  })();
  // T4: Round Robin average waiting time
  (function () {
    const res = runRR([{ id: "P1", arrival: 0, burst: 5 }, { id: "P2", arrival: 0, burst: 3 }], 2);
    record("T4", "Round Robin (q=2) avg WT", "P1(0,5),P2(0,3)", "avgWT=3.50", "avgWT=" + res.avgWt.toFixed(2), Math.abs(res.avgWt - 3.5) < 0.001);
  })();
  // T5: Producer capacity enforcement
  (function () {
    const saved = JSON.parse(JSON.stringify(storage));
    storage = { capacity: 3, items: [], produced: 0, consumed: 0 };
    produceItem(); produceItem(); produceItem();
    const before = storage.items.length;
    produceItem();
    const after = storage.items.length;
    const pass = before === 3 && after === 3;
    record("T5", "Producer blocks when full", "capacity=3, produce 4", "stored stays 3", "stored=" + after, pass);
    storage = saved;
    renderStorage();
  })();
  // T6: Consumer blocks when empty
  (function () {
    const saved = JSON.parse(JSON.stringify(storage));
    storage = { capacity: 3, items: [], produced: 0, consumed: 0 };
    consumeItem();
    const pass = storage.items.length === 0;
    record("T6", "Consumer blocks when empty", "empty storage", "no item consumed", "stored=" + storage.items.length, pass);
    storage = saved;
    renderStorage();
  })();
  // T7: Banker default safe sequence
  (function () {
    loadBankerDefault();
    calculateNeed();
    checkSafety();
    const seqText = (document.getElementById("bankerSequence").textContent || "").replace(/\s+/g, " ").trim();
    const expected = "Safe sequence: P1 -> P3 -> P4 -> P0 -> P2";
    record("T7", "Banker default safe sequence", "default example", expected, seqText, seqText.indexOf("P1 -> P3 -> P4 -> P0 -> P2") !== -1);
  })();
  // T8: Banker unsafe example
  (function () {
    loadBankerUnsafe();
    calculateNeed();
    checkSafety();
    const seqText = (document.getElementById("bankerSequence").textContent || "").replace(/\s+/g, " ").trim();
    record("T8", "Banker unsafe example", "available=0", "Unsafe state", seqText, seqText.toLowerCase().indexOf("unsafe") !== -1);
    loadBankerDefault();
  })();
  // T9: Memory first fit allocation count
  (function () {
    const blocks = [100, 500, 200, 300, 600];
    const reqs = [{ name: "P1", size: 120 }, { name: "P2", size: 350 }, { name: "P3", size: 80 }, { name: "P4", size: 200 }, { name: "P5", size: 250 }];
    const r = runMemoryAllocation("first", blocks, reqs);
    const allocCount = r.results.filter(function (x) { return x.status === "Allocated"; }).length;
    record("T9", "First Fit allocation", "5 requests", "allocated=5", "allocated=" + allocCount, allocCount === 5);
  })();
  // T10: Race demo counts
  (function () {
    runRaceDemo("unsync");
    const u = raceUnsyncCount;
    runRaceDemo("sync");
    const s = raceSyncCount;
    record("T10", "Race demo counts", "unsync/sync", "unsync=1, sync=2", "unsync=" + u + ", sync=" + s, u === 1 && s === 2);
    resetRaceDemo();
  })();

  rows.forEach(function (r) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + r.id + "</td><td>" + escapeHtml(r.desc) + "</td><td>" + escapeHtml(r.input) + "</td><td>" + escapeHtml(r.expected) + "</td><td>" + escapeHtml(r.actual) + "</td><td class='" + (r.pass ? "pass" : "fail") + "'>" + (r.pass ? "PASS" : "FAIL") + "</td>";
    tbody.appendChild(tr);
  });
  const passed = rows.filter(function (r) { return r.pass; }).length;
  setStatus("testStatus", "Tests completed: " + passed + "/" + rows.length + " passed.", passed === rows.length ? "success" : "warn");
  logEvent("Automated tests run: " + passed + "/" + rows.length + " passed.");
}

function clearTestResults() {
  const tbody = document.querySelector("#testTable tbody");
  if (tbody) tbody.innerHTML = "";
  setStatus("testStatus", "Test results cleared.", "info");
}

// ---------- INITIALIZATION ----------
document.addEventListener("DOMContentLoaded", function () {
  loadBankerDefault();
  renderStorage();
  renderMemoryRequests();
  renderMemoryBlocksInput();
  renderEventLog();
  // default module is dashboard (already visible); ensure hidden others
  document.querySelectorAll(".module").forEach(function (m) { if (m.id !== "dashboard") m.classList.add("hidden"); });
});

