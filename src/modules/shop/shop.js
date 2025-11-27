// src/modules/shop/shop.js - VERSIÓN DEBUG
import { supabase } from '../../data/supabase.js';

let shopCart = [];
let shopProducts = [];
let currentBusiness = null; 

export function renderShop() {
    return `
        <div id="shop-root" class="shop-layout" style="min-height:100vh; background:var(--bg-body); font-family:'Montserrat', sans-serif;">
            <div class="loading-screen" style="padding:100px; text-align:center; color:var(--text-secondary);">
                <h2>Cargando...</h2>
            </div>
        </div>
    `;
}

// --- VISTA 1: MARKETPLACE ---
function renderMarketplace() {
    return `
        <div class="marketplace-wrapper" style="min-height:100vh; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding-bottom:50px;">
            <div style="text-align:center; padding:60px 20px; color:white;">
                <h1 style="font-size:3rem; margin-bottom:10px;">Bienvenido a ArchSell</h1>
                <p style="font-size:1.2rem; opacity:0.9; max-width:600px; margin:0 auto;">La red de ferreterías más confiable.</p>
                <div style="position:relative; max-width:600px; margin:40px auto 0;">
                    <input type="text" id="store-finder" placeholder="Buscar ferretería..." 
                        style="width:100%; padding:18px 20px; border-radius:50px; border:none; font-size:1.1rem; box-shadow:0 10px 30px rgba(0,0,0,0.2); outline:none; color:#333;">
                </div>
            </div>
            <div class="marketplace-container" style="max-width:1000px; margin:0 auto; padding:20px;">
                <h3 style="color:white; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">Tiendas Disponibles</h3>
                <div id="stores-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:25px;">
                    <p style="color:white;">Cargando tiendas...</p>
                </div>
            </div>
        </div>
    `;
}

// --- VISTA 2: TIENDA ---
function renderStoreUI(business) {
    const logo = business.logo_url || '';
    const name = business.name || 'Tienda';
    const color = business.primary_color || '#7A3F9D'; 
    
    return `
        <div class="shop-layout">
            <header class="shop-header" style="display: flex; justify-content: space-between; align-items: center; gap: 15px; background:white; padding:15px 20px; box-shadow:0 2px 10px rgba(0,0,0,0.05); position:sticky; top:0; z-index:100;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    ${logo ? `<img src="${logo}" style="height: 45px; width:auto; border-radius: 5px;">` : ''}
                    <div>
                        <a href="#/shop?s=${business.slug}" style="text-decoration: none; color: #1f2937; font-weight: 800; font-size: 1.2rem; line-height:1.2; display:block;">${name}</a>
                        <a href="#/shop" style="font-size:0.85rem; color:#6b7280; text-decoration:none;">← Directorio</a>
                    </div>
                </div>
                <nav class="shop-nav" style="display:flex; align-items:center;">
                    <button id="btn-open-cart" class="btn-cart-float" style="
    border:none;
    cursor:pointer;
    background:${color};
    color:white;
    width:56px;
    height:56px;
    border-radius:50%;
    font-size:1.4rem;
    display:flex;
    align-items:center;
    justify-content:center;
    position:relative;
    box-shadow:0 6px 18px rgba(0,0,0,0.25);
    transition:transform 0.2s;
">
    🛒
    <span id="cart-count" style="
        position:absolute;
        top:-6px;
        right:-6px;
        min-width:20px;
        height:20px;
        background:#ef4444;
        color:white;
        border-radius:50%;
        font-size:0.7rem;
        font-weight:800;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:2px;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
    ">0</span>
</button>
                </nav>
            </header>

            <div class="shop-hero" style="background: linear-gradient(135deg, ${color} 0%, #1e293b 100%); padding:60px 20px; text-align:center; color:white;">
                <h1 style="margin:0; font-size:2.5rem; text-shadow:0 2px 5px rgba(0,0,0,0.2);">Catálogo en Línea</h1>
                <p style="opacity:0.95; font-size:1.1rem; margin-top:10px;">Haz tu pedido y pasa a recoger.</p>
            </div>

            <div class="shop-container" style="padding:40px 20px; max-width:1200px; margin:0 auto; display:grid; grid-template-columns: 220px 1fr; gap:40px;">
                <aside class="shop-filters" style="display:block;">
                    <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 2px 15px rgba(0,0,0,0.03);">
                        <span style="font-weight:bold; display:block; margin-bottom:15px; font-size:1.1rem; color:#333;">Categorías</span>
                        <ul id="shop-categories" style="list-style:none; padding:0; margin:0;">
                            <li class="category-item active" data-cat="all" style="padding:10px; cursor:pointer; border-radius:8px; margin-bottom:5px; background:#f3f4f6; color:#333; font-weight:bold;">Todas</li>
                        </ul>
                    </div>
                </aside>
                <main>
                    <div id="shop-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:25px;">
                        <p style="grid-column: 1/-1; text-align: center; padding: 50px; color:#666;">Cargando productos...</p>
                    </div>
                </main>
            </div>

            <div class="shop-modal-overlay" id="cart-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:flex-end; backdrop-filter:blur(2px);">
                <div class="shop-drawer" style="background:white; width:100%; max-width:450px; height:100%; display:flex; flex-direction:column; box-shadow:-5px 0 30px rgba(0,0,0,0.2); color:#333;">
                    
                    <div class="drawer-header" style="padding:20px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; background:#f8f9fa; flex-shrink:0;">
                        <div class="drawer-title" style="font-weight:bold; font-size:1.2rem; color:#111;">Tu Pedido</div>
                        <button id="btn-close-cart" style="background:none; border:none; font-size:2rem; cursor:pointer; color:#666; line-height:1;">&times;</button>
                    </div>
                    
                    <div class="drawer-body" id="cart-body" style="flex:1; overflow-y:auto; padding:20px;"></div>
                </div>
            </div>
            <style>
                @media(max-width:768px) { .shop-container { grid-template-columns: 1fr; } .shop-filters { display:none !important; } }
            </style>
        </div>
    `;
}

