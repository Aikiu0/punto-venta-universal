// src/modules/admin/history.js - OPTIMIZADO
import { db } from '../../data/db-local.js';
import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';
import { SettingsService } from '../../services/settings.js';

export function renderHistory() {
    const s = SettingsService.get();
    return `
        <div class="admin-container">
            <aside class="admin-sidebar">
                <div class="sidebar-logo" style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                    <img src="${s.logo_url}" class="app-logo-img" style="width:40px; height:40px; object-fit:contain; display:${s.logo_url?'block':'none'}">
                    <span class="app-name">${s.store_name}</span>
                </div>
                <nav class="sidebar-menu">
                    <button class="menu-item" id="nav-dash">📊 Dashboard</button>
                    <button class="menu-item" id="nav-orders">🔔 Pedidos Web</button>
                    <button class="menu-item" id="nav-inventory">📦 Inventario</button>
                    <button class="menu-item" id="nav-pos">🛒 Ir a Caja</button>
                    <button class="menu-item active">📅 Historial</button>
                    <button class="menu-item" id="nav-settings">⚙️ Configuración</button>
                    <button class="menu-item logout" id="nav-logout">🚪 Salir</button>
                </nav>
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div class="page-title">
                        <h1>Historial de Ventas</h1>
                        <p>Reporte de ingresos y utilidades.</p>
                    </div>
                    <button id="theme-toggle-hist" class="icon-btn" style="background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); width:40px; height:40px; border-radius:8px; cursor:pointer;">🌗</button>
                </header>

                <div class="card-panel">
                    <div style="overflow-x:auto;">
                        <table class="modern-table">
                            <thead>
                                <tr>
                                    <th>Mes / Año</th>
                                    <th>Transacciones</th>
                                    <th>Venta Total</th>
                                    <th>Costo Aprox.</th>
                                    <th>Utilidad</th>
                                </tr>
                            </thead>
                            <tbody id="history-body">
                                <tr><td colspan="5" style="text-align:center; padding:30px;">⏳ Cargando datos...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    `;
}

export async function setupHistoryLogic(router) {
    const navTo = (p) => router.navigate(p);
    document.getElementById('nav-dash').addEventListener('click', () => navTo('/admin'));
    document.getElementById('nav-orders').addEventListener('click', () => navTo('/admin/orders'));
    document.getElementById('nav-inventory').addEventListener('click', () => navTo('/admin/inventory'));
    document.getElementById('nav-pos').addEventListener('click', () => navTo('/pos'));
    document.getElementById('nav-settings').addEventListener('click', () => navTo('/admin/settings'));
    document.getElementById('nav-logout').addEventListener('click', async () => { await supabase.auth.signOut(); router.navigate('/'); });
    document.getElementById('theme-toggle-hist').addEventListener('click', () => ThemeService.toggle());

    // --- OPTIMIZACIÓN: CÁLCULO DIFERIDO ---
    // Usamos setTimeout para liberar la interfaz gráfica primero
    setTimeout(() => {
        generateReport();
    }, 100);

    async function generateReport() {
        try {
            const sales = await db.sales.toArray();
            const products = await db.products.toArray();
            
            const costMap = {};
            products.forEach(p => costMap[p.name] = Number(p.cost_price || 0));

            const report = {};

            sales.forEach(sale => {
                const date = new Date(sale.date || sale.created_at);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const monthName = date.toLocaleString('es-MX', { month: 'long', year: 'numeric' });

                if (!report[key]) report[key] = { name: monthName, count: 0, total: 0, cost: 0, profit: 0 };

                const saleTotal = Number(sale.total || 0);
                report[key].count += 1;
                report[key].total += saleTotal;

                let saleCost = 0;
                if (sale.items) {
                    sale.items.forEach(item => {
                        if (item.type === 'meta') return;
                        const qty = Number(item.cantidad || item.qty || 0);
                        const unitCost = (item.cost_price !== undefined) ? Number(item.cost_price) : (costMap[item.name] || 0);
                        saleCost += (unitCost * qty);
                    });
                }
                report[key].cost += saleCost;
                report[key].profit += (saleTotal - saleCost);
            });

            const sortedKeys = Object.keys(report).sort().reverse().slice(0, 12);
            const tbody = document.getElementById('history-body');
            tbody.innerHTML = '';

            if (sortedKeys.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">No hay ventas registradas.</td></tr>`;
                return;
            }

            sortedKeys.forEach(key => {
                const row = report[key];
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="text-transform:capitalize; font-weight:bold;">${row.name}</td>
                    <td>${row.count}</td>
                    <td style="color:var(--text-primary); font-weight:bold;">$${row.total.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                    <td style="color:var(--text-secondary);">$${row.cost.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                    <td style="color:var(--success-bg); font-weight:800;">$${row.profit.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error("Error en reporte:", e);
        }
    }
}