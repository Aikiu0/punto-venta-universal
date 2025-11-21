// src/modules/pos/pos.js - FIX: TICKET WEB DETALLADO Y SIN ERRORES
import { db, isDbEmpty, seedDummyData } from '../../data/db-local.js';
import { supabase } from '../../data/supabase.js';
import { syncService } from '../../services/sync.js';

let carrito = [];
let productosGlobal = [];
let totalVenta = 0;
let audioContext = null;
let ordersCheckInterval = null;

export function renderPOS() {
    return `
        <div class="pos-layout">
            <div class="catalog-panel">
                <div class="catalog-header">
                    <div class="search-wrapper"><span class="search-icon">🔍</span><input type="text" id="search" class="search-input" placeholder="Buscar..." autocomplete="off"></div>
                    <button id="btn-view-list" class="view-btn active">☰</button>
                    <button id="btn-view-grid" class="view-btn">田</button>
                </div>
                <div id="product-container" class="products-grid list-mode"></div>
            </div>

            <div class="cart-panel">
                <div class="cart-header">
                    <div class="cart-title">Ticket</div>
                    <div class="header-actions">
                        <div style="position:relative;">
                            <button id="btn-web-orders" title="Pedidos Web" style="border:none; background:#fff7ed; color:#c2410c; border-radius:8px; width:42px; height:38px; cursor:pointer; font-size:1.3rem; display:flex; align-items:center; justify-content:center;">🔔</button>
                            <div id="orders-badge" style="position:absolute; top:-5px; right:-5px; background:#ef4444; color:white; border-radius:50%; width:20px; height:20px; font-size:0.75rem; font-weight:bold; display:none; justify-content:center; align-items:center; box-shadow:0 2px 5px rgba(0,0,0,0.2); z-index:10;">0</div>
                        </div>

                        <div id="connection-status" style="display:flex; align-items:center; gap:6px; padding:6px 12px; background:#f1f5f9; border-radius:20px; font-size:0.8rem; font-weight:bold; transition:all 0.3s; border:1px solid transparent;">
                            <span>...</span>
                        </div>
                        <button id="btn-sync" class="icon-btn" title="Sync">🔄</button>
                        <button id="btn-back-admin" class="icon-btn admin-btn" style="display:none;">🛠️</button>
                        <button id="logout-btn" class="icon-btn" style="color:#ef4444;">⏻</button>
                    </div>
                </div>
                <div class="cart-items" id="cart-items"><p style="text-align:center;color:#999;margin-top:50px">Vacío</p></div>
                <div class="cart-footer">
                    <div class="summary-row"><span class="total-label">Total</span><span class="total-amount" id="cart-total">$0.00</span></div>
                    <button class="pay-btn-large" id="btn-pay">COBRAR ➔</button>
                </div>
            </div>

            <div class="modal-overlay" id="payment-modal"><div class="modal-card" id="modal-content"></div></div>
            
            <div id="toast-notification" style="position:fixed; top:20px; right:20px; background:#1e293b; color:white; padding:20px; border-radius:12px; box-shadow:0 20px 50px rgba(0,0,0,0.5); display:none; align-items:center; gap:15px; z-index:2147483647; border-left: 6px solid #10b981; width: 300px; cursor:pointer; animation: slideIn 0.3s;">
                <div style="font-size:2rem;">🔔</div>
                <div>
                    <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">¡NUEVO PEDIDO!</div>
                    <div id="toast-msg" style="color:#cbd5e1; font-size:0.9rem;">Cliente...</div>
                    <small style="color:#10b981; font-weight:bold; margin-top:5px; display:block;">Clic para ver</small>
                </div>
            </div>
            <style>@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }</style>
        </div>
    `;
}

