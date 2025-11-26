// src/services/sync.js - VERSIÓN FINAL (Corrección de columnas 'date' y 'payment')
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
        // Buscar ventas pendientes en Dexie
        const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
        if (pendingSales.length === 0) return;

        const businessId = localStorage.getItem('archsell_business_id');
        if (!businessId) return console.error("Falta Business ID");

        console.log(`☁️ Procesando ${pendingSales.length} ventas...`);

        for (const sale of pendingSales) {
            try {
                // --- PASO 1: TRADUCCIÓN DE DATOS (El arreglo vital) ---
                // Sacamos los campos que Dexie usa pero Supabase NO quiere con ese nombre
                const { id, sync_status, items_rpc, payment, date, ...restOfSale } = sale;
                
                // Construimos el objeto EXACTO que pide Supabase
                const saleToInsert = {
                    ...restOfSale,
                    // Traducimos 'payment' (JS) -> 'payment_data' (SQL)
                    payment_data: payment, 
                    // Traducimos 'date' (JS) -> 'created_at' (SQL) <--- AQUÍ ESTABA EL ERROR
                    created_at: new Date(date).toISOString(),
                    items: sale.items,
                    business_id: businessId
                };

                // Insertamos en la nube
                const { error: insertError } = await supabase.from('sales').insert(saleToInsert);

                if (insertError) {
                    console.error("Error insertando venta:", insertError);
                    // Si falla la inserción, NO seguimos con el stock para evitar desastres
                    continue; 
                }

                // --- PASO 2: RESTAR STOCK (Directo JS - Fuerza Bruta) ---
                // Usamos items_rpc (del POS) o mapeamos al vuelo
                const itemsToUpdate = items_rpc || sale.items.map(i => ({
                    id: i.id,
                    qty: Number(i.cantidad || i.qty || 1)
                }));

                console.log("📉 Restando stock para:", itemsToUpdate);

                for (const item of itemsToUpdate) {
                    // A. Leer stock actual de la nube
                    const { data: productNow, error: readError } = await supabase
                        .from('products')
                        .select('stock')
                        .eq('id', item.id)
                        .single();

                    if (productNow) {
                        const nuevoStock = productNow.stock - item.qty;
                        
                        // B. Escribir nuevo stock
                        await supabase
                            .from('products')
                            .update({ stock: nuevoStock })
                            .eq('id', item.id);
                    }
                }

                // --- PASO 3: ÉXITO ---
                // Marcamos como sincronizado en local
                await db.sales.update(id, { sync_status: 'synced' });

            } catch (err) {
                console.error("Error fatal en venta:", err);
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
            await db.transaction('rw', db.sales, async () => {
                await db.sales.bulkPut(salesFormatted);
            });
        }
    }
};