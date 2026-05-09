module.exports = [
    {
        name: "Pakasir Webhook",
        desc: "Terima notifikasi pembayaran dari Pakasir",
        category: "Webhook",
        path: "/api/webhook/pakasir",

        async run(req, res) {
            try {
                const data = req.method === 'POST' ? req.body : req.query;
                const orderId = data.order_id || data.orderId;
                const status = data.status || data.Status;

                if (!orderId || !status) return res.status(400).json({ error: true, message: 'Invalid payload' });

                const orders = global.readDB('orders.json');
                const idx = orders.findIndex(o => o.id === orderId);
                if (idx === -1) return res.status(404).json({ error: true, message: 'Order not found' });

                const prev = orders[idx].status;

                if (['completed', 'paid', 'PAID', 'success'].includes(status)) {
                    orders[idx].status = 'paid';
                    orders[idx].paid_at = new Date().toISOString();
                } else if (['expired', 'EXPIRED', 'failed', 'cancelled'].includes(status)) {
                    orders[idx].status = 'expired';
                }

                orders[idx].webhook_data = data;
                global.writeDB('orders.json', orders);

                // Log
                const logs = global.readDB('webhook_log.json');
                logs.push({ order_id: orderId, prev_status: prev, new_status: orders[idx].status, received_at: new Date().toISOString() });
                global.writeDB('webhook_log.json', logs);

                res.json({ success: true, message: `Order #${orderId}: ${prev} → ${orders[idx].status}` });
            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    }
];
