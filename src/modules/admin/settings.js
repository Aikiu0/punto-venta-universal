import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';
import { SettingsService } from '../../services/settings.js'; // <--- ¡IMPORTANTE!

export function renderAdminSettings() {
    const s = SettingsService.get();

    return `
        <div class="admin-container">
            <aside class="admin-sidebar">
                <div class="sidebar-logo">
                    <img src="${s.logo_url}" class="app-logo-img" style="width:40px; height:40px; object-fit:contain; display:${s.logo_url?'block':'none'}">
                    <span class="app-name">${s.store_name}</span>
                </div>
                <nav class="sidebar-menu">
                    <button class="menu-item" id="nav-dash">📊 Dashboard</button>
                    <button class="menu-item" id="nav-orders">🔔 Pedidos Web</button>
                    <button class="menu-item" id="nav-inventory">📦 Inventario</button>
                    <button class="menu-item" id="nav-pos">🛒 Ir a Caja</button>
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
                        <img id="preview-img" src="${s.logo_url || 'https://via.placeholder.com/100?text=Logo'}" style="height:100px; object-fit:contain; border-radius:10px; border:1px dashed #ccc;">
                        <br>
                        <label class="btn-primary" style="display:inline-flex; margin-top:10px; cursor:pointer; width:auto;">
                            📷 Cambiar Logo <input type="file" id="logo-upload" hidden accept="image/*">
                        </label>
                    </div>

                    <label>Nombre del Negocio</label>
                    <input type="text" id="set-name" class="form-input" value="${s.store_name}" style="width:100%; padding:10px; margin-bottom:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary);">
                    
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

                    <div style="margin-top:20px; border-top:1px solid var(--border-color); padding-top:20px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--text-primary)">Tema Oscuro</span>
                        <button id="btn-toggle-theme" style="padding:8px; cursor:pointer;">🌗 Cambiar</button>
                    </div>

                    <button id="btn-save-settings" class="btn-primary" style="width:100%; margin-top:20px; justify-content:center;">💾 Guardar Cambios</button>
                </div>
            </main>
        </div>
    `;
}

export function setupSettingsLogic(router) {
    const navTo = (p) => router.navigate(p);
    document.getElementById('nav-dash').addEventListener('click', () => navTo('/admin'));
    document.getElementById('nav-orders').addEventListener('click', () => navTo('/admin/orders'));
    document.getElementById('nav-inventory').addEventListener('click', () => navTo('/admin/inventory'));
    document.getElementById('nav-pos').addEventListener('click', () => navTo('/pos'));
    document.getElementById('nav-logout').addEventListener('click', async () => { await supabase.auth.signOut(); router.navigate('/'); });

    const btnTheme = document.getElementById('btn-toggle-theme');
    const btnSave = document.getElementById('btn-save-settings');
    const nameIn = document.getElementById('set-name');
    const addrIn = document.getElementById('set-address');
    const phoneIn = document.getElementById('set-phone');
    const fileIn = document.getElementById('logo-upload');
    const preview = document.getElementById('preview-img');
    let file = null;

    btnTheme.addEventListener('click', () => ThemeService.toggle());

    fileIn.addEventListener('change', (e) => {
        if(e.target.files[0]) {
            file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => preview.src = ev.target.result;
            reader.readAsDataURL(file);
        }
    });

    btnSave.addEventListener('click', async () => {
        btnSave.disabled = true; btnSave.textContent = "Guardando...";
        const success = await SettingsService.update({
            store_name: nameIn.value,
            address: addrIn.value,
            phone: phoneIn.value
        }, file);
        
        btnSave.disabled = false; btnSave.textContent = "💾 Guardar Cambios";
        if(success) alert("¡Configuración guardada!");
    });
}