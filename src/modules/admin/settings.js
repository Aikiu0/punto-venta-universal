import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';
import { SettingsService } from '../../services/settings.js'; 
import { PermissionService } from '../../services/permissions.js';
import { renderSidebarHeader } from './components/sidebarHeader.js';
import { PwaService } from '../../services/pwa.js';
export function renderAdminSettings() {
    const s = SettingsService.get();

    // 1. Candados de Upselling para el menú lateral
    const lockHistory = PermissionService.can('history') ? '' : '🔒 ';
    const lockOrders = PermissionService.can('web_orders') ? '' : '🔒 ';
    const lockSuppliers = PermissionService.can('suppliers') ? '' : '🔒 ';
    const lockBilling = PermissionService.can('billing') ? '' : '🔒 ';
    // Usamos s.name y s.logo_url con valores por defecto para evitar errores visuales
    const logoUrl = s.logo_url || '';
    const name = s.name || s.name || 'Mi Negocio';
    const footer = s.ticket_footer || '';
    return `
        <div class="admin-container">
            <aside class="admin-sidebar">
                <div class="sidebar-logo">
                    ${renderSidebarHeader()}
                </div>
                <nav class="sidebar-menu">
                    <button class="menu-item" id="nav-dash">📊 Dashboard</button>
                    
                    <button class="menu-item" id="nav-orders" onclick="return window.checkPlan(event, 'web_orders')">
                        ${lockOrders}🔔 Pedidos Web
                    </button>
                    
                    <button class="menu-item" id="nav-inventory">📦 Inventario</button>
                    <button class="menu-item" id="nav-pos">🛒 Ir a Caja</button>
                    <button class="menu-item" id="nav-suppliers" onclick="return window.checkPlan(event, 'suppliers')">${lockSuppliers}🚚 Proveedores</button>
                    <button class="menu-item" id="nav-history" onclick="return window.checkPlan(event, 'history')">
                        ${lockHistory}📅 Historial
                    </button>
                    <button class="menu-item" id="nav-billing" onclick="window.checkPlan(event, 'billing')">
                    ${lockBilling}💎 Facturación
                    </button>
                    <button class="menu-item active">⚙️ Configuración</button>
                    <button class="menu-item logout" id="nav-logout">🚪 Salir</button>
                </nav>
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div class="page-title"><h1>Configuración</h1></div>
                </header>

                <div class="card-panel" style="max-width: 600px;">
                    <div style="text-align:center; margin-bottom:20px;">
                        <img id="preview-img" src="${logoUrl || 'https://via.placeholder.com/100?text=Logo'}" style="height:100px; object-fit:contain; border-radius:10px; border:1px dashed #ccc;">
                        <br>
                        <label class="btn-primary" style="display:inline-flex; margin-top:10px; cursor:pointer; width:auto;">
                            📷 Cambiar Logo <input type="file" id="logo-upload" hidden accept="image/*">
                        </label>
                    </div>

                    <label>Nombre del Negocio</label>
                    <input type="text" id="set-name" class="form-input" value="${name}" style="width:100%; padding:10px; margin-bottom:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary);">
                    
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1">
                            <label>Dirección</label>
                            <input type="text" id="set-address" class="form-input" value="${s.address||''}" style="width:100%; padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary);">
                        </div>
                        <div style="flex:1">
                            <label>Teléfono</label>
                            <input type="text" id="set-phone" class="form-input" value="${s.phone||''}" style="width:100%; padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary);">
                        </div>
                    </div>
                    <label>Leyenda del Ticket (Pie de página)</label>
                    <textarea id="set-footer" class="form-input" rows="3" placeholder="Ej: No devoluciones. Gracias por su compra." style="width:100%; padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); resize:vertical;">${footer}</textarea>
                    <button
  id="btn-update-system"
  class="btn-secondary"
  style="width:100%; margin-top:15px; opacity:70.5; cursor:not-allowed;"
  disabled
>
  ✅ Sistema actualizado
</button>

                    <button id="btn-save-settings" class="btn-primary" style="width:100%; margin-top:20px; justify-content:center;">💾 Guardar Cambios</button>
                </div>
            </main>
        </div>
    `;
}

