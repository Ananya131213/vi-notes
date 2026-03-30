# vi-notes

A distraction-free MERN stack writing application with keystroke timing analysis.

## Features

- **Clean Text Editor** — Minimal, distraction-free writing area (no formatting buttons)
- **Auth System** — Email/password registration and login (JWT-based, 7-day sessions)
- **Keystroke Timing** — Captures press-duration and inter-key intervals per session  
  ⚠️ *No characters are ever stored — only millisecond timing values*
- **Session History** — View past typing session stats (keystrokes, avg durations)

## Project Structure

```
vi-notes/
├── backend/
│   ├── models/
│   │   ├── User.js               # Mongoose user model (bcrypt hashed passwords)
│   │   └── KeystrokeSession.js   # Timing-only session model
│   ├── middleware/
│   │   └── authMiddleware.js     # JWT protect middleware
│   ├── routes/
│   │   ├── authRoutes.js         # POST /api/auth/register, /api/auth/login
│   │   └── keystrokeRoutes.js    # POST/GET /api/keystrokes/session(s)
│   ├── .env                      # PORT, MONGO_URI, JWT_SECRET
│   └── server.js                 # Express entry point
│
└── frontend/
    └── src/
        ├── context/
        │   └── AuthContext.jsx   # Global auth state (token + user)
        ├── services/
        │   ├── authService.js    # Axios wrappers for auth API
        │   └── keystrokeService.js
        ├── pages/
        │   ├── AuthPage.jsx      # Login + register (glassmorphism design)
        │   └── EditorPage.jsx    # Main writing area + keystroke tracker
        ├── components/
        │   └── SessionHistory.jsx
        └── App.jsx               # BrowserRouter + protected routes
```

## Prerequisites

- Node.js ≥ 18
- MongoDB running locally on `mongodb://127.0.0.1:27017`

## Quick Start

**1. Start MongoDB**  
Make sure mongod is running (or use MongoDB Compass).

**2. Start the backend**
```bash
cd backend
npm install   # if not already done
npm run dev
# → http://localhost:5000
```

**3. Start the frontend**
```bash
cd frontend
npm install   # if not already done
npm run dev
# → http://localhost:3000
```

**4. Open** http://localhost:3000

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | ✗ | Create account |
| POST | `/api/auth/login` | ✗ | Get JWT token |
| POST | `/api/keystrokes/session` | ✓ | Save timing events |
| GET | `/api/keystrokes/sessions` | ✓ | List all sessions |
| GET | `/api/keystrokes/sessions/:id` | ✓ | Get session detail |

## Privacy Notes

The keystroke tracker explicitly:
- ❌ Does **NOT** store what key was pressed
- ❌ Does **NOT** store the text being written  
- ✅ Only stores `pressDuration` (ms key held) and `interKeyInterval` (ms between keys)

## Environment Variables (backend/.env)

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/vinotes
JWT_SECRET=your_secret_here
```
