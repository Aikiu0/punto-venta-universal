// src/modules/admin/history.js
import { db } from '../../data/db-local.js';
import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';
import { SettingsService } from '../../services/settings.js';
import { PermissionService } from '../../services/permissions.js';
import { renderSidebarHeader } from './components/sidebarHeader.js';

// --- ESTILOS CSS (Optimizado para evitar duplicados) ---
const styles = `
<style id="history-styles">
    /* Transiciones globales para UI suave */
    .history-card, .history-header, .stat-box span, .detail-table th, .detail-table td, .product-list-item {
        transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
    }

    /* Tarjeta del Mes */
    .history-card {
        background: var(--bg-card);
        color: var(--text-primary);
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        margin-bottom: 15px;
        border: 1px solid var(--border-color);
        overflow: hidden;
    }
    .history-card:hover {
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }

    /* Encabezado Clickable */
    .history-header {
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        background: var(--bg-card);
        position: relative;
        z-index: 2;
    }
    .history-header:hover {
        background: var(--bg-input);
    }

    /* Estadísticas */
    .history-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        text-align: right;
    }
    .stat-box small { 
        display: block; 
        color: var(--text-secondary); 
        font-size: 0.75rem; 
        text-transform:uppercase; 
        font-weight:700; 
    }
    .stat-box span { 
        font-weight: 700; 
        color: var(--text-primary); 
        font-size: 1.1rem; 
    }
    
    /* Acordeón Fluido */
    .history-details {
        max-height: 0;
        opacity: 0;
        overflow: hidden;
        transition: max-height 0.5s ease-in-out, opacity 0.4s ease-in-out, background-color 0.3s ease;
        background: var(--bg-body);
        border-top: 1px solid var(--border-color);
    }
    
    .history-details.open {
        max-height: 2000px;
        opacity: 1;
    }

    /* Tabla de Detalles */
    .detail-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
    }
    .detail-table th { 
        padding: 12px 20px; 
        text-align: left; 
        color: var(--text-secondary); 
        border-bottom: 1px solid var(--border-color); 
        background: var(--bg-input); 
    }
    .detail-table td { 
        padding: 12px 20px; 
        border-bottom: 1px solid var(--border-color); 
        color: var(--text-primary); 
        vertical-align: top;
    }
    .detail-table tr:hover td {
        background: var(--bg-input);
    }
    
    /* Lista de productos detallada */
    .product-list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.85em;
        margin-bottom: 4px;
        border-bottom: 1px dashed var(--border-color);
        padding-bottom: 4px;
    }
    .product-list-item:last-child { border-bottom: none; margin-bottom: 0; }
    
    .item-price-info {
        color: var(--text-secondary);
        font-size: 0.9em;
    }
    .item-total-info {
        color: var(--text-primary);
        font-weight: 600;
        margin-left: 8px;
    }
    

    /* Badges */
    .badge-type { padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; }
    .badge-local { background: rgba(37, 99, 235, 0.1); color: #3b82f6; border: 1px solid rgba(37, 99, 235, 0.2); }
    .badge-web { background: rgba(219, 39, 119, 0.1); color: #ec4899; border: 1px solid rgba(219, 39, 119, 0.2); }

    /* Ajustes móviles */
    @media (max-width: 768px) {
        .history-stats { grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
        .history-header { flex-direction: column; align-items: flex-start; gap: 15px; }
        .stat-box { text-align: left; }
    }
</style>
`;

