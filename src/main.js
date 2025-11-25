// src/main.js - CÓDIGO CORREGIDO Y LIMPIO
import './css/global.css';
import './css/login.css'; 
import './css/pos.css'; 
import './css/admin.css'; 
import './css/shop.css'; 

import Navigo from 'navigo';
import { supabase } from './data/supabase.js';
import { ThemeService } from './services/theme.js';
import { SettingsService } from './services/settings.js';
import { PwaService } from './services/pwa.js'; // Importamos PWA
import { renderHistory, setupHistoryLogic } from './modules/admin/history.js'; // <--- NUEVO

// Módulos
import { renderLogin, setupLoginLogic } from './modules/auth/login.js';
import { renderPOS, setupPOSLogic } from './modules/pos/pos.js';
import { renderAdminInventory, setupInventoryLogic } from './modules/admin/inventory.js';
import { renderAdminOrders, setupOrdersLogic } from './modules/admin/orders.js'; 
import { renderShop, setupShopLogic } from './modules/shop/shop.js';
import { renderDashboard, setupDashboardLogic } from './modules/admin/dashboard.js';
import { renderAdminSettings, setupSettingsLogic } from './modules/admin/settings.js'; 

const router = new Navigo('/', { hash: true });
const app = document.querySelector('#app');
const setContent = (html) => { app.innerHTML = html; };

// --- INICIALIZACIÓN GLOBAL (UNA SOLA VEZ) ---
async function initApp() {
    console.log("Iniciando App...");
    ThemeService.init();          
    await SettingsService.init(); 
    PwaService.init(); // Iniciamos el servicio de instalación
}

// Ejecutamos
initApp();

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
        SettingsService.applyToDOM();
    })
    
    .on('/pos', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }
        setContent(renderPOS()); 
        setupPOSLogic(router); 
        SettingsService.applyToDOM();
    })
    
    .on('/admin', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }
        setContent(renderDashboard()); 
        setupDashboardLogic(router); 
        SettingsService.applyToDOM();
    })
    
    .on('/admin/inventory', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }
        setContent(renderAdminInventory()); 
        setupInventoryLogic(router); 
        SettingsService.applyToDOM();
    })
    
    .on('/admin/orders', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }
        setContent(renderAdminOrders()); 
        setupOrdersLogic(router); 
        SettingsService.applyToDOM();
    })

    .on('/admin/settings', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }
        setContent(renderAdminSettings()); 
        setupSettingsLogic(router); 
        SettingsService.applyToDOM();
    })
    .on('/admin/history', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }
        setContent(renderHistory());
        setupHistoryLogic(router);
        SettingsService.applyToDOM();
    })
    .resolve();