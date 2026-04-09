You are a senior full-stack engineer. Build a scalable mobile application for iOS and Android using the following stack and requirements.

# 🧱 Tech Stack (MANDATORY)

## Mobile App

* React Native with Expo
* TypeScript
* State management: Zustand or React Query
* Navigation: React Navigation
* Maps: Mapbox

## Backend

* Node.js with NestJS (TypeScript)
* REST API + WebSockets (Socket.io)
* Authentication: JWT

## Database

* PostgreSQL with PostGIS extension (for geolocation)

## Realtime & Cache

* Redis (for caching + live updates)

## Notifications

* Firebase Cloud Messaging (FCM)

## Infra

* Dockerized services
* Environment-based config

---

# 📱 App Features

## 1. User System

* User registration & login (JWT)
* Player profile:

  * username
  * skill level (beginner/intermediate/advanced)
  * position (setter, libero, etc.)
  * profile picture
* Ability to view other player profiles

---

## 2. Map System (CORE FEATURE)

* Display a map using Mapbox
* Show:

  * Volleyball courts (indoor/outdoor)
  * Active games
* Use clustering for performance
* User geolocation

---

## 3. Volleyball Courts

* Create/list volleyball courts
* Fields:

  * name
  * location (PostGIS POINT)
  * type (indoor/outdoor)
* Query courts by distance (PostGIS)

---

## 4. Matches / Games

* Create a game:

  * location
  * date/time
  * required number of players
  * skill level
* Join a game
* Leave a game
* Show number of missing players

---

## 5. Realtime Features (IMPORTANT)

* Use WebSockets (Socket.io)
* When a user joins/leaves a game:

  * update all connected clients instantly
  * update player count in real-time
* Broadcast updates to map markers

---

## 6. Smart Matching (basic version)

* Suggest games based on:

  * distance
  * skill level

---

## 7. Notifications

* Push notification when:

  * a game is almost full
  * someone joins your game

---

# 🧠 Backend Architecture

* Modular NestJS architecture:

  * AuthModule
  * UsersModule
  * MatchesModule
  * CourtsModule
* Use DTOs and validation
* Use services + repositories pattern

---

# 🗄️ Database Design

Use PostgreSQL + PostGIS:

Tables:

* users
* matches
* courts
* match_participants

Include:

* geolocation fields using PostGIS
* proper relations (FK)

---

# ⚡ Redis Usage

* Cache nearby matches
* Store temporary match state (players count)
* Pub/Sub for WebSocket scaling

---

# 📡 API Endpoints (examples)

* POST /auth/register
* POST /auth/login
* GET /users/:id
* GET /courts?lat=...&lng=...
* POST /matches
* POST /matches/:id/join
* POST /matches/:id/leave

---

# 🔌 WebSocket Events

* join_match
* leave_match
* match_updated
* player_joined
* player_left

---

# 📦 Project Structure

/apps
/mobile (React Native Expo)
/backend
/src
/modules
/common
/config

---

# 🐳 Docker

* docker-compose with:

  * backend
  * postgres + postgis
  * redis

---

# ✅ Requirements

* Clean, production-ready code
* Strong typing everywhere
* Scalable architecture
* Environment variables support
* Include README with setup instructions

---

# 🚀 Bonus

* Seed script for courts
* Basic UI (map + list of games)
* Error handling
* Loading states

---

Build the full project step by step:

1. Initialize backend
2. Setup database with PostGIS
3. Build core modules
4. Add WebSockets
5. Build mobile app
6. Connect everything

Ensure everything works together.


