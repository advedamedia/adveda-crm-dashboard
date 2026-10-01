// server.js - Adveda CRM Admin Dashboard Backend Server
// Standalone REST API server for https://dashboard.advedamedia.com/
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Serve static dashboard files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Admin specific dashboard route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'PotentialInfinity@2026';

// Supabase client initialization
const ws = require('ws');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || '',
  {
    auth: { persistSession: false },
    realtime: { transport: ws }
  }
);

// In-memory store for bot_paused state
const pausedLeadIds = new Set();

function isBotPaused(lead) {
  if (!lead) return false;
  if (pausedLeadIds.has(lead.id)) return true;
  if (lead.bot_paused === true) return true;
  return false;
}

async function setBotPaused(leadId, isPaused) {
  if (isPaused) {
    pausedLeadIds.add(leadId);
  } else {
    pausedLeadIds.delete(leadId);
  }
  try {
    await supabase
      .from('leads')
      .update({ bot_paused: isPaused, updated_at: new Date().toISOString() })
      .eq('id', leadId);
  } catch (e) {
    // Ignore if column is missing from DB schema
  }
}

// Admin / Client Authentication Middleware
async function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token === ADMIN_PASSWORD) {
    req.user = { role: 'admin' };
    return next();
  }

  const activeToken = token || req.query.token;
  if (activeToken === ADMIN_PASSWORD) {
    req.user = { role: 'admin' };
    return next();
  }

  if (activeToken && activeToken.startsWith('CLIENT_TOKEN:')) {
    const clientId = activeToken.split(':')[1];
    req.user = { role: 'client', clientId };
    return next();
  }
  
  return res.status(401).json({ error: 'Unauthorized' });
}

// ─────────────────────────────────────────────
//  AUTHENTICATION ENDPOINTS
// ─────────────────────────────────────────────

