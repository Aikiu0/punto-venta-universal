// src/services/sync.js - VERSIÓN FINAL (Stock Fix + Payment Fix)
import { supabase } from '../data/supabase.js';
import { db } from '../data/db-local.js';

export const syncService = {
    listenConnection(callback) {
        window.addEventListener('online', () => {
            console.log("📶 Conexión detectada. Iniciando Sync...");
            this.syncAll();
            callback(true);
        });
        window.addEventListener('offline', () => {
            console.log("📡 Offline - Los datos se guardarán localmente.");
            callback(false);
        });
        callback(navigator.onLine);
    },

    async syncAll() {
        if (!navigator.onLine) return;

        try {
            // 1. PRIMERO: Subir Ventas (Para afectar el Stock en la nube)
            await this.uploadSales();
            
            // 2. SEGUNDO: Bajar productos (Para ver el stock real que calculó la nube)
            await this.downloadProducts();
            
            // 3. TERCERO: Bajar historial
            await this.downloadSalesHistory();
            
            console.log("✅ Sincronización finalizada correctamente.");
        } catch (error) {
            console.error("❌ Error general en Sync:", error);
        }
    },

    async uploadSales() {
        const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
        if (pendingSales.length === 0) return;

        console.log(`☁️ Procesando ${pendingSales.length} ventas pendientes...`);
        
        const businessId = localStorage.getItem('archsell_business_id'); 
        
        if (!businessId) {
            console.error("⚠️ Error Crítico: No hay ID de negocio. Cierra sesión y vuelve a entrar.");
            return;
        }

        for (const sale of pendingSales) {
            try {
                // 1. Preparar el objeto para la tabla 'sales' (Historial Visual)
                // Separamos los datos técnicos (items_rpc) de los datos visuales
                const { id, sync_status, items_rpc, payment, ...restOfSale } = sale;

                const saleToInsert = {
                    ...restOfSale,
                    payment_data: payment, // Mapeo correcto (payment -> payment_data)
                    items: sale.items,     // Array completo con nombres y precios
                    business_id: businessId,
                    created_at: new Date(sale.date).toISOString()
                };

                // 2. Preparar el objeto para el RPC (Resta de Stock)
                // USAMOS items_rpc SI EXISTE (Viene del POS), sino lo calculamos (Respaldo)
                let itemsForStock = items_rpc;
                
                if (!itemsForStock) {
                    // Fallback por si es una venta vieja
                    itemsForStock = sale.items.map(item => ({
                        id: item.id,
                        qty: Number(item.cantidad || item.qty || 1)
                    }));
                }

                console.log("📦 Restando Inventario (RPC Payload):", itemsForStock);

                // 3. Insertar Venta en Historial
                const { error: insertError } = await supabase.from('sales').insert(saleToInsert);
                if (insertError) throw new Error(`Error insertando venta: ${insertError.message}`);

                // 4. Ejecutar Resta de Stock en Nube
                const { error: rpcError } = await supabase.rpc('process_sale_inventory', {
                    p_business_id: businessId, // Se envía aunque el SQL sea tolerante
                    p_items: itemsForStock     // [{id: "...", qty: 2}]
                });

                if (rpcError) throw new Error(`Error restando stock: ${rpcError.message}`);

                // 5. Éxito: Marcar como sincronizado en Dexie
                await db.sales.update(id, { sync_status: 'synced' });

            } catch (err) {
                console.error(`❌ Falló venta ID local ${sale.id}:`, err);
                // No borramos la venta para reintentar después
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
            await db.products.bulkPut(data); // Actualiza precios y stocks locales con la verdad de la nube
            console.log("📦 Catálogo actualizado desde la nube.");
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
                payment: s.payment_data, // Mapeo inverso
                date: new Date(s.created_at),
                sync_status: 'synced'
            }));
            
            await db.transaction('rw', db.sales, async () => {
                await db.sales.bulkPut(salesFormatted);
            });
        }
    }
};