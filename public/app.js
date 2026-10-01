/* ═══════════════════════════════════════════════
   WhatsApp Chatbot SaaS — Frontend App Logic
   ═══════════════════════════════════════════════ */

// ── State ──
let authToken = localStorage.getItem('saas_token') || '';
let selectedClientId = '';
let currentLeadId = '';
let currentClientEditId = '';
let lastCreatedVerifyToken = '';
let sortLeadsBy = 'updated_at';
let sortLeadsDir = 'desc';

const API = ''; // same origin

// ── Auth Headers ──
function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` };
}

// ══════════════════════════════════
//  INIT
// ══════════════════════════════════
// Check route context
let isAdminRoute = window.location.pathname.endsWith('/admin');

document.addEventListener('DOMContentLoaded', () => {
  setupLoginView();
  if (authToken) {
    showApp();
  }
  // Login on Enter
  document.getElementById('passwordInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  if (document.getElementById('identifierInput')) {
    document.getElementById('identifierInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  }
});

function setupLoginView() {
  if (isAdminRoute) {
    document.getElementById('loginWelcomeHeader').textContent = 'Admin Portal';
    document.getElementById('loginSubText').textContent = 'Sign in with your master password to manage clients & configurations';
    document.getElementById('loginSubTitle').textContent = 'WhatsApp AI SaaS Platform';
    document.getElementById('passwordLabel').textContent = 'Admin Password';
    document.getElementById('passwordInput').placeholder = 'Enter admin password';
    document.getElementById('identifierInputGroup').style.display = 'none';
    document.getElementById('adminPortalNotice').innerHTML = 'Are you a client? Ask the admin for your credentials.';
  } else {
    document.getElementById('loginWelcomeHeader').textContent = 'Client Login';
    document.getElementById('loginSubText').textContent = 'Enter your WhatsApp number & client password to manage your leads';
    document.getElementById('loginSubTitle').textContent = 'Client Login Panel';
    document.getElementById('passwordLabel').textContent = 'Client Password';
    document.getElementById('passwordInput').placeholder = 'Enter your password';
    document.getElementById('identifierInputGroup').style.display = 'block';
    document.getElementById('adminPortalNotice').innerHTML = 'Are you an administrator? Visit <a href="/admin" style="color:var(--primary);text-decoration:none;font-weight:600">Admin Portal</a>';
  }
}

// ══════════════════════════════════
//  LOGIN / LOGOUT
// ══════════════════════════════════
async function doLogin() {
  const pw = document.getElementById('passwordInput').value.trim();
  const idVal = document.getElementById('identifierInput')?.value?.trim() || '';
  
  if (!pw) return;
  if (!isAdminRoute && !idVal) {
    document.getElementById('loginError').textContent = '❌ Please enter your WhatsApp number or Phone.';
    document.getElementById('loginError').style.display = 'block';
    return;
  }

  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in...';

  try {
    const res = await fetch(`${API}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw, identifier: idVal, isAdmin: isAdminRoute })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      authToken = data.token;
      localStorage.setItem('saas_token', authToken);
      localStorage.setItem('saas_role', data.role || 'admin');
      localStorage.setItem('saas_client_id', data.clientId || '');
      document.getElementById('loginError').style.display = 'none';
      showApp();
    } else {
      document.getElementById('loginError').textContent = `❌ ${data.error || 'Invalid credentials'}`;
      document.getElementById('loginError').style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = 'Sign In →';
    }
  } catch (e) {
    document.getElementById('loginError').style.display = 'block';
    document.getElementById('loginError').textContent = '❌ Could not connect to server.';
    btn.disabled = false;
    btn.innerHTML = 'Sign In →';
  }
}

function doLogout() {
  authToken = '';
  localStorage.removeItem('saas_token');
  localStorage.removeItem('saas_role');
  localStorage.removeItem('saas_client_id');
  document.getElementById('appLayout').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('passwordInput').value = '';
  if (document.getElementById('identifierInput')) {
    document.getElementById('identifierInput').value = '';
  }
  setupLoginView();
}

function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appLayout').style.display = 'flex';

  const role = localStorage.getItem('saas_role') || 'admin';
  const cId = localStorage.getItem('saas_client_id') || '';

  populateStageFilters();

  if (role === 'client') {
    // Hide administrative navigation elements
    document.getElementById('navSectionClients').style.display = 'none';
    document.getElementById('sidebarFilterWrap').style.display = 'none';
    document.getElementById('navSectionTeam').style.display = 'block';
    selectedClientId = cId;
    loadDashboard();
  } else {
    // Show administrative navigation elements
    document.getElementById('navSectionClients').style.display = 'block';
    document.getElementById('sidebarFilterWrap').style.display = 'block';
    document.getElementById('navSectionTeam').style.display = 'block';
    selectedClientId = '';
    loadClients();
    loadDashboard();
    loadLeads();
  }
}

// ══════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  const nav = document.getElementById(`nav-${name}`);
  if (page) page.classList.add('active');
  if (nav) nav.classList.add('active');

  if (name === 'dashboard') loadDashboard();
  if (name === 'leads') loadLeads();
  if (name === 'clients') loadClients();
  if (name === 'onboarding') resetWizard();
  if (name === 'reports') initReportsPage();
  if (name === 'team') initTeamPage();
  if (name === 'integrations') initIntegrationsPage();
}

function setFilter(score) {
  document.getElementById('scoreFilter').value = score;
  loadLeads();
}

function onClientFilter() {
  selectedClientId = document.getElementById('clientFilterSelect').value;
  loadDashboard();
  loadLeads();
}

// ══════════════════════════════════
//  LOAD DASHBOARD STATS
// ══════════════════════════════════
async function loadDashboard() {
  try {
    const params = selectedClientId ? `?client_id=${selectedClientId}` : '';
    const res = await fetch(`${API}/api/dashboard/stats${params}`, { headers: headers() });
    const stats = await res.json();

    document.getElementById('stat-total').textContent = stats.total ?? 0;
    document.getElementById('stat-hot').textContent = stats.hot ?? 0;
    document.getElementById('stat-warm').textContent = stats.warm ?? 0;
    document.getElementById('stat-cold').textContent = stats.cold ?? 0;
    document.getElementById('stat-visits').textContent = stats.today_visits ?? 0;
    document.getElementById('stat-calls').textContent = stats.today_calls ?? 0;

    // Update sidebar badge
    document.getElementById('hotBadge').textContent = stats.hot ?? 0;

    // Load hot leads preview
    await loadHotLeads();
  } catch (e) {
    console.error('Error loading dashboard:', e);
  }
}

async function loadHotLeads() {
  const params = new URLSearchParams({ lead_score: 'HOT', limit: 5 });
  if (selectedClientId) params.set('client_id', selectedClientId);

  const res = await fetch(`${API}/api/leads?${params}`, { headers: headers() });
  const leads = await res.json();

  const tbody = document.getElementById('hotLeadsBody');
  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">No hot leads yet 🎯</td></tr>`;
    return;
  }

  tbody.innerHTML = leads.map(l => `
    <tr onclick="openLead('${l.id}')">
      <td>${l.name || '<em style="color:var(--text-muted)">Unknown</em>'}</td>
      <td>${l.phone}</td>
      <td>${l.budget || '—'}</td>
      <td>${l.location || '—'}</td>
      <td>${scoreBadge(l.lead_score)}</td>
      <td>${stageBadge(l.lead_stage)}</td>
      <td>${timeAgo(l.updated_at)}</td>
      <td onclick="openChatOnly('${l.id}', event)" style="color:var(--primary);cursor:pointer;font-weight:600;">💬 See Chat</td>
    </tr>
  `).join('');
}

// ══════════════════════════════════
//  LOAD LEADS
// ══════════════════════════════════
function toggleLeadsSort(field) {
  if (sortLeadsBy === field) {
    sortLeadsDir = sortLeadsDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortLeadsBy = field;
    sortLeadsDir = field === 'updated_at' ? 'desc' : 'asc';
  }
  loadLeads();
}

