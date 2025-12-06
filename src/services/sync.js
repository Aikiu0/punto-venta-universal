// src/services/sync.js - VERSIÓN CORREGIDA (Fix error uuid PGRST204)
import { supabase } from '../data/supabase.js';
import { db } from '../data/db-local.js';

export const syncService = {
    listenConnection(callback) {
        window.addEventListener('online', () => {
            console.log("📶 Conexión. Sincronizando...");
            this.syncAll();
            callback(true);
        });
        window.addEventListener('offline', () => callback(false));
        callback(navigator.onLine);
    },

    async syncAll() {
        if (!navigator.onLine) return;
        try {
            await this.uploadSales();      // 1. Subir Venta y Restar Stock
            await this.downloadProducts(); // 2. Bajar Stock Actualizado
            await this.downloadSalesHistory(); 
            console.log("✅ Todo Sincronizado");
        } catch (error) {
            console.error("❌ Error Sync:", error);
        }
    },

    async uploadSales() {
        const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
        if (pendingSales.length === 0) return;

        const businessId = localStorage.getItem('archsell_business_id');
        if (!businessId) return console.error("Falta Business ID");

        console.log(`☁️ Procesando ${pendingSales.length} ventas...`);

        for (const sale of pendingSales) {
            try {
                // --- SOLUCIÓN BLINDADA USANDO RPC ---
                // En lugar de insertar y luego actualizar (que causa errores si se corta el internet),
                // enviamos todo junto a la base de datos.
                

                const { data: rpcData, error: rpcError } = await supabase.rpc('sincronizar_venta_offline', {
                    p_sale_id: sale.id,          // ¡CRUCIAL! Enviamos el ID original para evitar duplicados
                    p_business_id: businessId,
                    p_user_id: sale.user_id || (await supabase.auth.getUser()).data.user?.id, // Fallback por si acaso
                    p_total: sale.total,
                    p_items: sale.items,         // Enviamos los items para que SQL reste el stock allá mismo
                    p_payment_data: sale.payment || sale.payment_data,
                    p_created_at: new Date(sale.date || sale.created_at).toISOString()
                });

                if (rpcError) throw rpcError;

                // Si la BD responde éxito (ya sea que la creó o que detectó que ya existía)
                if (rpcData.success) {
                    console.log(`✅ Venta sincronizada: ${sale.id} (${rpcData.status})`);
                    
                    // Actualizamos localmente a 'synced' para no volver a enviarla
                    await db.sales.update(sale.id, { sync_status: 'synced' });
                } else {
                    console.error(`⚠️ Venta rechazada por lógica de negocio: ${rpcData.message}`);
                }

            } catch (err) {
                console.error("❌ Error de red o servidor en venta:", sale.id, err);
                // NO hacemos nada más. Como no actualizamos a 'synced', se reintentará luego.
                // Gracias a p_sale_id, el reintento NO creará duplicados.
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
            console.log("📦 Stock Local Actualizado");
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
                payment: s.payment_data, // Mapeo inverso para que el POS lo lea
                date: new Date(s.created_at), // Mapeo inverso de fecha
                sync_status: 'synced'
            }));
            
            // Usamos transacción para asegurar integridad
            await db.transaction('rw', db.sales, async () => {
                await db.sales.bulkPut(salesFormatted);
            });
        }
    }
};