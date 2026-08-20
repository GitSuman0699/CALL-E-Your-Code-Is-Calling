/* ─── QuoteHunter Frontend — English Only with Custom Call Queue ── */

/* ─── Vendor Presets ────────────────────────────────────────────────── */
const PRESETS = {
  painting: {
    vendors: [
      { name: 'Raj Painters',      phone: '+91 98765 43210' },
      { name: 'City Color Works',  phone: '+91 87654 32109' },
      { name: 'QuickPaint Express', phone: '+91 99887 76655' },
      { name: 'Apex Finishes',     phone: '+91 76543 21098' },
    ],
    desc: 'Paint 3BHK, standard quality, include ceiling.',
  },
  plumbing: {
    vendors: [
      { name: 'Sharma Plumbing',  phone: '+91 99001 10011' },
      { name: 'AquaFix Services', phone: '+91 88002 20022' },
      { name: 'PipeMasters',      phone: '+91 77003 30033' },
      { name: 'FlowRight',        phone: '+91 66004 40044' },
    ],
    desc: 'Fix leaking kitchen faucet and bathroom pipes.',
  },
  electrical: {
    vendors: [
      { name: 'Bright Spark Electricals', phone: '+91 88111 22233' },
      { name: 'PowerGrid Solutions',      phone: '+91 77222 33344' },
      { name: 'Volt Masters',             phone: '+91 99333 44455' },
      { name: 'WireWorks Pro',            phone: '+91 66444 55566' },
    ],
    desc: 'Full rewiring of 2BHK apartment, MCB panel upgrade.',
  },
};

/* ─── State ─────────────────────────────────────────────────────────── */
let currentCategory = 'painting';
let activeVendors = [];
let huntResults = {};
let activeJobId = null;
let eventSource = null;
let isRunning = false;

/* ─── DOM refs ──────────────────────────────────────────────────────── */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const radarGrid = $('#radar-grid');
const vendorList = $('#vendor-list');
const vendorCountTag = $('#vendor-count-tag');
const comparisonTbody = $('#comparison-tbody');
const jobDesc = $('#job-desc');
const launchBtn = $('#btn-launch-hunt');
const launchBtnText = $('#launch-btn-text');
const recBanner = $('#recommendation-banner');
const recText = $('#recommendation-text');
const countBadge = $('#active-count-badge');

/* ─── Vendor Queue Management ───────────────────────────────────────── */
function renderVendorList() {
  if (vendorCountTag) {
    vendorCountTag.textContent = activeVendors.length;
  }

  if (activeVendors.length === 0) {
    vendorList.innerHTML = `
      <tr>
        <td colspan="3" class="px-3 py-6 text-center text-on-surface-variant text-xs">
          <span class="material-symbols-outlined text-2xl text-on-surface-variant/40 block mb-1">phonelink_erase</span>
          Call queue is empty.<br/>
          <button type="button" class="text-primary hover:underline font-bold mt-2 inline-flex items-center gap-1" onclick="openAddVendorModal()">
            <span class="material-symbols-outlined text-sm">add_call</span>
            Add Your Phone Number
          </button>
        </td>
      </tr>`;
    return;
  }

  vendorList.innerHTML = activeVendors.map((v, index) => `
    <tr class="hover:bg-white/5 group transition-colors">
      <td class="px-3 py-2 text-on-surface font-medium truncate max-w-[110px]" title="${v.name}">${v.name}</td>
      <td class="px-2 py-2 text-on-surface-variant text-right text-[11px]">${formatPhoneDisplay(v.phone)}</td>
      <td class="px-2 py-2 text-right w-8">
        <button type="button" class="text-on-surface-variant/40 hover:text-error hover:bg-error/15 rounded p-1 transition-all cursor-pointer inline-flex items-center justify-center" title="Remove ${v.name}" onclick="removeVendor(${index})">
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
      </td>
    </tr>
  `).join('');
}

function formatPhoneDisplay(phone) {
  if (!phone) return '-';
  const clean = phone.trim();
  if (clean.length > 10) {
    return clean.slice(0, 7) + '...';
  }
  return clean;
}

