# BATTLE NEST - Esports Tournament Platform

## Overview
BATTLE NEST is a full-stack esports tournament platform for BGMI, Free Fire, Valorant, CS2, COD Mobile, and PUBG. Users can browse tournaments, register, manage wallets, and compete for prizes. Admins can manage games, tournaments, users, and withdrawals. Supports Google OAuth login and Razorpay payment gateway.

## Tech Stack
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui, wouter routing, TanStack Query
- **Backend**: Node.js + Express, JWT authentication, role-based access (user/admin)
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: JWT tokens stored in localStorage ("bn_token"), bcryptjs for password hashing, Google OAuth (optional)
- **Payments**: Razorpay integration (optional, enabled via env vars)
- **Security**: express-rate-limit for API rate limiting

## Project Structure
```
client/src/
  pages/         - Auth, Home, Tournaments, Tournament Detail, Wallet, Profile, Admin, Teams
  components/    - Layout, UI components (shadcn)
  lib/           - Auth context (auth.tsx), theme provider, query client
  hooks/         - Toast hook

server/
  index.ts       - Express server setup
  routes.ts      - All API routes (auth, tournaments, wallet, admin, payments, notifications)
  storage.ts     - Database storage layer with all CRUD operations
  db.ts          - Drizzle + PostgreSQL connection
  auth.ts        - JWT middleware, token generation

shared/
  schema.ts      - Drizzle schema definitions, Zod validation schemas
```

## Key Features
- JWT authentication (signup/login) - NOT Replit Auth (user preference)
- Google OAuth login (optional, enabled via GOOGLE_CLIENT_ID env var)
- Razorpay payment gateway (optional, enabled via RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET)
- Tournament browsing with filters (game, status, type)
- Tournament registration with wallet deduction
- Wallet system (add money via Razorpay or direct, withdraw, transaction history)
- User profiles with game IDs (BGMI, Free Fire, COD Mobile, Valorant, CS2, PUBG)
- Team management (create, add/remove members, delete)
- Notifications system (tournament joined, match started, results declared, wallet updates)
- Admin panel: tournament CRUD, game management, user ban/unban, withdrawal approval
- Admin: declare results with auto prize distribution to winners' wallets
- Admin: manual wallet credit/debit for users
- Admin: set room ID/password for tournaments
- Admin: activity logs
- Admin: home page banner management (upload up to 5, enable/disable, delete)
- Home page sliding banner carousel (auto-slides every 4s, prev/next buttons, dot indicators)
- Rate limiting on auth and API endpoints
- Dark/Light mode toggle (dark-mode-first)
- Mobile-responsive design

## Default Admin Credentials
- Email: battlenestofficial@gmail.com
- Password: admin@admin

## Environment Variables (Optional)
- GOOGLE_CLIENT_ID - For Google OAuth login
- RAZORPAY_KEY_ID - Razorpay API Key ID
- RAZORPAY_KEY_SECRET - Razorpay API Key Secret
- RAZORPAY_WEBHOOK_SECRET - Razorpay webhook verification (optional)

## API Routes
### Auth
- POST /api/auth/signup, /api/auth/login, /api/auth/google

### Public
- GET /api/games, /api/tournaments, /api/tournaments/:id
- GET /api/tournaments/:id/results, /api/tournaments/:id/participants
- GET /api/config/google-client-id, /api/config/razorpay-key

### User (auth required)
- POST /api/tournaments/:id/join
- GET /api/registrations/my, /api/transactions/my, /api/withdrawals/my
- PATCH /api/users/profile
- POST /api/wallet/add, /api/withdrawals
- POST /api/payments/create-order, /api/payments/verify
- GET /api/payments/my
- GET /api/notifications, /api/notifications/unread-count
- PATCH /api/notifications/:id/read, POST /api/notifications/read-all
- GET /api/teams/my, POST /api/teams, DELETE /api/teams/:id
- POST /api/teams/:id/members, DELETE /api/teams/:id/members/:userId

### Admin
- GET /api/admin/stats, /api/admin/users, /api/admin/logs
- PATCH /api/admin/users/:id/ban
- POST /api/admin/users/:id/wallet (credit/debit)
- POST /api/admin/games, PATCH /api/admin/games/:id, DELETE /api/admin/games/:id
- POST /api/admin/tournaments, PATCH /api/admin/tournaments/:id, DELETE /api/admin/tournaments/:id
- PATCH /api/admin/tournaments/:id/status, /api/admin/tournaments/:id/room
- POST /api/admin/tournaments/:id/results (declare results with auto prize distribution)
- GET /api/admin/withdrawals, PATCH /api/admin/withdrawals/:id

### Webhook
- POST /api/payments/webhook (Razorpay webhook)

## Database Tables
- users, games, tournaments, registrations, transactions, withdrawals
- teams, team_members, results
- payments (Razorpay payment records)
- admin_logs (admin activity tracking)
- notifications (user notifications)
- banners (home page carousel banners, max 5)

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
- Auth context provides user, token, login, logout, updateUser
- All monetary values stored in cents (integer) in the database
- Google login creates user with empty password, links by email if existing account found
- Razorpay: creates order on backend, opens checkout on frontend, verifies signature on backend
- Rate limiting: 20 req/15min on auth, 100 req/min on general API
