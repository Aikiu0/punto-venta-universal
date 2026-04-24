// src/modules/admin/dashboard.js — REPORTES INTELIGENTES + LENGUAJE SIMPLE
import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';
import { db } from '../../data/db-local.js';
import { syncService } from '../../services/sync.js';
import { PermissionService } from '../../services/permissions.js';
import { renderSidebarHeader } from './components/sidebarHeader.js';

let salesChartInstance = null;
let topProductsChartInstance = null;
const activeAnimations = {};

// --- UTILS ---
function animateValue(id, start, end, duration, isCurrency = true) {
    const obj = document.getElementById(id);
    if (!obj) return;
    if (activeAnimations[id]) cancelAnimationFrame(activeAnimations[id]);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        if (isCurrency) {
            obj.innerHTML = new Intl.NumberFormat('es-MX', {
                style: 'currency', currency: 'MXN', minimumFractionDigits: 2
            }).format(progress === 1 ? end : value);
        } else {
            obj.innerHTML = value;
        }
        if (progress < 1) {
            activeAnimations[id] = window.requestAnimationFrame(step);
        } else {
            delete activeAnimations[id];
        }
    };
    activeAnimations[id] = window.requestAnimationFrame(step);
}

const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
const fmtNum = (n) => Number(n || 0).toLocaleString('es-MX');

// Saludo según la hora del día
function getSaludo() {
    const h = new Date().getHours();
    if (h < 12) return '☀️ Buenos días';
    if (h < 19) return '🌤️ Buenas tardes';
    return '🌙 Buenas noches';
}

