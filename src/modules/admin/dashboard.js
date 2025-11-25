// src/modules/admin/dashboard.js - OFFLINE FIRST + SALES VS COSTS CHART
import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';
import { db } from '../../data/db-local.js';
import { syncService } from '../../services/sync.js';

let salesChartInstance = null;
let topProductsChartInstance = null;

export function renderDashboard() {
    return `
        <div class="admin-container">
            <aside class="admin-sidebar">
                <div class="sidebar-logo" style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                    <img src="" class="app-logo-img" style="width:80px; height:auto; object-fit:contain; display:none;">
                    <span class="app-name" style="font-size:1.2rem;">Cargando...</span>
                </div>
                <nav class="sidebar-menu">
                    <button class="menu-item active">📊 Dashboard</button>
                    <button class="menu-item" id="nav-orders">🔔 Pedidos Web</button>
                    <button class="menu-item" id="nav-inventory">📦 Inventario</button>
                    <button class="menu-item" id="nav-pos">🛒 Ir a Caja</button>
                    <button class="menu-item" id="nav-history">📅 Historial</button>
                    <button class="menu-item" id="nav-settings">⚙️ Configuración</button>
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
                        <button id="theme-toggle-dash" class="icon-btn" title="Cambiar Tema" style="background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); width:40px; height:40px; border-radius:8px; cursor:pointer; display:flex; justify-content:center; align-items:center;">
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
    // Configuración Gráficas
    Chart.defaults.color = '#94a3b8'; 
    Chart.defaults.borderColor = '#334155'; 
    Chart.defaults.font.family = "'Montserrat', sans-serif";

    // --- CORRECCIÓN DE NAVEGACIÓN (Usar router.navigate directo) ---
    document.getElementById('nav-inventory').addEventListener('click', () => router.navigate('/admin/inventory'));
    document.getElementById('nav-orders').addEventListener('click', () => router.navigate('/admin/orders'));
    document.getElementById('nav-pos').addEventListener('click', () => router.navigate('/pos'));
    document.getElementById('nav-settings').addEventListener('click', () => router.navigate('/admin/settings'));
    document.getElementById('nav-history').addEventListener('click', () => router.navigate('/admin/history'));
    
    document.getElementById('nav-logout').addEventListener('click', async () => { 
        await supabase.auth.signOut(); 
        router.navigate('/'); 
    });
    
    document.getElementById('theme-toggle-dash').addEventListener('click', () => ThemeService.toggle());

    // --- LÓGICA HÍBRIDA (OFFLINE + ONLINE) ---
    async function loadMetrics() {
        // 1. Cargar datos locales (Dexie) - INSTANTÁNEO
        const localSales = await db.sales.toArray();
        const localProducts = await db.products.toArray();
        
        // Renderizar con lo que hay
        processAndRender(localSales, localProducts);

        // 2. Si hay internet, actualizar en segundo plano
        if (navigator.onLine) {
            console.log("🔄 Sincronizando historial...");
            await syncService.downloadSalesHistory(); // Descargar ventas nuevas
            await syncService.downloadProducts(); // Descargar productos nuevos
            
            // Volver a leer y pintar
            const updatedSales = await db.sales.toArray();
            const updatedProducts = await db.products.toArray();
            processAndRender(updatedSales, updatedProducts);
        }
    }

    async function processAndRender(sales, products) {
        // Pedidos web pendientes
        let pendingOrders = 0;
        if(navigator.onLine) {
             const { count } = await supabase.from('web_orders').select('*', { count: 'exact', head: true }).eq('status', 'pendiente');
             pendingOrders = count || 0;
        }

        calculateKPIs(sales, products, pendingOrders);
        renderSalesChart(sales, products); // Le pasamos productos para saber los costos
        renderTopProducts(sales);
        renderLowStock(products);
    }

    function calculateKPIs(sales, products, pendingOrders) {
        const today = new Date().toDateString();
        const currentMonth = new Date().getMonth();
        let todaySales = 0, monthSales = 0, todayProfit = 0;
        
        // Mapa de costos { "Tornillo": 0.50 } para búsqueda rápida
        const productCostMap = {};
        products.forEach(p => { productCostMap[p.name] = Number(p.cost_price || 0); });

        sales.forEach(s => {
            const d = new Date(s.date || s.created_at);
            const isToday = d.toDateString() === today;
            const totalVenta = Number(s.total || 0);

            if (isToday) todaySales += totalVenta;
            if (d.getMonth() === currentMonth) monthSales += totalVenta;

            if (isToday && s.items && Array.isArray(s.items)) {
                let saleCost = 0;
                s.items.forEach(item => {
                    if (item.type === 'meta') return;
                    const qty = Number(item.cantidad || item.qty || 0);
                    // Usar costo guardado en el item o buscar en el mapa actual
                    let unitCost = (item.cost_price !== undefined) ? Number(item.cost_price) : (productCostMap[item.name] || 0);
                    saleCost += (unitCost * qty);
                });
                todayProfit += (totalVenta - saleCost);
            }
        });

        document.getElementById('kpi-today').textContent = `$${todaySales.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        document.getElementById('kpi-profit').textContent = `$${todayProfit.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        document.getElementById('kpi-month').textContent = `$${monthSales.toLocaleString('es-MX', {minimumFractionDigits: 0})}`;
        document.getElementById('kpi-orders').textContent = pendingOrders;
    }

    // --- GRÁFICA CORREGIDA: VENTAS VS COSTOS ---
    function renderSalesChart(sales, products) {
        if (salesChartInstance) salesChartInstance.destroy();

        // 1. Crear Mapa de Costos (Por si la venta no guardó el costo histórico)
        const productCostMap = {};
        products.forEach(p => { productCostMap[p.name] = Number(p.cost_price || 0); });

        // 2. Inicializar acumuladores de los últimos 7 días
        const last7DaysSales = {};
        const last7DaysCosts = {};

        for(let i=6; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            last7DaysSales[key] = 0;
            last7DaysCosts[key] = 0;
        }

        // 3. Llenar datos
        sales.forEach(s => {
            const dateKey = new Date(s.date || s.created_at).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            
            // Si la fecha está dentro del rango de la gráfica
            if (last7DaysSales[dateKey] !== undefined) {
                const totalVenta = Number(s.total || 0);
                let totalCosto = 0;

                // Calcular costo de esta venta
                if(s.items && Array.isArray(s.items)) {
                    s.items.forEach(item => {
                        if(item.type === 'meta') return;
                        const qty = Number(item.cantidad || item.qty || 0);
                        // Preferir costo histórico, sino costo actual
                        const unitCost = (item.cost_price !== undefined) ? Number(item.cost_price) : (productCostMap[item.name] || 0);
                        totalCosto += (qty * unitCost);
                    });
                }

                last7DaysSales[dateKey] += totalVenta;
                last7DaysCosts[dateKey] += totalCosto;
            }
        });

        // 4. Renderizar Chart.js con DOS datasets
        const ctx = document.getElementById('salesChart').getContext('2d');
        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(last7DaysSales),
                datasets: [
                    {
                        label: 'Ventas ($)',
                        data: Object.values(last7DaysSales),
                        borderColor: '#7A3F9D',
                        backgroundColor: 'rgba(122, 63, 157, 0.2)',
                        tension: 0.3, fill: true,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#7A3F9D'
                    },
                    {
                        label: 'Costos ($)', // <--- NUEVA LÍNEA
                        data: Object.values(last7DaysCosts),
                        borderColor: '#ef4444', // Rojo
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.3, fill: true,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#ef4444'
                    }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: { 
                    y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' }, beginAtZero: true }, 
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } } 
                }
            }
        });
    }

    function renderTopProducts(sales) {
        if (topProductsChartInstance) topProductsChartInstance.destroy();
        const counts = {};
        sales.forEach(s => { 
            if(s.items) s.items.forEach(i => { 
                if(i.type!=='meta') {
                    const qty = Number(i.cantidad || i.qty || 0);
                    counts[i.name] = (counts[i.name] || 0) + qty;
                }
            }); 
        });
        const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
        
        const ctx = document.getElementById('topProductsChart').getContext('2d');
        topProductsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sorted.map(i=>i[0]),
                datasets: [{ 
                    data: sorted.map(i=>i[1]), 
                    backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'], 
                    borderColor: 'var(--bg-card)', borderWidth: 2 
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { position:'right', labels: { color: '#94a3b8' } } } 
            }
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