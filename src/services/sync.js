// src/services/sync.js - CORREGIDO PARA RESTAR STOCK EN NUBE
import { db } from '../data/db-local.js';
import { supabase } from '../data/supabase.js';

export const syncService = {
    
    async uploadSales() {
        // Buscar ventas pendientes
        const pendientes = await db.sales.where('sync_status').equals('pending').toArray();
        
        if (pendientes.length === 0) return;

        console.log(`🔄 Sincronizando ${pendientes.length} ventas...`);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        for (const venta of pendientes) {
            try {
                // 1. Insertar el Ticket (Venta)
                const { error } = await supabase.from('sales').insert({
                    created_at: venta.date,
                    total: venta.total,
                    payment_data: venta.payment,
                    items: venta.items,
                    user_id: user.id,
                    local_id: venta.id
                });

                if (error) throw error;

                // 2. ACTUALIZAR STOCK REMOTO (¡LA PARTE QUE FALTABA!)
                // Por cada producto vendido, le decimos a la nube que reste
                for (const item of venta.items) {
                    // Primero obtenemos el stock actual de la nube para ese producto
                    const { data: productoNube } = await supabase
                        .from('products')
                        .select('stock')
                        .eq('id', item.id)
                        .single();

                    if (productoNube) {
                        const nuevoStock = productoNube.stock - item.cantidad;
                        
                        // Actualizamos la nube con el nuevo valor
                        await supabase
                            .from('products')
                            .update({ stock: nuevoStock })
                            .eq('id', item.id);
                    }
                }

                // 3. Marcar como sincronizado en local
                await db.sales.update(venta.id, { sync_status: 'synced' });
                console.log(`✅ Venta #${venta.id} subida y stock descontado en nube.`);

            } catch (err) {
                console.error("Error subiendo venta:", err);
            }
        }
    },

    async downloadProducts() {
        try {
            console.log("⬇️ Descargando productos...");
            const { data: cloudProducts, error } = await supabase.from('products').select('*');

            if (error) throw error;

            if (cloudProducts && cloudProducts.length > 0) {
                await db.transaction('rw', db.products, async () => {
                    await db.products.clear();
                    await db.products.bulkAdd(cloudProducts);
                });
                console.log("✅ Inventario local actualizado.");
                return true;
            }
            return false;
        } catch (err) {
            console.error("Error bajando productos:", err);
            return false;
        }
    },

    listenConnection(callback) {
        window.addEventListener('online', () => callback(true));
        window.addEventListener('offline', () => callback(false));
        callback(navigator.onLine);
    }
};