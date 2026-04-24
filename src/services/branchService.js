// src/services/branchService.js
// ─────────────────────────────────────────────────────────────
// Servicio central de gestión de sucursales.
// Maneja la sucursal activa, permisos por rol y caché local.
// ─────────────────────────────────────────────────────────────
import { supabase } from '../data/supabase.js';

const STORAGE_KEYS = {
    ACTIVE_BRANCH_ID:   'archsell_active_branch_id',
    ACTIVE_BRANCH_NAME: 'archsell_active_branch_name',
    ACTIVE_BRANCH_COLOR:'archsell_active_branch_color',
    BRANCH_ROLE:        'archsell_branch_role',
    ALL_BRANCHES:       'archsell_all_branches',     // JSON cache
    IS_OWNER:           'archsell_is_owner',
};

export const BranchService = {

    // ── Getters simples ───────────────────────────────────────
    getActiveBranchId()   { return localStorage.getItem(STORAGE_KEYS.ACTIVE_BRANCH_ID) || null; },
    getActiveBranchName() { return localStorage.getItem(STORAGE_KEYS.ACTIVE_BRANCH_NAME) || 'Sucursal'; },
    getActiveBranchColor(){ return localStorage.getItem(STORAGE_KEYS.ACTIVE_BRANCH_COLOR) || '#7A3F9D'; },
    getBranchRole()       { return localStorage.getItem(STORAGE_KEYS.BRANCH_ROLE) || 'cashier'; },
    isOwner()             { return localStorage.getItem(STORAGE_KEYS.IS_OWNER) === 'true'; },
    isAdmin()             { return ['owner','branch_admin'].includes(this.getBranchRole()); },

    // Devuelve null si es owner (ve todo), o el branch_id activo
    getFilterBranchId() {
        if (this.isOwner()) return this.getActiveBranchId(); // null = todas
        return this.getActiveBranchId();
    },

    // ── Cache de sucursales ───────────────────────────────────
    getCachedBranches() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.ALL_BRANCHES);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    },

    cacheBranches(branches) {
        localStorage.setItem(STORAGE_KEYS.ALL_BRANCHES, JSON.stringify(branches));
    },

    // ── Inicialización post-login ─────────────────────────────
    // Llámalo en login.js después de autenticar al usuario.
    async initFromLogin(userId, businessId) {
        try {
            // Obtener todos los registros de branch_staff para este usuario
            const { data: staffRecords, error } = await supabase
                .from('branch_staff')
                .select('role, branch_id, branches(id, name, color, address, is_active)')
                .eq('user_id', userId)
                .eq('business_id', businessId);

            if (error || !staffRecords || staffRecords.length === 0) {
                console.warn('BranchService: sin registros en branch_staff, modo legacy');
                // Modo legacy: negocio sin multisucursal configurado aún
                localStorage.removeItem(STORAGE_KEYS.ACTIVE_BRANCH_ID);
                localStorage.setItem(STORAGE_KEYS.BRANCH_ROLE, 'owner');
                localStorage.setItem(STORAGE_KEYS.IS_OWNER, 'true');
                return;
            }

            // El owner siempre tiene al menos un registro con role='owner'
            const ownerRecord = staffRecords.find(r => r.role === 'owner');
            const isOwner = !!ownerRecord;
            localStorage.setItem(STORAGE_KEYS.IS_OWNER, String(isOwner));

            if (isOwner) {
                // Owner: cargar TODAS las sucursales del negocio
                const { data: allBranches } = await supabase
                    .from('branches')
                    .select('*')
                    .eq('business_id', businessId)
                    .eq('is_active', true)
                    .order('name');

                this.cacheBranches(allBranches || []);
                localStorage.setItem(STORAGE_KEYS.BRANCH_ROLE, 'owner');

                // Si hay una sola sucursal, activarla; si hay varias, dejar null (vista consolidada)
                if (allBranches && allBranches.length === 1) {
                    this.setActiveBranch(allBranches[0]);
                } else {
                    localStorage.removeItem(STORAGE_KEYS.ACTIVE_BRANCH_ID);
                    localStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH_NAME, 'Todas las sucursales');
                    localStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH_COLOR, '#7A3F9D');
                }
            } else {
                // Cajero / branch_admin: solo ve su sucursal asignada
                const myRecord = staffRecords[0];
                localStorage.setItem(STORAGE_KEYS.BRANCH_ROLE, myRecord.role);
                if (myRecord.branches) {
                    this.setActiveBranch(myRecord.branches);
                    this.cacheBranches([myRecord.branches]);
                }
            }
        } catch (err) {
            console.error('BranchService.initFromLogin error:', err);
        }
    },

    // ── Activar una sucursal (selector del header) ────────────
    setActiveBranch(branch) {
        if (!branch) {
            // null = vista consolidada (solo owners)
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_BRANCH_ID);
            localStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH_NAME, 'Todas las sucursales');
            localStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH_COLOR, '#7A3F9D');
            return;
        }
        localStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH_ID,    branch.id);
        localStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH_NAME,  branch.name);
        localStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH_COLOR, branch.color || '#7A3F9D');
    },

    // ── CRUD de sucursales ────────────────────────────────────
    async fetchAll(businessId) {
        const { data, error } = await supabase
            .from('branches')
            .select('*')
            .eq('business_id', businessId)
            .order('name');
        if (error) throw error;
        this.cacheBranches(data || []);
        return data || [];
    },

    async create(businessId, payload) {
        const { data, error } = await supabase
            .from('branches')
            .insert({ ...payload, business_id: businessId })
            .select()
            .single();
        if (error) throw error;

        // Asignar al owner actual en branch_staff
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('branch_staff').insert({
            user_id:     user.id,
            branch_id:   data.id,
            business_id: businessId,
            role:        'owner'
        });

        return data;
    },

    async update(branchId, payload) {
        const { data, error } = await supabase
            .from('branches')
            .update(payload)
            .eq('id', branchId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deactivate(branchId) {
        const { error } = await supabase
            .from('branches')
            .update({ is_active: false })
            .eq('id', branchId);
        if (error) throw error;
    },

    // ── Gestión de personal ───────────────────────────────────
    async fetchStaff(branchId) {
        const { data, error } = await supabase
            .from('branch_staff')
            .select('*, profiles(email, full_name)')
            .eq('branch_id', branchId);
        if (error) throw error;
        return data || [];
    },

    async addStaff(payload) {
        // payload: { user_id, branch_id, business_id, role }
        const { data, error } = await supabase
            .from('branch_staff')
            .insert(payload)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async removeStaff(staffId) {
        const { error } = await supabase
            .from('branch_staff')
            .delete()
            .eq('id', staffId);
        if (error) throw error;
    },

    // ── Métricas por sucursal (para dashboard corporativo) ────
    async fetchTodayMetrics(businessId) {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('sales')
            .select('branch_id, total, items')
            .eq('business_id', businessId)
            .gte('created_at', `${today}T00:00:00`)
            .lte('created_at', `${today}T23:59:59`)
            .neq('status', 'cancelado');
        if (error) return {};

        // Agrupar por sucursal
        const metrics = {};
        (data || []).forEach(sale => {
            const bid = sale.branch_id || 'sin_sucursal';
            if (!metrics[bid]) metrics[bid] = { total: 0, count: 0 };
            metrics[bid].total += Number(sale.total || 0);
            metrics[bid].count += 1;
        });
        return metrics;
    },

    // ── Traspasos ─────────────────────────────────────────────
    async fetchTransfers(businessId, filters = {}) {
        let query = supabase
            .from('stock_transfers')
            .select(`
                *,
                from_branch:branches!stock_transfers_from_branch_id_fkey(id, name, color),
                to_branch:branches!stock_transfers_to_branch_id_fkey(id, name, color),
                products(id, name, unit)
            `)
            .eq('business_id', businessId)
            .order('created_at', { ascending: false });

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.branchId) {
            query = query.or(
                `from_branch_id.eq.${filters.branchId},to_branch_id.eq.${filters.branchId}`
            );
        }
        if (filters.limit) query = query.limit(filters.limit);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async createTransfer(payload) {
        // payload: { business_id, from_branch_id, to_branch_id, product_id, quantity, notes }
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('stock_transfers')
            .insert({ ...payload, requested_by: user.id, status: 'pending' })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async approveTransfer(transferId) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.rpc('aprobar_traspaso', {
            p_transfer_id: transferId,
            p_user_id:     user.id
        });
        if (error) throw error;
        return data;
    },

    async dispatchTransfer(transferId) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.rpc('despachar_traspaso', {
            p_transfer_id: transferId,
            p_user_id:     user.id
        });
        if (error) throw error;
        return data;
    },

    async receiveTransfer(transferId) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.rpc('procesar_traspaso', {
            p_transfer_id: transferId,
            p_user_id:     user.id
        });
        if (error) throw error;
        return data;
    },

    // ── Helper: aplica el filtro de sucursal a cualquier query ─
    // Uso: let q = supabase.from('sales').select('*');
    //       q = BranchService.applyBranchFilter(q);
    applyBranchFilter(query, businessId) {
        const branchId = this.getActiveBranchId();
        if (branchId) return query.eq('branch_id', branchId);
        // Owner sin sucursal activa → filtra solo por negocio
        return query.eq('business_id', businessId);
    },
};