export function renderHistory() {
    const s = SettingsService.get();

    // 1. DEFINIMOS EL HEADER UNIFICADO (Con botón hamburguesa siempre presente)
    // Usamos este header tanto para carga parcial como total para evitar que el botón desaparezca.
    const headerHTML = `
        <header class="content-header">
            <div style="display:flex; align-items:center; gap:10px;">
                <button id="mobile-menu-btn" style="background:none; border:none; font-size:1.8rem; color:var(--text-primary); cursor:pointer;">☰</button>
                
                <div class="page-title">
                    <h1>Historial de Ventas</h1>
                    <p style="color:var(--text-secondary); font-size:0.9rem; margin:0;">Reporte detallado de movimientos</p>
                </div>
            </div>
            
            <div class="header-actions" style="display:flex; align-items:center; gap:10px;">
                 <span style="font-weight:bold; color:var(--text-primary); display:none; display:md-block;">${new Date().toLocaleDateString()}</span>
                 <button id="btn-toggle-theme" class="btn-icon" title="Cambiar Tema" style="background:var(--bg-card); border:1px solid var(--border-color); cursor:pointer; padding:8px; border-radius:8px; font-size:1.2rem; transition: all 0.3s ease;">🌓</button>
            </div>
        </header>
    `;

    const bodyHTML = `
        <div class="card-panel" style="background:transparent; padding:0; box-shadow:none; border:none;">
            <div id="history-loading" style="text-align:center; padding:50px; font-size:1.2rem; color:var(--text-secondary);">
                ⏳ Cargando historial...
            </div>
            <div id="history-container"></div>
        </div>
    `;

    // --- LÓGICA ANTI-SALTO (Navegación sin recarga) ---
    const existingContainer = document.querySelector('.admin-container');

    if (existingContainer) {
        // Inyectamos Header + Body en el contenido principal
        const mainContent = existingContainer.querySelector('.admin-content');
        if (mainContent) mainContent.innerHTML = headerHTML + bodyHTML;

        // Actualizamos menú activo
        existingContainer.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
        let navBtn = existingContainer.querySelector('#nav-history');
        if (!navBtn) {
            const buttons = existingContainer.querySelectorAll('.menu-item');
            navBtn = Array.from(buttons).find(b => b.textContent.includes('Historial'));
        }
        if (navBtn) navBtn.classList.add('active');

        if (!document.getElementById('history-styles')) {
            document.head.insertAdjacentHTML('beforeend', styles);
        }

        return existingContainer.parentNode.innerHTML;
    }

    // --- RENDERIZADO COMPLETO (Recarga de página) ---
    const canOrders = (PermissionService && PermissionService.can) ? PermissionService.can('web_orders') : true;
    const lockOrders = canOrders ? '' : '🔒 ';
    const lockSuppliers = PermissionService.can('suppliers') ? '' : '🔒 ';

    return `
        ${styles}
        <div class="admin-container">
            <div class="sidebar-overlay" id="sidebar-overlay"></div>

            <aside class="admin-sidebar" id="admin-sidebar">
                ${renderSidebarHeader()} 
                <nav class="sidebar-menu" id="sidebar-menu-nav">
                    <button class="menu-item" id="nav-dash"> Dashboard</button>
                    <button class="menu-item" id="nav-orders" onclick="return window.checkPlan(event, 'web_orders')">
                        ${lockOrders} Pedidos Web
                    </button>
                    <button class="menu-item" id="nav-inventory"> Inventario</button>
                    <button class="menu-item" id="nav-pos"> Ir a Caja</button>
                    <button class="menu-item" id="nav-suppliers" onclick="return window.checkPlan(event, 'suppliers')">${lockSuppliers} Proveedores</button>
                    <button class="menu-item active" id="nav-history"> Historial</button>
                    <button class="menu-item" id="nav-settings"> Configuración</button>
                    <div style="flex:1"></div>
                    <button class="menu-item logout" id="nav-logout"> Salir</button>
                </nav>
            </aside>

            <main class="admin-content">
                ${headerHTML}
                ${bodyHTML}
            </main>
        </div>
    `;
}
export function setupHistoryLogic(router) {
    const navTo = (p) => router.navigate(p);

    // --- 1. LÓGICA DEL MENÚ HAMBURGUESA (NUEVO) ---
    setTimeout(() => {
        const menuBtn = document.getElementById('mobile-menu-btn');
        // Buscamos el sidebar por ID, o por clase si ya existía de antes
        const sidebar = document.getElementById('admin-sidebar') || document.querySelector('.admin-sidebar');
        const overlay = document.getElementById('sidebar-overlay') || document.querySelector('.sidebar-overlay');

        function toggleMenu(show) {
            if(!sidebar) return;
            if (show) {
                sidebar.classList.add('active');
                if(overlay) overlay.classList.add('active');
            } else {
                sidebar.classList.remove('active');
                if(overlay) overlay.classList.remove('active');
            }
        }

        if (menuBtn) {
            // Clonamos para eliminar listeners previos (evita doble toggle)
            const newBtn = menuBtn.cloneNode(true);
            menuBtn.parentNode.replaceChild(newBtn, menuBtn);
            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleMenu(true);
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => toggleMenu(false));
        }
    }, 100);
    
    
    // --- 2. LISTENERS DEL SIDEBAR ---
    const sidebarNav = document.getElementById('sidebar-menu-nav') || document.querySelector('.sidebar-menu');
    
    if (sidebarNav && sidebarNav.dataset.listenersAttached !== 'true') {
        const bindSmart = (id, textMatch, path) => {
            let el = document.getElementById(id);
            if (!el && textMatch) {
                const buttons = sidebarNav.querySelectorAll('.menu-item');
                el = Array.from(buttons).find(b => b.textContent.includes(textMatch));
            }
            if (el) {
                el.onclick = (e) => {
                    e.preventDefault(); 
                    navTo(path);
                };
            }
        };

        bindSmart('nav-dash', 'Dashboard', '/admin'); 
        bindSmart('nav-orders', 'Pedidos', '/admin/orders');
        bindSmart('nav-inventory', 'Inventario', '/admin/inventory');
        bindSmart('nav-pos', 'Caja', '/pos');
        bindSmart('nav-settings', 'Configuración', '/admin/settings');
        bindSmart('nav-suppliers', 'Proveedores', '/admin/suppliers');
        
        const logoutBtn = document.getElementById('nav-logout') || sidebarNav.querySelector('.logout');
        if(logoutBtn) logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); router.navigate('/'); });

        sidebarNav.dataset.listenersAttached = 'true';
    }

    // 3. BOTÓN DE MODO OSCURO
    const btnTheme = document.getElementById('btn-toggle-theme');
    if(btnTheme) {
        btnTheme.addEventListener('click', () => ThemeService.toggle());
    }
    
    // 4. Cargar Datos
    loadHistory();
}

