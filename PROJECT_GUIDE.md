# Project Root Configuration

## Recommended IDE Settings for VS Code

### Extensions to Install
1. REST Client (humao.rest-client)
2. ES7+ React/Redux/React-Native snippets (dsznajder.es7-react-js-snippets)
3. Prettier - Code formatter (esbenp.prettier-vscode)
4. Thunder Client (rangav.vscode-thunder-client)

### VS Code Settings (.vscode/settings.json)
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "files.exclude": {
    "node_modules": true,
    ".env": true,
    "logs": true
  }
}
```

## Quick Start Commands

### Terminal 1 - Backend
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:5000
```

### Terminal 2 - Frontend
```bash
cd frontend
npm install
npm start
# Opens http://localhost:3000
```

### Database Setup
```bash
mysql -u root -p < database/schema.sql
```

## Project Directories

- **backend/** - Node.js API server
- **frontend/** - React PWA application
- **database/** - SQL schema and setup
- **docs/** - Documentation

## Key Files to Edit

### Backend Configuration
- `backend/.env` - Database and server config
- `backend/src/index.js` - Server entry point
- `backend/config/database.js` - DB connection

### Frontend Configuration
- `frontend/.env` - API URL
- `frontend/src/App.js` - Main app component
- `frontend/src/services/api.js` - API client

## Default Ports

- Backend API: `http://localhost:5000`
- Frontend App: `http://localhost:3000`
- MySQL: `localhost:3306`

## Documentation Files

1. **README.md** - Project overview and features
2. **docs/SETUP.md** - Installation instructions
3. **docs/ARCHITECTURE.md** - System design
4. **docs/API.md** - API reference

## Test Users (to be created)

**Admin:**
- Email: admin@school.com
- Password: (set during setup)

**Sample Student:**
- Student ID: STU-1234567 (generated during registration)
- Password: (set during registration)

## Common Commands

```bash
# Backend
npm run dev              # Start development server
npm test                 # Run tests
npm run build            # Build for production

# Frontend
npm start                # Start development server
npm test                 # Run tests
npm run build            # Build for production
```

## Useful Links

- React Docs: https://react.dev
- Express Docs: https://expressjs.com
- MySQL Docs: https://dev.mysql.com/doc
- REST API Design: https://restfulapi.net

## Troubleshooting

1. **Port Already in Use:** Kill process or change PORT in .env
2. **Database Connection Failed:** Ensure MySQL is running
3. **CORS Errors:** Check API_URL matches frontend REACT_APP_API_URL
4. **Module Not Found:** Run npm install in that directory

## Production Deployment Checklist

- [ ] Update environment variables
- [ ] Set JWT_SECRET to strong random value
- [ ] Enable HTTPS
- [ ] Configure CORS origins
- [ ] Set up database backups
- [ ] Configure logging
- [ ] Enable rate limiting
- [ ] Test all endpoints
- [ ] Set up monitoring/alerts
