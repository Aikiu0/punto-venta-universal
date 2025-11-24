// src/main.js - VERSIÓN FINAL (INTEGRANDO DASHBOARD GRÁFICO)
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
import { renderDashboard, setupDashboardLogic } from './modules/admin/dashboard.js'; // <--- NUEVO IMPORT

const router = new Navigo('/', { hash: true });
const app = document.querySelector('#app');
const setContent = (html) => { app.innerHTML = html; };

// --- RUTAS ---

router
    // 1. RAÍZ (Login o Redirección)
    .on('/', () => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                // Si ya hay sesión, ir al POS por defecto (o al Admin si prefieres)
                router.navigate('/pos');
            } else {
                setContent(renderLogin());
                setupLoginLogic(router);
            }
        });
    })

    // 2. TIENDA ONLINE (PÚBLICA)
    .on('/shop', () => {
        setContent(renderShop());
        setupShopLogic(router);
    })

    // 3. POS (Punto de Venta - Protegido)
    .on('/pos', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }
        
        setContent(renderPOS());
        setupPOSLogic(router);
    })

    // 4. ADMIN DASHBOARD (Protegido - MÓDULO GRÁFICO)
    .on('/admin', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }

        // Ahora usamos el módulo externo dashboard.js en lugar de HTML directo
        setContent(renderDashboard());
        setupDashboardLogic(router);
    })

    // 5. ADMIN INVENTARIO
    .on('/admin/inventory', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }

        setContent(renderAdminInventory());
        setupInventoryLogic(router);
    })

    // 6. ADMIN PEDIDOS WEB
    .on('/admin/orders', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }

        setContent(renderAdminOrders());
        setupOrdersLogic(router);
    })

    .resolve();