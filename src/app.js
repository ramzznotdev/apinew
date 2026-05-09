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
    const statusColor = res.statusCode < 400 ? '#55efc4' : '#ff7675';
    console.log(
      chalk.hex('#dfe6e9')(`${req.method}`) + ' ' +
      chalk.hex('#74b9ff')(`${req.path}`) + ' ' +
      chalk.hex(statusColor)(`${res.statusCode}`) + ' ' +
      chalk.hex('#b2bec3')(`${duration}ms`)
    );
  });
  next();
});

// API Key validation
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
  site_url: process.env.SITE_URL || "https://ramzzhosting.com",
  contact: {
    email: process.env.OWNER_EMAIL || "admin@ramzzhosting.com",
    whatsapp: process.env.OWNER_WA || "6281234567890"
  }
};

// ==================== GLOBAL JSON WRAPPER ====================
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (data) {
    if (
      typeof data === 'object' &&
      data !== null &&
      !req.path.startsWith('/endpoints') &&
      !req.path.startsWith('/health') &&
      !req.path.startsWith('/docs')
    ) {
      return originalJson.call(this, {
        ...data,
        meta: {
          timestamp: new Date().toISOString(),
          api_version: settings.version
        }
      });
    }
    return originalJson.call(this, data);
  };
  next();
});

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
      // Clear require cache for hot reload in dev
      delete require.cache[require.resolve(fullPath)];
      
      const routes = require(fullPath);
      const handlers = Array.isArray(routes) ? routes : [routes];

      handlers.forEach(route => {
        const { name, desc, category, path: routePath, run } = route;

        if (name && desc && category && routePath && typeof run === 'function') {
          const cleanPath = routePath.split('?')[0]; // Remove query params
          
          // Register route
          app.get(cleanPath, run);
          app.post(cleanPath, run); // Support both GET & POST

          // Simpan metadata
          if (!rawEndpoints[category]) rawEndpoints[category] = [];
          rawEndpoints[category].push({
            name,
            desc,
            path: routePath,
            method: 'GET/POST'
          });

          totalRoutes++;
          console.log(
            chalk.hex('#55efc4')(`✔ Loaded: `) +
            chalk.hex('#ffeaa7')(`${cleanPath}`) +
            chalk.hex('#b2bec3')(` → ${name}`)
          );
        } else {
          console.warn(
            chalk.bgRed.white(` ⚠ Skipped invalid route in ${file}`)
          );
        }
      });

    } catch (err) {
      console.error(
        chalk.bgRed.white(` ❌ Error loading ${file}: ${err.message}`)
      );
    }
  });
}

// ==================== ENDPOINTS LIST ====================
const buildEndpoints = () => {
  return Object.keys(rawEndpoints)
    .sort((a, b) => a.localeCompare(b))
    .reduce((sorted, category) => {
      sorted[category] = rawEndpoints[category].sort(
        (a, b) => a.name.localeCompare(b.name)
      );
      return sorted;
    }, {});
};

app.get('/endpoints', (req, res) => {
  res.json({
    api: settings.name,
    total_endpoints: totalRoutes,
    total_categories: Object.keys(rawEndpoints).length,
    categories: buildEndpoints()
  });
});

// ==================== HOMEPAGE ====================
app.get('/', (req, res) => {
  res.json({
    message: `Welcome to ${settings.name}`,
    version: settings.version,
    endpoints: `${req.protocol}://${req.get('host')}/endpoints`,
    health: `${req.protocol}://${req.get('host')}/health`,
    docs: `${req.protocol}://${req.get('host')}/docs`
  });
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: `Route ${req.method} ${req.path} not found`,
    hint: `Check available endpoints at /endpoints`
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error(chalk.red('Server Error:'), err.message);
  res.status(500).json({
    error: true,
    message: 'Internal Server Error',
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== START SERVER ====================
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('');
    console.log(chalk.hex('#fdcb6e')('╔══════════════════════════════════╗'));
    console.log(chalk.hex('#fdcb6e')('║') + chalk.hex('#55efc4')(`  🚀 ${settings.name} v${settings.version}  `) + chalk.hex('#fdcb6e')('║'));
    console.log(chalk.hex('#fdcb6e')('╚══════════════════════════════════╝'));
    console.log('');
    console.log(chalk.white(`📡 Server  : http://localhost:${PORT}`));
    console.log(chalk.white(`📚 API Docs: http://localhost:${PORT}/endpoints`));
    console.log(chalk.white(`❤️  Health  : http://localhost:${PORT}/health`));
    console.log(chalk.white(`🔥 Routes  : ${totalRoutes} endpoints loaded`));
    console.log('');
  });
}

module.exports = app;