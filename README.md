# Vi-Notes

Vi-Notes is a MERN writing app with email/password authentication and privacy-conscious keystroke timing summaries. It records timing metrics only; it does not store the characters a user types.

## Implemented features

- Registration and login with JWT authentication
- Protected, distraction-free editor
- Writing-session lifecycle with start, save, duration, and word-count tracking
- Privacy-conscious behavioral metadata: timing intervals, pauses, backspaces, and paste lengths
- Session history with metadata-only summaries
- Responsive session-history dashboard with per-session analytics and saved-content review
- Transparent, rule-based authenticity reports based only on stored session behavior
- MongoDB storage through Mongoose
- API health endpoint at `GET /api/health`

## Project structure

```
vi-notes/
├── backend/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── .env.example
│   ├── package.json
│   └── server.js
└── frontend/
    ├── public/
    ├── src/
    ├── package.json
    └── vite.config.js
```

## Requirements

- Node.js 18 or newer
- A running MongoDB instance (local or hosted)

## Setup

Install the backend and frontend dependencies separately:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Create `backend/.env` by copying `backend/.env.example`, then set the values for your environment. Do not commit this file.

## Backend environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | Yes | Port used by the Express server, for example `5000`. |
| `MONGO_URI` | Yes | MongoDB connection string. |
| `JWT_SECRET` | Yes | A long, random secret used to sign login tokens. |
| `CLIENT_URL` | Yes | Allowed frontend origin. Multiple comma-separated origins are supported. |

For local development, `CLIENT_URL=http://localhost:3000` matches the frontend's configured Vite port.

## Run locally

Start MongoDB, then run these commands in separate terminals:

```bash
# Terminal 1
cd backend
npm run dev
```

```bash
# Terminal 2
cd frontend
npm run dev
```

Open the frontend URL printed by Vite (currently `http://localhost:3000`). The backend runs at `http://localhost:5000` by default.

## API routes

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Create an account. |
| `POST` | `/api/auth/login` | No | Sign in and receive a JWT. |
| `POST` | `/api/keystrokes/start-session` | Bearer token | Create or resume a writing session. |
| `POST` | `/api/keystrokes/end-session` | Bearer token | Save document content and finalize session metadata. |
| `GET` | `/api/keystrokes/session/:id` | Bearer token | Get one saved session. |
| `GET` | `/api/keystrokes/my-sessions` | Bearer token | List a user's session metadata without document content. |
| `GET` | `/api/reports/:sessionId` | Bearer token | Get the current user's authenticity report for one session. |
| `GET` | `/api/reports/my-reports` | Bearer token | List the current user's report summaries. |
| `POST` | `/api/keystrokes/session` | Bearer token | Save timing events. |
| `GET` | `/api/keystrokes/sessions` | Bearer token | List a user's session summaries. |
| `GET` | `/api/keystrokes/sessions/:sessionId` | Bearer token | Get one session. |
| `GET` | `/api/health` | No | Check that the API is running. |

## Session analytics and privacy

When the editor opens, it creates a writing session. On Save (or Sign out), the backend records the server-side end time, duration in milliseconds, word count, the saved document content, and aggregate behavior metrics.

The analytics payload contains only total keystrokes, key intervals, pause count, backspace count, and paste timestamps with pasted lengths. Actual key values and pasted text are never sent to the analytics API or stored as analytics. The document content is stored separately because it is the writing the user chose to save.

## Authenticity reports

When a session is saved, Vi-Notes creates or updates one `rules-v1` authenticity report for it. This is not an AI detector. It starts at 100 and applies visible deductions for large or repeated pastes, low typing activity relative to word count, no revisions in long documents, unusually fast long sessions, and no natural pauses in long sessions. The stored report includes the source metrics, every deduction, findings, and a behavior summary so the result can be reviewed transparently.
