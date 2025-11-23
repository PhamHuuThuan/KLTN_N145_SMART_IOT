import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();
app.use(cors());
// Do NOT parse JSON globally to avoid interfering with proxying request bodies
// Proxied requests will stream the original body; fixRequestBody handles parsed bodies if any

// Simple request logging middleware
app.use((req, res, next) => {
  const startTimeMs = Date.now();
  const { method, originalUrl } = req;
  const ip = req.ip || req.connection?.remoteAddress || '';

  // Capture basic user info if token present (non-blocking)
  let userId = '';
  let userRole = '';
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'your-strong-secret');
      userId = payload?.sub || '';
      userRole = payload?.role || '';
    } catch (_) {
      // ignore token errors in logger
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  // Minimal logging; detailed request body logs removed
  res.on('finish', () => {
    const durationMs = Date.now() - startTimeMs;
    const status = res.statusCode;
    logger.info('request_completed', {
      method,
      path: originalUrl,
      status,
      durationMs,
      ip,
      userId,
      userRole,
      proxiedUrl: req.proxiedUrl || undefined
    });
  });

  next();
});

// Configurable service base URLs
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3005';
const DEVICES_SERVICE_URL = process.env.DEVICES_SERVICE_URL || 'http://localhost:3002';
const RULES_SERVICE_URL = process.env.RULES_SERVICE_URL || 'http://localhost:3003';
const ALERTS_SERVICE_URL = process.env.ALERTS_SERVICE_URL || 'http://localhost:3004';

// JWT verification middleware
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// Health
app.get('/health', (_req, res) => res.json({ ok: true, message: 'API Gateway running' }));

// Public routes → auth-service (preserve path)
app.use(
  '/auth',
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
      logLevel: 'silent',
      pathRewrite: (path, req) => req.originalUrl,
    onProxyReq: (proxyReq, req, res) => {
        // Forward Authorization header/token to downstream service if present
        const incomingAuthHeader = req.headers.authorization;
        if (incomingAuthHeader) {
          proxyReq.setHeader('authorization', incomingAuthHeader);
          // Also provide the raw token (without Bearer prefix) for services that expect it
          const rawToken = incomingAuthHeader.startsWith('Bearer ')
            ? incomingAuthHeader.slice(7)
            : incomingAuthHeader;
          proxyReq.setHeader('x-access-token', rawToken);
        }
      // Ensure JSON body is forwarded for POST/PUT/PATCH
      fixRequestBody(proxyReq, req);
        // Track destination for summary logging
        try { req.proxiedUrl = new URL(req.originalUrl, AUTH_SERVICE_URL).toString(); } catch (_) {}
    },
    onError: (err, req, res) => {
      console.error('Proxy error (auth):', err?.message || err);
      if (!res.headersSent) {
        res.status(502).json({ error: 'gateway_proxy_error', message: String(err?.message || err) });
      }
    },
      onProxyRes: (_proxyRes, _req, _res) => {}
  })
);

// Protected proxies
function secureProxy(targetBaseUrl) {
  return [
    authenticateToken,
    createProxyMiddleware({
      target: targetBaseUrl,
      changeOrigin: true,
      logLevel: 'silent',
      pathRewrite: (path, req) => req.originalUrl,
      onProxyReq: (proxyReq, req, res) => {
        // Always forward the original Authorization header/token downstream
        const incomingAuthHeader = req.headers.authorization;
        if (incomingAuthHeader) {
          proxyReq.setHeader('authorization', incomingAuthHeader);
          const rawToken = incomingAuthHeader.startsWith('Bearer ')
            ? incomingAuthHeader.slice(7)
            : incomingAuthHeader;
          proxyReq.setHeader('x-access-token', rawToken);
        }
        // Forward user info as headers for downstream services if they want it
        if (req.user) {
          proxyReq.setHeader('x-user-id', req.user.sub || '');
          proxyReq.setHeader('x-user-role', req.user.role || 'user');
        }
        // Ensure JSON body is forwarded for POST/PUT/PATCH
        fixRequestBody(proxyReq, req);
        // Track destination for summary logging
        try { req.proxiedUrl = new URL(req.originalUrl, targetBaseUrl).toString(); } catch (_) {}
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', req.method, req.originalUrl, '-', err?.message || err);
        if (!res.headersSent) {
          res.status(502).json({ error: 'gateway_proxy_error', message: String(err?.message || err) });
        }
      },
      onProxyRes: (_proxyRes, _req, _res) => {}
    })
  ];
}

