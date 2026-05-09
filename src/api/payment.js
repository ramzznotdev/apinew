const axios = require('axios');

module.exports = [
  {
    name: "Generate QRIS",
    desc: "Generate QR Code QRIS via Pakasir",
    category: "Payment",
    path: "/api/payment/qris?apikey=&order_id=&amount=",
    
    async run(req, res) {
      try {
        const { order_id, amount } = req.query;
        
        if (!order_id || !amount) {
          return res.status(400).json({
            error: true,
            message: 'order_id dan amount wajib diisi'
          });
        }
        
        const response = await axios.post(
          'https://app.pakasir.com/api/qris/create',
          {
            project: process.env.PAKASIR_PROJECT,
            order_id,
            amount: Number(amount),
            api_key: process.env.PAKASIR_API_KEY
          },
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        const qrData = response.data;
        
        if (!qrData.success) {
          return res.status(500).json({
            error: true,
            message: 'Gagal generate QR',
            detail: qrData
          });
        }
        
        res.json({
          success: true,
          data: {
            order_id,
            amount: Number(amount),
            qr_url: qrData.data?.qr_url || '',
            qr_string: qrData.data?.qr_string || '',
            expires_in: 900
          }
        });
        
      } catch (err) {
        res.status(500).json({
          error: true,
          message: err.message
        });
      }
    }
  },
  
  {
    name: "Check Payment Status",
    desc: "Cek status pembayaran via Pakasir",
    category: "Payment",
    path: "/api/payment/status?apikey=&order_id=",
    
    async run(req, res) {
      try {
        const { order_id } = req.query;
        
        if (!order_id) {
          return res.status(400).json({
            error: true,
            message: 'order_id wajib diisi'
          });
        }
        
        // Cek dari database lokal dulu
        const orders = global.readDB('orders.json');
        const order = orders.find(o => o.id === order_id);
        
        if (!order) {
          return res.status(404).json({
            error: true,
            message: 'Order tidak ditemukan'
          });
        }
        
        // Kalau udah paid, langsung return
        if (order.status === 'paid') {
          return res.json({
            success: true,
            data: {
              order_id,
              status: 'PAID',
              amount: order.amount,
              paid_at: order.paid_at
            }
          });
        }
        
        // Cek ke Pakasir untuk status terbaru
        try {
          const response = await axios.get(
            `https://app.pakasir.com/api/qris/status`,
            {
              params: {
                project: process.env.PAKASIR_PROJECT,
                order_id: order_id,
                api_key: process.env.PAKASIR_API_KEY
              }
            }
          );
          
          const statusData = response.data;
          
          if (statusData.success && statusData.data?.status === 'PAID') {
            // Update database lokal
            const idx = orders.findIndex(o => o.id === order_id);
            orders[idx].status = 'paid';
            orders[idx].paid_at = new Date().toISOString();
            global.writeDB('orders.json', orders);
          }
          
          return res.json({
            success: true,
            data: {
              order_id,
              status: statusData.data?.status || 'PENDING',
              amount: order.amount
            }
          });
          
        } catch (apiErr) {
          // Fallback ke database lokal
          return res.json({
            success: true,
            data: {
              order_id,
              status: order.status.toUpperCase(),
              amount: order.amount,
              source: 'local'
            }
          });
        }
        
      } catch (err) {
        res.status(500).json({
          error: true,
          message: err.message
        });
      }
    }
  }
];