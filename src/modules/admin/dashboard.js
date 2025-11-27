// src/modules/admin/dashboard.js - CONTROL DE GRÁFICAS POR PLAN (CORREGIDO MULTI-TENANT)
import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';
import { db } from '../../data/db-local.js';
import { syncService } from '../../services/sync.js';
import { PermissionService } from '../../services/permissions.js';

let salesChartInstance = null;
let topProductsChartInstance = null;

export function renderDashboard() {
    // --- CONTROL DE PERMISOS VISUALES ---
    const isAdvancedPlan = PermissionService.can('history');

    // Ocultar botones del menú según permisos
    const showWebOrders = PermissionService.can('web_orders') ? '' : 'display:none !important;';
    const showHistory = isAdvancedPlan ? '' : 'display:none !important;';
    const showSettings = PermissionService.can('settings') ? '' : 'display:none !important;';

    // REQUISITO: Ocultar gráfica "Ventas vs Costos" para plan Esencial
    const showSalesChart = isAdvancedPlan ? '' : 'display:none !important;';

    // Nombre del plan
    const planName = PermissionService.getCurrentPlanName();

    return `
        <div class="admin-container">
            <div class="sidebar-overlay" id="sidebar-overlay"></div>

            <aside class="admin-sidebar" id="admin-sidebar">
                <div class="sidebar-logo" style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                    <button id="btn-close-sidebar" style="align-self:flex-end; background:none; border:none; color:var(--text-secondary); font-size:1.5rem; display:none;">&times;</button>
                    <img src="" class="app-logo-img" style="width:80px; height:auto; object-fit:contain; display:none;">
                    <span class="app-name" style="font-size:1.2rem;">Cargando...</span>
                    <span style="font-size:0.7rem; background:var(--brand-color); color:white; padding:2px 8px; border-radius:10px; margin-top:5px; text-transform:uppercase;">${planName}</span>
                </div>
                <nav class="sidebar-menu">
                    <button class="menu-item active">📊 Dashboard</button>
                    <button class="menu-item" id="nav-orders" style="${showWebOrders}">🔔 Pedidos Web</button>
                    <button class="menu-item" id="nav-inventory">📦 Inventario</button>
                    <button class="menu-item" id="nav-pos">🛒 Ir a Caja</button>
                    <button class="menu-item" id="nav-history" style="${showHistory}">📅 Historial</button>
                    <button class="menu-item" id="nav-settings" style="${showSettings}">⚙️ Configuración</button>
                    <button class="menu-item logout" id="nav-logout" style="margin-top:auto; color:var(--danger-color);">🚪 Salir</button>
                </nav>
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button id="mobile-menu-btn" style="background:none; border:none; font-size:1.8rem; color:var(--text-primary); cursor:pointer;">☰</button>
                        <div>
                            <h1>Panel de Control</h1>
                            <p style="font-size:0.8rem; color:var(--text-secondary);">Resumen financiero.</p>
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:15px; align-items:center;">
                        <button id="theme-toggle-dash" class="icon-btn" title="Tema">🌗</button>
                        <div style="text-align:right;">
                            <small style="color:var(--text-secondary);">Hoy</small>
                            <div style="font-weight:bold; color:var(--text-primary);">${new Date().toLocaleDateString()}</div>
                        </div>
                    </div>
                </header>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:20px; margin-bottom:30px;">
                    <div class="card-panel" style="border-left: 4px solid #3b82f6; padding:15px;">
                        <h3 style="color:var(--text-secondary); font-size:0.8rem; margin:0;">Ventas Hoy</h3>
                        <p id="kpi-today" style="font-size:1.6rem; font-weight:bold; color:var(--text-primary); margin:5px 0;">$0.00</p>
                    </div>
                    <div class="card-panel" style="border-left: 4px solid #10b981; padding:15px;">
                        <h3 style="color:var(--text-secondary); font-size:0.8rem; margin:0;">Ganancia Neta</h3>
                        <p id="kpi-profit" style="font-size:1.6rem; font-weight:bold; color:#10b981; margin:5px 0;">$0.00</p>
                    </div>
                    <div class="card-panel" style="border-left: 4px solid #f59e0b; padding:15px; ${showWebOrders}">
                        <h3 style="color:var(--text-secondary); font-size:0.8rem; margin:0;">Pedidos Web</h3>
                        <p id="kpi-orders" style="font-size:1.6rem; font-weight:bold; color:var(--text-primary); margin:5px 0;">0</p>
                    </div>
                    <div class="card-panel" style="border-left: 4px solid #8b5cf6; padding:15px;">
                        <h3 style="color:var(--text-secondary); font-size:0.8rem; margin:0;">Ventas Mes</h3>
                        <p id="kpi-month" style="font-size:1.6rem; font-weight:bold; color:var(--text-primary); margin:5px 0;">$0</p>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr; gap:20px;">
                    <div class="card-panel" style="${showSalesChart}">
                        <h3 style="margin-bottom:15px; color:var(--text-primary);">📈 Ventas vs Costos (7 Días)</h3>
                        <div style="position: relative; height: 300px; width: 100%;">
                            <canvas id="salesChart"></canvas>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:20px;">
                        <div class="card-panel">
                            <h3 style="margin-bottom:10px; color:var(--text-primary);">🏆 Más Vendidos</h3>
                            <div style="position: relative; height: 200px; width: 100%; display:flex; justify-content:center;">
                                <canvas id="topProductsChart"></canvas>
                            </div>
                        </div>

                        <div class="card-panel" style="flex:1; min-height: 200px; max-height: 300px; overflow-y:auto;">
                            <h3 style="margin-bottom:10px; color:var(--danger-color); position:sticky; top:0; background:var(--bg-card);">⚠️ Stock Bajo</h3>
                            <div id="low-stock-list">Cargando...</div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    `;
}

