// src/modules/admin/transfers.js
// ─────────────────────────────────────────────────────────────
// Módulo de traspasos de stock entre sucursales.
// Ruta: /admin/transfers
// ─────────────────────────────────────────────────────────────
import { supabase } from '../../data/supabase.js';
import { BranchService } from '../../services/branchService.js';
import { PermissionService } from '../../services/permissions.js';
import { ThemeService } from '../../services/theme.js';
import { renderSidebarHeader } from './components/sidebarHeader.js';
import { renderAdminSidebarNav } from './components/adminSidebarNav.js';

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const STATUS_LABEL = {
    pending:    { label: 'Pendiente',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
    approved:   { label: 'Aprobado',     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
    in_transit: { label: 'En tránsito',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
    received:   { label: 'Recibido',     color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
    cancelled:  { label: 'Cancelado',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
};

function statusBadge(status) {
    const s = STATUS_LABEL[status] || STATUS_LABEL.pending;
    return `<span style="font-size:0.72rem;font-weight:700;padding:3px 10px;border-radius:20px;
        color:${s.color};background:${s.bg};text-transform:uppercase;letter-spacing:0.5px;">${s.label}</span>`;
}

// ── Render ─────────────────────────────────────────────────────
export function renderTransfers() {
    const lockOrders   = !PermissionService.can('web_orders');
    const lockHistory  = !PermissionService.can('history');
    const lockSettings = !PermissionService.can('settings');
    const lockSuppliers= !PermissionService.can('suppliers');

    return `
    <style>
        /* ── Transfers Module Styles ── */
        .transfer-row {
            display: grid;
            grid-template-columns: 1fr 2fr 1fr 1fr 1fr auto;
            align-items: center;
            gap: 12px;
            padding: 14px 20px;
            border-bottom: 1px solid var(--border-soft);
            transition: background 0.15s;
        }
        .transfer-row:hover { background: var(--bg-hover); }
        .transfer-row:last-child { border-bottom: none; }
        .transfer-route {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.88rem;
        }
        .branch-chip {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 0.78rem;
            font-weight: 600;
            background: var(--bg-input);
            color: var(--text-primary);
        }
        .chip-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .transfer-arrow { color: var(--text-secondary); font-size: 1rem; }
        .action-btn-tr {
            padding: 6px 14px;
            border-radius: 7px;
            border: none;
            cursor: pointer;
            font-size: 0.8rem;
            font-weight: 700;
            transition: 0.15s;
            white-space: nowrap;
        }
        .action-btn-tr:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-approve  { background: #3b82f6; color: white; }
        .btn-dispatch { background: #8b5cf6; color: white; }
        .btn-receive  { background: #10b981; color: white; }
        .btn-cancel-tr { background: var(--bg-input); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
        .filter-tabs {
            display: flex;
            gap: 4px;
            background: var(--bg-input);
            padding: 4px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .filter-tab {
            padding: 7px 16px;
            border-radius: 7px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
            transition: 0.15s;
        }
        .filter-tab.active {
            background: var(--bg-card);
            color: var(--text-primary);
            box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .new-transfer-panel {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 24px;
            margin-bottom: 24px;
        }
        .nt-title {
            font-size: 1rem;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0 0 18px 0;
        }
        .nt-grid {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 12px;
            align-items: end;
            margin-bottom: 14px;
        }
        .nt-arrow {
            font-size: 1.5rem;
            color: var(--text-secondary);
            padding-bottom: 10px;
            text-align: center;
        }
        .input-label {
            font-size: 0.72rem;
            font-weight: 700;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.4px;
            margin-bottom: 5px;
            display: block;
        }
        .input-tr {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--border-color);
            background: var(--bg-input);
            color: var(--text-primary);
            border-radius: 8px;
            font-size: 0.92rem;
            outline: none;
            transition: border-color 0.2s;
            box-sizing: border-box;
        }
        .input-tr:focus { border-color: var(--brand-color); }
        .product-autocomplete { position: relative; }
        .product-results {
            position: absolute;
            top: 100%; left: 0; right: 0;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 200;
            box-shadow: 0 8px 20px rgba(0,0,0,0.12);
            display: none;
        }
        .product-result-item {
            padding: 10px 14px;
            cursor: pointer;
            border-bottom: 1px solid var(--border-soft);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.88rem;
        }
        .product-result-item:last-child { border-bottom: none; }
        .product-result-item:hover { background: var(--bg-input); }
        .stock-preview {
            background: var(--bg-input);
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-top: 8px;
            display: none;
        }
        .stock-preview.visible { display: block; }
        .kpi-transfers {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        }
        .kpi-tr-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 14px 16px;
            text-align: center;
        }
        .kpi-tr-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-secondary); margin-bottom: 6px; }
        .kpi-tr-val   { font-size: 1.6rem; font-weight: 800; color: var(--text-primary); }
        .table-header-tr {
            display: grid;
            grid-template-columns: 1fr 2fr 1fr 1fr 1fr auto;
            gap: 12px;
            padding: 10px 20px;
            background: var(--bg-input);
            border-bottom: 1px solid var(--border-color);
        }
        .table-th {
            font-size: 0.72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: var(--text-secondary);
        }
        .empty-state {
            text-align: center;
            padding: 50px 20px;
            color: var(--text-secondary);
        }
        .empty-icon { font-size: 3rem; margin-bottom: 10px; }
        @media(max-width:768px) {
            .transfer-row { grid-template-columns: 1fr; gap: 6px; }
            .table-header-tr { display: none; }
            .nt-grid { grid-template-columns: 1fr; }
            .nt-arrow { display: none; }
        }
    </style>

    <div class="admin-container">
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
        <aside class="admin-sidebar" id="admin-sidebar">
            <div class="sidebar-logo">${renderSidebarHeader()}</div>
            ${renderAdminSidebarNav({
                active: 'transfers',
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
                        <h1><i class="bi bi-arrow-left-right" aria-hidden="true"></i> Traspasos de stock</h1>
                        <p>Mueve mercancía entre sucursales de forma controlada.</p>
                    </div>
                </div>
                <button id="theme-toggle-tr" class="icon-btn" aria-label="Cambiar tema" style="background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);width:40px;height:40px;border-radius:8px;cursor:pointer;"><i class="bi bi-circle-half"></i></button>
            </header>

            <!-- KPIs -->
            <div class="kpi-transfers">
                <div class="kpi-tr-card">
                    <div class="kpi-tr-label">Pendientes</div>
                    <div class="kpi-tr-val" id="kpi-tr-pending" style="color:#f59e0b;">—</div>
                </div>
                <div class="kpi-tr-card">
                    <div class="kpi-tr-label">En tránsito</div>
                    <div class="kpi-tr-val" id="kpi-tr-transit" style="color:#8b5cf6;">—</div>
                </div>
                <div class="kpi-tr-card">
                    <div class="kpi-tr-label">Recibidos este mes</div>
                    <div class="kpi-tr-val" id="kpi-tr-received" style="color:#10b981;">—</div>
                </div>
                <div class="kpi-tr-card">
                    <div class="kpi-tr-label">Cancelados</div>
                    <div class="kpi-tr-val" id="kpi-tr-cancelled" style="color:#ef4444;">—</div>
                </div>
            </div>

            <!-- Formulario nuevo traspaso -->
            <div class="new-transfer-panel">
                <h3 class="nt-title"><i class="bi bi-plus-lg" aria-hidden="true"></i> Solicitar nuevo traspaso</h3>

                <div class="nt-grid">
                    <div>
                        <span class="input-label">Sucursal origen</span>
                        <select id="tr-from" class="input-tr">
                            <option value="">Cargando sucursales...</option>
                        </select>
                    </div>
                    <div class="nt-arrow">→</div>
                    <div>
                        <span class="input-label">Sucursal destino</span>
                        <select id="tr-to" class="input-tr">
                            <option value="">Selecciona destino</option>
                        </select>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:14px;">
                    <div>
                        <span class="input-label">Producto</span>
                        <div class="product-autocomplete">
                            <input type="text" id="tr-product-search" class="input-tr" placeholder="Buscar producto por nombre o SKU..." autocomplete="off">
                            <input type="hidden" id="tr-product-id">
                            <input type="hidden" id="tr-product-name">
                            <div id="tr-product-results" class="product-results"></div>
                        </div>
                        <div id="tr-stock-preview" class="stock-preview"></div>
                    </div>
                    <div>
                        <span class="input-label">Cantidad</span>
                        <input type="number" id="tr-qty" class="input-tr" placeholder="0" min="0.01" step="0.01">
                    </div>
                </div>

                <div style="margin-bottom:14px;">
                    <span class="input-label">Notas (opcional)</span>
                    <input type="text" id="tr-notes" class="input-tr" placeholder="Ej: Urgente para surtir fin de semana">
                </div>

                <div style="display:flex;justify-content:flex-end;">
                    <button id="btn-create-transfer" class="btn-primary" style="padding:11px 28px;">
                        Solicitar traspaso →
                    </button>
                </div>
            </div>

            <!-- Lista de traspasos -->
            <div class="card-panel" style="padding:0;overflow:hidden;">
                <div style="padding:18px 20px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                    <h3 style="margin:0;font-size:1rem;font-weight:700;color:var(--text-primary);">Historial de traspasos</h3>
                    <div class="filter-tabs">
                        <button class="filter-tab active" data-filter="all">Todos</button>
                        <button class="filter-tab" data-filter="pending">Pendientes</button>
                        <button class="filter-tab" data-filter="in_transit">En tránsito</button>
                        <button class="filter-tab" data-filter="received">Recibidos</button>
                        <button class="filter-tab" data-filter="cancelled">Cancelados</button>
                    </div>
                </div>

                <div class="table-header-tr">
                    <div class="table-th">Fecha</div>
                    <div class="table-th">Ruta</div>
                    <div class="table-th">Producto</div>
                    <div class="table-th">Cantidad</div>
                    <div class="table-th">Estado</div>
                    <div class="table-th">Acción</div>
                </div>

                <div id="transfers-list">
                    <div class="empty-state">
                        <div class="empty-icon"><i class="bi bi-hourglass-split"></i></div>
                        <p>Cargando traspasos...</p>
                    </div>
                </div>
            </div>
        </main>
    </div>
    `;
}

// ── Setup ──────────────────────────────────────────────────────
export async function setupTransfersLogic(router) {
    const businessId = localStorage.getItem('archsell_business_id');
    const isOwner    = BranchService.isOwner();
    const myBranchId = BranchService.getActiveBranchId();

    // ── Navegación ────────────────────────────────────────────
    const sidebar  = document.getElementById('admin-sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    const btnOpen  = document.getElementById('mobile-menu-btn');
    const toggleMenu = (show) => {
        sidebar.classList.toggle('active', show);
        overlay.classList.toggle('active', show);
    };
    btnOpen?.addEventListener('click',  () => toggleMenu(true));
    overlay?.addEventListener('click',  () => toggleMenu(false));

    const navTo = (p) => { toggleMenu(false); router.navigate(p); };
    document.getElementById('nav-dash')?.addEventListener('click',      () => navTo('/admin'));
    document.getElementById('nav-inventory')?.addEventListener('click', () => navTo('/admin/inventory'));
    document.getElementById('nav-pos')?.addEventListener('click',       () => navTo('/pos'));
    document.getElementById('nav-history')?.addEventListener('click',   () => navTo('/admin/history'));
    document.getElementById('nav-settings')?.addEventListener('click',  () => navTo('/admin/settings'));
    document.getElementById('nav-suppliers')?.addEventListener('click', () => navTo('/admin/suppliers'));
    document.getElementById('nav-branches')?.addEventListener('click',  () => navTo('/admin/branches'));
    document.getElementById('nav-orders')?.addEventListener('click',    () => navTo('/admin/orders'));
    document.getElementById('nav-logout')?.addEventListener('click', async () => {
        await supabase.auth.signOut(); router.navigate('/');
    });
    document.getElementById('theme-toggle-tr')?.addEventListener('click', () => ThemeService.toggle());

    // ── Cargar sucursales en los selects ──────────────────────
    let allBranches  = [];
    let allProducts  = [];
    let allTransfers = [];
    let activeFilter = 'all';

    async function loadBranches() {
        allBranches = BranchService.getCachedBranches();
        if (allBranches.length === 0) {
            allBranches = await BranchService.fetchAll(businessId);
        }
        const activeBranches = allBranches.filter(b => b.is_active);
        const fromSel = document.getElementById('tr-from');
        const toSel   = document.getElementById('tr-to');

        const options = activeBranches.map(b =>
            `<option value="${b.id}" data-color="${b.color || '#7A3F9D'}">${b.name}</option>`
        ).join('');

        fromSel.innerHTML = '<option value="">— Selecciona origen —</option>' + options;
        toSel.innerHTML   = '<option value="">— Selecciona destino —</option>' + options;

        // Si el usuario es cajero/encargado, pre-seleccionar su sucursal como origen
        if (!isOwner && myBranchId) {
            fromSel.value = myBranchId;
            fromSel.disabled = true; // No puede cambiar el origen
        }
    }

    // ── Autocomplete de producto ──────────────────────────────
    async function loadProducts() {
        const branchId = document.getElementById('tr-from').value;
        if (!branchId) { allProducts = []; return; }

        const { data } = await supabase
            .from('products')
            .select('id, name, sku, stock, unit, price')
            .eq('business_id', businessId)
            .eq('branch_id', branchId)
            .gt('stock', 0)
            .order('name');
        allProducts = data || [];
    }

    const searchInput   = document.getElementById('tr-product-search');
    const resultsBox    = document.getElementById('tr-product-results');
    const stockPreview  = document.getElementById('tr-stock-preview');
    let selectedProduct = null;

    searchInput.addEventListener('input', () => {
        const term = searchInput.value.toLowerCase().trim();
        selectedProduct = null;
        document.getElementById('tr-product-id').value   = '';
        document.getElementById('tr-product-name').value = '';
        stockPreview.classList.remove('visible');

        if (term.length < 1) { resultsBox.style.display = 'none'; return; }

        const matches = allProducts.filter(p =>
            p.name.toLowerCase().includes(term) ||
            (p.sku && p.sku.toLowerCase().includes(term))
        );

        if (matches.length === 0) { resultsBox.style.display = 'none'; return; }

        resultsBox.innerHTML = matches.slice(0, 8).map(p => `
            <div class="product-result-item" data-id="${p.id}">
                <div>
                    <span style="font-weight:600;color:var(--text-primary);">${p.name}</span>
                    ${p.sku ? `<span style="font-size:0.75rem;color:var(--text-secondary);margin-left:6px;">${p.sku}</span>` : ''}
                </div>
                <span style="font-weight:700;color:var(--brand-color);">
                    ${p.stock} ${p.unit || 'pz'}
                </span>
            </div>
        `).join('');
        resultsBox.style.display = 'block';

        resultsBox.querySelectorAll('.product-result-item').forEach(item => {
            item.addEventListener('click', () => {
                selectedProduct = allProducts.find(p => p.id === item.dataset.id);
                searchInput.value = selectedProduct.name;
                document.getElementById('tr-product-id').value   = selectedProduct.id;
                document.getElementById('tr-product-name').value = selectedProduct.name;
                resultsBox.style.display = 'none';
                stockPreview.innerHTML = `<i class="bi bi-box-seam" aria-hidden="true"></i> Stock disponible en origen: ${selectedProduct.stock} ${selectedProduct.unit || 'pz'}`;
                stockPreview.classList.add('visible');
                document.getElementById('tr-qty').focus();
            });
        });
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsBox.contains(e.target)) {
            resultsBox.style.display = 'none';
        }
    });

    // Cuando cambia la sucursal origen, recargar productos
    document.getElementById('tr-from').addEventListener('change', async () => {
        searchInput.value = '';
        document.getElementById('tr-product-id').value   = '';
        document.getElementById('tr-product-name').value = '';
        selectedProduct = null;
        stockPreview.classList.remove('visible');
        await loadProducts();
    });

    // ── Crear traspaso ────────────────────────────────────────
    document.getElementById('btn-create-transfer')?.addEventListener('click', async () => {
        const fromId   = document.getElementById('tr-from').value;
        const toId     = document.getElementById('tr-to').value;
        const prodId   = document.getElementById('tr-product-id').value;
        const prodName = document.getElementById('tr-product-name').value;
        const qty      = parseFloat(document.getElementById('tr-qty').value);
        const notes    = document.getElementById('tr-notes').value.trim();

        // Validaciones
        if (!fromId)         return alert('Selecciona la sucursal de origen.');
        if (!toId)           return alert('Selecciona la sucursal de destino.');
        if (fromId === toId) return alert('La sucursal de origen y destino no pueden ser la misma.');
        if (!prodId)         return alert('Selecciona un producto.');
        if (!qty || qty <= 0) return alert('Ingresa una cantidad válida mayor a 0.');
        if (selectedProduct && qty > selectedProduct.stock) {
            return alert(`Stock insuficiente. Solo hay ${selectedProduct.stock} ${selectedProduct.unit || 'pz'} disponibles.`);
        }

        const btn = document.getElementById('btn-create-transfer');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
            await BranchService.createTransfer({
                business_id:    businessId,
                from_branch_id: fromId,
                to_branch_id:   toId,
                product_id:     prodId,
                product_name:   prodName,
                quantity:       qty,
                unit:           selectedProduct?.unit || 'pz',
                notes
            });

            // Limpiar formulario
            document.getElementById('tr-to').value            = '';
            searchInput.value                                  = '';
            document.getElementById('tr-product-id').value    = '';
            document.getElementById('tr-product-name').value  = '';
            document.getElementById('tr-qty').value           = '';
            document.getElementById('tr-notes').value         = '';
            selectedProduct = null;
            stockPreview.classList.remove('visible');

            await loadTransfers();
            alert('✅ Solicitud de traspaso enviada. El encargado de origen debe despacharla.');
        } catch (err) {
            alert('Error al crear el traspaso: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Solicitar traspaso →';
        }
    });

    // ── Filtros de estado ─────────────────────────────────────
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeFilter = tab.dataset.filter;
            renderTransfersList();
        });
    });

    // ── Cargar traspasos ──────────────────────────────────────
    async function loadTransfers() {
        try {
            const filters = {};
            if (!isOwner && myBranchId) filters.branchId = myBranchId;
            allTransfers = await BranchService.fetchTransfers(businessId, filters);
            updateKPIs();
            renderTransfersList();
        } catch (err) {
            document.getElementById('transfers-list').innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
                    <p>Error al cargar traspasos: ${err.message}</p>
                </div>`;
        }
    }

    function updateKPIs() {
        const now      = new Date();
        const thisMonth = now.getMonth();
        const thisYear  = now.getFullYear();

        const pending   = allTransfers.filter(t => t.status === 'pending').length;
        const transit   = allTransfers.filter(t => t.status === 'in_transit').length;
        const received  = allTransfers.filter(t => {
            if (t.status !== 'received') return false;
            const d = new Date(t.received_at || t.created_at);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        }).length;
        const cancelled = allTransfers.filter(t => t.status === 'cancelled').length;

        document.getElementById('kpi-tr-pending').textContent   = pending;
        document.getElementById('kpi-tr-transit').textContent   = transit;
        document.getElementById('kpi-tr-received').textContent  = received;
        document.getElementById('kpi-tr-cancelled').textContent = cancelled;
    }

    // ── Render lista ──────────────────────────────────────────
    function renderTransfersList() {
        const list = document.getElementById('transfers-list');
        const filtered = activeFilter === 'all'
            ? allTransfers
            : allTransfers.filter(t => t.status === activeFilter);

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="bi bi-inbox"></i></div>
                    <p>${activeFilter === 'all'
                        ? 'No hay traspasos registrados todavía.'
                        : `No hay traspasos con estado "${STATUS_LABEL[activeFilter]?.label || activeFilter}".`}
                    </p>
                </div>`;
            return;
        }

        list.innerHTML = filtered.map(t => {
            const dateStr = new Date(t.created_at).toLocaleDateString('es-MX', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
            const fromColor = t.from_branch?.color || '#64748b';
            const toColor   = t.to_branch?.color   || '#64748b';
            const fromName  = t.from_branch?.name  || '—';
            const toName    = t.to_branch?.name    || '—';
            const prodName  = t.product_name || t.products?.name || '—';
            const unit      = t.unit || t.products?.unit || 'pz';

            // Botones de acción según el estado y el rol
            let actionHtml = '';
            const role = BranchService.getBranchRole();

            if (t.status === 'pending') {
                // Owner o branch_admin pueden aprobar
                if (isOwner || role === 'branch_admin') {
                    actionHtml += `<button class="action-btn-tr btn-approve" data-id="${t.id}" data-action="approve">✓ Aprobar</button>`;
                }
                actionHtml += `<button class="action-btn-tr btn-cancel-tr" data-id="${t.id}" data-action="cancel">✕</button>`;
            } else if (t.status === 'approved') {
                // El encargado de origen puede despachar
                const isOriginBranch = !myBranchId || t.from_branch_id === myBranchId;
                if (isOriginBranch) {
                    actionHtml += `<button class="action-btn-tr btn-dispatch" data-id="${t.id}" data-action="dispatch"><i class="bi bi-box-seam" aria-hidden="true"></i> Despachar</button>`;
                }
                actionHtml += `<button class="action-btn-tr btn-cancel-tr" data-id="${t.id}" data-action="cancel">✕</button>`;
            } else if (t.status === 'in_transit') {
                // El encargado de destino puede confirmar recepción
                const isDestBranch = !myBranchId || t.to_branch_id === myBranchId;
                if (isDestBranch || isOwner) {
                    actionHtml += `<button class="action-btn-tr btn-receive" data-id="${t.id}" data-action="receive"><i class="bi bi-check2-circle" aria-hidden="true"></i> Recibido</button>`;
                }
            }

            return `
            <div class="transfer-row">
                <div style="font-size:0.82rem;color:var(--text-secondary);">
                    ${dateStr}
                </div>
                <div class="transfer-route">
                    <span class="branch-chip">
                        <span class="chip-dot" style="background:${fromColor};"></span>
                        ${fromName}
                    </span>
                    <span class="transfer-arrow">→</span>
                    <span class="branch-chip">
                        <span class="chip-dot" style="background:${toColor};"></span>
                        ${toName}
                    </span>
                </div>
                <div style="font-size:0.88rem;color:var(--text-primary);font-weight:600;">
                    ${prodName}
                    ${t.notes ? `<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">${t.notes}</div>` : ''}
                </div>
                <div style="font-size:0.95rem;font-weight:700;color:var(--text-primary);">
                    ${t.quantity} ${unit}
                </div>
                <div>${statusBadge(t.status)}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${actionHtml || '<span style="font-size:0.78rem;color:var(--text-secondary);">—</span>'}
                </div>
            </div>`;
        }).join('');

        // ── Listeners de acciones ─────────────────────────────
        list.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id     = btn.dataset.id;
                const action = btn.dataset.action;
                const transfer = allTransfers.find(t => t.id === id);

                if (action === 'approve') {
                    if (!confirm(`¿Aprobar el traspaso de ${transfer.quantity} ${transfer.unit || 'pz'} de "${transfer.product_name}"?`)) return;
                    btn.disabled = true; btn.textContent = '...';
                    const result = await BranchService.approveTransfer(id);
                    if (!result.success) { alert('Error: ' + result.message); btn.disabled = false; btn.textContent = '✓ Aprobar'; return; }

                } else if (action === 'dispatch') {
                    if (!confirm(`¿Confirmar despacho? Se registrará que la mercancía ya salió de ${transfer.from_branch?.name}.`)) return;
                    btn.disabled = true; btn.textContent = '...';
                    const result = await BranchService.dispatchTransfer(id);
                    if (!result.success) { alert('Error: ' + result.message); btn.disabled = false; btn.innerHTML = '<i class="bi bi-box-seam" aria-hidden="true"></i> Despachar'; return; }

                } else if (action === 'receive') {
                    if (!confirm(`¿Confirmar recepción? El stock de ${transfer.to_branch?.name} se actualizará automáticamente.`)) return;
                    btn.disabled = true; btn.textContent = '...';
                    const result = await BranchService.receiveTransfer(id);
                    if (!result.success) { alert('Error: ' + result.message); btn.disabled = false; btn.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i> Recibido'; return; }

                } else if (action === 'cancel') {
                    if (!confirm('¿Cancelar este traspaso?')) return;
                    const { error } = await supabase
                        .from('stock_transfers')
                        .update({ status: 'cancelled' })
                        .eq('id', id);
                    if (error) { alert('Error: ' + error.message); return; }
                }

                await loadTransfers();
            });
        });
    }

    // ── Inicializar ───────────────────────────────────────────
    await loadBranches();
    await loadProducts();
    await loadTransfers();

    // Auto-refresh cada 30 segundos para ver cambios de otros usuarios
    const refreshInterval = setInterval(loadTransfers, 30000);
    // Limpiar al salir de la ruta
    window.addEventListener('hashchange', () => clearInterval(refreshInterval), { once: true });
}
