# LeetPulse

LeetCode analytics platform with AI-powered RAG (Retrieval-Augmented Generation) for answering coding performance questions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | Turborepo + pnpm |
| **Backend** | Express 5, TypeScript, Prisma, BullMQ, Redis |
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 |
| **Database** | PostgreSQL 16 |
| **AI/RAG** | Google Gemini (embeddings + chat), Pinecone (vector DB) |
| **Monitoring** | Prometheus, Loki, Grafana |
| **Containerization** | Docker, Docker Compose |

## Project Structure

```
LeetPulse/
├── apps/
│   ├── backend/          # Express API with RAG pipeline
│   └── frontend/         # Next.js SPA
├── packages/
│   ├── db/               # Prisma schema + client
│   ├── eslint-config/    # Shared ESLint configs
│   └── typescript-config/ # Shared tsconfig presets
├── docker-compose.yml    # Full stack orchestration
├── turbo.json
└── pnpm-workspace.yaml
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 9+
- [Docker](https://www.docker.com/) (optional, for containerized setup)
- [Pinecone account](https://www.pinecone.io/) (for vector DB)
- [Google AI Studio API key](https://aistudio.google.com/apikey) (for Gemini)

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/tajbaba999/Grindlytics.git
cd Grindlytics

# Copy environment file
cp .env.example .env

# Edit .env with your API keys (required: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, PINECONE_API_KEY, GEMINI_API_KEY)

# Start all services
docker compose up -d

# Run database migrations
docker compose exec backend pnpm run db:push

# Access the application
# Frontend: http://localhost:3001
# Backend API: http://localhost:3000
# Grafana: http://localhost:3002 (admin/admin)
# Prometheus: http://localhost:9090
```

### Option 2: Local Development

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm run db:generate

# Run database migrations (requires PostgreSQL running)
pnpm run db:push

# Start development servers (runs all apps with hot reload)
pnpm run dev

# Or start individually
pnpm run --filter @leetplus/backend dev
pnpm run --filter @leetplus/frontend dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database (required)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=leetplus

# JWT Authentication (required)
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Redis (required for queue system)
REDIS_URL=redis://localhost:6379

# AI/RAG (required for chat feature)
PINECONE_API_KEY=your-pinecone-api-key
GEMINI_API_KEY=your-gemini-api-key

# LeetCode (optional, for authenticated queries)
LEETCODE_USERNAME=your-leetcode-username
LEETCODE_SESSION=your-session-cookie
LEETCODE_CSRF=your-csrf-token
```

## API Reference

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/signup` | POST | Register new user |
| `/api/v1/signin` | POST | Login |
| `/api/v1/refresh-token` | POST | Refresh access token |

**Signup/Signin Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### LeetCode Data (Public)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/leetcode/:username` | GET | User profile |
| `/api/v1/leetcode/profile?username=` | GET | Detailed profile |
| `/api/v1/leetcode/my-contests?username=` | GET | Contest history |
| `/api/v1/leetcode/language-stats?username=` | GET | Language statistics |
| `/api/v1/leetcode/skill-stats?username=` | GET | Topic-wise stats |
| `/api/v1/leetcode/question-progress?username=` | GET | Question progress |
| `/api/v1/leetcode/session-progress?username=` | GET | Session progress |
| `/api/v1/leetcode/calendar?username=&year=` | GET | Activity calendar |

### User Profile (Protected)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/profile` | GET | Get authenticated user profile |

### Coding Profile (Protected)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/codingprofile` | GET | Get linked coding profiles |
| `/api/v1/codingprofile/initial-sync` | POST | Create profile + full sync (SSE) |
| `/api/v1/codingprofile/sync` | POST | Re-sync existing profile (SSE) |
| `/api/v1/codingprofile/history?limit=` | GET | Historical snapshots |
| `/api/v1/codingprofile/history/diff?from=&to=` | GET | Diff between snapshots |
| `/api/v1/codingprofile/activity?year=&month=` | GET | Submission calendar |
| `/api/v1/codingprofile/questions?difficulty=&tag=&limit=` | GET | Solved problems |

### RAG Chat (Protected)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/rag/ingest` | POST | Build RAG documents from stored data |
| `/api/v1/rag/chat` | POST | Chat with AI about your performance |

