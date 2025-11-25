// src/modules/shop/shop.js - TIENDA DINÁMICA MULTI-TENANT (FIXED)
import { supabase } from '../../data/supabase.js';
import { SettingsService } from '../../services/settings.js';

// ID DEL NEGOCIO DEMO (Para que la tienda sepa a quién comprarle)
const DEMO_BUSINESS_ID = '00000000-0000-0000-0000-000000000001';

// Estado del Carrito y Productos
let shopCart = [];
let shopProducts = [];

export function renderShop() {
    const s = SettingsService.get();

    return `
        <div class="shop-layout">
            <header class="shop-header" style="display: flex; align-items: center; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 10px; flex-grow: 1;">
                    <img src="${s.logo_url}" class="app-logo-img" style="height: 40px; width: auto; display: ${s.logo_url ? 'block' : 'none'}; border-radius: 5px;">
                    <a href="#/shop" class="brand-logo app-name" style="text-decoration: none; color: inherit; font-weight: bold; font-size: 1.2rem;">
                        ${s.store_name || 'Mi Tienda'}
                    </a>
                </div>

                <nav class="shop-nav">
                    <button id="btn-open-cart" class="btn-cart-float" style="border:none; cursor:pointer;">
                        🛒 <span id="cart-count">0</span>
                    </button>
                </nav>
            </header>

            <div class="shop-hero">
                <h1>Todo para tu proyecto</h1>
                <p>Haz tu pedido en línea y pasa a recoger.</p>
            </div>

            <div class="shop-container">
                <aside class="shop-filters">
                    <span class="filter-title">Categorías</span>
                    <ul class="category-list" id="shop-categories">
                        <li class="category-item active" data-cat="all">Todas</li>
                        <li style="color:#ccc; font-size:0.8rem;">Cargando...</li>
                    </ul>
                </aside>

                <main>
                    <div id="shop-grid" class="shop-grid">
                        <p style="grid-column: 1/-1; text-align: center; padding: 50px;">Cargando productos...</p>
                    </div>
                </main>
            </div>

            <div class="shop-modal-overlay" id="cart-overlay">
                <div class="shop-drawer">
                    <div class="drawer-header">
                        <div class="drawer-title">Tu Pedido</div>
                        <button id="btn-close-cart" class="btn-close-drawer">×</button>
                    </div>
                    
                    <div class="drawer-body" id="cart-body">
                    </div>
                </div>
            </div>
        </div>
    `;
}

