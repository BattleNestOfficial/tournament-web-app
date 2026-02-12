# BATTLE NEST - Esports Tournament Platform

## Overview
BATTLE NEST is a full-stack esports tournament platform for BGMI, Free Fire, Valorant, CS2, COD Mobile, and PUBG. Users can browse tournaments, register, manage wallets, and compete for prizes. Admins can manage games, tournaments, users, and withdrawals.

## Tech Stack
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui, wouter routing, TanStack Query
- **Backend**: Node.js + Express, JWT authentication, role-based access (user/admin)
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: JWT tokens stored in localStorage ("bn_token"), bcryptjs for password hashing

## Project Structure
```
client/src/
  pages/         - Auth, Home, Tournaments, Tournament Detail, Wallet, Profile, Admin
  components/    - Layout, UI components (shadcn)
  lib/           - Auth context (auth.tsx), theme provider, query client
  hooks/         - Toast hook

server/
  index.ts       - Express server setup
  routes.ts      - All API routes (auth, tournaments, wallet, admin)
  storage.ts     - Database storage layer with all CRUD operations
  db.ts          - Drizzle + PostgreSQL connection
  auth.ts        - JWT middleware, token generation

shared/
  schema.ts      - Drizzle schema definitions, Zod validation schemas
```

## Key Features
- JWT authentication (signup/login) - NOT Replit Auth (user preference)
- Tournament browsing with filters (game, status, type)
- Tournament registration with wallet deduction
- Wallet system (add money, withdraw, transaction history)
- User profiles with game IDs (BGMI, Free Fire, COD Mobile, Valorant, CS2, PUBG)
- Admin panel: tournament CRUD, game management, user ban/unban, withdrawal approval
- Dark/Light mode toggle (dark-mode-first)
- Mobile-responsive design

## Default Admin Credentials
- Email: battlenestofficial@gmail.com
- Password: admin@admin

## API Routes
- POST /api/auth/signup, /api/auth/login
- GET /api/games, /api/tournaments, /api/tournaments/:id
- GET /api/tournaments/:id/results
- POST /api/tournaments/:id/join (auth required)
- GET /api/registrations/my, /api/transactions/my, /api/withdrawals/my
- PATCH /api/users/profile
- POST /api/wallet/add, /api/withdrawals
- Admin: /api/admin/stats, /api/admin/users, /api/admin/tournaments, /api/admin/games, /api/admin/withdrawals

## Database
- Uses PostgreSQL via DATABASE_URL environment variable
- Schema pushed via `drizzle-kit push`
- Seed data creates 6 default games and 5 sample tournaments on first run
- Wallet amounts stored in integer cents (divide by 100 for display in rupees)

## Design
- Dark-mode-first esports theme with purple primary accent
- Inter font family
- Mobile-first responsive layout

## Important Implementation Details
- QueryClient joins queryKey array segments with "/" for URL construction
- Protected pages (wallet, profile, admin) use useEffect-based redirects
- Auth context provides user, token, login, signup, logout, updateUser
- All monetary values stored in cents (integer) in the database