export async function setupShopLogic(router) {
    const root = document.getElementById('shop-root');
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const storeSlug = params.get('s');

    if (!storeSlug) {
        root.innerHTML = renderMarketplace();
        setupMarketplaceLogic();
    } else {
        await loadStore(storeSlug);
    }

    async function setupMarketplaceLogic() {
        const grid = document.getElementById('stores-grid');
        const search = document.getElementById('store-finder');
        const { data: stores } = await supabase.from('businesses').select('id, name, slug, logo_url, primary_color').limit(50);
        
        function renderStoreCards(list) {
            if(!list || list.length === 0) return grid.innerHTML = '<p style="color:white;">No se encontraron tiendas.</p>';
            grid.innerHTML = list.map(s => `
                <div onclick="window.location.hash='#/shop?s=${s.slug}'; location.reload();" 
                     style="background:white; border-radius:16px; padding:25px; text-align:center; cursor:pointer; transition:transform 0.2s; box-shadow:0 4px 15px rgba(0,0,0,0.1); position:relative; overflow:hidden;">
                    <div style="position:absolute; top:0; left:0; width:100%; height:6px; background:${s.primary_color || '#7A3F9D'};"></div>
                    <div style="height:80px; display:flex; align-items:center; justify-content:center; margin-bottom:15px;">
                        ${s.logo_url ? `<img src="${s.logo_url}" style="max-height:70px; max-width:100%; object-fit:contain;">` : '<span style="font-size:3.5rem;">🏪</span>'}
                    </div>
                    <h3 style="margin:0 0 5px 0; font-size:1.2rem; color:#1f2937; font-weight:bold;">${s.name}</h3>
                    <p style="margin:0; color:#6b7280; font-size:0.9rem;">Ver catálogo &rarr;</p>
                </div>
            `).join('');
        }
        renderStoreCards(stores || []);
        search.addEventListener('input', (e) => renderStoreCards(stores.filter(s => s.name.toLowerCase().includes(e.target.value.toLowerCase()))));
    }

    async function loadStore(slug) {
        try {
            const { data: business, error } = await supabase.from('businesses').select('*').eq('slug', slug).single();
            if (error || !business) {
                root.innerHTML = `<div style="text-align:center; padding:100px; color:#fff;"><h2>🚫 Tienda no encontrada</h2><a href="#/shop" style="color:#4ade80;">Volver al directorio</a></div>`;
                return;
            }
            currentBusiness = business;
            root.innerHTML = renderStoreUI(business);
            setupStoreInteractions();
            loadCatalog(business.id);
        } catch (err) { console.error(err); }
    }

    async function loadCatalog(businessId) {
        const { data: cats } = await supabase.from('categories').select('*').eq('business_id', businessId);
        const { data: prods } = await supabase.from('products').select('*').eq('business_id', businessId).gt('stock', 0);
        shopProducts = prods || [];
        renderProducts(shopProducts);
        
        if (cats) {
            const catList = document.getElementById('shop-categories');
            catList.innerHTML = `<li class="category-item active" data-cat="all" style="padding:10px; cursor:pointer; border-radius:8px; margin-bottom:5px; background:#e5e7eb; color:#333; font-weight:bold;">Todas</li>`;
            cats.forEach(c => {
                const li = document.createElement('li');
                li.className = 'category-item'; li.textContent = c.name;
                li.style.cssText = "padding:10px; cursor:pointer; border-radius:8px; margin-bottom:5px; color:#666; transition:0.2s;";
                li.addEventListener('click', () => {
                    document.querySelectorAll('.category-item').forEach(i => {i.style.background='transparent'; i.style.fontWeight='normal'; i.style.color='#666';});
                    li.style.background = '#e5e7eb'; li.style.fontWeight='bold'; li.style.color='#333';
                    renderProducts(shopProducts.filter(p => p.category === c.name));
                });
                catList.appendChild(li);
            });
            catList.querySelector('[data-cat="all"]').addEventListener('click', (e) => {
                document.querySelectorAll('.category-item').forEach(i => {i.style.background='transparent'; i.style.fontWeight='normal'; i.style.color='#666';});
                e.target.style.background = '#e5e7eb'; e.target.style.fontWeight='bold'; e.target.style.color='#333';
                renderProducts(shopProducts);
            });
        }
    }

    function renderProducts(products) {
        const grid = document.getElementById('shop-grid');
        grid.innerHTML = '';
        if (products.length === 0) return grid.innerHTML = `<p style="text-align:center; width:100%; color:#666;">No hay productos disponibles.</p>`;

        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            card.style.cssText = "background:white; border:1px solid #eee; border-radius:12px; overflow:hidden; transition:transform 0.2s; display:flex; flex-direction:column; box-shadow:0 2px 8px rgba(0,0,0,0.05);";
            const unit = p.unit || 'pz';
            const bulkBadge = p.is_bulk ? `<span style="font-size:0.7rem; background:#e0f2fe; color:#0284c7; padding:2px 6px; border-radius:4px; font-weight:bold;">GRANEL</span>` : '';

            card.innerHTML = `
                <div style="height:160px; background:#f8fafc; display:flex; align-items:center; justify-content:center; font-size:3.5rem;">📦</div>
                <div style="padding:15px; flex:1; display:flex; flex-direction:column;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span style="font-size:0.75rem; color:#9ca3af; text-transform:uppercase; font-weight:bold; letter-spacing:0.5px;">${p.category || 'General'}</span>${bulkBadge}
                    </div>
                    <h3 style="margin:0 0 5px 0; font-size:1.1rem; color:#1f2937; font-weight:700; line-height:1.3;">${p.name}</h3>
                    <div style="margin-top:auto;">
                        <div style="font-size:1.4rem; font-weight:800; color:#10b981; margin:5px 0;">$${p.price.toFixed(2)} <span style="font-size:0.8rem; color:#9ca3af; font-weight:normal;">/${unit}</span></div>
                        <small style="color:#6b7280; display:block; margin-bottom:10px;">Disponible: <b>${p.stock}</b></small>
                        <button class="btn-add" style="width:100%; padding:12px; background:${currentBusiness.primary_color || '#7A3F9D'}; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; transition:0.2s;">Agregar al Carrito</button>
                    </div>
                </div>
            `;
            card.querySelector('.btn-add').addEventListener('click', () => addToCart(p));
            grid.appendChild(card);
        });
    }

    function setupStoreInteractions() {
        const overlay = document.getElementById('cart-overlay');
        document.getElementById('btn-open-cart').addEventListener('click', () => {
            if(shopCart.length === 0) return alert("Tu carrito está vacío");
            overlay.style.display = 'flex';
            renderCartDrawer();
        });
        document.getElementById('btn-close-cart').addEventListener('click', () => overlay.style.display = 'none');
        overlay.addEventListener('click', (e) => { if(e.target===overlay) overlay.style.display='none'; });
    }

    function addToCart(p) {
        const ex = shopCart.find(i=>i.id===p.id);
        if((ex?ex.qty:0)+1 > p.stock) return alert("Sin stock suficiente");
        if(ex) ex.qty += 1; else shopCart.push({...p, qty: 1});
        updateCartUI();
        renderCartDrawer();
        const btn = document.getElementById('btn-open-cart');
        if (btn) {
        btn.style.transform = 'scale(1.15)';
        setTimeout(() => btn.style.transform = 'scale(1)', 150);}
    }

    function updateCartUI() {
        const count = shopCart.reduce((a,b) => a + b.qty, 0); 
        const el = document.getElementById('cart-count');
        if(el) el.textContent = Math.floor(count);
    }

    function updateItemQty(index, newQty) {
        const item = shopCart[index];
        if(newQty <= 0) {
            if(confirm("¿Quitar producto?")) shopCart.splice(index, 1);
        } else if (newQty > item.stock) {
            alert(`Stock insuficiente. Máximo: ${item.stock}`);
            shopCart[index].qty = item.stock;
        } else {
            shopCart[index].qty = parseFloat(newQty.toFixed(3));
        }
        updateCartUI();
        renderCartDrawer();
    }

    function renderCartDrawer() {
        const body = document.getElementById('cart-body');
        if(!body) return;
        let total = 0;
        const itemsHtml = shopCart.map((item, idx) => {
            const subtotal = item.price * item.qty;
            total += subtotal;
            
            let qtyControl = '';
            if (item.is_bulk) {
                qtyControl = `
                    <div style="display:flex; align-items:center; gap:5px;">
                        <input type="number" class="qty-input-bulk" data-idx="${idx}" value="${item.qty}" step="0.1" min="0.1" style="width:60px; padding:5px; text-align:center; border:1px solid #ddd; border-radius:4px;">
                        <span style="font-size:0.8rem; color:#666;">${item.unit}</span>
                    </div>
                `;
            } else {
                qtyControl = `
                    <div style="display:flex; align-items:center; border:1px solid #ddd; border-radius:4px; overflow:hidden;">
                        <button class="qty-btn" data-idx="${idx}" data-chg="-1" style="width:30px; height:30px; border:1px solid #ddd; background:#fff; border-radius:5px; cursor:pointer; color:#333;">-</button>
                        <input type="number" class="qty-input-direct" data-idx="${idx}" value="${item.qty}" min="1" step="1" max="${item.stock}" 
                            style="width:50px; text-align:center; padding:5px; border:none; font-weight:bold; color:#1f2937; background:white;">
                        <button class="qty-btn" data-idx="${idx}" data-chg="1" style="width:30px; height:30px; border:1px solid #ddd; background:#fff; border-radius:5px; cursor:pointer; color:#333;">+</button>
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
                                <div style="font-weight:bold; color:#1f2937;">$${subtotal.toFixed(2)}</div>
                                <small style="color:#999;">$${item.price}/${item.unit}</small>
                            </div>
                        </div>
                    </div>
                    <button class="rm-item" data-idx="${idx}" style="margin-left:15px; color:#ef4444; border:none; background:transparent; cursor:pointer;">🗑️</button>
                </div>
            `;
        }).join('');

        body.innerHTML = `
            <div style="margin-bottom:20px;">${itemsHtml}</div>
            <div class="drawer-footer" style="margin-top:20px; padding-top:20px; border-top:2px solid #f3f4f6;">
                <div class="checkout-total" style="display:flex; justify-content:space-between; font-size:1.3rem; font-weight:800; margin-bottom:25px; color:#1f2937;">
                    <span>Total:</span><span>$${total.toFixed(2)}</span>
                </div>
                <div class="form-checkout">
                    <input type="text" id="client-name" placeholder="Tu Nombre Completo" required style="width:100%; padding:14px; margin-bottom:10px; border:1px solid #ddd; border-radius:10px; background:white; color:#1f2937;">
                    <input type="text" id="client-phone" placeholder="WhatsApp / Teléfono" required style="width:100%; padding:14px; margin-bottom:10px; border:1px solid #ddd; border-radius:10px; background:white; color:#1f2937;">
                    <select id="payment-method" style="width:100%; padding:14px; margin-bottom:20px; border:1px solid #ddd; border-radius:10px; background:white; color:#1f2937;">
                        <option value="efectivo">💵 Efectivo (Contra entrega)</option>
                        <option value="tarjeta">💳 Tarjeta (En tienda)</option>
                        <option value="transferencia">📲 Transferencia</option>
                    </select>
                    <button id="btn-checkout" class="btn-checkout" style="width:100%; padding:16px; background:${currentBusiness.primary_color || '#7A3F9D'}; color:white; border:none; border-radius:10px; font-weight:bold; font-size:1.1rem; cursor:pointer;">Confirmar Pedido</button>
                </div>
            </div>
        `;

        body.querySelectorAll('.qty-btn').forEach(b => b.addEventListener('click', e => updateItemQty(parseInt(e.target.dataset.idx), shopCart[parseInt(e.target.dataset.idx)].qty + parseInt(e.target.dataset.chg))));
        body.querySelectorAll('.qty-input-direct, .qty-input-bulk').forEach(inp => inp.addEventListener('change', e => updateItemQty(parseInt(e.target.dataset.idx), parseFloat(e.target.value))));
        body.querySelectorAll('.rm-item').forEach(b => b.addEventListener('click', e => { shopCart.splice(e.target.dataset.idx, 1); renderCartDrawer(); updateCartUI(); if(shopCart.length===0) document.getElementById('cart-overlay').style.display='none'; }));
        document.getElementById('btn-checkout').addEventListener('click', submitOrder);
    }

    async function submitOrder() {
        const name = document.getElementById('client-name').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const method = document.getElementById('payment-method').value;

    if (!name || !phone) return alert("Por favor llena tus datos.");

    const btn = document.getElementById('btn-checkout');
    btn.textContent = "Procesando...";
    btn.disabled = true;

    const total = shopCart.reduce((acc, i) => acc + (i.price * i.qty), 0);

    const itemsToSave = [
        ...shopCart.map(i => ({ id: i.id, name: i.name, qty: i.qty, unit: i.unit, price: i.price })),
        { type: 'meta', payment_method: method }
    ];

    try {
        /* ---------------------------------------------------------
           1. CREAR PEDIDO WEB
        --------------------------------------------------------- */
        const { error: orderError } = await supabase.from('web_orders').insert({
            customer_name: name,
            customer_contact: phone,
            items: itemsToSave,
            total: total,
            status: 'pendiente',
            business_id: currentBusiness.id
        });

        if (orderError) throw orderError;

        /* ---------------------------------------------------------
           2. DESCONTAR STOCK DIRECTAMENTE (MULTI-TENANT SEGURO)
        --------------------------------------------------------- */
        for (const item of shopCart) {
            const { data: product, error: prodError } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.id)
                .eq('business_id', currentBusiness.id)
                .single();

            if (prodError || !product) {
                throw new Error(`Producto no encontrado: ${item.name}`);
            }

            if (product.stock < item.qty) {
                throw new Error(`Stock insuficiente para ${item.name}`);
            }

            const { error: updateError } = await supabase
                .from('products')
                .update({ stock: product.stock - item.qty })
                .eq('id', item.id)
                .eq('business_id', currentBusiness.id);

            if (updateError) throw updateError;
        }

        /* ---------------------------------------------------------
           3. ÉXITO VISUAL
        --------------------------------------------------------- */
        shopCart = [];
        updateCartUI();

        const cartBody = document.getElementById('cart-body');
        cartBody.innerHTML = `
            <div class="success-view" style="text-align:center; padding:30px 10px;">
                <div style="font-size:4rem; margin-bottom:10px;">✅</div>
                <h2 style="margin-bottom:10px;">¡Pedido Recibido!</h2>
                <p>Reservado en <strong>${currentBusiness.name}</strong></p>
                <div style="background:#f8f9fa; padding:20px; border-radius:12px; margin-bottom:20px;">
                    <p><strong>Cliente:</strong> ${name}</p>
                    <p><strong>Total:</strong> $${total.toFixed(2)}</p>
                </div>
                <button id="btn-finish" style="width:100%; padding:15px; background:#111; color:white; border:none; border-radius:10px; font-weight:bold;">Cerrar</button>
            </div>
        `;

        document.getElementById('btn-finish').addEventListener('click', () => {
            document.getElementById('cart-overlay').style.display = 'none';
            loadCatalog(currentBusiness.id);
        });

    } catch (err) {
        console.error("🔥 Error en submitOrder:", err);
        alert("Error: " + err.message);
        btn.textContent = "Confirmar Pedido";
        btn.disabled = false;
    }
    }
}