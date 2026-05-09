module.exports = [
  {
    name: "Pakasir Webhook",
    desc: "Terima notifikasi pembayaran dari Pakasir",
    category: "Webhook",
    path: "/api/webhook/pakasir",
    
    async run(req, res) {
      try {
        // Webhook bisa dari POST (Pakasir) atau GET (testing)
        const data = req.method === 'POST' ? req.body : req.query;
        
        console.log('📩 Webhook received:', JSON.stringify(data).slice(0, 200));
        
        const { order_id, status, amount } = data;
        
        if (!order_id || !status) {
          return res.status(400).json({
            error: true,
            message: 'Invalid webhook payload'
          });
        }
        
        const orders = global.readDB('orders.json');
        const index = orders.findIndex(o => o.id === order_id);
        
        if (index === -1) {
          return res.status(404).json({
            error: true,
            message: 'Order not found'
          });
        }
        
        // Update status
        if (['completed', 'paid'].includes(status)) {
          orders[index].status = 'paid';
          orders[index].paid_at = new Date().toISOString();
          orders[index].payment_data = data;
        } else if (['expired', 'failed'].includes(status)) {
          orders[index].status = 'expired';
        }
        
        global.writeDB('orders.json', orders);
        
        // Log webhook
        const webhookLog = global.readDB('webhook_log.json');
        webhookLog.push({
          order_id,
          status,
          received_at: new Date().toISOString(),
          raw_data: data
        });
        global.writeDB('webhook_log.json', webhookLog);
        
        res.json({
          success: true,
          message: `Order #${order_id} updated to ${orders[index].status}`
        });
        
      } catch (err) {
        console.error('Webhook Error:', err.message);
        res.status(500).json({
          error: true,
          message: err.message
        });
      }
    }
  }
];