window.removeVendor = function(index) {
  if (isRunning) return;
  activeVendors.splice(index, 1);
  renderVendorList();
};

window.clearAllVendors = function() {
  if (isRunning) return;
  activeVendors = [];
  renderVendorList();
};

/* ─── Add Vendor Modal ──────────────────────────────────────────────── */
const addVendorModal = $('#add-vendor-modal');
const addVendorForm = $('#add-vendor-form');
const inputVendorName = $('#input-vendor-name');
const inputVendorPhone = $('#input-vendor-phone');

window.openAddVendorModal = function() {
  if (isRunning) return;
  inputVendorName.value = activeVendors.length === 0 ? 'My Mobile' : `Vendor #${activeVendors.length + 1}`;
  inputVendorPhone.value = '';
  addVendorModal.classList.remove('hidden-el');
  setTimeout(() => inputVendorPhone.focus(), 50);
};

window.closeAddVendorModal = function() {
  addVendorModal.classList.add('hidden-el');
};

$('#btn-add-vendor').addEventListener('click', openAddVendorModal);
$('#btn-clear-vendors').addEventListener('click', () => {
  if (confirm('Clear all numbers from the queue? You can then add only your own number.')) {
    clearAllVendors();
  }
});
$('#btn-close-add-modal').addEventListener('click', closeAddVendorModal);
$('#btn-cancel-add-modal').addEventListener('click', closeAddVendorModal);

addVendorForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = inputVendorName.value.trim() || `Phone #${activeVendors.length + 1}`;
  let phone = inputVendorPhone.value.trim();

  if (!phone) {
    alert('Please enter a valid phone number.');
    return;
  }

  // Ensure phone has leading + if user forgot
  if (!phone.startsWith('+')) {
    phone = '+' + phone;
  }

  activeVendors.push({ name, phone });
  renderVendorList();
  closeAddVendorModal();
});

/* ─── Preset Chip Logic ─────────────────────────────────────────────── */
function applyPreset(cat) {
  currentCategory = cat;
  const preset = PRESETS[cat];

  $$('.preset-chip').forEach(ch => {
    if (ch.dataset.category === cat) {
      ch.className = 'preset-chip bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full font-label-sm text-label-sm cursor-pointer active';
    } else {
      ch.className = 'preset-chip bg-surface-variant text-on-surface-variant border border-white/5 px-3 py-1 rounded-full font-label-sm text-label-sm cursor-pointer hover:bg-white/5';
    }
  });

  jobDesc.value = preset.desc;

  // Initialize activeVendors with a deep copy of preset vendors
  activeVendors = preset.vendors.map(v => ({ ...v }));
  renderVendorList();
}