export function setupSettingsLogic(router) {
    // 1. Configuración de navegación básica
    const navTo = (p) => router.navigate(p);
    const bindNav = (id, path) => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('click', () => navTo(path));
    };
    const btnSup = document.getElementById('nav-suppliers'); if (btnSup) btnSup.addEventListener('click', () => navigateTo('/admin/suppliers'));
    // Vinculamos botones si existen en el DOM
    bindNav('nav-dash', '/admin');
    bindNav('nav-orders', '/admin/orders');
    bindNav('nav-inventory', '/admin/inventory');
    bindNav('nav-pos', '/pos');
    bindNav('nav-history', '/admin/history');
    bindNav('nav-settings', '/admin/settings');
    bindNav('nav-suppliers', '/admin/suppliers');
    bindNav('nav-billing', '/admin/billing');
    const logoutBtn = document.getElementById('nav-logout');
    if(logoutBtn) logoutBtn.addEventListener('click', async () => { 
        await supabase.auth.signOut(); 
        router.navigate('/'); 
    });

    // 2. Referencias del Formulario
    const btnSave = document.getElementById('btn-save-settings');
    const nameIn = document.getElementById('set-name');
    const addrIn = document.getElementById('set-address');
    const phoneIn = document.getElementById('set-phone');
    const fileIn = document.getElementById('logo-upload');
    const preview = document.getElementById('preview-img');
    const updateBtn = document.getElementById('btn-update-system');
    let file = null; // Variable para guardar el archivo seleccionado

    // Previsualización de imagen
    if(fileIn) {
        fileIn.addEventListener('change', (e) => {
            if(e.target.files[0]) {
                file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (ev) => { if(preview) preview.src = ev.target.result; };
                reader.readAsDataURL(file);
            }
        });
    }

    // --- FUNCIÓN HELPER: Obtener ID de forma segura ---
    const getMyBusinessId = async (userId) => {
        // Intento 1: Tabla 'users'
        let { data, error } = await supabase.from('users').select('business_id').eq('id', userId).single();
        
        // Intento 2: Si falla o no hay datos, probamos tabla 'profiles'
        if (error || !data) {
            console.warn("No encontrado en 'users', probando 'profiles'...");
            const res2 = await supabase.from('profiles').select('business_id').eq('id', userId).single();
            data = res2.data;
            error = res2.error;
        }

        if (error || !data) throw new Error("No se pudo encontrar el ID del negocio en 'users' ni en 'profiles'.");
        return data.business_id;
    };

    // --- FUNCIÓN: CARGAR DATOS REALES AL ABRIR ---
    const loadRealData = async () => {
        try {
            console.log("🔄 Cargando configuración...");
            const { data: { user } } = await supabase.auth.getUser();
            if(!user) return;

            const businessId = await getMyBusinessId(user.id);
            if(!businessId) return;

            const { data: business } = await supabase
                .from('businesses')
                .select('*')
                .eq('id', businessId)
                .single();

            if (business) {
                console.log("✅ Datos cargados:", business);
                // Rellenar inputs
                if(nameIn) nameIn.value = business.name || '';
                if(addrIn) addrIn.value = business.address || '';
                if(phoneIn) phoneIn.value = business.phone || '';
                if(preview && business.logo_url) preview.src = business.logo_url;
                if(footerIn) footerIn.value = business.ticket_footer ||'';

                // Actualizar Sidebar inmediatamente
                const sbName = document.getElementById('sb-real-name');
                const sbLogo = document.getElementById('sb-real-logo');
                if(sbName) sbName.textContent = business.name;
                if(sbLogo && business.logo_url) sbLogo.src = business.logo_url;

                // Actualizar Memoria
                const s = SettingsService.get() || {};
                s.name = business.name;
                s.logo_url = business.logo_url;
                // No hay set, modificamos el objeto directamente si es referencia, 
                // o idealmente SettingsService debería tener un método .set(data)
            }
        } catch (e) {
            console.error("Error loadRealData:", e.message);
        }
    };
    
    // Ejecutar carga inicial
    loadRealData();

    // 3. Botón Guardar
    if(btnSave) {
        btnSave.addEventListener('click', async () => {
            btnSave.disabled = true; 
            btnSave.textContent = "⏳ Guardando...";
            const footerIn = document.getElementById('set-footer');
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Sesión expirada.");

                // Usamos el helper seguro
                const businessId = await getMyBusinessId(user.id);

                const updates = {
                    name: nameIn ? nameIn.value : 'Sin Nombre',
                    address: addrIn ? addrIn.value : '',
                    phone: phoneIn ? phoneIn.value : '',
                    ticket_footer: footerIn ? footerIn.value : ''
                };

                // Lógica de Subida de Imagen
                if (file) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${businessId}/logo-${Date.now()}.${fileExt}`;
                    
                    // Subir
                    const { error: uploadError } = await supabase.storage
                        .from('logos') 
                        .upload(fileName, file, { upsert: true });

                    if (uploadError) throw new Error("Error Storage: " + uploadError.message);

                    // Obtener URL
                    const { data: urlData } = supabase.storage
                        .from('logos')
                        .getPublicUrl(fileName);
                    
                    updates.logo_url = urlData.publicUrl;
                }

                // Update en DB
                const { error: dbError } = await supabase
                    .from('businesses')
                    .update(updates)
                    .eq('id', businessId);

                if (dbError) throw dbError;

                // ÉXITO: Actualizar Interfaz
                const sbName = document.getElementById('sb-real-name');
                const sbLogo = document.getElementById('sb-real-logo');
                
                if(sbName) sbName.textContent = updates.name;
                if(sbLogo && updates.logo_url) sbLogo.src = updates.logo_url;
                
                // Actualizar Memoria Local (Importante para navegación)
                const currentSettings = SettingsService.get() || {};
                currentSettings.name = updates.name;
                if(updates.logo_url) currentSettings.logo_url = updates.logo_url;

                alert("¡Guardado correctamente!");

            } catch (err) {
                console.error(err);
                alert("Error: " + err.message);
            } finally {
                btnSave.disabled = false; 
                btnSave.textContent = "💾 Guardar Cambios";
            }
        });
    }
    if (updateBtn) {
    const setUpdated = () => {
        updateBtn.disabled = true;
        updateBtn.style.opacity = '.5';
        updateBtn.style.cursor = 'not-allowed';
        updateBtn.textContent = '✅ Sistema actualizado';
    };

    const setUpdatable = () => {
        updateBtn.disabled = false;
        updateBtn.style.opacity = '1';
        updateBtn.style.cursor = 'pointer';
        updateBtn.classList.remove('btn-secondary');
        updateBtn.classList.add('btn-primary');
        updateBtn.textContent = '🔄 Actualizar sistema';
    };

    // Estado inicial
    if (PwaService.updateAvailable) setUpdatable();
    else setUpdated();

    // Escuchar actualización
    window.addEventListener('pwa-update-available', () => {
        setUpdatable();
    });

    updateBtn.addEventListener('click', () => {
        if (!PwaService.updateAvailable) return;
        updateBtn.textContent = '⏳ Actualizando...';
        PwaService.applyUpdate();
    });
}
}