# SMCF Backend (Express + MongoDB Atlas)

This is a minimal, ready-to-run Express backend scaffold tailored for Smart Moves Cash Flow (SMCF).

Environment
 - Create a `.env` file at the project root with:
```
MONGODB_URI="mongodb+srv://<user>:<pass>@cluster0.abcd123.mongodb.net/smcf?retryWrites=true&w=majority"
PORT=4000
NODE_ENV=development
```

Run locally
```
cd f:/SMCF/smcf-backend-express
npm install
npm run dev
```

API endpoints (examples)
- GET /health
- CRUD users: /api/users

Postman examples
- Create user (POST /api/users)
  Body (JSON): { "name": "Alice", "email": "alice@example.com", "age": 30 }
- Get users (GET /api/users)

Deploy
- Deploy to Render/Railway by connecting the repo and setting environment variables in the platform.
