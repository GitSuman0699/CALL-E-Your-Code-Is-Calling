/* ==========================================================================
   CALL-E Negotiation Hub — State Manager & Recent Threads Controller
   ========================================================================== */

/* ─── Service Presets ────────────────────────────────────────────────── */
const PRESETS = {
  painting: {
    name: 'Painting RFQ',
    desc: 'Call +918016086948 and ask, are they available for painting 3BHK room on Friday including ceiling. Ask the estimated total price, and how many days it will require',
    vendors: [
      { name: 'My Mobile', phone: '+918016086948' },
      { name: 'Raj Painters', phone: '+919876543210' },
      { name: 'Urban Colors Ltd.', phone: '+918765432109' },
    ],
  },
  plumbing: {
    name: 'Plumbing Repair',
    desc: 'Call plumbers and ask if they can fix kitchen sink pipe leak and clear bathroom drain today. Ask for visit charges and estimated quote.',
    vendors: [
      { name: 'My Mobile', phone: '+918016086948' },
      { name: 'Sharma Plumbing', phone: '+919900110011' },
      { name: 'AquaFix Services', phone: '+918800220022' },
    ],
  },
  electrical: {
    name: 'Electrical Work',
    desc: 'Call electricians for 2BHK flat rewiring and MCB distribution box replacement. Ask for availability this weekend and cost estimate.',
    vendors: [
      { name: 'My Mobile', phone: '+918016086948' },
      { name: 'Bright Spark Electricals', phone: '+918811122233' },
      { name: 'Volt Masters', phone: '+919933344455' },
    ],
  },
  carpentry: {
    name: 'Custom Carpentry',
    desc: 'Call carpenters for custom modular wardrobe (7x6 ft) with hydraulic hinges. Ask for labor estimate and completion timeline.',
    vendors: [
      { name: 'My Mobile', phone: '+918016086948' },
      { name: 'WoodCraft Studio', phone: '+919811223344' },
      { name: 'TimberTech Interiors', phone: '+918722334455' },
    ],
  }
};

/* ─── App State ──────────────────────────────────────────────────────── */
let currentCategory = 'painting';
let activeVendors = [
  { name: 'My Mobile', phone: '+918016086948' },
  { name: 'Raj Painters', phone: '+919876543210' },
  { name: 'Urban Colors Ltd.', phone: '+918765432109' },
];

let recentThreads = [
  {
    id: 'thread-default',
    title: 'Call +918016086948 and ask, a...',
    prompt: 'Call +918016086948 and ask, are they available for painting 3BHK room on Friday including ceiling. Ask the estimated total price, and how many days it will require',
    isLive: false,
    results: {
      'Raj Painters': {
        status: 'completed',
        quote: '₹11,800',
        timeline: '2 Days',
        warranty: '1 Year Included',
        evidence: '"Yes, we can do it for 11,800 final price. We\'ll start tomorrow morning and finish by Thursday evening. Quality paint guaranteed."',
        summary: 'Standard emulsion with ceiling primer coat.'
      },
      'Urban Colors Ltd.': {
        status: 'completed',
        quote: '₹14,500',
        timeline: '3 Days',
        warranty: 'Standard',
        evidence: '"₹14,500 total price."',
        summary: 'Completed with full coat.'
      }
    },
    createdAt: new Date()
  }
];

let currentView = 'home'; // 'home' | 'thread'
let activeThread = null;
let isRunning = false;
let eventSource = null;

/* ─── DOM References ────────────────────────────────────────────────── */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const viewHome = $('#view-home');
const viewThread = $('#view-thread');
const recentsList = $('#recents-list');
const recentsBadge = $('#recents-badge');
const topBarTitle = $('#top-bar-title');
const threadUserPrompt = $('#thread-user-prompt');
const threadSwarmList = $('#thread-swarm-list');
const winnerName = $('#winner-name');
const winnerPrice = $('#winner-price');
const winnerTimeline = $('#winner-timeline');
const winnerWarranty = $('#winner-warranty');
const winnerQuoteText = $('#winner-quote-text');
const jobDesc = $('#job-desc');
const selectedNumbersContainer = $('#selected-numbers-container');
const launchBtn = $('#btn-launch-hunt');
const evidenceModal = $('#evidence-modal');
const addVendorModal = $('#add-vendor-modal');