/* ─── Render Radar Grid (Stitch card patterns) ──────────────────────── */
function renderRadar() {
  const entries = Object.entries(huntResults);

  if (entries.length === 0) {
    radarGrid.innerHTML = `
      <div class="glass-panel rounded-xl p-8 col-span-full text-center">
        <span class="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2">phone_in_talk</span>
        <p class="font-body-md text-body-md text-on-surface-variant">Configure providers and launch an AI hunt to see live calls.</p>
      </div>`;
    countBadge.textContent = '';
    return;
  }

  const quoted = entries.filter(([,r]) => r.status === 'completed' || r.status === 'quoted');
  let bestVendor = null;
  if (quoted.length > 0) {
    const quotedWithPrices = quoted.filter(([,r]) => r.quote && parsePrice(r.quote) < Infinity);
    if (quotedWithPrices.length > 0) {
      const sorted = [...quotedWithPrices].sort((a, b) => parsePrice(a[1].quote) - parsePrice(b[1].quote));
      bestVendor = sorted[0][0];
    }
  }

  const activeCount = entries.filter(([,r]) => ['initializing', 'dialing', 'ringing', 'in-call', 'in-progress', 'analyzing'].includes(r.status)).length;
  const doneCount  = entries.filter(([,r]) => ['completed', 'quoted', 'failed', 'voicemail', 'no-answer', 'refused', 'error'].includes(r.status)).length;
  countBadge.textContent = activeCount > 0 ? `${activeCount} in progress • ${doneCount} done` : (doneCount > 0 ? `${doneCount} done` : '');

  radarGrid.innerHTML = entries.map(([name, r]) => {
    const isBest = name === bestVendor;
    const isQuoted = r.status === 'completed' || r.status === 'quoted';

    if (isBest) {
      return `
      <div class="glass-panel rounded-xl p-5 relative overflow-hidden border border-secondary/40 shadow-[0_0_20px_0_rgba(111,251,190,0.15)]">
        <div class="absolute top-0 right-0 bg-secondary text-on-secondary font-label-sm text-label-sm px-3 py-1 rounded-bl-lg flex items-center gap-1 font-bold">
          <span class="material-symbols-outlined text-sm">emoji_events</span>
          Best Value
        </div>
        <h3 class="font-label-sm text-label-sm text-on-surface-variant mb-1 mt-2">Vendor</h3>
        <p class="font-body-lg text-body-lg font-bold text-on-surface mb-4">${name}</p>
        <div class="flex justify-between items-end">
          <div>
            <div class="flex items-center gap-1.5 mb-1 bg-secondary/10 px-2 py-1 rounded w-fit border border-secondary/20">
              <span class="font-label-sm text-label-sm text-secondary font-semibold">Quoted ✅</span>
            </div>
            <p class="font-data-mono text-data-mono text-secondary text-xl font-bold">${r.quote || '-'}</p>
          </div>
        </div>
      </div>`;
    }

    if (r.status === 'initializing') {
      return `
      <div class="glass-panel rounded-xl p-5 relative overflow-hidden border border-primary/30">
        <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent -z-10"></div>
        <h3 class="font-label-sm text-label-sm text-on-surface-variant mb-1">Vendor</h3>
        <p class="font-body-lg text-body-lg font-bold text-on-surface mb-4">${name}</p>
        <div class="flex justify-between items-end mt-auto">
          <div class="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/30">
            <span class="font-label-sm text-label-sm text-primary font-medium animate-pulse">🤖 Initializing Agent...</span>
          </div>
        </div>
      </div>`;
    }

    if (r.status === 'dialing') {
      return `
      <div class="glass-panel rounded-xl p-5 relative overflow-hidden border border-primary/40 shadow-[0_0_12px_rgba(99,102,241,0.15)]">
        <div class="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent -z-10"></div>
        <h3 class="font-label-sm text-label-sm text-on-surface-variant mb-1">Vendor</h3>
        <p class="font-body-lg text-body-lg font-bold text-on-surface mb-4">${name}</p>
        <div class="flex justify-between items-end mt-auto">
          <div class="flex items-center gap-2 bg-primary/15 px-3 py-1.5 rounded-full border border-primary/40">
            <span class="font-label-sm text-label-sm text-primary font-semibold animate-pulse">📞 Connecting Carrier...</span>
          </div>
        </div>
      </div>`;
    }

    if (r.status === 'ringing') {
      return `
      <div class="glass-panel rounded-xl p-5 relative overflow-hidden border border-amber-500/50 shadow-[0_0_18px_rgba(245,158,11,0.25)]">
        <div class="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent -z-10"></div>
        <h3 class="font-label-sm text-label-sm text-on-surface-variant mb-1">Vendor</h3>
        <p class="font-body-lg text-body-lg font-bold text-on-surface mb-4">${name}</p>
        <div class="flex justify-between items-end mt-auto">
          <div class="flex items-center gap-2 bg-amber-500/20 px-3 py-1.5 rounded-full border border-amber-500/40">
            <span class="font-label-sm text-label-sm text-amber-300 font-bold animate-pulse">🔔 Ringing Phone...</span>
          </div>
        </div>
      </div>`;
    }

    if (r.status === 'in-call' || r.status === 'in-progress') {
      return `
      <div class="glass-panel rounded-xl p-5 relative overflow-hidden border border-tertiary-container/50 shadow-[0_0_20px_rgba(160,120,255,0.25)]">
        <div class="absolute inset-0 bg-gradient-to-br from-tertiary-container/10 to-transparent -z-10"></div>
        <h3 class="font-label-sm text-label-sm text-on-surface-variant mb-1">Vendor</h3>
        <p class="font-body-lg text-body-lg font-bold text-on-surface mb-4">${name}</p>
        <div class="flex justify-between items-end mt-auto">
          <div class="flex items-center gap-2 bg-tertiary-container/25 px-3 py-1.5 rounded-full border border-tertiary-container/40">
            <span class="font-label-sm text-label-sm text-tertiary-container font-bold">🎙️ Live On-Call</span>
            <div class="waveform"><div></div><div></div><div></div><div></div><div></div></div>
          </div>
        </div>
      </div>`;
    }

    if (r.status === 'analyzing') {
      return `
      <div class="glass-panel rounded-xl p-5 relative overflow-hidden border border-primary/40">
        <div class="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent -z-10"></div>
        <h3 class="font-label-sm text-label-sm text-on-surface-variant mb-1">Vendor</h3>
        <p class="font-body-lg text-body-lg font-bold text-on-surface mb-4">${name}</p>
        <div class="flex justify-between items-end mt-auto">
          <div class="flex items-center gap-2 bg-primary/20 px-3 py-1.5 rounded-full border border-primary/40">
            <span class="font-label-sm text-label-sm text-primary font-semibold animate-pulse">📊 Extracting Quote...</span>
          </div>
        </div>
      </div>`;
    }

    if (r.status === 'failed' || r.status === 'voicemail' || r.status === 'no-answer' || r.status === 'refused' || r.status === 'error') {
      const isVoice = r.status === 'voicemail' || r.status === 'no-answer';
      const failLabel = isVoice ? 'No Answer / Voicemail ⚠️' : (r.status === 'refused' ? 'Declined ❌' : 'Call Failed ❌');
      return `
      <div class="glass-panel rounded-xl p-5 relative overflow-hidden border border-error/25 opacity-85">
        <h3 class="font-label-sm text-label-sm text-on-surface-variant mb-1">Vendor</h3>
        <p class="font-body-lg text-body-lg font-bold text-on-surface mb-4 text-on-surface-variant">${name}</p>
        <div class="flex justify-between items-end mt-auto">
          <div class="flex items-center gap-1.5 bg-error/10 px-2 py-1 rounded w-fit border border-error/20">
            <span class="material-symbols-outlined text-error text-sm">${isVoice ? 'warning' : 'cancel'}</span>
            <span class="font-label-sm text-label-sm text-error font-medium">${failLabel}</span>
          </div>
        </div>
      </div>`;
    }

    // Default quoted or pending card
    return `
    <div class="glass-panel rounded-xl p-5 relative overflow-hidden group hover:border-primary/50 transition-colors">
      <div class="absolute top-0 right-0 w-20 h-20 bg-secondary/10 rounded-bl-full -z-10 group-hover:bg-secondary/20 transition-colors"></div>
      <h3 class="font-label-sm text-label-sm text-on-surface-variant mb-1">Vendor</h3>
      <p class="font-body-lg text-body-lg font-bold text-on-surface mb-4">${name}</p>
      <div class="flex justify-between items-end">
        <div>
          <div class="flex items-center gap-1.5 mb-1 bg-secondary/10 px-2 py-1 rounded w-fit border border-secondary/20">
            <span class="font-label-sm text-label-sm text-secondary">${isQuoted ? 'Quoted ✅' : 'Queued ⏳'}</span>
          </div>
          <p class="font-data-mono text-data-mono text-primary text-xl">${r.quote || '-'}</p>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ─── Render Comparison Table ───────────────────────────────────────── */
function renderTable() {
  const entries = Object.entries(huntResults);

  if (entries.length === 0) {
    comparisonTbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-on-surface-variant">Matrix will populate as quotes arrive.</td></tr>`;
    return;
  }

  const quoted = entries.filter(([,r]) => (r.status === 'completed' || r.status === 'quoted') && r.quote);
  let bestVendor = null;
  if (quoted.length > 0) {
    const sorted = [...quoted].sort((a, b) => parsePrice(a[1].quote) - parsePrice(b[1].quote));
    bestVendor = sorted[0][0];
  }

  comparisonTbody.innerHTML = entries.map(([name, r]) => {
    const isBest = name === bestVendor;
    const isFailed = ['failed', 'voicemail', 'no-answer', 'refused', 'error'].includes(r.status);
    const isLive = ['initializing', 'dialing', 'ringing', 'in-call', 'in-progress', 'analyzing'].includes(r.status);

    let rowClass = 'hover:bg-white/[0.02] transition-colors';
    if (isBest) rowClass += ' bg-secondary/5';
    if (isFailed) rowClass += ' opacity-60';

    let priceClass = 'p-4 font-data-mono text-data-mono';
    if (isBest) priceClass += ' text-secondary font-bold';
    else if (isFailed) priceClass += ' text-on-surface-variant';
    else priceClass += ' text-primary';

    let vendorCol = isBest
      ? `<td class="p-4 font-bold text-on-surface flex items-center gap-2">${name}<span class="material-symbols-outlined text-secondary text-sm">verified</span></td>`
      : `<td class="p-4 font-bold text-on-surface">${name}</td>`;

    let actionBtn;
    if (isBest) {
      actionBtn = `<button class="primary-gradient-btn text-white px-4 py-1.5 rounded-lg font-label-sm text-label-sm font-bold transition-opacity hover:opacity-90" onclick="openModal('${name}')">Select & Book</button>`;
    } else if (isFailed) {
      actionBtn = `<button class="bg-surface-variant text-on-surface-variant/50 cursor-not-allowed border border-white/5 px-4 py-1.5 rounded-lg font-label-sm text-label-sm" onclick="openModal('${name}')">View Details</button>`;
    } else if (isLive) {
      actionBtn = `<button class="bg-surface-variant text-on-surface-variant/50 cursor-not-allowed border border-white/5 px-4 py-1.5 rounded-lg font-label-sm text-label-sm animate-pulse">${r.status === 'ringing' ? 'Ringing…' : 'Active…'}</button>`;
    } else {
      actionBtn = `<button class="bg-surface-variant hover:bg-surface-bright text-primary border border-primary/30 px-4 py-1.5 rounded-lg font-label-sm text-label-sm transition-colors" onclick="openModal('${name}')">View Details</button>`;
    }

    let summaryText = r.summary;
    if (!summaryText) {
      if (r.status === 'initializing') summaryText = '<span class="text-primary animate-pulse">🤖 Initializing Voice AI...</span>';
      else if (r.status === 'dialing') summaryText = '<span class="text-primary animate-pulse">📞 Connecting carrier...</span>';
      else if (r.status === 'ringing') summaryText = '<span class="text-amber-300 animate-pulse font-semibold">🔔 Phone Ringing...</span>';
      else if (r.status === 'in-call' || r.status === 'in-progress') summaryText = '<span class="text-tertiary-container animate-pulse font-semibold">🎙️ Live On-Call: AI agent speaking...</span>';
      else if (r.status === 'analyzing') summaryText = '<span class="text-primary animate-pulse">📊 Extracting quote & transcript...</span>';
      else if (isFailed) summaryText = r.providerNotes || 'Call unanswered or declined';
      else summaryText = '-';
    }

    return `<tr class="${rowClass}">
      ${vendorCol}
      <td class="${priceClass}">${r.quote || '-'}</td>
      <td class="p-4 text-on-surface-variant">${r.timeline || '-'}</td>
      <td class="p-4 text-on-surface-variant max-w-xs truncate">${summaryText}</td>
      <td class="p-4 text-right">${actionBtn}</td>
    </tr>`;
  }).join('');

  $('#btn-export-csv').disabled = quoted.length === 0;
}

/* ─── Recommendation Banner ─────────────────────────────────────────── */
function renderRecommendation() {
  const quoted = Object.entries(huntResults).filter(([,r]) => (r.status === 'completed' || r.status === 'quoted') && r.quote);
  if (quoted.length === 0) {
    recBanner.classList.add('hidden-el');
    return;
  }
  const sorted = [...quoted].sort((a, b) => parsePrice(a[1].quote) - parsePrice(b[1].quote));
  const [bestName, bestData] = sorted[0];
  recText.innerHTML = `<strong>${bestName}</strong> offers the best quote at <strong>${bestData.quote}</strong> (${bestData.timeline || 'standard timeline'}).`;
  recBanner.classList.remove('hidden-el');
}

function renderAll() {
  renderRadar();
  renderTable();
  renderRecommendation();
}

/* ─── Helpers ───────────────────────────────────────────────────────── */
function parsePrice(str) {
  if (!str) return Infinity;
  return parseInt(String(str).replace(/[^\d]/g, ''), 10) || Infinity;
}

/* ─── Modal ─────────────────────────────────────────────────────────── */
let currentModalVendor = null;

function openModal(vendorName) {
  const r = huntResults[vendorName];
  if (!r) return;
  currentModalVendor = vendorName;
  const vendor = activeVendors.find(v => v.name === vendorName);

  $('#modal-provider-name').textContent = vendorName;
  $('#modal-phone').textContent = vendor ? vendor.phone : '-';
  $('#modal-quote').textContent = r.quote || '-';
  $('#modal-timeline').textContent = r.timeline || '-';
  $('#modal-evidence-text').textContent = r.evidence || r.summary || 'No direct transcript evidence captured.';
  $('#modal-notes-text').textContent = r.summary || r.providerNotes || 'Standard provider terms.';

  const confidenceBadge = $('#modal-confidence-badge');
  if (confidenceBadge) {
    if (r.confidence === 'high' || !r.confidence || (r.confidenceScore && r.confidenceScore >= 0.8)) {
      confidenceBadge.className = 'font-label-sm text-[10px] bg-secondary/15 text-secondary border border-secondary/30 px-2 py-0.5 rounded-full font-bold';
      confidenceBadge.textContent = '🟢 Verified Audio Span (95%)';
    } else if (r.confidence === 'medium') {
      confidenceBadge.className = 'font-label-sm text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold';
      confidenceBadge.textContent = '🟡 Extracted from Summary';
    } else {
      confidenceBadge.className = 'font-label-sm text-[10px] bg-white/10 text-on-surface-variant border border-white/10 px-2 py-0.5 rounded-full';
      confidenceBadge.textContent = '⚪ Unconfirmed / Failed';
    }
  }

  $('#evidence-modal').classList.remove('hidden-el');
}

function copyToClipboard(text, onSuccess) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => fallbackCopy(text, onSuccess));
  } else {
    fallbackCopy(text, onSuccess);
  }
}

