# SMCF Deployment Guide

## Production Configuration

### Frontend (smcf.app)

- **Production API URL**: `https://smcf-c99o.onrender.com`
- **Environment Variable**: Set `VITE_API_URL=https://smcf-c99o.onrender.com` in your deployment platform

### Backend (Render - https://smcf-c99o.onrender.com)

- **Allowed Origins**: `https://smcf.app`, `https://www.smcf.app`
- **Environment Variable**: Set `CLIENT_URL=https://smcf.app`

## Environment Variables Setup

### Backend Environment Variables (Render)

Set these in your Render dashboard:

```
MONGODB_URI=mongodb+srv://valinyala24472:Abungana24472@cluster0.rtgyu8k.mongodb.net/smcf?retryWrites=true&w=majority&appName=Cluster0
PORT=4000
NODE_ENV=production
CLIENT_URL=https://smcf.app
JWT_SECRET=smcf-super-secret-jwt-key-2024-production-ready
JWT_EXPIRES_IN=7d
ADMIN_PHONE=254759097157
LIPIA_API_KEY=fae61f0ce672389cce813ab0f5aa996c59da92fb
LIPIA_APP_ID=6922edc95baa365ea8c81067
LIPIA_APP_NAME=smcf
LIPIA_APP_TYPE=TILL
LIPIA_API_URL=https://lipia-api.kreativelabske.com/api/v2
```

### Frontend Environment Variables (Deployment Platform)

Set this in your frontend deployment platform (Vercel/Netlify/etc.):

```
VITE_API_URL=https://smcf-c99o.onrender.com
```

## Deployment Steps

### 1. Deploy Backend to Render

- Push the latest code to GitHub
- Render will auto-deploy from the `main` branch
- Ensure all environment variables are set in Render dashboard
- Backend URL: `https://smcf-c99o.onrender.com`

### 2. Deploy Frontend

- Set `VITE_API_URL=https://smcf-c99o.onrender.com` in your deployment platform
- Build command: `npm run build`
- Output directory: `dist`
- Deploy to your domain: `smcf.app`

### 3. Verify CORS Configuration

The backend is configured to accept requests from:

- `https://smcf.app`
- `https://www.smcf.app`
- Development: `http://localhost:5173`, `http://localhost:8080`, `http://localhost:3000`

### 4. Test the Connection

1. Visit `https://smcf.app`
2. Try logging in as admin
3. Test payment integration
4. Verify Socket.IO real-time updates work

## Local Development

### Frontend (.env)

```
VITE_API_URL=http://localhost:4000
```

### Backend (.env)

```
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

## Important Notes

- ⚠️ Never commit `.env` files to Git
- ✅ Always use `.env.example` as a template
- 🔒 Keep sensitive credentials (API keys, MongoDB URI) secure
- 🔄 Update environment variables in both platforms when changing configuration