export async function setupDashboardLogic(router) {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#334155';
    Chart.defaults.font.family = "'Montserrat', sans-serif";

    // --- MENÚ MÓVIL ---
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btnOpen = document.getElementById('mobile-menu-btn');
    const btnClose = document.getElementById('btn-close-sidebar');
    if (window.innerWidth <= 768 && btnClose) btnClose.style.display = 'block';

    function toggleMenu(show) {
        if (show) { sidebar && sidebar.classList.add('active'); overlay && overlay.classList.add('active'); }
        else { sidebar && sidebar.classList.remove('active'); overlay && overlay.classList.remove('active'); }
    }
    if (btnOpen) btnOpen.addEventListener('click', () => toggleMenu(true));
    if (btnClose) btnClose.addEventListener('click', () => toggleMenu(false));
    if (overlay) overlay.addEventListener('click', () => toggleMenu(false));

    const navigateTo = (path) => { toggleMenu(false); router.navigate(path); };

    // Listeners condicionales (verifica existencia)
    const btnInv = document.getElementById('nav-inventory'); if (btnInv) btnInv.addEventListener('click', () => navigateTo('/admin/inventory'));
    const btnPos = document.getElementById('nav-pos'); if (btnPos) btnPos.addEventListener('click', () => navigateTo('/pos'));
    const btnOrd = document.getElementById('nav-orders'); if (btnOrd) btnOrd.addEventListener('click', () => navigateTo('/admin/orders'));
    const btnHis = document.getElementById('nav-history'); if (btnHis) btnHis.addEventListener('click', () => navigateTo('/admin/history'));
    const btnSet = document.getElementById('nav-settings'); if (btnSet) btnSet.addEventListener('click', () => navigateTo('/admin/settings'));

    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); navigateTo('/'); });
    const themeBtn = document.getElementById('theme-toggle-dash');
    if (themeBtn) themeBtn.addEventListener('click', () => ThemeService.toggle());

    // --- DATOS ---
    async function loadMetrics() {
        const businessId = localStorage.getItem('archsell_business_id') || PermissionService.getBusinessId?.();
        // 1) Cargar datos locales filtrados por businessId cuando sea posible
        let localSales = [];
        let localProducts = [];
        try {
            if (businessId && db && db.sales && db.products && typeof db.sales.where === 'function') {
                // Dexie optimized query (requiere index business_id)
                try {
                    localSales = await db.sales.where('business_id').equals(businessId).toArray();
                } catch (e) {
                    // Si no existe índice, fallback a cargar todo y filtrar
                    const all = await db.sales.toArray();
                    localSales = all.filter(s => String(s.business_id) === String(businessId));
                }
                try {
                    localProducts = await db.products.where('business_id').equals(businessId).toArray();
                } catch (e) {
                    const allp = await db.products.toArray();
                    localProducts = allp.filter(p => String(p.business_id) === String(businessId));
                }
            } else {
                // Fallback: carga todo pero intenta filtrar por campo si existe
                const allSales = await db.sales.toArray();
                const allProducts = await db.products.toArray();
                if (businessId) {
                    localSales = allSales.filter(s => String(s.business_id) === String(businessId));
                    localProducts = allProducts.filter(p => String(p.business_id) === String(businessId));
                } else {
                    localSales = allSales;
                    localProducts = allProducts;
                }
            }
        } catch (err) {
            console.error("Error leyendo DB local:", err);
            // Intentar cargar todo como último recurso
            localSales = await db.sales.toArray().catch(()=>[]);
            localProducts = await db.products.toArray().catch(()=>[]);
        }

        // Procesar y mostrar inmediatamente desde local
        processAndRender(localSales, localProducts);

        // Si hay conexión, sincronizar y recargar
        if (navigator.onLine) {
            try {
                await syncService.downloadSalesHistory();
                await syncService.downloadProducts();

                // Volver a leer local (mismo filtrado)
                if (businessId && db && typeof db.sales.where === 'function') {
                    try {
                        localSales = await db.sales.where('business_id').equals(businessId).toArray();
                    } catch {
                        localSales = (await db.sales.toArray()).filter(s => String(s.business_id) === String(businessId));
                    }
                    try {
                        localProducts = await db.products.where('business_id').equals(businessId).toArray();
                    } catch {
                        localProducts = (await db.products.toArray()).filter(p => String(p.business_id) === String(businessId));
                    }
                } else {
                    localSales = await db.sales.toArray();
                    localProducts = await db.products.toArray();
                }

                processAndRender(localSales, localProducts);
            } catch (err) {
                console.error("Error sincronizando datos:", err);
            }
        }
    }

    async function processAndRender(sales, products) {
        const businessId = localStorage.getItem('archsell_business_id') || PermissionService.getBusinessId?.();

        let pendingOrders = 0;
        if (navigator.onLine && PermissionService.can('web_orders')) {
            try {
                const query = supabase
                    .from('web_orders')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pendiente');

                if (businessId) query.eq('business_id', businessId);

                const { count, error } = await query;
                if (!error) pendingOrders = count || 0;
            } catch (err) {
                console.error("Error consultando web_orders:", err);
            }
        }

        calculateKPIs(sales, products, pendingOrders);

        // REQUISITO: Si es plan avanzado, renderiza la gráfica de líneas
        if (PermissionService.can('history')) {
            renderSalesChart(sales, products);
        } else {
            // destruir si existía
            if (salesChartInstance) { try { salesChartInstance.destroy(); } catch(e){} salesChartInstance = null; }
        }

        renderTopProducts(sales, products);
        renderLowStock(products);
    }

    function calculateKPIs(sales, products, pendingOrders) {
        const today = new Date().toDateString();
        const currentMonth = new Date().getMonth();
        let todaySales = 0, monthSales = 0, todayProfit = 0;

        // Build cost map keyed by product id (preferible) and fallback by name
        const costById = {};
        const costByName = {};
        (products || []).forEach(p => {
            if (p.id) costById[String(p.id)] = Number(p.cost_price || 0);
            if (p.name) costByName[p.name] = Number(p.cost_price || 0);
        });

        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at || s.createdAt);
            const isToday = d.toDateString() === today;
            const totalVenta = Number(s.total || 0);

            if (isToday) todaySales += totalVenta;
            if (d.getMonth() === currentMonth) monthSales += totalVenta;

            if (isToday && s.items && Array.isArray(s.items)) {
                let saleCost = 0;
                s.items.forEach(item => {
                    if (item.type === 'meta') return;
                    const qty = Number(item.cantidad || item.qty || item.quantity || 0);
                    // Prefer id-based cost, fallback to name
                    const unitCost = (item.id && costById[String(item.id)] !== undefined) ? costById[String(item.id)] : (costByName[item.name] || 0) ;
                    saleCost += (unitCost * qty);
                });
                todayProfit += (totalVenta - saleCost);
            }
        });

        const elToday = document.getElementById('kpi-today');
        const elProfit = document.getElementById('kpi-profit');
        const elMonth = document.getElementById('kpi-month');
        const elOrders = document.getElementById('kpi-orders');

        if (elToday) elToday.textContent = `$${todaySales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        if (elProfit) elProfit.textContent = `$${todayProfit.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        if (elMonth) elMonth.textContent = `$${monthSales.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
        if (elOrders) elOrders.textContent = pendingOrders;
    }

    function renderSalesChart(sales, products) {
        // Destroy previous instance
        if (salesChartInstance) {
            try { salesChartInstance.destroy(); } catch (e) { console.warn(e); }
            salesChartInstance = null;
        }

        // Map costs by product id and name
        const productCostMap = {};
        (products || []).forEach(p => {
            if (p.id) productCostMap[String(p.id)] = Number(p.cost_price || 0);
            if (p.name && productCostMap[p.name] === undefined) productCostMap[p.name] = Number(p.cost_price || 0); // fallback by name
        });

        // Prepare last 7 days keys
        const last7DaysSales = {};
        const last7DaysCosts = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            last7DaysSales[key] = 0;
            last7DaysCosts[key] = 0;
        }

        // Aggregate sales & costs
        (sales || []).forEach(s => {
            const dateKey = new Date(s.date || s.created_at || s.createdAt).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            if (last7DaysSales[dateKey] !== undefined) {
                const totalVenta = Number(s.total || 0);
                let totalCosto = 0;
                if (s.items && Array.isArray(s.items)) {
                    s.items.forEach(item => {
                        if (item.type === 'meta') return;
                        const qty = Number(item.cantidad || item.qty || item.quantity || 0);
                        const unitCost = (item.id && productCostMap[String(item.id)] !== undefined) ? productCostMap[String(item.id)] : (productCostMap[item.name] || 0);
                        totalCosto += (qty * unitCost);
                    });
                }
                last7DaysSales[dateKey] += totalVenta;
                last7DaysCosts[dateKey] += totalCosto;
            }
        });

        // Ensure canvas exists
        const canvas = document.getElementById('salesChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(last7DaysSales),
                datasets: [
                    { label: 'Ventas', data: Object.values(last7DaysSales), borderColor: '#7A3F9D', tension: 0.3, fill: false },
                    { label: 'Costos', data: Object.values(last7DaysCosts), borderColor: '#ef4444', tension: 0.3, fill: false }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    function renderTopProducts(sales, products) {
        if (topProductsChartInstance) { try { topProductsChartInstance.destroy(); } catch (e) {} topProductsChartInstance = null; }

        const isAdvanced = PermissionService.can('history');

        // Count quantities by product id (prefer) and keep name mapping
        const countsById = {};
        const nameById = {};

        // Build name map from products local cache
        (products || []).forEach(p => { if(p.id) nameById[String(p.id)] = p.name; if(p.name && !nameById[p.id]) nameById[p.id] = p.name; });

        (sales || []).forEach(s => {
            if (!s.items) return;
            s.items.forEach(i => {
                if (i.type === 'meta') return;
                const qty = Number(i.cantidad || i.qty || i.quantity || 0);
                const id = i.id ? String(i.id) : null;
                if (id) {
                    countsById[id] = (countsById[id] || 0) + qty;
                    if (i.name) nameById[id] = i.name;
                } else {
                    // fallback to name-based aggregation if no id
                    const nameKey = `n:${(i.name || 'Sin nombre')}`;
                    countsById[nameKey] = (countsById[nameKey] || 0) + qty;
                    nameById[nameKey] = i.name || 'Sin nombre';
                }
            });
        });

        const sorted = Object.entries(countsById).sort((a,b) => b[1] - a[1]).slice(0, 5);
        const labels = sorted.map(([k]) => nameById[k] || k);
        const data = sorted.map(([_, v]) => v);

        const canvas = document.getElementById('topProductsChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        topProductsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: isAdvanced,
                        position: 'right',
                        labels: { color: '#94a3b8' }
                    }
                }
            }
        });
    }

    function renderLowStock(products) {
        const el = document.getElementById('low-stock-list');
        if (!el) return;
        const low = (products || []).filter(p => (Number(p.stock) || 0) <= 10 && (Number(p.stock) || 0) > 0).slice(0, 10);
        if (low.length === 0) return el.innerHTML = '<p style="color:var(--success-bg);">✅ Todo bien</p>';
        el.innerHTML = `<ul style="padding-left:15px;margin:0;">${low.map(p => `<li style="margin-bottom:5px;">${p.name}: <b>${p.stock}</b></li>`).join('')}</ul>`;
    }

    // Init
    loadMetrics();
}
