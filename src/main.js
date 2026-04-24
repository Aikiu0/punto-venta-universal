// src/main.js
// ── VERSIÓN ACTUALIZADA CON MULTISUCURSAL ──
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
import { renderLogin, setupLoginLogic } from './modules/auth/login.js';
import { renderPOS, setupPOSLogic } from './modules/pos/pos.js';
import { renderAdminInventory, setupInventoryLogic } from './modules/admin/inventory.js';
import { renderAdminOrders, setupOrdersLogic } from './modules/admin/orders.js';
import { renderShop, setupShopLogic } from './modules/shop/shop.js';
import { renderDashboard, setupDashboardLogic } from './modules/admin/dashboard.js';
import { renderAdminSettings, setupSettingsLogic } from './modules/admin/settings.js';
import { renderSuppliers, setupSuppliersLogic } from './modules/admin/suppliers.js';
import { renderAdminBilling, setupBillingLogic } from './modules/admin/billing.js';
import { hasValidAccess } from './services/subscription.js';
import { renderResetPassword, setupResetPasswordLogic } from './modules/auth/reset-password.js';

// ── NUEVAS IMPORTACIONES MULTISUCURSAL ──────────────────────────
import { renderBranches, setupBranchesLogic } from './modules/admin/branches.js';
import { renderTransfers, setupTransfersLogic } from './modules/admin/transfers.js';
// ────────────────────────────────────────────────────────────────

const router = new Navigo('/', { hash: true });
const app = document.querySelector('#app');
const setContent = (html) => { app.innerHTML = html; };

// ── INICIALIZACIÓN GLOBAL ────────────────────────────────────────
async function initApp() {
    console.log("Iniciando App...");
    try {
        ThemeService.init();
        await SettingsService.init();
    } catch (error) {
        console.error("Error inicializando servicios locales:", error);
    }
    PwaService.init();
}
initApp();