async function loadHistory() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return;

        let businessId = null;
        let { data: uData } = await supabase.from('users').select('business_id').eq('id', user.id).single();
        if(!uData) {
            const { data: pData } = await supabase.from('profiles').select('business_id').eq('id', user.id).single();
            uData = pData;
        }
        if(uData) businessId = uData.business_id;

        // --- CARGA DE DATOS ---
        const localSales = await db.sales.toArray();
        const localProducts = await db.products.toArray(); 

        // Mapa de Costos de Respaldo
        const costMap = new Map();
        localProducts.forEach(p => {
            const c = Number(p.cost_price || p.cost || 0);
            if (!isNaN(c)) {
                if (p.id) costMap.set(String(p.id), c);
                if (p.name) costMap.set(`name:${p.name}`, c);
            }
        });

        let webOrders = [];
        if (businessId) {
            const { data } = await supabase.from('orders').select('*').eq('business_id', businessId).neq('status', 'cancelled');
            if (data) webOrders = data;
        }

        // --- LÓGICA DE CONTABILIDAD ---
        const calculateTotalCost = (items) => {
            if (!items || !Array.isArray(items)) return 0;
            return items.reduce((acc, item) => {
                if (item.type === 'meta') return acc;
                const cantidad = Number(item.cantidad || item.qty || item.quantity || 1);
                
                let costoUnitario = 0;
                // 1. Costo histórico
                if (item.historical_cost !== undefined && item.historical_cost !== null) {
                    costoUnitario = Number(item.historical_cost);
                } 
                // 2. Propiedades legacy
                else if (item.cost || item.costo) {
                    costoUnitario = Number(item.cost || item.costo);
                }
                // 3. Catálogo actual por ID
                else if (item.id && costMap.has(String(item.id))) {
                    costoUnitario = costMap.get(String(item.id));
                }
                // 4. Buscar por nombre
                else {
                    costoUnitario = costMap.get(`name:${item.name}`) || 0;
                }

                return acc + (cantidad * costoUnitario);
            }, 0);
        };

        const allSales = [
            ...localSales.map(s => {
                const totalCostoVenta = calculateTotalCost(s.items);
                return { 
                    ...s, 
                    origin: 'local', 
                    dateObj: new Date(s.date || s.timestamp), 
                    profitCalc: (s.total || 0) - totalCostoVenta, 
                    itemsList: s.items || [] 
                };
            }),
            ...webOrders.map(o => {
                const items = o.items || o.cart || [];
                const totalCostoVenta = calculateTotalCost(items);
                
                return { 
                    ...o, 
                    origin: 'web', 
                    dateObj: new Date(o.created_at), 
                    profitCalc: (o.total || 0) - totalCostoVenta, 
                    itemsList: items
                };
            })
        ];

        const report = {};
        allSales.forEach(sale => {
            if (!sale.total) return;
            const key = `${sale.dateObj.getFullYear()}-${sale.dateObj.getMonth()}`;
            if (!report[key]) {
                const monthName = sale.dateObj.toLocaleString('es-MX', { month: 'long', year: 'numeric' });
                report[key] = {
                    name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                    count: 0, 
                    total: 0, 
                    cost: 0, 
                    profit: 0, 
                    transactions: []
                };
            }
            report[key].count += 1;
            report[key].total += Number(sale.total);
            report[key].profit += Number(sale.profitCalc || 0);
            report[key].transactions.push(sale);
        });

        renderHistoryUI(report);

    } catch (e) {
        console.error("Error en historial:", e);
        const loadDiv = document.getElementById('history-loading');
        if(loadDiv) loadDiv.innerHTML = 'Error al cargar historial (DB Bloqueada). Intenta recargar.';
    }
}

