# Deployment Checklist

Use this checklist to ensure everything is configured correctly before and after deployment.

## Pre-Deployment Checklist

### MongoDB Atlas
- [ ] MongoDB Atlas account created
- [ ] Cluster created (M0 free tier or higher)
- [ ] Database user created with strong password
- [ ] Network access configured (0.0.0.0/0 or specific IPs)
- [ ] Connection string obtained
- [ ] Database name set to `smcf-sacco`
- [ ] Connection tested locally

### Backend Configuration
- [ ] `.env` file created from `.env.example`
- [ ] `MONGODB_URI` updated with Atlas connection string
- [ ] `JWT_SECRET` generated (32+ characters random string)
- [ ] `JWT_EXPIRE` set appropriately (e.g., 7d)
- [ ] `FRONTEND_URL` configured (production URL)
- [ ] `NODE_ENV` will be set to `production` in Render
- [ ] All sensitive data in `.env` (not committed to git)
- [ ] `.gitignore` includes `.env` and `node_modules`

### Code Quality
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] All dependencies in `package.json`
- [ ] No console.logs with sensitive data
- [ ] Error handling implemented
- [ ] Input validation on all routes
- [ ] CORS configured correctly

### Security
- [ ] Strong JWT secret (32+ characters)
- [ ] Passwords hashed with bcrypt
- [ ] Rate limiting enabled
- [ ] Helmet security headers configured
- [ ] Input sanitization implemented
- [ ] SQL injection protection (using Mongoose)
- [ ] XSS protection enabled

### Testing
- [ ] Health endpoint works (`/health`)
- [ ] Authentication endpoints tested (register, login)
- [ ] All CRUD operations tested
- [ ] Error responses tested
- [ ] Authorization tested (role-based access)

## Render Deployment Checklist

### Repository Setup
- [ ] Code pushed to GitHub/GitLab
- [ ] Repository is accessible
- [ ] `.gitignore` excludes `.env` and build files
- [ ] `README.md` is clear and updated

### Render Configuration
- [ ] Render account created
- [ ] New Web Service created
- [ ] Repository connected
- [ ] Correct branch selected (main/master)
- [ ] Root directory set (if backend in subdirectory)
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm start`
- [ ] Environment set to Node

### Environment Variables in Render
- [ ] `NODE_ENV=production`
- [ ] `PORT=5000` (or let Render assign)
- [ ] `MONGODB_URI` (your Atlas connection string)
- [ ] `JWT_SECRET` (strong random string)
- [ ] `JWT_EXPIRE=7d`
- [ ] `FRONTEND_URL` (your frontend production URL)
- [ ] `RATE_LIMIT_WINDOW_MS=900000`
- [ ] `RATE_LIMIT_MAX_REQUESTS=100`

### Deployment
- [ ] Deploy button clicked
- [ ] Build logs checked for errors
- [ ] Deployment successful
- [ ] Service URL obtained

## Post-Deployment Verification

### Backend Health
- [ ] Health endpoint accessible: `https://your-app.onrender.com/health`
- [ ] Returns 200 status code
- [ ] MongoDB connection successful (check logs)
- [ ] No error logs in Render dashboard

### API Testing
- [ ] Login endpoint works
- [ ] Registration endpoint works
- [ ] Protected routes require authentication
- [ ] GET requests work (members, loans, etc.)
- [ ] POST requests work (create member, apply loan)
- [ ] PUT requests work (update, approve)
- [ ] DELETE requests work
- [ ] CORS allows frontend requests

### Database
- [ ] MongoDB Atlas shows connections
- [ ] Data is being written correctly
- [ ] Indexes are created
- [ ] No connection errors

### Seed Data (Optional)
- [ ] Admin user created
- [ ] Sample data loaded
- [ ] Can login with admin credentials

## Frontend Integration Checklist

### Configuration
- [ ] Frontend `.env` updated with backend URL
- [ ] `VITE_API_URL=https://your-backend.onrender.com/api`
- [ ] API client configured (axios)
- [ ] Authentication interceptors set up

