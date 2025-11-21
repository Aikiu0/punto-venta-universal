// src/main.js - VERSIÓN DÍA 6 (INCLUYE GESTIÓN DE INVENTARIO)
import './css/global.css';
import './css/login.css';
import './css/pos.css'; 
import './css/admin.css'; // <--- NUEVO: Estilos del administrador

import Navigo from 'navigo';
import { supabase } from './data/supabase.js';

// Importamos los módulos
import { renderLogin, setupLoginLogic } from './modules/auth/login.js';
import { renderPOS, setupPOSLogic } from './modules/pos/pos.js';
import { renderAdminInventory, setupInventoryLogic } from './modules/admin/inventory.js'; // <--- NUEVO: Módulo de Inventario

const router = new Navigo('/', { hash: true });
const app = document.querySelector('#app');

// Función auxiliar para pintar en pantalla
const setContent = (html) => { app.innerHTML = html; };

// --- DEFINICIÓN DE RUTAS ---

router
    // 1. RUTA RAÍZ (Login o Redirección)
    .on('/', () => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                // Si hay sesión, mandamos al POS por defecto (o podrías mandarlo a /admin)
                router.navigate('/pos');
            } else {
                setContent(renderLogin());
                setupLoginLogic(router);
            }
        });
    })

    // 2. RUTA POS (Punto de Venta - Empleado)
    .on('/pos', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }
        
        setContent(renderPOS());
        setupPOSLogic(router);
    })

    // 3. RUTA ADMIN (Dashboard Principal - Jefe)
    .on('/admin', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }

        setContent(`
            <div class="admin-container">
                <aside class="admin-sidebar">
                    <div class="sidebar-logo">🚀 Mi Negocio</div>
                    <nav class="sidebar-menu">
                        <button class="menu-item active">📊 Dashboard</button>
                        <button class="menu-item" id="nav-inventory">📦 Inventario</button>
                        <button class="menu-item" id="nav-pos">🛒 Ir a Caja (POS)</button>
                        <button class="menu-item logout" id="nav-logout">🚪 Cerrar Sesión</button>
                    </nav>
                </aside>

                <main class="admin-content">
                    <header class="content-header">
                        <div class="page-title">
                            <h1>Resumen General</h1>
                            <p>Bienvenido de nuevo, Jefe.</p>
                        </div>
                        <div style="background:white; padding:8px 15px; border-radius:20px; font-size:0.9rem; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                            👤 Admin Activo
                        </div>
                    </header>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:20px;">
                        <div class="card-panel" style="border-left: 4px solid #7A3F9D;">
                            <h3 style="color:#64748b; font-size:0.9rem;">Ventas Hoy</h3>
                            <p style="font-size:2rem; font-weight:bold; color:#1e293b; margin:10px 0;">$0.00</p>
                            <small style="color:#10b981;">Próximamente (Día 8)</small>
                        </div>
                        <div class="card-panel" style="border-left: 4px solid #3b82f6;">
                            <h3 style="color:#64748b; font-size:0.9rem;">Productos</h3>
                            <p style="font-size:2rem; font-weight:bold; color:#1e293b; margin:10px 0;">--</p>
                            <small style="color:#3b82f6;">Ver inventario</small>
                        </div>
                    </div>
                </main>
            </div>
        `);

        // Listeners del Menú
        document.getElementById('nav-inventory').addEventListener('click', () => router.navigate('/admin/inventory'));
        document.getElementById('nav-pos').addEventListener('click', () => router.navigate('/pos'));
        document.getElementById('nav-logout').addEventListener('click', async () => {
            await supabase.auth.signOut();
            router.navigate('/');
        });
    })

    // 4. RUTA INVENTARIO (Gestión de Productos - Jefe) <--- NUEVA RUTA COMPLETA
    .on('/admin/inventory', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }

        setContent(renderAdminInventory());
        setupInventoryLogic(router);
    })

    .resolve();