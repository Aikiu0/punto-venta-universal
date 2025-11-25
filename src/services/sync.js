// src/services/sync.js - VERSIÓN "MANUAL" INFALIBLE
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
            await this.uploadSales();      // 1. Subir y Restar
            await this.downloadProducts(); // 2. Bajar Stock Real
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
                // 1. INSERTAR VENTA EN HISTORIAL
                const { id, sync_status, items_rpc, payment, ...restOfSale } = sale;
                
                const { error: insertError } = await supabase.from('sales').insert({
                    ...restOfSale,
                    payment_data: payment, 
                    items: sale.items,
                    business_id: businessId,
                    created_at: new Date(sale.date).toISOString()
                });

                if (insertError) throw insertError;

                // 2. RESTAR STOCK (MANUALMENTE DESDE JS)
                // Unificamos: usamos items_rpc si existe, si no, mapeamos items
                const itemsToUpdate = items_rpc || sale.items.map(i => ({
                    id: i.id,
                    // TRUCO: Leemos 'cantidad' (español) O 'qty' (inglés) O '1'
                    qty: Number(i.cantidad || i.qty || 1)
                }));

                console.log("📉 Restando stock manualmente para:", itemsToUpdate);

                // Bucle de actualización directa
                for (const item of itemsToUpdate) {
                    // A. LEER el stock actual de la nube
                    const { data: productData, error: fetchError } = await supabase
                        .from('products')
                        .select('stock')
                        .eq('id', item.id)
                        .single();

                    if (fetchError) {
                        console.error("Error leyendo producto:", item.id, fetchError);
                        continue; // Saltamos al siguiente producto si este falla
                    }

                    if (productData) {
                        const nuevoStock = productData.stock - item.qty;
                        
                        console.log(`Producto ${item.id}: Stock ${productData.stock} - ${item.qty} = ${nuevoStock}`);

                        // B. ESCRIBIR el nuevo stock
                        const { error: updateError } = await supabase
                            .from('products')
                            .update({ stock: nuevoStock })
                            .eq('id', item.id);

                        if (updateError) console.error("Error actualizando stock:", updateError);
                    }
                }

                // 3. EXITO
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