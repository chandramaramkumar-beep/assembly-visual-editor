# lib/agents — AI presentation layer

Consumes the trace `lib/engine/` already computed. Makes judgment calls about presentation (what to highlight, what to compress, how to narrate) — never computes simulation state itself.

## Rules

- **Never recompute or second-guess state.** If something here needs a value the trace doesn't already contain, that's a signal the trace/metadata shape in `lib/engine/` needs to change — fix it there, don't derive state independently here.
- **Server-side only.** All LLM calls go through Next.js API routes or server actions via the Vercel AI SDK. Never call an LLM API from client-side code — that exposes API keys.
- **Intent/chatbox feature is out of scope for now.** This module is the natural attachment point for it later (comparing student-stated intent against the trace), but don't implement it — just avoid designing anything here that would block adding it later.
