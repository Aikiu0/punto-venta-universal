// src/modules/admin/branches.js
// ─────────────────────────────────────────────────────────────
// Módulo de gestión de sucursales y personal.
// Ruta: /admin/branches
// ─────────────────────────────────────────────────────────────
import { supabase } from '../../data/supabase.js';
import { BranchService } from '../../services/branchService.js';
import { PermissionService } from '../../services/permissions.js';
import { ThemeService } from '../../services/theme.js';
import { renderSidebarHeader } from './components/sidebarHeader.js';
import { renderAdminSidebarNav } from './components/adminSidebarNav.js';

export function renderBranches() {
    const lockOrders   = !PermissionService.can('web_orders');
    const lockHistory  = !PermissionService.can('history');
    const lockSettings = !PermissionService.can('settings');
    const lockSuppliers= !PermissionService.can('suppliers');

    return `
    <style>
        /* ── Branches Module Styles ── */
        .branch-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 0;
            overflow: hidden;
            transition: box-shadow 0.2s, transform 0.2s;
        }
        .branch-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.08); transform: translateY(-2px); }
        .branch-card-top {
            height: 6px;
            width: 100%;
        }
        .branch-card-body { padding: 20px; }
        .branch-name { font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin: 0 0 4px 0; }
        .branch-meta { font-size: 0.82rem; color: var(--text-secondary); margin: 0 0 12px 0; }
        .branch-kpi-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 14px;
        }
        .branch-kpi {
            background: var(--bg-input);
            border-radius: 8px;
            padding: 10px 12px;
        }
        .branch-kpi-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); }
        .branch-kpi-val { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-top: 2px; }
        .branch-actions { display: flex; gap: 8px; }
        .btn-branch-action {
            flex: 1; padding: 8px; border-radius: 8px; border: 1px solid var(--border-color);
            background: var(--bg-input); color: var(--text-primary); cursor: pointer;
            font-size: 0.82rem; font-weight: 600; transition: 0.15s; text-align: center;
        }
        .btn-branch-action:hover { background: var(--brand-color); color: white; border-color: var(--brand-color); }
        .btn-branch-action.danger:hover { background: #ef4444; color: white; border-color: #ef4444; }
        .add-branch-card {
            background: var(--bg-card);
            border: 2px dashed var(--border-color);
            border-radius: 14px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 220px;
            cursor: pointer;
            transition: border-color 0.2s, background 0.2s;
            color: var(--text-secondary);
            gap: 10px;
        }
        .add-branch-card:hover { border-color: var(--brand-color); background: var(--bg-hover); color: var(--brand-color); }
        .add-branch-icon { font-size: 2.5rem; }
        .add-branch-label { font-weight: 600; font-size: 0.95rem; }
        .staff-item {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 0; border-bottom: 1px solid var(--border-soft);
        }
        .staff-item:last-child { border-bottom: none; }
        .role-badge {
            font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 20px;
            text-transform: uppercase; letter-spacing: 0.5px;
        }
        .role-owner        { background: rgba(122,63,157,0.12); color: #7A3F9D; }
        .role-branch_admin { background: rgba(59,130,246,0.12); color: #3b82f6; }
        .role-cashier      { background: rgba(16,185,129,0.12); color: #10b981; }
        .role-auditor      { background: rgba(148,163,184,0.12); color: #64748b; }
        .modal-overlay-branches {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15,23,42,0.65); backdrop-filter: blur(4px);
            z-index: 1000; display: none; justify-content: center; align-items: center;
        }
        .modal-glass-branches {
            background: var(--bg-card); width: 480px; max-width: 95vw;
            padding: 32px; border-radius: 18px; border: 1px solid var(--border-color);
            box-shadow: 0 25px 60px rgba(0,0,0,0.3);
            max-height: 90vh; overflow-y: auto;
        }
        .form-field { margin-bottom: 14px; }
        .form-field label { display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px; }
        .form-input-b {
            width: 100%; padding: 11px 14px; border: 1px solid var(--border-color);
            background: var(--bg-input); color: var(--text-primary); border-radius: 9px;
            font-size: 0.95rem; outline: none; transition: border-color 0.2s;
            box-sizing: border-box;
        }
        .form-input-b:focus { border-color: var(--brand-color); }
        .color-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .color-dot {
            width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
            border: 2px solid transparent; transition: transform 0.15s, border-color 0.15s;
        }
        .color-dot:hover { transform: scale(1.15); }
        .color-dot.selected { border-color: var(--text-primary); transform: scale(1.15); }
        @media(max-width:768px) {
            .branches-grid { grid-template-columns: 1fr !important; }
        }
    </style>

    <div class="admin-container">
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
        <aside class="admin-sidebar" id="admin-sidebar">
            <div class="sidebar-logo">${renderSidebarHeader()}</div>
            ${renderAdminSidebarNav({
                active: 'branches',
                lockOrders,
                lockSuppliers,
                lockHistory,
                lockSettings,
                includeBranches: true,
                includeTransfers: true
            })}
        </aside>

        <main class="admin-content">
            <header class="content-header">
                <div style="display:flex;align-items:center;gap:10px;">
                    <button id="mobile-menu-btn" aria-label="Abrir menú" style="background:none;border:none;font-size:1.25rem;color:var(--text-primary);cursor:pointer;"><i class="bi bi-list"></i></button>
                    <div class="page-title">
                        <h1><i class="bi bi-shop" aria-hidden="true"></i> Sucursales</h1>
                        <p>Gestiona todas tus ubicaciones, personal y métricas por sucursal.</p>
                    </div>
                </div>
                <div style="display:flex;gap:10px;align-items:center;">
                    <button id="theme-toggle-branches" class="icon-btn" aria-label="Cambiar tema" style="background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);width:40px;height:40px;border-radius:8px;cursor:pointer;"><i class="bi bi-circle-half"></i></button>
                    <button id="btn-add-branch" class="btn-primary"><i class="bi bi-plus-lg" aria-hidden="true"></i> Nueva sucursal</button>
                </div>
            </header>

            <!-- KPIs corporativos -->
            <div id="corporate-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px;">
                <div class="card-panel" style="text-align:center;">
                    <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">Sucursales activas</div>
                    <div id="kpi-total-branches" style="font-size:2rem;font-weight:800;color:var(--brand-color);">—</div>
                </div>
                <div class="card-panel" style="text-align:center;">
                    <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">Venta total hoy</div>
                    <div id="kpi-total-today" style="font-size:2rem;font-weight:800;color:#10b981;">$—</div>
                </div>
                <div class="card-panel" style="text-align:center;">
                    <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">Total personal</div>
                    <div id="kpi-total-staff" style="font-size:2rem;font-weight:800;color:#3b82f6;">—</div>
                </div>
                <div class="card-panel" style="text-align:center;">
                    <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">Traspasos pendientes</div>
                    <div id="kpi-pending-transfers" style="font-size:2rem;font-weight:800;color:#f59e0b;">—</div>
                </div>
            </div>

            <!-- Grid de sucursales -->
            <div id="branches-grid" class="branches-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;"></div>
        </main>
    </div>

    <!-- Modal: Nueva / Editar sucursal -->
    <div id="branch-modal" class="modal-overlay-branches">
        <div class="modal-glass-branches">
            <h2 id="branch-modal-title" style="margin:0 0 22px 0;color:var(--text-primary);font-size:1.3rem;">Nueva Sucursal</h2>
            <input type="hidden" id="branch-modal-id">

            <div class="form-field">
                <label>Nombre de la sucursal *</label>
                <input type="text" id="bm-name" class="form-input-b" placeholder="Ej: CDMX — Centro">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-field">
                    <label>Dirección</label>
                    <input type="text" id="bm-address" class="form-input-b" placeholder="Calle y número">
                </div>
                <div class="form-field">
                    <label>Teléfono</label>
                    <input type="text" id="bm-phone" class="form-input-b" placeholder="55 1234 5678">
                </div>
            </div>
            <div class="form-field">
                <label>Nombre del encargado</label>
                <input type="text" id="bm-manager" class="form-input-b" placeholder="Nombre completo">
            </div>
            <div class="form-field">
                <label>Color identificador</label>
                <div class="color-row" id="color-picker-row">
                    ${['#7A3F9D','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#8b5cf6'].map(c =>
                        `<div class="color-dot" data-color="${c}" style="background:${c};" onclick="selectColor('${c}')"></div>`
                    ).join('')}
                </div>
                <input type="hidden" id="bm-color" value="#7A3F9D">
            </div>

            <div style="display:flex;gap:12px;margin-top:20px;">
                <button id="btn-cancel-branch" style="flex:1;padding:12px;border:1px solid var(--border-color);background:var(--bg-input);color:var(--text-primary);border-radius:9px;cursor:pointer;font-weight:600;">Cancelar</button>
                <button id="btn-save-branch" class="btn-primary" style="flex:2;justify-content:center;">Guardar Sucursal</button>
            </div>
        </div>
    </div>

    <!-- Modal: Personal de la sucursal -->
    <div id="staff-modal" class="modal-overlay-branches">
        <div class="modal-glass-branches">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:20px;">
                <div>
                    <h2 id="staff-modal-title" style="margin:0;color:var(--text-primary);font-size:1.2rem;">Personal</h2>
                    <p id="staff-modal-sub" style="margin:4px 0 0 0;color:var(--text-secondary);font-size:0.85rem;"></p>
                </div>
                <button id="btn-close-staff" style="background:none;border:none;font-size:1.8rem;color:var(--text-secondary);cursor:pointer;">&times;</button>
            </div>
            
            <div id="staff-list" style="min-height:60px;margin-bottom:20px;"></div>

            <div style="background:var(--bg-input);padding:16px;border-radius:10px;border:1px solid var(--border-color);">
                <p style="font-size:0.85rem;font-weight:700;color:var(--text-primary);margin:0 0 12px 0;">Agregar empleado</p>
                <div style="display:grid;gap:10px;">
                    <div class="form-field" style="margin:0;">
                        <label>Email del empleado</label>
                        <input type="email" id="new-staff-email" class="form-input-b" placeholder="empleado@empresa.com">
                    </div>
                    <div class="form-field" style="margin:0;">
                        <label>Rol</label>
                        <select id="new-staff-role" class="form-input-b">
                            <option value="cashier">Cajero — Solo POS</option>
                            <option value="branch_admin">Encargado — Admin de sucursal</option>
                            <option value="auditor">Auditor — Solo lectura</option>
                        </select>
                    </div>
                    <button id="btn-add-staff" class="btn-primary" style="justify-content:center;padding:10px;">Agregar empleado</button>
                </div>
            </div>
        </div>
    </div>
    `;
}

