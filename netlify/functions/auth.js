const jwt = require('jsonwebtoken');

// Security configuration - ALL FROM ENVIRONMENT VARIABLES
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Ensure JWT secret is set
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Rate limiting (simple in-memory store - in production use Redis)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    const { username, password } = JSON.parse(event.body);

    // Get IP for rate limiting
    const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';

    // Check rate limiting
    const attempts = loginAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
    const now = Date.now();

    if (attempts.count >= MAX_ATTEMPTS && (now - attempts.lastAttempt) < LOCKOUT_TIME) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          message: 'Too many login attempts. Please try again in 15 minutes.'
        })
      };
    }

    // Reset attempts if lockout time has passed
    if ((now - attempts.lastAttempt) >= LOCKOUT_TIME) {
      attempts.count = 0;
    }

    // Validate credentials - MUST be from environment variables
    const validUsername = process.env.DASHBOARD_AUTH_USERNAME;
    const validPassword = process.env.DASHBOARD_AUTH_PASSWORD;

    if (!validUsername || !validPassword) {
      console.error('Missing DASHBOARD_AUTH_USERNAME or DASHBOARD_AUTH_PASSWORD environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: 'Server configuration error' })
      };
    }

    if (username !== validUsername || password !== validPassword) {
      // Increment failed attempts
      attempts.count++;
      attempts.lastAttempt = now;
      loginAttempts.set(clientIP, attempts);

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }

    // Reset attempts on successful login
    loginAttempts.delete(clientIP);

    // Generate JWT token
    const token = jwt.sign(
      {
        username: username,
        role: 'admin',
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // Calculate expiry time
    const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token: token,
        expires: expiryTime.toISOString(),
        user: {
          username: username,
          role: 'admin'
        }
      })
    };

  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};