function renderHistoryUI(report) {
    const container = document.getElementById('history-container');
    const loading = document.getElementById('history-loading');
    if(loading) loading.style.display = 'none';
    if(!container) return;

    container.innerHTML = '';
    
    const sortedKeys = Object.keys(report).sort((a,b) => {
        const [yA, mA] = a.split('-');
        const [yB, mB] = b.split('-');
        return new Date(yB, mB) - new Date(yA, mA);
    });

    if (sortedKeys.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary);">No hay registros de ventas.</div>`;
        return;
    }

    const fmtMoney = (n) => n.toLocaleString('es-MX', { style:'currency', currency:'MXN' });

    sortedKeys.forEach(key => {
        const data = report[key];
        data.transactions.sort((a,b) => b.dateObj - a.dateObj);

        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
            <div class="history-header" onclick="toggleDetails('${key}')">
                <div style="flex:1">
                    <h3 style="margin:0; font-size:1.2rem; display:flex; align-items:center; gap:10px; color:var(--text-primary);">
                        ${data.name} 
                        <span id="arrow-${key}" style="font-size:0.75rem; background:var(--bg-input); padding:4px 10px; border-radius:12px; color:var(--text-secondary); border:1px solid var(--border-color); transition: transform 0.3s ease;">
                            ▼
                        </span>
                    </h3>
                </div>
                <div class="history-stats">
                    <div class="stat-box"><small>Ventas</small><span>${data.count}</span></div>
                    <div class="stat-box"><small>Ingreso</small><span style="color:#3b82f6;">${fmtMoney(data.total)}</span></div>
                    <div class="stat-box"><small>Ganancia</small><span style="color:#10b981;">${fmtMoney(data.profit)}</span></div>
                </div>
            </div>

            <div id="details-${key}" class="history-details">
                <div style="overflow-x:auto;">
                    <table class="detail-table" style="min-width: 600px;"> <thead>
                            <tr>
                                <th style="width:15%">Fecha</th>
                                <th style="width:10%">Origen</th>
                                <th style="width:55%">Desglose de Productos</th>
                                <th style="width:20%; text-align:right">Total Venta</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.transactions.map(t => {
                                let itemsHtml = '';
                                if (t.itemsList && t.itemsList.length > 0) {
                                    itemsHtml = t.itemsList.map(i => {
                                        if(i.type === 'meta') return '';
                                        const qty = i.cantidad || i.qty || 1; 
                                        const price = i.price || 0;
                                        const subTotal = qty * price;
                                        
                                        return `
                                        <div class="product-list-item">
                                            <span style="font-weight:500;">
                                                ${qty}x ${i.name || i.product_name || 'Producto'}
                                            </span>
                                            <span>
                                                <span class="item-price-info">($${price.toFixed(2)})</span>
                                                <span class="item-total-info">⮕ $${subTotal.toFixed(2)}</span>
                                            </span>
                                        </div>
                                        `;
                                    }).join('');
                                } else {
                                    itemsHtml = '<span style="color:var(--text-secondary); font-style:italic;">Sin detalles de productos</span>';
                                }

                                return `
                                <tr>
                                    <td>
                                        <div style="font-weight:bold;">${t.dateObj.toLocaleDateString()}</div>
                                        <div style="font-size:0.8em; color:var(--text-secondary);">${t.dateObj.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                    </td>
                                    <td>
                                        <span class="badge-type ${t.origin === 'local' ? 'badge-local' : 'badge-web'}">
                                            ${t.origin === 'local' ? 'CAJA' : 'WEB'}
                                        </span>
                                    </td>
                                    <td>
                                        ${itemsHtml}
                                        ${t.customer_name ? `<div style="margin-top:4px; font-size:0.8em; color:var(--text-primary); font-weight:bold; border-top:1px dotted var(--border-color); padding-top:2px;">👤 ${t.customer_name}</div>` : ''}
                                    </td>
                                    <td style="text-align:right; font-weight:bold; color:var(--text-primary); font-size:1.1em;">
                                        ${fmtMoney(t.total)}
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div> <div style="text-align:center; padding:15px; font-size:0.8rem; color:var(--text-secondary);">
                    Fin de registros de ${data.name}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Función global para el toggle fluido
window.toggleDetails = function(key) {
    const el = document.getElementById(`details-${key}`);
    const arrow = document.getElementById(`arrow-${key}`);
    
    if (el) {
        if (el.classList.contains('open')) {
            el.classList.remove('open');
            if(arrow) arrow.style.transform = "rotate(0deg)";
        } else {
            el.classList.add('open');
            if(arrow) arrow.style.transform = "rotate(180deg)";
        }
    }
};