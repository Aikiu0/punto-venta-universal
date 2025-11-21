// src/modules/admin/orders.js - VERSIÓN FINAL AGRESIVA
import { supabase } from '../../data/supabase.js';

export function renderAdminOrders() {
    return `
        <div class="admin-container">
            <aside class="admin-sidebar">
                <div class="sidebar-logo">🚀 Mi Negocio</div>
                <nav class="sidebar-menu">
                    <button class="menu-item" id="nav-dash">📊 Dashboard</button>
                    <button class="menu-item" id="nav-inventory">📦 Inventario</button>
                    <button class="menu-item active">🔔 Pedidos Web</button>
                    <button class="menu-item" id="nav-pos">🛒 Ir a Caja</button>
                    <button class="menu-item logout" id="nav-logout">🚪 Salir</button>
                </nav>
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div class="page-title">
                        <h1>Pedidos en Línea</h1>
                        <p>Gestiona las órdenes de "Click & Collect"</p>
                    </div>
                    <button id="btn-refresh" class="btn-primary" style="background:#3b82f6;">🔄 Actualizar</button>
                </header>

                <div id="orders-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:20px;">
                    <p style="grid-column:1/-1; text-align:center; padding:40px; color:#94a3b8;">Cargando pedidos...</p>
                </div>
            </main>
        </div>
    `;
}

export async function setupOrdersLogic(router) {
    document.getElementById('nav-dash').addEventListener('click', () => router.navigate('/admin'));
    document.getElementById('nav-inventory').addEventListener('click', () => router.navigate('/admin/inventory'));
    document.getElementById('nav-pos').addEventListener('click', () => router.navigate('/pos'));
    document.getElementById('nav-logout').addEventListener('click', async () => { 
        supabase.removeAllChannels();
        await supabase.auth.signOut(); 
        router.navigate('/'); 
    });

    const container = document.getElementById('orders-container');
    const btnRefresh = document.getElementById('btn-refresh');

    // --- CARGAR PEDIDOS ---
    async function loadOrders() {
        container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#94a3b8;">Actualizando...</p>';
        
        const { data, error } = await supabase
            .from('web_orders')
            .select('*')
            .eq('status', 'pendiente')
            .order('created_at', { ascending: false });

        if (error) return container.innerHTML = `<p style="color:red;">Error al cargar.</p>`;
        renderOrders(data);
    }

    function renderOrders(orders) {
        container.innerHTML = '';
        if (orders.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:50px; background:white; border-radius:12px;">
                    <div style="font-size:3rem; margin-bottom:10px;">✅</div>
                    <h3 style="color:#1e293b;">Todo al día</h3>
                    <p style="color:#64748b;">No hay pedidos pendientes.</p>
                </div>`;
            return;
        }

        orders.forEach(order => {
            const itemsList = order.items.map(i => 
                `<li style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem; color:#475569;">
                    <span>${i.qty} ${i.unit||'pz'} x ${i.name}</span>
                    <strong>$${(i.price * i.qty).toFixed(2)}</strong>
                 </li>`
            ).join('');

            let method = "Efectivo";
            const meta = order.items.find(i => i.type === 'meta');
            if (meta && meta.payment_method) method = meta.payment_method;

            const card = document.createElement('div');
            card.className = 'card-panel';
            card.style.borderLeft = "5px solid #f59e0b"; 
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                    <div><h3 style="margin:0; color:#1e293b;">${order.customer_name}</h3><small style="color:#64748b;">${new Date(order.created_at).toLocaleTimeString()}</small></div>
                    <span style="background:#fff7ed; color:#c2410c; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:bold; height:fit-content;">Pendiente</span>
                </div>
                <div style="background:#f8fafc; padding:15px; border-radius:8px; margin-bottom:15px;">
                    <ul style="list-style:none; padding:0; margin:0;">${itemsList}</ul>
                    <div style="border-top:1px dashed #cbd5e1; margin-top:10px; padding-top:10px; display:flex; justify-content:space-between; font-weight:bold;">
                        <span>Total:</span><span>$${order.total.toFixed(2)}</span>
                    </div>
                </div>
                <div style="margin-bottom:15px; font-size:0.9rem; color:#64748b;">
                    <p style="margin:5px 0;">📞 ${order.customer_contact}</p>
                    <p style="margin:5px 0;">💳 ${method.toUpperCase()}</p>
                </div>
                <button class="btn-primary btn-deliver" style="width:100%; justify-content:center; background:#10b981;">✅ Entregar y Cobrar</button>
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
    console.log("🔌 ADMIN: Conectando...");
    supabase.removeAllChannels(); 

    const channel = supabase.channel('public:admin_orders')
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'web_orders' }, 
            (payload) => {
                if(payload.eventType === 'INSERT') {
                    console.log("🔔 ADMIN: Notificación recibida");
                    alert(`🔔 ¡Nuevo pedido web de ${payload.new.customer_name}!`);
                    loadOrders();
                }
            }
        )
        .subscribe((status) => {
            console.log("🔌 ADMIN Estado:", status);
        });

    btnRefresh.addEventListener('click', loadOrders);
    loadOrders();
}