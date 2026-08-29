# Personal Budget App

Clean personal budgeting for Jeff & Alina Santana  
Web + Mobile · Plaid bank sync · AI categorization · Voice input

## Tech Stack

- **Web**: Next.js 15 (App Router) + TypeScript
- **Mobile**: Expo (React Native)
- **Monorepo**: Turborepo + pnpm
- **Backend**: Supabase (Auth + Postgres + RLS)
- **Banking**: Plaid
- **AI**: Groq / Ollama (free tier / local)

## Project Structure

```
apps/
  web/          → Next.js application
  mobile/       → Expo application
packages/       → Shared packages (coming soon)
```

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+

### Setup

```bash
# Install dependencies
pnpm install

# Start web app
pnpm dev:web

# Start mobile app (after Expo setup)
pnpm dev:mobile
```

### Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm dev:web` | Start only the Next.js web app |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |

## Current Status

- [x] Monorepo structure (Turborepo + pnpm)
- [x] Next.js web app scaffold
- [x] Expo mobile placeholder
- [ ] Supabase Auth + Database
- [ ] Core transaction model + calculations
- [ ] Clean dashboard
- [ ] Plaid integration
- [ ] AI categorization

## Roadmap

See [Issues](https://github.com/jeffvazquez-dev/personal-budget-app/issues) for the full breakdown of Epics and User Stories.
