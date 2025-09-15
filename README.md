# Symphony Dashboard

Secure analytics dashboard for symphony ticket sales data with real-time Tessitura API integration.

## 🚀 Features

### Core Features
- **Secure Authentication**: JWT-based login system with rate limiting
- **Real-time Data**: Direct integration with Tessitura production API
- **Interactive Visualizations**: D3.js charts for sales analysis
- **Data Export**: CSV/JSON export capabilities
- **Responsive Design**: Mobile-friendly interface
- **Serverless Architecture**: Deploys to Netlify with Functions

### New Architecture Features
- **Organized Codebase**: Modern modular structure with clear separation of concerns
- **Advanced Error Handling**: Comprehensive error management with user-friendly messages
- **Centralized Logging**: Multi-level logging system with export capabilities
- **Configuration Management**: Environment-aware configuration with runtime updates
- **Component System**: Base component class with lifecycle management
- **Progressive Loading**: Intelligent script loading with dependency management

## 🛠️ Local Development

### Prerequisites

- Node.js 18+
- Netlify CLI (`npm install -g netlify-cli`)

### Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables** in `.env`:
   ```bash
   # Required: Tessitura API credentials
   TESSITURA_BASE_URL=https://your-instance.cloud/tessitura/api
   TESSITURA_USERNAME=your_username
   TESSITURA_PASSWORD=your_password
   TESSITURA_USER_GROUP=your_usergroup
   TESSITURA_MACHINE_LOCATION=your_location

   # Required: Dashboard authentication
   DASHBOARD_AUTH_USERNAME=admin
   DASHBOARD_AUTH_PASSWORD=your_secure_password

   # Required: JWT security (generate a secure random string)
   JWT_SECRET=your-32-character-minimum-secret-key
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Access the application:**
   - Dashboard: http://localhost:8888
   - Login with credentials from your `.env` file

## 📦 Netlify Deployment

### Automated Deployment

1. **Connect to Netlify:**
   - Link your GitHub repository to Netlify
   - Set build command: `npm run build`
   - Set publish directory: `.`

2. **Configure Environment Variables** in Netlify dashboard:
   ```
   TESSITURA_BASE_URL
   TESSITURA_USERNAME
   TESSITURA_PASSWORD
   TESSITURA_USER_GROUP
   TESSITURA_MACHINE_LOCATION
   DASHBOARD_AUTH_USERNAME
   DASHBOARD_AUTH_PASSWORD
   JWT_SECRET (generate a new secure key for production)
   NODE_ENV=production
   ```

3. **Deploy:**
   - Push to your repository
   - Netlify will automatically build and deploy

### Manual Deployment

```bash
# Build and deploy
netlify login
netlify deploy --prod
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based auth with expiration
- **Rate Limiting**: Protects against brute force attacks
- **Environment Variables**: All secrets stored securely
- **HTTPS Only**: Enforced secure connections
- **CORS Protection**: Restricted API access
- **XSS Protection**: Content Security Policy headers

## 📊 Data Flow

1. **Authentication**: Users log in with credentials
2. **Token Generation**: Server issues JWT token
3. **API Requests**: Client includes token in requests
4. **Data Fetching**: Server fetches from Tessitura API using stored credentials
5. **Dashboard Display**: Data visualized in D3.js charts

## 🔧 Configuration

### Performance Goals
Configure default occupancy and budget goals in `js/config.js`:

```javascript
performances: {
    defaultOccupancyGoal: 85, // percentage
    defaultBudgetGoal: 100000, // dollars
}
```

### Sales Curves
Customize expected sales progression curves:

```javascript
expectedSalesProgression: [
    { week: 1, percentage: 5 },
    { week: 2, percentage: 12 },
    // ... continue pattern
]
```

## 📈 Usage

1. **Login**: Access the dashboard with your configured credentials
2. **View Data**: Interactive charts show sales performance
3. **Analyze Trends**: Compare actual vs. expected sales curves
4. **Export Data**: Download performance data as CSV or JSON
5. **Logout**: Secure session termination

## 🐛 Troubleshooting

### Common Issues

**Authentication Fails:**
- Check environment variables are set correctly
- Verify JWT_SECRET is at least 32 characters
- Ensure credentials match what's configured

**Data Not Loading:**
- Verify Tessitura API credentials
- Check network connectivity
- Review Netlify Function logs

**Build Errors:**
- Ensure Node.js version 18+
- Clear node_modules and reinstall
- Check all environment variables are set

### Debugging

Enable debug mode by setting in browser console:
```javascript
localStorage.setItem('debug', 'true');
```

## 📝 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run fetch-data` - Fetch latest Tessitura data
- `npm run daily-refresh` - Run data refresh routine

## 🔒 Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `TESSITURA_BASE_URL` | Tessitura API base URL | Yes | `https://instance.cloud/tessitura/api` |
| `TESSITURA_USERNAME` | API username | Yes | `apiuser` |
| `TESSITURA_PASSWORD` | API password | Yes | `secure_password` |
| `TESSITURA_USER_GROUP` | User group | Yes | `webapi` |
| `TESSITURA_MACHINE_LOCATION` | Machine location | Yes | `location1` |
| `DASHBOARD_AUTH_USERNAME` | Dashboard login | Yes | `admin` |
| `DASHBOARD_AUTH_PASSWORD` | Dashboard password | Yes | `secure_pass` |
| `JWT_SECRET` | JWT signing key | Yes | `32+ character string` |
| `JWT_EXPIRY` | Token lifetime | No | `24h` (default) |
| `NODE_ENV` | Environment | No | `production` |

## 📞 Support

For issues or questions:
1. Check this README
2. Review Netlify Function logs
3. Check browser console for errors
4. Verify all environment variables are set correctly