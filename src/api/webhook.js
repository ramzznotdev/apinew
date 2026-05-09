module.exports = [
    {
        name: "Pakasir Webhook",
        desc: "Terima notifikasi pembayaran",
        category: "Webhook",
        path: "/api/webhook/pakasir",

        async run(req, res) {
            try {
                const data = req.method === 'POST' ? req.body : req.query;
                const { order_id, status } = data;
                if (!order_id || !status) return res.status(400).json({ error: true, message: 'Invalid payload' });

                const orders = global.readDB('orders.json');
                const idx = orders.findIndex(o => o.id === order_id);
                if (idx === -1) return res.status(404).json({ error: true, message: 'Order not found' });

                if (['completed', 'paid'].includes(status)) {
                    orders[idx].status = 'paid';
                    orders[idx].paid_at = new Date().toISOString();
                } else if (['expired', 'failed'].includes(status)) {
                    orders[idx].status = 'expired';
                }

                global.writeDB('orders.json', orders);
                res.json({ success: true, message: `Order #${order_id} updated to ${orders[idx].status}` });
            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    }
];