// Devices service (preserve '/api/devices' path for downstream)
app.use('/api/devices', ...secureProxy(DEVICES_SERVICE_URL));

// Logs service (part of devices-service, preserve '/api/logs' path)
// Use optional auth proxy since devices-service uses optionalAuth for logs
function optionalAuthProxy(targetBaseUrl) {
  return [
    createProxyMiddleware({
      target: targetBaseUrl,
      changeOrigin: true,
      logLevel: 'silent',
      pathRewrite: (path, req) => req.originalUrl,
      onProxyReq: (proxyReq, req, res) => {
        const incomingAuthHeader = req.headers.authorization;
        if (incomingAuthHeader) {
          proxyReq.setHeader('authorization', incomingAuthHeader);
          const rawToken = incomingAuthHeader.startsWith('Bearer ')
            ? incomingAuthHeader.slice(7)
            : incomingAuthHeader;
          proxyReq.setHeader('x-access-token', rawToken);
          try {
            const payload = jwt.verify(rawToken, JWT_SECRET);
            proxyReq.setHeader('x-user-id', payload?.sub || '');
            proxyReq.setHeader('x-user-role', payload?.role || 'user');
          } catch (_) {
            // Token invalid or missing - allow request to proceed (optional auth)
          }
        }
        fixRequestBody(proxyReq, req);
        try { req.proxiedUrl = new URL(req.originalUrl, targetBaseUrl).toString(); } catch (_) {}
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', req.method, req.originalUrl, '-', err?.message || err);
        if (!res.headersSent) {
          res.status(502).json({ error: 'gateway_proxy_error', message: String(err?.message || err) });
        }
      },
      onProxyRes: (_proxyRes, _req, _res) => {}
    })
  ];
}

app.use('/api/logs', ...optionalAuthProxy(DEVICES_SERVICE_URL));

// Rules service (preserve '/api/rules')
app.use('/api/rules', ...secureProxy(RULES_SERVICE_URL));

// Alerts/notifications service (preserve '/api/notifications')
app.use('/api/notifications', ...secureProxy(ALERTS_SERVICE_URL));

// WebSocket proxies
// Create proxy instances so we can handle upgrade events explicitly
const devicesWsProxy = createProxyMiddleware({
  target: DEVICES_SERVICE_URL,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/ws/devices': '/socket.io' },
  logLevel: 'silent'
});
app.use('/ws/devices', devicesWsProxy);

const notificationsWsProxy = createProxyMiddleware({
  target: ALERTS_SERVICE_URL,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/ws/notifications': '/socket.io' },
  logLevel: 'silent'
});
app.use('/ws/notifications', notificationsWsProxy);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info('api_gateway_listening', { port: PORT });
  logger.info('proxy_targets', { AUTH_SERVICE_URL, DEVICES_SERVICE_URL, RULES_SERVICE_URL, ALERTS_SERVICE_URL });
});

// Explicitly proxy upgrade requests for socket.io
server.on('upgrade', (req, socket, head) => {
  try {
    const url = req.url || '';
    if (url.startsWith('/ws/devices')) {
      devicesWsProxy.upgrade(req, socket, head);
      return;
    }
    if (url.startsWith('/ws/notifications')) {
      notificationsWsProxy.upgrade(req, socket, head);
      return;
    }
  } catch (e) {
    try { socket.destroy(); } catch (_) {}
  }
});


