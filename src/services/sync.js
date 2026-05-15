// src/services/sync.js
// ── VERSIÓN ACTUALIZADA CON MULTISUCURSAL ──
import { supabase } from '../data/supabase.js';
import { db } from '../data/db-local.js';
import { BranchService } from './branchService.js';

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
            await this.uploadSales();
            await this.downloadProducts();
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
        const branchId   = BranchService.getActiveBranchId(); // ← NUEVO

        if (!businessId) return console.error("Falta Business ID");

        console.log(`☁️ Procesando ${pendingSales.length} ventas...`);

        for (const sale of pendingSales) {
            try {
                const { data: rpcData, error: rpcError } = await supabase.rpc('sincronizar_venta_offline', {
                    p_sale_id:     sale.id,
                    p_business_id: businessId,
                    p_branch_id:   sale.branch_id || branchId || null, // ← NUEVO
                    p_user_id:     sale.user_id || (await supabase.auth.getUser()).data.user?.id,
                    p_total:       sale.total,
                    p_items:       sale.items,
                    p_payment_data: sale.payment || sale.payment_data,
                    p_created_at:  new Date(sale.date || sale.created_at).toISOString()
                });

                if (rpcError) throw rpcError;

                if (rpcData.success) {
                    console.log(`✅ Venta sincronizada: ${sale.id} (${rpcData.status})`);

                    // ── Descontar stock en Supabase por cada ítem vendido ──
                    const items = sale.items || [];
                    for (const item of items) {
                        if (!item.id || item.is_bulk) continue;
                        try {
                            const { data: prod } = await supabase
                                .from('products')
                                .select('stock, is_bulk')
                                .eq('id', item.id)
                                .single();
                            if (prod && !prod.is_bulk) {
                                const qty = Number(item.cantidad || item.qty || 1);
                                const newStock = Math.max(0, (prod.stock ?? 0) - qty);
                                await supabase
                                    .from('products')
                                    .update({ stock: newStock })
                                    .eq('id', item.id);
                            }
                        } catch (stockErr) {
                            console.warn(`⚠️ No se pudo descontar stock del producto ${item.id}:`, stockErr.message);
                        }
                    }

                    await db.sales.update(sale.id, { sync_status: 'synced' });
                } else {
                    console.error(`⚠️ Venta rechazada: ${rpcData.message}`);
                }

            } catch (err) {
                console.error("❌ Error en venta:", sale.id, err);
            }
        }
    },

    async downloadProducts() {
        const businessId = localStorage.getItem('archsell_business_id');
        if (!businessId) return;

        // ── NUEVO: filtrar por sucursal si el usuario tiene una asignada ──
        const branchId = BranchService.getActiveBranchId();

        let query = supabase.from('products').select('*').eq('business_id', businessId);

        // Si hay sucursal activa Y no es owner viendo "todas", filtramos por branch
        if (branchId && !BranchService.isOwner()) {
            query = query.eq('branch_id', branchId);
        } else if (branchId && BranchService.isOwner()) {
            // Owner con sucursal seleccionada: solo esa sucursal
            query = query.eq('branch_id', branchId);
        }
        // Owner sin sucursal activa (null) → descarga TODOS los productos de todas las sucursales

        const { data, error } = await query;

        if (!error && data) {
            await db.products.bulkPut(data);
            console.log(`📦 ${data.length} productos actualizados localmente`);
        }
    },

    async downloadSalesHistory() {
        const businessId = localStorage.getItem('archsell_business_id');
        if (!businessId) return;

        const branchId = BranchService.getActiveBranchId();

        let query = supabase
            .from('sales')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(100);

        // Filtrar por sucursal si aplica
        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data } = await query;

        if (data) {
            const salesFormatted = data.map(s => ({
                ...s,
                payment:     s.payment_data,
                date:        new Date(s.created_at),
                sync_status: 'synced'
            }));

            await db.transaction('rw', db.sales, async () => {
                await db.sales.bulkPut(salesFormatted);
            });
        }
    }
};