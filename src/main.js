// src/main.js - VERSIÓN CON WIDGETS ACTIVOS Y REALTIME
import './css/global.css';
import './css/login.css';
import './css/pos.css'; 
import './css/admin.css'; 
import './css/shop.css'; 

import Navigo from 'navigo';
import { supabase } from './data/supabase.js';

// Módulos
import { renderLogin, setupLoginLogic } from './modules/auth/login.js';
import { renderPOS, setupPOSLogic } from './modules/pos/pos.js';
import { renderAdminInventory, setupInventoryLogic } from './modules/admin/inventory.js';
import { renderAdminOrders, setupOrdersLogic } from './modules/admin/orders.js'; 
import { renderShop, setupShopLogic } from './modules/shop/shop.js';

const router = new Navigo('/', { hash: true });
const app = document.querySelector('#app');
const setContent = (html) => { app.innerHTML = html; };

// --- RUTAS ---

router
    .on('/', () => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) router.navigate('/pos');
            else { setContent(renderLogin()); setupLoginLogic(router); }
        });
    })

    .on('/shop', () => {
        setContent(renderShop());
        setupShopLogic(router);
    })

    .on('/pos', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }
        setContent(renderPOS());
        setupPOSLogic(router);
    })

    .on('/admin', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }

        // 1. Renderizar Dashboard
        setContent(`
            <div class="admin-container">
                <aside class="admin-sidebar">
                    <div class="sidebar-logo">🚀 Mi Negocio</div>
                    <nav class="sidebar-menu">
                        <button class="menu-item active">📊 Dashboard</button>
                        <button class="menu-item" id="nav-orders">🔔 Pedidos Web</button>
                        <button class="menu-item" id="nav-inventory">📦 Inventario</button>
                        <button class="menu-item" id="nav-pos">🛒 Ir a Caja (POS)</button>
                        <button class="menu-item logout" id="nav-logout">🚪 Cerrar Sesión</button>
                    </nav>
                </aside>

                <main class="admin-content">
                    <header class="content-header">
                        <div class="page-title">
                            <h1>Resumen General</h1>
                            <p>Bienvenido al centro de mando.</p>
                        </div>
                        <div style="background:white; padding:8px 15px; border-radius:20px; font-size:0.9rem; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                            👤 Administrador
                        </div>
                    </header>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:20px;">
                        
                        <div class="card-panel" style="border-left: 4px solid #7A3F9D;">
                            <h3 style="color:#64748b; font-size:0.9rem; margin:0;">Ventas del Día</h3>
                            <p style="font-size:2rem; font-weight:bold; color:#1e293b; margin:10px 0;">--</p>
                            <small style="color:#64748b;">Ver detalles</small>
                        </div>

                        <div class="card-panel" style="border-left: 4px solid #f59e0b; cursor:pointer;" id="widget-orders">
                            <h3 style="color:#64748b; font-size:0.9rem; margin:0;">Pedidos Pendientes</h3>
                            <p id="dash-orders-count" style="font-size:2rem; font-weight:bold; color:#1e293b; margin:10px 0;">0</p>
                            <small style="color:#f59e0b; font-weight:bold;">Ir a la bandeja ➔</small>
                        </div>

                        <div class="card-panel" style="border-left: 4px solid #3b82f6; cursor:pointer;" id="widget-inventory">
                            <h3 style="color:#64748b; font-size:0.9rem; margin:0;">Productos</h3>
                            <p style="font-size:2rem; font-weight:bold; color:#1e293b; margin:10px 0;">Gestionar</p>
                            <small style="color:#3b82f6; font-weight:bold;">Ver catálogo ➔</small>
                        </div>
                    </div>
                </main>
            </div>
        `);
        
        // 2. Listeners de Navegación
        const navTo = (path) => router.navigate(path);

        document.getElementById('nav-inventory').addEventListener('click', () => navTo('/admin/inventory'));
        document.getElementById('nav-orders').addEventListener('click', () => navTo('/admin/orders'));
        document.getElementById('nav-pos').addEventListener('click', () => navTo('/pos'));
        
        // Widgets (Clicks en las tarjetas completas)
        document.getElementById('widget-orders').addEventListener('click', () => navTo('/admin/orders'));
        document.getElementById('widget-inventory').addEventListener('click', () => navTo('/admin/inventory')); // <--- ARREGLADO

        document.getElementById('nav-logout').addEventListener('click', async () => {
            await supabase.auth.signOut();
            router.navigate('/');
        });

        // 3. Mini-Lógica Realtime para el contador del Dashboard
        async function updateCount() {
            const { count } = await supabase.from('web_orders').select('*', { count: 'exact', head: true }).eq('status', 'pendiente');
            document.getElementById('dash-orders-count').textContent = count || 0;
        }
        updateCount();

        // Suscribirse a cambios solo para actualizar el numerito
        const channel = supabase.channel('dash-counter')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'web_orders' }, () => {
                updateCount();
            })
            .subscribe();
    })

    .on('/admin/inventory', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }
        setContent(renderAdminInventory());
        setupInventoryLogic(router);
    })

    .on('/admin/orders', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }
        setContent(renderAdminOrders());
        setupOrdersLogic(router);
    })

    .resolve();