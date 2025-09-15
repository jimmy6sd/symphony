const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Helper function to verify JWT token
const verifyToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid authorization header');
  }

  const token = authHeader.substring(7);
  return jwt.verify(token, JWT_SECRET);
};

// Helper function to read data files
const readDataFile = (filename) => {
  const filePath = path.join(process.cwd(), 'data', filename);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    // Verify JWT token
    const authHeader = event.headers.authorization;
    const decoded = verifyToken(authHeader);

    // Load dashboard data from cached files
    const rawData = readDataFile('dashboard-performances.json') ||
                   readDataFile('final-performances-in-range.json') ||
                   readDataFile('performances.json');

    const summaryData = readDataFile('fetch-summary.json');
    const seasonData = readDataFile('dashboard-seasons.json');

    if (!rawData) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          message: 'No performance data available. Please run data fetch first.'
        })
      };
    }

    // Extract performances array from the data structure
    const performanceData = rawData.performances || rawData;

    // Return dashboard data
    const dashboardData = {
      performances: performanceData,
      summary: summaryData,
      seasons: seasonData,
      metadata: {
        lastUpdated: new Date().toISOString(),
        dataCount: Array.isArray(performanceData) ? performanceData.length : 0,
        user: {
          username: decoded.username,
          role: decoded.role
        }
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(dashboardData)
    };

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Token expired' })
      };
    } else if (error.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Invalid token' })
      };
    }

    console.error('Dashboard data error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};