// src/modules/admin/dashboard.js - CON CÁLCULO DE GANANCIAS
import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';

let salesChartInstance = null;
let topProductsChartInstance = null;

export function renderDashboard() {
    return `
        <div class="admin-container">
            <aside class="admin-sidebar">
                <div class="sidebar-logo">🚀 Mi Negocio</div>
                <nav class="sidebar-menu">
                    <button class="menu-item active">📊 Dashboard</button>
                    <button class="menu-item" id="nav-orders">🔔 Pedidos Web</button>
                    <button class="menu-item" id="nav-inventory">📦 Inventario</button>
                    <button class="menu-item" id="nav-pos">🛒 Ir a Caja</button>
                    <button class="menu-item logout" id="nav-logout">🚪 Salir</button>
                </nav>
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div class="page-title">
                        <h1>Panel de Control</h1>
                        <p>Resumen financiero y utilidades.</p>
                    </div>
                    
                    <div style="display:flex; gap:15px; align-items:center;">
                         <button id="theme-toggle-dash" class="icon-btn" title="Cambiar Tema" style="background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); width:40px; height:40px; border-radius:8px; cursor:pointer;">
                            🌗
                        </button>
                        
                        <div style="text-align:right;">
                            <small style="color:var(--text-secondary);">Hoy</small>
                            <div style="font-weight:bold; color:var(--text-primary);">${new Date().toLocaleDateString()}</div>
                        </div>
                    </div>
                </header>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:30px;">
                    <div class="card-panel" style="border-left: 4px solid #3b82f6;">
                        <h3 style="color:var(--text-secondary); font-size:0.8rem; margin:0;">Ventas Hoy</h3>
                        <p id="kpi-today" style="font-size:1.8rem; font-weight:bold; color:var(--text-primary); margin:10px 0;">$0.00</p>
                    </div>
                    
                    <div class="card-panel" style="border-left: 4px solid #10b981;">
                        <h3 style="color:var(--text-secondary); font-size:0.8rem; margin:0;">Ganancia Neta (Hoy)</h3>
                        <p id="kpi-profit" style="font-size:1.8rem; font-weight:bold; color:#10b981; margin:10px 0;">$0.00</p>
                    </div>

                    <div class="card-panel" style="border-left: 4px solid #f59e0b;">
                        <h3 style="color:var(--text-secondary); font-size:0.8rem; margin:0;">Pedidos Web</h3>
                        <p id="kpi-orders" style="font-size:1.8rem; font-weight:bold; color:var(--text-primary); margin:10px 0;">0</p>
                    </div>
                    
                    <div class="card-panel" style="border-left: 4px solid #8b5cf6;">
                        <h3 style="color:var(--text-secondary); font-size:0.8rem; margin:0;">Ventas Mes</h3>
                        <p id="kpi-month" style="font-size:1.8rem; font-weight:bold; color:var(--text-primary); margin:10px 0;">$0</p>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px;">
                    <div class="card-panel">
                        <h3 style="margin-bottom:15px; color:var(--text-primary);">📈 Ventas vs Costos (7 Días)</h3>
                        <div style="position: relative; height: 300px; width: 100%;">
                            <canvas id="salesChart"></canvas>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:20px;">
                        <div class="card-panel">
                            <h3 style="margin-bottom:10px; color:var(--text-primary);">🏆 Más Vendidos</h3>
                            <div style="position: relative; height: 200px; width: 100%;">
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
    const navTo = (path) => router.navigate(path);
    document.getElementById('nav-inventory').addEventListener('click', () => navTo('/admin/inventory'));
    document.getElementById('nav-orders').addEventListener('click', () => navTo('/admin/orders'));
    document.getElementById('nav-pos').addEventListener('click', () => navTo('/pos'));
    document.getElementById('nav-logout').addEventListener('click', async () => { await supabase.auth.signOut(); router.navigate('/'); });
    
    document.getElementById('theme-toggle-dash').addEventListener('click', () => ThemeService.toggle());

    async function loadMetrics() {
        // Necesitamos ventas y productos (para saber el costo actual)
        const { data: sales } = await supabase.from('sales').select('*');
        const { data: products } = await supabase.from('products').select('id, name, stock, unit, cost_price'); 
        const { count: ordersCount } = await supabase.from('web_orders').select('*', { count: 'exact', head: true }).eq('status', 'pendiente');

        if(sales && products) {
            calculateKPIs(sales, products, ordersCount || 0);
            renderSalesChart(sales);
            renderTopProducts(sales);
            renderLowStock(products);
        }
    }

    function calculateKPIs(sales, products, pendingOrders) {
        const today = new Date().toDateString();
        const currentMonth = new Date().getMonth();
        let todaySales = 0, monthSales = 0;
        let todayProfit = 0;
        
        // Mapa de costos para búsqueda rápida: { "Producto A": 50.00 }
        const productCostMap = {};
        products.forEach(p => { productCostMap[p.name] = p.cost_price || 0; });

        sales.forEach(s => {
            const d = new Date(s.created_at);
            const isToday = d.toDateString() === today;
            const isThisMonth = d.getMonth() === currentMonth;

            if (isToday) todaySales += s.total;
            if (isThisMonth) monthSales += s.total;

            // CALCULO DE GANANCIA (Solo Hoy para el KPI)
            if (isToday && s.items) {
                let saleCost = 0;
                s.items.forEach(item => {
                    // Intentamos obtener costo guardado en venta, si no existe, usamos costo actual del producto
                    const unitCost = item.cost_price !== undefined ? item.cost_price : (productCostMap[item.name] || 0);
                    saleCost += (unitCost * item.cantidad);
                });
                todayProfit += (s.total - saleCost);
            }
        });

        document.getElementById('kpi-today').textContent = `$${todaySales.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        document.getElementById('kpi-profit').textContent = `$${todayProfit.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        document.getElementById('kpi-month').textContent = `$${monthSales.toLocaleString('es-MX', {minimumFractionDigits: 0})}`;
        document.getElementById('kpi-orders').textContent = pendingOrders;
    }

    function renderSalesChart(sales) {
        if (salesChartInstance) salesChartInstance.destroy();
        const last7Days = {};
        for(let i=6; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            last7Days[d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })] = 0;
        }
        sales.forEach(s => {
            const k = new Date(s.created_at).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            if (last7Days[k] !== undefined) last7Days[k] += s.total;
        });

        const ctx = document.getElementById('salesChart').getContext('2d');
        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(last7Days),
                datasets: [{
                    label: 'Ventas ($)',
                    data: Object.values(last7Days),
                    borderColor: '#7A3F9D',
                    backgroundColor: 'rgba(122, 63, 157, 0.2)',
                    tension: 0.3, fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderTopProducts(sales) {
        if (topProductsChartInstance) topProductsChartInstance.destroy();
        const counts = {};
        sales.forEach(s => { if(s.items) s.items.forEach(i => { if(i.type!=='meta') counts[i.name]=(counts[i.name]||0)+i.cantidad; }); });
        const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
        
        const ctx = document.getElementById('topProductsChart').getContext('2d');
        topProductsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sorted.map(i=>i[0]),
                datasets: [{ data: sorted.map(i=>i[1]), backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'], borderColor: 'transparent' }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position:'right' } } }
        });
    }

    function renderLowStock(products) {
        const low = products.filter(p => p.stock <= 10 && p.stock > 0).slice(0, 20);
        const el = document.getElementById('low-stock-list');
        if(low.length===0) return el.innerHTML = '<p style="color:var(--success-bg);">✅ Todo bien</p>';
        el.innerHTML = `<ul style="padding-left:20px;margin:0;">${low.map(p=>`<li style="margin-bottom:5px;font-size:0.9rem;color:var(--text-primary);"><b>${p.name}</b>: <span style="color:var(--danger-color);font-weight:bold;">${p.stock}</span></li>`).join('')}</ul>`;
    }

    loadMetrics();
}