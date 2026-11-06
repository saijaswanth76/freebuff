require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const mongoSanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { UPLOAD_DIR } = require('./middleware/upload');

const app = express();

/* ------------------------------ Security ------------------------------ */
app.set('trust proxy', 1);
app.use(
  helmet({
    // Uploaded food images are embedded by the React dev server on another port.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

const clientOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / non-browser clients (Postman, curl) and whitelisted frontends.
      if (!origin || clientOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

/* ------------------------------ Parsers ------------------------------- */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(mongoSanitize);

/* ------------------------------ Logging ------------------------------- */
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api')) {
        console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
      }
    });
    next();
  });
}

/* ---------------------------- Rate limiting --------------------------- */
if (process.env.NODE_ENV !== 'test') {
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: Number(process.env.API_RATE_LIMIT || 600),
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, message: 'Too many requests. Please slow down and try again.' },
    })
  );
}

/* ------------------------------- Static ------------------------------- */
app.use('/uploads', express.static(UPLOAD_DIR, { dotfiles: 'deny', maxAge: '1d', index: false }));

/* -------------------------------- API --------------------------------- */
app.use('/api', require('./routes'));

// Serve the built React frontend for every non-API route so client-side
// routing (React Router) handles page refreshes and direct URLs like
// /donor, /ngo, /volunteer, /admin instead of hitting the 404 handler.
const path = require('path');
const FRONTEND_DIST = path.resolve(__dirname, '..', 'client', 'dist');
app.use(express.static(FRONTEND_DIST, { index: 'index.html', maxAge: '1h' }));
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

/* --------------------------- Error handling --------------------------- */
app.use(notFound);
app.use(errorHandler);

module.exports = app;
