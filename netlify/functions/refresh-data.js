const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// TEMPORARY: Disable authentication for development/testing
// This flag should match the authDisabled flag in js/auth.js
const AUTH_DISABLED = true; // Set to false to re-enable authentication

// Helper function to verify JWT token
const verifyToken = (authHeader) => {
  // TEMPORARY: Skip authentication if disabled
  if (AUTH_DISABLED) {
    return {
      username: 'dev-user',
      role: 'admin'
    };
  }

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET;
  
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid authorization header');
  }

  const token = authHeader.substring(7);
  return jwt.verify(token, JWT_SECRET);
};

// Helper function to run data fetch script
const runDataFetch = () => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'fetch-tessitura-data-cached.js');
    
    // Check if script exists
    fs.access(scriptPath).then(() => {
      const child = spawn('node', [scriptPath], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            output: stdout,
            code: code
          });
        } else {
          reject(new Error(`Data fetch failed with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to start data fetch: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        child.kill();
        reject(new Error('Data fetch timed out after 60 seconds'));
      }, 60000);

    }).catch(() => {
      reject(new Error('Data fetch script not found'));
    });
  });
};

// Helper function to get cache status
const getCacheStatus = async () => {
  try {
    const cacheMetadataPath = path.join(process.cwd(), 'data', 'cache-metadata.json');
    const metadata = JSON.parse(await fs.readFile(cacheMetadataPath, 'utf8'));
    return metadata;
  } catch (error) {
    return { error: 'No cache metadata available' };
  }
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    // Verify JWT token (skip if authentication disabled)
    const authHeader = event.headers.authorization;
    const decoded = verifyToken(authHeader);

    console.log('Starting data refresh...');
    const startTime = Date.now();

    // Get current cache status
    const beforeCache = await getCacheStatus();

    // Run the data fetch script
    const result = await runDataFetch();

    // Get updated cache status
    const afterCache = await getCacheStatus();

    const duration = Date.now() - startTime;

    console.log('Data refresh completed successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Data refresh completed successfully',
        user: {
          username: decoded.username,
          role: decoded.role
        },
        refresh: {
          success: true,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString()
        },
        cache: {
          before: beforeCache,
          after: afterCache
        },
        output: result.output?.substring(0, 1000) // Limit output size
      })
    };

  } catch (error) {
    console.error('Data refresh error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Data refresh failed',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};