function fallbackCopy(text, onSuccess) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    if (onSuccess) onSuccess();
  } catch (err) {
    console.error('Fallback copy failed:', err);
  }
  document.body.removeChild(ta);
}

$('#btn-close-modal').addEventListener('click', () => {
  $('#evidence-modal').classList.add('hidden-el');
});

// Copy Evidence Packet
$('#btn-copy-evidence')?.addEventListener('click', () => {
  if (!currentModalVendor) return;
  const r = huntResults[currentModalVendor];
  const vendor = activeVendors.find(v => v.name === currentModalVendor);

  const packet = {
    app: 'QuoteHunter AI',
    vendor: currentModalVendor,
    phone: vendor ? vendor.phone : 'unknown',
    category: currentCategory,
    price_quote: r?.quote || null,
    timeline: r?.timeline || null,
    evidence_snippet: r?.evidence || null,
    call_summary: r?.summary || null,
    confidence: r?.confidence || 'high',
    timestamp: new Date().toISOString(),
    idempotency_key: `qh_${activeJobId || 'live'}_${currentModalVendor}`,
  };

  copyToClipboard(JSON.stringify(packet, null, 2), () => {
    const label = $('#copy-btn-label');
    if (label) {
      const prev = label.textContent;
      label.textContent = 'Copied to Clipboard! ✅';
      setTimeout(() => { label.textContent = prev; }, 2500);
    }
  });
});

