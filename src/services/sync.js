// src/services/sync.js - MOTOR DE SINCRONIZACIÓN BLINDADO
import { supabase } from '../data/supabase.js';
import { db } from '../data/db-local.js';

export const syncService = {
    // Escuchar cambios de conexión y disparar la sincronización ordenada
    listenConnection(callback) {
        window.addEventListener('online', () => {
            console.log("📶 Conexión recuperada. Iniciando protocolo de sincronización...");
            this.syncAll(); 
            callback(true);
        });
        window.addEventListener('offline', () => {
            console.log("📡 Conexión perdida. Modo Offline activado.");
            callback(false);
        });
        callback(navigator.onLine);
    },

    // 0. ORQUESTADOR MAESTRO (Evita que se sobrescriban datos)
    async syncAll() {
        if (!navigator.onLine) return;

        try {
            // PASO 1: PUSH (Subir lo local a la nube)
            // Es vital hacer esto primero para que Supabase reste el stock
            await this.uploadSales();
            
            // PASO 2: PULL (Bajar la verdad de la nube)
            // Ahora que la nube ya restó el stock, bajamos los datos actualizados
            await this.downloadProducts();
            
            // PASO 3: Historial (Opcional, para reportes)
            await this.downloadSalesHistory();
            
            console.log("✅ Sincronización completa y segura.");
        } catch (error) {
            console.error("❌ Error crítico en cadena de sincronización:", error);
        }
    },

    // 1. SUBIR VENTAS + RESTAR STOCK (RPC)
    async uploadSales() {
        // Buscamos ventas que estén pendientes en Dexie
        const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
        if (pendingSales.length === 0) return;

        console.log(`☁️ Subiendo ${pendingSales.length} ventas pendientes...`);

        // Obtenemos business_id para seguridad (Multi-tenant)
        const businessId = localStorage.getItem('archsell_business_id');
        if (!businessId) {
            console.error("❌ No hay business_id en localStorage. No se puede sincronizar.");
            return;
        }

        for (const sale of pendingSales) {
            try {
                // A. Preparamos datos.
                // Separamos 'items_rpc' (que es temporal para el cálculo) del resto de datos.
                // 'items' se queda completo para el historial visual.
                const { id, sync_status, items_rpc, ...saleData } = sale;
                
                // 1. Insertamos el registro visual en la tabla 'sales'
                const { error: insertError } = await supabase.from('sales').insert({
                    ...saleData,
                    business_id: businessId, 
                    created_at: new Date(sale.date).toISOString() // Asegurar formato fecha ISO
                });

                if (insertError) throw insertError;

                // 2. PREPARAR ITEMS PARA EL RPC (Cálculo de Stock)
                // Si pos.js guardó 'items_rpc', lo usamos. Si no (versión vieja), lo creamos al vuelo.
                const itemsForStock = items_rpc || sale.items.map(i => ({
                    id: i.id,
                    qty: Number(i.cantidad || i.qty || 1) // Aseguramos que sea número
                }));

                // 3. EJECUTAR RPC: RESTAR STOCK EN NUBE
                // Llamamos a la función SQL que creamos para restar inventario atómicamente
                const { error: rpcError } = await supabase.rpc('process_sale_inventory', {
                    p_business_id: businessId,
                    p_items: itemsForStock 
                });

                if (rpcError) throw rpcError;

                // 4. ÉXITO: Marcamos localmente como 'synced'
                // Ya no necesitamos borrarla, solo marcarla para no subirla de nuevo
                await db.sales.update(id, { sync_status: 'synced' });

            } catch (err) {
                console.error(`Error procesando venta ID local ${sale.id}:`, err);
                // No borramos la venta ni cambiamos estado, se reintentará en la siguiente conexión
            }
        }
    },

    // 2. DESCARGAR PRODUCTOS (Nube -> Local)
    async downloadProducts() {
        const businessId = localStorage.getItem('archsell_business_id');
        if (!businessId) return;

        // Solo descargamos productos de ESTE negocio
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('business_id', businessId);

        if (!error && data) {
            // Usamos bulkPut: Si el producto existe, actualiza stock/precio. Si no, lo crea.
            // Esto respeta el stock que acabamos de restar en el paso anterior.
            await db.products.bulkPut(data); 
            console.log("📦 Inventario local actualizado desde la nube.");
        }
    },

    // 3. DESCARGAR HISTORIAL (Últimas ventas)
    async downloadSalesHistory() {
        const businessId = localStorage.getItem('archsell_business_id');
        if (!businessId) return;

        // Traemos las últimas 50 ventas para que el dashboard se vea vivo
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (!error && data) {
            const salesFormatted = data.map(s => ({
                ...s,
                date: new Date(s.created_at), // Dexie necesita objeto Date real
                sync_status: 'synced'
            }));

            // Transacción segura para actualizar historial local
            await db.transaction('rw', db.sales, async () => {
                await db.sales.bulkPut(salesFormatted);
            });
            console.log("📊 Historial sincronizado.");
        }
    }
};