async function loadLeads() {
  const search = document.getElementById('searchInput')?.value?.trim() || '';
  const score = document.getElementById('scoreFilter')?.value || '';
  const stage = document.getElementById('stageFilter')?.value || '';

  const params = new URLSearchParams({ limit: 500 });
  if (selectedClientId) params.set('client_id', selectedClientId);
  if (search) params.set('search', search);
  if (score) params.set('lead_score', score);
  if (stage) params.set('lead_stage', stage);

  try {
    populateStageFilters();
    const res = await fetch(`${API}/api/leads?${params}`, { headers: headers() });
    let leads = await res.json();

    // Guard: API might return error object if auth fails or server errors
    if (!Array.isArray(leads)) {
      console.error('Leads API error:', leads);
      const tbody = document.getElementById('leadsBody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text-muted)">⚠️ Could not load leads. Please refresh the page or re-login.</td></tr>`;
      return;
    }

    // ── Client-side sort ──
    const sortDir = sortLeadsDir === 'asc' ? 1 : -1;
    leads.sort((a, b) => {
      let va = a[sortLeadsBy] || '';
      let vb = b[sortLeadsBy] || '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });

    document.getElementById('leadsCount').textContent = `${leads.length} Lead${leads.length !== 1 ? 's' : ''}`;

    // ── Render sort arrows in headers ──
    const arrow = (field) => sortLeadsBy === field ? (sortLeadsDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';
    const thead = document.querySelector('#page-leads table thead tr');
    if (thead) {
      thead.innerHTML = `
        <th onclick="toggleLeadsSort('name')" style="cursor:pointer;user-select:none">Name${arrow('name')}</th>
        <th>Phone</th>
        <th onclick="toggleLeadsSort('budget')" style="cursor:pointer;user-select:none">Budget${arrow('budget')}</th>
        <th onclick="toggleLeadsSort('location')" style="cursor:pointer;user-select:none">Location${arrow('location')}</th>
        <th>Purpose</th>
        <th onclick="toggleLeadsSort('lead_score')" style="cursor:pointer;user-select:none">Score${arrow('lead_score')}</th>
        <th onclick="toggleLeadsSort('lead_stage')" style="cursor:pointer;user-select:none">Stage${arrow('lead_stage')}</th>
        <th onclick="toggleLeadsSort('site_visit_date')" style="cursor:pointer;user-select:none">Site Visit${arrow('site_visit_date')}</th>
        <th>Suggested Properties</th>
        <th onclick="toggleLeadsSort('updated_at')" style="cursor:pointer;user-select:none">Updated${arrow('updated_at')}</th>
        <th>Conversation</th>
      `;
    }

    const tbody = document.getElementById('leadsBody');
    if (!leads.length) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:60px;color:var(--text-muted)">
        <div style="font-size:40px;margin-bottom:12px">👥</div>No leads found. Leads appear here automatically when users message your WhatsApp bot.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = leads.map(l => `
      <tr onclick="openLead('${l.id}')">
        <td>${l.name || '<em style="color:var(--text-muted)">Unknown</em>'}</td>
        <td>${l.phone}</td>
        <td>${l.budget || '—'}</td>
        <td>${l.location || '—'}</td>
        <td>${l.purpose || '—'}</td>
        <td>${scoreBadge(l.lead_score)}</td>
        <td>${stageBadge(l.lead_stage)}</td>
        <td>${l.site_visit_date ? `📅 ${l.site_visit_date}` : '—'}</td>
        <td>${formatMatchedProjects(l.matched_projects)}</td>
        <td>${timeAgo(l.updated_at)}</td>
        <td onclick="openChatOnly('${l.id}', event)" style="color:var(--primary);cursor:pointer;font-weight:600;">💬 See Chat</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Error loading leads:', e);
    const tbody = document.getElementById('leadsBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text-muted)">⚠️ Could not load leads. Please check your login and refresh.</td></tr>`;
  }
}

async function toggleBotPause() {
  if (!currentLeadId) return;
  const btn = document.getElementById('btnBotPause');
  const isPaused = btn.textContent.includes('Resume');
  const newPaused = !isPaused;
  try {
    const res = await fetch(`${API}/api/leads/${currentLeadId}/pause-bot`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ paused: newPaused })
    });
    const data = await res.json();
    if (data.success) {
      btn.textContent = newPaused ? '▶️ Resume Bot' : '⏸️ Pause Bot';
      btn.style.background = newPaused ? '#22c55e' : '#f59e0b';
      btn.style.color = '#fff';
      if (currentLeadData) currentLeadData.bot_paused = newPaused;
      const msg = newPaused
        ? '⏸️ Bot paused. You can now reply manually.'
        : '▶️ Bot resumed. AI will reply again.';
      alert(msg);
    }
  } catch(e) {
    alert('Error toggling bot: ' + e.message);
  }
}


// ══════════════════════════════════
//  OPEN LEAD DETAIL MODAL
// ══════════════════════════════════
let isEditingLead = false;
let currentLeadData = null;

async function openLead(leadId) {
  currentLeadId = leadId;
  isEditingLead = false;
  openModal('leadModal');
  document.getElementById('btnEditLead').textContent = '✏️ Edit Details';

  try {
    const res = await fetch(`${API}/api/leads/${leadId}`, { headers: headers() });
    const { lead, conversation } = await res.json();
    currentLeadData = lead;

    document.getElementById('modalLeadName').textContent = lead.name || 'Unknown Lead';
    document.getElementById('modalLeadPhone').innerHTML = `📱 ${lead.phone} · ${scoreBadge(lead.lead_score)}`;

    // Update bot pause button state
    const pauseBtn = document.getElementById('btnBotPause');
    if (pauseBtn) {
      pauseBtn.textContent = lead.bot_paused ? '▶️ Resume Bot' : '⏸️ Pause Bot';
      pauseBtn.style.background = lead.bot_paused ? '#22c55e' : '#f59e0b';
      pauseBtn.style.color = '#fff';
    }

    // Render detail grid and notes section based on isEditingLead mode
    renderLeadDetails(lead);

  } catch (e) {
    console.error('Error loading lead:', e);
  }
}

function renderLeadDetails(lead) {
  let notesText = '';
  let alternatePhone = '';
  let customFields = {};

  try {
    const parsed = JSON.parse(lead.notes);
    if (parsed && (parsed.hasOwnProperty('notesText') || parsed.hasOwnProperty('alternate_phone') || parsed.hasOwnProperty('custom_fields'))) {
      notesText = parsed.notesText || '';
      alternatePhone = parsed.alternate_phone || '';
      customFields = parsed.custom_fields || {};
    } else {
      notesText = lead.notes || '';
    }
  } catch (e) {
    notesText = lead.notes || '';
  }

  const grid = document.getElementById('leadDetailGrid');
  const notesSec = document.querySelector('.notes-section');

  if (isEditingLead) {
    // RENDER EDIT FORM
    document.getElementById('btnEditLead').textContent = '💾 Save Details';
    
    // Render editable inputs for all fields in grid
    const stages = getStages();
    grid.innerHTML = `
      <div class="detail-item edit-item" style="grid-column: span 2;">
        <label>Name</label>
        <input type="text" id="edit_lead_name" value="${lead.name || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Phone</label>
        <input type="text" id="edit_lead_phone" value="${lead.phone || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Alternate Phone</label>
        <input type="text" id="edit_lead_alternate_phone" value="${alternatePhone || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Email</label>
        <input type="email" id="edit_lead_email" value="${lead.email || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Budget</label>
        <input type="text" id="edit_lead_budget" value="${lead.budget || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Location</label>
        <input type="text" id="edit_lead_location" value="${lead.location || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Property Type</label>
        <input type="text" id="edit_lead_property_type" value="${lead.property_type || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Purpose</label>
        <input type="text" id="edit_lead_purpose" value="${lead.purpose || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Timeline</label>
        <input type="text" id="edit_lead_timeline" value="${lead.timeline || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Lead Score</label>
        <select id="edit_lead_score" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;">
          <option value="HOT" ${lead.lead_score === 'HOT' ? 'selected' : ''}>🔥 Hot</option>
          <option value="WARM" ${lead.lead_score === 'WARM' ? 'selected' : ''}>🟡 Warm</option>
          <option value="COLD" ${lead.lead_score === 'COLD' ? 'selected' : ''}>🔵 Cold</option>
          <option value="UNKNOWN" ${lead.lead_score === 'UNKNOWN' ? 'selected' : ''}>❓ Unknown</option>
        </select>
      </div>
      <div class="detail-item edit-item">
        <label>Lead Stage</label>
        <select id="edit_lead_stage" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;">
          ${stages.map(s => `<option value="${s.id}" ${lead.lead_stage === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="detail-item edit-item">
        <label>Site Visit Date</label>
        <input type="date" id="edit_lead_site_visit_date" value="${lead.site_visit_date || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Site Visit Time</label>
        <input type="time" id="edit_lead_site_visit_time" value="${lead.site_visit_time || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Call Date</label>
        <input type="date" id="edit_lead_call_date" value="${lead.call_date || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Call Time</label>
        <input type="time" id="edit_lead_call_time" value="${lead.call_time || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Follow-up Date</label>
        <input type="date" id="edit_lead_follow_up_date" value="${lead.follow_up_date || ''}" style="width:100%; padding:6px; font-size:13px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
      </div>
      <div class="detail-item edit-item">
        <label>Created Date</label>
        <div style="font-size: 13px; padding: 6px; color:var(--text-secondary);">${formatDate(lead.created_at)} (Read-only)</div>
      </div>
      
      <div class="custom-fields-edit-section" style="grid-column: span 2; margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px;">
        <label style="font-weight:600; margin-bottom:8px; display:block;">🏷️ Custom Fields (N number allowed)</label>
        <div id="edit_custom_fields_container" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;">
          ${Object.entries(customFields).map(([key, val]) => `
            <div class="custom-field-row" style="display:flex; gap:8px;">
              <input type="text" class="custom-key" placeholder="Field Label" value="${key}" style="flex:1; padding:6px; font-size:12px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
              <input type="text" class="custom-val" placeholder="Value" value="${val}" style="flex:1; padding:6px; font-size:12px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
              <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding:4px 8px;">✕</button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="addCustomFieldRow()">➕ Add Custom Field</button>
      </div>
    `;

    notesSec.innerHTML = `
      <label>📝 Notes / Remarks</label>
      <textarea id="edit_lead_notes" rows="3" placeholder="Add notes here..." style="width:100%; padding:8px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px; font-size:13px;">${notesText}</textarea>
      <div style="display:flex; gap:10px; margin-top:10px; justify-content:flex-end;">
        <button class="btn btn-secondary btn-sm" onclick="cancelLeadEdit()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="saveLeadDetails()">Save All Changes</button>
      </div>
    `;
  } else {
    // RENDER STATIC GRID
    grid.innerHTML = [
      ['Budget', lead.budget], ['Location', lead.location],
      ['Property Type', lead.property_type], ['Purpose', lead.purpose],
      ['Timeline', lead.timeline], ['Email', lead.email],
      ['Alternate Phone', alternatePhone],
      ['Lead Score', scoreBadge(lead.lead_score)], ['Lead Stage', stageBadge(lead.lead_stage)],
      ['Site Visit Date', lead.site_visit_date], ['Site Visit Time', lead.site_visit_time],
      ['Call Date', lead.call_date], ['Call Time', lead.call_time],
      ['Follow-up Date', lead.follow_up_date], ['Created', formatDate(lead.created_at)]
    ].map(([label, val]) => `
      <div class="detail-item">
        <div class="detail-label">${label}</div>
        <div class="detail-value ${val ? '' : 'empty'}">${val || 'Not collected yet'}</div>
      </div>
    `).join('') + Object.entries(customFields).map(([key, val]) => `
      <div class="detail-item">
        <div class="detail-label">${key} (Custom)</div>
        <div class="detail-value">${val || '—'}</div>
      </div>
    `).join('');

    notesSec.innerHTML = `
      <label>📝 Notes / Remarks</label>
      <textarea id="leadNotes" rows="3" placeholder="Add notes here...">${notesText}</textarea>
      <div style="display:flex;gap:10px;margin-top:10px;justify-content:space-between;align-items:center">
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:12px;color:var(--text-muted)">Stage:</span>
          <select id="leadStageSelect" style="font-size:12px;padding:5px 10px">
            ${stages.map(s => `<option value="${s.id}" ${lead.lead_stage === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveLeadNotes()">Save Changes</button>
      </div>
    `;
  }
}

async function saveLeadNotes() {
  if (!currentLeadId) return;
  const notesText = document.getElementById('leadNotes').value;
  const lead_stage = document.getElementById('leadStageSelect').value;

  // Preserve alternate phone and custom fields on simple save
  let alternate_phone = '';
  let custom_fields = {};
  try {
    const parsed = JSON.parse(currentLeadData.notes);
    if (parsed) {
      alternate_phone = parsed.alternate_phone || '';
      custom_fields = parsed.custom_fields || {};
    }
  } catch (e) {}

  const notes = JSON.stringify({
    notesText,
    alternate_phone,
    custom_fields
  });

  try {
    await fetch(`${API}/api/leads/${currentLeadId}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ notes, lead_stage })
    });
    closeModal('leadModal');
    loadLeads();
    loadDashboard();
  } catch (e) {
    console.error('Error saving notes:', e);
  }
}

// ══════════════════════════════════
//  LOAD CLIENTS
// ══════════════════════════════════
async function loadClients() {
  try {
    const showArchived = document.getElementById('showArchivedClients')?.checked || false;
    const res = await fetch(`${API}/api/clients?show_archived=${showArchived}`, { headers: headers() });
    const clients = await res.json();

    // Populate sidebar selector
    const sel = document.getElementById('clientFilterSelect');
    if (sel) {
      sel.innerHTML = '<option value="">All Clients</option>' +
        clients.map(c => `<option value="${c.id}" ${c.id === selectedClientId ? 'selected' : ''}>${c.name}</option>`).join('');
    }

    // Render client cards
    const grid = document.getElementById('clientsGrid');
    if (!grid) return;

    if (!clients.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏢</div>
          <h3>No Clients Yet</h3>
          <p>Add your first Real Estate client to get started</p>
          <br/>
          <button class="btn btn-primary" onclick="showPage('onboarding')">➕ Add New Client</button>
        </div>`;
      return;
    }

    grid.innerHTML = clients.map(c => {
      const isArchived = c.status === 'archived';
      return `
      <div class="client-card">
        <div class="client-card-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div class="client-avatar">🏢</div>
          <div class="client-info">
            <div class="client-name">${c.name}</div>
            <div class="client-type">${c.business_type || 'Real Estate'} ${c.location ? `• 📍 ${c.location}` : ''}</div>
          </div>
          <div>${statusBadge(c.status)}</div>
        </div>

        <div class="client-meta" style="margin-bottom:6px">
          ${c.contact_person ? `<span>👤 ${c.contact_person}</span>` : ''}
          ${c.contact_phone ? `<span>📞 ${c.contact_phone}</span>` : ''}
          ${c.contact_email ? `<span>✉️ ${c.contact_email}</span>` : ''}
        </div>

        <div class="client-meta" style="margin-bottom:8px">
          <span style="font-family:monospace;font-size:11px;background:rgba(255,255,255,0.05);padding:3px 8px;border-radius:4px;color:var(--primary)">
            🔑 Login ID: ${c.login_id || c.contact_email || '—'}
          </span>
        </div>

        ${c.n8n_webhook_url ? `
          <div class="client-meta" style="margin-bottom:8px;font-size:11px;color:#10b981">
            ⚡ n8n Webhook Connected
          </div>
        ` : ''}

        <div class="client-meta" style="font-size:11px">Added: ${formatDate(c.created_at)}</div>

        <div class="client-actions" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px;">
          <button class="btn btn-secondary btn-sm" onclick="openClientEdit('${c.id}', event)">✏️ Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="viewClientLeads('${c.id}', event)">👥 Leads</button>
          ${isArchived 
            ? `<button class="btn btn-success btn-sm" onclick="unarchiveClient('${c.id}', event)">▶️ Activate</button>`
            : `<button class="btn btn-danger btn-sm" onclick="deactivateClient('${c.id}', event)">${c.status === 'active' ? '⏸️ Pause' : '▶️ Activate'}</button>
               <button class="btn btn-warning btn-sm" style="background:var(--warning); color:#000;" onclick="archiveClient('${c.id}', event)">📦 Archive</button>`
          }
        </div>
      </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Error loading clients:', e);
  }
}

function viewClientLeads(clientId, e) {
  e?.stopPropagation();
  selectedClientId = clientId;
  const sel = document.getElementById('clientFilterSelect');
  if (sel) sel.value = clientId;
  showPage('leads');
}

async function deactivateClient(clientId, e) {
  e?.stopPropagation();
  if (!confirm('Are you sure you want to change this client status?')) return;
  const res = await fetch(`${API}/api/clients/${clientId}`, { headers: headers() });
  const client = await res.json();
  const newStatus = client.status === 'active' ? 'inactive' : 'active';
  await fetch(`${API}/api/clients/${clientId}`, {
    method: 'PUT', headers: headers(),
    body: JSON.stringify({ status: newStatus })
  });
  loadClients();
}

async function openClientEdit(clientId, e) {
  e?.stopPropagation();
  currentClientEditId = clientId;
  openModal('clientModal');
  document.getElementById('clientModalMsg').innerHTML = '';

  const res = await fetch(`${API}/api/clients/${clientId}`, { headers: headers() });
  const client = await res.json();

  document.getElementById('clientModalTitle').textContent = `Edit Client: ${client.name}`;
  if (document.getElementById('edit_name')) document.getElementById('edit_name').value = client.name || '';
  if (document.getElementById('edit_status')) document.getElementById('edit_status').value = client.status || 'active';
  if (document.getElementById('edit_business_type')) document.getElementById('edit_business_type').value = client.business_type || '';
  if (document.getElementById('edit_location')) document.getElementById('edit_location').value = client.location || '';
  if (document.getElementById('edit_contact_person')) document.getElementById('edit_contact_person').value = client.contact_person || '';
  if (document.getElementById('edit_contact_phone')) document.getElementById('edit_contact_phone').value = client.contact_phone || '';
  if (document.getElementById('edit_contact_email')) document.getElementById('edit_contact_email').value = client.contact_email || '';
  if (document.getElementById('edit_login_id')) document.getElementById('edit_login_id').value = client.login_id || '';
  if (document.getElementById('edit_password')) document.getElementById('edit_password').value = ''; // Blank unless resetting
  if (document.getElementById('edit_n8n_webhook_url')) document.getElementById('edit_n8n_webhook_url').value = client.n8n_webhook_url || '';
}

async function saveClientEdit() {
  const name = document.getElementById('edit_name')?.value.trim();
  const status = document.getElementById('edit_status')?.value;
  const business_type = document.getElementById('edit_business_type')?.value.trim();
  const location = document.getElementById('edit_location')?.value.trim();
  const contact_person = document.getElementById('edit_contact_person')?.value.trim();
  const contact_phone = document.getElementById('edit_contact_phone')?.value.trim();
  const contact_email = document.getElementById('edit_contact_email')?.value.trim();
  const login_id = document.getElementById('edit_login_id')?.value.trim();
  const password = document.getElementById('edit_password')?.value.trim();
  const n8n_webhook_url = document.getElementById('edit_n8n_webhook_url')?.value.trim();

  const payload = {
    name, status, business_type, location, contact_person,
    contact_phone, contact_email, login_id, n8n_webhook_url
  };

  if (password) {
    payload.verify_token = password;
  }

  try {
    const res = await fetch(`${API}/api/clients/${currentClientEditId}`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal('clientModal');
      loadClients();
    } else {
      const data = await res.json();
      document.getElementById('clientModalMsg').innerHTML = `<div class="alert alert-error">❌ ${data.error || 'Error saving changes.'}</div>`;
    }
  } catch (e) {
    document.getElementById('clientModalMsg').innerHTML = '<div class="alert alert-error">❌ Server connection error.</div>';
  }
}

// ══════════════════════════════════
//  ONBOARDING / ADD CLIENT
// ══════════════════════════════════

async function submitClient(e) {
  if (e) e.preventDefault();
  
  const msgDiv = document.getElementById('onboardingMsg');
  if (msgDiv) msgDiv.innerHTML = '';

  const btn = document.getElementById('submitClientBtn') || document.querySelector('#page-onboarding .btn-primary');
  const originalBtnText = btn ? btn.innerHTML : '🚀 Create Client Account';

  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const name = getVal('ob_name');
  let login_id = getVal('ob_login_id');
  let password = getVal('ob_password');
  const contact_email = getVal('ob_contact_email');
  const contact_phone = getVal('ob_contact_phone');

  // Smart fallbacks so user is NEVER blocked by missing fields
  if (!login_id) {
    login_id = contact_email || contact_phone || name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
  if (!password) {
    password = 'Client@' + Math.floor(1000 + Math.random() * 9000);
  }

  if (!name) {
    if (msgDiv) msgDiv.innerHTML = '<div class="alert alert-error">❌ Business / Company Name is required.</div>';
    alert('Please enter a Business / Company Name');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating Client Account...';
  }

  if (msgDiv) msgDiv.innerHTML = '<div class="alert alert-info"><span class="spinner"></span> Creating client account...</div>';

  const payload = {
    name,
    business_type: getVal('ob_business_type') || 'Real Estate Agency',
    location: getVal('ob_location'),
    contact_person: getVal('ob_contact_person'),
    contact_phone,
    contact_email,
    login_id,
    verify_token: password
  };

  try {
    const res = await fetch(`${API}/api/clients`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    
    if (res.ok && (data.success || data.client)) {
      if (msgDiv) msgDiv.innerHTML = `<div class="alert alert-success">✅ Client "${name}" created successfully! (Login ID: <strong>${login_id}</strong>, Password: <strong>${password}</strong>)</div>`;
      alert(`✅ Client "${name}" created successfully!\n\nLogin ID: ${login_id}\nPassword: ${password}`);
      
      setTimeout(() => {
        ['ob_name', 'ob_location', 'ob_contact_person', 'ob_contact_phone', 'ob_contact_email', 'ob_login_id', 'ob_password']
          .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        if (msgDiv) msgDiv.innerHTML = '';
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = originalBtnText;
        }
        loadClients();
        showPage('clients');
      }, 1500);
    } else {
      const errText = data.error || 'Failed to create client.';
      if (msgDiv) msgDiv.innerHTML = `<div class="alert alert-error">❌ Error: ${errText}</div>`;
      alert(`❌ Error: ${errText}`);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
      }
    }
  } catch (e) {
    console.error('submitClient error:', e);
    if (msgDiv) msgDiv.innerHTML = `<div class="alert alert-error">❌ Could not connect to server: ${e.message}</div>`;
    alert(`❌ Could not connect to server: ${e.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
    }
  }
}

// ══════════════════════════════════
//  MODALS
// ══════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ══════════════════════════════════
//  UTILITY FUNCTIONS
// ══════════════════════════════════
function scoreBadge(score) {
  const map = {
    HOT: 'badge-hot', WARM: 'badge-warm', COLD: 'badge-cold', UNKNOWN: 'badge-unknown'
  };
  const emoji = { HOT: '🔥', WARM: '🟡', COLD: '🔵', UNKNOWN: '❓' };
  const s = (score || 'UNKNOWN').toUpperCase();
  return `<span class="badge ${map[s] || 'badge-unknown'}">${emoji[s] || ''}${s}</span>`;
}

function stageBadge(stage) {
  const map = {
    new: 'badge-new', qualified: 'badge-qualified',
    site_visit_scheduled: 'badge-visit', call_scheduled: 'badge-visit',
    converted: 'badge-converted', lost: 'badge-lost'
  };
  const label = {
    new: 'New', qualified: 'Qualified', site_visit_scheduled: '📅 Visit',
    call_scheduled: '📞 Call', converted: '✅ Converted', lost: '❌ Lost'
  };
  const s = stage || 'new';
  return `<span class="badge ${map[s] || 'badge-new'}">${label[s] || s}</span>`;
}

function statusBadge(status) {
  const map = { active: 'badge-active', inactive: 'badge-inactive', setup: 'badge-unknown' };
  return `<span class="badge ${map[status] || 'badge-unknown'}">${status}</span>`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

async function copyText(elemId, btn) {
  const text = document.getElementById(elemId).textContent;
  await navigator.clipboard.writeText(text);
  btn.textContent = '✅ Copied!';
  btn.classList.add('copied');
  setTimeout(() => { btn.textContent = '📋 Copy'; btn.classList.remove('copied'); }, 2000);
}

let forgotClientId = '';

function showForgotPassword(e) {
  e?.preventDefault();
  document.getElementById('forgotEmailInput').value = '';
  document.getElementById('forgotModalMsg').innerHTML = '';
  document.getElementById('forgotStep1').style.display = 'block';
  document.getElementById('forgotStep2').style.display = 'none';
  forgotClientId = '';
  openModal('forgotPasswordModal');
}

async function verifyForgotIdentity() {
  const identifier = document.getElementById('forgotEmailInput').value.trim();
  if (!identifier) {
    document.getElementById('forgotModalMsg').innerHTML = '<div class="alert alert-error">❌ Identifier fill karna zaroori hai.</div>';
    return;
  }

  const msgDiv = document.getElementById('forgotModalMsg');
  msgDiv.innerHTML = '<span class="spinner"></span> Verifying identity...';

  try {
    const res = await fetch(`${API}/api/auth/forgot-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    });
    const data = await res.json();
    if (res.ok && data.clientId) {
      forgotClientId = data.clientId;
      msgDiv.innerHTML = `<div class="alert alert-success">✅ Identity verified for <strong>${data.name}</strong>. Set your new password below.</div>`;
      document.getElementById('forgotStep1').style.display = 'none';
      document.getElementById('forgotStep2').style.display = 'block';
      document.getElementById('forgotNewPasswordInput').value = '';
    } else {
      msgDiv.innerHTML = `<div class="alert alert-error">❌ ${data.error || 'Identity details mismatch.'}</div>`;
    }
  } catch (e) {
    msgDiv.innerHTML = '<div class="alert alert-error">❌ Connection error. Please try again.</div>';
  }
}

async function resetForgotNewPassword() {
  const newPassword = document.getElementById('forgotNewPasswordInput').value.trim();
  if (!newPassword) {
    document.getElementById('forgotModalMsg').innerHTML = '<div class="alert alert-error">❌ Password text cannot be empty.</div>';
    return;
  }

  const msgDiv = document.getElementById('forgotModalMsg');
  msgDiv.innerHTML = '<span class="spinner"></span> Resetting your password...';

  try {
    const res = await fetch(`${API}/api/auth/forgot-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: forgotClientId, password: newPassword })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      msgDiv.innerHTML = '<div class="alert alert-success">✅ Password has been reset successfully! You can login now.</div>';
      document.getElementById('forgotStep2').style.display = 'none';
      setTimeout(() => {
        closeModal('forgotPasswordModal');
      }, 2500);
    } else {
      msgDiv.innerHTML = `<div class="alert alert-error">❌ ${data.error || 'Failed to update password.'}</div>`;
    }
  } catch (e) {
    msgDiv.innerHTML = '<div class="alert alert-error">❌ Connection error. Please try again.</div>';
  }
}

async function generateSystemPrompt(descId, targetId, btn) {
  const descVal = document.getElementById(descId).value.trim();
  if (!descVal) {
    alert('Please describe your client first (e.g. Client Name, Focus, Tone).');
    return;
  }

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';

  try {
    const res = await fetch(`${API}/api/clients/generate-prompt`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ description: descVal })
    });
    const data = await res.json();
    if (res.ok && data.prompt) {
      document.getElementById(targetId).value = data.prompt;
      // Clear description box after success
      document.getElementById(descId).value = '';
    } else {
      alert('Error: ' + (data.error || 'Failed to generate prompt. Please try again.'));
    }
  } catch (e) {
    console.error('Error generating prompt:', e);
    alert('Failed to connect to prompt generation service.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function generateRagFromSheet(btn) {
  const url = document.getElementById('ob_sheet_url').value.trim();
  if (!url) {
    alert('Please enter a Google Sheets URL first.');
    return;
  }

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';

  try {
    const res = await fetch('/api/tools/parse-sheet', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ sheetUrl: url })
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('ob_knowledge_base').value = JSON.stringify(data.properties, null, 2);
      alert(`✅ Successfully generated RAG for ${data.count} properties from Google Sheets!`);
    } else {
      alert(`❌ RAG generation failed: ${data.error}`);
    }
  } catch (e) {
    alert('❌ Could not connect to server.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function deleteClient(clientId, e) {
  e?.stopPropagation();
  if (!confirm('Are you sure you want to PERMANENTLY delete this client? This will delete all their leads and chat histories.')) return;
  try {
    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'DELETE',
      headers: headers()
    });
    if (res.ok) {
      loadClients();
    } else {
      alert('Failed to delete client');
    }
  } catch (err) {
    alert('Error deleting client');
  }
}

async function openChatOnly(leadId, e) {
  e?.stopPropagation(); // Prevent opening the lead detail modal
  currentLeadId = leadId;
  openModal('convoModal');
  
  const chatDiv = document.getElementById('convoModalChatHistory');
  chatDiv.innerHTML = '<div style="text-align:center;padding:40px;"><span class="spinner"></span> Loading conversation...</div>';

  try {
    const res = await fetch(`${API}/api/leads/${leadId}`, { headers: headers() });
    const { lead, conversation } = await res.json();

    document.getElementById('convoModalTitle').textContent = `Chat: ${lead.name || 'Unknown Lead'}`;
    document.getElementById('convoModalPhone').textContent = `📱 ${lead.phone}`;

    if (!conversation || conversation.length === 0) {
      chatDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No chat history found.</div>';
      return;
    }

    chatDiv.innerHTML = conversation.map(m => {
      const isUser = m.role === 'user';
      let cleanText = '';
      if (m.parts && m.parts[0]) {
        cleanText = m.parts[0].text || '';
        if (cleanText.includes('[STATE]')) {
          cleanText = cleanText.split('[STATE]')[0].trim();
        }
      }
      return `
        <div class="chat-bubble ${isUser ? 'user' : 'bot'}" style="
          max-width: 80%;
          padding: 12px;
          border-radius: 12px;
          margin-bottom: 8px;
          line-height: 1.4;
          font-size: 13px;
          align-self: ${isUser ? 'flex-end' : 'flex-start'};
          background: ${isUser ? 'var(--primary-dark)' : 'var(--bg-surface)'};
          color: ${isUser ? '#ffffff' : 'var(--text)'};
          border: ${isUser ? 'none' : '1px solid var(--border)'};
        ">
          ${escapeHtml(cleanText)}
        </div>
      `;
    }).join('');
    
    // Auto-scroll to bottom
    const modalBody = chatDiv.parentElement;
    modalBody.scrollTop = modalBody.scrollHeight;

  } catch (err) {
    chatDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--alert-error)">Error loading conversation.</div>';
  }
}

async function archiveClient(clientId, e) {
  e?.stopPropagation();
  if (!confirm('Are you sure you want to archive this client? They will be hidden from the active clients list but their data will remain completely intact.')) return;
  try {
    const res = await fetch(`${API}/api/clients/${clientId}/archive`, {
      method: 'POST',
      headers: headers()
    });
    if (res.ok) {
      loadClients();
    } else {
      alert('Failed to archive client');
    }
  } catch (err) {
    alert('Error archiving client');
  }
}

async function unarchiveClient(clientId, e) {
  e?.stopPropagation();
  try {
    const fetchRes = await fetch(`${API}/api/clients/${clientId}`, { headers: headers() });
    const client = await fetchRes.json();
    
    let bType = client.business_type || 'Business';
    bType = bType.replace(' [ARCHIVED]', '');

    const res = await fetch(`${API}/api/clients/${clientId}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ status: 'active', business_type: bType })
    });
    if (res.ok) {
      loadClients();
    } else {
      alert('Failed to activate client');
    }
  } catch (err) {
    alert('Error activating client');
  }
}

