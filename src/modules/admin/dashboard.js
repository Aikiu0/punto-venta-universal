// src/modules/admin/dashboard.js - CONTROL DE GRÁFICAS POR PLAN (MEJORADO V2) + CONTABILIDAD EXACTA
import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';
import { db } from '../../data/db-local.js';
import { syncService } from '../../services/sync.js';
import { PermissionService } from '../../services/permissions.js';
import { renderSidebarHeader } from './components/sidebarHeader.js';

let salesChartInstance = null;
let topProductsChartInstance = null;
const activeAnimations = {}; // Control para evitar solapamiento de animaciones

// --- UTILS PARA ANIMACIONES ---
function animateValue(id, start, end, duration, isCurrency = true) {
    const obj = document.getElementById(id);
    if (!obj) return;
    
    // Si hay una animación corriendo en este elemento, la cancelamos para que no choquen
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

export function renderDashboard() {
    const lockHistory = PermissionService.can('history') ? '' : '🔒 ';
    const lockOrders = PermissionService.can('web_orders') ? '' : '🔒 ';
    const lockSettings = PermissionService.can('settings') ? '' : '🔒 ';
    const hasHistoryAccess = PermissionService.can('history');
    const lockSuppliers = PermissionService.can('suppliers') ? '' : '🔒 ';
    const lockBilling = PermissionService.can('billing') ? '' : '🔒 ';
    const chartBlurClass = hasHistoryAccess ? '' : 'premium-blur-content';
    const chartOverlay = hasHistoryAccess ? '' : `
        <div class="premium-lock-overlay" onclick="window.checkPlan(event, 'history')">
            <div class="lock-badge">🔒</div>
            <div class="lock-text">Ver Análisis de Ventas</div>
        </div>
    `;

    const dashboardStyles = `
        <style>
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            .anim-stagger { opacity: 0; animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            .delay-1 { animation-delay: 0.1s; } .delay-2 { animation-delay: 0.2s; } .delay-3 { animation-delay: 0.3s; }
            .delay-4 { animation-delay: 0.4s; } .delay-5 { animation-delay: 0.5s; }
            .card-panel { transition: transform 0.2s, box-shadow 0.2s; }
            .card-panel:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
            .kpi-value { background: linear-gradient(90deg, var(--text-primary), var(--text-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        </style>
    `;

    return `
        ${dashboardStyles}
        <div class="admin-container">
            <div class="sidebar-overlay" id="sidebar-overlay"></div>

            <aside class="admin-sidebar" id="admin-sidebar">
                <div class="sidebar-logo">${renderSidebarHeader()}</div>
                <nav class="sidebar-menu">
                    <button class="menu-item active"> Dashboard</button>
                    <button class="menu-item" id="nav-orders" onclick="return window.checkPlan(event, 'web_orders')">${lockOrders} Pedidos Web</button>
                    <button class="menu-item" id="nav-inventory"> Inventario</button>
                    <button class="menu-item" id="nav-pos"> Ir a Caja</button>
                    <button class="menu-item" id="nav-suppliers" onclick="return window.checkPlan(event, 'suppliers')">${lockSuppliers} Proveedores</button>
                    <button class="menu-item" id="nav-history" onclick="return window.checkPlan(event, 'history')">${lockHistory} Historial</button>
                    <button class="menu-item" id="nav-settings" onclick="return window.checkPlan(event, 'settings')">${lockSettings} Configuración</button>
                    <button class="menu-item logout" id="nav-logout"> Salir</button>
                </nav>
            </aside>

            <main class="admin-content">
                <header class="content-header anim-stagger">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button id="mobile-menu-btn" style="background:none; border:none; font-size:1.8rem; color:var(--text-primary); cursor:pointer;">☰</button>
                        <div>
                            <h1>Panel de Control</h1>
                            <p style="font-size:0.8rem; color:var(--text-secondary);">Resumen financiero en tiempo real.</p>
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:15px; align-items:center;">
                        <button id="theme-toggle-dash" class="icon-btn" title="Tema">🌗</button>
                        <div style="text-align:right;">
                            <small style="color:var(--text-secondary);">Hoy</small>
                            <div style="font-weight:bold; color:var(--text-primary);">${new Date().toLocaleDateString('es-MX')}</div>
                        </div>
                    </div>
                </header>
                
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:20px; margin-bottom:30px;">
                    <div class="card-panel anim-stagger delay-1" style="border-left: 4px solid #3b82f6; padding:20px; position:relative; overflow:hidden;">
                        <div style="position:absolute; right:-10px; top:-10px; font-size:4rem; opacity:0.05; color:#3b82f6;">$</div>
                        <h3 style="color:var(--text-secondary); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5px 0;">Ventas Hoy</h3>
                        <p id="kpi-today" class="kpi-value" style="font-size:1.8rem; font-weight:800; margin:0;">$0.00</p>
                    </div>
                    <div class="card-panel anim-stagger delay-2" style="border-left: 4px solid #10b981; padding:20px; position:relative; overflow:hidden;">
                        <div style="position:absolute; right:-10px; top:-10px; font-size:4rem; opacity:0.05; color:#10b981;">%</div>
                        <h3 style="color:var(--text-secondary); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5px 0;">Ganancia Neta</h3>
                        <p id="kpi-profit" style="font-size:1.8rem; font-weight:800; color:#10b981; margin:0;">$0.00</p>
                    </div>
                    <div class="card-panel anim-stagger delay-3" style="border-left: 4px solid #8b5cf6; padding:20px; position:relative; overflow:hidden;">
                        <div style="position:absolute; right:-10px; top:-10px; font-size:4rem; opacity:0.05; color:#8b5cf6;">📅</div>
                        <h3 style="color:var(--text-secondary); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 5px 0;">Ventas del Mes</h3>
                        <p id="kpi-month" style="font-size:1.8rem; font-weight:800; color:var(--text-primary); margin:0;">$0.00</p>
                    </div>
                </div>
                
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
                     <div class="card-panel premium-blur-container anim-stagger delay-4">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                            <h3 style="color:var(--text-primary); margin:0;"> Rendimiento (7 Días)</h3>
                            <small style="color:var(--text-secondary); font-size:0.7rem;">Ventas vs Costos</small>
                        </div>
                        ${chartOverlay} 
                        <div class="${chartBlurClass}" style="position:relative; height:300px; width:100%;">
                            <canvas id="salesChart"></canvas>
                        </div>
                     </div>

                     <div class="card-panel premium-blur-container anim-stagger delay-5">
                        <h3 style="margin-bottom:20px; color:var(--text-primary);"> Top Productos</h3>
                        ${chartOverlay}
                        <div class="${chartBlurClass}" style="position:relative; height:300px; width:100%;">
                            <canvas id="topProductsChart"></canvas>
                        </div>
                     </div>
                </div>
                
                <div class="card-panel anim-stagger delay-5" style="margin-top:20px;">
                    <h3 style="color:var(--danger-color); display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.2rem">⚠️</span> Alerta de Stock
                    </h3>
                    <div id="low-stock-list" style="margin-top:10px;">
                        <div style="color:var(--text-secondary); font-style:italic;">Analizando inventario...</div>
                    </div>
                </div>
            </main>
        </div>
    `;
}

export async function setupDashboardLogic(router) {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(51, 65, 85, 0.5)';
    Chart.defaults.font.family = "'Montserrat', sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;

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

    // Listeners
    const btnInv = document.getElementById('nav-inventory'); if (btnInv) btnInv.addEventListener('click', () => navigateTo('/admin/inventory'));
    const btnPos = document.getElementById('nav-pos'); if (btnPos) btnPos.addEventListener('click', () => navigateTo('/pos'));
    const btnOrd = document.getElementById('nav-orders'); if (btnOrd) btnOrd.addEventListener('click', () => navigateTo('/admin/orders'));
    const btnHis = document.getElementById('nav-history'); if (btnHis) btnHis.addEventListener('click', () => navigateTo('/admin/history'));
    const btnSet = document.getElementById('nav-settings'); if (btnSet) btnSet.addEventListener('click', () => navigateTo('/admin/settings'));
    const btnSup = document.getElementById('nav-suppliers'); if (btnSup) btnSup.addEventListener('click', () => navigateTo('/admin/suppliers'));
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); navigateTo('/'); });
    const themeBtn = document.getElementById('theme-toggle-dash');
    if (themeBtn) themeBtn.addEventListener('click', () => ThemeService.toggle());

    // --- DATOS ---
    async function loadMetrics() {
        const businessId = localStorage.getItem('archsell_business_id') || PermissionService.getBusinessId?.();
        let localSales = [];
        let localProducts = [];
        
        try {
            if (businessId && db && db.sales && db.products) {
                if(typeof db.sales.where === 'function') {
                    try {
                        localSales = await db.sales.where('business_id').equals(businessId).toArray();
                        localProducts = await db.products.where('business_id').equals(businessId).toArray();
                    } catch (e) {
                        localSales = (await db.sales.toArray()).filter(s => String(s.business_id) === String(businessId));
                        localProducts = (await db.products.toArray()).filter(p => String(p.business_id) === String(businessId));
                    }
                } else {
                    localSales = await db.sales.toArray();
                    localProducts = await db.products.toArray();
                }
            }
        } catch (err) { console.error("Error DB local:", err); }

        processAndRender(localSales, localProducts);

        if (navigator.onLine) {
            try {
                await Promise.all([syncService.downloadSalesHistory(), syncService.downloadProducts()]);
                if (businessId && db && db.sales.where) {
                    try {
                        localSales = await db.sales.where('business_id').equals(businessId).toArray();
                        localProducts = await db.products.where('business_id').equals(businessId).toArray();
                    } catch {
                        localSales = (await db.sales.toArray()).filter(s => String(s.business_id) === String(businessId));
                        localProducts = (await db.products.toArray()).filter(p => String(p.business_id) === String(businessId));
                    }
                }
                processAndRender(localSales, localProducts);
            } catch (err) { console.warn("Sync background error:", err); }
        }
    }

    async function processAndRender(rawSales, products) {
        // 🚨 FIX 1: DEDUPLICACIÓN DE VENTAS Y FILTRADO
        // Evita que una venta local y su clon en la nube se sumen dos veces
        const uniqueSalesMap = new Map();
        (rawSales || []).forEach(s => {
            if (s.status === 'cancelado') return; // Ignorar ventas canceladas
            const key = s.uuid || s.id; // Priorizar UUID
            uniqueSalesMap.set(key, s);
        });
        const sales = Array.from(uniqueSalesMap.values());

        const businessId = localStorage.getItem('archsell_business_id') || PermissionService.getBusinessId?.();
        let pendingOrders = 0;

        if (navigator.onLine && PermissionService.can('web_orders')) {
            try {
                const query = supabase.from('web_orders').select('*', { count: 'exact', head: true }).eq('status', 'pendiente');
                if (businessId) query.eq('business_id', businessId);
                const { count } = await query;
                pendingOrders = count || 0;
            } catch (err) {}
        }

        calculateKPIs(sales, products, pendingOrders);

        if (PermissionService.can('history')) {
            renderSalesChart(sales, products);
        } else if (salesChartInstance) { 
             salesChartInstance.destroy(); 
             salesChartInstance = null; 
        }

        renderTopProducts(sales, products);
        renderLowStock(products);
    }

    function calculateKPIs(sales, products, pendingOrders) {
        const todayStr = new Date().toDateString();
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        let todaySales = 0, monthSales = 0, todayProfit = 0;

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
            if(isNaN(d.getTime())) return;

            const isToday = d.toDateString() === todayStr;
            const isThisMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            const totalVenta = Number(s.total || 0);

            if (isToday) todaySales += totalVenta;
            if (isThisMonth) monthSales += totalVenta;

            if (isToday && s.items && Array.isArray(s.items)) {
                let saleTotalCost = 0;
                
                s.items.forEach(item => {
                    if (item.type === 'meta') return; 
                    
                    const qty = Number(item.cantidad || item.qty || item.quantity || 0);
                    let unitCost = 0;

                    if (item.historical_cost !== undefined && item.historical_cost !== null) {
                        unitCost = Number(item.historical_cost);
                    } else if (item.id && costMap.has(String(item.id))) {
                        unitCost = costMap.get(String(item.id));
                    } else {
                        unitCost = costMap.get(`name:${item.name}`) || 0;
                    }

                    if(isNaN(unitCost)) unitCost = 0;
                    saleTotalCost += (unitCost * qty);
                });

                todayProfit += (totalVenta - saleTotalCost);
            }
        });

        animateValue("kpi-today", 0, todaySales, 1500);
        animateValue("kpi-profit", 0, todayProfit, 1500);
        animateValue("kpi-month", 0, monthSales, 1500);
    }

    function renderSalesChart(sales, products) {
        const canvas = document.getElementById('salesChart');
        if (!canvas) return;

        if (salesChartInstance) { salesChartInstance.destroy(); salesChartInstance = null; }

        const costMap = new Map();
        (products || []).forEach(p => {
            const c = Number(p.cost_price);
            if(!isNaN(c)) {
                if(p.id) costMap.set(String(p.id), c);
                if(p.name) costMap.set(p.name, c);
            }
        });

        // 🚨 FIX 2: COLISIONES DE FECHAS EN LA GRÁFICA
        // Se utiliza la fecha exacta (toDateString) como llave oculta, y se muestra el nombre corto
        const last7DaysData = {};
        const labelsMapKeys = [];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); 
            d.setDate(d.getDate() - i);
            const exactDate = d.toDateString(); 
            const shortLabel = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            
            last7DaysData[exactDate] = { label: shortLabel, sales: 0, costs: 0 };
            labelsMapKeys.push(exactDate);
        }

        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at || s.createdAt);
            if(isNaN(d.getTime())) return;
            const exactDate = d.toDateString();

            if (last7DaysData[exactDate]) {
                const totalVenta = Number(s.total || 0);
                let totalCosto = 0;

                if (s.items && Array.isArray(s.items)) {
                    s.items.forEach(item => {
                        if (item.type === 'meta') return;
                        const qty = Number(item.cantidad || item.qty || item.quantity || 0);
                        let unitCost = item.historical_cost !== undefined ? Number(item.historical_cost) : 
                                      (costMap.get(String(item.id)) || costMap.get(item.name) || 0);
                        totalCosto += (qty * unitCost);
                    });
                }
                
                last7DaysData[exactDate].sales += totalVenta;
                last7DaysData[exactDate].costs += totalCosto;
            }
        });

        const ctx = canvas.getContext('2d');
        const gradientSales = ctx.createLinearGradient(0, 0, 0, 400);
        gradientSales.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); gradientSales.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
        const gradientCosts = ctx.createLinearGradient(0, 0, 0, 400);
        gradientCosts.addColorStop(0, 'rgba(239, 68, 68, 0.3)'); gradientCosts.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labelsMapKeys.map(k => last7DaysData[k].label),
                datasets: [
                    { label: 'Ventas', data: labelsMapKeys.map(k => last7DaysData[k].sales), borderColor: '#3b82f6', backgroundColor: gradientSales, borderWidth: 3, pointBackgroundColor: '#fff', pointHoverRadius: 6, tension: 0.4, fill: true },
                    { label: 'Costos', data: labelsMapKeys.map(k => last7DaysData[k].costs), borderColor: '#ef4444', backgroundColor: gradientCosts, borderWidth: 2, pointBackgroundColor: '#fff', borderDash: [5, 5], tension: 0.4, fill: true }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                animation: { duration: 2000, easing: 'easeOutQuart' },
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, 0.1)' } }, x: { grid: { display: false } } },
                plugins: { 
                    legend: { position: 'top', align: 'end' },
                    tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { label += new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(context.parsed.y); } return label; } } }
                } 
            }
        });
    }

    function renderTopProducts(sales, products) {
        if (topProductsChartInstance) { topProductsChartInstance.destroy(); topProductsChartInstance = null; }
        const isAdvanced = PermissionService.can('history');
        const countsById = {};
        const nameById = {};

        (products || []).forEach(p => { if(p.id) nameById[String(p.id)] = p.name; });

        (sales || []).forEach(s => {
            if (!s.items) return;
            s.items.forEach(i => {
                if (i.type === 'meta') return;
                const qty = Number(i.cantidad || i.qty || i.quantity || 0);
                const key = i.id ? String(i.id) : `n:${i.name}`;
                countsById[key] = (countsById[key] || 0) + qty;
                if (!nameById[key] && i.name) nameById[key] = i.name;
            });
        });

        const sorted = Object.entries(countsById).sort((a,b) => b[1] - a[1]).slice(0, 5);
        const labels = sorted.map(([k]) => nameById[k] || k.replace('n:',''));
        const data = sorted.map(([_, v]) => v);

        const canvas = document.getElementById('topProductsChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        topProductsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'], borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', hoverOffset: 10 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', animation: { animateScale: true, animateRotate: true }, plugins: { legend: { display: isAdvanced, position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
        });
    }

    function renderLowStock(products) {
        const el = document.getElementById('low-stock-list');
        if (!el) return;
        const low = (products || []).filter(p => !isNaN(Number(p.stock)) && Number(p.stock) <= 10).sort((a, b) => Number(a.stock) - Number(b.stock)).slice(0, 10);
        if (low.length === 0) return el.innerHTML = '<div style="color:#10b981; padding:10px; background:rgba(16, 185, 129, 0.1); border-radius:8px;">✅ Inventario saludable</div>';
        el.innerHTML = `<ul style="padding-left:0; list-style:none; margin:0;">${low.map((p, index) => {
                const stockVal = Number(p.stock); const isCritical = stockVal <= 0; const color = isCritical ? '#ef4444' : '#f59e0b'; const bg = isCritical ? 'rgba(239, 68, 68, 0.1)' : 'transparent';
                return `<li style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; margin-bottom:5px; border-radius:6px; background:${bg}; border-left:3px solid ${color}; animation: fadeInUp 0.3s ease-out forwards; animation-delay: ${index * 0.05}s; opacity:0;">
                    <span style="font-size:0.9rem;">${p.name}</span><b style="color:${color}; font-size:0.9rem;">${stockVal} un.</b></li>`;
            }).join('')}</ul>`;
    }

    loadMetrics();
}