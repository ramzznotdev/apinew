module.exports = (req, res, next) => {
  // Ambil API key dari query atau header
  const apiKey = req.query.apikey || req.headers['x-api-key'];
  
  // Skip auth untuk webhook (Pakasir kirim tanpa API key)
  if (req.path.includes('/webhook/')) {
    return next();
  }
  
  // List API keys yang valid (dari env)
  const validKeys = (process.env.APIKEY || '').split(',').map(k => k.trim());
  
  if (!apiKey || !validKeys.includes(apiKey)) {
    return res.status(401).json({
      error: true,
      message: 'Invalid or missing API key',
      hint: 'Use ?apikey=YOUR_KEY or x-api-key header'
    });
  }
  
  next();
};