function getStages() {
  const saved = localStorage.getItem('custom_stages');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  return [
    { id: 'new', label: 'New' },
    { id: 'qualified', label: 'Qualified' },
    { id: 'site_visit_scheduled', label: 'Visit Scheduled' },
    { id: 'call_scheduled', label: 'Call Scheduled' },
    { id: 'converted', label: 'Converted' },
    { id: 'lost', label: 'Lost' }
  ];
}

function saveStages(stages) {
  localStorage.setItem('custom_stages', JSON.stringify(stages));
  populateStageFilters();
}

function openStagesModal() {
  openModal('stagesModal');
  renderStagesList();
}

function renderStagesList() {
  const stages = getStages();
  const container = document.getElementById('stagesListContainer');
  container.innerHTML = stages.map(s => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:var(--bg-surface); border:1px solid var(--border); border-radius:4px; margin-bottom:4px;">
      <span style="font-size:13px; font-weight:600; color:var(--text);">${s.label} <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">(${s.id})</span></span>
      <button type="button" class="btn btn-danger btn-sm" onclick="deleteCustomStage('${s.id}')" style="padding:2px 6px; font-size:11px;">✕</button>
    </div>
  `).join('');
}

function addNewCustomStage() {
  const label = document.getElementById('newStageLabelInput').value.trim();
  if (!label) return;
  const id = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const stages = getStages();
  if (stages.some(s => s.id === id)) {
    alert('Stage already exists!');
    return;
  }
  stages.push({ id, label });
  saveStages(stages);
  renderStagesList();
  document.getElementById('newStageLabelInput').value = '';
}

function deleteCustomStage(id) {
  const stages = getStages().filter(s => s.id !== id);
  saveStages(stages);
  renderStagesList();
}

function populateStageFilters() {
  const stages = getStages();
  
  // Update stageFilter dropdown on Leads page
  const filter = document.getElementById('stageFilter');
  if (filter) {
    const val = filter.value;
    filter.innerHTML = `<option value="">All Stages</option>` + stages.map(s => `
      <option value="${s.id}">${s.label}</option>
    `).join('');
    filter.value = val;
  }
}

function toggleLeadEdit() {
  isEditingLead = !isEditingLead;
  renderLeadDetails(currentLeadData);
}

function cancelLeadEdit() {
  isEditingLead = false;
  renderLeadDetails(currentLeadData);
}

function addCustomFieldRow() {
  const container = document.getElementById('edit_custom_fields_container');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'custom-field-row';
  div.style.display = 'flex';
  div.style.gap = '8px';
  div.innerHTML = `
    <input type="text" class="custom-key" placeholder="Field Label" style="flex:1; padding:6px; font-size:12px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
    <input type="text" class="custom-val" placeholder="Value" style="flex:1; padding:6px; font-size:12px; background:var(--bg-surface); border:1px solid var(--border); color:var(--text); border-radius:4px;"/>
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding:4px 8px;">✕</button>
  `;
  container.appendChild(div);
}

async function saveLeadDetails() {
  const payload = {
    name: document.getElementById('edit_lead_name').value.trim(),
    phone: document.getElementById('edit_lead_phone').value.trim(),
    email: document.getElementById('edit_lead_email').value.trim(),
    budget: document.getElementById('edit_lead_budget').value.trim(),
    location: document.getElementById('edit_lead_location').value.trim(),
    property_type: document.getElementById('edit_lead_property_type').value.trim(),
    purpose: document.getElementById('edit_lead_purpose').value.trim(),
    timeline: document.getElementById('edit_lead_timeline').value.trim(),
    lead_score: document.getElementById('edit_lead_score').value,
    lead_stage: document.getElementById('edit_lead_stage').value,
    site_visit_date: document.getElementById('edit_lead_site_visit_date').value || null,
    site_visit_time: document.getElementById('edit_lead_site_visit_time').value || null,
    call_date: document.getElementById('edit_lead_call_date').value || null,
    call_time: document.getElementById('edit_lead_call_time').value || null,
    follow_up_date: document.getElementById('edit_lead_follow_up_date').value || null,
  };

  const notesText = document.getElementById('edit_lead_notes').value.trim();
  const alternate_phone = document.getElementById('edit_lead_alternate_phone').value.trim();
  
  const custom_fields = {};
  const rows = document.querySelectorAll('.custom-field-row');
  rows.forEach(row => {
    const key = row.querySelector('.custom-key').value.trim();
    const val = row.querySelector('.custom-val').value.trim();
    if (key) {
      custom_fields[key] = val;
    }
  });

  payload.notes = JSON.stringify({
    notesText,
    alternate_phone,
    custom_fields
  });

  try {
    const res = await fetch(`${API}/api/leads/${currentLeadId}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      isEditingLead = false;
      openLead(currentLeadId);
      loadLeads();
      loadDashboard();
    } else {
      alert('Failed to save lead details');
    }
  } catch (err) {
    alert('Error saving lead details');
  }
}