### Code Updates
- [ ] Supabase imports removed
- [ ] All hooks updated to use REST API
- [ ] Auth context updated
- [ ] Data fetching updated
- [ ] Error handling implemented

### Testing
- [ ] Can register new user
- [ ] Can login
- [ ] JWT token stored in localStorage
- [ ] Protected pages work
- [ ] Data loads correctly
- [ ] CRUD operations work
- [ ] Notifications work
- [ ] Dashboard shows data

### Deployment
- [ ] Frontend built for production
- [ ] Environment variables set in host (Vercel/Netlify)
- [ ] CORS allows frontend domain
- [ ] HTTPS working
- [ ] All features tested in production

## Performance Checklist

### Backend
- [ ] Response times acceptable (<200ms for simple queries)
- [ ] Database queries optimized
- [ ] Indexes created on frequently queried fields
- [ ] pagination implemented for large datasets
- [ ] Compression enabled

### Database
- [ ] Connection pooling configured
- [ ] Slow queries identified
- [ ] Indexes optimized
- [ ] Data size monitored

## Monitoring & Maintenance

### Setup Monitoring
- [ ] Render logs reviewed regularly
- [ ] MongoDB Atlas metrics monitored
- [ ] Error tracking set up (optional: Sentry)
- [ ] Uptime monitoring (optional: UptimeRobot)

### Regular Checks
- [ ] Check server logs weekly
- [ ] Monitor database performance
- [ ] Check for security updates
- [ ] Review audit logs
- [ ] Check disk space usage
- [ ] Monitor API response times

### Backups
- [ ] MongoDB automatic backups enabled (Atlas)
- [ ] Backup schedule configured
- [ ] Restore procedure tested

## Security Maintenance

### Regular Tasks
- [ ] Update dependencies monthly (`npm audit`)
- [ ] Review and rotate JWT secrets quarterly
- [ ] Monitor failed login attempts
- [ ] Review audit logs
- [ ] Check for unusual API activity
- [ ] Update TLS/SSL certificates (automatic with Render)

### Access Control
- [ ] Review user roles and permissions
- [ ] Remove inactive users
- [ ] Audit admin access
- [ ] Review API rate limits

## Troubleshooting Checklist

If something goes wrong:

### Backend Issues
- [ ] Check Render deployment logs
- [ ] Verify all environment variables
- [ ] Test MongoDB connection
- [ ] Check for syntax errors in logs
- [ ] Verify Node.js version compatibility
- [ ] Check memory usage

### Database Issues
- [ ] Verify MongoDB Atlas is running
- [ ] Check network access whitelist
- [ ] Verify connection string
- [ ] Check database user permissions
- [ ] Monitor connection count

### CORS Issues
- [ ] Verify FRONTEND_URL matches exactly
- [ ] Check CORS configuration in server.ts
- [ ] Ensure preflight requests allowed
- [ ] Check browser console for errors

### Authentication Issues
- [ ] Verify JWT_SECRET is set
- [ ] Check token expiration
- [ ] Verify token format
- [ ] Check Authorization header

## Production URLs

After deployment, document your URLs:

```
Backend URL: https://________________________.onrender.com
Frontend URL: https://________________________
API Base URL: https://________________________.onrender.com/api
MongoDB Cluster: ________________________.mongodb.net
```

## Admin Credentials

Document admin credentials securely:

```
Admin Email: ________________________
Admin Password: ________________________ (Change after first login!)
Credit Officer Email: ________________________
Treasurer Email: ________________________
```

## Support Contacts

```
Developer: ________________________
MongoDB Atlas Support: support.mongodb.com
Render Support: render.com/support
```

---

**Date Deployed:** _______________  
**Deployed By:** _______________  
**Version:** _______________

---

## Quick Commands

```bash
# Generate JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Test backend locally
npm run dev

# Build for production
npm run build

# Seed database
npm run seed

# Check logs (Render)
# Go to Dashboard > Your Service > Logs

# Test health endpoint
curl https://your-app.onrender.com/health

# Test login
curl -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smcfsacco.com","password":"admin123"}'
```

---

✅ = Completed  
⏳ = In Progress  
❌ = Blocked/Issue
