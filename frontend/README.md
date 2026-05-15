# Sentinel — frontend

The Sentinel vibration monitoring platform's dashboard shows real-time node status, events, alarms, and system health. needs the backend API to be operational. The frontend also has a marble game controlled by a tilt controller.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) v9 or higher
- The backend API running on `http://localhost:8000` (see the backend repository)

## Getting started

### 1. clone the repository

```bash
git clone <repo-url>
cd Team-EN04-frontend
```

### 2. install dependencies

```bash
npm install
```

### 3. configure environment variables

create a `.env` file in the project root:  
`NEXT_PUBLIC_API_URL=http://localhost:8000`

If you do not set it locally, the frontend falls back to `http://localhost:8000` in development.

Never commit your .env file.

### 4. run the development server

```bash
npm run dev
```

Launch your browser and navigate to http://localhost:3000. The login page will be displayed to you. The backend seed script sets the default admin credentials (`admin` / `admin123`). Player accounts will now receive an OTP challenge after password verification, and registration requires an email address because the backend sends the code to that mailbox.

## Scripts

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start development server                 |
| `npm run build`        | Build for production                     |
| `npm start`            | Start production server                  |
| `npm test`             | Run unit tests                           |
| `npm run test:watch`   | Run unit tests in watch mode             |
| `npm run lint`         | Run ESLint                               |
| `npm run format`       | Format all files with prettier           |
| `npm run format:check` | Check formatting without modifiyng files |

## Code quality

ESLint and Prettier are enforced automatically at two points:

- **Pre-commit hook** — `git commit` runs ESLint and Prettier on all of the staged files via `lint-staged`. The commit is blocked if either of the check fails. The hook is automatically installed when you run `npm install`.
- **CI** — every pull request to `main` runs `npm run lint` and `npm run format:check` in github actions. A pr cannot be merged if either check fails.

## Folder structure

```
app/                  # Next.js App Router pages
  login/              # Login page
  register/           # Register page
  game/               # Marble game page
  game_statistics/    # Game statistics page
  page.tsx            # Dashboard page

components/
  auth/               # Login and register form components
  dashboard/          # All dashboard UI components
  game/               # Marble game component
  game_statistics/    # Game statistics table component

hooks/
  useSocket.ts        # Custom hook for Socket.IO connection

lib/
  socket.ts           # Socket.IO client instance

service/
  api.ts              # All API calls to the backend

types/
  index.ts            # Shared TypeScript types

middleware.ts         # Route protection — redirects unauthenticated users to /login
library/              # Placeholder data for development
```

## API proxying

`next.config.ts` rewrites the following paths to the backend so the browser never needs to reach it directly:

- `/auth/*` → `NEXT_PUBLIC_API_URL/auth/*`
- `/api/*` → `NEXT_PUBLIC_API_URL/api/*`
- `/socket.io/*` → `NEXT_PUBLIC_API_URL/socket.io/*`

This means all fetch calls and the Socket.IO client can use relative URLs (e.g. `/api/game`) without CORS issues.

## Authentication

The frontend now supports both backend auth modes:

- Admins can receive a JWT immediately after password verification.
- Player accounts receive a password step followed by an OTP challenge.
- If the backend is configured with auth cookies, the browser will use the backend cookie automatically and the frontend sends `credentials: include` on auth calls.

The `middleware.ts` file reads the auth cookie and reroutes unauthenticated users to `/login`.

Public routes: `/login`, `/register`
The other routes require a valid session cookie.

## Docker

The easiest way to run the frontend in a container is with Docker Compose. Make sure your `.env` file has `NEXT_PUBLIC_API_URL` set, then run:

```bash
docker compose up
```

Alternatively you can build and run the image manually. The API URL must be passed as a build argument because Next.js injects client-side env variables at build time:

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 -t sentinel-frontend .
docker run -p 3000:3000 sentinel-frontend
```