export async function setupShopLogic(router) {
    const s = SettingsService.get();
    const logoEl = document.querySelector('.shop-header .app-logo-img');
    const nameEl = document.querySelector('.shop-header .app-name');
    
    if (s.logo_url && logoEl) {
        logoEl.src = s.logo_url;
        logoEl.style.display = 'block';
    }
    if (s.store_name && nameEl) {
        nameEl.textContent = s.store_name;
    }
    const grid = document.getElementById('shop-grid');
    const catList = document.getElementById('shop-categories');
    const cartCount = document.getElementById('cart-count');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartBody = document.getElementById('cart-body');

    // --- 1. CARGAR DATOS ---
    async function loadData() {
        // Categorías (Filtradas por negocio)
        const { data: cats } = await supabase
            .from('categories')
            .select('*')
            .eq('business_id', DEMO_BUSINESS_ID); // <--- FIX

        if (cats) {
            catList.innerHTML = `<li class="category-item active" data-cat="all">Todas</li>`;
            cats.forEach(c => {
                const li = document.createElement('li');
                li.className = 'category-item';
                li.textContent = c.name;
                li.addEventListener('click', () => filterProducts(c.name, li));
                catList.appendChild(li);
            });
            catList.querySelector('[data-cat="all"]').addEventListener('click', (e) => filterProducts('all', e.target));
        }

        // Productos (Solo con stock positivo y del negocio correcto)
        const { data: prods } = await supabase
            .from('products')
            .select('*')
            .eq('business_id', DEMO_BUSINESS_ID) // <--- FIX
            .gt('stock', 0);
            
        if (prods) {
            shopProducts = prods;
            renderProducts(shopProducts);
        }
    }

    function renderProducts(products) {
        grid.innerHTML = '';
        if (products.length === 0) return grid.innerHTML = `<p style="text-align:center; width:100%;">No hay productos disponibles.</p>`;

        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            
            const unit = p.unit || 'pz';
            const bulkBadge = p.is_bulk ? `<span style="font-size:0.7rem; background:#e0f2fe; color:#0284c7; padding:2px 6px; border-radius:4px;">Granel</span>` : '';

            card.innerHTML = `
                <div class="card-img-placeholder">📦</div>
                <div class="card-body">
                    <div style="display:flex; justify-content:space-between;">
                        <span class="card-cat">${p.category}</span>
                        ${bulkBadge}
                    </div>
                    <div class="card-title">${p.name}</div>
                    <div class="card-price">$${p.price.toFixed(2)} <span style="font-size:0.8rem; color:#999; font-weight:normal;">/${unit}</span></div>
                    <div style="font-size:0.8rem; color:#64748b; margin-bottom:10px;">
                        Disponible: ${p.stock} ${unit}
                    </div>
                    <button class="btn-add-cart">Agregar</button>
                </div>
            `;
            card.querySelector('button').addEventListener('click', () => addToCart(p));
            grid.appendChild(card);
        });
    }

    function filterProducts(cat, el) {
        document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
        if (cat === 'all') renderProducts(shopProducts);
        else renderProducts(shopProducts.filter(p => p.category === cat));
    }

    // --- 2. LÓGICA CARRITO ---
    
    function addToCart(p) {
        let cantidad = 1;
        const unit = p.unit || 'pz';

        // Si es a granel, preguntar cantidad inicial
        if (p.is_bulk) {
            let input = prompt(`📏 Producto a Granel: ${p.name}\nPrecio: $${p.price}/${unit}\nDisponible: ${p.stock}\n\n¿Cuántos ${unit} necesitas?`, "1");
            if (input === null) return; 
            
            input = input.replace(',', '.'); 
            cantidad = parseFloat(input);

            if (isNaN(cantidad) || cantidad <= 0) return alert("Cantidad inválida");
        }

        // Validar Stock
        const existing = shopCart.find(i => i.id === p.id);
        const currentQty = existing ? existing.qty : 0;

        if (currentQty + cantidad > p.stock) {
            return alert(`⚠️ Solo hay ${p.stock} ${unit} disponibles.`);
        }

        if (existing) {
            existing.qty += cantidad;
            existing.qty = Math.round(existing.qty * 1000) / 1000;
        } else {
            shopCart.push({ ...p, qty: cantidad });
        }
        
        updateCartUI();
        renderCartDrawer();
        
        // Animación
        const btn = document.getElementById('btn-open-cart');
        btn.style.transform = "scale(1.2)";
        setTimeout(() => btn.style.transform = "scale(1)", 200);
    }

    function updateCartUI() {
        const count = shopCart.length; 
        document.getElementById('cart-count').textContent = count;
    }

    function updateItemQty(index, newQty) {
        if (newQty <= 0) {
            if(confirm("¿Quitar producto del carrito?")) shopCart.splice(index, 1);
        } else {
            const item = shopCart[index];
            if (newQty > item.stock) {
                alert(`⚠️ Stock insuficiente. Máximo: ${item.stock}`);
                shopCart[index].qty = item.stock;
            } else {
                shopCart[index].qty = parseFloat(newQty.toFixed(3));
            }
        }
        updateCartUI();
        renderCartDrawer();
    }

    function renderCartDrawer() {
        if (shopCart.length === 0) {
            cartBody.innerHTML = `<div style="text-align:center; margin-top:50px; color:#999;">
                <p>Tu carrito está vacío 😢</p>
                <button id="btn-start-shopping" style="margin-top:10px; padding:10px; border:1px solid #ccc; background:white; border-radius:5px; cursor:pointer;">Seguir comprando</button>
            </div>`;
            document.getElementById('btn-start-shopping')?.addEventListener('click', () => cartOverlay.style.display = 'none');
            return;
        }

        let total = 0;
        const itemsHtml = shopCart.map((item, idx) => {
            const subtotal = item.price * item.qty;
            total += subtotal;
            const unit = item.unit || 'pz';
            const isBulk = item.is_bulk;

            let qtyControl = '';
            if (isBulk) {
                qtyControl = `
                    <div style="display:flex; align-items:center; gap:5px;">
                        <input type="number" class="qty-input-bulk" data-idx="${idx}" value="${item.qty}" step="0.1" min="0.1" style="width:60px; padding:5px; text-align:center; border:1px solid #ddd; border-radius:4px;">
                        <span style="font-size:0.8rem; color:#666;">${unit}</span>
                    </div>
                `;
            } else {
                qtyControl = `
                    <div style="display:flex; align-items:center; border:1px solid #ddd; border-radius:4px; overflow:hidden;">
                        <button class="btn-qty-change" data-idx="${idx}" data-change="-1" style="padding:5px 10px; border:none; background:#f8f9fa; cursor:pointer;">-</button>
                        <span style="padding:0 10px; font-size:0.9rem; min-width:30px; text-align:center;">${item.qty}</span>
                        <button class="btn-qty-change" data-idx="${idx}" data-change="1" style="padding:5px 10px; border:none; background:#f8f9fa; cursor:pointer;">+</button>
                    </div>
                `;
            }

            return `
                <div class="cart-item-row">
                    <div class="cart-item-info" style="flex:1;">
                        <h4 style="margin:0 0 5px 0;">${item.name}</h4>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            ${qtyControl}
                            <div style="text-align:right; margin-left:10px;">
                                <div style="font-weight:bold;">$${subtotal.toFixed(2)}</div>
                                <small style="color:#999;">$${item.price}/${unit}</small>
                            </div>
                        </div>
                    </div>
                    <button class="btn-remove-item" data-idx="${idx}" style="margin-left:15px; color:#ef4444; border:none; background:transparent; cursor:pointer;">🗑️</button>
                </div>
            `;
        }).join('');

        cartBody.innerHTML = `
            <div style="margin-bottom:20px;">${itemsHtml}</div>
            
            <div class="drawer-footer">
                <div class="checkout-total">
                    <span>Total Estimado:</span>
                    <span>$${total.toFixed(2)}</span>
                </div>
                
                <div class="form-checkout">
                    <h4 style="margin-bottom:10px; color:#333;">Datos para recoger:</h4>
                    <input type="text" id="client-name" placeholder="Tu Nombre Completo" required>
                    <input type="text" id="client-phone" placeholder="Teléfono / WhatsApp" required>
                    
                    <label style="font-size:0.9rem; display:block; margin-top:10px;">¿Cómo pagarás?</label>
                    <select id="payment-method" style="width:100%; padding:12px; margin-bottom:15px; border:1px solid #ddd; border-radius:8px;">
                        <option value="efectivo">💵 Efectivo</option>
                        <option value="tarjeta">💳 Tarjeta</option>
                        <option value="transferencia">📲 Transferencia</option>
                    </select>

                    <button id="btn-checkout" class="btn-checkout">Confirmar Pedido</button>
                </div>
            </div>
        `;

        // Listeners
        document.querySelectorAll('.btn-qty-change').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const change = parseInt(e.target.dataset.change);
                updateItemQty(idx, shopCart[idx].qty + change);
            });
        });

        document.querySelectorAll('.qty-input-bulk').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const val = parseFloat(e.target.value);
                if(!isNaN(val)) updateItemQty(idx, val);
            });
        });

        document.querySelectorAll('.btn-remove-item').forEach(b => {
            b.addEventListener('click', (e) => {
                shopCart.splice(e.target.dataset.idx, 1);
                updateCartUI();
                renderCartDrawer();
            });
        });

        document.getElementById('btn-checkout').addEventListener('click', submitOrder);
    }

    // --- 3. ENVIAR PEDIDO (FIXED RPC & BUSINESS_ID) ---
    async function submitOrder() {
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        const method = document.getElementById('payment-method').value; 
        
        if (!name || !phone) return alert("Por favor llena tus datos.");

        const btn = document.getElementById('btn-checkout');
        btn.textContent = "Procesando...";
        btn.disabled = true;

        const total = shopCart.reduce((acc, i) => acc + (i.price * i.qty), 0);
        
        // Preparar items limpios para guardar en JSONB
        const itemsToSave = [...shopCart.map(i => ({
            id: i.id,
            name: i.name,
            qty: i.qty,
            unit: i.unit,
            price: i.price
        })), { type: 'meta', payment_method: method }];

        // Preparar items limpios para el RPC (Stock)
        const itemsForRpc = shopCart.map(item => ({
            id: item.id,
            qty: item.qty
        }));

        const orderData = {
            customer_name: name,
            customer_contact: phone,
            items: itemsToSave,
            total: total,
            status: 'pendiente',
            business_id: DEMO_BUSINESS_ID // <--- FIX CRÍTICO: ID DEL NEGOCIO
        };

        try {
            // A. Insertar Pedido
            const { error: orderError } = await supabase.from('web_orders').insert(orderData);
            if (orderError) throw orderError;

            // B. Restar Stock (RPC Nuevo) - Una sola llamada eficiente
            const { error: rpcError } = await supabase.rpc('process_sale_inventory', { 
                p_business_id: DEMO_BUSINESS_ID,
                p_items: itemsForRpc
            });

            if (rpcError) throw rpcError;

            // C. Refrescar visualmente el stock en la tienda
            await loadData(); 

            // D. Éxito
            shopCart = [];
            updateCartUI();
            cartBody.innerHTML = `
                <div class="success-view">
                    <span class="success-icon">✅</span>
                    <h3>¡Pedido Recibido!</h3>
                    <p>Tu pedido ha sido reservado.</p>
                    <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin:15px 0; text-align:left;">
                        <p><strong>Cliente:</strong> ${name}</p>
                        <p><strong>Pago:</strong> ${method.toUpperCase()}</p>
                        <p><strong>Total:</strong> $${total.toFixed(2)}</p>
                    </div>
                    <p style="font-size:0.9rem; color:#666;">Pasa a recogerlo a la tienda.</p>
                    <button id="btn-finish" class="btn-checkout" style="margin-top:20px;">Cerrar</button>
                </div>
            `;
            document.getElementById('btn-finish').addEventListener('click', () => {
                cartOverlay.style.display = 'none';
            });

        } catch (err) {
            console.error(err);
            alert("Error al procesar pedido. Intenta de nuevo.");
            btn.textContent = "Confirmar Pedido";
            btn.disabled = false;
        }
    }

    // --- EVENTOS GENERALES ---
    document.getElementById('btn-open-cart').addEventListener('click', () => {
        if(shopCart.length === 0) return alert("Tu carrito está vacío");
        cartOverlay.style.display = 'flex';
        renderCartDrawer();
    });

    document.getElementById('btn-close-cart').addEventListener('click', () => {
        cartOverlay.style.display = 'none';
    });

    cartOverlay.addEventListener('click', (e) => {
        if (e.target === cartOverlay) cartOverlay.style.display = 'none';
    });

    // INICIO
    loadData();
}