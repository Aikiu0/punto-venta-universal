// src/modules/admin/settings.js
import { supabase } from '../../data/supabase.js';
import { themeService } from '../../services/theme.js';

export function renderAdminSettings() {
    return `
        <div class="admin-container">
            <aside class="admin-sidebar">
                <div class="sidebar-logo">🚀 Cargando...</div>
                <nav class="sidebar-menu">
                    <button class="menu-item" id="nav-dash">📊 Dashboard</button>
                    <button class="menu-item" id="nav-orders">🔔 Pedidos Web</button>
                    <button class="menu-item" id="nav-inventory">📦 Inventario</button>
                    <button class="menu-item active">⚙️ Configuración</button>
                    <button class="menu-item logout" id="nav-logout">🚪 Salir</button>
                </nav>
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div class="page-title">
                        <h1>Configuración</h1>
                    </div>
                </header>

                <div class="card-panel" style="max-width: 600px;">
                    <h3>🎨 Apariencia</h3>
                    <div style="margin: 20px 0; display:flex; justify-content:space-between; align-items:center;">
                        <label>Modo Oscuro</label>
                        <button id="btn-toggle-theme" style="padding:10px 20px; border-radius:20px; border:1px solid #ccc; cursor:pointer;">🌙 / ☀️</button>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom:5px;">Color de Marca</label>
                        <div style="display:flex; gap:10px;">
                            <input type="color" id="input-color" style="height:40px; cursor:pointer;">
                            <input type="text" id="input-name" class="form-input" placeholder="Nombre del Negocio" style="flex:1; padding:10px;">
                        </div>
                    </div>

                    <button id="btn-save-config" class="btn-primary" style="width:100%; padding:15px; border:none; border-radius:8px; cursor:pointer;">💾 Guardar</button>
                </div>
            </main>
        </div>
    `;
}

export async function setupSettingsLogic(router) {
    const navTo = (p) => router.navigate(p);
    document.getElementById('nav-dash').addEventListener('click', () => navTo('/admin'));
    document.getElementById('nav-orders').addEventListener('click', () => navTo('/admin/orders'));
    document.getElementById('nav-inventory').addEventListener('click', () => navTo('/admin/inventory'));
    document.getElementById('nav-logout').addEventListener('click', async () => { await supabase.auth.signOut(); router.navigate('/'); });

    const btnTheme = document.getElementById('btn-toggle-theme');
    const inputColor = document.getElementById('input-color');
    const inputName = document.getElementById('input-name');
    const btnSave = document.getElementById('btn-save-config');

    // Cargar datos
    const { data } = await supabase.from('business_settings').select('*').single();
    if(data) {
        inputName.value = data.business_name;
        inputColor.value = data.primary_color || '#7A3F9D';
    }

    // Listeners
    btnTheme.addEventListener('click', () => themeService.toggleDarkMode());
    
    inputColor.addEventListener('input', (e) => {
        document.documentElement.style.setProperty('--primary', e.target.value);
    });

    btnSave.addEventListener('click', async () => {
        await supabase.from('business_settings').update({
            business_name: inputName.value,
            primary_color: inputColor.value
        }).gt('id', 0);
        alert("¡Guardado!");
        location.reload(); // Recargar para aplicar cambios globales
    });
}