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

        const businessId = await this.resolveBusinessId();
        const branchId   = BranchService.getActiveBranchId();

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

    // Resuelve el business_id real verificando que efectivamente tenga productos.
    // Si el ID almacenado es inválido/placeholder, lo busca desde branch_staff.
    async resolveBusinessId() {
        let businessId = localStorage.getItem('archsell_business_id');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return businessId;

            // 1. Verificar si el business_id actual es funcional (HEAD request liviano)
            if (businessId) {
                const { error: testError } = await supabase
                    .from('products')
                    .select('id', { count: 'exact', head: true })
                    .eq('business_id', businessId);

                if (!testError) {
                    // El ID es válido (aunque tenga 0 productos, la query no da 500)
                    return businessId;
                }
            }

            // 2. ID inválido → buscar el real desde branch_staff (sin filtrar por business_id)
            console.warn('⚠️ business_id inválido, buscando el correcto...');
            const { data: staffRecords } = await supabase
                .from('branch_staff')
                .select('business_id')
                .eq('user_id', user.id)
                .limit(1);

            if (staffRecords?.[0]?.business_id) {
                businessId = staffRecords[0].business_id;
                localStorage.setItem('archsell_business_id', businessId);
                console.warn(`🔄 business_id corregido a: ${businessId}`);
                return businessId;
            }

            // 3. Fallback: perfil de Supabase
            const { data: profile } = await supabase
                .from('profiles')
                .select('business_id')
                .eq('id', user.id)
                .single();

            if (profile?.business_id) {
                businessId = profile.business_id;
                localStorage.setItem('archsell_business_id', businessId);
            }
        } catch (_) {}

        return businessId;
    },

    async downloadProducts() {
        const businessId = await this.resolveBusinessId();
        if (!businessId) return;

        const branchId = BranchService.getActiveBranchId();

        let query = supabase.from('products').select('*').eq('business_id', businessId);

        // Si hay sucursal activa, traer los productos de esa sucursal Y los globales (branch_id = null)
        if (branchId) {
            query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
        }
        // Sin sucursal activa → descarga todos los productos del negocio

        const { data, error } = await query;

        if (error) {
            console.warn('⚠️ downloadProducts: error al obtener de Supabase', error.message);
            return;
        }

        if (data) {
            // Eliminar productos locales obsoletos (borrados en remoto) dentro del scope actual
            const downloadedIds = new Set(data.map(p => p.id));
            let localProducts = [];
            try {
                localProducts = await db.products.where('business_id').equals(businessId).toArray();
            } catch {
                localProducts = (await db.products.toArray()).filter(p => p.business_id === businessId);
            }
            const staleIds = localProducts
                .filter(p => {
                    const inScope = branchId ? p.branch_id === branchId : true;
                    return inScope && !downloadedIds.has(p.id);
                })
                .map(p => p.id);

            if (staleIds.length > 0) {
                await db.products.bulkDelete(staleIds);
                console.log(`🗑️ ${staleIds.length} productos obsoletos eliminados localmente`);
            }

            await db.products.bulkPut(data);
            console.log(`📦 ${data.length} productos actualizados localmente`);
        }
    },

    async downloadSalesHistory() {
        const businessId = await this.resolveBusinessId();
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