const axios = require('axios');

module.exports = [
    {
        name: "Create Order",
        desc: "Buat order baru + generate QRIS",
        category: "Order",
        path: "/api/order/create?apikey=&product=&amount=&email_target=&nama_target=",

        async run(req, res) {
            try {
                const params = req.method === 'POST' ? req.body : req.query;
                const { product, amount, email_target, nama_target } = params;

                if (!product || !amount || !email_target) {
                    return res.status(400).json({ error: true, message: 'product, amount, email_target wajib' });
                }

                const orderId = global.generateOrderId();
                let qrUrl = '';

                try {
                    const qrRes = await axios.post('https://app.pakasir.com/api/qris/create', {
                        project: process.env.PAKASIR_PROJECT || '',
                        order_id: orderId,
                        amount: Number(amount),
                        api_key: process.env.PAKASIR_API_KEY || ''
                    }, { headers: { 'Content-Type': 'application/json' } });

                    if (qrRes.data?.success) {
                        qrUrl = qrRes.data.data?.qr_url || '';
                    }
                } catch (e) {
                    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${orderId}`;
                }

                const orders = global.readDB('orders.json');
                orders.push({
                    id: orderId,
                    product,
                    amount: Number(amount),
                    email_target,
                    nama_target: nama_target || '-',
                    status: 'pending',
                    qr_url: qrUrl,
                    created_at: new Date().toISOString(),
                    paid_at: null
                });
                global.writeDB('orders.json', orders);

                res.status(201).json({
                    success: true,
                    message: 'Order berhasil dibuat',
                    data: {
                        order_id: orderId,
                        product,
                        amount: Number(amount),
                        qr_url: qrUrl,
                        status: 'pending'
                    }
                });
            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    },

    {
        name: "Get Order Status",
        desc: "Cek status order",
        category: "Order",
        path: "/api/order/status?apikey=&order_id=",

        async run(req, res) {
            const { order_id } = req.query;
            if (!order_id) return res.status(400).json({ error: true, message: 'order_id wajib' });

            const orders = global.readDB('orders.json');
            const order = orders.find(o => o.id === order_id);
            if (!order) return res.status(404).json({ error: true, message: 'Order tidak ditemukan' });

            res.json({ success: true, data: order });
        }
    },

    {
        name: "List Orders",
        desc: "List semua order",
        category: "Order",
        path: "/api/order/list?apikey=&status=",

        async run(req, res) {
            let orders = global.readDB('orders.json');
            const { status } = req.query;
            if (status) orders = orders.filter(o => o.status === status);
            orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            res.json({ success: true, total: orders.length, data: orders });
        }
    },

    {
        name: "Cancel Order",
        desc: "Batalkan order",
        category: "Order",
        path: "/api/order/cancel?apikey=&order_id=",

        async run(req, res) {
            const { order_id } = req.query;
            if (!order_id) return res.status(400).json({ error: true, message: 'order_id wajib' });

            const orders = global.readDB('orders.json');
            const idx = orders.findIndex(o => o.id === order_id);
            if (idx === -1) return res.status(404).json({ error: true, message: 'Order tidak ditemukan' });
            if (orders[idx].status !== 'pending') return res.status(400).json({ error: true, message: 'Order sudah diproses' });

            orders[idx].status = 'cancelled';
            global.writeDB('orders.json', orders);
            res.json({ success: true, message: 'Order dibatalkan' });
        }
    }
];