// ══════════════════════════════════
//  LEAD MANUAL CREATION & IMPORT/EXPORT
// ══════════════════════════════════

async function openAddLeadModal() {
  const form = document.getElementById('addLeadForm');
  if (form) form.reset();

  const stages = getStages();
  const stageSelect = document.getElementById('add_lead_stage');
  if (stageSelect) {
    stageSelect.innerHTML = stages.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
  }

  const role = localStorage.getItem('saas_role') || 'admin';
  const clientGroup = document.getElementById('addLeadClientSelectGroup');
  
  if (role === 'admin' && clientGroup) {
    clientGroup.style.display = 'block';
    try {
      const res = await fetch(`${API}/api/clients`, { headers: headers() });
      const clients = await res.json();
      const sel = document.getElementById('add_lead_client_id');
      sel.innerHTML = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (e) {
      console.error('Error loading clients for selector:', e);
    }
  } else if (clientGroup) {
    clientGroup.style.display = 'none';
  }

  openModal('addLeadModal');
}

async function submitNewLead(event) {
  event.preventDefault();
  
  const notesText = document.getElementById('add_lead_notes').value.trim();
  const notes = JSON.stringify({
    notesText,
    alternate_phone: '',
    custom_fields: {}
  });

  const payload = {
    name: document.getElementById('add_lead_name').value.trim(),
    phone: document.getElementById('add_lead_phone').value.trim(),
    email: document.getElementById('add_lead_email').value.trim() || null,
    budget: document.getElementById('add_lead_budget').value.trim() || null,
    location: document.getElementById('add_lead_location').value.trim() || null,
    property_type: document.getElementById('add_lead_property_type').value.trim() || null,
    purpose: document.getElementById('add_lead_purpose').value.trim() || null,
    timeline: document.getElementById('add_lead_timeline').value.trim() || null,
    lead_score: document.getElementById('add_lead_score').value,
    lead_stage: document.getElementById('add_lead_stage').value,
    notes: notes
  };

  const role = localStorage.getItem('saas_role') || 'admin';
  if (role === 'admin') {
    payload.client_id = document.getElementById('add_lead_client_id').value;
  }

  try {
    const res = await fetch(`${API}/api/leads`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal('addLeadModal');
      loadLeads();
      loadDashboard();
    } else {
      const err = await res.json();
      alert(`Failed to add lead: ${err.error || 'Unknown error'}`);
    }
  } catch (err) {
    alert('Error connecting to server.');
  }
}

async function openCSVImportModal() {
  const fileInput = document.getElementById('csvModalFileInput');
  if (fileInput) fileInput.value = '';

  const role = localStorage.getItem('saas_role') || 'admin';
  const clientGroup = document.getElementById('csvImportClientSelectGroup');
  
  if (role === 'admin' && clientGroup) {
    clientGroup.style.display = 'block';
    try {
      const res = await fetch(`${API}/api/clients`, { headers: headers() });
      const clients = await res.json();
      const sel = document.getElementById('csv_import_client_id');
      sel.innerHTML = clients.map(c => `<option value="${c.id}" ${c.id === selectedClientId ? 'selected' : ''}>${c.name}</option>`).join('');
    } catch (e) {
      console.error('Error loading clients for selector:', e);
    }
  } else if (clientGroup) {
    clientGroup.style.display = 'none';
  }

  openModal('csvImportModal');
}

async function submitCSVImport() {
  const fileInput = document.getElementById('csvModalFileInput');
  const file = fileInput ? fileInput.files[0] : null;
  if (!file) {
    alert('Please select a CSV file first.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    const leads = parseCSVText(text);
    if (!leads.length) {
      alert('No valid leads found in CSV. Make sure headers are matching.');
      return;
    }

    let client_id = '';
    const role = localStorage.getItem('saas_role') || 'admin';
    if (role === 'admin') {
      client_id = document.getElementById('csv_import_client_id').value;
    }

    try {
      const res = await fetch(`${API}/api/leads/bulk-import`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ leads, client_id })
      });
      if (res.ok) {
        const data = await res.json();
        alert(`✅ Successfully imported ${data.count} leads!`);
        closeModal('csvImportModal');
        loadLeads();
        loadDashboard();
      } else {
        const data = await res.json();
        alert(`❌ Import failed: ${data.error}`);
      }
    } catch (err) {
      alert('❌ Failed to connect to server.');
    }
  };
  reader.readAsText(file);
}

