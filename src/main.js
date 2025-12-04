// src/main.js
import './css/global.css';
import './css/login.css';
import './css/pos.css';
import './css/admin.css';
import './css/shop.css';
import './services/permissions.js';
import Navigo from 'navigo';
import { supabase } from './data/supabase.js';
import { ThemeService } from './services/theme.js';
import { SettingsService } from './services/settings.js';
import { PwaService } from './services/pwa.js';
import { renderHistory, setupHistoryLogic } from './modules/admin/history.js';
import { renderLogin, setupLoginLogic } from './modules/auth/login.js'; // Importado
import { renderPOS, setupPOSLogic } from './modules/pos/pos.js';
import { renderAdminInventory, setupInventoryLogic } from './modules/admin/inventory.js';
import { renderAdminOrders, setupOrdersLogic } from './modules/admin/orders.js';
import { renderShop, setupShopLogic } from './modules/shop/shop.js';
import { renderDashboard, setupDashboardLogic } from './modules/admin/dashboard.js';
import { renderAdminSettings, setupSettingsLogic } from './modules/admin/settings.js';
import { renderSuppliers, setupSuppliersLogic } from './modules/admin/suppliers.js';
import { renderAdminBilling, setupBillingLogic } from './modules/admin/billing.js';
const router = new Navigo('/', { hash: true });
const app = document.querySelector('#app');
const setContent = (html) => { app.innerHTML = html; };

// --- INICIALIZACIÓN GLOBAL ---
async function initApp() {
    console.log("Iniciando App...");
    try {
        ThemeService.init();
        // Usamos try-catch aquí para que si falla la DB, la app no muera totalmente
        await SettingsService.init(); 
    } catch (error) {
        console.error("Error inicializando servicios locales:", error);
    }
    PwaService.init();
}

// Ejecutamos inicialización
initApp();

// --- RUTAS ---
router
    // 1. RUTA RAÍZ (LOGIN) - Faltaba esto
    .on('/', () => {
        // Si ya hay sesión, podrías redirigir a /admin o /pos automáticamente
        setContent(renderLogin());
        setupLoginLogic(router);
    })

    .on('/admin/suppliers', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.navigate('/'); return; }
    setContent(renderSuppliers()); setupSuppliersLogic(router);
})
.on('/admin/billing', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.navigate('/'); return; }
    setContent(renderAdminBilling()); setupBillingLogic(router);
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