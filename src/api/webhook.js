module.exports = [
    {
        name: "Pakasir Webhook",
        desc: "Terima notifikasi pembayaran dari Pakasir",
        category: "Webhook",
        path: "/api/webhook/pakasir",

        async run(req, res) {
            try {
                // Webhook bisa POST (dari Pakasir) atau GET (testing)
                const data = req.method === 'POST' ? req.body : req.query;

                console.log('📩 Webhook Received:', JSON.stringify(data).slice(0, 300));

                // Support berbagai format key
                const orderId = data.order_id || data.orderId || data.OrderID;
                const status = data.status || data.Status;
                const amount = data.amount || data.Amount;

                if (!orderId || !status) {
                    return res.status(400).json({
                        error: true,
                        message: 'Invalid webhook payload. Required: order_id, status'
                    });
                }

                const orders = global.readDB('orders.json');
                const idx = orders.findIndex(o => o.id === orderId);

                if (idx === -1) {
                    return res.status(404).json({
                        error: true,
                        message: 'Order not found',
                        order_id: orderId
                    });
                }

                // Mapping status
                const previousStatus = orders[idx].status;

                if (['completed', 'paid', 'PAID', 'COMPLETED', 'success', 'SUCCESS'].includes(status)) {
                    orders[idx].status = 'paid';
                    orders[idx].paid_at = new Date().toISOString();
                    orders[idx].webhook_data = data;
                } else if (['expired', 'EXPIRED', 'failed', 'FAILED', 'cancelled', 'CANCELLED'].includes(status)) {
                    orders[idx].status = 'expired';
                    orders[idx].webhook_data = data;
                } else {
                    // Unknown status, simpan aja
                    orders[idx].webhook_data = data;
                }

                global.writeDB('orders.json', orders);

                // Log webhook
                const webhookLog = global.readDB('webhook_log.json');
                webhookLog.push({
                    order_id: orderId,
                    previous_status: previousStatus,
                    new_status: orders[idx].status,
                    received_at: new Date().toISOString(),
                    raw_data: data
                });
                global.writeDB('webhook_log.json', webhookLog);

                console.log(`✅ Order #${orderId}: ${previousStatus} → ${orders[idx].status}`);

                res.json({
                    success: true,
                    message: `Order #${orderId} updated from ${previousStatus} to ${orders[idx].status}`,
                    data: {
                        order_id: orderId,
                        status: orders[idx].status,
                        paid_at: orders[idx].paid_at
                    }
                });

            } catch (err) {
                console.error('Webhook Error:', err.message);
                res.status(500).json({
                    error: true,
                    message: 'Webhook processing error',
                    detail: err.message
                });
            }
        }
    }
];