function parseCSVText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headersList = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
  const leads = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^["']|["']$/g, '').trim());
    if (values.length < headersList.length) continue;

    const lead = {};
    headersList.forEach((header, index) => {
      const val = values[index];
      if (header.includes('name')) lead.name = val;
      else if (header.includes('phone') || header.includes('mobile')) lead.phone = val;
      else if (header.includes('email')) lead.email = val;
      else if (header.includes('budget')) lead.budget = val;
      else if (header.includes('location')) lead.location = val;
      else if (header.includes('property') || header.includes('type')) lead.property_type = val;
      else if (header.includes('purpose')) lead.purpose = val;
      else if (header.includes('timeline')) lead.timeline = val;
      else if (header.includes('score')) lead.lead_score = val.toUpperCase();
      else if (header.includes('stage')) lead.lead_stage = val;
      else if (header.includes('notes') || header.includes('remark')) lead.notes = val;
    });

    if (lead.phone) {
      leads.push(lead);
    }
  }
  return leads;
}

async function exportLeadsCSV() {
  const search = document.getElementById('searchInput').value.trim();
  const score = document.getElementById('scoreFilter').value;
  const stage = document.getElementById('stageFilter').value;

  const params = new URLSearchParams();
  if (selectedClientId) params.set('client_id', selectedClientId);
  if (search) params.set('search', search);
  if (score) params.set('lead_score', score);
  if (stage) params.set('lead_stage', stage);
  params.set('limit', '5000');

  try {
    const res = await fetch(`${API}/api/leads?${params}`, { headers: headers() });
    const leads = await res.json();
    if (!leads.length) {
      alert('No leads to export.');
      return;
    }

    const headersList = ['Name', 'Phone', 'Email', 'Budget', 'Location', 'Property Type', 'Purpose', 'Timeline', 'Lead Score', 'Lead Stage', 'Notes', 'Created At'];
    let csvContent = headersList.join(',') + '\n';

    leads.forEach(l => {
      let notesText = '';
      try {
        const parsed = JSON.parse(l.notes);
        notesText = parsed?.notesText || l.notes || '';
      } catch (e) {
        notesText = l.notes || '';
      }

      const row = [
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${l.phone || ''}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.budget || '').replace(/"/g, '""')}"`,
        `"${(l.location || '').replace(/"/g, '""')}"`,
        `"${(l.property_type || '').replace(/"/g, '""')}"`,
        `"${(l.purpose || '').replace(/"/g, '""')}"`,
        `"${(l.timeline || '').replace(/"/g, '""')}"`,
        `"${l.lead_score || 'UNKNOWN'}"`,
        `"${l.lead_stage || 'new'}"`,
        `"${notesText.replace(/"/g, '""')}"`,
        `"${l.created_at || ''}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    alert('Failed to export leads.');
  }
}

function formatMatchedProjects(proj) {
  if (!proj) return '—';
  let arr = [];
  try {
    if (typeof proj === 'string') {
      arr = JSON.parse(proj);
    } else if (Array.isArray(proj)) {
      arr = proj;
    }
  } catch (e) {
    arr = [proj];
  }
  if (!Array.isArray(arr) || arr.length === 0) return '—';
  return arr.map(p => `<span class="badge" style="background:var(--bg-body); border:1px solid var(--border); color:var(--text); font-size:11px; margin-right:4px;">🏢 ${p}</span>`).join('');
}

// ══════════════════════════════════
//  REPORTS & ANALYTICS SECTION
// ══════════════════════════════════
let reportLeadsData = [];

async function initReportsPage() {
  const role = localStorage.getItem('saas_role') || 'admin';
  const cId = localStorage.getItem('saas_client_id') || '';
  const clientGroup = document.getElementById('reportClientSelectGroup');
  const clientSelect = document.getElementById('reportClientSelect');

  const stages = getStages();
  const stageSelect = document.getElementById('reportStageSelect');
  if (stageSelect) {
    stageSelect.innerHTML = '<option value="">All Stages</option>' + stages.map(s => `
      <option value="${s.id}">${s.label}</option>
    `).join('');
  }

  if (role === 'admin' && clientGroup && clientSelect) {
    clientGroup.style.display = 'block';
    try {
      const res = await fetch(`${API}/api/clients`, { headers: headers() });
      const clients = await res.json();
      clientSelect.innerHTML = '<option value="">All Clients</option>' + clients.map(c => `
        <option value="${c.id}" ${c.id === selectedClientId ? 'selected' : ''}>${c.name}</option>
      `).join('');
    } catch (e) {
      console.error('Error loading clients for reports selector:', e);
    }
  } else if (clientGroup) {
    clientGroup.style.display = 'none';
  }

  loadReports();
}

async function loadReports() {
  const role = localStorage.getItem('saas_role') || 'admin';
  const cId = localStorage.getItem('saas_client_id') || '';
  
  const clientSelect = document.getElementById('reportClientSelect');
  const targetClientId = role === 'admin' ? (clientSelect ? clientSelect.value : '') : cId;
  const stage = document.getElementById('reportStageSelect').value;
  const score = document.getElementById('reportScoreSelect').value;
  const fromDate = document.getElementById('reportFromDate').value;
  const toDate = document.getElementById('reportToDate').value;

  const params = new URLSearchParams();
  if (targetClientId) params.set('client_id', targetClientId);
  if (stage) params.set('lead_stage', stage);
  if (score) params.set('lead_score', score);
  params.set('limit', '5000');

  const tbody = document.getElementById('reportLeadsBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;"><span class="spinner"></span> Running Report...</td></tr>';

  try {
    const res = await fetch(`${API}/api/leads?${params}`, { headers: headers() });
    let leads = await res.json();

    if (fromDate) {
      const from = new Date(fromDate);
      leads = leads.filter(l => new Date(l.created_at) >= from);
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      leads = leads.filter(l => new Date(l.created_at) <= to);
    }

    reportLeadsData = leads;
    document.getElementById('reportLeadsCount').textContent = `${leads.length} Lead${leads.length !== 1 ? 's' : ''} Found`;

    if (!leads.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">No matching leads found. Adjust your filters and run again.</td></tr>';
      renderReportCharts([]);
      return;
    }

    tbody.innerHTML = leads.map(l => `
      <tr onclick="openLead('${l.id}')">
        <td>${l.name || '<em style="color:var(--text-muted)">Unknown</em>'}</td>
        <td>${l.phone}</td>
        <td>${l.budget || '—'}</td>
        <td>${l.location || '—'}</td>
        <td>${scoreBadge(l.lead_score)}</td>
        <td>${stageBadge(l.lead_stage)}</td>
        <td>${timeAgo(l.updated_at)}</td>
      </tr>
    `).join('');

    renderReportCharts(leads);

  } catch (err) {
    console.error('Error loading reports:', err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--alert-error)">Failed to fetch report data.</td></tr>';
  }
}

function renderReportCharts(leads) {
  const stages = getStages();
  const stageCounts = {};
  stages.forEach(s => stageCounts[s.id] = 0);
  leads.forEach(l => {
    if (stageCounts.hasOwnProperty(l.lead_stage)) {
      stageCounts[l.lead_stage]++;
    }
  });

  const maxStageCount = Math.max(...Object.values(stageCounts), 1);
  const stageChart = document.getElementById('reportStageChart');
  stageChart.innerHTML = stages.map(s => {
    const count = stageCounts[s.id] || 0;
    const percentage = Math.round((count / maxStageCount) * 100);
    return `
      <div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
          <span style="font-weight:600;">${s.label}</span>
          <span style="color:var(--text-secondary);">${count} (${leads.length ? Math.round((count/leads.length)*100) : 0}%)</span>
        </div>
        <div style="width:100%; height:12px; background:var(--bg-body); border:1px solid var(--border); border-radius:6px; overflow:hidden;">
          <div style="width:${percentage}%; height:100%; background:var(--primary); transition: width 0.5s ease-in-out;"></div>
        </div>
      </div>
    `;
  }).join('');

  const scores = ['HOT', 'WARM', 'COLD', 'UNKNOWN'];
  const scoreCounts = { HOT: 0, WARM: 0, COLD: 0, UNKNOWN: 0 };
  leads.forEach(l => {
    const sc = l.lead_score ? l.lead_score.toUpperCase() : 'UNKNOWN';
    if (scoreCounts.hasOwnProperty(sc)) {
      scoreCounts[sc]++;
    }
  });

  const scoreLabels = { HOT: '🔥 Hot', WARM: '🟡 Warm', COLD: '🔵 Cold', UNKNOWN: '❓ Unknown' };
  const scoreColors = { HOT: '#ef4444', WARM: '#f59e0b', COLD: '#3b82f6', UNKNOWN: 'var(--text-muted)' };
  
  const scoreChart = document.getElementById('reportScoreChart');
  scoreChart.innerHTML = scores.map(sc => {
    const count = scoreCounts[sc] || 0;
    const percentage = leads.length ? Math.round((count / leads.length) * 100) : 0;
    return `
      <div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
          <span style="font-weight:600;">${scoreLabels[sc]}</span>
          <span style="color:var(--text-secondary);">${count} (${percentage}%)</span>
        </div>
        <div style="width:100%; height:12px; background:var(--bg-body); border:1px solid var(--border); border-radius:6px; overflow:hidden;">
          <div style="width:${percentage}%; height:100%; background:${scoreColors[sc]}; transition: width 0.5s ease-in-out;"></div>
        </div>
      </div>
    `;
  }).join('');
}

function exportReportCSV() {
  if (!reportLeadsData.length) {
    alert('No data to export. Run a report first.');
    return;
  }

  const headersList = ['Name', 'Phone', 'Budget', 'Location', 'Lead Score', 'Lead Stage', 'Notes', 'Created At'];
  let csvContent = headersList.join(',') + '\n';

  reportLeadsData.forEach(l => {
    let notesText = '';
    try {
      const parsed = JSON.parse(l.notes);
      notesText = parsed?.notesText || l.notes || '';
    } catch (e) {
      notesText = l.notes || '';
    }

    const row = [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${l.phone || ''}"`,
      `"${(l.budget || '').replace(/"/g, '""')}"`,
      `"${(l.location || '').replace(/"/g, '""')}"`,
      `"${l.lead_score || 'UNKNOWN'}"`,
      `"${l.lead_stage || 'new'}"`,
      `"${notesText.replace(/"/g, '""')}"`,
      `"${l.created_at || ''}"`
    ];
    csvContent += row.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `report_export_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ══════════════════════════════════
//  TEAM MEMBERS SECTION (ROUND ROBIN)
// ══════════════════════════════════
let currentTeamClientId = '';

async function initTeamPage() {
  const role = localStorage.getItem('saas_role') || 'admin';
  const cId = localStorage.getItem('saas_client_id') || '';
  const clientCard = document.getElementById('teamClientSelectCard');
  const clientSelect = document.getElementById('teamClientSelect');

  if (role === 'admin' && clientCard && clientSelect) {
    clientCard.style.display = 'block';
    try {
      const res = await fetch(`${API}/api/clients`, { headers: headers() });
      const clients = await res.json();
      clientSelect.innerHTML = clients.map(c => `
        <option value="${c.id}" ${c.id === selectedClientId ? 'selected' : ''}>${c.name}</option>
      `).join('');
      currentTeamClientId = clientSelect.value || selectedClientId;
    } catch (e) {
      console.error('Error loading clients for team list:', e);
    }
  } else {
    if (clientCard) clientCard.style.display = 'none';
    currentTeamClientId = cId;
  }

  loadTeamForce();
}

async function loadTeamForce() {
  const role = localStorage.getItem('saas_role') || 'admin';
  if (role === 'admin') {
    currentTeamClientId = document.getElementById('teamClientSelect').value;
  }

  const tbody = document.getElementById('teamMembersBody');
  if (!currentTeamClientId) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">Please select a client account first.</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;"><span class="spinner"></span> Loading Team...</td></tr>';

  try {
    const res = await fetch(`${API}/api/clients/${currentTeamClientId}`, { headers: headers() });
    const client = await res.json();
    
    let team = [];
    if (typeof client.team_members === 'string') {
      try { team = JSON.parse(client.team_members); } catch (e) {}
    } else if (Array.isArray(client.team_members)) {
      team = client.team_members;
    }

    if (!Array.isArray(team) || team.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">No team members added yet. Leads will not be automatically assigned.</td></tr>';
      return;
    }

    tbody.innerHTML = team.map(m => `
      <tr>
        <td style="font-weight:600;">👤 ${m.name}</td>
        <td>${m.phone || '—'}</td>
        <td>${m.email || '—'}</td>
        <td style="font-weight:bold; color:var(--primary);">${m.assigned_count || 0}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteTeamMember('${m.name}')" style="padding:4px 8px;">Delete</button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Error fetching team:', err);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--alert-error)">Failed to load team data.</td></tr>';
  }
}

