// src/modules/admin/orders.js - MODO OSCURO & DISEÑO SUTIL
import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';

export function renderAdminOrders() {
    return `
        <div class="admin-container">
            <aside class="admin-sidebar">
                <div class="sidebar-logo" style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                    <img src="" class="app-logo-img" style="width:80px; height:auto; object-fit:contain; display:none;">
                    <span class="app-name" style="font-size:1.2rem;">Cargando...</span>
                </div>
                <nav class="sidebar-menu">
                    <button class="menu-item" id="nav-dash">📊 Dashboard</button>
                    <button class="menu-item active">🔔 Pedidos Web</button>
                    <button class="menu-item" id="nav-inventory">📦 Inventario</button>
                    <button class="menu-item" id="nav-pos">🛒 Ir a Caja</button>
                    <button class="menu-item" id="nav-history">📅 Historial</button>
                    <button class="menu-item" id="nav-settings">⚙️ Configuración</button>
                    <button class="menu-item logout" id="nav-logout">🚪 Salir</button>
                </nav>
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div class="page-title">
                        <h1>Pedidos en Línea</h1>
                        <p>Gestiona las órdenes de "Click & Collect"</p>
                    </div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <button id="theme-toggle-orders" class="icon-btn" title="Cambiar Tema" style="background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); width:40px; height:40px; border-radius:8px; cursor:pointer; display:flex; justify-content:center; align-items:center;">
                            🌗
                        </button>
                        
                        <button id="btn-refresh" class="btn-primary" style="background:var(--brand-color); color:white;">🔄 Actualizar</button>
                    </div>
                </header>

                <div id="orders-container" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
                    <p style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-secondary);">Cargando pedidos...</p>
                </div>
            </main>
        </div>
    `;
}

export async function setupOrdersLogic(router) {
    // 1. Navegación
    document.getElementById('nav-dash').addEventListener('click', () => router.navigate('/admin'));
    document.getElementById('nav-inventory').addEventListener('click', () => router.navigate('/admin/inventory'));
    document.getElementById('nav-pos').addEventListener('click', () => router.navigate('/pos'));
    document.getElementById('nav-settings').addEventListener('click', () => router.navigate('/admin/settings'))
    document.getElementById('nav-history').addEventListener('click', () => router.navigate('/admin/history'));
    document.getElementById('nav-logout').addEventListener('click', async () => { 
        supabase.removeAllChannels();
        await supabase.auth.signOut(); 
        router.navigate('/'); 
    });

    // 2. LISTENER DEL BOTÓN TEMA (¡Aquí es donde se agrega!)
    const themeBtn = document.getElementById('theme-toggle-orders');
    if(themeBtn) {
        themeBtn.addEventListener('click', () => ThemeService.toggle());
    }

    // 3. Lógica de Pedidos
    const container = document.getElementById('orders-container');
    const btnRefresh = document.getElementById('btn-refresh');

    async function loadOrders() {
        container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-secondary);">Actualizando...</p>';
        
        const { data, error } = await supabase
            .from('web_orders')
            .select('*')
            .eq('status', 'pendiente')
            .order('created_at', { ascending: false });

        if (error) return container.innerHTML = `<p style="color:var(--danger-color);">Error al cargar.</p>`;
        renderOrders(data);
    }

    function renderOrders(orders) {
        container.innerHTML = '';
        if (orders.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:50px; background:var(--bg-card); border-radius:12px; border:1px solid var(--border-color);">
                    <div style="font-size:3rem; margin-bottom:10px;">✅</div>
                    <h3 style="color:var(--text-primary);">Todo al día</h3>
                    <p style="color:var(--text-secondary);">No hay pedidos pendientes.</p>
                </div>`;
            return;
        }

        orders.forEach(order => {
            const itemsList = order.items.map(i => 
                `<li style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem; color:var(--text-secondary);">
                    <span>${i.qty || i.cantidad} ${i.unit||'pz'} x ${i.name}</span>
                    <strong style="color:var(--text-primary);">$${(i.price * (i.qty || i.cantidad)).toFixed(2)}</strong>
                 </li>`
            ).join('');

            let method = "Efectivo";
            const meta = order.items.find(i => i.type === 'meta');
            if (meta && meta.payment_method) method = meta.payment_method;

            const card = document.createElement('div');
            // Usamos variables CSS para el modo oscuro
            card.style.cssText = "background:var(--bg-card); padding:20px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 2px 5px rgba(0,0,0,0.05); border-left: 5px solid #f59e0b;";
            
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                    <div>
                        <h3 style="margin:0; color:var(--text-primary);">${order.customer_name}</h3>
                        <small style="color:var(--text-secondary);">${new Date(order.created_at).toLocaleTimeString()}</small>
                    </div>
                    <span style="background:var(--bg-input); color:#f59e0b; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:bold; height:fit-content; border:1px solid var(--border-color);">Pendiente</span>
                </div>
                <div style="background:var(--bg-input); padding:15px; border-radius:8px; margin-bottom:15px;">
                    <ul style="list-style:none; padding:0; margin:0;">${itemsList}</ul>
                    <div style="border-top:1px dashed var(--border-color); margin-top:10px; padding-top:10px; display:flex; justify-content:space-between; font-weight:bold; color:var(--text-primary);">
                        <span>Total:</span><span>$${order.total.toFixed(2)}</span>
                    </div>
                </div>
                <div style="margin-bottom:15px; font-size:0.9rem; color:var(--text-secondary);">
                    <p style="margin:5px 0;">📞 ${order.customer_contact}</p>
                    <p style="margin:5px 0;">💳 ${method.toUpperCase()}</p>
                </div>
                <button class="btn-primary btn-deliver" style="width:100%; justify-content:center; background:var(--success-bg); color:white;">✅ Entregar y Cobrar</button>
            `;
            
            card.querySelector('.btn-deliver').addEventListener('click', () => completeOrder(order));
            container.appendChild(card);
        });
    }

    async function completeOrder(order) {
        if(!confirm(`¿Entregar pedido a ${order.customer_name}?`)) return;
        try {
            await supabase.from('sales').insert({
                created_at: new Date(), total: order.total, items: order.items,
                payment_data: { method: 'web_order', customer: order.customer_name },
                user_id: (await supabase.auth.getUser()).data.user.id, local_id: null
            });
            await supabase.from('web_orders').update({ status: 'entregado' }).eq('id', order.id);
            loadOrders();
        } catch (err) { alert("Error: " + err.message); }
    }

    // --- REALTIME ---
    supabase.removeAllChannels(); 
    const channel = supabase.channel('public:admin_orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'web_orders' }, (payload) => {
            if(payload.eventType === 'INSERT') {
                alert(`🔔 ¡Nuevo pedido web de ${payload.new.customer_name}!`);
                loadOrders();
            }
        })
        .subscribe();

    btnRefresh.addEventListener('click', loadOrders);
    loadOrders();
}