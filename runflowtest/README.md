# RunFlowTest

**Production-ready PWA for testing user flows with synthetic personas**

## Overview

RunFlowTest is an agentic AI platform that simulates how different user personas navigate your design flows. Identify cognitive load spikes, drop-off points, and mental model mismatches before investing in real usability testing.

## Key Features

- 🔐 **Secure Authentication** - Email + password login with OTP verification
- 🎭 **Synthetic Personas** - Pre-built or custom user personas with behavior traits
- 🔄 **Flow Simulation** - Watch AI personas navigate your workflows
- 📊 **Detailed Reports** - Identify friction points and UX issues
- ⬇️ **Download Results** - Export findings and test protocols
- 📱 **PWA Ready** - Works offline, installable on mobile/desktop
- ⏰ **Ephemeral Data** - All user data auto-deleted after 20 hours
- 🔒 **Privacy-First** - No persistent storage of user projects

## Tech Stack

### Backend
- **PHP 8.0+** - REST API endpoints
- **MySQL/SQLite** - Temporary data storage with auto-cleanup
- **SMTP** - Email verification (OTP)
- **Environment-based config** - Easy deployment

### Frontend
- **React 18** - Modern UI framework
- **Vite** - Fast build tooling
- **React Router** - Client-side routing
- **Axios** - API client with interceptors
- **PWA** - Manifest, service worker, offline support
- **CSS3** - Responsive design, mobile-first

## Project Structure

```
runflowtest/
├── backend/
│   ├── api/
│   │   ├── index.php          # Router
│   │   ├── auth.php           # Login, register, verify
│   │   ├── projects.php       # Project CRUD
│   │   ├── personas.php       # Persona management
│   │   ├── simulations.php    # Run simulations
│   │   └── reports.php        # Generate reports
│   ├── db/
│   │   └── Database.php       # PDO wrapper + cleanup
│   ├── mail/
│   │   └── EmailService.php   # OTP emails
│   └── config.php             # Environment config
├── frontend/
│   ├── src/
│   │   ├── pages/             # Route components
│   │   ├── components/        # Reusable components
│   │   ├── hooks/             # useAuth, API hooks
│   │   ├── utils/             # API client
│   │   ├── styles/            # Component CSS
│   │   ├── App.jsx            # Routes
│   │   └── main.jsx           # Entry point
│   ├── public/
│   │   ├── manifest.json      # PWA manifest
│   │   └── icons/             # App icons
│   ├── index.html             # HTML shell
│   ├── package.json           # Dependencies
│   ├── vite.config.js         # Build config
│   └── .env.example           # Environment template
├── sql/
│   └── schema.sql             # Database tables
└── docs/
    └── API.md                 # API documentation
```

## Setup

### Prerequisites
- PHP 8.0+ with PDO extension
- MySQL 8.0+ or SQLite3
- Node.js 16+ (frontend)
- SMTP access for email (Gmail, SendGrid, etc.)

### Backend Setup

1. **Create database**
   ```bash
   mysql -u root -p < runflowtest/sql/schema.sql
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database and email credentials
   ```

3. **Install PHP dependencies** (if using Composer)
   ```bash
   composer install
   ```

4. **Start PHP development server**
   ```bash
   cd backend
   php -S localhost:8000
   ```

### Frontend Setup

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env.local
   # Edit for your backend URL
   ```

3. **Start dev server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## API Endpoints

### Authentication
- `POST /auth/register` - Create account
- `POST /auth/verify` - Verify email with OTP
- `POST /auth/login` - Login and get session token
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user

### Projects
- `POST /projects` - Create project
- `GET /projects` - List user projects
- `GET /projects/:id` - Get project details
- `DELETE /projects/:id` - Delete project

### Personas
- `POST /personas` - Create persona (custom or preset)
- `GET /personas?project_id=X` - List project personas
- `PUT /personas/:id` - Update persona

### Simulations
- `POST /simulations` - Start simulation run
- `GET /simulations` - List simulations
- `GET /simulations/:id` - Get simulation results

### Reports
- `GET /reports/:id` - Generate report (JSON/PDF)

## Data Retention Policy

- **Session TTL**: 20 hours
- **User Data TTL**: 20 hours
- **Auto-cleanup**: Runs every hour, removes expired records
- **No Persistence**: Projects and simulations deleted after 20 hours

## Deployment

### Using Docker
```bash
docker build -t runflowtest .
docker run -p 8000:8000 -e DB_TYPE=sqlite runflowtest
```

### On Shared Hosting (poojakudesia.in)

1. Upload backend to `public_html/runflowtest/backend/`
2. Upload frontend build (`dist/`) to `public_html/runflowtest/`
3. Create database and configure `.env`
4. Set up cron job for cleanup:
   ```bash
   0 */1 * * * curl http://poojakudesia.in/runflowtest/api/cleanup
   ```

## Security Considerations

- Passwords hashed with bcrypt (cost: 12)
- CORS restricted to whitelisted origins
- Rate limiting recommended on auth endpoints
- HTTPS required in production
- JWT tokens stored in localStorage (XSS vulnerable - implement refresh tokens for better security)

## Future Enhancements

- [ ] Complete personas CRUD API
- [ ] AI-powered simulation engine (Claude API integration)
- [ ] Real-time simulation progress
- [ ] PDF report generation
- [ ] Team/project sharing (with TTL)
- [ ] Heatmap visualization of drop-off points
- [ ] Custom prompt templates for personas
- [ ] Export test protocols as documents
- [ ] Mobile app via React Native

## License

MIT

## Support

For issues or questions, contact: support@poojakudesia.in