function openAddTeamMemberModal() {
  const form = document.getElementById('addTeamMemberForm');
  if (form) form.reset();
  openModal('addTeamMemberModal');
}

async function submitNewTeamMember(event) {
  event.preventDefault();
  if (!currentTeamClientId) return;

  const name = document.getElementById('team_member_name').value.trim();
  const phone = document.getElementById('team_member_phone').value.trim();
  const email = document.getElementById('team_member_email').value.trim();

  try {
    const fetchRes = await fetch(`${API}/api/clients/${currentTeamClientId}`, { headers: headers() });
    const client = await fetchRes.json();
    
    let team = [];
    if (typeof client.team_members === 'string') {
      try { team = JSON.parse(client.team_members); } catch (e) {}
    } else if (Array.isArray(client.team_members)) {
      team = client.team_members;
    }
    if (!Array.isArray(team)) team = [];

    if (team.some(m => m.name.toLowerCase() === name.toLowerCase())) {
      alert('A team member with this name already exists!');
      return;
    }

    team.push({
      name,
      phone,
      email,
      assigned_count: 0
    });

    const res = await fetch(`${API}/api/clients/${currentTeamClientId}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ team_members: team })
    });

    if (res.ok) {
      closeModal('addTeamMemberModal');
      loadTeamForce();
    } else {
      alert('Failed to save team member details.');
    }
  } catch (err) {
    console.error('Error adding team member:', err);
    alert('Could not connect to server.');
  }
}

async function deleteTeamMember(name) {
  if (!confirm(`Are you sure you want to remove ${name} from the team? Round Robin assignments will bypass them.`)) return;
  if (!currentTeamClientId) return;

  try {
    const fetchRes = await fetch(`${API}/api/clients/${currentTeamClientId}`, { headers: headers() });
    const client = await fetchRes.json();
    
    let team = [];
    if (typeof client.team_members === 'string') {
      try { team = JSON.parse(client.team_members); } catch (e) {}
    } else if (Array.isArray(client.team_members)) {
      team = client.team_members;
    }
    if (!Array.isArray(team)) team = [];

    const updatedTeam = team.filter(m => m.name.toLowerCase() !== name.toLowerCase());

    const res = await fetch(`${API}/api/clients/${currentTeamClientId}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ team_members: updatedTeam })
    });

    if (res.ok) {
      loadTeamForce();
    } else {
      alert('Failed to remove team member.');
    }
  } catch (err) {
    console.error('Error deleting team member:', err);
    alert('Could not connect to server.');
  }
}

