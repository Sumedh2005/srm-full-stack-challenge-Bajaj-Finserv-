const API_BASE = "";

const examples = {
  simple: "A->B\nA->C\nB->D\nC->E",
  cycle: "X->Y\nY->Z\nZ->X",
  multi: "A->B\nB->C\nP->Q\nQ->R",
  full: `A->B\nA->C\nB->D\nC->E\nE->F\nX->Y\nY->Z\nZ->X\nP->Q\nQ->R\nG->H\nG->H\nG->I\nhello\n1->2\nA->`
};

let currentResponse = null;

function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function loadExample(key) {
  const input = document.getElementById('input');
  if (input) {
    input.value = examples[key];
    input.focus();
  }
  showToast(`📋 Loaded: ${key} example`);
  const errorDiv = document.getElementById('error');
  if (errorDiv) errorDiv.style.display = 'none';
}

function clearInput() {
  const input = document.getElementById('input');
  if (input) input.value = '';
  
  const output = document.getElementById('output');
  if (output) {
    output.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⌨️</div>
        <p>Enter edges and click Run</p>
        <small>Try: A→B, A→C, B→D</small>
      </div>
    `;
  }
  updateStatus(null);
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) copyBtn.style.display = 'none';
  currentResponse = null;
  showToast('🗑️ Cleared');
}

function updateStatus(state) {
  const dot = document.getElementById('status');
  if (!dot) return;
  dot.className = 'status';
  if (state === 'loading') dot.classList.add('loading');
  else if (state === 'success') dot.classList.add('success');
  else if (state === 'error') dot.classList.add('error');
}

function parseInput(raw) {
  return raw.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);
}

function renderTree(node, children, prefix = '', isLast = true) {
  const connector = isLast ? '└─ ' : '├─ ';
  const childPrefix = isLast ? '   ' : '│  ';
  let result = prefix + connector + node + '\n';
  
  const keys = Object.keys(children || {});
  keys.forEach((child, idx) => {
    const last = idx === keys.length - 1;
    result += renderTree(child, children[child], prefix + childPrefix, last);
  });
  return result;
}

function copyResponse() {
  if (!currentResponse) return;
  const jsonStr = JSON.stringify(currentResponse, null, 2);
  navigator.clipboard.writeText(jsonStr).then(() => {
    showToast('📋 Response copied to clipboard');
  }).catch(() => {
    showToast('❌ Failed to copy');
  });
}

async function submit() {
  const input = document.getElementById('input');
  if (!input) return;
  
  const raw = input.value.trim();
  if (!raw) {
    showToast('⚠️ Please enter some edges');
    return;
  }

  const data = parseInput(raw);
  updateStatus('loading');
  
  const outputDiv = document.getElementById('output');
  if (outputDiv) {
    outputDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⏳</div>
        <p>Processing...</p>
        <small>Parsing ${data.length} entries</small>
      </div>
    `;
  }
  
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) copyBtn.style.display = 'none';

  try {
    const url = `/bfhl`;
    console.log('Calling API:', url);
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const json = await res.json();
    currentResponse = json;
    updateStatus('success');
    renderOutput(json);
    if (copyBtn) copyBtn.style.display = 'inline-flex';
    showToast('✅ Response received');
  } catch (err) {
    console.error('Error details:', err);
    updateStatus('error');
    if (outputDiv) {
      outputDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <p>Request failed</p>
          <small style="color: var(--error);">${err.message}</small>
          <br>
          <small style="color: var(--error); font-size: 0.7rem;">Make sure backend is running at /bfhl</small>
        </div>
      `;
    }
    showToast(`Error: ${err.message}`);
  }
}

function renderOutput(data) {
  let html = `
    <div class="identity-strip">
      <div><strong>User:</strong> ${escapeHtml(data.user_id)}</div>
      <div><strong>Email:</strong> ${escapeHtml(data.email_id)}</div>
      <div><strong>Roll:</strong> ${escapeHtml(data.college_roll_number)}</div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-number">${data.summary.total_trees}</div>
        <div class="summary-label">Trees</div>
      </div>
      <div class="summary-card">
        <div class="summary-number">${data.summary.total_cycles}</div>
        <div class="summary-label">Cycles</div>
      </div>
      <div class="summary-card">
        <div class="summary-number">${escapeHtml(data.summary.largest_tree_root || '—')}</div>
        <div class="summary-label">Deepest Root</div>
      </div>
    </div>
  `;

  if (data.invalid_entries && data.invalid_entries.length > 0) {
    html += `<div class="lists"><div class="list-label">⚠️ Invalid (${data.invalid_entries.length})</div>`;
    data.invalid_entries.forEach(e => {
      html += `<div class="list-item">${escapeHtml(e || '(empty)')}</div>`;
    });
    html += `</div>`;
  }

  if (data.duplicate_edges && data.duplicate_edges.length > 0) {
    html += `<div class="lists"><div class="list-label">🔄 Duplicates (${data.duplicate_edges.length})</div>`;
    data.duplicate_edges.forEach(e => {
      html += `<div class="list-item">${escapeHtml(e)}</div>`;
    });
    html += `</div>`;
  }

  html += `<div><div class="list-label">📁 Hierarchies (${data.hierarchies.length})</div>`;
  data.hierarchies.forEach((h, idx) => {
    const isCycle = h.has_cycle === true;
    html += `
      <div class="hierarchy-item">
        <div class="hierarchy-header" onclick="toggleHierarchy(${idx})">
          <span class="hierarchy-root">Root: ${escapeHtml(h.root)}</span>
          <span class="hierarchy-badge ${isCycle ? 'cycle' : 'tree'}">
            ${isCycle ? '⚠️ CYCLE' : `depth ${h.depth}`}
          </span>
        </div>
        <div class="hierarchy-content" id="hier-${idx}">
    `;
    
    if (isCycle) {
      html += `<p style="color: var(--error); font-size: 0.8125rem;">Cycle detected — no tree structure available</p>`;
    } else {
      const treeHtml = renderTree(h.root, h.tree[h.root]).trim();
      html += `<pre>${escapeHtml(treeHtml)}</pre>`;
    }
    
    html += `
        </div>
      </div>
    `;
  });
  html += `</div>`;

  const output = document.getElementById('output');
  if (output) output.innerHTML = html;
}

function toggleHierarchy(idx) {
  const el = document.getElementById(`hier-${idx}`);
  if (el) el.classList.toggle('open');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    submit();
  }
});

window.addEventListener('load', () => {
  console.log('BFHL Frontend ready ✅');
  console.log('API_BASE:', API_BASE);
});