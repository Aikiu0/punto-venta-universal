// src/modules/pos/pos.js - POS FINAL: DATOS NEGOCIO REALES + TICKET SCROLLABLE + FIX DUPLICADOS
import { db } from '../../data/db-local.js';
import { supabase } from '../../data/supabase.js';
import { syncService } from '../../services/sync.js';
import { ThemeService } from '../../services/theme.js';

let carrito = [];
let productosGlobal = [];
let totalVenta = 0;
let audioContext = null;
let ordersCheckInterval = null;
// --- FIX: Flag para evitar múltiples sincronizaciones simultáneas ---
let isSyncing = false; 

// Variable para guardar los datos frescos de la tabla 'businesses'
let datosNegocio = {
    
    name: 'Mi Negocio',
    address: '',
    phone: '',
    logo_url: '',    // Nuevo
    ticket_footer: ''
};

// --- UTILIDAD: Generador de UUID v4 (Para evitar duplicados) ---
function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

export function renderPOS() {
    return `
        <div class="pos-layout">
            <style>
                /* --- ESTILOS OPTIMIZADOS --- */
                .products-grid {
                    display: grid;
                    gap: 12px;
                    padding: 15px;
                    overflow-y: auto;
                    height: calc(100vh - 150px);
                    align-content: start;
                }

                /* MODO LISTA */
                .products-grid.list-mode { grid-template-columns: 1fr; }
                .products-grid.list-mode .product-card {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    align-items: center;
                    padding: 16px 20px;
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.03);
                    cursor: pointer;
                    min-height: 80px;
                }
                .products-grid.list-mode .prod-name { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; line-height: 1.3; }
                .products-grid.list-mode .prod-meta { display: flex; gap: 10px; align-items: center; font-size: 0.85rem; color: var(--text-secondary); }
                .products-grid.list-mode .prod-price { font-size: 1.4rem; font-weight: 800; color: var(--brand-color); text-align: right; padding-left: 15px; border-left: 1px solid var(--border-color); margin-left: 15px; }

                /* MODO CUADRÍCULA */
                .products-grid.grid-mode { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
                .products-grid.grid-mode .product-card {
                    display: flex; flex-direction: column; justify-content: space-between;
                    height: 180px; padding: 15px; background: var(--bg-card);
                    border: 1px solid var(--border-color); border-radius: 12px;
                    cursor: pointer; text-align: center;
                }
                .products-grid.grid-mode .prod-name { font-size: 0.95rem; font-weight: 600; color: var(--text-primary); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
                .products-grid.grid-mode .prod-price { font-size: 1.2rem; font-weight: bold; color: var(--brand-color); margin-top: 10px; }

                /* Badges */
                .stock-badge { padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; letter-spacing: 0.5px; text-transform: uppercase; }
            </style>

            <div class="catalog-panel">
                <div class="catalog-header">
                    <div class="search-wrapper"><span class="search-icon"></span><input type="text" id="search" class="search-input" placeholder="Buscar producto..." autocomplete="off"></div>
                    <div style="display:flex; gap:5px;">
                        <button id="btn-view-list" class="view-btn active" title="Lista">☰</button>
                        <button id="btn-view-grid" class="view-btn" title="Cuadrícula">田</button>
                    </div>
                </div>
                <div id="product-container" class="products-grid list-mode"></div>
            </div>

            <div class="cart-panel">
                <div class="cart-header">
                    <div class="cart-title">Ticket</div>
                    <div class="header-actions">
                        <button id="pos-theme-toggle" class="icon-btn" title="Cambiar Tema">🌗</button>
                        <div style="position:relative;">
                            <button id="btn-web-orders" title="Pedidos Web" style="border:none; background:var(--bg-input); color:var(--text-secondary); border-radius:8px; width:42px; height:38px; cursor:pointer; font-size:1.3rem; display:flex; align-items:center; justify-content:center;">🔔</button>
                            <div id="orders-badge" style="position:absolute; top:-5px; right:-5px; background:#ef4444; color:white; border-radius:50%; width:20px; height:20px; font-size:0.75rem; font-weight:bold; display:none; justify-content:center; align-items:center; box-shadow:0 2px 5px rgba(0,0,0,0.2); z-index:10;">0</div>
                        </div>
                        <div id="connection-status" style="display:flex; align-items:center; gap:6px; padding:6px 12px; background:var(--bg-input); border-radius:20px; font-size:0.8rem; font-weight:bold; transition:all 0.3s; border:1px solid transparent;"><span>...</span></div>
                        <button id="btn-sync" class="icon-btn" title="Forzar Sincronización">🔄</button>
                        <button id="logout-btn" class="icon-btn" style="color:var(--danger-color);">⏻</button>
                    </div>
                </div>
                <div class="cart-items" id="cart-items"><p style="text-align:center;color:var(--text-secondary);margin-top:50px">Vacío</p></div>
                <div class="cart-footer">
                    <div class="summary-row"><span class="total-label">Total</span><span class="total-amount" id="cart-total">$0.00</span></div>
                    <button class="pay-btn-large" id="btn-pay">COBRAR ➔</button>
                </div>
            </div>

            <div class="modal-overlay" id="payment-modal"><div class="modal-card" id="modal-content"></div></div>
            
            <div id="toast-notification" style="position:fixed; top:20px; right:20px; background:var(--bg-card); color:var(--text-primary); padding:20px; border-radius:12px; box-shadow:0 20px 50px rgba(0,0,0,0.5); display:none; align-items:center; gap:15px; z-index:2147483647; border-left: 6px solid var(--success-bg); width: 300px; cursor:pointer; animation: slideIn 0.3s; border: 1px solid var(--border-color);">
                <div style="font-size:2rem;">🔔</div>
                <div>
                    <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">¡NUEVO PEDIDO!</div>
                    <div id="toast-msg" style="color:var(--text-secondary); font-size:0.9rem;">Cliente...</div>
                    <small style="color:var(--brand-color); font-weight:bold; margin-top:5px; display:block;">Clic para ver</small>
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

    const businessId = localStorage.getItem('archsell_business_id');
    
    if (!businessId) console.warn("⚠️ No se encontró ID de negocio.");
    async function safeSync() {
        if (isSyncing || !navigator.onLine) return;
        isSyncing = true;
        const btn = document.getElementById('btn-sync');
        if(btn) btn.innerHTML = "⏳"; // Feedback visual

        try {
            console.log("🔄 Iniciando sincronización segura...");
            await syncService.uploadSales();
            await db.products.clear();
            await syncService.downloadProducts();
            productosGlobal = await db.products.toArray();
            renderGrid(productosGlobal);
            checkPendingOrders();
            console.log("✅ Sincronización terminada");
        } catch (e) {
            console.error("Sync error:", e);
        } finally {
            isSyncing = false;
            if(btn) btn.innerHTML = "🔄";
        }
    }

    // --- CARGA Y REALTIME ---
    async function loadInitialData() {
        try {
            // 1. Cargar Productos
            productosGlobal = await db.products.toArray();
            renderGrid(productosGlobal);

            // 2. Cargar Datos del Negocio
            if (businessId && navigator.onLine) {
                const { data: bData } = await supabase.from('businesses').select('*').eq('id', businessId).single();
                if (bData) {
                    datosNegocio = {
                        id: bData.id,
                        name: bData.name || 'Mi Negocio',
                        address: bData.address || '',
                        phone: bData.phone || '',
                        logo_url: bData.logo_url || '',        // Leemos logo
                        ticket_footer: bData.ticket_footer || ''
                    };
                }
            }

            // 3. Sincronizar si hay red
            if (navigator.onLine) await safeSync();

        } catch (error) { console.error("Error cargando datos iniciales:", error); }
    }
    loadInitialData();

    if (businessId) {
        supabase.channel('realtime-products-pos')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${businessId}` }, 
                async (payload) => {
                    if (payload.eventType === 'DELETE') {
                        await db.products.delete(payload.old.id);
                        productosGlobal = productosGlobal.filter(p => p.id !== payload.old.id);
                        renderGrid(productosGlobal);
                    } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const newProd = payload.new;
                        await db.products.put(newProd);
                        const idx = productosGlobal.findIndex(p => p.id === newProd.id);
                        if (idx >= 0) productosGlobal[idx] = newProd; 
                        else productosGlobal.push(newProd);
                        
                        const currentSearch = searchInput.value.toLowerCase();
                        if (!currentSearch || newProd.name.toLowerCase().includes(currentSearch)) {
                            renderGrid(productosGlobal);
                        }
                    }
                }
            ).subscribe();
    }

    // --- UI HELPERS ---
    document.getElementById('pos-theme-toggle').addEventListener('click', () => ThemeService.toggle());
    
    function initAudio() {
        if (audioContext) return;
        try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); const osc = audioContext.createOscillator(); osc.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + 0.001); } catch(e) {}
    }
    document.addEventListener('click', initAudio, { once: true });
    function playSound() {
        if (!audioContext) initAudio();
        try { const osc = audioContext.createOscillator(); const gain = audioContext.createGain(); osc.connect(gain); gain.connect(audioContext.destination); osc.type = 'sine'; osc.frequency.setValueAtTime(500, audioContext.currentTime); osc.frequency.linearRampToValueAtTime(1000, audioContext.currentTime + 0.1); osc.start(); gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5); osc.stop(audioContext.currentTime + 0.5); } catch(e) {}
    }

    // --- PEDIDOS WEB ---
    async function checkPendingOrders() {
        if (!businessId) return;
        const { count, error } = await supabase.from('web_orders').select('*', { count: 'exact', head: true }).eq('status', 'pendiente').eq('business_id', businessId);
        if (!error) {
            const current = parseInt(badgeOrders.textContent) || 0;
            if (count > 0) {
                badgeOrders.style.display = "flex"; badgeOrders.textContent = count; 
                btnOrders.style.background = "var(--admin-bg)"; btnOrders.style.color = "var(--admin-text)";
                if (count > current) showToast("Nuevo Pedido Web");
            } else {
                badgeOrders.style.display = "none"; badgeOrders.textContent = "0"; 
                btnOrders.style.background = "var(--bg-input)"; btnOrders.style.color = "var(--text-secondary)";
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
    if (businessId) {
        supabase.channel('pos-orders').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'web_orders', filter: `business_id=eq.${businessId}` }, (payload) => { showToast(payload.new.customer_name || "Cliente Web"); checkPendingOrders(); }).subscribe();
    }
    if (ordersCheckInterval) clearInterval(ordersCheckInterval);
    ordersCheckInterval = setInterval(checkPendingOrders, 15000); 
    checkPendingOrders();

    btnOrders.addEventListener('click', openWebOrdersModal);
    
    async function openWebOrdersModal() {
        if (!businessId) return alert("Error: No ID");
        modal.style.display = 'flex';
        modalContent.innerHTML = `<p style="padding:20px;">Cargando...</p>`;
        
        const { data: orders } = await supabase.from('web_orders').select('*').eq('status', 'pendiente').eq('business_id', businessId).order('created_at', {ascending:false});

        if (!orders || orders.length === 0) {
            modalContent.innerHTML = `<div style="text-align:center; padding:30px;"><h3 style="color:var(--text-primary);">✅ Todo al día</h3><button id="btn-close-modal" style="margin-top:15px; padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); border-radius:5px; cursor:pointer;">Cerrar</button></div>`;
            document.getElementById('btn-close-modal').addEventListener('click', () => modal.style.display = 'none');
            checkPendingOrders(); 
            return;
        }

        let listHtml = orders.map(o => {
            let method = "Efectivo"; const meta = o.items.find(i => i.type === 'meta'); if (meta && meta.payment_method) method = meta.payment_method.toUpperCase();
            const itemsReales = o.items.filter(i => i.type !== 'meta');
            return `
                <div style="border:1px solid var(--border-color); padding:15px; margin-bottom:10px; border-radius:8px; border-left:4px solid var(--brand-color); text-align:left; background:var(--bg-card);">
                    <div style="display:flex; justify-content:space-between; font-weight:bold;"><span style="color:var(--text-primary);">${o.customer_name}</span><span style="color:var(--success-bg);">$${o.total.toFixed(2)}</span></div>
                    <div style="font-size:0.85rem; color:var(--text-secondary); margin:5px 0;">Pago: <strong>${method}</strong> | 📞 ${o.customer_contact}</div>
                    <div style="background:var(--bg-input); color:var(--text-primary); padding:10px; border-radius:5px; margin:10px 0;"><ul style="padding-left:20px; margin:0;">
                        ${itemsReales.map(i => `<li>${i.qty || i.cantidad} ${i.unit||'pz'} - ${i.name}</li>`).join('')}
                    </ul></div>
                    <div style="display:flex; gap:10px;">
                         <button class="btn-cancel-order" data-id="${o.id}" style="flex:1; padding:10px; background:var(--danger-color); color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">❌ Cancelar</button>
                         <button class="btn-deliver-order" data-id="${o.id}" style="flex:2; padding:10px; background:var(--success-bg); color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">✅ Entregar y Cobrar</button>
                    </div>
                </div>`;
        }).join('');
        modalContent.innerHTML = `<div style="text-align:center;"><h2 style="margin-top:0; color:var(--text-primary);">Pedidos Web</h2><div style="max-height:60vh; overflow-y:auto; padding:5px;">${listHtml}</div><button id="btn-close-modal" style="margin-top:15px; padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); border-radius:5px; cursor:pointer;">Cerrar</button></div>`;
        
        document.getElementById('btn-close-modal').addEventListener('click', () => modal.style.display = 'none');
        document.querySelectorAll('.btn-deliver-order').forEach(btn => btn.addEventListener('click', async (e) => { const order = orders.find(o => o.id == e.target.dataset.id); if(confirm(`¿Confirmar entrega?`)) await preFinalizeWebOrder(order); }));
        document.querySelectorAll('.btn-cancel-order').forEach(btn => btn.addEventListener('click', async (e) => { const order = orders.find(o => o.id == e.target.dataset.id); await cancelWebOrder(order); }));
    }

    async function cancelWebOrder(order) {
        if (!confirm(`¿El cliente NO llegó? Se cancelará el pedido y se RESTAURARÁ el stock.`)) return;
        try {
            const items = order.items.filter(i => i.type !== 'meta');
            await supabase.from('web_orders').update({ status: 'cancelado' }).eq('id', order.id);
            for (const item of items) {
                const qty = Number(item.qty || item.cantidad || 1);
                const { data: currentProd } = await supabase.from('products').select('stock').eq('id', item.id).single();
                if (currentProd) await supabase.from('products').update({ stock: currentProd.stock + qty }).eq('id', item.id);
            }
            alert("Pedido cancelado. Stock restaurado."); openWebOrdersModal(); 
        } catch (error) { console.error(error); alert("Error"); }
    }

    async function preFinalizeWebOrder(order) {
        let method = "EFECTIVO"; const meta = order.items.find(i => i.type === 'meta');
        if (meta && meta.payment_method) method = meta.payment_method.toUpperCase();
        if (method.includes("EFECTIVO")) abrirModalCobroWeb(order); else await saveWebSale(order, order.total, 0);
    }

    function abrirModalCobroWeb(order) {
        modal.style.display = 'flex';
        modalContent.innerHTML = `<h2 style="color:var(--text-secondary);margin:0">Cobro Pedido Web</h2><div style="font-size:2.5rem;font-weight:800;color:var(--text-primary);margin-bottom:20px">$${order.total.toFixed(2)}</div><input type="number" id="web-input-received" class="pay-input-giant" placeholder="Recibido" autofocus style="background:transparent; color:var(--text-primary); border-bottom:2px solid var(--border-color);"><div style="background:var(--bg-input);padding:15px;border-radius:12px;margin-bottom:20px"><span style="color:var(--text-secondary)">Cambio:</span><strong id="web-change-label" style="font-size:1.5rem;display:block;color:var(--text-primary);">$0.00</strong></div><div style="display:flex;gap:10px"><button id="btn-cancel-web" style="flex:1;padding:15px;border:none;background:var(--bg-input);color:var(--text-primary);border-radius:12px;cursor:pointer">Cancelar</button><button id="btn-confirm-web" style="flex:2;padding:15px;border:none;background:var(--success-bg);color:white;font-weight:bold;border-radius:12px;cursor:pointer;opacity:0.5" disabled>FINALIZAR</button></div>`;
        const input = document.getElementById('web-input-received'), change = document.getElementById('web-change-label'), btn = document.getElementById('btn-confirm-web');
        input.focus(); input.addEventListener('input', e => { const val = parseFloat(e.target.value)||0; const diff=val-order.total; change.textContent=`$${diff.toFixed(2)}`; if(diff>=0){change.style.color='var(--success-bg)';btn.disabled=false;btn.style.opacity="1";}else{change.style.color='var(--danger-color)';btn.disabled=true;btn.style.opacity="0.5";} });
        btn.addEventListener('click', () => saveWebSale(order, parseFloat(input.value), parseFloat(input.value)-order.total));
        document.getElementById('btn-cancel-web').addEventListener('click', () => openWebOrdersModal());
    }

    async function saveWebSale(order, received, change) {
        const btnConfirm = document.getElementById('btn-confirm-web');
    if(btnConfirm) { btnConfirm.disabled = true; btnConfirm.textContent = "Procesando..."; }

    try {
        const { data: authData } = await supabase.auth.getUser();
        
        // Normalizamos items para que SQL los entienda
        const itemsNormalizados = order.items.filter(i => i.type !== 'meta').map(i => ({ 
            id: i.id,
            name: i.name,
            price: i.price,
            cantidad: Number(i.qty || i.cantidad || 1), 
            unit: i.unit || 'pz' 
        }));

        const ventaUid = uuidv4(); // Generamos ID único

        const paymentData = { 
            method: "Web/Pickup", 
            customer: order.customer_name, 
            received: received, 
            change: change 
        };

        // LLAMADA A SQL: Registra la venta y marca entregado, PERO NO TOCA EL STOCK
        // (El stock ya se restó cuando se creó el pedido en shop.js)
        const { data: rpcData, error: rpcError } = await supabase.rpc('procesar_pedido_web', {
            // CORRECCIÓN AQUÍ: Usamos localStorage en vez de db.businesses
            p_business_id: datosNegocio.id || localStorage.getItem('archsell_business_id'),
            p_web_order_id: order.id,
            p_sale_id: ventaUid,
            p_user_id: authData.user.id,
            p_total: order.total,
            p_items: itemsNormalizados,
            p_payment_data: paymentData
        });

        if (rpcError) throw rpcError;
        if (!rpcData.success) throw new Error(rpcData.message);

        // Éxito: Limpiamos UI e imprimimos
        checkPendingOrders();
        mostrarTicket({ 
            uuid: ventaUid, 
            date: new Date(), 
            total: order.total, 
            items: itemsNormalizados, 
            payment: paymentData 
        });

    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
        if(btnConfirm) { btnConfirm.disabled = false; btnConfirm.textContent = "FINALIZAR"; }
    }
    }

    syncService.listenConnection(async (isOnline) => {
        if(isOnline) { 
            statusBadge.innerHTML = `📶 Conectado`; statusBadge.style.backgroundColor = "#dcfce7"; statusBadge.style.color = "#166534"; 
            await safeSync(); // Usar la función segura
        } 
        else { statusBadge.innerHTML = `📡 Desconectado`; statusBadge.style.backgroundColor = "#fee2e2"; statusBadge.style.color = "#991b1b"; }
    });
    
    document.getElementById('btn-sync').addEventListener('click', async () => { 
        const btn = document.getElementById('btn-sync'); 
        btn.innerHTML = "⏳"; 
        await safeSync(); 
        btn.innerHTML = "🔄"; 
    });
    
    document.getElementById('logout-btn').addEventListener('click', async () => { if(ordersCheckInterval) clearInterval(ordersCheckInterval); supabase.removeAllChannels(); await supabase.auth.signOut(); router.navigate('/'); });

    // --- EVENTOS VISTA ---
    document.getElementById('btn-view-list').addEventListener('click', () => { container.className = 'products-grid list-mode'; document.getElementById('btn-view-list').classList.add('active'); document.getElementById('btn-view-grid').classList.remove('active'); });
    document.getElementById('btn-view-grid').addEventListener('click', () => { container.className = 'products-grid grid-mode'; document.getElementById('btn-view-grid').classList.add('active'); document.getElementById('btn-view-list').classList.remove('active'); });

    // --- BUSQUEDA ---
    searchInput.focus();
    document.addEventListener('click', (e) => { if(modal.style.display !== 'flex' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') searchInput.focus(); });
    searchInput.addEventListener('input', (e) => { const q = e.target.value.toLowerCase(); renderGrid(productosGlobal.filter(p => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)))); });
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { const q = searchInput.value.trim().toLowerCase(); if (!q) return; const p = productosGlobal.find(p => (p.sku && p.sku.toLowerCase() === q) || p.name.toLowerCase() === q); if (p) { p.stock > 0 || p.is_bulk ? (addToCart(p), searchInput.value='') : (alert("Agotado"), searchInput.value=''); } else { alert("No encontrado"); searchInput.value=''; } } });

    // --- RENDER GRID ---
    function renderGrid(products) {
        container.innerHTML = '';
        if(products.length === 0) { container.innerHTML = `<div style="text-align:center; padding:20px; width:100%; color:var(--text-secondary);">No hay productos. Sincroniza 🔄</div>`; return; }

        products.forEach(p => {
            const card = document.createElement('div'); card.className = 'product-card';
            let stockColor = '#10b981', stockBg = 'rgba(16, 185, 129, 0.1)';
            if (p.stock <= 5) { stockColor = '#f59e0b'; stockBg = 'rgba(245, 158, 11, 0.1)'; }
            if (p.stock <= 0) { stockColor = '#ef4444'; stockBg = 'rgba(239, 68, 68, 0.1)'; }
            if (p.is_bulk) { stockColor = '#3b82f6'; stockBg = 'rgba(59, 130, 246, 0.1)'; }

            const displayStock = p.is_bulk ? parseFloat(p.stock).toFixed(2) : p.stock;

            card.innerHTML = `
                <div class="prod-info-wrapper" style="text-align:left;">
                    <div class="prod-name">${p.name}</div>
                    <div class="prod-meta">
                        <span class="stock-badge" style="color:${stockColor}; background:${stockBg};">${displayStock} ${p.unit || 'pz'}</span>
                        <span style="opacity:0.7;">${p.sku || ''}</span>
                    </div>
                </div>
                <div class="prod-price">$${parseFloat(p.price).toFixed(2)}</div>
            `;
            card.addEventListener('click', () => { if(p.stock > 0 || p.is_bulk) addToCart(p); else alert("Producto Agotado"); });
            container.appendChild(card);
        });
    }

    // --- CARRITO ---
    function addToCart(p) {
        let qty = 1;
        if (p.is_bulk) { let val = prompt(`Granel: ${p.name}\nStock: ${p.stock}\n¿Cantidad?`, "1"); if(val===null) return; qty = parseFloat(val.replace(',','.')); if(isNaN(qty) || qty<=0) return alert("Inválido"); }
        const ex = carrito.find(i=>i.id===p.id);
        if(!p.is_bulk && (ex ? ex.cantidad : 0) + qty > p.stock) return alert("Stock insuficiente");
        if(ex) { ex.cantidad += qty; ex.cantidad = Math.round(ex.cantidad*1000)/1000; } else carrito.push({...p, cantidad: qty});
        renderCart();
    }
    function updateCartItemQty(index, newQty) { const item = carrito[index]; if(newQty <= 0) { if(confirm("¿Quitar?")) carrito.splice(index, 1); } else { if(!item.is_bulk && newQty > item.stock) { alert(`Stock máximo: ${item.stock}`); carrito[index].cantidad = item.stock; } else { carrito[index].cantidad = newQty; } } renderCart(); }
    function removeFromCart(idx) { carrito.splice(idx, 1); renderCart(); }
    function renderCart() {
        cartItemsContainer.innerHTML = ''; totalVenta = 0;
        if(carrito.length===0) { cartItemsContainer.innerHTML = `<div style="text-align:center;color:var(--text-secondary);margin-top:50px"><div style="font-size:3rem">🛒</div><p>Vacío</p></div>`; cartTotalLabel.textContent='$0.00'; return; }
        carrito.forEach((item, idx) => {
            totalVenta += item.price * item.cantidad;
            const unit = item.unit || 'pz';
            const qtyInput = `<input type="number" class="qty-input-pos" data-idx="${idx}" value="${item.cantidad}" style="width:50px; padding:5px; text-align:center; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); border-radius:4px; font-weight:bold;">`;
            const div = document.createElement('div'); div.className = 'cart-item';
            div.innerHTML = `<div><div style="font-weight:bold;color:var(--text-primary)">${item.name}</div><div style="color:var(--text-secondary); display:flex; align-items:center; gap:5px; margin-top:5px;">${qtyInput} <span style="font-size:0.9rem;">${unit} x $${item.price}</span></div></div><div style="display:flex;align-items:center;gap:10px"><div style="font-weight:bold;color:var(--brand-color)">$${(item.price*item.cantidad).toFixed(2)}</div><button class="rm-btn" data-i="${idx}" style="color:var(--danger-color);border:none;background:none;cursor:pointer">×</button></div>`;
            cartItemsContainer.appendChild(div);
        });
        cartTotalLabel.textContent = `$${totalVenta.toFixed(2)}`;
        document.querySelectorAll('.qty-input-pos').forEach(input => { input.addEventListener('change', (e) => updateCartItemQty(parseInt(e.target.dataset.idx), parseFloat(e.target.value))); input.addEventListener('focus', (e) => e.target.select()); });
        document.querySelectorAll('.rm-btn').forEach(b => b.addEventListener('click', e => removeFromCart(e.target.dataset.i)));
    }

    document.getElementById('btn-pay').addEventListener('click', () => { if(carrito.length>0) abrirModalCobro(); });

    function abrirModalCobro() {
        modal.style.display = 'flex';
        modalContent.innerHTML = `
            <h2 style="color:var(--text-secondary);margin:0">Total</h2>
            <div style="font-size:2.5rem;font-weight:800;color:var(--text-primary);margin-bottom:20px">$${totalVenta.toFixed(2)}</div>
            <input type="number" id="input-received" class="pay-input-giant" placeholder="Recibido" autofocus style="background:transparent; color:var(--text-primary); border-bottom:2px solid var(--border-color);">
            <div style="background:var(--bg-input);padding:15px;border-radius:12px;margin-bottom:20px">
                <span style="color:var(--text-secondary)">Cambio:</span>
                <strong id="change-label" style="font-size:1.5rem;display:block;color:var(--text-primary)">$0.00</strong>
            </div>
            <div style="display:flex;gap:10px">
                <button id="btn-cancel-modal" style="flex:1;padding:15px;border:none;background:var(--bg-input);color:var(--text-primary);border-radius:12px;cursor:pointer">Cancelar</button>
                <button id="btn-confirm-pay" style="flex:2;padding:15px;border:none;background:var(--success-bg);color:white;font-weight:bold;border-radius:12px;cursor:pointer;opacity:0.5" disabled>CONFIRMAR</button>
            </div>`;
        const input = document.getElementById('input-received'), change = document.getElementById('change-label'), btn = document.getElementById('btn-confirm-pay');
        input.focus();
        input.addEventListener('input', e => { const val = parseFloat(e.target.value) || 0; const c = val - totalVenta; change.textContent = `$${c.toFixed(2)}`; if(c>=0) { change.style.color='var(--success-bg)'; btn.disabled=false; btn.style.opacity="1"; } else { change.style.color='var(--danger-color)'; btn.disabled=true; btn.style.opacity="0.5"; } });
        btn.addEventListener('click', () => procesarVenta(parseFloat(input.value), btn));
        document.getElementById('btn-cancel-modal').addEventListener('click', () => { modal.style.display = 'none'; searchInput.focus(); });
    }

    // --- PROCESAMIENTO DE VENTA (Con Idempotencia Fix) ---
    async function procesarVenta(recibido, btnElement) {
        if (!businessId) { alert("Error: ID negocio no encontrado. Recargue."); return; }
        
        if(btnElement) { btnElement.disabled = true; btnElement.textContent = "Procesando..."; btnElement.style.opacity = "0.7"; }

        try {
            const itemsForRpc = carrito.map(item => ({ id: item.id, qty: item.cantidad }));
            const itemsTicket = [...carrito]; 
            const totalFinal = totalVenta;
            const ventaUid = uuidv4(); 

            // FIX DUPLICACIÓN: Añadido "id: ventaUid" para asegurar idempotencia al sincronizar.
            // Si el servicio de sync sube esto 2 veces, Supabase rechazará/ignorará la segunda porque el ID ya existe.
            const venta = { 
                id: ventaUid, // <--- ESTA LINEA ES LA CLAVE DE LA CORRECCION
                uuid: ventaUid, 
                date: new Date(), 
                total: totalFinal, 
                items: itemsTicket, 
                items_rpc: itemsForRpc, 
                payment: { method: 'cash', received: recibido, change: recibido - totalFinal }, 
                sync_status: 'pending', 
                business_id: businessId 
            };
            
            await db.sales.add(venta);

            for(const i of itemsTicket) { 
                const p = await db.products.get(i.id); 
                if(p && !p.is_bulk){ p.stock -= i.cantidad; await db.products.put(p); } 
            }
            productosGlobal = await db.products.toArray(); 
            renderGrid(productosGlobal);

            carrito=[]; renderCart(); mostrarTicket(venta); 

            if(navigator.onLine) {
                // Usamos safeSync en lugar de llamar directo al servicio para evitar colisiones
                safeSync()
                    .then(() => console.log("Sincronización post-venta exitosa"))
                    .catch(err => console.warn("Sincronización pendiente:", err));
            }

        } catch (error) {
            console.error("Error crítico en venta:", error);
            alert("Hubo un error al guardar la venta: " + error.message);
            if(btnElement) { btnElement.disabled = false; btnElement.textContent = "CONFIRMAR"; btnElement.style.opacity = "1"; }
        }
    }

    // --- CORRECCIÓN VISUAL DEL TICKET ---
    function mostrarTicket(venta) {
    const s = datosNegocio;

        const styleInjection = `
            <style>
                .ticket-container {
                color: var(--text-primary);
                background: var(--bg-card);
                }  

                @media print {
                .ticket-container {
                    color: #000 !important;
                    background: #fff !important;
                }
                }
                
                /* HEADER: Logo Izquierda - Info Derecha */
                .ticket-header-flex {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
                border-bottom: 1px dashed #000;
                padding-bottom: 6px;
                }

                .ticket-logo-img {
                    width: 40px;
                    height: auto;
                    flex-shrink: 0;
                }

                .ticket-info-col {
                    text-align: right;
                    flex-grow: 1;
                    font-size: 11px;
                    line-height: 1.3;
                }

                .ticket-store-name {
                    font-weight: bold;
                    font-size: 13px;
                }
                /* TABLA ITEMS */
                .dashed-line { border-top: 1px dashed #000; margin: 5px 0; }
                .items-header { display: flex; font-weight: bold; font-size: 0.8rem; margin-bottom: 5px; }
                .items-header span:nth-child(1) { width: 30px; } 
                .items-header span:nth-child(2) { flex: 1; }
                .items-header span:nth-child(3) { width: 60px; text-align: right; }
                
                .ticket-item-row { display: flex; font-size: 0.85rem; margin-bottom: 3px; }
                .t-qty { width: 30px; }
                .t-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .t-price { width: 60px; text-align: right; }

                /* TOTALES */
                .ticket-totals { margin-top: 10px; text-align: right; }
                .total-row { display: flex; justify-content: space-between; font-size: 0.9rem; }
                .total-row.big { font-weight: bold; font-size: 1.1rem; margin-bottom: 5px; }

                /* --- FOOTER CENTRADO (CORREGIDO) --- */
                .footer-centered-container {
                    margin-top: 20px;
                    text-align: center !important; /* Fuerza centrado de texto */
                    display: flex;
                    flex-direction: column;
                    align-items: center; /* Centra elementos bloque */
                    width: 100%;
                }
                
                /* Textos de despedida */
                .footer-text {
                    font-size: 0.85rem;
                    margin: 2px 0;
                    width: 100%;
                    text-align: center;
                }

                /* Caja de Leyenda (Admin) */
                .ticket-legend-box {
                    margin-top: 10px; 
                    padding-top: 10px;
                    border-top: 1px dashed #000;
                    width: 100%;
                    text-align: center !important; /* Centrado forzoso */
                    font-size: 0.8rem; 
                    font-weight: bold;
                    white-space: pre-wrap; 
                    padding-bottom: 30px;
                }

                /* Código de Barras */
                #barcode {
                    width: 100%;
                    max-width: 1800px;
                    height: 40px;
                    margin: 8px auto; /* Auto margin centra bloques */
                    display: block;
                }
                
                @media print {
                    .ticket-scroll-area { overflow: visible !important; max-height: none !important; border: none; }
                    .modal-card { box-shadow: none; border: none; padding: 0; }
                    .no-print { display: none !important; }
                }
                    .ticket-end-space {
                    height: 40px;
                    }
            </style>
        `;

        // Preparamos HTMLs
        const logoHtml = s.logo_url 
            ? `<img src="${s.logo_url}" class="ticket-logo-img" alt="Logo" onerror="this.style.display='none'">` 
            : '';

        const footerHtml = s.ticket_footer 
            ? `<div class="ticket-legend-box">${s.ticket_footer}</div>` 
            : '<div style="padding-bottom:20px;"></div>';

        modalContent.innerHTML = `
            ${styleInjection}
            <div id="printable-area" class="ticket-container">
                <div class="ticket-scroll-area">
                    
                    <div class="ticket-header-flex">
                        ${logoHtml}
                        <div class="ticket-info-col">
                            <div class="ticket-store-name">${s.name}</div>
                            ${s.address ? `<div>${s.address}</div>` : ''}
                            ${s.phone ? `<div>Tel: ${s.phone}</div>` : ''}
                            <div style="margin-top:4px;">${new Date(venta.date).toLocaleString()}</div>
                        </div>
                    </div>
                    
                    <div class="items-header"><span>CANT</span><span>DESCRIPCIÓN</span><span>IMPORTE</span></div>
                    <div class="dashed-line"></div>
                    
                    <div style="width:100%;">
                        ${venta.items.map(i => `
                            <div class="ticket-item-row">
                                <div class="t-qty">${i.cantidad}</div>
                                <div class="t-name">${i.name}</div>
                                <div class="t-price">$${(i.price * i.cantidad).toFixed(2)}</div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="dashed-line"></div>
                    <div class="ticket-totals">
                        <div class="total-row big"><span>TOTAL</span><span>$${venta.total.toFixed(2)}</span></div>
                        <div class="total-row"><span>Efectivo:</span><span>$${venta.payment.received.toFixed(2)}</span></div>
                        <div class="total-row"><span>Cambio:</span><span>$${venta.payment.change.toFixed(2)}</span></div>
                    </div>
                    
                    <div class="footer-centered-container">
                        <svg id="barcode"></svg>
                        <div style="font-size: 0.7rem; text-align:center; margin-bottom:5px;">${venta.uuid}</div>

                        <div class="footer-text">¡GRACIAS POR SU COMPRA!</div>
                        <div class="footer-text">*** VUELVA PRONTO ***</div>
                        
                        ${footerHtml}
                    </div>

                </div>
            </div>
            <div class="no-print" style="flex-shrink: 0; margin-top:10px; display:flex; gap:10px; flex-direction:column;">
                <button onclick="window.print()" class="pay-btn-large" style="padding:12px; font-size:1rem; background: var(--text-primary); color: var(--bg-card);">🖨️ Imprimir</button>
                <button id="close-ticket" style="padding:12px; border:1px solid var(--border-color); background:transparent; color:var(--text-secondary); border-radius:12px; cursor:pointer; font-weight:bold;">Cerrar</button>
            </div>
            <div class="ticket-end-space"></div>
        `;

        // Generar Código de Barras (con pequeño delay para asegurar renderizado)
        setTimeout(() => {
            if (window.JsBarcode) {
                JsBarcode("#barcode", venta.uuid, {
                    format: "CODE128",
                    width: 1.2,
                    height: 32,
                    displayValue: false,
                    margin: 0
                });
            }
        }, 100);

        const closeBtn = document.getElementById('close-ticket');
        if(closeBtn) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; document.getElementById('search').focus(); });
    }
}