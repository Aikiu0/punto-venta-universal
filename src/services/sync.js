// src/services/sync.js - MOTOR DE SINCRONIZACIÓN COMPLETO
import { supabase } from '../data/supabase.js';
import { db } from '../data/db-local.js';

export const syncService = {
    // Escuchar cambios de conexión
    listenConnection(callback) {
        window.addEventListener('online', () => callback(true));
        window.addEventListener('offline', () => callback(false));
        callback(navigator.onLine);
    },

    // 1. SUBIR (Local -> Nube)
    async uploadSales() {
        if (!navigator.onLine) return;
        
        // Buscamos ventas pendientes en Dexie
        const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
        if (pendingSales.length === 0) return;

        console.log(`☁️ Subiendo ${pendingSales.length} ventas...`);

        for (const sale of pendingSales) {
            try {
                // Preparamos datos (quitamos ID local para que Supabase genere el suyo si es necesario)
                const { id, sync_status, ...saleData } = sale;
                
                const { error } = await supabase.from('sales').insert({
                    ...saleData,
                    created_at: new Date(sale.date).toISOString()
                });

                if (!error) {
                    // Marcar como sincronizado
                    await db.sales.update(id, { sync_status: 'synced' });
                }
            } catch (err) {
                console.error("Error subiendo venta:", err);
            }
        }
    },

    // 2. DESCARGAR PRODUCTOS (Nube -> Local)
    async downloadProducts() {
        if (!navigator.onLine) return;
        
        const { data, error } = await supabase.from('products').select('*');
        if (!error && data) {
            await db.products.clear(); 
            await db.products.bulkAdd(data); 
            console.log("📦 Productos actualizados localmente");
        }
    },

    // 3. DESCARGAR HISTORIAL VENTAS (Nube -> Local) - ¡CLAVE PARA DASHBOARD OFFLINE!
    async downloadSalesHistory() {
        if (!navigator.onLine) return;

        console.log("🔄 Descargando historial de ventas...");
        // Traemos las últimas 1000 ventas (ajusta el límite según necesites)
        const { data, error } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(1000);
        
        if (!error && data) {
            // Limpiamos ventas locales viejas y ponemos las de la nube
            // (Esto asegura que tengas los datos reales de todos los dispositivos)
            const salesFormatted = data.map(s => ({
                ...s,
                date: new Date(s.created_at), // Dexie necesita objeto Date
                sync_status: 'synced'
            }));

            // Usamos una transacción para que sea atómico
            await db.transaction('rw', db.sales, async () => {
                // Opcional: db.sales.clear() si quieres borrar lo local y confiar solo en la nube
                // Pero para no perder ventas offline no sincronizadas, usamos bulkPut
                await db.sales.bulkPut(salesFormatted);
            });
            console.log("📊 Historial de ventas actualizado");
        }
    }
};