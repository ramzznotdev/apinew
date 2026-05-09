const axios = require('axios');

module.exports = [
    {
        name: "Create Order",
        desc: "Buat order baru + generate QRIS via Pakasir",
        category: "Order",
        path: "/api/order/create?apikey=&product=&amount=&email_target=&nama_target=",

        async run(req, res) {
            try {
                const params = req.method === 'POST' ? req.body : req.query;
                const { product, amount, email_target, nama_target } = params;

                if (!product || !amount || !email_target) {
                    return res.status(400).json({
                        error: true,
                        message: 'Parameter wajib: product, amount, email_target'
                    });
                }

                const orderId = global.generateOrderId();
                let qrString = '';
                let qrUrl = '';
                let paymentData = null;
                let feeAmount = 0;
                let totalPayment = Number(amount);

                // Panggil Pakasir API
                try {
                    if (process.env.PAKASIR_API_KEY && process.env.PAKASIR_PROJECT) {
                        const qrRes = await axios.post(
                            'https://app.pakasir.com/api/transactioncreate/qris',
                            {
                                project: process.env.PAKASIR_PROJECT,
                                order_id: orderId,
                                amount: Number(amount),
                                api_key: process.env.PAKASIR_API_KEY
                            },
                            { 
                                headers: { 'Content-Type': 'application/json' },
                                timeout: 15000
                            }
                        );

                        // Cek response Pakasir (langsung ke payment, BUKAN success)
                        if (qrRes.data && qrRes.data.payment) {
                            paymentData = qrRes.data.payment;
                            qrString = paymentData.payment_number || '';
                            feeAmount = paymentData.fee || 0;
                            totalPayment = paymentData.total_payment || Number(amount);
                            
                            if (qrString) {
                                qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`;
                            }
                        }
                    }
                } catch (e) {
                    console.error('Pakasir Error:', e.response?.data || e.message);
                }

                // Fallback kalau gagal
                if (!qrUrl) {
                    qrString = `QRIS-${orderId}`;
                    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${orderId}`;
                }

                // Simpan order
                const orders = global.readDB('orders.json');
                const newOrder = {
                    id: orderId,
                    product,
                    amount: Number(amount),
                    fee: feeAmount,
                    total_payment: totalPayment,
                    email_target,
                    nama_target: nama_target || '-',
                    status: 'pending',
                    qr_string: qrString,
                    qr_url: qrUrl,
                    payment_data: paymentData,
                    created_at: new Date().toISOString(),
                    paid_at: null
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
                        fee: feeAmount,
                        total_payment: totalPayment,
                        qr_url: qrUrl,
                        qr_string: qrString,
                        status: 'pending',
                        expires_in: 900
                    }
                });

            } catch (err) {
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
                if (!order_id) return res.status(400).json({ error: true, message: 'order_id wajib' });

                const orders = global.readDB('orders.json');
                const order = orders.find(o => o.id === order_id);
                if (!order) return res.status(404).json({ error: true, message: 'Order tidak ditemukan' });

                res.json({ success: true, data: order });
            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    },

    {
        name: "List Orders",
        desc: "Lihat semua order (filter status, pagination)",
        category: "Order",
        path: "/api/order/list?apikey=&status=&page=&limit=",

        async run(req, res) {
            try {
                const { status, page, limit } = req.query;
                let orders = global.readDB('orders.json');

                if (status && ['pending', 'paid', 'expired', 'cancelled'].includes(status)) {
                    orders = orders.filter(o => o.status === status);
                }

                orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                const pageNum = parseInt(page) || 1;
                const limitNum = parseInt(limit) || 50;
                const total = orders.length;
                const paginated = orders.slice((pageNum - 1) * limitNum, pageNum * limitNum);

                res.json({
                    success: true,
                    data: {
                        total,
                        page: pageNum,
                        limit: limitNum,
                        total_pages: Math.ceil(total / limitNum),
                        orders: paginated
                    }
                });
            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    },

    {
        name: "Cancel Order",
        desc: "Batalkan order pending",
        category: "Order",
        path: "/api/order/cancel?apikey=&order_id=",

        async run(req, res) {
            try {
                const { order_id } = req.query;
                if (!order_id) return res.status(400).json({ error: true, message: 'order_id wajib' });

                const orders = global.readDB('orders.json');
                const idx = orders.findIndex(o => o.id === order_id);
                if (idx === -1) return res.status(404).json({ error: true, message: 'Order tidak ditemukan' });
                if (orders[idx].status !== 'pending') return res.status(400).json({ error: true, message: `Order sudah ${orders[idx].status}` });

                orders[idx].status = 'cancelled';
                orders[idx].cancelled_at = new Date().toISOString();
                global.writeDB('orders.json', orders);

                res.json({ success: true, message: `Order #${order_id} dibatalkan` });
            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    }
];