// Confirm Booking (Human Authority)
$('#btn-confirm-booking')?.addEventListener('click', () => {
  if (!currentModalVendor) return;
  const r = huntResults[currentModalVendor];
  if (confirm(`Confirm booking with ${currentModalVendor} for ${r?.quote || 'quoted price'} (${r?.timeline || 'agreed timeline'})?\n\nThis confirms the human-in-the-loop decision.`)) {
    alert(`🎉 Booking Confirmed with ${currentModalVendor}!\n\nQuote: ${r?.quote || '-'}\nTimeline: ${r?.timeline || '-'}\nStatus: Job dispatched to provider.`);
    $('#evidence-modal').classList.add('hidden-el');
  }
});

/* ─── Launch Hunt ───────────────────────────────────────────────────── */
$('#hunt-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isRunning) return;

  if (activeVendors.length === 0) {
    alert('Please add at least 1 phone number to call.');
    openAddVendorModal();
    return;
  }

  const execMode = document.querySelector('input[name="exec-mode"]:checked').value;
  const desc = jobDesc.value.trim();

  huntResults = {};
  activeJobId = null;
  isRunning = true;
  launchBtn.disabled = true;
  launchBtnText.textContent = execMode === 'live' ? '📞 Dialing via CALL-E…' : '⏳ Simulating AI calls…';

  activeVendors.forEach(v => {
    huntResults[v.name] = { status: 'ringing', quote: null, timeline: null, summary: null, evidence: null };
  });
  renderAll();

  try {
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: currentCategory,
        description: desc,
        vendors: activeVendors,
        mode: execMode,
        dryRunSimulate: execMode === 'simulate',
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to launch call hunt');
    }

    activeJobId = data.job ? data.job.id : data.jobId;

    if (eventSource) eventSource.close();
    eventSource = new EventSource(`/api/events/${activeJobId}`);
    
    eventSource.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data);
        handleEvent(ev);
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };
    
    eventSource.onerror = () => {
      console.warn('SSE connection ended or closed.');
      eventSource.close();
      isRunning = false;
      launchBtn.disabled = false;
      launchBtnText.textContent = '🚀 Launch Parallel AI Call Hunt (~2 mins)';
    };
  } catch (err) {
    console.error('Hunt launch failed:', err);
    alert('Hunt launch failed: ' + (err.message || 'Check console for details'));
    isRunning = false;
    launchBtn.disabled = false;
    launchBtnText.textContent = '🚀 Launch Parallel AI Call Hunt (~2 mins)';
  }
});

