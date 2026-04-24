// src/modules/admin/dashboard.js
import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';
import { db } from '../../data/db-local.js';
import { syncService } from '../../services/sync.js';
import { PermissionService } from '../../services/permissions.js';
import { renderSidebarHeader } from './components/sidebarHeader.js';

let salesChartInstance = null;
const activeAnimations = {};

// ── Utils ──────────────────────────────────────────────────────
function animateValue(id, start, end, duration, isCurrency = true) {
    const obj = document.getElementById(id);
    if (!obj) return;
    if (activeAnimations[id]) cancelAnimationFrame(activeAnimations[id]);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        obj.innerHTML = isCurrency
            ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(progress === 1 ? end : value)
            : value;
        if (progress < 1) activeAnimations[id] = window.requestAnimationFrame(step);
        else delete activeAnimations[id];
    };
    activeAnimations[id] = window.requestAnimationFrame(step);
}

const fmt    = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
const fmtNum = (n) => Number(n || 0).toLocaleString('es-MX');

function getSaludo() {
    const h = new Date().getHours();
    if (h < 12) return '☀️ Buenos días';
    if (h < 19) return '🌤️ Buenas tardes';
    return '🌙 Buenas noches';
}
function getDayName() {
    return new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── Render ─────────────────────────────────────────────────────
export function renderDashboard() {
    const lockHistory  = PermissionService.can('history')   ? '' : '🔒 ';
    const lockOrders   = PermissionService.can('web_orders') ? '' : '🔒 ';
    const lockSettings = PermissionService.can('settings')  ? '' : '🔒 ';
    const lockSuppliers= PermissionService.can('suppliers') ? '' : '🔒 ';
    const hasHistoryAccess = PermissionService.can('history');
    const chartBlurClass   = hasHistoryAccess ? '' : 'premium-blur-content';
    const chartOverlay     = hasHistoryAccess ? '' : `
        <div class="premium-lock-overlay" onclick="window.checkPlan(event,'history')">
            <div class="lock-badge">🔒</div>
            <div class="lock-text">Ver Análisis de Ventas</div>
        </div>`;

    return `
    <style>
        /* ── Animaciones ── */
        @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .anim-stagger { opacity:0; animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
        .delay-1{animation-delay:.05s}.delay-2{animation-delay:.1s}.delay-3{animation-delay:.15s}
        .delay-4{animation-delay:.2s}.delay-5{animation-delay:.25s}.delay-6{animation-delay:.3s}
        .delay-7{animation-delay:.35s}.delay-8{animation-delay:.4s}

        /* ── KPI Cards ── */
        .kpi-card {
            background: var(--bg-card);
            border-radius: 16px;
            padding: 18px 16px;
            border: 1px solid var(--border-color);
            position: relative;
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.07); }
        .kpi-label {
            font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.6px; color: var(--text-secondary); margin: 0 0 6px 0;
        }
        .kpi-number { font-size: 1.7rem; font-weight: 800; margin: 0; line-height: 1; color: var(--text-primary); }
        .kpi-sub    { font-size: 0.75rem; color: var(--text-secondary); margin-top: 5px; }
        .kpi-icon   { position:absolute; right:-6px; top:-6px; font-size:3rem; opacity:0.05; }

        /* ── Report sections ── */
        .report-section {
            background: var(--bg-card); border-radius: 14px;
            border: 1px solid var(--border-color); overflow: hidden;
        }
        .report-header {
            padding: 14px 18px; border-bottom: 1px solid var(--border-color);
            display: flex; align-items: center; justify-content: space-between;
        }
        .report-title { font-size: 0.92rem; font-weight: 800; color: var(--text-primary); margin: 0; }
        .report-body  { padding: 14px 18px; }

        /* ── Alertas ── */
        .alert-row {
            display: flex; align-items: center; gap: 10px;
            padding: 9px 12px; border-radius: 9px; margin-bottom: 7px;
            font-size: 0.85rem; font-weight: 600;
        }
        .alert-row:last-child { margin-bottom: 0; }
        .alert-critical { background:rgba(239,68,68,.1);  border:1px solid rgba(239,68,68,.2);  color:#ef4444; }
        .alert-warning  { background:rgba(245,158,11,.1); border:1px solid rgba(245,158,11,.2); color:#f59e0b; }
        .alert-ok       { background:rgba(16,185,129,.1); border:1px solid rgba(16,185,129,.2); color:#10b981; }

        /* ── Comparativo ── */
        .compare-row {
            display: flex; justify-content: space-between; align-items: center;
            padding: 10px 0; border-bottom: 1px solid var(--border-color); gap: 8px;
        }
        .compare-row:last-child { border-bottom: none; }
        .compare-label   { font-size: 0.85rem; color: var(--text-secondary); }
        .compare-values  { display: flex; gap: 12px; align-items: center; }
        .compare-current { font-weight: 800; font-size: 0.95rem; color: var(--text-primary); }
        .trend-badge     { padding: 2px 8px; border-radius: 20px; font-size: 0.72rem; font-weight: 800; }
        .trend-up   { background:rgba(16,185,129,.15); color:#10b981; }
        .trend-down { background:rgba(239,68,68,.15);  color:#ef4444; }
        .trend-flat { background:rgba(148,163,184,.15); color:#94a3b8; }

        /* ── Ranking productos ── */
        .product-rank-item {
            display: flex; align-items: center; gap: 10px;
            padding: 9px 0; border-bottom: 1px solid var(--border-color);
        }
        .product-rank-item:last-child { border-bottom: none; }
        .rank-number {
            width: 26px; height: 26px; border-radius: 7px;
            display: flex; align-items: center; justify-content: center;
            font-weight: 800; font-size: 0.82rem; flex-shrink: 0;
        }
        .rank-bar-wrap { flex: 1; min-width: 0; }
        .rank-name { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-bottom: 3px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rank-bar-bg   { height: 5px; background: var(--bg-input); border-radius: 10px; overflow: hidden; }
        .rank-bar-fill { height: 100%; border-radius: 10px; transition: width 1s ease; }
        .rank-qty      { font-weight: 800; font-size: 0.85rem; color: var(--text-primary); white-space: nowrap; }

        /* ── Deuda clientes ── */
        .debt-client-row {
            display: flex; justify-content: space-between; align-items: center;
            padding: 9px 0; border-bottom: 1px solid var(--border-color);
        }
        .debt-client-row:last-child { border-bottom: none; }

        /* ── Stock muerto ── */
        .dead-item {
            display: flex; justify-content: space-between; align-items: center;
            padding: 9px 0; border-bottom: 1px dashed var(--border-color); font-size: 0.87rem;
        }
        .dead-item:last-child { border-bottom: none; }

        /* ── Saludo bar ── */
        .saludo-bar {
            background: linear-gradient(135deg, var(--brand-color) 0%, #a855f7 100%);
            color: white; border-radius: 14px; padding: 14px 18px;
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 16px; gap: 10px; flex-wrap: wrap;
        }
        .saludo-text { font-size: 1rem; font-weight: 800; }
        .saludo-date { font-size: 0.8rem; opacity: 0.85; margin-top: 2px; }

        /* ── Gráfica blur ── */
        .premium-blur-container { position: relative; overflow: hidden; border-radius: 10px; }
        .premium-blur-content   { filter: blur(8px); opacity: .6; pointer-events: none; user-select: none; }
        .premium-lock-overlay {
            position: absolute; top:0; left:0; width:100%; height:100%; z-index:50;
            cursor: pointer; display: flex; flex-direction: column;
            justify-content: center; align-items: center;
            background: rgba(255,255,255,.1); transition: background .3s;
        }
        .premium-lock-overlay:hover { background: rgba(255,255,255,.3); }
        .lock-badge { font-size: 2.5rem; margin-bottom: 8px; }
        .lock-text  { font-weight: bold; color: #1e293b; background: rgba(255,255,255,.9); padding: 4px 14px; border-radius: 20px; }

        /* ── Mobile top bar (hamburguesa + título) ── */
        .dash-topbar {
            display: none; /* Oculto en escritorio */
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: var(--bg-card);
            border-bottom: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .dash-hamburger {
            background: none; border: none; font-size: 1.6rem;
            color: var(--text-primary); cursor: pointer; padding: 4px; line-height: 1;
            flex-shrink: 0;
        }
        .dash-topbar-title { font-weight: 700; font-size: 1rem; color: var(--text-primary); }
        .dash-topbar-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }

        /* ── RESPONSIVE MÓVIL ── */
        @media(max-width: 768px) {
            /* Mostrar topbar móvil */
            .dash-topbar { display: flex; }

            /* El admin-content no tiene el header de escritorio en móvil */
            .dash-desktop-header { display: none; }

            /* Padding reducido en móvil */
            .admin-content { padding: 12px !important; }

            /* Saludo más compacto */
            .saludo-bar {
                flex-direction: column; text-align: center;
                padding: 12px 14px; gap: 8px;
            }
            .saludo-text { font-size: 0.92rem; }
            .saludo-date { font-size: 0.75rem; }

            /* KPIs: 2 columnas en móvil */
            .kpi-grid {
                grid-template-columns: 1fr 1fr !important;
                gap: 10px !important;
            }
            .kpi-number { font-size: 1.3rem; }
            .kpi-label  { font-size: 0.68rem; }
            .kpi-sub    { font-size: 0.7rem; }

            /* Filas de 2 columnas → 1 columna en móvil */
            .row-2col  { grid-template-columns: 1fr !important; }
            .row-auto  { grid-template-columns: 1fr !important; }

            /* Tamaño de fuente en cards */
            .report-title   { font-size: 0.85rem; }
            .report-body    { padding: 12px 14px; }
            .report-header  { padding: 12px 14px; }

            /* Comparativo en móvil */
            .compare-row    { flex-wrap: wrap; gap: 4px; }
            .compare-values { gap: 6px; }

            /* Stock bajo: 1 columna en móvil */
            .low-stock-grid { grid-template-columns: 1fr !important; }

            /* Gráfica más baja en móvil */
            .chart-container { height: 200px !important; }

            /* Rank items */
            .rank-qty { font-size: 0.78rem; }

            /* Alerts */
            .alert-row { font-size: 0.8rem; padding: 8px 10px; }
        }

        @media(max-width: 400px) {
            /* Pantallas muy pequeñas: KPIs en 1 columna */
            .kpi-grid { grid-template-columns: 1fr !important; }
            .kpi-number { font-size: 1.5rem; }
        }
    </style>

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

        <main class="admin-content" style="padding:24px 28px; overflow-y:auto;">

            <!-- ══ TOP BAR MÓVIL (solo visible en pantallas pequeñas) ══ -->
            <div class="dash-topbar">
                <button class="dash-hamburger" id="mobile-menu-btn" aria-label="Abrir menú">☰</button>
                <span class="dash-topbar-title">Dashboard</span>
                <div class="dash-topbar-right">
                    <button id="theme-toggle-dash-mobile"
                        style="background:var(--bg-input);border:1px solid var(--border-color);
                               color:var(--text-primary);width:34px;height:34px;border-radius:8px;
                               cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">
                        🌗
                    </button>
                </div>
            </div>

            <!-- ══ SALUDO (escritorio y móvil) ══ -->
            <div class="saludo-bar anim-stagger delay-1" style="margin-top:0;">
                <div>
                    <div class="saludo-text">${getSaludo()}</div>
                    <div class="saludo-date">${getDayName()}</div>
                </div>
                <!-- Botones solo visibles en escritorio -->
                <div class="dash-desktop-header" style="display:flex;gap:12px;align-items:center;">
                    <button id="theme-toggle-dash"
                        style="background:rgba(255,255,255,.2);border:none;color:white;
                               width:36px;height:36px;border-radius:9px;cursor:pointer;font-size:1.1rem;">
                        🌗
                    </button>
                </div>
            </div>

            <!-- ══ FILA 1: KPIs ══ -->
            <div class="kpi-grid anim-stagger delay-2"
                 style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:14px; margin-bottom:18px;">

                <div class="kpi-card" style="border-top:4px solid #3b82f6;">
                    <div class="kpi-icon">💰</div>
                    <p class="kpi-label">Vendí hoy</p>
                    <p id="kpi-today" class="kpi-number" style="color:#3b82f6;">$0.00</p>
                    <p class="kpi-sub" id="kpi-today-txn">0 ventas realizadas</p>
                </div>

                <div class="kpi-card" style="border-top:4px solid #10b981;">
                    <div class="kpi-icon">💵</div>
                    <p class="kpi-label">Gané hoy</p>
                    <p id="kpi-profit" class="kpi-number" style="color:#10b981;">$0.00</p>
                    <p class="kpi-sub">Después de costos</p>
                </div>

                <div class="kpi-card" style="border-top:4px solid #8b5cf6;">
                    <div class="kpi-icon">📅</div>
                    <p class="kpi-label">Total del mes</p>
                    <p id="kpi-month" class="kpi-number" style="color:#8b5cf6;">$0.00</p>
                    <p class="kpi-sub" id="kpi-month-days">Este mes hasta hoy</p>
                </div>

                <div class="kpi-card" style="border-top:4px solid #f59e0b;">
                    <div class="kpi-icon">🧾</div>
                    <p class="kpi-label">Ticket promedio</p>
                    <p id="kpi-avg" class="kpi-number" style="color:#f59e0b;">$0.00</p>
                    <p class="kpi-sub">Por venta</p>
                </div>

            </div>

            <!-- ══ FILA 2: ALERTAS + COMPARATIVO ══ -->
            <div class="row-2col anim-stagger delay-4"
                 style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px;">

                <div class="report-section">
                    <div class="report-header">
                        <h3 class="report-title"> Alertas importantes</h3>
                        <small style="color:var(--text-secondary);font-size:0.72rem;">Atención</small>
                    </div>
                    <div class="report-body" id="alertas-container">
                        <div style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:8px;">Revisando...</div>
                    </div>
                </div>

                <div class="report-section">
                    <div class="report-header">
                        <h3 class="report-title"> ¿Cómo voy?</h3>
                        <small style="color:var(--text-secondary);font-size:0.72rem;">Esta semana vs anterior</small>
                    </div>
                    <div class="report-body" id="comparativo-container">
                        <div style="color:var(--text-secondary);font-size:0.85rem;text-align:center;padding:8px;">Calculando...</div>
                    </div>
                </div>

            </div>

            <!-- ══ FILA 3: TOP PRODUCTOS + GRÁFICA ══ -->
            <div class="row-auto anim-stagger delay-5"
                 style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:14px; margin-bottom:18px;">

                <div class="report-section">
                    <div class="report-header">
                        <h3 class="report-title"> Lo que más se vende</h3>
                        <small style="color:var(--text-secondary);font-size:0.72rem;">Últimos 30 días</small>
                    </div>
                    <div class="report-body" id="top-products-list">
                        <div style="color:var(--text-secondary);text-align:center;padding:8px;">Calculando...</div>
                    </div>
                </div>

                <div class="report-section premium-blur-container">
                    <div class="report-header">
                        <h3 class="report-title"> Ventas últimos 7 días</h3>
                    </div>
                    ${chartOverlay}
                    <div class="${chartBlurClass}" style="padding:14px;">
                        <div class="chart-container" style="position:relative;height:240px;">
                            <canvas id="salesChart"></canvas>
                        </div>
                    </div>
                </div>

            </div>

            <!-- ══ FILA 4: DEUDA + STOCK MUERTO ══ -->
            <div class="row-auto anim-stagger delay-6"
                 style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:14px; margin-bottom:18px;">

                <div class="report-section">
                    <div class="report-header">
                        <h3 class="report-title"> Clientes que te deben</h3>
                        <small style="color:var(--text-secondary);font-size:0.72rem;">Por cobrar</small>
                    </div>
                    <div class="report-body" id="deudores-container">
                        <div style="color:var(--text-secondary);text-align:center;padding:8px;">Consultando...</div>
                    </div>
                </div>

                <div class="report-section">
                    <div class="report-header">
                        <h3 class="report-title"> Productos sin movimiento</h3>
                        <small style="color:var(--text-secondary);font-size:0.72rem;">Sin ventas en 30 días</small>
                    </div>
                    <div class="report-body" id="dead-stock-container">
                        <div style="color:var(--text-secondary);text-align:center;padding:8px;">Analizando...</div>
                    </div>
                </div>

            </div>

            <!-- ══ FILA 5: STOCK BAJO ══ -->
            <div class="report-section anim-stagger delay-7" style="margin-bottom:30px;">
                <div class="report-header">
                    <h3 class="report-title">⚠️ Productos que se están acabando</h3>
                    <small style="color:var(--text-secondary);font-size:0.72rem;">Surtir pronto</small>
                </div>
                <div class="report-body" id="low-stock-list">
                    <div style="color:var(--text-secondary);text-align:center;padding:8px;">Revisando inventario...</div>
                </div>
            </div>

        </main>
    </div>
    `;
}

// ── Setup ──────────────────────────────────────────────────────
export async function setupDashboardLogic(router) {

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(51,65,85,0.5)';
    Chart.defaults.font.family = "'Montserrat', sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.9)';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;

    // ── Menú móvil ────────────────────────────────────────────
    const sidebar    = document.getElementById('admin-sidebar');
    const overlay    = document.getElementById('sidebar-overlay');
    // El botón hamburguesa ahora SÍ existe en el HTML (dash-topbar)
    const btnOpen    = document.getElementById('mobile-menu-btn');

    function toggleMenu(show) {
        sidebar?.classList.toggle('active', show);
        overlay?.classList.toggle('active', show);
    }
    btnOpen?.addEventListener('click',  () => toggleMenu(true));
    overlay?.addEventListener('click',  () => toggleMenu(false));

    // ── Tema: dos botones (escritorio y móvil) ────────────────
    const toggleTheme = () => ThemeService.toggle();
    document.getElementById('theme-toggle-dash')?.addEventListener('click',        toggleTheme);
    document.getElementById('theme-toggle-dash-mobile')?.addEventListener('click', toggleTheme);

    // ── Navegación ────────────────────────────────────────────
    const navTo = (path) => { toggleMenu(false); router.navigate(path); };
    const bind  = (id, path) => document.getElementById(id)?.addEventListener('click', () => navTo(path));

    bind('nav-inventory', '/admin/inventory');
    bind('nav-pos',       '/pos');
    bind('nav-orders',    '/admin/orders');
    bind('nav-history',   '/admin/history');
    bind('nav-settings',  '/admin/settings');
    bind('nav-suppliers', '/admin/suppliers');

    document.getElementById('nav-logout')?.addEventListener('click', async () => {
        await supabase.auth.signOut(); navTo('/');
    });

    // ── Carga de datos ────────────────────────────────────────
    async function loadMetrics() {
        const businessId = localStorage.getItem('archsell_business_id');
        let localSales = [], localProducts = [];

        try {
            if (businessId && db?.sales && db?.products) {
                try {
                    localSales    = await db.sales.where('business_id').equals(businessId).toArray();
                    localProducts = await db.products.where('business_id').equals(businessId).toArray();
                } catch {
                    localSales    = (await db.sales.toArray()).filter(s => String(s.business_id) === String(businessId));
                    localProducts = (await db.products.toArray()).filter(p => String(p.business_id) === String(businessId));
                }
            }
        } catch (err) { console.error('Error DB local:', err); }

        processAndRender(localSales, localProducts);

        if (navigator.onLine) {
            try {
                await Promise.all([syncService.downloadSalesHistory(), syncService.downloadProducts()]);
                try {
                    localSales    = await db.sales.where('business_id').equals(businessId).toArray();
                    localProducts = await db.products.where('business_id').equals(businessId).toArray();
                } catch {
                    localSales    = (await db.sales.toArray()).filter(s => String(s.business_id) === String(businessId));
                    localProducts = (await db.products.toArray()).filter(p => String(p.business_id) === String(businessId));
                }
                processAndRender(localSales, localProducts);
            } catch (err) { console.warn('Sync background error:', err); }
        }

        loadClientDebt();
    }

    async function processAndRender(rawSales, products) {
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

        if (PermissionService.can('history')) renderSalesChart(sales, products);
    }

    // ── KPIs ──────────────────────────────────────────────────
    function calculateKPIs(sales, products) {
        const todayStr     = new Date().toDateString();
        const currentMonth = new Date().getMonth();
        const currentYear  = new Date().getFullYear();
        let todaySales = 0, monthSales = 0, todayProfit = 0, todayTxn = 0;

        const costMap = new Map();
        (products || []).forEach(p => {
            const cost = Number(p.cost_price);
            if (!isNaN(cost)) {
                if (p.id)   costMap.set(String(p.id), cost);
                if (p.name) costMap.set(`name:${p.name}`, cost);
            }
        });

        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at || s.createdAt);
            if (isNaN(d.getTime())) return;
            const totalVenta = Number(s.total || 0);
            const isToday    = d.toDateString() === todayStr;
            const isMonth    = d.getMonth() === currentMonth && d.getFullYear() === currentYear;

            if (isToday) { todaySales += totalVenta; todayTxn++; }
            if (isMonth) monthSales += totalVenta;

            if (isToday && Array.isArray(s.items)) {
                let saleCost = 0;
                s.items.forEach(item => {
                    if (item.type === 'meta') return;
                    const qty      = Number(item.cantidad || item.qty || item.quantity || 0);
                    const unitCost = item.historical_cost !== undefined
                        ? Number(item.historical_cost)
                        : (costMap.get(String(item.id)) || costMap.get(`name:${item.name}`) || 0);
                    saleCost += unitCost * qty;
                });
                todayProfit += (totalVenta - saleCost);
            }
        });

        const avg = todayTxn > 0 ? todaySales / todayTxn : 0;
        animateValue('kpi-today',  0, todaySales,   1200);
        animateValue('kpi-profit', 0, todayProfit,  1200);
        animateValue('kpi-month',  0, monthSales,   1400);
        animateValue('kpi-avg',    0, avg,           1000);

        const txnEl = document.getElementById('kpi-today-txn');
        if (txnEl) txnEl.textContent = `${todayTxn} venta${todayTxn !== 1 ? 's' : ''} realizada${todayTxn !== 1 ? 's' : ''}`;

        const monthEl = document.getElementById('kpi-month-days');
        if (monthEl) monthEl.textContent = `Primeros ${new Date().getDate()} días del mes`;
    }

    // ── Alertas ───────────────────────────────────────────────
    function renderAlertas(sales, products) {
        const el = document.getElementById('alertas-container');
        if (!el) return;
        const alertas  = [];
        const todayStr = new Date().toDateString();

        const agotados  = (products || []).filter(p => Number(p.stock) <= 0);
        const stockBajo = (products || []).filter(p => Number(p.stock) > 0 && Number(p.stock) <= 5);
        const ventasHoy = (sales || []).filter(s => new Date(s.date || s.created_at).toDateString() === todayStr);

        if (agotados.length > 0) alertas.push({ tipo: 'critical', icon: '🚫', texto: `${agotados.length} producto${agotados.length > 1 ? 's' : ''} AGOTADO${agotados.length > 1 ? 'S' : ''}: ${agotados.slice(0,2).map(p => p.name).join(', ')}${agotados.length > 2 ? '...' : ''}` });
        if (stockBajo.length > 0) alertas.push({ tipo: 'warning', icon: '⚠️', texto: `${stockBajo.length} producto${stockBajo.length > 1 ? 's' : ''} con poco stock: ${stockBajo.slice(0,2).map(p => `${p.name} (${p.stock})`).join(', ')}` });
        if (ventasHoy.length === 0) alertas.push({ tipo: 'warning', icon: '📭', texto: 'Aún no hay ventas registradas hoy.' });
        if (agotados.length === 0 && stockBajo.length === 0 && ventasHoy.length > 0) alertas.push({ tipo: 'ok', icon: '✅', texto: `¡Todo en orden! Llevas ${ventasHoy.length} venta${ventasHoy.length > 1 ? 's' : ''} hoy.` });

        el.innerHTML = alertas.length === 0
            ? `<div class="alert-row alert-ok">✅ Sin alertas. ¡Todo bien!</div>`
            : alertas.map(a => `
                <div class="alert-row ${a.tipo === 'critical' ? 'alert-critical' : a.tipo === 'warning' ? 'alert-warning' : 'alert-ok'}">
                    <span style="font-size:1.1rem;flex-shrink:0;">${a.icon}</span>
                    <span>${a.texto}</span>
                </div>`).join('');
    }

    // ── Comparativo semana ────────────────────────────────────
    function renderComparativo(sales) {
        const el = document.getElementById('comparativo-container');
        if (!el) return;
        const now = new Date();
        const dow = now.getDay();
        const startThisWeek = new Date(now); startThisWeek.setDate(now.getDate() - dow); startThisWeek.setHours(0,0,0,0);
        const startLastWeek = new Date(startThisWeek); startLastWeek.setDate(startThisWeek.getDate() - 7);
        const endLastWeek   = new Date(startThisWeek); endLastWeek.setMilliseconds(-1);
        let thisWeekSales = 0, lastWeekSales = 0, thisWeekTxn = 0, lastWeekTxn = 0;

        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at);
            if (isNaN(d.getTime())) return;
            const total = Number(s.total || 0);
            if (d >= startThisWeek)                        { thisWeekSales += total; thisWeekTxn++; }
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
                <span class="compare-label">Ventas esta semana</span>
                <div class="compare-values">
                    <span class="compare-current">${fmt(thisWeekSales)}</span>
                    ${trendIcon(thisWeekSales, lastWeekSales)}
                </div>
            </div>
            <div class="compare-row">
                <span class="compare-label">Número de ventas</span>
                <div class="compare-values">
                    <span class="compare-current">${thisWeekTxn} ventas</span>
                    ${trendIcon(thisWeekTxn, lastWeekTxn)}
                </div>
            </div>
            <div style="margin-top:10px;padding:9px 12px;background:var(--bg-input);border-radius:9px;font-size:0.78rem;color:var(--text-secondary);">
                Semana pasada: <strong style="color:var(--text-primary);">${fmt(lastWeekSales)}</strong> en ${lastWeekTxn} ventas
            </div>`;
    }

    // ── Top productos ─────────────────────────────────────────
    function renderTopProducts(sales, products) {
        const el = document.getElementById('top-products-list');
        if (!el) return;
        const nameById = {};
        (products || []).forEach(p => { if (p.id) nameById[String(p.id)] = p.name; });
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
        if (sorted.length === 0) { el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:0.85rem;">Sin ventas suficientes aún.</div>`; return; }
        const maxQty  = sorted[0][1];
        const colors  = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
        const medals  = ['🥇','🥈','🥉','4°','5°'];
        el.innerHTML = sorted.map(([key, qty], idx) => {
            const name = nameById[key] || key.replace('n:','');
            const pct  = Math.round((qty / maxQty) * 100);
            return `
            <div class="product-rank-item">
                <div class="rank-number" style="background:${colors[idx]}22;color:${colors[idx]};">${medals[idx]}</div>
                <div class="rank-bar-wrap">
                    <div class="rank-name">${name}</div>
                    <div class="rank-bar-bg"><div class="rank-bar-fill" style="width:${pct}%;background:${colors[idx]};"></div></div>
                </div>
                <div class="rank-qty" style="color:${colors[idx]};">${fmtNum(qty)} <span style="font-size:0.72rem;font-weight:400;color:var(--text-secondary);">uds</span></div>
            </div>`;
        }).join('');
    }

    // ── Deudores ──────────────────────────────────────────────
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
            if (error) { el.innerHTML = `<div class="alert-row alert-ok">✅ Activa el módulo de Clientes para ver deudas.</div>`; return; }
            const clientMap = {};
            (charges || []).forEach(c => {
                const cid = c.customer_id;
                if (!clientMap[cid]) clientMap[cid] = { name: c.customers?.name || 'Cliente', phone: c.customers?.phone || '', balance: 0 };
                clientMap[cid].balance += c.type === 'charge' ? Number(c.amount) : -Number(c.amount);
            });
            const deudores    = Object.values(clientMap).filter(c => c.balance > 0.5).sort((a,b) => b.balance - a.balance).slice(0,5);
            const totalDeuda  = Object.values(clientMap).reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
            if (deudores.length === 0) { el.innerHTML = `<div class="alert-row alert-ok">✅ Ningún cliente tiene deuda. ¡Excelente!</div>`; return; }
            el.innerHTML = `
                <div style="background:rgba(239,68,68,.07);border-radius:9px;padding:9px 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:0.82rem;color:var(--text-secondary);">Total por cobrar</span>
                    <strong style="color:#ef4444;font-size:1rem;">${fmt(totalDeuda)}</strong>
                </div>
                ${deudores.map(c => `
                <div class="debt-client-row">
                    <div>
                        <div style="font-weight:700;color:var(--text-primary);font-size:0.88rem;">${c.name}</div>
                        ${c.phone ? `<div style="font-size:0.75rem;color:var(--text-secondary);">${c.phone}</div>` : ''}
                    </div>
                    <div style="font-weight:800;color:#ef4444;">${fmt(c.balance)}</div>
                </div>`).join('')}`;
        } catch (e) {
            el.innerHTML = `<div style="color:var(--text-secondary);font-size:0.82rem;text-align:center;padding:8px;">Activa el módulo de Clientes.</div>`;
        }
    }

    // ── Stock muerto ──────────────────────────────────────────
    function renderDeadStock(sales, products) {
        const el = document.getElementById('dead-stock-container');
        if (!el) return;
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
        const soldIds = new Set();
        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at);
            if (isNaN(d.getTime()) || d < cutoff) return;
            (s.items || []).forEach(i => {
                if (i.type === 'meta') return;
                if (i.id)   soldIds.add(String(i.id));
                if (i.name) soldIds.add(`name:${i.name}`);
            });
        });
        const dead = (products || []).filter(p => Number(p.stock) > 0 && !soldIds.has(String(p.id)) && !soldIds.has(`name:${p.name}`)).slice(0, 5);
        if (dead.length === 0) { el.innerHTML = `<div class="alert-row alert-ok">✅ Todos los productos han tenido movimiento. ¡Bien!</div>`; return; }
        const totalCapital = dead.reduce((acc, p) => acc + (Number(p.cost_price || 0) * Number(p.stock)), 0);
        el.innerHTML = `
            <div style="background:rgba(245,158,11,.08);border-radius:9px;padding:9px 12px;margin-bottom:12px;font-size:0.82rem;color:#f59e0b;font-weight:700;">
                ≈ ${fmt(totalCapital)} parado en estos productos
            </div>
            ${dead.map(p => `
            <div class="dead-item">
                <div>
                    <div style="font-weight:700;color:var(--text-primary);">${p.name}</div>
                    <div style="font-size:0.72rem;color:var(--text-secondary);">Stock: ${p.stock} · Costo: ${fmt(p.cost_price || 0)}</div>
                </div>
                <span style="font-size:0.75rem;background:rgba(245,158,11,.1);color:#f59e0b;padding:2px 9px;border-radius:20px;font-weight:700;white-space:nowrap;">Sin ventas</span>
            </div>`).join('')}`;
    }

    // ── Stock bajo ────────────────────────────────────────────
    function renderLowStock(products) {
        const el = document.getElementById('low-stock-list');
        if (!el) return;
        const low = (products || []).filter(p => !isNaN(Number(p.stock)) && Number(p.stock) <= 10).sort((a,b) => Number(a.stock) - Number(b.stock)).slice(0, 10);
        if (low.length === 0) { el.innerHTML = `<div class="alert-row alert-ok">✅ Todo el inventario tiene stock suficiente.</div>`; return; }
        el.innerHTML = `
            <div class="low-stock-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">
                ${low.map(p => {
                    const stock      = Number(p.stock);
                    const isCritical = stock <= 0;
                    const color      = isCritical ? '#ef4444' : '#f59e0b';
                    const bg         = isCritical ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)';
                    return `
                    <div style="padding:10px 12px;border-radius:9px;background:${bg};border:1px solid ${color}33;display:flex;justify-content:space-between;align-items:center;gap:6px;">
                        <span style="font-size:0.83rem;font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</span>
                        <span style="font-size:0.77rem;font-weight:800;color:${color};white-space:nowrap;">${isCritical ? '🚫 Agotado' : stock + ' uds'}</span>
                    </div>`;
                }).join('')}
            </div>`;
    }

    // ── Gráfica ventas 7 días ─────────────────────────────────
    function renderSalesChart(sales, products) {
        const canvas = document.getElementById('salesChart');
        if (!canvas) return;
        const costMap = new Map();
        (products || []).forEach(p => {
            const c = Number(p.cost_price);
            if (!isNaN(c)) { if (p.id) costMap.set(String(p.id), c); if (p.name) costMap.set(p.name, c); }
        });
        const last7 = {}, keys = [];
        for (let i = 6; i >= 0; i--) {
            const d   = new Date(); d.setDate(d.getDate() - i);
            const key = d.toDateString();
            last7[key] = { label: d.toLocaleDateString('es-MX', { weekday:'short', day:'numeric' }), sales: 0, costs: 0 };
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
                const uc  = item.historical_cost !== undefined ? Number(item.historical_cost) : (costMap.get(String(item.id)) || costMap.get(item.name) || 0);
                cost += qty * uc;
            });
            last7[key].sales += total;
            last7[key].costs += cost;
        });
        const labels    = keys.map(k => last7[k].label);
        const salesData = keys.map(k => last7[k].sales);
        const costsData = keys.map(k => last7[k].costs);

        if (salesChartInstance) {
            if (salesChartInstance.canvas !== canvas) { salesChartInstance.destroy(); salesChartInstance = null; }
            else {
                salesChartInstance.data.labels           = labels;
                salesChartInstance.data.datasets[0].data = salesData;
                salesChartInstance.data.datasets[1].data = costsData;
                salesChartInstance.update(); return;
            }
        }
        const ctx    = canvas.getContext('2d');
        const gSales = ctx.createLinearGradient(0, 0, 0, 260);
        gSales.addColorStop(0, 'rgba(59,130,246,.45)'); gSales.addColorStop(1, 'rgba(59,130,246,0)');
        const gCosts = ctx.createLinearGradient(0, 0, 0, 260);
        gCosts.addColorStop(0, 'rgba(239,68,68,.25)');  gCosts.addColorStop(1, 'rgba(239,68,68,0)');
        const maxValue      = Math.max(...salesData, ...costsData, 0);
        const yTickCallback = (v) => {
            if (maxValue >= 1000000) return `$${(v/1000000).toFixed(1)}M`;
            if (maxValue >= 10000)   return `$${(v/1000).toFixed(0)}k`;
            if (maxValue >= 1000)    return `$${(v/1000).toFixed(1)}k`;
            return `$${v.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
        };
        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Lo que vendí',    data: salesData, borderColor:'#3b82f6', backgroundColor: gSales, borderWidth:3, tension:.4, fill:true, pointBackgroundColor:'#fff', pointHoverRadius:5 },
                    { label: 'Lo que me costó', data: costsData, borderColor:'#ef4444', backgroundColor: gCosts, borderWidth:2, borderDash:[5,5], tension:.4, fill:true, pointBackgroundColor:'#fff' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode:'index', intersect:false },
                animation:   { duration:1400, easing:'easeOutQuart' },
                scales: {
                    y: { beginAtZero:true, grid:{ color:'rgba(148,163,184,.1)' }, ticks:{ maxTicksLimit:5, callback: yTickCallback } },
                    x: { grid:{ display:false } }
                },
                plugins: {
                    legend: { position:'top', align:'end', labels:{ boxWidth:12, font:{ size:11 } } },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } }
                }
            }
        });
    }

    loadMetrics();
}