**Chat Request:**
```json
{
  "question": "What are my weak areas in Data Structures?"
}
```

**Chat Response:**
```json
{
  "answer": "Based on your LeetCode data, your weakest areas are...",
  "sources": ["skill-advanced", "weakness-analysis"]
}
```

### Metrics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/metrics` | GET | Prometheus metrics |

## Architecture

### Backend

```
apps/backend/src/
├── api/
│   ├── auth/           # Signup, signin, refresh-token
│   ├── leetcode/       # LeetCode data fetchers
│   ├── codingprofile/  # Profile sync with SSE streaming
│   ├── rag/            # RAG ingest + chat
│   ├── metrics/        # Prometheus endpoint
│   └── workers/        # BullMQ workers
├── services/rag/       # RAG pipeline
├── queues/             # BullMQ queues + events
├── fetchers/           # LeetCode GraphQL queries
├── validators/         # Zod schemas
└── utils/              # Logger, tokens
```

### RAG Pipeline

1. **Build Chunks** - Creates ~12 summary chunks + 1 per solved problem
2. **Diff Hashes** - SHA-256 hashing for incremental updates
3. **Embed** - Gemini embedding-001 (768-dim)
4. **Upsert** - Store vectors in Pinecone (user-scoped namespaces)
5. **Chat** - Query Pinecone → build context → Gemini 2.5 Flash response

### Queue System

| Queue | Purpose |
|-------|---------|
| `fetch-leetcode` | Fetch all LeetCode data via GraphQL |
| `process-leetcode` | Save to DB + run RAG ingest |

### Data Models

| Model | Description |
|-------|-------------|
| `User` | User accounts with bcrypt passwords |
| `CodingProfiles` | Linked LeetCode usernames |
| `LeetCodeStats` | Current LeetCode statistics |
| `LeetCodeHistory` | Historical snapshots |
| `LeetCodeContestHistory` | Contest participation records |
| `LeetCodeProblem` | Solved problems metadata |
| `RagChunkHash` | SHA-256 hashes for incremental RAG |

## Development

### Available Commands

```bash
# Root
pnpm run dev              # Run all apps with hot reload
pnpm run build            # Build all packages
pnpm run lint             # Lint all packages
pnpm run check-types      # Type-check entire monorepo
pnpm run db:generate      # Generate Prisma client
pnpm run db:migrate       # Run Prisma migrations
pnpm run db:studio        # Open Prisma Studio

# Backend
pnpm run --filter @leetplus/backend dev
pnpm run --filter @leetplus/backend build
pnpm run --filter @leetplus/backend test

# Frontend
pnpm run --filter @leetplus/frontend dev
pnpm run --filter @leetplus/frontend build
```

### Testing

```bash
# Backend tests
pnpm run --filter @leetplus/backend test

# Run single test file
pnpm vitest run test/api.test.ts

# Run single test by name
pnpm vitest run -t "responds with a json message"
```

### API Testing

The project includes a [Bruno](https://www.usebruno.com/) API collection at `apps/backend/bruno/` with pre-configured requests for:
- Auth (signup, signin, refresh)
- Coding Profile (sync, history, diff)
- LeetCode (all endpoints)
- RAG (ingest, chat)

## Monitoring

### Grafana (http://localhost:3002)

- **Credentials:** admin/admin
- **Datasources:** Loki (logs), Prometheus (metrics)

### Prometheus (http://localhost:9090)

Scrapes backend metrics every 15 seconds:
- `http_request_duration_seconds` - HTTP request latency
- `http_request_total` - Total HTTP requests
- `sync_job_duration_seconds` - Sync job latency
- `sync_job_total` - Total sync jobs

### Loki (http://localhost:3100)

Receives structured logs from backend via pino-loki transport.

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| `postgres` | 5432 | PostgreSQL database |
| `redis` | 6379 | Redis for BullMQ |
| `backend` | 3000 | Express API |
| `frontend` | 3001 | Next.js SPA |
| `grafana` | 3002 | Monitoring dashboards |
| `prometheus` | 9090 | Metrics collection |
| `loki` | 3100 | Log aggregation |

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request