export async function setupBranchesLogic(router) {
    const businessId = localStorage.getItem('archsell_business_id');

    // ── Menú móvil ────────────────────────────────────────────
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btnOpen  = document.getElementById('mobile-menu-btn');
    const toggleMenu = (show) => {
        sidebar.classList.toggle('active', show);
        overlay.classList.toggle('active', show);
    };
    btnOpen?.addEventListener('click', () => toggleMenu(true));
    overlay?.addEventListener('click', () => toggleMenu(false));

    const navTo = (p) => { toggleMenu(false); router.navigate(p); };
    document.getElementById('nav-dash')?.addEventListener('click', () => navTo('/admin'));
    document.getElementById('nav-inventory')?.addEventListener('click', () => navTo('/admin/inventory'));
    document.getElementById('nav-pos')?.addEventListener('click', () => navTo('/pos'));
    document.getElementById('nav-history')?.addEventListener('click', () => navTo('/admin/history'));
    document.getElementById('nav-settings')?.addEventListener('click', () => navTo('/admin/settings'));
    document.getElementById('nav-suppliers')?.addEventListener('click', () => navTo('/admin/suppliers'));
    document.getElementById('nav-transfers')?.addEventListener('click', () => navTo('/admin/transfers'));
    document.getElementById('nav-orders')?.addEventListener('click', () => navTo('/admin/orders'));
    document.getElementById('nav-logout')?.addEventListener('click', async () => {
        await supabase.auth.signOut(); router.navigate('/');
    });
    document.getElementById('theme-toggle-branches')?.addEventListener('click', () => ThemeService.toggle());

    // ── Color picker ──────────────────────────────────────────
    window.selectColor = (color) => {
        document.getElementById('bm-color').value = color;
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
        document.querySelector(`.color-dot[data-color="${color}"]`)?.classList.add('selected');
    };
    // Seleccionar el primer color por defecto
    selectColor('#7A3F9D');

    // ── Modal sucursal ────────────────────────────────────────
    const branchModal = document.getElementById('branch-modal');
    const openBranchModal = (branch = null) => {
        document.getElementById('branch-modal-title').textContent = branch ? 'Editar Sucursal' : 'Nueva Sucursal';
        document.getElementById('branch-modal-id').value  = branch?.id || '';
        document.getElementById('bm-name').value          = branch?.name || '';
        document.getElementById('bm-address').value       = branch?.address || '';
        document.getElementById('bm-phone').value         = branch?.phone || '';
        document.getElementById('bm-manager').value       = branch?.manager_name || '';
        selectColor(branch?.color || '#7A3F9D');
        branchModal.style.display = 'flex';
        setTimeout(() => document.getElementById('bm-name').focus(), 100);
    };
    document.getElementById('btn-add-branch')?.addEventListener('click', () => openBranchModal());
    document.getElementById('btn-cancel-branch')?.addEventListener('click', () => branchModal.style.display = 'none');

    document.getElementById('btn-save-branch')?.addEventListener('click', async () => {
        const name = document.getElementById('bm-name').value.trim();
        if (!name) return alert('El nombre de la sucursal es obligatorio.');
        const btn = document.getElementById('btn-save-branch');
        btn.disabled = true; btn.textContent = 'Guardando...';

        const payload = {
            name,
            address:      document.getElementById('bm-address').value.trim(),
            phone:        document.getElementById('bm-phone').value.trim(),
            manager_name: document.getElementById('bm-manager').value.trim(),
            color:        document.getElementById('bm-color').value,
        };

        try {
            const id = document.getElementById('branch-modal-id').value;
            if (id) {
                await BranchService.update(id, payload);
            } else {
                await BranchService.create(businessId, payload);
            }
            branchModal.style.display = 'none';
            await loadBranches();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            btn.disabled = false; btn.textContent = 'Guardar Sucursal';
        }
    });

    // ── Modal personal ────────────────────────────────────────
    const staffModal  = document.getElementById('staff-modal');
    let currentBranchForStaff = null;

    document.getElementById('btn-close-staff')?.addEventListener('click', () => staffModal.style.display = 'none');

    const openStaffModal = async (branch) => {
        currentBranchForStaff = branch;
        document.getElementById('staff-modal-title').textContent = `Personal — ${branch.name}`;
        document.getElementById('staff-modal-sub').textContent   = branch.address || '';
        staffModal.style.display = 'flex';
        await refreshStaffList(branch.id);
    };

    const refreshStaffList = async (branchId) => {
        const listEl = document.getElementById('staff-list');
        listEl.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;">Cargando...</p>';
        try {
            const staff = await BranchService.fetchStaff(branchId);
            if (staff.length === 0) {
                listEl.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;">Sin empleados asignados aún.</p>';
                return;
            }
            listEl.innerHTML = staff.map(s => `
                <div class="staff-item">
                    <div>
                        <div style="font-weight:600;color:var(--text-primary);font-size:0.92rem;">${s.profiles?.full_name || 'Usuario'}</div>
                        <div style="font-size:0.78rem;color:var(--text-secondary);">${s.profiles?.email || ''}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span class="role-badge role-${s.role}">${s.role}</span>
                        ${s.role !== 'owner' ? `<button data-id="${s.id}" class="btn-remove-staff" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.1rem;">×</button>` : ''}
                    </div>
                </div>
            `).join('');
            document.querySelectorAll('.btn-remove-staff').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('¿Quitar a este empleado de la sucursal?')) return;
                    await BranchService.removeStaff(btn.dataset.id);
                    await refreshStaffList(branchId);
                });
            });
        } catch (err) {
            listEl.innerHTML = `<p style="color:#ef4444;">Error: ${err.message}</p>`;
        }
    };

    document.getElementById('btn-add-staff')?.addEventListener('click', async () => {
        if (!currentBranchForStaff) return;
        const email = document.getElementById('new-staff-email').value.trim();
        const role  = document.getElementById('new-staff-role').value;
        if (!email) return alert('Ingresa el email del empleado.');

        const btn = document.getElementById('btn-add-staff');
        btn.disabled = true; btn.textContent = 'Agregando...';

        try {
            // Buscar el user_id por email en profiles
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email)
                .single();

            if (error || !profile) {
                throw new Error('No se encontró un usuario con ese email. Asegúrate de que ya tenga cuenta.');
            }

            await BranchService.addStaff({
                user_id:     profile.id,
                branch_id:   currentBranchForStaff.id,
                business_id: businessId,
                role
            });

            document.getElementById('new-staff-email').value = '';
            await refreshStaffList(currentBranchForStaff.id);
            await loadBranches();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            btn.disabled = false; btn.textContent = 'Agregar empleado';
        }
    });

    // ── Cargar y renderizar sucursales ────────────────────────
    async function loadBranches() {
        const grid = document.getElementById('branches-grid');
        grid.innerHTML = '<p style="color:var(--text-secondary);padding:20px;">Cargando sucursales...</p>';

        try {
            const branches = await BranchService.fetchAll(businessId);
            const metrics  = await BranchService.fetchTodayMetrics(businessId);

            // KPIs corporativos
            const totalToday = Object.values(metrics).reduce((a, b) => a + b.total, 0);
            document.getElementById('kpi-total-branches').textContent = branches.filter(b => b.is_active).length;
            document.getElementById('kpi-total-today').textContent = '$' + totalToday.toLocaleString('es-MX', { minimumFractionDigits: 2 });

            // Contar personal
            let totalStaff = 0;
            for (const b of branches) {
                const staff = await BranchService.fetchStaff(b.id);
                b._staffCount = staff.length;
                totalStaff += staff.length;
            }
            document.getElementById('kpi-total-staff').textContent = totalStaff;

            // Traspasos pendientes
            const transfers = await BranchService.fetchTransfers(businessId, { status: 'pending' });
            document.getElementById('kpi-pending-transfers').textContent = transfers.length;

            if (branches.length === 0) {
                grid.innerHTML = `
                    <div class="add-branch-card" id="empty-add-card">
                        <div class="add-branch-icon"><i class="bi bi-shop"></i></div>
                        <div class="add-branch-label">Crear primera sucursal</div>
                        <div style="font-size:0.82rem;">Tu negocio aún no tiene sucursales configuradas.</div>
                    </div>`;
                document.getElementById('empty-add-card')?.addEventListener('click', () => openBranchModal());
                return;
            }

            grid.innerHTML = branches.map(branch => {
                const branchMetrics = metrics[branch.id] || { total: 0, count: 0 };
                const totalFmt = branchMetrics.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
                return `
                <div class="branch-card">
                    <div class="branch-card-top" style="background:${branch.color || '#7A3F9D'};"></div>
                    <div class="branch-card-body">
                        <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:4px;">
                            <h3 class="branch-name">${branch.name}</h3>
                            <span style="width:10px;height:10px;border-radius:50%;background:${branch.is_active ? '#10b981' : '#ef4444'};margin-top:5px;flex-shrink:0;" title="${branch.is_active ? 'Activa' : 'Inactiva'}"></span>
                        </div>
                        <p class="branch-meta">${branch.address || 'Sin dirección'} ${branch.manager_name ? '· ' + branch.manager_name : ''}</p>
                        <div class="branch-kpi-row">
                            <div class="branch-kpi">
                                <div class="branch-kpi-label">Ventas hoy</div>
                                <div class="branch-kpi-val" style="color:${branch.color || '#7A3F9D'};">${totalFmt}</div>
                            </div>
                            <div class="branch-kpi">
                                <div class="branch-kpi-label">Transacciones</div>
                                <div class="branch-kpi-val">${branchMetrics.count}</div>
                            </div>
                            <div class="branch-kpi">
                                <div class="branch-kpi-label">Personal</div>
                                <div class="branch-kpi-val">${branch._staffCount}</div>
                            </div>
                            <div class="branch-kpi">
                                <div class="branch-kpi-label">Teléfono</div>
                                <div class="branch-kpi-val" style="font-size:0.82rem;">${branch.phone || '—'}</div>
                            </div>
                        </div>
                        <div class="branch-actions">
                            <button class="btn-branch-action" data-id="${branch.id}" data-action="edit"><i class="bi bi-pencil-square" aria-hidden="true"></i> Editar</button>
                            <button class="btn-branch-action" data-id="${branch.id}" data-action="staff"><i class="bi bi-people" aria-hidden="true"></i> Personal</button>
                            <button class="btn-branch-action danger" data-id="${branch.id}" data-action="deactivate"><i class="bi bi-trash3" aria-hidden="true"></i></button>
                        </div>
                    </div>
                </div>`;
            }).join('') + `
            <div class="add-branch-card" id="add-branch-card-bottom">
                <div class="add-branch-icon"><i class="bi bi-plus-lg"></i></div>
                <div class="add-branch-label">Agregar sucursal</div>
            </div>`;

            document.getElementById('add-branch-card-bottom')?.addEventListener('click', () => openBranchModal());

            document.querySelectorAll('.btn-branch-action').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id     = btn.dataset.id;
                    const action = btn.dataset.action;
                    const branch = branches.find(b => b.id === id);
                    if (!branch) return;

                    if (action === 'edit') {
                        openBranchModal(branch);
                    } else if (action === 'staff') {
                        await openStaffModal(branch);
                    } else if (action === 'deactivate') {
                        if (!confirm(`¿Desactivar la sucursal "${branch.name}"? El personal no podrá acceder.`)) return;
                        await BranchService.deactivate(id);
                        await loadBranches();
                    }
                });
            });
        } catch (err) {
            grid.innerHTML = `<p style="color:#ef4444;padding:20px;">Error al cargar: ${err.message}</p>`;
        }
    }

    loadBranches();
}
