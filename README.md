# volleyhub-backend

API backend de **VolleyHub** — NestJS + PostgreSQL/PostGIS + Redis + Socket.io.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS, TypeScript |
| Database | PostgreSQL 15 + PostGIS 3.3, TypeORM |
| Cache | Redis 7 |
| WebSockets | Socket.io |
| Auth | JWT (passport-jwt) access + refresh tokens |
| Notifications | Firebase Cloud Messaging (FCM) |
| Email | Resend (password reset) |
| Error tracking | Sentry |
| Security | Helmet, @nestjs/throttler, bcrypt |
| Infrastructure | Docker + docker-compose |
| CI | GitHub Actions |

---

## Quick Start

### Prerequisites

- [Docker & Docker Compose](https://docs.docker.com/get-docker/)
- [Node.js 20+](https://nodejs.org/)

### 1. Configure

```bash
cp .env.example .env
```

Edit `.env` with your values (see [Environment Variables](#environment-variables)).

### 2. Start with Docker

```bash
docker-compose up -d

# Check logs
docker-compose logs -f backend
```

API disponible sur `http://localhost:3000`.

### 3. Start en dev (sans Docker pour le backend)

```bash
# Start postgres + redis
docker-compose up -d postgres redis

cd api
npm install
npm run start:dev
```

---

## Project Structure

```
api/src/
├── config/                   # App and database configuration
├── common/
│   ├── guards/               # JwtAuthGuard, OptionalJwtAuthGuard, AdminGuard
│   ├── decorators/           # @CurrentUser()
│   ├── enums/                # EventFormat, VolleyType, TournamentSystem
│   └── sentry/               # Sentry init + global exception filter
├── database/
│   ├── migrations/           # TypeORM migrations
│   ├── seed-*.ts             # Seed scripts (dev/testing)
│   └── seed-purge.ts         # Remove seeded data
└── modules/
    ├── admin/                # Admin panel (React Admin), AdminSeederService
    ├── auth/                 # JWT register/login/refresh, password reset
    ├── users/                # Profiles, follows, connections, stats
    ├── courts/               # Court CRUD + PostGIS
    ├── matches/              # Matches, tournaments, chat, fixtures, WebSocket
    │   ├── tournament-engine.service.ts    # Bracket advancement + walkovers
    │   └── tournament-generator.service.ts # Initial bracket generation
    ├── email/                # Resend email service
    ├── notifications/        # Firebase FCM push notifications
    └── redis/                # Redis service (global)

docs/                         # Documentation
.github/workflows/            # CI (lint, tests)
```

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register |
| POST | `/auth/login` | — | Login (access + refresh tokens) |
| POST | `/auth/refresh` | — | Refresh access token |
| POST | `/auth/request-password-reset` | — | Send 6-digit code by email |
| POST | `/auth/reset-password` | — | Reset password with code |

Rate limited: login (10/min), register (5/hour), refresh (30/min).

### Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users/:id` | Optional | Public profile |
| PATCH | `/users/me` | JWT | Update own profile |
| POST | `/users/:id/follow-request` | JWT | Send connection request |
| GET | `/users/me/follow-requests` | JWT | Pending requests |
| GET | `/users/:id/stats` | — | Match/tournament statistics |

### Courts

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/courts/:id` | — | Court details |
| POST | `/courts` | JWT | Create a court |

### Matches

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/matches?lat=...&lng=...&radius=...` | — | Nearby open matches |
| GET | `/matches/suggestions?lat=...&lng=...` | JWT | Personalized suggestions |
| GET | `/matches/:id` | — | Match details |
| POST | `/matches` | JWT | Create match or tournament |
| POST | `/matches/:id/join` | JWT | Join |
| POST | `/matches/:id/leave` | JWT | Leave |
| PATCH | `/matches/:id/manage` | JWT | Manage teams/scores/bracket (organizer) |
| PATCH | `/matches/:id/my-team` | JWT | Self-assign to team |

### Tournament Fixtures

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/matches/fixtures/:id/score` | JWT | Submit team score |
| POST | `/matches/fixtures/:id/confirm` | JWT | Lock team score |
| PATCH | `/matches/fixtures/:id/override` | JWT | Organizer score override |

### Admin

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/users` | Admin | List users |
| GET | `/admin/matches` | Admin | List matches |
| PATCH | `/admin/users/:id` | Admin | Update user |
| DELETE | `/admin/matches/:id` | Admin | Delete match |

---

## WebSocket Events

Connect: `ws://localhost:3000/matches` with `auth: { token: 'jwt' }`.

### Client -> Server

| Event | Payload | Description |
|---|---|---|
| `join_match` | `{ matchId }` | Join + subscribe |
| `leave_match` | `{ matchId }` | Leave |
| `subscribe_match` | `{ matchId }` | Subscribe only |

### Server -> Client

| Event | Description |
|---|---|
| `match_updated` | Match state changed |
| `player_joined` | Someone joined |
| `player_left` | Someone left |
| `map_match_updated` | Map marker update |
| `match_chat_message` | Chat message |
| `error` | Error response |

---

## Database Schema

```sql
users (id UUID PK, username, email, password_hash, skill_level, position,
       profile_picture, bio, club, league, fcm_token, is_admin,
       reset_code, reset_code_expires_at,
       location GEOGRAPHY(POINT,4326), created_at, updated_at)

courts (id UUID PK, name, type, is_registry,
        location GEOGRAPHY(POINT,4326), address, created_at, updated_at)

matches (id UUID PK, court_id FK, creator_id FK,
         scheduled_at, max_players, current_players,
         skill_level, volley_type, event_format, status,
         match_sets, points_to_win, set_scores JSONB,
         team_count, team_size, tournament_points_per_match,
         tournament_court_count, tournament_system, tournament_games JSONB,
         description, created_at, updated_at)

match_participants (match_id FK, user_id FK, team_index, slot_index, joined_at)

tournament_fixtures (id UUID PK, event_match_id FK,
                     team_a_index, team_b_index, score_a, score_b,
                     score_a_confirmed, score_b_confirmed,
                     court_index, round, "order", status, phase,
                     depends_on_fixture_ids UUID[], started_at)

follows (follower_id FK, following_id FK)
follow_requests (id UUID PK, requester_id FK, target_id FK)
match_chat_messages (id UUID PK, match_id FK, sender_id FK, body, created_at)
match_chat_mutes (id UUID PK, match_id, user_id, muted_by)
```

---

## Redis

| Key Pattern | TTL | Description |
|---|---|---|
| `nearby:matches:v2:{params}` | 60s | Cached geo queries |
| `match:{id}:count` | 60min | Player count |
| `user:profile:{userId}` | 5min | Cached profile |
| `user:{userId}:stats:{format}` | 1h | Cached stats |
| `invites:user:{userId}` | 30d | Invite data |
| `auto-cancel:notified:{matchId}` | 24h | Duplicate notification guard |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `REDIS_URL` | No | Redis URL (default: localhost:6379) |
| `JWT_EXPIRES_IN` | No | Access token expiry (default: `1h`) |
| `REFRESH_TOKEN_EXPIRES_IN` | No | Refresh token expiry (default: `7d`) |
| `ALLOWED_ORIGINS` | No | CORS origins, comma-separated |
| `BCRYPT_ROUNDS` | No | Password hash rounds (default: `12`) |
| `FIREBASE_PROJECT_ID` | No | FCM project ID |
| `FIREBASE_PRIVATE_KEY` | No | FCM private key |
| `FIREBASE_CLIENT_EMAIL` | No | FCM email |
| `ADMIN_SEED_EMAIL` | No | Auto-create admin account |
| `ADMIN_SEED_PASSWORD` | No | Admin password |
| `SENTRY_DSN` | No | Sentry error tracking DSN |
| `RESEND_API_KEY` | No | Resend API key (password reset) |
| `EMAIL_FROM` | No | Sender email address |

---

## Tests

```bash
cd api

# Unit tests
npm run test

# Integration tests
npm run test:integration
```

---

## Documentation

- [iOS Deployment](docs/ios_deployment.md)
- [Tournament Algorithm](docs/tournoi.md)
- [Security](docs/securite.md)
- [Sentry Setup](docs/sentry.md)
- [Railway Deployment](docs/deploiement_railway.md)
- [Original Spec](docs/spec.md)
