// src/modules/pos/pos.js - DISEÑO PREMIUM + LÓGICA DÍA 7
import { db, isDbEmpty, seedDummyData } from '../../data/db-local.js';
import { supabase } from '../../data/supabase.js';
import { syncService } from '../../services/sync.js';

let carrito = [];
let productosGlobal = [];
let totalVenta = 0;

export function renderPOS() {
    return `
        <div class="pos-layout">
            <div class="catalog-panel">
                <div class="catalog-header">
                    <div class="search-wrapper">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="search" class="search-input" placeholder="Buscar producto o escanear código..." autocomplete="off">
                    </div>
                    <button id="btn-view-list" class="view-btn active" title="Vista Lista">☰</button>
                    <button id="btn-view-grid" class="view-btn" title="Vista Imágenes">田</button>
                </div>

                <div id="product-container" class="products-grid list-mode">
                    </div>
            </div>

            <div class="cart-panel">
                <div class="cart-header">
                    <div class="cart-title">Ticket de Venta</div>
                    
                    <div class="header-actions">
                        <div id="connection-status" style="display:flex; align-items:center; padding:0 10px; background:#f1f5f9; border-radius:8px; font-size:0.8rem; font-weight:bold; color:#64748b;">
                            ⚫ Conectando
                        </div>

                        <button id="btn-sync" class="icon-btn" title="Sincronizar">🔄</button>
                        
                        <button id="btn-back-admin" class="icon-btn admin-btn" style="display:none;" title="Ir al Admin">🛠️</button>
                        
                        <button id="logout-btn" class="icon-btn" title="Salir" style="color:#ef4444;">⏻</button>
                    </div>
                </div>
                
                <div class="cart-items" id="cart-items">
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#94a3b8;">
                        <div style="font-size:3rem; margin-bottom:10px;">🛒</div>
                        <p>El carrito está vacío</p>
                        <small>Escanea un producto para comenzar</small>
                    </div>
                </div>

                <div class="cart-footer">
                    <div class="summary-row">
                        <span class="total-label">Total a Pagar</span>
                        <span class="total-amount" id="cart-total">$0.00</span>
                    </div>
                    <button class="pay-btn-large" id="btn-pay">
                        COBRAR <span>➔</span>
                    </button>
                    <div style="text-align:center; margin-top:10px; font-size:0.8rem; color:#94a3b8;">
                        Cajero: <span id="user-display">...</span>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="payment-modal">
                <div class="modal-card" id="modal-content"></div>
            </div>
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

    // --- 1. IDENTIDAD & NAVEGACIÓN ---
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        document.getElementById('user-display').textContent = user.email.split('@')[0]; // Mostrar solo nombre antes del @
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile && profile.role === 'admin') {
            const btnAdmin = document.getElementById('btn-back-admin');
            btnAdmin.style.display = 'flex';
            btnAdmin.addEventListener('click', () => router.navigate('/admin'));
        }
    }

    const btnLogout = document.getElementById('logout-btn');
    if (btnLogout) btnLogout.addEventListener('click', async () => { await supabase.auth.signOut(); router.navigate('/'); });

    // --- 2. SINCRONIZACIÓN ---
    syncService.listenConnection(async (isOnline) => {
        if (isOnline) {
            statusBadge.innerHTML = `<span style="color:#166534">● Online</span>`;
            statusBadge.style.background = "#dcfce7";
            statusBadge.style.color = "#166534";
            await syncService.uploadSales();
        } else {
            statusBadge.innerHTML = `<span style="color:#991b1b">● Offline</span>`;
            statusBadge.style.background = "#fee2e2";
            statusBadge.style.color = "#991b1b";
        }
    });

    document.getElementById('btn-sync').addEventListener('click', async () => {
        const btn = document.getElementById('btn-sync'); 
        btn.innerHTML = "⏳";
        await syncService.uploadSales(); await syncService.downloadProducts();
        productosGlobal = await db.products.toArray(); renderGrid(productosGlobal);
        btn.innerHTML = "🔄";
    });

    // --- 3. INTERFAZ Y BÚSQUEDA ---
    searchInput.focus();
    document.addEventListener('click', (e) => {
        if (modal.style.display !== 'flex' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') searchInput.focus();
    });

    document.getElementById('btn-view-list').addEventListener('click', (e) => {
        container.className = 'products-grid list-mode';
        updateActiveViewBtn(e.target);
    });
    document.getElementById('btn-view-grid').addEventListener('click', (e) => {
        container.className = 'products-grid grid-mode';
        updateActiveViewBtn(e.target);
    });

    function updateActiveViewBtn(activeBtn) {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        activeBtn.classList.add('active');
    }

    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        renderGrid(productosGlobal.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const q = searchInput.value.trim().toLowerCase();
            if (!q) return;
            const p = productosGlobal.find(p => p.sku.toLowerCase() === q || p.name.toLowerCase() === q);
            if (p) {
                if(p.stock > 0) { addToCart(p); searchInput.value = ''; }
                else { alert("⛔ Producto Agotado"); searchInput.value = ''; }
            } else { alert("❌ No encontrado"); searchInput.value = ''; }
        }
    });

    // --- 4. RENDERIZADO DE PRODUCTOS (CON NUEVO ESTILO) ---
    function renderGrid(products) {
        container.innerHTML = '';
        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            
            const unit = p.unit || 'pz';
            let stockClass = 'background:#dcfce7; color:#166534;'; // Verde
            if (p.stock <= 10) stockClass = 'background:#fee2e2; color:#991b1b;'; // Rojo
            if (p.stock === 0) stockClass = 'background:#f1f5f9; color:#64748b;'; // Gris

            card.innerHTML = `
                <div class="prod-info">
                    <div class="prod-name">${p.name}</div>
                    <div class="prod-sku">${p.sku || 'SIN CÓDIGO'}</div>
                    <div class="stock-badge" style="${stockClass}">
                        ${p.stock} ${unit}
                    </div>
                </div>
                <div class="prod-price">$${p.price}</div>
            `;
            
            card.addEventListener('click', () => { if(p.stock > 0) addToCart(p); else alert("Agotado"); });
            container.appendChild(card);
        });
    }

    // --- 5. LÓGICA CARRITO (CON UNIDADES Y GRANEL) ---
    function addToCart(p) {
        let cantidad = 1;
        const unit = p.unit || 'pz';

        if (p.is_bulk) {
            let input = prompt(`📏 Venta a Granel: ${p.name}\nStock: ${p.stock} ${unit}\nPrecio: $${p.price}/${unit}\n\n¿Cuántos ${unit} necesitas?`, "1");
            if (input === null) return;
            input = input.replace(',', '.'); 
            cantidad = parseFloat(input);
            if (isNaN(cantidad) || cantidad <= 0) return alert("Cantidad inválida");
        }

        const existe = carrito.find(i => i.id === p.id);
        const cantActual = existe ? existe.cantidad : 0;
        
        if (cantActual + cantidad > p.stock) return alert(`⚠️ Stock insuficiente. Solo quedan ${p.stock} ${unit}`);

        if (existe) {
            existe.cantidad += cantidad;
            existe.cantidad = Math.round(existe.cantidad * 1000) / 1000;
        } else {
            carrito.push({ ...p, cantidad: cantidad });
        }
        renderCart();
    }

    function removeFromCart(idx) { carrito.splice(idx, 1); renderCart(); }

    function renderCart() {
        cartItemsContainer.innerHTML = ''; totalVenta = 0;
        
        if (carrito.length === 0) {
            cartItemsContainer.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#94a3b8;">
                    <div style="font-size:3rem; margin-bottom:10px; opacity:0.5;">🛒</div>
                    <p>Carrito vacío</p>
                </div>`;
            cartTotalLabel.textContent = '$0.00';
            return;
        }
        
        carrito.forEach((item, idx) => {
            const unit = item.unit || 'pz';
            const subtotal = item.price * item.cantidad;
            totalVenta += subtotal;
            
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div>
                    <div style="font-weight:bold; color:#334155;">${item.name}</div>
                    <div style="font-size:0.85rem; color:#64748b;">${item.cantidad} ${unit} x $${item.price}</div>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <div style="font-weight:bold; color:#1e293b;">$${subtotal.toFixed(2)}</div>
                    <button class="rm-btn" data-i="${idx}" style="color:#ef4444; border:none; background:none; cursor:pointer; font-size:1.1rem;">×</button>
                </div>`;
            cartItemsContainer.appendChild(div);
        });
        cartTotalLabel.textContent = `$${totalVenta.toFixed(2)}`;
        document.querySelectorAll('.rm-btn').forEach(b => b.addEventListener('click', (e) => removeFromCart(e.target.dataset.i)));
    }

    // --- 6. COBRO (MODAL PREMIUM) ---
    document.getElementById('btn-pay').addEventListener('click', () => {
        if (carrito.length === 0) return; // No alerta, solo no hace nada
        abrirModalCobro();
    });

    function abrirModalCobro() {
        modal.style.display = 'flex';
        modalContent.innerHTML = `
            <h2 style="color:#64748b; font-size:1rem; margin:0;">Total a Pagar</h2>
            <div style="font-size:2.5rem; font-weight:800; color:#1e293b; margin-bottom:20px;">$${totalVenta.toFixed(2)}</div>
            
            <input type="number" id="input-received" class="pay-input-giant" placeholder="Recibido" autofocus>
            
            <div style="background:#f8fafc; padding:15px; border-radius:12px; margin-bottom:20px;">
                <span style="color:#64748b;">Cambio:</span>
                <strong id="change-label" style="font-size:1.5rem; display:block; margin-top:5px;">$0.00</strong>
            </div>

            <div style="display:flex; gap:10px;">
                <button id="btn-cancel-modal" style="flex:1; padding:15px; border:none; background:#f1f5f9; color:#64748b; font-weight:bold; border-radius:12px; cursor:pointer;">Cancelar</button>
                <button id="btn-confirm-pay" style="flex:2; padding:15px; border:none; background:#10b981; color:white; font-weight:bold; border-radius:12px; cursor:pointer; opacity:0.5;" disabled>CONFIRMAR</button>
            </div>
        `;

        const inputReceived = document.getElementById('input-received');
        const changeLabel = document.getElementById('change-label');
        const btnConfirm = document.getElementById('btn-confirm-pay');
        inputReceived.focus();

        inputReceived.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            const cambio = val - totalVenta;
            changeLabel.textContent = `$${cambio.toFixed(2)}`;
            
            if(cambio >= 0) { 
                changeLabel.style.color = '#166534'; 
                btnConfirm.disabled = false; btnConfirm.style.opacity = "1"; btnConfirm.style.boxShadow = "0 4px 15px rgba(16,185,129,0.4)";
            } else { 
                changeLabel.style.color = '#dc2626'; 
                btnConfirm.disabled = true; btnConfirm.style.opacity = "0.5"; btnConfirm.style.boxShadow = "none";
            }
        });

        btnConfirm.addEventListener('click', () => procesarVenta(parseFloat(inputReceived.value)));
        document.getElementById('btn-cancel-modal').addEventListener('click', () => { modal.style.display = 'none'; searchInput.focus(); });
    }

    async function procesarVenta(recibido) {
        const venta = {
            date: new Date(), total: totalVenta, items: [...carrito],
            payment: { method: 'cash', received: recibido, change: recibido - totalVenta },
            sync_status: 'pending'
        };
        await db.sales.add(venta);
        for (const item of carrito) {
            const p = await db.products.get(item.id);
            if (p) { p.stock -= item.cantidad; await db.products.put(p); }
        }
        productosGlobal = await db.products.toArray(); renderGrid(productosGlobal);
        if (navigator.onLine) await syncService.uploadSales();
        mostrarTicket(venta);
        carrito = []; renderCart();
    }

    function mostrarTicket(venta) {
        modalContent.innerHTML = `
            <div style="text-align:center; font-family:'Courier New', monospace; padding:20px; background:#fff; border:1px dashed #ccc;">
                <h3 style="margin:0 0 10px 0;">FERRETERÍA UNIVERSAL</h3>
                <p style="font-size:0.8rem;">${venta.date.toLocaleString()}</p>
                <hr style="border-top:1px dashed #000;">
                <div style="text-align:left; font-size:0.9rem;">
                    ${venta.items.map(i => `<div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span>${i.cantidad} ${i.unit||'pz'} x ${i.name}</span>
                        <span>$${(i.price*i.cantidad).toFixed(2)}</span>
                    </div>`).join('')}
                </div>
                <hr style="border-top:1px dashed #000;">
                <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:1.2rem;">
                    <span>TOTAL</span><span>$${venta.total.toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:5px;"><span>Efectivo:</span><span>$${venta.payment.received.toFixed(2)}</span></div>
                <div style="display:flex; justify-content:space-between;"><span>Cambio:</span><span>$${venta.payment.change.toFixed(2)}</span></div>
                <p style="margin-top:20px;">¡Gracias por su compra!</p>
            </div>
            <div class="no-print" style="display:flex; gap:10px; margin-top:20px;">
                <button id="btn-print" style="flex:1; padding:12px; background:#334155; color:white; border:none; border-radius:8px; cursor:pointer;">🖨️ Imprimir</button>
                <button id="btn-new-sale" style="flex:1; padding:12px; background:#10b981; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Nueva Venta</button>
            </div>`;
        document.getElementById('btn-print').addEventListener('click', () => window.print());
        document.getElementById('btn-new-sale').addEventListener('click', () => { modal.style.display = 'none'; searchInput.value = ''; searchInput.focus(); });
    }

    // --- 7. INICIALIZACIÓN ---
    try {
        if (navigator.onLine) await syncService.downloadProducts();
        if (await isDbEmpty()) { if (confirm("¿Cargar demo?")) await seedDummyData(); }
        productosGlobal = await db.products.toArray(); renderGrid(productosGlobal);
    } catch (e) { console.error(e); container.innerHTML = "Error cargando BD"; }
}