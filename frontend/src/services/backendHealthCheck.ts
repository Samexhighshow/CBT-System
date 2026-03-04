/**
 * Backend Health Checker
 * Diagnoses connectivity issues with the Laravel backend
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

interface HealthCheckResult {
  status: 'online' | 'offline' | 'error';
  message: string;
  details?: {
    apiUrl: string;
    responseTime?: number;
    statusCode?: number;
    authenticated?: boolean;
    userRole?: string;
  };
}

export const checkBackendHealth = async (): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    // Try the health endpoint first
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        status: 'online',
        message: 'Backend API is running',
        details: {
          apiUrl: API_BASE_URL,
          responseTime,
          statusCode: response.status,
        },
      };
    } else {
      return {
        status: 'error',
        message: `API returned status ${response.status}`,
        details: {
          apiUrl: API_BASE_URL,
          responseTime,
          statusCode: response.status,
        },
      };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        status: 'offline',
        message: 'Backend API timeout (took > 5 seconds)',
        details: {
          apiUrl: API_BASE_URL,
        },
      };
    }
    
    if (error.message?.includes('Failed to fetch') || error.code === 'ECONNREFUSED') {
      return {
        status: 'offline',
        message: 'Backend API is not running. Start it with: php artisan serve',
        details: {
          apiUrl: API_BASE_URL,
        },
      };
    }
    
    return {
      status: 'error',
      message: error.message || 'Unknown error checking backend',
      details: {
        apiUrl: API_BASE_URL,
      },
    };
  }
};

export const checkAuthentication = async (): Promise<boolean> => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;
    
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    
    return response.ok;
  } catch {
    return false;
  }
};

export const diagnoseConnection = async (): Promise<string[]> => {
  const issues: string[] = [];
  
  // Check backend health
  const health = await checkBackendHealth();
  if (health.status === 'offline') {
    issues.push('❌ Backend API is not running');
    issues.push(`   Expected at: ${health.details?.apiUrl}`);
    issues.push('   Fix: Run "php artisan serve" in the backend directory');
  } else if (health.status === 'error') {
    issues.push(`⚠️  Backend API error: ${health.message}`);
  }
  
  // Check authentication
  const hasToken = !!localStorage.getItem('auth_token');
  if (!hasToken) {
    issues.push('❌ No authentication token found');
    issues.push('   Fix: Log in again');
  } else {
    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
      issues.push('❌ Authentication token is invalid or expired');
      issues.push('   Fix: Log in again');
    }
  }
  
  if (issues.length === 0) {
    issues.push('✅ All checks passed');
  }
  
  return issues;
};

export default {
  checkBackendHealth,
  checkAuthentication,
  diagnoseConnection,
};
