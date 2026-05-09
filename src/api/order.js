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

                        console.log('Pakasir Response:', JSON.stringify(qrRes.data));

                        // Cek struktur response Pakasir
                        if (qrRes.data && qrRes.data.payment) {
                            paymentData = qrRes.data.payment;
                            qrString = paymentData.payment_number || '';
                            
                            // Generate QR URL dari string
                            if (qrString) {
                                qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`;
                            }
                        } else if (qrRes.data && qrRes.data.success) {
                            // Fallback kalau response beda
                            qrString = qrRes.data.data?.qr_string || qrRes.data.data?.payment_number || '';
                            qrUrl = qrRes.data.data?.qr_url || '';
                        }
                    }
                } catch (e) {
                    console.error('Pakasir Error:', e.response?.data || e.message);
                    // Lanjut tanpa QR, nanti di-generate ulang
                }

                // Fallback QR mock kalau gagal
                if (!qrUrl && !qrString) {
                    qrString = `QRIS-${orderId}`;
                    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${orderId}`;
                }

                // Simpan order
                const orders = global.readDB('orders.json');
                const newOrder = {
                    id: orderId,
                    product,
                    amount: Number(amount),
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
                        qr_url: qrUrl,
                        qr_string: qrString,
                        status: 'pending',
                        expires_in: 900 // 15 menit
                    }
                });

            } catch (err) {
                console.error('Create Order Error:', err);
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
                    return res.status(400).json({ error: true, message: 'order_id wajib diisi' });
                }

                const orders = global.readDB('orders.json');
                const order = orders.find(o => o.id === order_id);

                if (!order) {
                    return res.status(404).json({ error: true, message: 'Order tidak ditemukan' });
                }

                // Return data order
                res.json({
                    success: true,
                    data: {
                        order_id: order.id,
                        product: order.product,
                        amount: order.amount,
                        status: order.status,
                        qr_url: order.qr_url,
                        created_at: order.created_at,
                        paid_at: order.paid_at
                    }
                });

            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    },

    {
        name: "List Orders",
        desc: "Lihat semua order (bisa filter status)",
        category: "Order",
        path: "/api/order/list?apikey=&status=",

        async run(req, res) {
            try {
                const { status, limit, page } = req.query;
                let orders = global.readDB('orders.json');

                // Filter status
                if (status && ['pending', 'paid', 'expired', 'cancelled'].includes(status)) {
                    orders = orders.filter(o => o.status === status);
                }

                // Sort by newest first
                orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                // Pagination
                const total = orders.length;
                const pageNum = parseInt(page) || 1;
                const limitNum = parseInt(limit) || 50;
                const start = (pageNum - 1) * limitNum;
                const paginatedOrders = orders.slice(start, start + limitNum);

                res.json({
                    success: true,
                    data: {
                        total,
                        page: pageNum,
                        limit: limitNum,
                        total_pages: Math.ceil(total / limitNum),
                        orders: paginatedOrders
                    }
                });

            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    },

    {
        name: "Cancel Order",
        desc: "Batalkan order yang masih pending",
        category: "Order",
        path: "/api/order/cancel?apikey=&order_id=",

        async run(req, res) {
            try {
                const { order_id } = req.query;
                if (!order_id) {
                    return res.status(400).json({ error: true, message: 'order_id wajib diisi' });
                }

                const orders = global.readDB('orders.json');
                const idx = orders.findIndex(o => o.id === order_id);

                if (idx === -1) {
                    return res.status(404).json({ error: true, message: 'Order tidak ditemukan' });
                }

                if (orders[idx].status !== 'pending') {
                    return res.status(400).json({
                        error: true,
                        message: `Order sudah ${orders[idx].status}, tidak bisa dibatalkan`
                    });
                }

                orders[idx].status = 'cancelled';
                orders[idx].cancelled_at = new Date().toISOString();
                global.writeDB('orders.json', orders);

                res.json({
                    success: true,
                    message: `Order #${order_id} berhasil dibatalkan`
                });

            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    }
];