// ── GUARDIA DE RUTAS Y SUSCRIPCIÓN ──────────────────────────────
async function requireAuthAndActiveSubscription(router, renderCallback) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        router.navigate('/');
        return;
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
            business_id,
            businesses (
                subscription_status,
                current_period_end
            )
        `)
        .eq('id', session.user.id)
        .single();

    console.log("🔍 Datos de Supabase:", profile);

    if (error || !profile || !profile.businesses) {
        console.error("Error obteniendo estado de suscripción:", error);
        router.navigate('/');
        return;
    }

    const tieneAcceso = hasValidAccess(profile.businesses);
    console.log("🛡️ ¿Tiene Acceso Válido?:", tieneAcceso);

    if (!tieneAcceso) {
        console.log("🚫 BLOQUEADO: Redirigiendo a /suspended...");
        router.navigate('/suspended');
        return;
    }

    console.log("✅ PERMITIDO: Renderizando vista...");
    renderCallback();
}

// ── GUARDIA EXTRA: SOLO OWNERS/ADMINS ────────────────────────────
// Úsala en las rutas de sucursales y traspasos para que
// un cajero no pueda acceder directamente por URL.
async function requireOwnerOrAdmin(router, renderCallback) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.navigate('/'); return; }

    const role = localStorage.getItem('archsell_branch_role') || 'cashier';
    const isOwnerOrAdmin = ['owner', 'branch_admin'].includes(role);

    if (!isOwnerOrAdmin) {
        // Cajeros van directo al POS
        router.navigate('/pos');
        return;
    }

    requireAuthAndActiveSubscription(router, renderCallback);
}

// ── EVENTOS DE AUTH ──────────────────────────────────────────────
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
        router.navigate('/reset-password');
    }
});

if (window.location.hash.includes('access_token')) {
    console.log("Token de Supabase detectado en la URL.");
    if (window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery')) {
        setTimeout(() => { router.navigate('/reset-password'); }, 800);
    }
}

// ── RUTAS ────────────────────────────────────────────────────────
router
    // 1. RUTA RAÍZ (LOGIN)
    .on('/', () => {
        setContent(renderLogin());
        setupLoginLogic(router);
    })

    .on('/reset-password', () => {
        const app = document.getElementById('app');
        app.innerHTML = renderResetPassword();
        setupResetPasswordLogic(router);
    })

    // 2. SUSPENSIÓN
    .on('/suspended', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }

        setContent(`
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                height:100vh;text-align:center;font-family:system-ui,sans-serif;padding:20px;background-color:#f9fafb;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#d32f2f"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:20px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h1 style="color:#111827;margin-bottom:10px;">Acceso Suspendido</h1>
                <p style="color:#4b5563;max-width:400px;margin-bottom:30px;">
                    El acceso a tu sistema ArchSell POS ha sido pausado.
                    Por favor, comunícate con el administrador para regularizar tu cuenta.
                </p>
                <button id="logout-suspended-btn"
                    style="padding:10px 24px;cursor:pointer;background:#7A3F9D;color:white;
                    border:none;border-radius:6px;font-weight:bold;font-size:16px;">
                    Cerrar Sesión
                </button>
            </div>
        `);
        document.getElementById('logout-suspended-btn').addEventListener('click', async () => {
            await supabase.auth.signOut();
            router.navigate('/');
        });
    })

    // 3. TIENDA PÚBLICA
    .on('/shop', () => {
        setContent(renderShop());
        setupShopLogic(router);
        SettingsService.applyToDOM();
    })

    // 4. BILLING (solo sesión)
    .on('/admin/billing', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.navigate('/'); return; }
        setContent(renderAdminBilling());
        setupBillingLogic(router);
    })

    // ──────────────────────────────────────────────────────────
    // 5. RUTAS PROTEGIDAS (Sesión + Suscripción activa)
    // ──────────────────────────────────────────────────────────

    .on('/pos', () => {
        requireAuthAndActiveSubscription(router, () => {
            setContent(renderPOS());
            setupPOSLogic(router);
            SettingsService.applyToDOM();
        });
    })

    .on('/admin', () => {
        requireAuthAndActiveSubscription(router, () => {
            setContent(renderDashboard());
            setupDashboardLogic(router);
            SettingsService.applyToDOM();
        });
    })

    .on('/admin/inventory', () => {
        requireAuthAndActiveSubscription(router, () => {
            setContent(renderAdminInventory());
            setupInventoryLogic(router);
            SettingsService.applyToDOM();
        });
    })

    .on('/admin/orders', () => {
        requireAuthAndActiveSubscription(router, () => {
            setContent(renderAdminOrders());
            setupOrdersLogic(router);
            SettingsService.applyToDOM();
        });
    })

    .on('/admin/settings', () => {
        requireAuthAndActiveSubscription(router, () => {
            setContent(renderAdminSettings());
            setupSettingsLogic(router);
            SettingsService.applyToDOM();
        });
    })

    .on('/admin/history', () => {
        requireAuthAndActiveSubscription(router, () => {
            setContent(renderHistory());
            setupHistoryLogic(router);
            SettingsService.applyToDOM();
        });
    })

    .on('/admin/suppliers', () => {
        requireAuthAndActiveSubscription(router, () => {
            setContent(renderSuppliers());
            setupSuppliersLogic(router);
        });
    })

    // ──────────────────────────────────────────────────────────
    // 6. RUTAS MULTISUCURSAL (Sesión + Suscripción + Owner/Admin)
    // ──────────────────────────────────────────────────────────

    .on('/admin/branches', () => {
        requireOwnerOrAdmin(router, () => {
            setContent(renderBranches());
            setupBranchesLogic(router);
            SettingsService.applyToDOM();
        });
    })

    .on('/admin/transfers', () => {
        requireAuthAndActiveSubscription(router, () => {
            // transfers es accesible para cualquier rol:
            // los cajeros solo ven los de su sucursal
            setContent(renderTransfers());
            setupTransfersLogic(router);
            SettingsService.applyToDOM();
        });
    })

    // ── Resolver rutas ────────────────────────────────────────
    .resolve();