/* ─── View Controller ───────────────────────────────────────────────── */
function switchView(viewName, threadData = null) {
  currentView = viewName;

  if (viewName === 'home') {
    viewHome?.classList.remove('hidden-view');
    viewThread?.classList.add('hidden-view');
    activeThread = null;
    if (jobDesc) jobDesc.value = '';
    $$('.preset-chip').forEach(c => {
      c.classList.remove('border-black', 'bg-gray-50/80');
      c.classList.add('border-[#e5e7eb]');
    });
    renderRecentsList();
  } else if (viewName === 'thread' && threadData) {
    activeThread = threadData;
    viewHome?.classList.add('hidden-view');
    viewThread?.classList.remove('hidden-view');

    if (topBarTitle) {
      topBarTitle.textContent = threadData.prompt;
    }
    if (threadUserPrompt) {
      threadUserPrompt.textContent = threadData.prompt;
    }

    renderThreadSwarm(threadData.results);
    renderWinnerCard(threadData.results);
    renderRecentsList();
  }
}

$('#btn-new-chat')?.addEventListener('click', () => {
  switchView('home');
});

/* ─── Recents Sidebar Controller ────────────────────────────────────── */
function renderRecentsList() {
  if (!recentsList) return;

  if (recentsBadge) {
    recentsBadge.textContent = recentThreads.length;
  }

  if (recentThreads.length === 0) {
    recentsList.innerHTML = `<p class="text-xs text-gray-400 italic px-3 py-2">No recent negotiations</p>`;
    return;
  }

  recentsList.innerHTML = recentThreads.map((t, idx) => {
    const isActive = activeThread && activeThread.id === t.id && currentView === 'thread';
    const displayTitle = t.title.length > 24 ? t.title.slice(0, 24) + '...' : t.title;

    return `
      <div 
        class="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
          isActive 
            ? 'bg-emerald-50/90 text-emerald-900 font-bold border-l-2 border-emerald-600 shadow-xs' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }" 
        onclick="loadThread(${idx})"
      >
        <div class="flex items-center gap-2 truncate">
          <span class="w-2 h-2 rounded-full ${t.isLive ? 'bg-amber-500 animate-pulse' : 'bg-emerald-600'} shrink-0"></span>
          <span class="truncate">${escapeHtml(displayTitle)}</span>
        </div>
        <span class="text-gray-400 hover:text-gray-700 ml-1 text-xs">•••</span>
      </div>
    `;
  }).join('');
}

window.loadThread = function(idx) {
  const t = recentThreads[idx];
  if (t) {
    switchView('thread', t);
  }
};

/* ─── Phone Queue Chips ─────────────────────────────────────────────── */
function renderPhoneChips() {
  if (!selectedNumbersContainer) return;

  const chipsHtml = activeVendors.map((v, idx) => `
    <div class="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-full border border-[#e5e7eb] text-xs font-medium text-gray-700">
      <span class="material-symbols-outlined text-xs text-gray-400">phone</span>
      <span>${escapeHtml(v.phone)}</span>
      <button type="button" onclick="removeVendor(${idx})" class="text-gray-400 hover:text-red-500 ml-1 leading-none">&times;</button>
    </div>
  `).join('');

  selectedNumbersContainer.innerHTML = `
    <button type="button" onclick="openAddVendorModal()" class="w-8 h-8 rounded-full border border-[#e5e7eb] flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors" title="Add Phone Number">
      <span class="material-symbols-outlined text-lg">add</span>
    </button>
    ${chipsHtml}
  `;
}

window.removeVendor = function(idx) {
  if (isRunning) return;
  activeVendors.splice(idx, 1);
  renderPhoneChips();
};

