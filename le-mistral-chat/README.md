<div align="center">

# 🐱 Le Mistral Chat – Complete Setup Guide

Pixel-perfect, multi-modal Mistral client with eval tools, dashboards, custom prompts, and Supabase-powered persistence.  
This README is intentionally **ultra detailed** so absolutely anyone can bring the project to life locally.

</div>

---

## ✨ Highlights

- **Conversational core**: Streaming Mistral replies, attachments, stop button, audio transcripts, auto-titled sessions.
- **Multi-modal**: PDF/DOC/TXT/image uploads, Pixtral image generation, built-in web search toggle.
- **Prompt presets**: Friendly UI to preview/select presets plus Supabase-backed custom prompts (save/delete).
- **Ops tooling**: `/dashboard` for metrics charts and `/eval` to compare models side-by-side.
- **Retro aesthetic**: Tailwind + Shadcn components styled like a modern pixel UI.

---

## 🧱 Stack Overview

| Layer | Tech |
| --- | --- |
| Framework | Vite + React 18 + TypeScript |
| Styling | Tailwind CSS, Shadcn UI, Lucide icons |
| Backend APIs | Vercel functions hitting `api.mistral.ai` |
| Persistence | Supabase (Auth, Postgres, Storage) |
| Charts & metrics | `recharts`, localStorage cache |

---

## 📦 Repository Layout

```
├── api/                 # Vercel serverless endpoints (chat, generate-image, etc.)
├── public/              # Static assets
├── src/
│   ├── components/      # Composer, Sidebar, dialogs, etc.
│   ├── contexts/        # Supabase Auth provider
│   ├── hooks/           # Scroll, toast, etc.
│   ├── lib/             # API clients, metrics store, system prompt helpers
│   ├── pages/           # Routes (Index, Dashboard, Eval, NotFound)
│   ├── types/, utils/   # Shared TS definitions
├── supabase/schema.sql  # Run once in Supabase to create tables & policies
├── package.json         # Scripts + deps
└── README.md            # You are here
```

---

## ✅ Requirements

1. Node.js 18+ (use nvm/Volta if possible)
2. pnpm (recommended) or npm
3. Supabase account/project (free tier works)
4. Mistral API key (https://auth.mistral.ai)

---

## ⚙️ Environment Setup

1. **Clone**
   ```bash
   git clone https://github.com/your-user/le-mistral-chat.git
   cd le-mistral-chat
   ```

2. **Install deps**
   ```bash
   pnpm install   # or npm install
   ```

3. **Create `.env.local`**
   ```bash
   cp .env .env.local
   ```
   Edit `.env.local` with **your** keys:
   ```ini
   MISTRAL_API_KEY=sk-your-mistral-key

   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=ey...

   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=ey...   # Needed for profile pics + prompts
   ```

4. **Run Supabase schema**
   - Open Supabase dashboard → SQL → paste entire `supabase/schema.sql`.
   - Execute once. It creates:
     - `chat_sessions`, `chat_messages`, `system_prompts`
     - Storage bucket `profile-pictures`
     - Row-level security policies

   Without this you’ll see 404/409 errors from Supabase REST.

5. **(Optional) Extra features**
   - Document libraries/websearch toggles already wired in UI.  
   - Customize as needed before publishing.

---

## ▶️ Start the App Locally

```bash
# Option 1 – plain Vite dev server
pnpm run dev

# Option 2 – Vercel dev (if using vercel.json / serverless)
npx vercel dev --listen 127.0.0.1
```

Open the printed URL (usually http://localhost:5173).

---

## 🧭 Feature Walkthrough

### Chat & Sessions
- Compose messages in the pixel textarea.
- Shift+Enter inserts new lines; Enter sends.
- Attach multiple files; they’re base64’d and streamed to Mistral.
- Sessions auto-title based on your first message (AI summary).
- Sidebar arrows let you jump between sessions, delete, or start fresh.

### Audio Transcription
- Mic button starts recording (browser permission needed).
- Stopping sends audio to `/api/transcribe`, returning text appended to the composer.

### Attachments & Image Generation
- “Image mode” button swaps send action to Pixtral generation.
- While generating an image, regular chat is locked until success/cancel.
- Uploaded PDFs/DOCs are read server-side; image uploads feed Pixtral when necessary.

### Websearch
- Globe toggle turns on `web_search`/`web_search_premium` tools.
- When active, instructions remind the assistant to cite sources.

### System Prompts
- Profile menu → “Manage system prompt.”
- Browse built-ins, preview text, click **Set prompt** to apply.
- Authenticated users can save custom prompts (stored in Supabase) and delete them with the trash icon.
- Currently active prompt is stored in localStorage and persists across sessions/browsers once saved.

### Dashboard (`/dashboard`)
- Shows total requests, tokens, average latency, success rate.
- Tokens/latency charts use the last 200 calls cached locally.
- Recent call table shows date + time stacked for clarity.

### Eval (`/eval`)
- Enter one prompt, pick multiple models, run them simultaneously.
- View answers side-by-side, rate each with thumbs, see latency/token stats.

---

## 🚀 Deployment

1. **Supabase**: ensure schema is applied; configure Auth redirect URLs to your production domain.
2. **Vercel (or similar)**:
   - Create project, link repo, set environment variables (same as `.env.local`).
   - `vercel deploy` or auto-deploy from GitHub.
3. **Post-deploy verification**:
   - Sign-in flow works (check Supabase email templates).
   - File uploads go to `profile-pictures`.
   - System prompts can be saved/deleted (requires service role key).
   - Dashboard/eval accessible via `/dashboard` & `/eval`.

---

## 🛠 Troubleshooting

| Issue | Solution |
| --- | --- |
| `system_prompts` 404 | Run `supabase/schema.sql` to create the table. |
| Duplicate key on `chat_messages` | Already handled by UPSERT and unique IDs; pull latest. |
| “Profile pictures” failing | Ensure `SUPABASE_SERVICE_ROLE_KEY` is set and bucket exists. |
| Eval fetch errors | Confirm Mistral API key quota and network access. |

---

## 🤝 Contributing

1. Fork → branch → PR.
2. Keep pixel aesthetic consistent.
3. Run `pnpm lint` before submitting.
4. Include screenshots for UI changes when possible.

Ideas welcome: localization, theme packs, new metrics, better eval scoring, etc.

---

## 📄 License

MIT (add LICENSE if missing). Use for any purpose—just keep secrets private and give credit where possible.

---

## 🙏 Acknowledgements

- **Mistral AI** for the APIs.
- **Supabase** for Auth/DB/storage.
- **Vercel** for serverless hosting.
- **Community contributors** building the UI & tooling.

If you ship something built on this repo, drop a star or PR—we’d love to see it. Happy hacking! 🐈‍⬛⚡
