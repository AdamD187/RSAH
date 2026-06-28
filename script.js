let state = {
  candidates: [],
  jobs: [],
  benchmark: null,
  currentJobId: null,
  filter: 'all',
  search: '',
  expandedIds: new Set()
};

const scoreLabel = { 3: 'Strong', 2: 'Adequate', 1: 'Weak', 0: 'Absent' };
const scoreClass = { 3: 's3', 2: 's2', 1: 's1', 0: 's0' };
const groupLabel  = { advance: ':large_green_circle: Advance', hold: ':large_yellow_circle: Hold', do_not_advance: ':red_circle: Do Not Advance' };
const groupClass  = { advance: 'advance', hold: 'hold', do_not_advance: 'reject' };

async function load() {
  const [candidates, jobs, benchmark] = await Promise.all([
    fetch('candidates.json').then(r => r.json()).catch(() => ({ meta: {}, candidates: [] })),
    fetch('jobs.json').then(r => r.json()).catch(() => ({ jobs: [] })),
    fetch('benchmark.json').then(r => r.json()).catch(() => null)
  ]);

  state.candidates = candidates.candidates || [];
  state.jobs       = jobs.jobs || [];
  state.benchmark  = benchmark;
  state.currentJobId = candidates.meta?.job_id || (state.jobs[0]?.id ?? null);

  renderJobSelector();
  renderBenchmark();
  render();
}

function renderJobSelector() {
  const sel = document.getElementById('job-select');
  sel.innerHTML = '';
  state.jobs.forEach(j => {
    const opt = document.createElement('option');
    opt.value = j.id;
    opt.textContent = j.title;
    if (j.id === state.currentJobId) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = e => {
    state.currentJobId = e.target.value;
    render();
  };
}

function renderBenchmark() {
  const panel = document.getElementById('benchmark-panel');
  const content = document.getElementById('benchmark-content');
  if (!state.benchmark?.benchmark) return;
  content.innerHTML = Object.entries(state.benchmark.benchmark).map(([key, val]) => `
    <div class="bench-item">
      <strong>${key.replace(/_/g, ' ')}</strong>
      <p>${val}</p>
    </div>`).join('');
}

function filtered() {
  let list = state.candidates;
  if (state.filter !== 'all') list = list.filter(c => c.group === state.filter);
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter(c => c.name.toLowerCase().includes(q));
  }
  return list;
}

function render() {
  const list = filtered();

  // Summary counts
  const all = state.candidates;
  document.getElementById('count-advance').textContent = all.filter(c => c.group === 'advance').length;
  document.getElementById('count-hold').textContent    = all.filter(c => c.group === 'hold').length;
  document.getElementById('count-reject').textContent  = all.filter(c => c.group === 'do_not_advance').length;
  document.getElementById('total-count').textContent   = all.length;

  // Last updated
  const meta = document.getElementById('last-updated');
  try {
    const d = new Date(state.candidates[0]?.last_updated || Date.now());[7:51 PM]meta.textContent = d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch(e) { meta.textContent = '—'; }

  // Candidate list
  const container = document.getElementById('candidate-list');
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">No candidates match your filter.</div>';
    return;
  }

  container.innerHTML = list.map((c, i) => `
    <div class="cand-card ${state.expandedIds.has(c.id) ? 'open' : ''}" data-id="${c.id}">
      <div class="cand-header" onclick="toggleCard('${c.id}')">
        <div class="cand-left">
          <div class="cand-rank">#${i+1}</div>
          <div>
            <div class="cand-name">${c.name}</div>
            <div class="cand-role">${c.applied_role}</div>
          </div>
        </div>
        <div class="cand-right">
          <span class="group-badge ${groupClass[c.group]}">${groupLabel[c.group]}</span>
          <span class="score-pill ${groupClass[c.group]}">${c.overall_score}%</span>
          <span class="chevron">▼</span>
        </div>
      </div>
      <div class="cand-body">
        ${renderCriterionTable(c.criterion_scores)}
        ${renderTagList('Strong Qualifications', c.strong_qualifications, 'strong')}
        ${renderTagList('Missing Requirements', c.missing_requirements, 'missing')}
        ${renderTagList('Potential Concerns', c.potential_concerns, 'concern')}
        ${renderTagList('⚑ Human Review Flags', c.human_review_flags, 'flag')}
      </div>
    </div>`).join('');
}

function renderCriterionTable(scores) {
  const critMap = {};
  state.jobs.find(j => j.id === state.currentJobId)?.evaluation_criteria.forEach(c => {
    critMap[c.id] = c;
  });

  const rows = scores.map(s => {
    const crit = critMap[s.criterion_id];
    return `<tr>
      <td>${crit?.name ?? s.criterion_id}</td>
      <td><span class="score-badge ${scoreClass[s.score]}">${s.score}/3 — ${s.label}</span></td>
      <td class="evidence">"${s.evidence}"</td>
    </tr>`;
  }).join('');

  return `<table class="criterion-table">
    <thead><tr><th>Criterion</th><th>Score</th><th>CV Evidence</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTagList(title, items, type) {
  if (!items?.length) return '';
  return `<div class="section-title">${title}</div>
    <ul class="tag-list">${items.map(t => <li class="tag ${type}">${t}</li>).join('')}</ul>`;
}

function toggleCard(id) {
  if (state.expandedIds.has(id)) state.expandedIds.delete(id);
  else state.expandedIds.add(id);
  document.querySelectorAll('.cand-card').forEach(el => {
    el.classList.toggle('open', state.expandedIds.has(el.dataset.id));
  });
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    state.expandedIds.clear();
    render();
  });
});

// Search
document.getElementById('search').addEventListener('input', e => {
  state.search = e.target.value;
  state.expandedIds.clear();
  render();
});

// Benchmark toggle
document.getElementById('benchmark-toggle').addEventListener('click', () => {
  const panel = document.getElementById('benchmark-panel');
  const btn   = document.getElementById('benchmark-toggle');
  panel.classList.toggle('hidden');
  btn.textContent = panel.classList.contains('hidden') ? ':clipboard: Show Benchmark' : ':closed_book: Hide Benchmark';
});

load();