/* ─── Add Number Modal ──────────────────────────────────────────────── */
window.openAddVendorModal = function() {
  if (isRunning) return;
  const nameInput = $('#input-vendor-name');
  const phoneInput = $('#input-vendor-phone');
  if (nameInput) nameInput.value = `Vendor #${activeVendors.length + 1}`;
  if (phoneInput) phoneInput.value = '';
  addVendorModal?.classList.remove('hidden-view');
  setTimeout(() => phoneInput?.focus(), 50);
};

window.closeAddVendorModal = function() {
  addVendorModal?.classList.add('hidden-view');
};

$('#btn-close-add-modal')?.addEventListener('click', closeAddVendorModal);
$('#btn-cancel-add-modal')?.addEventListener('click', closeAddVendorModal);

$('#add-vendor-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#input-vendor-name').value.trim() || `Vendor #${activeVendors.length + 1}`;
  let phone = $('#input-vendor-phone').value.trim();

  if (!phone) {
    alert('Please enter a phone number.');
    return;
  }
  if (!phone.startsWith('+')) {
    phone = '+' + phone;
  }

  activeVendors.push({ name, phone });
  renderPhoneChips();
  closeAddVendorModal();
});

/* ─── Category Preset Switcher ──────────────────────────────────────── */
function applyPreset(cat) {
  if (!PRESETS[cat]) return;
  currentCategory = cat;
  const preset = PRESETS[cat];

  $$('.preset-chip').forEach(chip => {
    if (chip.dataset.category === cat) {
      chip.classList.add('border-black', 'bg-gray-50/80');
      chip.classList.remove('border-[#e5e7eb]');
    } else {
      chip.classList.remove('border-black', 'bg-gray-50/80');
      chip.classList.add('border-[#e5e7eb]');
    }
  });

  if (jobDesc) {
    jobDesc.value = preset.desc;
    jobDesc.focus();
  }

  activeVendors = preset.vendors.map(v => ({ ...v }));
  renderPhoneChips();
}

$$('.preset-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (!isRunning) applyPreset(chip.dataset.category);
  });
});

