const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import helpers
require('./helpers/global');

const app = express();
const PORT = process.env.PORT || 4000;

// ==================== MIDDLEWARE ====================
app.enable("trust proxy");
app.set("json spaces", 2);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

// Request logger
app.use((req, res, next) => {
  global.totalreq = (global.totalreq || 0) + 1;
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// API Key middleware
const authMiddleware = require('./middleware/auth');
app.use('/api', authMiddleware);

// ==================== SETTINGS ====================
const settings = {
  name: "RAMZZ HOSTING API",
  version: "1.0.0",
  description: "Payment Gateway & Order Management REST API",
  creator: "RamzzNotDev",
  docs: "/endpoints",
  health: "/health",
  site_url: process.env.SITE_URL || "https://new-ramzzhostt.vercel.app"
};

// ==================== STATIC ROUTES ====================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    total_requests: global.totalreq || 0
  });
});

app.get('/settings', (req, res) => res.json(settings));

// ==================== DYNAMIC ROUTE LOADER ====================
const rawEndpoints = {};
let totalRoutes = 0;
const apiFolder = path.join(__dirname, 'api');

if (fs.existsSync(apiFolder)) {
  const files = fs.readdirSync(apiFolder);

  files.forEach(file => {
    if (!file.endsWith('.js')) return;

    const fullPath = path.join(apiFolder, file);

    try {
      delete require.cache[require.resolve(fullPath)];
      const routes = require(fullPath);
      const handlers = Array.isArray(routes) ? routes : [routes];

      handlers.forEach(route => {
        const { name, desc, category, path: routePath, run } = route;

        if (name && desc && category && routePath && typeof run === 'function') {
          const cleanPath = routePath.split('?')[0];

          app.get(cleanPath, run);
          app.post(cleanPath, run);

          if (!rawEndpoints[category]) rawEndpoints[category] = [];
          rawEndpoints[category].push({
            name,
            desc,
            path: routePath,
            method: 'GET/POST'
          });

          totalRoutes++;
          console.log(chalk.green(`✔ Loaded: ${cleanPath} → ${name}`));
        }
      });
    } catch (err) {
      console.error(chalk.red(`❌ Error loading ${file}: ${err.message}`));
    }
  });
}

// ==================== ENDPOINTS LIST ====================
app.get('/endpoints', (req, res) => {
  const endpoints = Object.keys(rawEndpoints)
    .sort()
    .reduce((sorted, category) => {
      sorted[category] = rawEndpoints[category].sort((a, b) => a.name.localeCompare(b.name));
      return sorted;
    }, {});

  res.json({
    api: settings.name,
    version: settings.version,
    total_endpoints: totalRoutes,
    total_categories: Object.keys(rawEndpoints).length,
    categories: endpoints
  });
});

// ==================== HOMEPAGE ====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== 404 ====================
app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: `Route ${req.method} ${req.path} not found`,
    hint: 'Check /endpoints for available routes'
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({
    error: true,
    message: 'Internal Server Error'
  });
});

// ==================== START SERVER ====================
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('');
    console.log(chalk.yellow('╔══════════════════════════════╗'));
    console.log(chalk.yellow('║') + chalk.green(`  🚀 ${settings.name} v${settings.version}  `) + chalk.yellow('║'));
    console.log(chalk.yellow('╚══════════════════════════════╝'));
    console.log('');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`📚 Docs: http://localhost:${PORT}/endpoints`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);
    console.log(`🔥 Routes: ${totalRoutes} endpoints`);
    console.log('');
  });
}

module.exports = app;
