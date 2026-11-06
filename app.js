/**
 * FitTrack — vanilla JavaScript fitness tracker
 * Features: calorie/macro calculator, workout log with PRs,
 * body-weight progress chart (Canvas API), localStorage persistence,
 * JSON export/import.
 */

'use strict';

// ---------- State & storage ----------
const STORAGE_KEY = 'fittrack:v1';
const emptyState = () => ({ profile: null, workouts: [], weights: [] });

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState();
  } catch {
    return emptyState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    toast('Could not save data in this browser');
  }
}

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const today = () => new Date().toISOString().slice(0, 10);
const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const formatDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === btn.dataset.tab));
    if (btn.dataset.tab === 'progress') drawChart();
  });
});

// ---------- Calculator ----------
const GOAL_ADJUST = { cut: -500, maintain: 0, bulk: 300 };
const PROTEIN_PER_KG = { cut: 2.2, maintain: 1.8, bulk: 2.0 };

/** Pure function — easy to unit test */
function calculate({ sex, age, weight, height, activity, goal }) {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
  const tdee = bmr * activity;
  const target = Math.max(1200, tdee + GOAL_ADJUST[goal]);

  const protein = weight * PROTEIN_PER_KG[goal];
  const fat = (target * 0.25) / 9;
  const carbs = Math.max(0, (target - protein * 4 - fat * 9) / 4);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target: Math.round(target),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs),
  };
}

function renderResults() {
  if (!state.profile) return;
  const r = calculate(state.profile);
  $('#results').classList.remove('hidden');
  $('#bmr').textContent = `${r.bmr} kcal`;
  $('#tdee').textContent = `${r.tdee} kcal`;
  $('#target').textContent = `${r.target} kcal`;
  $('#protein').textContent = `${r.protein} g`;
  $('#fat').textContent = `${r.fat} g`;
  $('#carbs').textContent = `${r.carbs} g`;

  const kcal = { p: r.protein * 4, f: r.fat * 9, c: r.carbs * 4 };
  const total = kcal.p + kcal.f + kcal.c || 1;
  requestAnimationFrame(() => {
    $('#proteinBar').style.width = `${(kcal.p / total) * 100}%`;
    $('#fatBar').style.width = `${(kcal.f / total) * 100}%`;
    $('#carbsBar').style.width = `${(kcal.c / total) * 100}%`;
  });
}

function fillProfileForm() {
  if (!state.profile) return;
  const form = $('#profileForm');
  Object.entries(state.profile).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
}

$('#profileForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  state.profile = {
    sex: f.get('sex'),
    age: Number(f.get('age')),
    weight: Number(f.get('weight')),
    height: Number(f.get('height')),
    activity: Number(f.get('activity')),
    goal: f.get('goal'),
  };
  saveState();
  renderResults();
  toast('Profile saved');
});

// ---------- Workouts ----------
$('#workoutForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const exercise = f.get('exercise').trim();
  if (!exercise) return;

  const entry = {
    id: uid(),
    date: f.get('date'),
    exercise,
    sets: Number(f.get('sets')),
    reps: Number(f.get('reps')),
    weight: Number(f.get('weight')),
  };

  const prevBest = bestWeight(exercise);
  state.workouts.push(entry);
  saveState();
  renderWorkouts();

  if (entry.weight > 0 && entry.weight > prevBest && prevBest > 0) toast(`🏆 New PR: ${exercise} ${entry.weight} kg`);
  else toast('Set added');

  e.target.elements.exercise.value = '';
  e.target.elements.exercise.focus();
});

function bestWeight(exercise) {
  const name = exercise.toLowerCase();
  return state.workouts
    .filter((w) => w.exercise.toLowerCase() === name)
    .reduce((max, w) => Math.max(max, w.weight), 0);
}

