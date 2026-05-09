const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ==================== GLOBAL HELPERS ====================
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

global.readDB = (filename) => {
    const filePath = path.join(DATA_DIR, filename);
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '[]');
            return [];
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return [];
    }
};

global.writeDB = (filename, data) => {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

global.formatRupiah = (amount) => 'Rp ' + Number(amount).toLocaleString('id-ID');

global.generateOrderId = () => {
    const now = new Date();
    const r = Math.floor(Math.random() * 9000) + 1000;
    return `INV-${now.getFullYear().toString().slice(-2)}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}${now.getSeconds().toString().padStart(2,'0')}-${r}`;
};

global.totalreq = 0;

// ==================== AUTH MIDDLEWARE ====================
const authMiddleware = (req, res, next) => {
    const publicPaths = ['/api/webhook/', '/health', '/endpoints', '/'];
    
    if (publicPaths.some(p => req.path === p || req.path.startsWith(p))) {
        return next();
    }

    const apiKey = req.query.apikey || req.headers['x-api-key'];
    const validKeys = (process.env.APIKEY || 'rahasia-12345').split(',').map(k => k.trim());

    if (!apiKey || !validKeys.includes(apiKey)) {
        return res.status(401).json({
            error: true,
            message: 'Invalid API key',
            hint: 'Use ?apikey=YOUR_KEY or x-api-key header'
        });
    }
    next();
};

app.use('/api', authMiddleware);

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed,
        requests: global.totalreq
    });
});

// ==================== DYNAMIC ROUTE LOADER ====================
const rawEndpoints = {};
let totalRoutes = 0;
const apiFolder = path.join(__dirname, 'api');

if (fs.existsSync(apiFolder)) {
    fs.readdirSync(apiFolder).forEach(file => {
        if (!file.endsWith('.js')) return;

        try {
            const routes = require(path.join(apiFolder, file));
            const handlers = Array.isArray(routes) ? routes : [routes];

            handlers.forEach(route => {
                const { name, desc, category, path: routePath, run } = route;
                if (!name || !routePath || typeof run !== 'function') return;

                const cleanPath = routePath.split('?')[0];
                app.get(cleanPath, (req, res) => {
                    global.totalreq++;
                    run(req, res);
                });
                app.post(cleanPath, (req, res) => {
                    global.totalreq++;
                    run(req, res);
                });

                if (!rawEndpoints[category]) rawEndpoints[category] = [];
                rawEndpoints[category].push({ name, desc: desc || '', path: routePath });
                totalRoutes++;
                console.log(`✔ Loaded: ${cleanPath}`);
            });
        } catch (err) {
            console.error(`✘ Error loading ${file}:`, err.message);
        }
    });
}

// ==================== ENDPOINTS LIST ====================
app.get('/endpoints', (req, res) => {
    const endpoints = {};
    Object.keys(rawEndpoints).sort().forEach(cat => {
        endpoints[cat] = rawEndpoints[cat].sort((a, b) => a.name.localeCompare(b.name));
    });

    res.json({
        api: 'RAMZZ HOSTING API',
        version: '2.0.0',
        total_endpoints: totalRoutes,
        total_categories: Object.keys(endpoints).length,
        categories: endpoints
    });
});

// ==================== HOMEPAGE ====================
app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.json({
            message: 'RAMZZ HOSTING API',
            version: '2.0.0',
            endpoints: '/endpoints',
            health: '/health'
        });
    }
});

// ==================== 404 ====================
app.use((req, res) => {
    res.status(404).json({ error: true, message: `Route ${req.method} ${req.path} not found` });
});

// ==================== START SERVER ====================
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`\n🚀 RAMZZ HOSTING API v2.0`);
        console.log(`📡 http://localhost:${PORT}`);
        console.log(`📚 http://localhost:${PORT}/endpoints`);
        console.log(`❤️  http://localhost:${PORT}/health`);
        console.log(`🔥 ${totalRoutes} endpoints loaded\n`);
    });
}

module.exports = app;
