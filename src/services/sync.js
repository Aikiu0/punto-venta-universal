// src/services/sync.js - CORRECCIÓN DE NOMBRES DE COLUMNA
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
                // --- CORRECCIÓN AQUÍ: LIMPIEZA Y MAPEO DE DATOS ---
                // Quitamos lo que no va a la BD y renombramos 'payment' a 'payment_data'
                const { id, sync_status, items_rpc, payment, ...restOfSale } = sale;

                const saleToInsert = {
                    ...restOfSale,
                    payment_data: payment, // <--- AQUÍ ESTABA EL ERROR 400
                    items: sale.items,     // Items visuales
                    business_id: businessId,
                    created_at: new Date(sale.date).toISOString()
                };

                // B. Insertar en tabla 'sales'
                const { error: insertError } = await supabase.from('sales').insert(saleToInsert);

                if (insertError) {
                    console.error("Error insertando venta en Supabase:", insertError);
                    throw insertError;
                }

                // C. Ejecutar RPC para restar stock (Tolerante a qty/cantidad)
                const itemsParaRPC = sale.items.map(item => ({
                    id: item.id,
                    qty: Number(item.cantidad || item.qty || 1)
                }));

                const { error: rpcError } = await supabase.rpc('process_sale_inventory', {
                    p_business_id: businessId,
                    p_items: itemsParaRPC
                });

                if (rpcError) throw rpcError;

                // D. Éxito: Actualizar Dexie
                await db.sales.update(id, { sync_status: 'synced' });

            } catch (err) {
                console.error("Error procesando venta ID:", sale.id, err);
            }
        }
    },

    async downloadProducts() {
        const businessId = localStorage.getItem('archsell_business_id');
        if (!businessId) return;

        // Descargamos productos del negocio
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
            // Mapear de vuelta payment_data -> payment para que el POS lo entienda
            const salesFormatted = data.map(s => ({
                ...s,
                payment: s.payment_data, // <--- Mapeo inverso para lectura
                date: new Date(s.created_at),
                sync_status: 'synced'
            }));
            
            await db.transaction('rw', db.sales, async () => {
                await db.sales.bulkPut(salesFormatted);
            });
        }
    }
};