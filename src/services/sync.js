// src/services/sync.js - CORREGIDO (Traducción cantidad -> qty)
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
            // 1. PRIMERO SUBIMOS (Para que se reste el stock)
            await this.uploadSales();
            
            // 2. LUEGO BAJAMOS (Para ver el stock real actualizado)
            await this.downloadProducts();
            
            // 3. Historial
            await this.downloadSalesHistory();
            
            console.log("✅ Sincronización Completada");
        } catch (error) {
            console.error("❌ Error Sync:", error);
        }
    },

    async uploadSales() {
        const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
        if (pendingSales.length === 0) return;

        console.log(`☁️ Subiendo ${pendingSales.length} ventas...`);
        const businessId = localStorage.getItem('archsell_business_id');

        for (const sale of pendingSales) {
            try {
                // A. Preparar datos para tabla historial
                const { id, sync_status, ...saleData } = sale;

                // B. Insertar en tabla 'sales'
                const { error: insertError } = await supabase.from('sales').insert({
                    ...saleData,
                    business_id: businessId,
                    created_at: new Date(sale.date).toISOString()
                });

                if (insertError) throw insertError;

                // 🔴 CAMBIO CLAVE AQUÍ: TRADUCCIÓN DE VARIABLES
                // Convertimos 'cantidad' (JS) a 'qty' (SQL)
                const itemsParaRPC = sale.items.map(item => ({
                    id: item.id,
                    qty: Number(item.cantidad || item.qty || 1) // <--- ESTO ARREGLA EL BUG
                }));

                // C. Ejecutar RPC para restar stock
                const { error: rpcError } = await supabase.rpc('process_sale_inventory', {
                    p_business_id: businessId,
                    p_items: itemsParaRPC // Enviamos la lista traducida
                });

                if (rpcError) throw rpcError;

                // D. Éxito
                await db.sales.update(id, { sync_status: 'synced' });

            } catch (err) {
                console.error("Error subiendo venta:", err);
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
            console.log("📦 Stock actualizado desde la nube");
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
                date: new Date(s.created_at),
                sync_status: 'synced'
            }));
            await db.transaction('rw', db.sales, async () => {
                await db.sales.bulkPut(salesFormatted);
            });
        }
    }
};