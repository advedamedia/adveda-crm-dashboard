# 📊 Adveda CRM Admin Dashboard

Standalone Admin Dashboard UI and REST API portal for **Adveda Media**.

This repository contains **ONLY** the CRM Admin Dashboard (UI, Analytics, Lead Management, Sorting, Bot Pause/Resume Toggle, Team Management & REST API) with **ZERO Chatbot / Webhook code**.

---

## 🚀 Features

- 📊 **Real-time Analytics**: Total Leads, HOT/WARM/COLD Leads, Scheduled Site Visits, Conversion Rates.
- 👥 **Lead Management**: Filter by stage, lead score, search by name/phone, column-based sorting.
- 💬 **Live Conversation History**: View full chat history between customer and AI.
- ⏸️ **Manual Human Takeover Toggle**: One-click **Pause Bot / Resume Bot** toggle for live human agent intervention.
- 🏢 **Multi-Tenant Client Portal**: Separate login for Admin and individual Clients.

---

## 🛠️ Project Structure

```
adveda-crm-dashboard/
├── public/
│   ├── index.html   # Main Dashboard Single Page Application (SPA) Layout
│   ├── app.js       # Dashboard Frontend Logic & API Handlers
│   └── style.css    # Admin Dashboard Styling & UI Theme
├── server.js        # Dedicated CRM REST API Backend Server
├── package.json     # Node.js Dependencies
├── .env.example     # Environment Variables Template
└── README.md        # Documentation
```

---

## 💻 Local Setup & Running

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file based on `.env.example`:
   ```env
   SUPABASE_URL=https://xsgehxuyegwpuucamaec.supabase.co
   SUPABASE_KEY=your_supabase_anon_key
   ADMIN_PASSWORD=PotentialInfinity@2026
   PORT=3000
   ```

3. **Start the Dashboard Server**:
   ```bash
   npm start
   ```

4. **Access in Browser**:
   Open [http://localhost:3000](http://localhost:3000)