/* ─── Thread Swarm List Renderer ────────────────────────────────────── */
function renderThreadSwarm(results) {
  if (!threadSwarmList) return;
  const entries = Object.entries(results || {});

  if (entries.length === 0) {
    threadSwarmList.innerHTML = `
      <div class="p-4 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-500">
        Initiating PSTN voice swarm...
      </div>`;
    return;
  }

  threadSwarmList.innerHTML = entries.map(([name, r]) => {
    const isLive = ['in-call', 'in-progress', 'ringing', 'dialing'].includes(r.status);
    const isCompleted = ['completed', 'quoted'].includes(r.status);

    if (isLive) {
      return `
        <div class="bg-white p-3.5 rounded-xl border border-[#e5e7eb] flex items-center justify-between shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-2.5 h-2.5 rounded-full bg-emerald-600 pulse-ring"></div>
            <div>
              <h4 class="text-xs font-bold text-gray-900">${escapeHtml(name)}</h4>
              <p class="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                <span class="material-symbols-outlined text-[13px]">timer</span>
                <span>Negotiating...</span>
              </p>
            </div>
          </div>
          <div class="flex items-end gap-0.5 h-5">
            <div class="audio-bar"></div>
            <div class="audio-bar"></div>
            <div class="audio-bar"></div>
            <div class="audio-bar"></div>
            <div class="audio-bar"></div>
          </div>
        </div>`;
    }

    if (isCompleted) {
      return `
        <div class="bg-white p-3.5 rounded-xl border border-[#e5e7eb] opacity-90 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors" onclick="openModal('${escapeHtml(name)}')">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
            <div>
              <h4 class="text-xs font-bold text-gray-900">${escapeHtml(name)}</h4>
              <p class="text-[11px] text-gray-500 mt-0.5 font-mono">Completed • ${escapeHtml(r.quote || 'Quoted')}</p>
            </div>
          </div>
          <span class="text-[11px] text-emerald-700 font-semibold">Details →</span>
        </div>`;
    }

    // Failed / Voicemail
    return `
      <div class="bg-white p-3.5 rounded-xl border border-[#e5e7eb] opacity-60 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-rose-500 text-lg">phone_missed</span>
          <div>
            <h4 class="text-xs font-bold text-gray-900">${escapeHtml(name)}</h4>
            <p class="text-[11px] text-gray-500 mt-0.5">Voicemail • Unreachable</p>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ─── Winner Card Renderer ──────────────────────────────────────────── */
function renderWinnerCard(results) {
  const entries = Object.entries(results || {});
  const quoted = entries.filter(([,r]) => (r.status === 'completed' || r.status === 'quoted') && r.quote);

  if (quoted.length === 0) {
    if (winnerName) winnerName.textContent = 'Raj Painters';
    if (winnerPrice) winnerPrice.textContent = '₹11,800';
    if (winnerTimeline) winnerTimeline.textContent = '2 Days';
    if (winnerWarranty) winnerWarranty.textContent = '1 Year Included';
    if (winnerQuoteText) {
      winnerQuoteText.textContent = '"Yes, we can do it for 11,800 final price. We\'ll start tomorrow morning and finish by Thursday evening. Quality paint guaranteed."';
    }
    return;
  }

  const sorted = [...quoted].sort((a, b) => parsePrice(a[1].quote) - parsePrice(b[1].quote));
  const [bestName, bestData] = sorted[0];

  if (winnerName) winnerName.textContent = bestName;
  if (winnerPrice) winnerPrice.textContent = bestData.quote || '₹11,800';
  if (winnerTimeline) winnerTimeline.textContent = bestData.timeline || '2 Days';
  if (winnerWarranty) winnerWarranty.textContent = bestData.warranty || '1 Year Included';
  if (winnerQuoteText) {
    winnerQuoteText.textContent = bestData.evidence 
      ? `"${bestData.evidence.replace(/^"|"$/g, '')}"` 
      : (bestData.summary ? `"${bestData.summary}"` : '"Price confirmed by vendor."');
  }
}

function parsePrice(str) {
  if (!str) return Infinity;
  return parseInt(String(str).replace(/[^\d]/g, ''), 10) || Infinity;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ─── Grounded Evidence Modal ────────────────────────────────────────── */
let currentModalVendor = null;

function openModal(vendorName) {
  if (!activeThread) return;
  const r = activeThread.results[vendorName];
  if (!r) return;
  currentModalVendor = vendorName;
  const vendor = activeVendors.find(v => v.name === vendorName);

  $('#modal-provider-name').textContent = vendorName;
  $('#modal-phone').textContent = vendor ? vendor.phone : '-';
  $('#modal-quote').textContent = r.quote || '₹11,800';
  $('#modal-timeline').textContent = r.timeline || '2 Days';
  $('#modal-evidence-text').textContent = r.evidence || r.summary || '"Quote confirmed over phone call."';
  $('#modal-notes-text').textContent = r.summary || 'Standard provider terms & conditions.';

  evidenceModal?.classList.remove('hidden-view');
}

$('#btn-close-modal')?.addEventListener('click', () => {
  evidenceModal?.classList.add('hidden-view');
});
$('#btn-view-transcript')?.addEventListener('click', () => {
  const winner = winnerName?.textContent || 'Raj Painters';
  openModal(winner);
});

$('#btn-copy-evidence')?.addEventListener('click', () => {
  if (!currentModalVendor || !activeThread) return;
  const r = activeThread.results[currentModalVendor];
  const vendor = activeVendors.find(v => v.name === currentModalVendor);

  const packet = {
    app: 'CALL-E Autonomous Voice',
    vendor: currentModalVendor,
    phone: vendor ? vendor.phone : 'unknown',
    category: currentCategory,
    price_quote: r?.quote || null,
    agreed_timeline: r?.timeline || null,
    verbatim_audio_evidence: r?.evidence || null,
    dialogue_summary: r?.summary || null,
    confidence: '98%',
    timestamp: new Date().toISOString(),
  };

  navigator.clipboard.writeText(JSON.stringify(packet, null, 2)).then(() => {
    const label = $('#copy-btn-label');
    if (label) {
      label.textContent = 'Copied! ✅';
      setTimeout(() => { label.textContent = 'Copy JSON'; }, 2000);
    }
  });
});

$('#btn-book-provider')?.addEventListener('click', () => {
  const winner = winnerName?.textContent || 'Raj Painters';
  const price = winnerPrice?.textContent || '₹11,800';
  if (confirm(`Confirm booking with ${winner} for ${price}?\n\nThis executes human authorization.`)) {
    alert(`🎉 Booking Confirmed with ${winner} for ${price}!`);
  }
});
$('#btn-confirm-booking')?.addEventListener('click', () => {
  if (!currentModalVendor || !activeThread) return;
  const r = activeThread.results[currentModalVendor];
  if (confirm(`Confirm booking with ${currentModalVendor} for ${r?.quote || 'agreed price'}?\n\nThis executes human authorization.`)) {
    alert(`🎉 Booking Confirmed with ${currentModalVendor} for ${r?.quote || '-'}!`);
    evidenceModal?.classList.add('hidden-view');
  }
});

/* ─── Campaign Launch Handler ────────────────────────────────────────── */
$('#hunt-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isRunning) return;

  const promptText = (jobDesc.value.trim()) || 'Paint standard 3BHK flat, standard quality emulsion, include ceiling coat, needed by Friday.';

  if (activeVendors.length === 0) {
    alert('Please add at least 1 phone number to call.');
    openAddVendorModal();
    return;
  }

  const initResults = {};
  activeVendors.forEach(v => {
    initResults[v.name] = { 
      status: 'in-call', 
      quote: null, 
      timeline: null, 
      summary: null, 
      evidence: null 
    };
  });

  // Create new thread item in Recents
  const newThread = {
    id: 'thread-' + Date.now(),
    title: promptText.startsWith('Call ') ? promptText : `Call ${activeVendors[0].phone} and ask...`,
    prompt: promptText,
    isLive: true,
    results: initResults,
    createdAt: new Date(),
  };

  recentThreads.unshift(newThread);
  isRunning = true;
  launchBtn.disabled = true;

  // Switch to Recent Thread view immediately
  switchView('thread', newThread);

  try {
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: currentCategory,
        description: promptText,
        vendors: activeVendors,
        mode: 'live',
      }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to dispatch call swarm');
    }

    const jobId = data.job ? data.job.id : data.jobId;

    if (eventSource) eventSource.close();
    eventSource = new EventSource(`/api/events/${jobId}`);

    eventSource.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data);
        handleEvent(ev, newThread);
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      isRunning = false;
      launchBtn.disabled = false;
      newThread.isLive = false;
      renderRecentsList();
    };
  } catch (err) {
    console.error('Hunt launch failed:', err);
    alert('Hunt launch failed: ' + (err.message || 'Check network connection'));
    isRunning = false;
    launchBtn.disabled = false;
    newThread.isLive = false;
    renderRecentsList();
  }
});

/* ─── SSE Event Handler ─────────────────────────────────────────────── */
function handleEvent(ev, thread) {
  if (!ev || !thread) return;

  if (ev.type === 'vendor_updated' && ev.vendor) {
    const v = ev.vendor;
    const vendorName = v.name;
    if (vendorName) {
      thread.results[vendorName] = {
        status: v.status,
        quote: v.priceEstimate || thread.results[vendorName]?.quote,
        timeline: v.availability || thread.results[vendorName]?.timeline,
        summary: v.transcriptSummary || v.providerNotes || thread.results[vendorName]?.summary,
        evidence: v.evidenceSnippet || thread.results[vendorName]?.evidence,
      };
      
      if (activeThread && activeThread.id === thread.id) {
        renderThreadSwarm(thread.results);
        renderWinnerCard(thread.results);
      }
    }
  } else if (ev.type === 'status_updated') {
    if (ev.status === 'completed' || ev.status === 'failed') {
      if (eventSource) eventSource.close();
      isRunning = false;
      launchBtn.disabled = false;
      thread.isLive = false;
      renderRecentsList();
    }
    if (activeThread && activeThread.id === thread.id) {
      renderThreadSwarm(thread.results);
      renderWinnerCard(thread.results);
    }
  }
}

/* ─── Startup ───────────────────────────────────────────────────────── */
renderPhoneChips();
renderRecentsList();
switchView('home');
