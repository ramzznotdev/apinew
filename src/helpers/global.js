const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ==================== GLOBAL HELPERS ====================

// Download buffer dari URL
global.getBuffer = async (url, options = {}) => {
  try {
    const res = await axios({
      method: 'get',
      url,
      headers: {
        'DNT': 1,
        'Upgrade-Insecure-Request': 1,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      ...options,
      responseType: 'arraybuffer'
    });
    return res.data;
  } catch (err) {
    console.error('getBuffer error:', err.message);
    return null;
  }
};

// Fetch JSON dari URL
global.fetchJson = async (url, options = {}) => {
  try {
    const res = await axios({
      method: 'GET',
      url,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      ...options
    });
    return res.data;
  } catch (err) {
    console.error('fetchJson error:', err.message);
    return null;
  }
};

// Format Rupiah
global.formatRupiah = (number) => {
  return 'Rp' + Number(number).toLocaleString('id-ID');
};

// Generate Order ID
global.generateOrderId = () => {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${y}${m}${d}${h}${min}${s}-${random}`;
};

// Simple JSON file database helper
global.readDB = (filename) => {
  const filePath = path.join(__dirname, '..', 'data', filename);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]');
      return [];
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`readDB error (${filename}):`, err.message);
    return [];
  }
};

global.writeDB = (filename, data) => {
  const dir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

global.totalreq = 0;