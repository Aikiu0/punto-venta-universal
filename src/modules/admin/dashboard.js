// src/modules/admin/dashboard.js - OPTIMIZADO (SIN CRASHEOS)
import { supabase } from '../../data/supabase.js';

// VARIABLES GLOBALES PARA CONTROLAR LAS GRÁFICAS
// (Esto evita que se superpongan y consuman memoria infinita)
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
                        <p>Resumen financiero y operativo.</p>
                    </div>
                    <div style="text-align:right;">
                        <small style="color:#64748b;">Fecha</small>
                        <div style="font-weight:bold; color:#1e293b;">${new Date().toLocaleDateString()}</div>
                    </div>
                </header>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:30px;">
                    <div class="card-panel" style="border-left: 4px solid #10b981;">
                        <h3 style="color:#64748b; font-size:0.8rem; margin:0;">Ventas Hoy</h3>
                        <p id="kpi-today" style="font-size:1.8rem; font-weight:bold; color:#1e293b; margin:10px 0;">$0.00</p>
                    </div>
                    <div class="card-panel" style="border-left: 4px solid #3b82f6;">
                        <h3 style="color:#64748b; font-size:0.8rem; margin:0;">Ventas Mes</h3>
                        <p id="kpi-month" style="font-size:1.8rem; font-weight:bold; color:#1e293b; margin:10px 0;">$0.00</p>
                    </div>
                    <div class="card-panel" style="border-left: 4px solid #f59e0b;">
                        <h3 style="color:#64748b; font-size:0.8rem; margin:0;">Pedidos Web</h3>
                        <p id="kpi-orders" style="font-size:1.8rem; font-weight:bold; color:#1e293b; margin:10px 0;">0</p>
                    </div>
                    <div class="card-panel" style="border-left: 4px solid #8b5cf6;">
                        <h3 style="color:#64748b; font-size:0.8rem; margin:0;">Ticket Promedio</h3>
                        <p id="kpi-ticket" style="font-size:1.8rem; font-weight:bold; color:#1e293b; margin:10px 0;">$0</p>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px;">
                    
                    <div class="card-panel">
                        <h3 style="margin-bottom:15px;">📈 Ventas (7 Días)</h3>
                        <div style="position: relative; height: 300px; width: 100%;">
                            <canvas id="salesChart"></canvas>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:20px;">
                        
                        <div class="card-panel">
                            <h3 style="margin-bottom:10px;">🏆 Top 5 Productos</h3>
                            <div style="position: relative; height: 200px; width: 100%;">
                                <canvas id="topProductsChart"></canvas>
                            </div>
                        </div>

                        <div class="card-panel" style="flex:1; min-height: 200px; max-height: 300px; overflow-y:auto;">
                            <h3 style="margin-bottom:10px; color:#ef4444; position:sticky; top:0; background:white;">⚠️ Stock Bajo</h3>
                            <div id="low-stock-list">Cargando...</div>
                        </div>
                        
                    </div>
                </div>
            </main>
        </div>
    `;
}

export async function setupDashboardLogic(router) {
    // Listeners de navegación
    const navTo = (path) => router.navigate(path);
    document.getElementById('nav-inventory').addEventListener('click', () => navTo('/admin/inventory'));
    document.getElementById('nav-orders').addEventListener('click', () => navTo('/admin/orders'));
    document.getElementById('nav-pos').addEventListener('click', () => navTo('/pos'));
    document.getElementById('nav-logout').addEventListener('click', async () => { 
        await supabase.auth.signOut(); 
        router.navigate('/'); 
    });

    // --- 1. CARGA DE DATOS ---
    async function loadMetrics() {
        const { data: sales } = await supabase.from('sales').select('*');
        const { data: products } = await supabase.from('products').select('*');
        const { count: ordersCount } = await supabase.from('web_orders').select('*', { count: 'exact', head: true }).eq('status', 'pendiente');

        if(sales && products) {
            calculateKPIs(sales, ordersCount || 0);
            renderSalesChart(sales);
            renderTopProducts(sales);
            renderLowStock(products);
        }
    }

    function calculateKPIs(sales, pendingOrders) {
        const today = new Date().toDateString();
        const currentMonth = new Date().getMonth();
        let todayTotal = 0, monthTotal = 0;
        
        sales.forEach(s => {
            const d = new Date(s.created_at);
            if (d.toDateString() === today) todayTotal += s.total;
            if (d.getMonth() === currentMonth) monthTotal += s.total;
        });

        const avg = sales.length > 0 ? (monthTotal / sales.length) : 0;

        document.getElementById('kpi-today').textContent = `$${todayTotal.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        document.getElementById('kpi-month').textContent = `$${monthTotal.toLocaleString('es-MX', {minimumFractionDigits: 0})}`;
        document.getElementById('kpi-orders').textContent = pendingOrders;
        document.getElementById('kpi-ticket').textContent = `$${avg.toFixed(0)}`;
    }

    // --- 2. GRÁFICA VENTAS ---
    function renderSalesChart(sales) {
        // Destruir gráfica vieja si existe (EVITA PANTALLA BLANCA)
        if (salesChartInstance) salesChartInstance.destroy();

        const last7Days = {};
        for(let i=6; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const k = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            last7Days[k] = 0;
        }

        sales.forEach(s => {
            const d = new Date(s.created_at);
            const k = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
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
                    backgroundColor: 'rgba(122, 63, 157, 0.1)',
                    tension: 0.3, fill: true
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false // Vital para que respete el div contenedor
            }
        });
    }

    // --- 3. TOP PRODUCTOS ---
    function renderTopProducts(sales) {
        // Destruir gráfica vieja
        if (topProductsChartInstance) topProductsChartInstance.destroy();

        const counts = {};
        sales.forEach(s => {
            if(!s.items) return;
            s.items.forEach(i => {
                if(i.type !== 'meta') counts[i.name] = (counts[i.name] || 0) + i.cantidad;
            });
        });

        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
        
        const ctx = document.getElementById('topProductsChart').getContext('2d');
        topProductsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sorted.map(i => i[0]),
                datasets: [{
                    data: sorted.map(i => i[1]),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: {size: 10} } } }
            }
        });
    }

    // --- 4. STOCK BAJO ---
    function renderLowStock(products) {
        // Filtramos y limitamos a 20 para no saturar
        const low = products.filter(p => p.stock <= 10 && p.stock > 0).slice(0, 20);
        const el = document.getElementById('low-stock-list');
        
        if(low.length === 0) return el.innerHTML = '<p style="color:#10b981;">✅ Todo bien</p>';

        el.innerHTML = `<ul style="padding-left:20px; margin:0;">
            ${low.map(p => `<li style="margin-bottom:5px; font-size:0.9rem;">
                <b>${p.name}</b>: <span style="color:#e11d48; font-weight:bold;">${p.stock} ${p.unit||'pz'}</span>
            </li>`).join('')}
        </ul>`;
    }

    loadMetrics();
}