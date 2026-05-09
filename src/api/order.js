const axios = require('axios');

module.exports = [
  {
    name: "Create Order",
    desc: "Buat order baru + generate QRIS Payment",
    category: "Order",
    path: "/api/order/create?apikey=&product=&amount=&email_target=&nama_target=",
    
    async run(req, res) {
      try {
        const { product, amount, email_target, nama_target } = req.query;
        
        // Validasi
        if (!product || !amount || !email_target) {
          return res.status(400).json({
            error: true,
            message: 'Parameter wajib: product, amount, email_target',
            optional: ['nama_target']
          });
        }
        
        const orderId = global.generateOrderId();
        
        // Panggil Pakasir buat generate QR
        const qrResponse = await axios.post(
          `https://app.pakasir.com/api/qris/create`,
          {
            project: process.env.PAKASIR_PROJECT,
            order_id: orderId,
            amount: Number(amount),
            api_key: process.env.PAKASIR_API_KEY
          },
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        const qrData = qrResponse.data;
        
        if (!qrData.success) {
          return res.status(500).json({
            error: true,
            message: 'Gagal generate QR Code',
            detail: qrData
          });
        }
        
        // Simpan order ke database
        const orders = global.readDB('orders.json');
        const newOrder = {
          id: orderId,
          product,
          amount: Number(amount),
          email_target,
          nama_target: nama_target || '-',
          status: 'pending',
          qr_string: qrData.data?.qr_string || '',
          qr_url: qrData.data?.qr_url || '',
          created_at: new Date().toISOString(),
          paid_at: null,
          webhook_sent: false
        };
        
        orders.push(newOrder);
        global.writeDB('orders.json', orders);
        
        res.status(201).json({
          success: true,
          message: 'Order berhasil dibuat',
          data: {
            order_id: orderId,
            product,
            amount: Number(amount),
            qr_url: qrData.data?.qr_url || '',
            qr_string: qrData.data?.qr_string || '',
            expires_in: 900, // 15 menit
            status: 'pending'
          }
        });
        
      } catch (err) {
        console.error('Create Order Error:', err.message);
        res.status(500).json({
          error: true,
          message: 'Gagal membuat order',
          detail: err.message
        });
      }
    }
  },
  
  {
    name: "Get Order Status",
    desc: "Cek status order by ID",
    category: "Order",
    path: "/api/order/status?apikey=&order_id=",
    
    async run(req, res) {
      try {
        const { order_id } = req.query;
        
        if (!order_id) {
          return res.status(400).json({
            error: true,
            message: 'order_id wajib diisi'
          });
        }
        
        const orders = global.readDB('orders.json');
        const order = orders.find(o => o.id === order_id);
        
        if (!order) {
          return res.status(404).json({
            error: true,
            message: 'Order tidak ditemukan'
          });
        }
        
        res.json({
          success: true,
          data: {
            order_id: order.id,
            product: order.product,
            amount: order.amount,
            status: order.status,
            email_target: order.email_target,
            created_at: order.created_at,
            paid_at: order.paid_at
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
    name: "List Orders",
    desc: "Lihat semua order (dengan filter status)",
    category: "Order",
    path: "/api/order/list?apikey=&status=",
    
    async run(req, res) {
      try {
        const { status } = req.query;
        let orders = global.readDB('orders.json');
        
        // Filter by status
        if (status && ['pending', 'paid', 'expired', 'cancelled'].includes(status)) {
          orders = orders.filter(o => o.status === status);
        }
        
        // Sort newest first
        orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        res.json({
          success: true,
          total: orders.length,
          filter: status || 'all',
          data: orders.map(o => ({
            order_id: o.id,
            product: o.product,
            amount: o.amount,
            status: o.status,
            email_target: o.email_target,
            created_at: o.created_at,
            paid_at: o.paid_at
          }))
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
    name: "Cancel Order",
    desc: "Batalkan order yang pending",
    category: "Order",
    path: "/api/order/cancel?apikey=&order_id=",
    
    async run(req, res) {
      try {
        const { order_id } = req.query;
        
        if (!order_id) {
          return res.status(400).json({
            error: true,
            message: 'order_id wajib diisi'
          });
        }
        
        const orders = global.readDB('orders.json');
        const index = orders.findIndex(o => o.id === order_id);
        
        if (index === -1) {
          return res.status(404).json({
            error: true,
            message: 'Order tidak ditemukan'
          });
        }
        
        if (orders[index].status !== 'pending') {
          return res.status(400).json({
            error: true,
            message: `Order sudah ${orders[index].status}, tidak bisa dibatalkan`
          });
        }
        
        orders[index].status = 'cancelled';
        global.writeDB('orders.json', orders);
        
        res.json({
          success: true,
          message: `Order #${order_id} berhasil dibatalkan`
        });
        
      } catch (err) {
        res.status(500).json({
          error: true,
          message: err.message
        });
      }
    }
  }
];