// Día de la semana en español
function getDayName() {
    return new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function renderDashboard() {
    const lockHistory = PermissionService.can('history') ? '' : '🔒 ';
    const lockOrders = PermissionService.can('web_orders') ? '' : '🔒 ';
    const lockSettings = PermissionService.can('settings') ? '' : '🔒 ';
    const lockSuppliers = PermissionService.can('suppliers') ? '' : '🔒 ';
    const hasHistoryAccess = PermissionService.can('history');
    const chartBlurClass = hasHistoryAccess ? '' : 'premium-blur-content';
    const chartOverlay = hasHistoryAccess ? '' : `
        <div class="premium-lock-overlay" onclick="window.checkPlan(event, 'history')">
            <div class="lock-badge">🔒</div>
            <div class="lock-text">Ver Análisis de Ventas</div>
        </div>`;

    const styles = `<style>
        /* ANIMACIONES */
        @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.04); } }
        .anim-stagger { opacity:0; animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
        .delay-1{animation-delay:0.05s} .delay-2{animation-delay:0.1s} .delay-3{animation-delay:0.15s}
        .delay-4{animation-delay:0.2s} .delay-5{animation-delay:0.25s} .delay-6{animation-delay:0.3s}
        .delay-7{animation-delay:0.35s} .delay-8{animation-delay:0.4s}

        /* KPI CARDS */
        .kpi-card {
            background: var(--bg-card);
            border-radius: 16px;
            padding: 22px 20px;
            border: 1px solid var(--border-color);
            position: relative;
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
            cursor: default;
        }
        .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); }
        .kpi-label {
            font-size: 0.78rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: var(--text-secondary);
            margin: 0 0 8px 0;
        }
        .kpi-number {
            font-size: 1.9rem;
            font-weight: 800;
            margin: 0;
            line-height: 1;
            color: var(--text-primary);
        }
        .kpi-sub {
            font-size: 0.8rem;
            color: var(--text-secondary);
            margin-top: 6px;
        }
        .kpi-icon {
            position: absolute;
            right: -8px; top: -8px;
            font-size: 3.5rem;
            opacity: 0.06;
        }

        /* SECCIÓN DE REPORTES */
        .report-section {
            background: var(--bg-card);
            border-radius: 16px;
            border: 1px solid var(--border-color);
            overflow: hidden;
            transition: box-shadow 0.2s;
        }
        .report-header {
            padding: 18px 22px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: var(--bg-card);
        }
        .report-title {
            font-size: 1rem;
            font-weight: 800;
            color: var(--text-primary);
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .report-body { padding: 18px 22px; }

        /* REPORTE DE PRODUCTO */
        .product-rank-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px solid var(--border-color);
        }
        .product-rank-item:last-child { border-bottom: none; }
        .rank-number {
            width: 28px; height: 28px;
            border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            font-weight: 800; font-size: 0.85rem;
            flex-shrink: 0;
        }
        .rank-bar-wrap {
            flex: 1;
        }
        .rank-name {
            font-size: 0.9rem;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 4px;
        }
        .rank-bar-bg {
            height: 6px;
            background: var(--bg-input);
            border-radius: 10px;
            overflow: hidden;
        }
        .rank-bar-fill {
            height: 100%;
            border-radius: 10px;
            transition: width 1s ease;
        }
        .rank-qty {
            font-weight: 800;
            font-size: 0.9rem;
            color: var(--text-primary);
            white-space: nowrap;
        }

        /* REPORTE INVENTARIO MUERTO */
        .dead-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px dashed var(--border-color);
            font-size: 0.9rem;
        }
        .dead-item:last-child { border-bottom: none; }

        /* ALERTAS */
        .alert-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            border-radius: 10px;
            margin-bottom: 8px;
            font-size: 0.9rem;
            font-weight: 600;
        }
        .alert-row:last-child { margin-bottom: 0; }
        .alert-critical { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; }
        .alert-warning  { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); color: #f59e0b; }
        .alert-ok       { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: #10b981; }

        /* COMPARATIVO */
        .compare-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid var(--border-color);
            gap: 10px;
        }
        .compare-row:last-child { border-bottom: none; }
        .compare-label { font-size: 0.9rem; color: var(--text-secondary); }
        .compare-values { display: flex; gap: 20px; align-items: center; }
        .compare-current { font-weight: 800; font-size: 1rem; color: var(--text-primary); }
        .compare-prev { font-size: 0.8rem; color: var(--text-secondary); }
        .trend-badge {
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 0.78rem;
            font-weight: 800;
        }
        .trend-up   { background: rgba(16,185,129,0.15); color: #10b981; }
        .trend-down { background: rgba(239,68,68,0.15);  color: #ef4444; }
        .trend-flat { background: rgba(148,163,184,0.15); color: #94a3b8; }

        /* CLIENTES EN DEUDA */
        .debt-client-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid var(--border-color);
        }
        .debt-client-row:last-child { border-bottom: none; }

        /* SALUDO */
        .saludo-bar {
            background: linear-gradient(135deg, var(--brand-color) 0%, #a855f7 100%);
            color: white;
            border-radius: 16px;
            padding: 18px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .saludo-text { font-size: 1.1rem; font-weight: 800; }
        .saludo-date { font-size: 0.85rem; opacity: 0.85; margin-top: 2px; }
        .saludo-right { text-align: right; font-size: 0.85rem; opacity: 0.9; }

        /* GRÁFICA */
        .premium-blur-container { position: relative; overflow: hidden; border-radius: 10px; }
        .premium-blur-content { filter: blur(8px); opacity:0.6; pointer-events:none; user-select:none; }
        .premium-lock-overlay {
            position: absolute; top:0; left:0; width:100%; height:100%;
            z-index:50; cursor:pointer;
            display:flex; flex-direction:column; justify-content:center; align-items:center;
            background: rgba(255,255,255,0.1); transition: background 0.3s;
        }
        .premium-lock-overlay:hover { background: rgba(255,255,255,0.3); }
        .lock-badge { font-size:2.5rem; margin-bottom:8px; }
        .lock-text { font-weight:bold; color:#1e293b; background:rgba(255,255,255,0.9); padding:5px 15px; border-radius:20px; }

        /* RESPONSIVE */
        @media(max-width:768px) {
            .kpi-number { font-size:1.5rem; }
            .saludo-bar { flex-direction:column; text-align:center; }
            .saludo-right { text-align:center; }
        }
    </style>`;

    return `
        ${styles}
        <div class="admin-container">
            <div class="sidebar-overlay" id="sidebar-overlay"></div>

            <aside class="admin-sidebar" id="admin-sidebar">
                <div class="sidebar-logo">${renderSidebarHeader()}</div>
                <nav class="sidebar-menu">
                    <button class="menu-item active"> Dashboard</button>
                    <button class="menu-item" id="nav-orders" onclick="return window.checkPlan(event,'web_orders')">${lockOrders} Pedidos Web</button>
                    <button class="menu-item" id="nav-inventory"> Inventario</button>
                    <button class="menu-item" id="nav-pos"> Ir a Caja</button>
                    <button class="menu-item" id="nav-suppliers" onclick="return window.checkPlan(event,'suppliers')">${lockSuppliers} Estados de cuenta</button>
                    <button class="menu-item" id="nav-history" onclick="return window.checkPlan(event,'history')">${lockHistory} Historial</button>
                    <button class="menu-item" id="nav-settings" onclick="return window.checkPlan(event,'settings')">${lockSettings} Configuración</button>
                    <button class="menu-item logout" id="nav-logout"> Salir</button>
                </nav>
            </aside>

            <main class="admin-content">

                <!-- SALUDO -->
                <div class="saludo-bar anim-stagger delay-1">
                    <div>
                        <div class="saludo-text">${getSaludo()}</div>
                        <div class="saludo-date">${getDayName()}</div>
                    </div>
                    <div style="display:flex; gap:15px; align-items:center;">
                        <button id="theme-toggle-dash" class="icon-btn" title="Cambiar tema" style="background:rgba(255,255,255,0.2); border:none; color:white; width:38px; height:38px; border-radius:10px; cursor:pointer; font-size:1.2rem;">🌗</button>
                    </div>
                </div>

                <!-- ═══════════════════════════════════
                     FILA 1: KPIs PRINCIPALES (Lo más importante del día)
                ════════════════════════════════════ -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap:16px; margin-bottom:20px;">

                    <div class="kpi-card anim-stagger delay-2" style="border-top: 4px solid #3b82f6;">
                        <div class="kpi-icon">💰</div>
                        <p class="kpi-label"> Vendí hoy</p>
                        <p id="kpi-today" class="kpi-number" style="color:#3b82f6;">$0.00</p>
                        <p class="kpi-sub" id="kpi-today-txn">0 ventas realizadas</p>
                    </div>

                    <div class="kpi-card anim-stagger delay-3" style="border-top: 4px solid #10b981;">
                        <div class="kpi-icon">💵</div>
                        <p class="kpi-label"> Gané hoy (ganancia)</p>
                        <p id="kpi-profit" class="kpi-number" style="color:#10b981;">$0.00</p>
                        <p class="kpi-sub">Lo que queda después de costos</p>
                    </div>

                    <div class="kpi-card anim-stagger delay-4" style="border-top: 4px solid #8b5cf6;">
                        <div class="kpi-icon">📅</div>
                        <p class="kpi-label"> Total del mes</p>
                        <p id="kpi-month" class="kpi-number" style="color:#8b5cf6;">$0.00</p>
                        <p class="kpi-sub" id="kpi-month-days">Este mes hasta hoy</p>
                    </div>

                    <div class="kpi-card anim-stagger delay-5" style="border-top: 4px solid #f59e0b;">
                        <div class="kpi-icon">🧾</div>
                        <p class="kpi-label"> Ticket promedio hoy</p>
                        <p id="kpi-avg" class="kpi-number" style="color:#f59e0b;">$0.00</p>
                        <p class="kpi-sub">Precio promedio por venta</p>
                    </div>

                </div>

                <!-- ═══════════════════════════════════
                     FILA 2: ALERTAS + COMPARATIVO
                ════════════════════════════════════ -->
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:20px;">

                    <!-- ALERTAS DEL DÍA -->
                    <div class="report-section anim-stagger delay-5">
                        <div class="report-header">
                            <h3 class="report-title"> Alertas importantes</h3>
                            <small style="color:var(--text-secondary); font-size:0.75rem;">Requieren tu atención</small>
                        </div>
                        <div class="report-body" id="alertas-container">
                            <div style="color:var(--text-secondary); font-size:0.9rem; text-align:center; padding:10px;">Revisando...</div>
                        </div>
                    </div>

                    <!-- COMPARATIVO SEMANA PASADA -->
                    <div class="report-section anim-stagger delay-6">
                        <div class="report-header">
                            <h3 class="report-title"> ¿Cómo voy?</h3>
                            <small style="color:var(--text-secondary); font-size:0.75rem;">Esta semana vs la pasada</small>
                        </div>
                        <div class="report-body" id="comparativo-container">
                            <div style="color:var(--text-secondary); font-size:0.9rem; text-align:center; padding:10px;">Calculando...</div>
                        </div>
                    </div>

                </div>

                <!-- ═══════════════════════════════════
                     FILA 3: TOP PRODUCTOS + GRÁFICA
                ════════════════════════════════════ -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:16px; margin-bottom:20px;">

                    <!-- TOP PRODUCTOS QUE MÁS SE VENDEN -->
                    <div class="report-section anim-stagger delay-6">
                        <div class="report-header">
                            <h3 class="report-title"> Lo que más se vende</h3>
                            <small style="color:var(--text-secondary); font-size:0.75rem;">Últimos 30 días</small>
                        </div>
                        <div class="report-body" id="top-products-list">
                            <div style="color:var(--text-secondary); text-align:center; padding:10px;">Calculando...</div>
                        </div>
                    </div>

                    <!-- GRÁFICA VENTAS 7 DÍAS -->
                    <div class="report-section premium-blur-container anim-stagger delay-7">
                        <div class="report-header">
                            <h3 class="report-title"> Ventas de los últimos 7 días</h3>
                        </div>
                        ${chartOverlay}
                        <div class="${chartBlurClass}" style="padding:18px;">
                            <div style="position:relative; height:260px;">
                                <canvas id="salesChart"></canvas>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- ═══════════════════════════════════
                     FILA 4: CLIENTES CON DEUDA + INVENTARIO MUERTO
                ════════════════════════════════════ -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:16px; margin-bottom:20px;">

                    <!-- CLIENTES QUE DEBEN -->
                    <div class="report-section anim-stagger delay-7">
                        <div class="report-header">
                            <h3 class="report-title"> Clientes que te deben</h3>
                            <small style="color:var(--text-secondary); font-size:0.75rem;">Dinero por cobrar</small>
                        </div>
                        <div class="report-body" id="deudores-container">
                            <div style="color:var(--text-secondary); text-align:center; padding:10px;">Consultando...</div>
                        </div>
                    </div>

                    <!-- INVENTARIO MUERTO -->
                    <div class="report-section anim-stagger delay-8">
                        <div class="report-header">
                            <h3 class="report-title"> Productos sin movimiento</h3>
                            <small style="color:var(--text-secondary); font-size:0.75rem;">No se han vendido en 30 días</small>
                        </div>
                        <div class="report-body" id="dead-stock-container">
                            <div style="color:var(--text-secondary); text-align:center; padding:10px;">Analizando...</div>
                        </div>
                    </div>

                </div>

                <!-- ═══════════════════════════════════
                     FILA 5: STOCK BAJO (Ya existente, mejorado)
                ════════════════════════════════════ -->
                <div class="report-section anim-stagger delay-8" style="margin-bottom:30px;">
                    <div class="report-header">
                        <h3 class="report-title">⚠️ Productos que se están acabando</h3>
                        <small style="color:var(--text-secondary); font-size:0.75rem;">Necesitan surtirse pronto</small>
                    </div>
                    <div class="report-body" id="low-stock-list">
                        <div style="color:var(--text-secondary); text-align:center; padding:10px;">Revisando inventario...</div>
                    </div>
                </div>

            </main>
        </div>
    `;
}

export async function setupDashboardLogic(router) {

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(51,65,85,0.5)';
    Chart.defaults.font.family = "'Montserrat', sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.9)';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;

    // --- MENÚ MÓVIL ---
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btnOpen = document.getElementById('mobile-menu-btn');

    function toggleMenu(show) {
        if (show) { sidebar && sidebar.classList.add('active'); overlay && overlay.classList.add('active'); }
        else { sidebar && sidebar.classList.remove('active'); overlay && overlay.classList.remove('active'); }
    }
    if (btnOpen) btnOpen.addEventListener('click', () => toggleMenu(true));
    if (overlay) overlay.addEventListener('click', () => toggleMenu(false));

    const navigateTo = (path) => { toggleMenu(false); router.navigate(path); };

    const bind = (id, path) => { const el = document.getElementById(id); if (el) el.addEventListener('click', () => navigateTo(path)); };
    bind('nav-inventory', '/admin/inventory');
    bind('nav-pos', '/pos');
    bind('nav-orders', '/admin/orders');
    bind('nav-history', '/admin/history');
    bind('nav-settings', '/admin/settings');
    bind('nav-suppliers', '/admin/suppliers');

    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); navigateTo('/'); });

    const themeBtn = document.getElementById('theme-toggle-dash');
    if (themeBtn) themeBtn.addEventListener('click', () => ThemeService.toggle());

    // ============================================================
    // CARGA DE DATOS
    // ============================================================
    async function loadMetrics() {
        const businessId = localStorage.getItem('archsell_business_id');
        let localSales = [], localProducts = [];

        try {
            if (businessId && db && db.sales && db.products) {
                try {
                    localSales = await db.sales.where('business_id').equals(businessId).toArray();
                    localProducts = await db.products.where('business_id').equals(businessId).toArray();
                } catch {
                    localSales = (await db.sales.toArray()).filter(s => String(s.business_id) === String(businessId));
                    localProducts = (await db.products.toArray()).filter(p => String(p.business_id) === String(businessId));
                }
            }
        } catch (err) { console.error("Error DB local:", err); }

        processAndRender(localSales, localProducts);

        if (navigator.onLine) {
            try {
                await Promise.all([syncService.downloadSalesHistory(), syncService.downloadProducts()]);
                try {
                    localSales = await db.sales.where('business_id').equals(businessId).toArray();
                    localProducts = await db.products.where('business_id').equals(businessId).toArray();
                } catch {
                    localSales = (await db.sales.toArray()).filter(s => String(s.business_id) === String(businessId));
                    localProducts = (await db.products.toArray()).filter(p => String(p.business_id) === String(businessId));
                }
                processAndRender(localSales, localProducts);
            } catch (err) { console.warn("Sync background error:", err); }
        }

        // Cargar clientes deudores desde Supabase
        loadClientDebt();
    }

    async function processAndRender(rawSales, products) {
        // Deduplicar
        const uniqueSalesMap = new Map();
        (rawSales || []).forEach(s => {
            if (s.status === 'cancelado') return;
            uniqueSalesMap.set(s.uuid || s.id, s);
        });
        const sales = Array.from(uniqueSalesMap.values());

        calculateKPIs(sales, products);
        renderAlertas(sales, products);
        renderComparativo(sales);
        renderTopProducts(sales, products);
        renderDeadStock(sales, products);
        renderLowStock(products);

        if (PermissionService.can('history')) {
            renderSalesChart(sales, products);
        }
    }

    // ============================================================
    // KPIs PRINCIPALES
    // ============================================================
    function calculateKPIs(sales, products) {
        const todayStr = new Date().toDateString();
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        let todaySales = 0, monthSales = 0, todayProfit = 0, todayTxn = 0;

        const costMap = new Map();
        (products || []).forEach(p => {
            const cost = Number(p.cost_price);
            if (!isNaN(cost)) {
                if (p.id) costMap.set(String(p.id), cost);
                if (p.name) costMap.set(`name:${p.name}`, cost);
            }
        });

        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at || s.createdAt);
            if (isNaN(d.getTime())) return;
            const totalVenta = Number(s.total || 0);
            const isToday = d.toDateString() === todayStr;
            const isMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;

            if (isToday) { todaySales += totalVenta; todayTxn++; }
            if (isMonth) monthSales += totalVenta;

            if (isToday && s.items && Array.isArray(s.items)) {
                let saleCost = 0;
                s.items.forEach(item => {
                    if (item.type === 'meta') return;
                    const qty = Number(item.cantidad || item.qty || item.quantity || 0);
                    let unitCost = item.historical_cost !== undefined ? Number(item.historical_cost)
                        : (costMap.get(String(item.id)) || costMap.get(`name:${item.name}`) || 0);
                    saleCost += unitCost * qty;
                });
                todayProfit += (totalVenta - saleCost);
            }
        });

        const avg = todayTxn > 0 ? todaySales / todayTxn : 0;

        animateValue('kpi-today', 0, todaySales, 1200);
        animateValue('kpi-profit', 0, todayProfit, 1200);
        animateValue('kpi-month', 0, monthSales, 1400);
        animateValue('kpi-avg', 0, avg, 1000);

        const txnEl = document.getElementById('kpi-today-txn');
        if (txnEl) txnEl.textContent = `${todayTxn} venta${todayTxn !== 1 ? 's' : ''} realizada${todayTxn !== 1 ? 's' : ''}`;

        const daysInMonth = new Date().getDate();
        const monthEl = document.getElementById('kpi-month-days');
        if (monthEl) monthEl.textContent = `Primeros ${daysInMonth} días del mes`;
    }

    // ============================================================
    // ALERTAS IMPORTANTES (lenguaje muy claro)
    // ============================================================
    function renderAlertas(sales, products) {
        const el = document.getElementById('alertas-container');
        if (!el) return;

        const alertas = [];
        const todayStr = new Date().toDateString();

        // 1. Productos agotados
        const agotados = (products || []).filter(p => Number(p.stock) <= 0);
        if (agotados.length > 0) {
            alertas.push({ tipo: 'critical', icon: '🚫', texto: `${agotados.length} producto${agotados.length > 1 ? 's' : ''} AGOTADO${agotados.length > 1 ? 'S' : ''}: ${agotados.slice(0, 2).map(p => p.name).join(', ')}${agotados.length > 2 ? '...' : ''}` });
        }

        // 2. Stock bajo (1–5 unidades)
        const stockBajo = (products || []).filter(p => Number(p.stock) > 0 && Number(p.stock) <= 5);
        if (stockBajo.length > 0) {
            alertas.push({ tipo: 'warning', icon: '', texto: `${stockBajo.length} producto${stockBajo.length > 1 ? 's' : ''} con poco stock: ${stockBajo.slice(0, 2).map(p => `${p.name} (${p.stock})`).join(', ')}` });
        }

        // 3. Sin ventas hoy
        const ventasHoy = (sales || []).filter(s => new Date(s.date || s.created_at).toDateString() === todayStr);
        if (ventasHoy.length === 0) {
            alertas.push({ tipo: 'warning', icon: '', texto: 'Aún no hay ventas registradas hoy.' });
        }

        // 4. Todo bien
        if (agotados.length === 0 && stockBajo.length === 0 && ventasHoy.length > 0) {
            alertas.push({ tipo: 'ok', icon: '✅', texto: `¡Todo en orden! Llevas ${ventasHoy.length} venta${ventasHoy.length > 1 ? 's' : ''} hoy.` });
        }

        if (alertas.length === 0) {
            el.innerHTML = `<div class="alert-row alert-ok">✅ Sin alertas por ahora. ¡Todo bien!</div>`;
            return;
        }

        el.innerHTML = alertas.map(a => `
            <div class="alert-row ${a.tipo === 'critical' ? 'alert-critical' : a.tipo === 'warning' ? 'alert-warning' : 'alert-ok'}">
                <span style="font-size:1.2rem; flex-shrink:0;">${a.icon}</span>
                <span>${a.texto}</span>
            </div>`).join('');
    }

    // ============================================================
    // COMPARATIVO SEMANA ACTUAL VS SEMANA PASADA
    // ============================================================
    function renderComparativo(sales) {
        const el = document.getElementById('comparativo-container');
        if (!el) return;

        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=dom, 1=lun...
        const startThisWeek = new Date(now); startThisWeek.setDate(now.getDate() - dayOfWeek); startThisWeek.setHours(0,0,0,0);
        const startLastWeek = new Date(startThisWeek); startLastWeek.setDate(startThisWeek.getDate() - 7);
        const endLastWeek = new Date(startThisWeek); endLastWeek.setMilliseconds(-1);

        let thisWeekSales = 0, lastWeekSales = 0;
        let thisWeekTxn = 0, lastWeekTxn = 0;
        let thisWeekProfit = 0, lastWeekProfit = 0;

        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at);
            if (isNaN(d.getTime())) return;
            const total = Number(s.total || 0);
            if (d >= startThisWeek) { thisWeekSales += total; thisWeekTxn++; }
            else if (d >= startLastWeek && d <= endLastWeek) { lastWeekSales += total; lastWeekTxn++; }
        });

        const trendIcon = (curr, prev) => {
            if (prev === 0) return curr > 0 ? `<span class="trend-badge trend-up">▲ Nuevo</span>` : `<span class="trend-badge trend-flat">— Sin datos</span>`;
            const pct = ((curr - prev) / prev * 100).toFixed(0);
            if (curr > prev) return `<span class="trend-badge trend-up">▲ +${pct}%</span>`;
            if (curr < prev) return `<span class="trend-badge trend-down">▼ ${pct}%</span>`;
            return `<span class="trend-badge trend-flat">= Igual</span>`;
        };

        el.innerHTML = `
            <div class="compare-row">
                <span class="compare-label"> Ventas esta semana</span>
                <div class="compare-values">
                    <span class="compare-current">${fmt(thisWeekSales)}</span>
                    ${trendIcon(thisWeekSales, lastWeekSales)}
                </div>
            </div>
            <div class="compare-row">
                <span class="compare-label"> Número de ventas</span>
                <div class="compare-values">
                    <span class="compare-current">${thisWeekTxn} ventas</span>
                    ${trendIcon(thisWeekTxn, lastWeekTxn)}
                </div>
            </div>
            <div style="margin-top:12px; padding:10px 12px; background:var(--bg-input); border-radius:10px; font-size:0.82rem; color:var(--text-secondary);">
                Semana pasada: <strong style="color:var(--text-primary);">${fmt(lastWeekSales)}</strong> en ${lastWeekTxn} ventas
            </div>
        `;
    }

    // ============================================================
    // TOP PRODUCTOS (lista visual con barras)
    // ============================================================
    function renderTopProducts(sales, products) {
        const el = document.getElementById('top-products-list');
        if (!el) return;

        const nameById = {};
        (products || []).forEach(p => { if (p.id) nameById[String(p.id)] = p.name; });

        // Solo últimos 30 días
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
        const countsById = {};

        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at);
            if (isNaN(d.getTime()) || d < cutoff) return;
            (s.items || []).forEach(i => {
                if (i.type === 'meta') return;
                const qty = Number(i.cantidad || i.qty || i.quantity || 0);
                const key = i.id ? String(i.id) : `n:${i.name}`;
                countsById[key] = (countsById[key] || 0) + qty;
                if (!nameById[key] && i.name) nameById[key] = i.name;
            });
        });

        const sorted = Object.entries(countsById).sort((a, b) => b[1] - a[1]).slice(0, 5);

        if (sorted.length === 0) {
            el.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">Aún no hay ventas suficientes para mostrar este reporte.</div>`;
            return;
        }

        const maxQty = sorted[0][1];
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
        const medals = ['🥇', '🥈', '🥉', '4°', '5°'];

        el.innerHTML = sorted.map(([key, qty], idx) => {
            const name = nameById[key] || key.replace('n:', '');
            const pct = Math.round((qty / maxQty) * 100);
            return `
            <div class="product-rank-item">
                <div class="rank-number" style="background:${colors[idx]}22; color:${colors[idx]};">${medals[idx]}</div>
                <div class="rank-bar-wrap">
                    <div class="rank-name">${name}</div>
                    <div class="rank-bar-bg">
                        <div class="rank-bar-fill" style="width:${pct}%; background:${colors[idx]};"></div>
                    </div>
                </div>
                <div class="rank-qty" style="color:${colors[idx]};">${fmtNum(qty)} <span style="font-size:0.75rem; font-weight:400; color:var(--text-secondary);">vendidos</span></div>
            </div>`;
        }).join('');
    }

    // ============================================================
    // CLIENTES CON DEUDA (desde tabla customer_charges)
    // ============================================================
    async function loadClientDebt() {
        const el = document.getElementById('deudores-container');
        if (!el) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: charges, error } = await supabase
                .from('customer_charges')
                .select('customer_id, type, amount, customers(name, phone)')
                .eq('user_id', user.id);

            if (error) {
                // Si la tabla no existe aún, mostramos mensaje amigable
                el.innerHTML = `<div class="alert-row alert-ok">✅ Configura el módulo de Clientes en Proveedores para ver deudas.</div>`;
                return;
            }

            // Agrupar por cliente
            const clientMap = {};
            (charges || []).forEach(c => {
                const cid = c.customer_id;
                if (!clientMap[cid]) {
                    clientMap[cid] = {
                        name: c.customers?.name || 'Cliente',
                        phone: c.customers?.phone || '',
                        balance: 0
                    };
                }
                clientMap[cid].balance += c.type === 'charge' ? Number(c.amount) : -Number(c.amount);
            });

            const deudores = Object.values(clientMap)
                .filter(c => c.balance > 0.5)
                .sort((a, b) => b.balance - a.balance)
                .slice(0, 5);

            const totalDeuda = Object.values(clientMap).reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);

            if (deudores.length === 0) {
                el.innerHTML = `<div class="alert-row alert-ok">✅ Ningún cliente tiene deuda pendiente. ¡Excelente!</div>`;
                return;
            }

            el.innerHTML = `
                <div style="background:rgba(239,68,68,0.07); border-radius:10px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.85rem; color:var(--text-secondary);"> Total por cobrar</span>
                    <strong style="color:#ef4444; font-size:1.1rem;">${fmt(totalDeuda)}</strong>
                </div>
                ${deudores.map(c => `
                <div class="debt-client-row">
                    <div>
                        <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem;">${c.name}</div>
                        ${c.phone ? `<div style="font-size:0.78rem; color:var(--text-secondary);">${c.phone}</div>` : ''}
                    </div>
                    <div style="font-weight:800; color:#ef4444;">${fmt(c.balance)}</div>
                </div>`).join('')}
                ${Object.values(clientMap).filter(c => c.balance > 0.5).length > 5
                    ? `<div style="text-align:center; margin-top:10px; font-size:0.82rem; color:var(--text-secondary);">+${Object.values(clientMap).filter(c => c.balance > 0.5).length - 5} clientes más con deuda</div>`
                    : ''}
            `;
        } catch (e) {
            console.warn('No se pudo cargar deuda de clientes:', e);
            el.innerHTML = `<div style="color:var(--text-secondary); font-size:0.85rem; text-align:center; padding:10px;">Activa el módulo de Clientes para ver este reporte.</div>`;
        }
    }

    // ============================================================
    // INVENTARIO MUERTO (sin ventas en 30 días, pero con stock)
    // ============================================================
    function renderDeadStock(sales, products) {
        const el = document.getElementById('dead-stock-container');
        if (!el) return;

        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
        const soldProductIds = new Set();

        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at);
            if (isNaN(d.getTime()) || d < cutoff) return;
            (s.items || []).forEach(i => {
                if (i.type === 'meta') return;
                if (i.id) soldProductIds.add(String(i.id));
                if (i.name) soldProductIds.add(`name:${i.name}`);
            });
        });

        const dead = (products || []).filter(p => {
            if (Number(p.stock) <= 0) return false;
            const byId = soldProductIds.has(String(p.id));
            const byName = soldProductIds.has(`name:${p.name}`);
            return !byId && !byName;
        }).slice(0, 6);

        if (dead.length === 0) {
            el.innerHTML = `<div class="alert-row alert-ok">✅ Todos tus productos han tenido movimiento este mes. ¡Muy bien!</div>`;
            return;
        }

        const totalCapital = dead.reduce((acc, p) => acc + (Number(p.cost_price || 0) * Number(p.stock)), 0);

        el.innerHTML = `
            <div style="background:rgba(245,158,11,0.08); border-radius:10px; padding:10px 14px; margin-bottom:14px; font-size:0.85rem; color:#f59e0b; font-weight:700;">
                Tienes aprox. ${fmt(totalCapital)} de dinero parado en estos productos
            </div>
            ${dead.map(p => `
            <div class="dead-item">
                <div>
                    <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem;">${p.name}</div>
                    <div style="font-size:0.78rem; color:var(--text-secondary);">Stock: ${p.stock} | Costo unitario: ${fmt(p.cost_price || 0)}</div>
                </div>
                <span style="font-size:0.8rem; background:rgba(245,158,11,0.1); color:#f59e0b; padding:3px 10px; border-radius:20px; font-weight:700; white-space:nowrap;">Sin ventas</span>
            </div>`).join('')}
        `;
    }

    // ============================================================
    // STOCK BAJO (mejorado con lenguaje claro)
    // ============================================================
    function renderLowStock(products) {
        const el = document.getElementById('low-stock-list');
        if (!el) return;

        const low = (products || [])
            .filter(p => !isNaN(Number(p.stock)) && Number(p.stock) <= 10)
            .sort((a, b) => Number(a.stock) - Number(b.stock))
            .slice(0, 10);

        if (low.length === 0) {
            el.innerHTML = `<div class="alert-row alert-ok">✅ Todo el inventario tiene stock suficiente. ¡Sin problemas!</div>`;
            return;
        }

        el.innerHTML = `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:10px;">
            ${low.map(p => {
                const stock = Number(p.stock);
                const isCritical = stock <= 0;
                const color = isCritical ? '#ef4444' : '#f59e0b';
                const bg = isCritical ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
                const label = isCritical ? '🚫 AGOTADO' : `⚠️ Solo ${stock} left`;
                return `
                <div style="padding:12px 14px; border-radius:10px; background:${bg}; border:1px solid ${color}33; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span style="font-size:0.88rem; font-weight:700; color:var(--text-primary);">${p.name}</span>
                    <span style="font-size:0.8rem; font-weight:800; color:${color}; white-space:nowrap;">${isCritical ? '🚫 Agotado' : stock + ' unid.'}</span>
                </div>`;
            }).join('')}
        </div>`;
    }

    // ============================================================
    // GRÁFICA DE VENTAS 7 DÍAS
    // ============================================================
    function renderSalesChart(sales, products) {
        const canvas = document.getElementById('salesChart');
        if (!canvas) return;

        const costMap = new Map();
        (products || []).forEach(p => {
            const c = Number(p.cost_price);
            if (!isNaN(c)) {
                if (p.id) costMap.set(String(p.id), c);
                if (p.name) costMap.set(p.name, c);
            }
        });

        const last7 = {};
        const keys = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toDateString();
            const label = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            last7[key] = { label, sales: 0, costs: 0 };
            keys.push(key);
        }

        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at);
            if (isNaN(d.getTime())) return;
            const key = d.toDateString();
            if (!last7[key]) return;
            const total = Number(s.total || 0);
            let cost = 0;
            (s.items || []).forEach(item => {
                if (item.type === 'meta') return;
                const qty = Number(item.cantidad || item.qty || item.quantity || 0);
                const uc = item.historical_cost !== undefined ? Number(item.historical_cost)
                    : (costMap.get(String(item.id)) || costMap.get(item.name) || 0);
                cost += qty * uc;
            });
            last7[key].sales += total;
            last7[key].costs += cost;
        });

        const labels = keys.map(k => last7[k].label);
        const salesData = keys.map(k => last7[k].sales);
        const costsData = keys.map(k => last7[k].costs);

        if (salesChartInstance) {
            if (salesChartInstance.canvas !== canvas) {
                salesChartInstance.destroy(); salesChartInstance = null;
            } else {
                salesChartInstance.data.labels = labels;
                salesChartInstance.data.datasets[0].data = salesData;
                salesChartInstance.data.datasets[1].data = costsData;
                salesChartInstance.update();
                return;
            }
        }

        const ctx = canvas.getContext('2d');
        const gSales = ctx.createLinearGradient(0, 0, 0, 300);
        gSales.addColorStop(0, 'rgba(59,130,246,0.5)'); gSales.addColorStop(1, 'rgba(59,130,246,0)');
        const gCosts = ctx.createLinearGradient(0, 0, 0, 300);
        gCosts.addColorStop(0, 'rgba(239,68,68,0.3)'); gCosts.addColorStop(1, 'rgba(239,68,68,0)');

        // Detectar el valor máximo para elegir el formato del eje Y
        const maxValue = Math.max(...salesData, ...costsData, 0);
        const yTickCallback = (v) => {
            if (maxValue >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
            if (maxValue >= 10000)   return `$${(v / 1000).toFixed(0)}k`;
            if (maxValue >= 1000)    return `$${(v / 1000).toFixed(1)}k`;
            // Menos de 1000: mostrar valor completo, sin decimales
            return `$${v.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
        };

        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Lo que vendí', data: salesData, borderColor: '#3b82f6', backgroundColor: gSales, borderWidth: 3, tension: 0.4, fill: true, pointBackgroundColor: '#fff', pointHoverRadius: 6 },
                    { label: 'Lo que me costó', data: costsData, borderColor: '#ef4444', backgroundColor: gCosts, borderWidth: 2, borderDash: [5, 5], tension: 0.4, fill: true, pointBackgroundColor: '#fff' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                animation: { duration: 1500, easing: 'easeOutQuart' },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(148,163,184,0.1)' },
                        ticks: {
                            maxTicksLimit: 6,
                            callback: yTickCallback
                        }
                    },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { position: 'top', align: 'end' },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`
                        }
                    }
                }
            }
        });
    }

    loadMetrics();
}