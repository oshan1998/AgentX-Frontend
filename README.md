# AgentX-Frontend

Minimal React dashboard for interacting with [AgentX](https://github.com/oshan1998/AgentX) — the Node.js agent runtime.

**Repository:** https://github.com/oshan1998/AgentX-Frontend

## Features

- **Chat** — message the agent; when the knowledge base has indexed documents, chat uses RAG over the app corpus
- **Knowledge base** — sidebar panel to upload and index PDF, TXT, MD, DOCX (not tied to chat input)
- **Reasoning feed** — live WebSocket trace of skills, tools, and run steps
- **Sessions** — browse and switch conversations
- **Markdown** — rich assistant replies
- **Integrations** modal and task graph visualization

Glassmorphism UI with Framer Motion animations.

## Prerequisites

AgentX backend running on **http://localhost:3000** (see the [AgentX README](https://github.com/oshan1998/AgentX)).

## Quick start

```bash
git clone https://github.com/oshan1998/AgentX-Frontend.git
cd AgentX-Frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

In another terminal, start the backend:

```bash
git clone https://github.com/oshan1998/AgentX.git
cd AgentX
npm install
cp .env.example .env   # configure GCP / keys
npm run dev
```

## API proxy

Vite proxies `/api` and `/ws` to `http://localhost:3000`. Change the target in `vite.config.ts` if your backend uses another host or port.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (default port 5173) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

## Typical workflow

1. Upload documents in the sidebar **Knowledge Base** panel.
2. Wait until status shows **ready**.
3. Ask questions in chat — answers use the indexed corpus.
4. Watch the **Reasoning Feed** for retrieval and generation steps.

## Tech stack

- React 19 + TypeScript
- Vite
- Framer Motion
- Lucide React
- React Markdown
- Tailwind CSS 4

## Related

| Project | Role |
|---------|------|
| [AgentX](https://github.com/oshan1998/AgentX) | Backend — agent loop, tools, skills, corpus API, WebSocket traces |
| `AgentX/ui/` | Built-in static UI served from the backend (lighter alternative) |
