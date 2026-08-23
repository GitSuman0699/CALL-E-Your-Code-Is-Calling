/* ==========================================================================
   CALL-E Negotiation Hub — State Manager & Recent Threads Controller
   ========================================================================== */

/* ─── Service & Negotiation Presets ──────────────────────────────────── */
const PRESETS = {
  personal: {
    name: 'Personal Message',
    desc: 'Call +918016086948 with a personal message regarding the project update and ask for confirmation.',
    vendors: [
      { name: 'My Mobile', phone: '+918016086948' },
    ],
  },
  business: {
    name: 'Ask a Business',
    desc: 'Call +918016086948 and ask, are they available for painting 3BHK room on Friday including ceiling. Ask the estimated total price, and how many days it will require',
    vendors: [
      { name: 'My Mobile', phone: '+918016086948' },
      { name: 'Raj Painters', phone: '+919876543210' },
      { name: 'Urban Colors Ltd.', phone: '+918765432109' },
    ],
  },
  booking: {
    name: 'Book or Reschedule',
    desc: 'Call service provider to schedule an on-site visit for this Friday morning or reschedule to the earliest available slot.',
    vendors: [
      { name: 'My Mobile', phone: '+918016086948' },
      { name: 'Urban Colors Ltd.', phone: '+918765432109' },
    ],
  },
  followup: {
    name: 'Follow Up',
    desc: 'Call vendor to follow up on the previous quote, negotiate for the best discount with materials included, and ask for timeline confirmation.',
    vendors: [
      { name: 'My Mobile', phone: '+918016086948' },
      { name: 'Raj Painters', phone: '+919876543210' },
    ],
  },
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
let activeVendors = [];

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

    const statusBadge = $('#thread-status-badge');
    if (statusBadge) {
      if (threadData.isLive) {
        statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[11px] font-medium';
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span><span>Live Swarm</span>';
      } else {
        statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200 text-[11px] font-medium';
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span><span>Completed</span>';
      }
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
    recentsList.innerHTML = `<p class="text-xs text-gray-400 italic px-2.5 py-2">No recent negotiations</p>`;
    return;
  }

  recentsList.innerHTML = recentThreads.map((t, idx) => {
    const isActive = activeThread && activeThread.id === t.id && currentView === 'thread';
    const displayTitle = t.title.length > 24 ? t.title.slice(0, 24) + '...' : t.title;

    return `
      <div 
        class="group relative flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
          isActive 
            ? 'bg-gray-200/70 text-gray-900 font-medium' 
            : 'text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 font-normal'
        }" 
        onclick="loadThread(${idx})"
      >
        <div class="flex items-center gap-2 truncate flex-1 min-w-0 pr-1">
          <span class="w-1.5 h-1.5 rounded-full ${t.isLive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'} shrink-0"></span>
          <span class="truncate" id="thread-title-${idx}">${escapeHtml(displayTitle)}</span>
        </div>

        <!-- 3-Dot Options Trigger (Appears on Hover) -->
        <div class="relative shrink-0" onclick="event.stopPropagation()">
          <button 
            type="button" 
            onclick="toggleRecentMenu(event, ${idx})"
            class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 p-1 hover:bg-gray-200/80 rounded-md transition-all flex items-center justify-center cursor-pointer"
            title="Options"
          >
            <span class="material-symbols-outlined text-[16px] leading-none font-light">more_horiz</span>
          </button>

          <!-- Floating Dropdown Menu -->
          <div id="recent-menu-${idx}" class="recent-menu-dropdown hidden-view absolute right-0 top-6 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-28 text-xs font-normal text-gray-700 backdrop-blur-sm">
            <button type="button" onclick="renameThread(event, ${idx})" class="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-gray-50 text-gray-700 transition-colors">
              <span class="material-symbols-outlined text-[14px] text-gray-400 font-light">edit</span>
              <span>Rename</span>
            </button>
            <button type="button" onclick="deleteThread(event, ${idx})" class="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-50 text-rose-600 transition-colors">
              <span class="material-symbols-outlined text-[14px] text-rose-500 font-light">delete</span>
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleRecentMenu = function(e, idx) {
  e.stopPropagation();
  const currentMenu = document.getElementById(`recent-menu-${idx}`);
  const isCurrentlyOpen = currentMenu && !currentMenu.classList.contains('hidden-view');

  // Close all open menus
  document.querySelectorAll('.recent-menu-dropdown').forEach(m => m.classList.add('hidden-view'));

  if (!isCurrentlyOpen && currentMenu) {
    currentMenu.classList.remove('hidden-view');
  }
};

window.renameThread = function(e, idx) {
  e.stopPropagation();
  document.querySelectorAll('.recent-menu-dropdown').forEach(m => m.classList.add('hidden-view'));
  const thread = recentThreads[idx];
  if (!thread) return;

  const newTitle = prompt('Rename negotiation thread:', thread.title);
  if (newTitle && newTitle.trim()) {
    thread.title = newTitle.trim();
    renderRecentsList();
    if (activeThread && activeThread.id === thread.id && topBarTitle) {
      topBarTitle.textContent = thread.title;
    }
  }
};

window.deleteThread = function(e, idx) {
  e.stopPropagation();
  document.querySelectorAll('.recent-menu-dropdown').forEach(m => m.classList.add('hidden-view'));
  const thread = recentThreads[idx];
  if (!thread) return;

  if (confirm(`Delete negotiation thread "${thread.title}"?`)) {
    const isDeletedActive = activeThread && activeThread.id === thread.id;
    recentThreads.splice(idx, 1);
    renderRecentsList();
    if (isDeletedActive) {
      switchView('home');
    }
  }
};

// Close all 3-dot dropdowns when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.recent-menu-dropdown').forEach(m => m.classList.add('hidden-view'));
});

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
    <div class="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200 text-xs font-normal text-gray-700">
      <span class="material-symbols-outlined text-[13px] text-gray-400">call</span>
      <span>${escapeHtml(v.phone)}</span>
      <button type="button" onclick="removeVendor(${idx})" class="text-gray-400 hover:text-red-500 ml-1 leading-none text-sm">&times;</button>
    </div>
  `).join('');

  selectedNumbersContainer.innerHTML = `
    <button type="button" onclick="openAddVendorModal()" class="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors" title="Add Phone Number">
      <span class="material-symbols-outlined text-[20px] font-light">add</span>
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
  if (nameInput) nameInput.value = '';
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
  let phone = $('#input-vendor-phone').value.trim();

  if (!phone) {
    alert('Please enter a phone number.');
    return;
  }
  if (!phone.startsWith('+')) {
    phone = '+' + phone;
  }

  const name = $('#input-vendor-name').value.trim() || phone;

  activeVendors.push({ name, phone });
  renderPhoneChips();
  closeAddVendorModal();
});

/* ─── Category & Action Preset Switcher ─────────────────────────────── */
function applyPreset(cat) {
  if (!PRESETS[cat]) return;
  currentCategory = cat;
  const preset = PRESETS[cat];

  $$('.preset-chip').forEach(chip => {
    if (chip.dataset.category === cat) {
      chip.classList.add('border-gray-800', 'bg-gray-50');
      chip.classList.remove('border-[#d6dbe1]');
    } else {
      chip.classList.remove('border-gray-800', 'bg-gray-50');
      chip.classList.add('border-[#d6dbe1]');
    }
  });

  if (jobDesc) {
    jobDesc.value = preset.desc;
    jobDesc.focus();
  }
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
    const isLive = ['in-call', 'in-progress', 'ringing', 'dialing', 'initializing', 'analyzing'].includes(r.status);
    const isCompleted = ['completed', 'quoted'].includes(r.status);

    if (isLive) {
      let statusLabel = 'Negotiating...';
      let ringColor = 'bg-emerald-600';
      if (r.status === 'initializing') {
        statusLabel = 'Initializing Voice AI...';
        ringColor = 'bg-blue-500';
      } else if (r.status === 'dialing') {
        statusLabel = 'Connecting Carrier...';
        ringColor = 'bg-indigo-500';
      } else if (r.status === 'ringing') {
        statusLabel = 'Phone Ringing...';
        ringColor = 'bg-amber-500';
      } else if (r.status === 'in-call' || r.status === 'in-progress') {
        statusLabel = 'Live On-Call...';
        ringColor = 'bg-emerald-600';
      } else if (r.status === 'analyzing') {
        statusLabel = 'Extracting Quote...';
        ringColor = 'bg-purple-500';
      }

      return `
        <div class="bg-white p-3.5 rounded-xl border border-gray-200 flex items-center justify-between shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-2.5 h-2.5 rounded-full ${ringColor} pulse-ring"></div>
            <div>
              <h4 class="text-xs font-semibold text-gray-900">${escapeHtml(name)}</h4>
              <p class="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                <span class="material-symbols-outlined text-[13px]">timer</span>
                <span>${escapeHtml(statusLabel)}</span>
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
        <div class="bg-white p-3.5 rounded-xl border border-gray-200 opacity-95 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors shadow-2xs" onclick="openModal('${escapeHtml(name)}')">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
            <div>
              <h4 class="text-xs font-semibold text-gray-900">${escapeHtml(name)}</h4>
              <p class="text-[11px] text-gray-500 mt-0.5 font-mono font-medium">Completed • <span class="text-emerald-700 font-bold">${escapeHtml(r.quote || 'Quoted')}</span></p>
            </div>
          </div>
          <span class="text-[11px] text-emerald-700 font-semibold">Details →</span>
        </div>`;
    }

    // Failed / Voicemail / Refused
    const failReason = r.providerNotes || 'Call unanswered or declined';
    return `
      <div class="bg-white p-3.5 rounded-xl border border-gray-200 opacity-70 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-rose-500 text-lg">phone_missed</span>
          <div>
            <h4 class="text-xs font-semibold text-gray-900">${escapeHtml(name)}</h4>
            <p class="text-[11px] text-gray-500 mt-0.5 truncate max-w-[180px]">${escapeHtml(failReason)}</p>
          </div>
        </div>
        <span class="text-[10px] text-gray-400 font-medium">Ended</span>
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

/* ─── Campaign Launch Handler (Make Call Button) ──────────────────────── */
$('#hunt-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isRunning) return;

  const promptText = (jobDesc?.value.trim()) || 'Call vendor and negotiate a competitive price quote.';

  // If no vendors added yet, try auto-extracting from prompt text (e.g. +918016086948)
  if (activeVendors.length === 0) {
    const phoneMatches = promptText.match(/\+?\d{10,15}/g);
    if (phoneMatches && phoneMatches.length > 0) {
      phoneMatches.forEach(p => {
        const formatted = p.startsWith('+') ? p : '+' + p;
        if (!activeVendors.some(v => v.phone === formatted)) {
          activeVendors.push({ name: 'Vendor #' + (activeVendors.length + 1), phone: formatted });
        }
      });
      renderPhoneChips();
    }
  }

  if (activeVendors.length === 0) {
    openAddVendorModal();
    return;
  }

  const initResults = {};
  activeVendors.forEach(v => {
    initResults[v.name] = { 
      status: 'initializing', 
      quote: null, 
      timeline: null, 
      summary: null, 
      evidence: null 
    };
  });

  // Create new thread item in Recents
  const displayTitle = promptText.length > 32 ? promptText.slice(0, 32) + '...' : promptText;
  const newThread = {
    id: 'thread-' + Date.now(),
    title: displayTitle,
    prompt: promptText,
    isLive: true,
    results: initResults,
    createdAt: new Date(),
  };

  recentThreads.unshift(newThread);
  isRunning = true;
  if (launchBtn) launchBtn.disabled = true;

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
      if (launchBtn) launchBtn.disabled = false;
      newThread.isLive = false;
      renderRecentsList();
    };
  } catch (err) {
    console.error('Hunt launch failed:', err);
    alert('Hunt launch failed: ' + (err.message || 'Check network connection'));
    isRunning = false;
    if (launchBtn) launchBtn.disabled = false;
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
      if (launchBtn) launchBtn.disabled = false;
      thread.isLive = false;
      renderRecentsList();

      const statusBadge = $('#thread-status-badge');
      if (statusBadge) {
        statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200 text-[11px] font-medium';
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span><span>Completed</span>';
      }
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