function renderWorkouts() {
  // Datalist autocomplete with previously used exercises
  const names = [...new Set(state.workouts.map((w) => w.exercise))];
  $('#exerciseList').innerHTML = names.map((n) => `<option value="${escapeHtml(n)}">`).join('');

  // Personal records
  const records = {};
  state.workouts.forEach((w) => {
    const key = w.exercise.toLowerCase();
    if (!records[key] || w.weight > records[key].weight) records[key] = w;
  });
  const recordList = Object.values(records).filter((r) => r.weight > 0).sort((a, b) => b.weight - a.weight);
  $('#records').innerHTML = recordList.length
    ? recordList.map((r) => `<li>${escapeHtml(r.exercise)}<b>${r.weight} kg</b></li>`).join('')
    : '<li class="empty">No records yet</li>';

  // History grouped by date
  const byDate = state.workouts.reduce((acc, w) => {
    (acc[w.date] ||= []).push(w);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort().reverse();

  $('#history').innerHTML = dates.length
    ? dates
        .map((date) => {
          const entries = byDate[date];
          const volume = entries.reduce((sum, w) => sum + w.sets * w.reps * w.weight, 0);
          return `
          <div class="day">
            <div class="day-head"><span>${formatDate(date)}</span><span>Volume: ${volume.toLocaleString('en')} kg</span></div>
            ${entries
              .map(
                (w) => `
              <div class="entry">
                <div>
                  <div class="entry-name">${escapeHtml(w.exercise)}</div>
                  <div class="entry-detail">${w.sets} × ${w.reps} · ${w.weight} kg</div>
                </div>
                <button class="icon-btn" data-delete-workout="${w.id}" aria-label="Delete">✕</button>
              </div>`
              )
              .join('')}
          </div>`;
        })
        .join('')
    : '<p class="empty">No workouts yet — log your first set above 💪</p>';
}

// Event delegation for delete buttons
$('#history').addEventListener('click', (e) => {
  const id = e.target.dataset.deleteWorkout;
  if (!id) return;
  state.workouts = state.workouts.filter((w) => w.id !== id);
  saveState();
  renderWorkouts();
});

// ---------- Body weight ----------
$('#weightForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const date = f.get('date');
  const kg = Number(f.get('kg'));

  // One entry per day — overwrite if the date already exists
  const existing = state.weights.find((w) => w.date === date);
  if (existing) existing.kg = kg;
  else state.weights.push({ id: uid(), date, kg });

  saveState();
  renderWeights();
  toast('Weight saved');
  e.target.elements.kg.value = '';
});

$('#weightList').addEventListener('click', (e) => {
  const id = e.target.dataset.deleteWeight;
  if (!id) return;
  state.weights = state.weights.filter((w) => w.id !== id);
  saveState();
  renderWeights();
});

const sortedWeights = () => [...state.weights].sort((a, b) => a.date.localeCompare(b.date));

function renderWeights() {
  const data = sortedWeights();

  if (data.length >= 2) {
    const diff = data[data.length - 1].kg - data[0].kg;
    const sign = diff > 0 ? '+' : '';
    $('#weightSummary').textContent = `Change since ${formatDate(data[0].date)}: ${sign}${diff.toFixed(1)} kg`;
  } else {
    $('#weightSummary').textContent = '';
  }

  $('#weightList').innerHTML = data
    .slice()
    .reverse()
    .map(
      (w) => `<li><span>${formatDate(w.date)}</span><span><b>${w.kg} kg</b>
        <button class="icon-btn" data-delete-weight="${w.id}" aria-label="Delete">✕</button></span></li>`
    )
    .join('');

  drawChart();
}

function drawChart() {
  const canvas = $('#weightChart');
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return; // tab is hidden

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const css = getComputedStyle(document.documentElement);
  const color = {
    accent: css.getPropertyValue('--accent').trim(),
    muted: css.getPropertyValue('--muted').trim(),
    grid: css.getPropertyValue('--border').trim(),
    card: css.getPropertyValue('--card').trim(),
  };
  ctx.font = '12px system-ui, sans-serif';

  const data = sortedWeights();
  if (data.length < 2) {
    ctx.fillStyle = color.muted;
    ctx.textAlign = 'center';
    ctx.fillText('Add at least 2 entries to see your chart', w / 2, h / 2);
    return;
  }

  const pad = { t: 16, r: 16, b: 28, l: 44 };
  const values = data.map((d) => d.kg);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 2) { min -= 1; max += 1; }

  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / (data.length - 1);
  const y = (v) => pad.t + ((max - v) * (h - pad.t - pad.b)) / (max - min);

  // Grid + Y labels
  ctx.strokeStyle = color.grid;
  ctx.fillStyle = color.muted;
  ctx.textAlign = 'right';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4;
    const yy = y(v);
    ctx.beginPath();
    ctx.moveTo(pad.l, yy);
    ctx.lineTo(w - pad.r, yy);
    ctx.stroke();
    ctx.fillText(v.toFixed(1), pad.l - 8, yy + 4);
  }

  // X labels (first & last)
  ctx.textAlign = 'left';
  ctx.fillText(formatDate(data[0].date), pad.l, h - 8);
  ctx.textAlign = 'right';
  ctx.fillText(formatDate(data[data.length - 1].date), w - pad.r, h - 8);

  // Area fill
  const gradient = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
  gradient.addColorStop(0, 'rgba(245, 179, 1, 0.25)');
  gradient.addColorStop(1, 'rgba(245, 179, 1, 0)');
  ctx.beginPath();
  data.forEach((d, i) => (i ? ctx.lineTo(x(i), y(d.kg)) : ctx.moveTo(x(i), y(d.kg))));
  ctx.lineTo(x(data.length - 1), h - pad.b);
  ctx.lineTo(x(0), h - pad.b);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  data.forEach((d, i) => (i ? ctx.lineTo(x(i), y(d.kg)) : ctx.moveTo(x(i), y(d.kg))));
  ctx.strokeStyle = color.accent;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Points
  data.forEach((d, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(d.kg), 4, 0, Math.PI * 2);
    ctx.fillStyle = color.card;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color.accent;
    ctx.stroke();
  });
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawChart, 150);
});

// ---------- Export / Import / Reset ----------
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fittrack-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.workouts) || !Array.isArray(data.weights)) throw new Error('Invalid file');
    state = { ...emptyState(), ...data };
    saveState();
    renderAll();
    toast('Data imported');
  } catch {
    toast('Invalid file');
  }
  e.target.value = '';
});

$('#resetBtn').addEventListener('click', () => {
  if (!confirm('Delete all data? This cannot be undone.')) return;
  state = emptyState();
  saveState();
  $('#results').classList.add('hidden');
  $('#profileForm').reset();
  renderAll();
  toast('All data deleted');
});

// ---------- Init ----------
function renderAll() {
  fillProfileForm();
  renderResults();
  renderWorkouts();
  renderWeights();
}

$('#workoutForm').elements.date.value = today();
$('#weightForm').elements.date.value = today();
renderAll();
