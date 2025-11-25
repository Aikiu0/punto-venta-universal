// src/services/sync.js - VERSIÓN FINAL (Fix localStorage + payment_data)
import { supabase } from '../data/supabase.js';
import { db } from '../data/db-local.js';

export const syncService = {
    listenConnection(callback) {
        window.addEventListener('online', () => {
            console.log("📶 Conexión recuperada. Iniciando Sincronización...");
            this.syncAll();
            callback(true);
        });
        window.addEventListener('offline', () => {
            console.log("📡 Modo Offline activado");
            callback(false);
        });
        callback(navigator.onLine);
    },

    async syncAll() {
        if (!navigator.onLine) return;

        try {
            // 1. SUBIR VENTAS (Primero esto para restar stock)
            await this.uploadSales();
            
            // 2. BAJAR PRODUCTOS (Para ver el stock real actualizado)
            await this.downloadProducts();
            
            // 3. BAJAR HISTORIAL
            await this.downloadSalesHistory();
            
            console.log("✅ Sincronización Completada Exitosamente");
        } catch (error) {
            console.error("❌ Error en el proceso de Sync:", error);
        }
    },

    async uploadSales() {
        const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
        if (pendingSales.length === 0) return;

        console.log(`☁️ Subiendo ${pendingSales.length} ventas...`);
        
        // CORRECCIÓN MAYÚSCULA (localStorage)
        const businessId = localStorage.getItem('archsell_business_id'); 
        
        if (!businessId) {
            console.error("⚠️ No hay business_id, abortando sync.");
            return;
        }

        for (const sale of pendingSales) {
            try {
                // CORRECCIÓN DE DATOS (Evitar error 400)
                const { id, sync_status, items_rpc, payment, ...restOfSale } = sale;

                const saleToInsert = {
                    ...restOfSale,
                    payment_data: payment, // <--- Mapeo correcto para Supabase
                    items: sale.items,
                    business_id: businessId,
                    created_at: new Date(sale.date).toISOString()
                };

                // A. Insertar en tabla 'sales'
                const { error: insertError } = await supabase.from('sales').insert(saleToInsert);

                if (insertError) throw insertError;

                // B. Ejecutar RPC para restar stock
                const itemsParaRPC = sale.items.map(item => ({
                    id: item.id,
                    qty: Number(item.cantidad || item.qty || 1)
                }));

                const { error: rpcError } = await supabase.rpc('process_sale_inventory', {
                    p_business_id: businessId,
                    p_items: itemsParaRPC
                });

                if (rpcError) throw rpcError;

                // C. Éxito: Actualizar Dexie
                await db.sales.update(id, { sync_status: 'synced' });

            } catch (err) {
                console.error(`❌ Error procesando venta ID ${sale.id}:`, err);
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
            console.log("📦 Productos actualizados desde la nube");
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
                payment: s.payment_data, // Mapeo inverso para lectura local
                date: new Date(s.created_at),
                sync_status: 'synced'
            }));
            
            await db.transaction('rw', db.sales, async () => {
                await db.sales.bulkPut(salesFormatted);
            });
        }
    }
};