export async function setupPOSLogic(router) {
    const container = document.getElementById('product-container');
    const searchInput = document.getElementById('search');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalLabel = document.getElementById('cart-total');
    const modal = document.getElementById('payment-modal');
    const modalContent = document.getElementById('modal-content');
    const statusBadge = document.getElementById('connection-status');
    const btnOrders = document.getElementById('btn-web-orders');
    const badgeOrders = document.getElementById('orders-badge');

    // --- 1. AUDIO ---
    function initAudio() {
        if (audioContext) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioContext.createOscillator(); osc.connect(audioContext.destination);
            osc.start(); osc.stop(audioContext.currentTime + 0.001);
        } catch(e) {}
    }
    document.addEventListener('click', initAudio, { once: true });

    function playSound() {
        if (!audioContext) initAudio();
        try {
            const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
            osc.connect(gain); gain.connect(audioContext.destination);
            osc.type = 'sine'; 
            osc.frequency.setValueAtTime(500, audioContext.currentTime);
            osc.frequency.linearRampToValueAtTime(1000, audioContext.currentTime + 0.1);
            osc.start(); 
            gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
            osc.stop(audioContext.currentTime + 0.5);
        } catch(e) {}
    }

    // --- 2. PEDIDOS WEB ---
    async function checkPendingOrders() {
        const { count, error } = await supabase.from('web_orders').select('*', { count: 'exact', head: true }).eq('status', 'pendiente');
        if (!error) {
            const current = parseInt(badgeOrders.textContent) || 0;
            if (count > 0) {
                badgeOrders.style.display = "flex"; badgeOrders.textContent = count; btnOrders.style.backgroundColor = "#ffedd5";
                if (count > current) { showToast("Nuevo Pedido Web"); }
            } else {
                badgeOrders.style.display = "none"; btnOrders.style.backgroundColor = "#fff7ed";
            }
        }
    }

    function showToast(cliente) {
        playSound();
        const toast = document.getElementById('toast-notification');
        document.getElementById('toast-msg').textContent = `Cliente: ${cliente}`;
        toast.style.display = 'flex';
        toast.onclick = () => { toast.style.display = 'none'; openWebOrdersModal(); };
        setTimeout(() => { toast.style.display = 'none'; }, 8000);
    }

    supabase.removeAllChannels();
    const channel = supabase.channel('pos-final-fix')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'web_orders' }, (payload) => {
            if (payload.eventType === 'INSERT') showToast(payload.new.customer_name || "Web");
            checkPendingOrders();
        })
        .subscribe();

    if (ordersCheckInterval) clearInterval(ordersCheckInterval);
    ordersCheckInterval = setInterval(checkPendingOrders, 10000);
    checkPendingOrders();

    // --- 3. MODAL PEDIDOS ---
    btnOrders.addEventListener('click', openWebOrdersModal);
    async function openWebOrdersModal() {
        modal.style.display = 'flex';
        modalContent.innerHTML = `<p style="padding:20px;">Cargando...</p>`;
        const { data: orders } = await supabase.from('web_orders').select('*').eq('status', 'pendiente').order('created_at', {ascending:false});

        if (!orders || orders.length === 0) {
            modalContent.innerHTML = `<div style="text-align:center; padding:30px;"><h3>✅ Todo al día</h3><button id="btn-close-modal" style="margin-top:15px; padding:10px; border:1px solid #ccc; background:white; border-radius:5px; cursor:pointer;">Cerrar</button></div>`;
            document.getElementById('btn-close-modal').addEventListener('click', () => modal.style.display = 'none');
            checkPendingOrders();
            return;
        }

        let listHtml = orders.map(o => {
            let method = "Efectivo";
            const meta = o.items.find(i => i.type === 'meta');
            if (meta && meta.payment_method) method = meta.payment_method.toUpperCase();
            const itemsReales = o.items.filter(i => i.type !== 'meta');

            return `
                <div style="border:1px solid #eee; padding:15px; margin-bottom:10px; border-radius:8px; border-left:4px solid #7A3F9D; text-align:left; background:white;">
                    <div style="display:flex; justify-content:space-between; font-weight:bold;"><span>${o.customer_name}</span><span style="color:#166534;">$${o.total.toFixed(2)}</span></div>
                    <div style="font-size:0.85rem; color:#666; margin:5px 0;">Pago: <strong>${method}</strong> | 📞 ${o.customer_contact}</div>
                    <div style="background:#f9fafb; padding:10px; border-radius:5px; margin:10px 0;"><ul style="padding-left:20px; margin:0;">
                        ${itemsReales.map(i => `<li>${i.qty} ${i.unit||'pz'} - ${i.name}</li>`).join('')}
                    </ul></div>
                    <button class="btn-deliver-order" data-id="${o.id}" style="width:100%; padding:10px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">✅ Entregar y Cobrar</button>
                </div>`;
        }).join('');

        modalContent.innerHTML = `<div style="text-align:center;"><h2 style="margin-top:0;">Pedidos Web</h2><div style="max-height:60vh; overflow-y:auto; padding:5px;">${listHtml}</div><button id="btn-close-modal" style="margin-top:15px; padding:10px; border:1px solid #ccc; background:white; border-radius:5px; cursor:pointer;">Cerrar</button></div>`;
        document.getElementById('btn-close-modal').addEventListener('click', () => modal.style.display = 'none');
        document.querySelectorAll('.btn-deliver-order').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const order = orders.find(o => o.id == e.target.dataset.id);
                if(confirm(`¿Confirmar entrega a ${order.customer_name}?`)) { await finalizeWebOrder(order); }
            });
        });
    }

    async function finalizeWebOrder(order) {
        try {
            // 1. NORMALIZAR DATOS (Convertir 'qty' de web a 'cantidad' de POS)
            // Esto arregla el error "undefined pz" y "NaN"
            const itemsNormalizados = order.items
                .filter(i => i.type !== 'meta')
                .map(i => ({
                    ...i,
                    cantidad: i.qty || i.cantidad, // <--- AQUÍ ESTÁ LA MAGIA DEL FIX
                    unit: i.unit || 'pz'
                }));

            let method = "Web/Pickup";
            const meta = order.items.find(i => i.type === 'meta');
            if (meta && meta.payment_method) method = meta.payment_method.toUpperCase();

            // Objeto Venta
            const venta = {
                date: new Date(),
                total: order.total,
                items: itemsNormalizados,
                payment: { method: method, received: order.total, change: 0 }
            };

            // 2. Guardar en Historial
            await supabase.from('sales').insert({
                created_at: new Date(),
                total: order.total,
                items: itemsNormalizados,
                payment_data: { method: method, customer: order.customer_name },
                user_id: (await supabase.auth.getUser()).data.user.id,
                local_id: null
            });

            // 3. Marcar Entregado
            await supabase.from('web_orders').update({ status: 'entregado' }).eq('id', order.id);
            
            // 4. UI
            checkPendingOrders();
            alert("Venta registrada. Generando ticket...");
            mostrarTicket(venta); // Usamos la versión normalizada

        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        }
    }

    // --- 4. LÓGICA GENERAL (IGUAL QUE ANTES) ---
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile && profile.role === 'admin') {
            document.getElementById('btn-back-admin').style.display = 'flex';
            document.getElementById('btn-back-admin').addEventListener('click', () => router.navigate('/admin'));
        }
    }
    
    syncService.listenConnection(async (isOnline) => {
        if(isOnline) {
            statusBadge.innerHTML = `📶 Conectado`;
            statusBadge.style.backgroundColor = "#dcfce7"; statusBadge.style.color = "#166534";
            await syncService.uploadSales();
        } else {
            statusBadge.innerHTML = `📡 Desconectado`;
            statusBadge.style.backgroundColor = "#fee2e2"; statusBadge.style.color = "#991b1b";
        }
    });

    document.getElementById('btn-sync').addEventListener('click', async () => {
        const btn = document.getElementById('btn-sync'); btn.innerHTML = "⏳";
        await syncService.uploadSales(); await syncService.downloadProducts();
        productosGlobal = await db.products.toArray(); renderGrid(productosGlobal);
        checkPendingOrders(); btn.innerHTML = "🔄";
    });

    document.getElementById('logout-btn').addEventListener('click', async () => { 
        if(ordersCheckInterval) clearInterval(ordersCheckInterval);
        supabase.removeAllChannels();
        await supabase.auth.signOut(); router.navigate('/'); 
    });

    searchInput.focus();
    document.addEventListener('click', (e) => { if(modal.style.display !== 'flex' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') searchInput.focus(); });
    document.getElementById('btn-view-list').addEventListener('click', () => container.className = 'products-grid list-mode');
    document.getElementById('btn-view-grid').addEventListener('click', () => container.className = 'products-grid grid-mode');

    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        renderGrid(productosGlobal.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const q = searchInput.value.trim().toLowerCase();
            if (!q) return;
            const p = productosGlobal.find(p => p.sku.toLowerCase() === q || p.name.toLowerCase() === q);
            if (p) { p.stock > 0 ? (addToCart(p), searchInput.value='') : (alert("Agotado"), searchInput.value=''); }
            else { alert("No encontrado"); searchInput.value=''; }
        }
    });

    function renderGrid(products) {
        container.innerHTML = '';
        products.forEach(p => {
            const card = document.createElement('div'); card.className = 'product-card';
            let color = p.stock <= 10 ? '#991b1b' : '#166534'; let bg = p.stock <= 10 ? '#fee2e2' : '#dcfce7'; if(p.stock===0){color='#555';bg='#eee';}
            card.innerHTML = `<div class="prod-info"><div class="prod-name">${p.name}</div><div class="prod-sku">${p.sku||'--'}</div><div class="stock-badge" style="background:${bg};color:${color}">${p.stock} ${p.unit||'pz'}</div></div><div class="prod-price">$${p.price}</div>`;
            card.addEventListener('click', () => { if(p.stock>0) addToCart(p); else alert("Agotado"); });
            container.appendChild(card);
        });
    }

    function addToCart(p) {
        let qty = 1;
        if (p.is_bulk) {
            let val = prompt(`Granel: ${p.name}\nStock: ${p.stock}\n¿Cantidad?`, "1");
            if(val===null) return; qty = parseFloat(val.replace(',','.'));
            if(isNaN(qty) || qty<=0) return alert("Inválido");
        }
        const ex = carrito.find(i=>i.id===p.id);
        if((ex ? ex.cantidad : 0) + qty > p.stock) return alert("Stock insuficiente");
        if(ex) { ex.cantidad += qty; ex.cantidad = Math.round(ex.cantidad*1000)/1000; }
        else carrito.push({...p, cantidad: qty});
        renderCart();
    }

    function removeFromCart(idx) { carrito.splice(idx, 1); renderCart(); }

    function renderCart() {
        cartItemsContainer.innerHTML = ''; totalVenta = 0;
        if(carrito.length===0) { cartItemsContainer.innerHTML = `<div style="text-align:center;color:#94a3b8;margin-top:50px"><div style="font-size:3rem">🛒</div><p>Vacío</p></div>`; cartTotalLabel.textContent='$0.00'; return; }
        carrito.forEach((item, idx) => {
            totalVenta += item.price * item.cantidad;
            const div = document.createElement('div'); div.className = 'cart-item';
            div.innerHTML = `<div><div style="font-weight:bold;color:#334155">${item.name}</div><div style="color:#64748b">${item.cantidad} ${item.unit||'pz'} x $${item.price}</div></div><div style="display:flex;align-items:center;gap:15px"><div style="font-weight:bold;color:#1e293b">$${(item.price*item.cantidad).toFixed(2)}</div><button class="rm-btn" data-i="${idx}" style="color:#ef4444;border:none;background:none;cursor:pointer">×</button></div>`;
            cartItemsContainer.appendChild(div);
        });
        cartTotalLabel.textContent = `$${totalVenta.toFixed(2)}`;
        document.querySelectorAll('.rm-btn').forEach(b => b.addEventListener('click', e => removeFromCart(e.target.dataset.i)));
    }

    document.getElementById('btn-pay').addEventListener('click', () => { if(carrito.length>0) abrirModalCobro(); });

    function abrirModalCobro() {
        modal.style.display = 'flex';
        modalContent.innerHTML = `<h2 style="color:#64748b;margin:0">Total</h2><div style="font-size:2.5rem;font-weight:800;color:#1e293b;margin-bottom:20px">$${totalVenta.toFixed(2)}</div><input type="number" id="input-received" class="pay-input-giant" placeholder="Recibido" autofocus><div style="background:#f8fafc;padding:15px;border-radius:12px;margin-bottom:20px"><span style="color:#64748b">Cambio:</span><strong id="change-label" style="font-size:1.5rem;display:block">$0.00</strong></div><div style="display:flex;gap:10px"><button id="btn-cancel-modal" style="flex:1;padding:15px;border:none;background:#f1f5f9;border-radius:12px;cursor:pointer">Cancelar</button><button id="btn-confirm-pay" style="flex:2;padding:15px;border:none;background:#10b981;color:white;font-weight:bold;border-radius:12px;cursor:pointer;opacity:0.5" disabled>CONFIRMAR</button></div>`;
        const input = document.getElementById('input-received'), change = document.getElementById('change-label'), btn = document.getElementById('btn-confirm-pay');
        input.focus();
        input.addEventListener('input', e => {
            const val = parseFloat(e.target.value) || 0; const c = val - totalVenta;
            change.textContent = `$${c.toFixed(2)}`;
            if(c>=0) { change.style.color='#166534'; btn.disabled=false; btn.style.opacity="1"; }
            else { change.style.color='#dc2626'; btn.disabled=true; btn.style.opacity="0.5"; }
        });
        btn.addEventListener('click', () => procesarVenta(parseFloat(input.value)));
        document.getElementById('btn-cancel-modal').addEventListener('click', () => { modal.style.display = 'none'; searchInput.focus(); });
    }

    async function procesarVenta(recibido) {
        const venta = { date: new Date(), total: totalVenta, items: [...carrito], payment: { method: 'cash', received: recibido, change: recibido - totalVenta }, sync_status: 'pending' };
        await db.sales.add(venta);
        for(const i of carrito) { const p = await db.products.get(i.id); if(p){ p.stock-=i.cantidad; await db.products.put(p); } }
        productosGlobal = await db.products.toArray(); renderGrid(productosGlobal);
        if(navigator.onLine) await syncService.uploadSales();
        mostrarTicket(venta); carrito=[]; renderCart();
    }

    // --- 5. TICKET MEJORADO (MUESTRA DETALLES) ---
    function mostrarTicket(venta) {
        modalContent.innerHTML = `
            <div id="printable-area" style="text-align:center;font-family:'Courier New', monospace; padding:20px; background:white; max-width:350px; margin:0 auto;">
                <h3 style="margin:0; text-transform:uppercase;">Ferretería Universal</h3>
                <p style="font-size:0.8rem; margin-bottom:10px;">${venta.date.toLocaleString()}</p>
                <hr style="border-top:1px dashed #000;">
                
                <div style="text-align:left; font-size:0.9rem;">
                    ${venta.items.map(i=>`
                        <div style="margin-bottom:5px;">
                            <div>${i.cantidad} ${i.unit||'pz'} x ${i.name}</div>
                            <div style="display:flex; justify-content:space-between; color:#555; font-size:0.8rem;">
                                <span>($${i.price}/${i.unit||'pz'})</span>
                                <span style="font-weight:bold; color:black;">$${(i.price*i.cantidad).toFixed(2)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <hr style="border-top:1px dashed #000;">
                <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:1.1rem; margin-top:5px;">
                    <span>TOTAL</span><span>$${venta.total.toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span>Pago (${venta.payment.method}):</span><span>$${venta.payment.received.toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span>Cambio:</span><span>$${venta.payment.change.toFixed(2)}</span>
                </div>
                <p style="margin-top:15px; font-size:0.8rem;">¡Gracias por su compra!</p>
            </div>
            
            <div class="no-print" style="display:flex; gap:10px; margin-top:20px;">
                <button id="btn-print" style="flex:1; padding:10px; background:#334155; color:white; border:none; border-radius:8px; cursor:pointer;">🖨️ Imprimir</button>
                <button id="btn-new" style="flex:1; padding:10px; background:#10b981; color:white; border:none; border-radius:8px; cursor:pointer;">Cerrar</button>
            </div>
        `;
        document.getElementById('btn-print').addEventListener('click', () => window.print());
        document.getElementById('btn-new').addEventListener('click', () => { modal.style.display='none'; searchInput.focus(); });
    }

    try { 
        if(navigator.onLine) await syncService.downloadProducts(); 
        if(await isDbEmpty()) await seedDummyData(); 
        productosGlobal = await db.products.toArray(); 
        renderGrid(productosGlobal);
        checkPendingOrders(); 
    } catch(e){console.error(e);}
}