// ══════════════════════════════════
//  SETTINGS & INTEGRATIONS LOGIC
// ══════════════════════════════════
let currentIntegrationsClientId = '';

async function initIntegrationsPage() {
  const role = localStorage.getItem('saas_role') || 'admin';
  const cId = localStorage.getItem('saas_client_id') || '';
  const msgDiv = document.getElementById('integrationsMsg');
  if (msgDiv) msgDiv.innerHTML = '';

  const group = document.getElementById('integrationsClientSelectGroup');
  const sel = document.getElementById('integrationsClientSelect');

  if (role === 'admin') {
    if (group) group.style.display = 'block';
    try {
      const res = await fetch(`${API}/api/clients`, { headers: headers() });
      const clients = await res.json();
      if (Array.isArray(clients) && clients.length) {
        sel.innerHTML = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        currentIntegrationsClientId = sel.value;
      }
    } catch (e) {}
  } else {
    if (group) group.style.display = 'none';
    currentIntegrationsClientId = cId;
  }

  loadIntegrationsSettings();
}

async function loadIntegrationsSettings() {
  const role = localStorage.getItem('saas_role') || 'admin';
  const sel = document.getElementById('integrationsClientSelect');
  if (role === 'admin' && sel) {
    currentIntegrationsClientId = sel.value;
  }

  try {
    const params = currentIntegrationsClientId ? `?client_id=${currentIntegrationsClientId}` : '';
    const res = await fetch(`${API}/api/settings/integrations${params}`, { headers: headers() });
    const data = await res.json();
    if (res.ok && data.success) {
      document.getElementById('n8nWebhookUrlInput').value = data.n8n_webhook_url || '';
    }
  } catch (e) {
    console.error('Error loading integrations settings:', e);
  }
}