// POST /api/auth — Admin & Client Login
app.post('/api/auth', async (req, res) => {
  const { password, identifier, isAdmin } = req.body;

  if (isAdmin) {
    if (password === ADMIN_PASSWORD) {
      return res.json({ success: true, token: ADMIN_PASSWORD, role: 'admin' });
    }
    return res.status(401).json({ error: 'Invalid admin password' });
  }

  // Client authentication check
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Login ID / Phone / Email and Password are required' });
  }

  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*');

    if (error || !clients) return res.status(401).json({ error: 'Invalid credentials' });

    const cleanId = identifier.replace(/[^0-9]/g, '');
    const searchStr = identifier.trim().toLowerCase();

    const client = clients.find(c => {
      if (c.status === 'archived' || c.status === 'inactive') return false;
      const passMatch = c.verify_token === password;

      const cleanWa = (c.whatsapp_number || '').replace(/[^0-9]/g, '');
      const cleanPhone = (c.contact_phone || '').replace(/[^0-9]/g, '');
      const clientEmail = (c.contact_email || '').trim().toLowerCase();
      const clientLoginId = (c.login_id || '').trim().toLowerCase();

      const identifierMatches = (
        (clientLoginId && clientLoginId === searchStr) ||
        (clientEmail && clientEmail === searchStr) ||
        (cleanId && cleanWa.endsWith(cleanId)) || 
        (cleanId && cleanPhone.endsWith(cleanId)) ||
        identifier === c.phone_number_id
      );

      return passMatch && identifierMatches;
    });

    if (client) {
      return res.json({ 
        success: true, 
        token: `CLIENT_TOKEN:${client.id}`, 
        role: 'client', 
        clientId: client.id, 
        clientName: client.name 
      });
    }

    return res.status(401).json({ error: 'Invalid login details or password' });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-verify
app.post('/api/auth/forgot-verify', async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) return res.status(400).json({ error: 'Identifier required' });

  try {
    const { data: clients, error } = await supabase.from('clients').select('id, name, contact_email, contact_phone, whatsapp_number, login_id');
    if (error || !clients) return res.status(404).json({ error: 'Client not found' });

    const searchStr = identifier.trim().toLowerCase();
    const cleanId = identifier.replace(/[^0-9]/g, '');

    const client = clients.find(c => {
      const clientEmail = (c.contact_email || '').trim().toLowerCase();
      const clientLoginId = (c.login_id || '').trim().toLowerCase();
      const cleanWa = (c.whatsapp_number || '').replace(/[^0-9]/g, '');
      const cleanPhone = (c.contact_phone || '').replace(/[^0-9]/g, '');

      return (
        (clientLoginId && clientLoginId === searchStr) ||
        (clientEmail && clientEmail === searchStr) ||
        (cleanId && cleanWa.endsWith(cleanId)) ||
        (cleanId && cleanPhone.endsWith(cleanId))
      );
    });

    if (client) {
      return res.json({ success: true, clientId: client.id, name: client.name });
    }
    return res.status(404).json({ error: 'No client matching provided email or phone' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/forgot-reset
app.post('/api/auth/forgot-reset', async (req, res) => {
  const { clientId, password } = req.body;
  if (!clientId || !password) return res.status(400).json({ error: 'Client ID and new password required' });

  try {
    const { error } = await supabase
      .from('clients')
      .update({ verify_token: password })
      .eq('id', clientId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  CLIENT MANAGEMENT APIs
// ─────────────────────────────────────────────

// GET /api/clients — List clients
app.get('/api/clients', adminAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const showArchived = req.query.show_archived === 'true';

  let query = supabase.from('clients').select('*').order('created_at', { ascending: false });
  if (!showArchived) {
    query = query.neq('status', 'archived');
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// GET /api/clients/:id — Get client detail
app.get('/api/clients/:id', adminAuth, async (req, res) => {
  if (req.user.role === 'client' && req.user.clientId !== req.params.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Client not found' });
  res.json(data);
});

// POST /api/clients — Create new client
app.post('/api/clients', adminAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const {
    name, business_type, contact_person, contact_phone, contact_email,
    location, login_id, verify_token, n8n_webhook_url
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Client/Business name is required' });
  }

  const defaultPassword = verify_token || req.body.password || 'adveda123';
  const defaultPhoneId = req.body.phone_number_id || login_id || contact_phone || `client_${Date.now()}`;

  const payload = {
    name,
    business_type: business_type || 'Real Estate',
    contact_person: contact_person || '',
    contact_phone: contact_phone || '',
    contact_email: contact_email || '',
    location: location || '',
    login_id: login_id || contact_email || contact_phone || name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    verify_token: defaultPassword,
    n8n_webhook_url: n8n_webhook_url || '',
    status: 'active',
    phone_number_id: defaultPhoneId,
    whatsapp_number: contact_phone || '',
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('clients')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Error creating client:', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, client: data });
});

// PUT /api/clients/:id — Update client details
app.put('/api/clients/:id', adminAuth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.clientId !== req.params.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const allowed = [
    'name', 'business_type', 'contact_person', 'contact_phone', 'contact_email',
    'location', 'login_id', 'verify_token', 'n8n_webhook_url', 'status', 'whatsapp_number'
  ];

  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, client: data });
});

// POST /api/clients/:id/archive — Archive a client
app.post('/api/clients/:id/archive', adminAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const { data, error } = await supabase
    .from('clients')
    .update({ status: 'archived' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, client: data });
});

// DELETE /api/clients/:id — Permanently delete client
app.delete('/api/clients/:id', adminAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const { error } = await supabase.from('clients').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true });
});

// ─────────────────────────────────────────────
//  LEAD MANAGEMENT APIs
// ─────────────────────────────────────────────

// GET /api/leads — List leads with optional filters
app.get('/api/leads', adminAuth, async (req, res) => {
  const { client_id, lead_score, lead_stage, search, limit = 100 } = req.query;

  let query = supabase
    .from('leads')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(parseInt(limit));

  if (req.user.role === 'client') {
    query = query.eq('client_id', req.user.clientId);
  } else if (client_id) {
    query = query.eq('client_id', client_id);
  }

  if (lead_score) query = query.eq('lead_score', lead_score.toUpperCase());
  if (lead_stage) query = query.eq('lead_stage', lead_stage);
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const enriched = (data || []).map(lead => ({
    ...lead,
    bot_paused: isBotPaused(lead),
    assigned_to: lead.assigned_to || null
  }));

  res.json(enriched);
});

// GET /api/leads/:id — Get lead detail + conversation history
app.get('/api/leads/:id', adminAuth, async (req, res) => {
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Lead not found' });

  if (req.user.role === 'client' && lead.client_id !== req.user.clientId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { data: convo } = await supabase
    .from('conversations')
    .select('messages, updated_at')
    .eq('lead_id', req.params.id)
    .single();

  const enrichedLead = {
    ...lead,
    bot_paused: isBotPaused(lead),
    assigned_to: lead.assigned_to || null
  };

  res.json({ lead: enrichedLead, conversation: convo?.messages || [] });
});

// PUT /api/leads/:id — Update lead
app.put('/api/leads/:id', adminAuth, async (req, res) => {
  const { data: lead } = await supabase.from('leads').select('client_id').eq('id', req.params.id).single();
  if (lead && req.user.role === 'client' && lead.client_id !== req.user.clientId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const allowedFields = [
    'name', 'phone', 'email', 'budget', 'location', 'property_type', 'purpose', 'timeline',
    'notes', 'lead_stage', 'follow_up_date', 'site_visit_date', 'site_visit_time', 'call_date', 'call_time', 'lead_score'
  ];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const enrichedLead = {
    ...data,
    bot_paused: isBotPaused(data),
    assigned_to: data?.assigned_to || null
  };
  res.json({ success: true, lead: data });
});

// PUT /api/leads/:id/pause-bot
app.put('/api/leads/:id/pause-bot', adminAuth, async (req, res) => {
  const { paused } = req.body;
  await setBotPaused(req.params.id, paused === true);
  res.json({ success: true, bot_paused: paused === true });
});

// POST /api/leads — Create a single lead manually
app.post('/api/leads', adminAuth, async (req, res) => {
  const { client_id, name, phone, email, budget, location, property_type, purpose, timeline, lead_score } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  const targetClientId = req.user.role === 'client' ? req.user.clientId : client_id;

  const { data, error } = await supabase
    .from('leads')
    .insert({
      client_id: targetClientId,
      name: name || 'Manual Lead',
      phone,
      email,
      budget,
      location,
      property_type,
      purpose,
      timeline,
      lead_score: lead_score || 'UNKNOWN',
      lead_stage: 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, lead: data });
});

// ─────────────────────────────────────────────
//  DASHBOARD ANALYTICS APIs
// ─────────────────────────────────────────────

// GET /api/dashboard/stats — Aggregated dashboard statistics
app.get('/api/dashboard/stats', adminAuth, async (req, res) => {
  const { client_id } = req.query;
  let query = supabase.from('leads').select('lead_score, lead_stage, site_visit_date, call_date');

  if (req.user.role === 'client') {
    query = query.eq('client_id', req.user.clientId);
  } else if (client_id) {
    query = query.eq('client_id', client_id);
  }

  const { data: leads, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const today = new Date().toISOString().split('T')[0];

  const stats = {
    total_leads: (leads || []).length,
    hot_leads: (leads || []).filter(l => l.lead_score === 'HOT').length,
    warm_leads: (leads || []).filter(l => l.lead_score === 'WARM').length,
    cold_leads: (leads || []).filter(l => l.lead_score === 'COLD').length,
    today_visits: (leads || []).filter(l => l.site_visit_date === today).length,
    site_visit_scheduled: (leads || []).filter(l => l.lead_stage === 'site_visit_scheduled').length,
    converted: (leads || []).filter(l => l.lead_stage === 'converted').length
  };

  res.json(stats);
});

// ─────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 Adveda CRM Admin Dashboard running on port ${PORT}`);
  console.log(`📊 Dashboard UI: http://localhost:${PORT}\n`);
});