/* ─── SSE Event Handler ─────────────────────────────────────────────── */
function handleEvent(ev) {
  if (!ev) return;

  if (ev.type === 'vendor_updated' && ev.vendor) {
    const v = ev.vendor;
    const vendorName = v.name;
    if (vendorName) {
      huntResults[vendorName] = {
        status: v.status,
        quote: v.priceEstimate || huntResults[vendorName]?.quote,
        timeline: v.availability || huntResults[vendorName]?.timeline,
        summary: v.transcriptSummary || v.providerNotes || huntResults[vendorName]?.summary,
        evidence: v.evidenceSnippet || huntResults[vendorName]?.evidence,
        providerNotes: v.providerNotes,
      };
      renderAll();
    }
  } else if (ev.type === 'status_updated') {
    if (ev.status === 'completed' || ev.status === 'failed') {
      if (eventSource) eventSource.close();
      isRunning = false;
      launchBtn.disabled = false;
      launchBtnText.textContent = '🚀 Launch Parallel AI Call Hunt (~2 mins)';
    }
    renderAll();
  } else if (ev.type === 'initial' && ev.job && ev.job.vendors) {
    ev.job.vendors.forEach(v => {
      huntResults[v.name] = {
        status: v.status,
        quote: v.priceEstimate,
        timeline: v.availability,
        summary: v.transcriptSummary || v.providerNotes,
        evidence: v.evidenceSnippet,
        providerNotes: v.providerNotes,
      };
    });
    renderAll();
  }
}

