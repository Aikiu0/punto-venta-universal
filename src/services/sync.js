// src/services/sync.js - ESTRATEGIA "SHOP" (Uno por uno)
import { supabase } from '../data/supabase.js';
import { db } from '../data/db-local.js';

export const syncService = {
    listenConnection(callback) {
        window.addEventListener('online', () => {
            console.log("📶 Conexión recuperada. Sincronizando...");
            this.syncAll();
            callback(true);
        });
        window.addEventListener('offline', () => {
            console.log("📡 Offline");
            callback(false);
        });
        callback(navigator.onLine);
    },

    async syncAll() {
        if (!navigator.onLine) return;

        try {
            // 1. SUBIR Y RESTAR (Prioridad 1)
            await this.uploadSales();
            
            // 2. BAJAR ACTUALIZACIONES (Prioridad 2)
            await this.downloadProducts();
            await this.downloadSalesHistory();
            
            console.log("✅ Sincronización completada");
        } catch (error) {
            console.error("❌ Error Sync:", error);
        }
    },

    async uploadSales() {
        const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
        if (pendingSales.length === 0) return;

        const businessId = localStorage.getItem('archsell_business_id');
        if (!businessId) return console.error("Falta Business ID");

        console.log(`☁️ Procesando ${pendingSales.length} ventas pendientes...`);

        for (const sale of pendingSales) {
            try {
                // A. INSERTAR VENTA EN HISTORIAL
                const { id, sync_status, items_rpc, payment, ...restOfSale } = sale;
                
                const saleToInsert = {
                    ...restOfSale,
                    payment_data: payment, // Corrección de nombre
                    items: sale.items,
                    business_id: businessId,
                    created_at: new Date(sale.date).toISOString()
                };

                const { error: insertError } = await supabase.from('sales').insert(saleToInsert);
                if (insertError) throw insertError;

                // B. RESTAR STOCK (ESTRATEGIA SHOP: UNO POR UNO)
                // Usamos items_rpc o mapeamos al vuelo
                const itemsToProcess = items_rpc || sale.items.map(i => ({
                    id: i.id,
                    qty: Number(i.cantidad || i.qty || 1)
                }));

                console.log("📉 Restando items:", itemsToProcess);

                // Ejecutamos el RPC 'decrement_stock' por cada producto (Igual que shop.js)
                const promises = itemsToProcess.map(item => {
                    return supabase.rpc('decrement_stock', {
                        product_id: item.id,
                        amount: item.qty
                    });
                });

                // Esperamos a que todos se resten
                const results = await Promise.all(promises);
                
                // Verificar si hubo errores en alguna resta
                const errors = results.filter(r => r.error);
                if (errors.length > 0) {
                    console.error("Errores al restar stock:", errors);
                    // No lanzamos error fatal para no duplicar la venta en historial,
                    // pero queda registrado en consola.
                }

                // C. ÉXITO
                await db.sales.update(id, { sync_status: 'synced' });

            } catch (err) {
                console.error("Error procesando venta:", err);
            }
        }
    },

    async downloadProducts() {
        const businessId = localStorage.getItem('archsell_business_id');
        if (!businessId) return;

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('business_id', businessId);

        if (!error && data) {
            await db.products.bulkPut(data);
            console.log("📦 Catálogo actualizado");
        }
    },

    async downloadSalesHistory() {
        const businessId = localStorage.getItem('archsell_business_id');
        if (!businessId) return;

        const { data } = await supabase.from('sales')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (data) {
            const salesFormatted = data.map(s => ({
                ...s,
                payment: s.payment_data,
                date: new Date(s.created_at),
                sync_status: 'synced'
            }));
            await db.transaction('rw', db.sales, async () => {
                await db.sales.bulkPut(salesFormatted);
            });
        }
    }
};