async function saveIntegrationsSettings() {
  const msgDiv = document.getElementById('integrationsMsg');
  const n8n_webhook_url = document.getElementById('n8nWebhookUrlInput').value.trim();

  if (msgDiv) msgDiv.innerHTML = '<div class="alert alert-info"><span class="spinner"></span> Saving integration settings...</div>';

  try {
    const res = await fetch(`${API}/api/settings/integrations`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        client_id: currentIntegrationsClientId,
        n8n_webhook_url
      })
    });
    const data = await res.json();
    if (res.ok) {
      if (msgDiv) msgDiv.innerHTML = '<div class="alert alert-success">✅ Integration settings saved successfully!</div>';
    } else {
      if (msgDiv) msgDiv.innerHTML = `<div class="alert alert-error">❌ ${data.error || 'Failed to save settings.'}</div>`;
    }
  } catch (e) {
    if (msgDiv) msgDiv.innerHTML = '<div class="alert alert-error">❌ Connection error.</div>';
  }
}

async function testN8nWebhook() {
  const msgDiv = document.getElementById('integrationsMsg');
  const n8n_webhook_url = document.getElementById('n8nWebhookUrlInput').value.trim();

  if (!n8n_webhook_url) {
    if (msgDiv) msgDiv.innerHTML = '<div class="alert alert-error">❌ Please enter an n8n Webhook URL before testing.</div>';
    return;
  }

  if (msgDiv) msgDiv.innerHTML = '<div class="alert alert-info"><span class="spinner"></span> Sending test webhook to n8n...</div>';

  try {
    const res = await fetch(`${API}/api/settings/test-webhook`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ n8n_webhook_url })
    });
    const data = await res.json();
    if (res.ok) {
      if (msgDiv) msgDiv.innerHTML = `<div class="alert alert-success">${data.message || '✅ Test webhook sent successfully!'}</div>`;
    } else {
      if (msgDiv) msgDiv.innerHTML = `<div class="alert alert-error">❌ ${data.error || 'Test webhook failed.'}</div>`;
    }
  } catch (e) {
    if (msgDiv) msgDiv.innerHTML = '<div class="alert alert-error">❌ Could not trigger webhook test.</div>';
  }
}