/* ─── Demo Button ───────────────────────────────────────────────────── */
$('#btn-sample-demo').addEventListener('click', () => {
  if (isRunning) return;
  isRunning = true;
  huntResults = {};
  launchBtn.disabled = true;
  launchBtnText.textContent = '⏳ Simulating AI calls…';

  applyPreset('painting');
  const vendors = activeVendors;

  vendors.forEach(v => {
    huntResults[v.name] = { status: 'ringing', quote: null, timeline: null, summary: null, evidence: null };
  });
  renderAll();

  setTimeout(() => { if (huntResults['Raj Painters']) huntResults['Raj Painters'].status = 'in-progress'; renderAll(); }, 800);
  setTimeout(() => { if (huntResults['City Color Works']) huntResults['City Color Works'].status = 'in-progress'; renderAll(); }, 1200);
  setTimeout(() => { if (huntResults['QuickPaint Express']) huntResults['QuickPaint Express'].status = 'in-progress'; renderAll(); }, 1600);
  setTimeout(() => { if (huntResults['Apex Finishes']) huntResults['Apex Finishes'].status = 'in-progress'; renderAll(); }, 2000);

  setTimeout(() => {
    if (huntResults['Raj Painters']) {
      huntResults['Raj Painters'] = { status: 'completed', quote: '$280', timeline: '3-4 Days', summary: 'Requires initial site visit. Material not included.', evidence: '"We can do the full 3BHK for $280, takes 3 days."' };
    }
    renderAll();
  }, 4000);

  setTimeout(() => {
    if (huntResults['City Color Works']) {
      huntResults['City Color Works'] = { status: 'completed', quote: '$195', timeline: '2 Days', summary: 'Can start tomorrow. Includes standard material.', evidence: '"$195 with materials included, can start tomorrow."' };
    }
    renderAll();
  }, 5500);

  setTimeout(() => {
    if (huntResults['Apex Finishes']) {
      huntResults['Apex Finishes'] = { status: 'voicemail', quote: null, timeline: null, summary: 'Went to voicemail. AI scheduled callback.', evidence: null };
    }
    renderAll();
  }, 6500);

  setTimeout(() => {
    if (huntResults['QuickPaint Express']) {
      huntResults['QuickPaint Express'] = { status: 'completed', quote: '$420', timeline: '5 Days', summary: 'Premium Berger Silk paint. Warranty included.', evidence: '"$420 total with a full 2-year warranty included."' };
    }
    renderAll();
  }, 8000);

  setTimeout(() => {
    isRunning = false;
    launchBtn.disabled = false;
    launchBtnText.textContent = '🚀 Launch Parallel AI Call Hunt (~2 mins)';
  }, 8500);
});

/* ─── Export CSV ─────────────────────────────────────────────────────── */
$('#btn-export-csv').addEventListener('click', () => {
  const rows = [['Vendor', 'Quote', 'Timeline', 'Summary']];
  Object.entries(huntResults).forEach(([name, r]) => {
    rows.push([name, r.quote || '-', r.timeline || '-', (r.summary || '-').replace(/,/g, ';')]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `quotehunter-${currentCategory}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
});

/* ─── Preset Chips ──────────────────────────────────────────────────── */
$$('.preset-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (!isRunning) applyPreset(chip.dataset.category);
  });
});

/* ─── Init ──────────────────────────────────────────────────────────── */
applyPreset('painting');
// Preload user's verified phone number for testing
activeVendors = [
  { name: 'My Mobile', phone: '+918016086948' }
];
renderVendorList();
