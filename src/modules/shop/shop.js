// src/modules/shop/shop.js
import { supabase } from '../../data/supabase.js';
import '../../css/shop.css'; 

let shopCart = [];
let shopProducts = [];
let currentBusiness = null; 

export function renderShop() {
    return `
        <div id="shop-root" class="shop-layout">
            <div class="loading-screen" style="height:100vh; display:flex; align-items:center; justify-content:center; color:#64748b;">
                <div style="text-align:center;">
                    <div style="font-size:3rem; margin-bottom:10px;">🏪</div>
                    <h2>Cargando Tienda...</h2>
                </div>
            </div>
        </div>
    `;
}

// --- VISTA 1: MARKETPLACE ---
function renderMarketplace() {
    return `
        <div class="marketplace-wrapper">
            <div class="marketplace-header">
                <h1 class="marketplace-title">Bienvenido a ArchSell</h1>
                <p class="marketplace-subtitle">Descubre las mejores ferreterías y proveedores cerca de ti.</p>
                <div class="search-container">
                    <input type="text" id="store-finder" class="store-search-input" placeholder=" Buscar ferretería...">
                </div>
            </div>
            
            <div class="marketplace-container">
                <h3 style="text-align:center; color:white; margin-bottom:30px; opacity:0.8; text-transform:uppercase; letter-spacing:1px; font-size:0.9rem;">Tiendas Oficiales</h3>
                <div id="stores-grid" class="stores-grid">
                    <p style="color:white; text-align:center; grid-column:1/-1;">Buscando tiendas disponibles...</p>
                </div>
            </div>
        </div>
    `;
}

// --- VISTA 2: TIENDA INDIVIDUAL ---
function renderStoreUI(business) {
    const logo = business.logo_url || '';
    const name = business.name || '';
    const color = business.primary_color || '#7A3F9D'; 
    
    return `
        <div class="shop-layout">
            <header class="shop-header">
                <div style="display: flex; align-items: center; gap: 12px;">
                    ${logo ? `<img src="${logo}" style="height: 40px; width:40px; border-radius: 8px; object-fit:cover;">` : '<span style="font-size:2rem;">🏪</span>'}
                    <div>
                        <a href="#/shop?s=${business.slug}" style="text-decoration: none; color: #1e293b; font-weight: 800; font-size: 1.1rem; line-height:1.2; display:block;">${name}</a>
                        <a href="#/shop" style="font-size:0.8rem; color:#64748b; text-decoration:none; font-weight:600;">← Volver al directorio</a>
                    </div>
                </div>
                <nav class="shop-nav">
                    <button id="btn-open-cart" class="btn-cart-float" style="background:${color}">
                        🛒
                        <span id="cart-count" class="cart-badge">0</span>
                    </button>
                </nav>
            </header>

            <div style="background: linear-gradient(135deg, ${color} 0%, #1e293b 100%); padding:40px 20px; text-align:center; color:white;">
                <h1 style="margin:0; font-size:2rem; font-weight:800;">Catálogo Digital</h1>
                <p style="opacity:0.9; margin-top:5px;">Haz tu pedido en línea y recoge en tienda.</p>
            </div>

            <div class="shop-container">
                
                <aside class="shop-filters">
                     <div style="background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0; position:sticky; top:100px;">
                        <span style="font-weight:bold; display:block; margin-bottom:15px; color:#1e293b;">Categorías</span>
                        <ul id="shop-categories" style="list-style:none; padding:0; margin:0;">
                             </ul>
                    </div>
                </aside>

                <main>
                    <div style="margin-bottom:20px; position:relative;">
                        <input type="text" class="search-container "id="product-search" placeholder=" ¿Qué estás buscando?" 
                            style="width:100%; padding:15px 20px; border-radius:12px; border:1px solid #e2e8f0; font-size:1rem; box-shadow:0 2px 5px rgba(0,0,0,0.02); outline:none;">
                    </div>

                    <div id="shop-grid" class="products-grid-shop">
                        <p style="grid-column: 1/-1; text-align: center; padding: 50px; color:#666;">Cargando productos...</p>
                    </div>
                </main>
            </div>

            <div class="shop-modal-overlay" id="cart-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:flex-end; backdrop-filter:blur(2px);">
                <div class="shop-drawer" style="background:white; width:100%; max-width:450px; height:100%; display:flex; flex-direction:column; box-shadow:-5px 0 30px rgba(0,0,0,0.2);">
                    <div class="drawer-header" style="padding:20px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; background:#f8f9fa;">
                        <div style="font-weight:bold; font-size:1.2rem;">Tu Pedido</div>
                        <button id="btn-close-cart" style="background:none; border:none; font-size:2rem; cursor:pointer; line-height:1;">&times;</button>
                    </div>
                    <div class="drawer-body" id="cart-body" style="flex:1; overflow-y:auto; padding:20px;"></div>
                </div>
            </div>
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
        
        const { data: stores } = await supabase
            .from('businesses')
            .select('id, name, slug, logo_url, primary_color, plan')
            .eq('plan', 'profesional',)
            .limit(50);
        
        function renderStoreCards(list) {
            if(!list || list.length === 0) {
                return grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:rgba(255,255,255,0.7);"><h3>😕 No se encontraron tiendas</h3></div>`;
            }
            grid.innerHTML = list.map(s => `
                <div class="store-card" onclick="window.location.hash='#/shop?s=${s.slug}'; location.reload();">
                    <div class="store-card-header" style="background:${s.primary_color || '#7A3F9D'};"></div>
                    <div class="store-card-body">
                        <div class="store-logo-wrapper">
                            ${s.logo_url ? `<img src="${s.logo_url}" class="store-logo-img">` : `<span class="store-placeholder">🏪</span>`}
                        </div>
                        <h3 class="store-name">${s.name}</h3>
                        <span class="store-link">Ver Catálogo &rarr;</span>
                    </div>
                </div>
            `).join('');
        }
        renderStoreCards(stores || []);
        search.addEventListener('input', (e) => renderStoreCards(stores.filter(s => s.name.toLowerCase().includes(e.target.value.toLowerCase()))));
    }

    async function loadStore(slug) {
        try {
            const { data: business, error } = await supabase.from('businesses').select('*').eq('slug', slug).single();
            if (error || !business) return renderError("Tienda no encontrada.");
            if (business.plan !== 'profesional') return renderError("Esta tienda no tiene habilitada la venta en línea.");

            currentBusiness = business;
            root.innerHTML = renderStoreUI(business);
            
            // Listeners iniciales
            setupStoreInteractions();
            
            // Cargar datos
            await loadCatalog(business.id);

            // CORRECCIÓN: Listener para el buscador de productos
            document.getElementById('product-search').addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = shopProducts.filter(p => p.name.toLowerCase().includes(term));
                renderProducts(filtered);
            });

        } catch (err) { console.error(err); renderError("Error al cargar."); }
    }

    function renderError(msg) {
        root.innerHTML = `<div style="text-align:center; padding:50px;"><h2>🚫</h2><p>${msg}</p><a href="#/shop">Volver</a></div>`;
    }

    async function loadCatalog(businessId) {
        // 1. Cargamos SOLO los productos (ignoramos la tabla categories por ahora)
        const { data: prods, error } = await supabase
            .from('products')
            .select('*')
            .eq('business_id', businessId)
            .gt('stock', 0); // Solo mostramos los que tienen stock
            
        if (error) console.error("Error al cargar productos:", error);
        
        shopProducts = prods || [];

        // 2. Extraemos las categorías dinámicamente de los productos disponibles
        // Esto crea un arreglo único (sin repetir) de todas las categorías que existen en tus productos
        const uniqueCategories = [...new Set(shopProducts.map(p => p.category).filter(c => c && c.trim() !== ''))];

        // 3. Renderizar Productos (Mostramos todos al cargar la página)
        renderProducts(shopProducts);

        // 4. Renderizar Categorías en el panel lateral (aside)
        const catList = document.getElementById('shop-categories');
        if (catList) {
            // Limpiamos la lista y agregamos la opción "Todas" por defecto
            catList.innerHTML = `<li class="category-item active" data-cat="all" style="padding:10px; cursor:pointer; border-radius:8px; margin-bottom:5px; background:#e5e7eb; color:#333; font-weight:bold;">Todas</li>`;

            // Creamos un botón (li) por cada categoría detectada
            uniqueCategories.forEach(catName => {
                const li = document.createElement('li');
                li.className = 'category-item'; 
                li.textContent = catName; // El nombre de la categoría
                li.style.cssText = "padding:10px; cursor:pointer; border-radius:8px; margin-bottom:5px; color:#64748b; transition:0.2s;";

                // Lógica al hacer clic en una categoría específica
                li.addEventListener('click', () => {
                    // Quitamos el estilo de "seleccionado" a todas
                    document.querySelectorAll('.category-item').forEach(i => {
                        i.style.background='transparent'; i.style.fontWeight='normal'; i.style.color='#64748b';
                    });
                    // Le ponemos estilo de "seleccionado" a la que el usuario hizo clic
                    li.style.background = '#e5e7eb'; li.style.fontWeight='bold'; li.style.color='#333';
                    
                    // Filtramos los productos para mostrar solo los de esta categoría
                    renderProducts(shopProducts.filter(p => p.category === catName));
                });
                catList.appendChild(li);
            });

            // Lógica al hacer clic en "Todas"
            catList.querySelector('[data-cat="all"]').addEventListener('click', (e) => {
                document.querySelectorAll('.category-item').forEach(i => {
                    i.style.background='transparent'; i.style.fontWeight='normal'; i.style.color='#64748b';
                });
                e.target.style.background = '#e5e7eb'; e.target.style.fontWeight='bold'; e.target.style.color='#333';
                
                // Mostramos todos los productos de nuevo
                renderProducts(shopProducts);
            });
        }
    }

    function renderProducts(products) {
        const grid = document.getElementById('shop-grid');
        grid.innerHTML = '';
        if (products.length === 0) return grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color:#666;">No se encontraron productos.</p>`;

        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            const unit = p.unit || 'pz';
            const bulkBadge = p.is_bulk ? `<span style="font-size:0.65rem; background:#e0f2fe; color:#0284c7; padding:2px 6px; border-radius:4px; font-weight:bold;">GRANEL</span>` : '';

            // 🌟 AQUÍ ESTÁ LA MAGIA DE LA IMAGEN
            // Evaluamos si el producto tiene un link en image_url
            const imageElement = p.image_url 
                ? `<img src="${p.image_url}" alt="${p.name}" style="width:100%; height:160px; object-fit:cover; border-radius:12px 12px 0 0;">` 
                : `<div style="height:160px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:3rem; border-radius:12px 12px 0 0;">📦</div>`;

            // CORRECCIÓN: Se inyecta imageElement en lugar del div hardcodeado
            card.innerHTML = `
                ${imageElement}
                <div style="padding:15px; flex:1; display:flex; flex-direction:column;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase; font-weight:bold;">${p.category || 'General'}</span>${bulkBadge}
                    </div>
                    <h3 style="margin:0 0 5px 0; font-size:1rem; color:#0f172a; font-weight:700; line-height:1.4;">${p.name}</h3>
                    
                    <div style="margin-top:auto;">
                        <div style="font-size:0.8rem; color:#64748b; margin-bottom:5px;">
                            Disponible: <span style="font-weight:bold; color:#333;">${p.stock}</span>
                        </div>
                        <div style="font-size:1.3rem; font-weight:800; color:#10b981; margin-bottom:10px;">
                            $${p.price.toFixed(2)} <span style="font-size:0.75rem; color:#9ca3af; font-weight:normal;">/${unit}</span>
                        </div>
                        <button class="btn-add" style="width:100%; padding:10px; background:${currentBusiness.primary_color || '#7A3F9D'}; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; transition:0.2s;">Agregar +</button>
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
        if (btn) { btn.style.transform = 'scale(1.2)'; setTimeout(() => btn.style.transform = 'scale(1)', 150); }
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
                    </div>`;
            } else {
                qtyControl = `
                    <div style="display:flex; align-items:center; border:1px solid #ddd; border-radius:4px; overflow:hidden;">
                        <button class="qty-btn" data-idx="${idx}" data-chg="-1" style="width:28px; height:28px; border:none; background:#f1f5f9; cursor:pointer;">-</button>
                        <input type="number" class="qty-input-direct" data-idx="${idx}" value="${item.qty}" min="1" step="1" max="${item.stock}" style="width:40px; text-align:center; border:none; font-weight:bold;">
                        <button class="qty-btn" data-idx="${idx}" data-chg="1" style="width:28px; height:28px; border:none; background:#f1f5f9; cursor:pointer;">+</button>
                    </div>`;
            }

            return `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                    <div style="flex:1;">
                        <h4 style="margin:0 0 5px 0; font-size:0.95rem;">${item.name}</h4>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            ${qtyControl}
                            <div style="text-align:right; margin-left:10px;">
                                <div style="font-weight:bold;">$${subtotal.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                    <button class="rm-item" data-idx="${idx}" style="margin-left:10px; color:#ef4444; border:none; background:transparent; cursor:pointer; font-size:1.2rem;">&times;</button>
                </div>
            `;
        }).join('');

        body.innerHTML = `
            <div style="margin-bottom:20px;">${itemsHtml}</div>
            <div style="margin-top:20px; padding-top:20px; border-top:2px solid #f3f4f6;">
                <div style="display:flex; justify-content:space-between; font-size:1.2rem; font-weight:800; margin-bottom:25px; color:#1e293b;">
                    <span>Total:</span><span>$${total.toFixed(2)}</span>
                </div>
                <div class="form-checkout">
                    <input type="text" id="client-name" placeholder="Tu Nombre Completo" required style="width:100%; padding:14px; margin-bottom:10px; border:1px solid #e2e8f0; border-radius:10px;">
                    <input type="text" id="client-phone" placeholder="WhatsApp / Teléfono" required style="width:100%; padding:14px; margin-bottom:10px; border:1px solid #e2e8f0; border-radius:10px;">
                    <select id="payment-method" style="width:100%; padding:14px; margin-bottom:20px; border:1px solid #e2e8f0; border-radius:10px;">
                        <option value="efectivo"> Efectivo (Contra entrega)</option>
                        <option value="tarjeta"> Tarjeta (En tienda)</option>
                        <option value="transferencia"> Transferencia</option>
                    </select>
                    <button id="btn-checkout" style="width:100%; padding:16px; background:${currentBusiness.primary_color || '#7A3F9D'}; color:white; border:none; border-radius:10px; font-weight:bold; font-size:1.1rem; cursor:pointer;">Confirmar Pedido</button>
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
        btn.textContent = "Procesando..."; btn.disabled = true;

        const total = shopCart.reduce((acc, i) => acc + (i.price * i.qty), 0);
        const itemsToSave = [...shopCart.map(i => ({ id: i.id, name: i.name, qty: i.qty, unit: i.unit, price: i.price })), { type: 'meta', payment_method: method }];

        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('crear_pedido_web', {
            p_business_id: currentBusiness.id,
            p_customer_name: name,
            p_customer_contact:phone,
            p_items: itemsToSave,
            p_total: total
            });

            if (rpcError) throw rpcError;
            if (!rpcData.success) throw new Error(rpcData.message);

            shopCart = []; updateCartUI();
            const cartBody = document.getElementById('cart-body');
            cartBody.innerHTML = `
                <div style="text-align:center; padding:40px 20px;">
                    <div style="font-size:4rem; margin-bottom:10px;">✅</div>
                    <h2 style="margin-bottom:10px;">¡Listo!</h2>
                    <p>Tu pedido ha sido recibido en <strong>${currentBusiness.name}</strong>.</p>
                    <button id="btn-finish" style="width:100%; padding:15px; background:#1e293b; color:white; border:none; border-radius:10px; font-weight:bold; margin-top:20px;">Cerrar</button>
                </div>`;
            document.getElementById('btn-finish').addEventListener('click', () => { document.getElementById('cart-overlay').style.display = 'none'; loadCatalog(currentBusiness.id); });

        } catch (err) {
            console.error(err); alert("Error al procesar pedido.");
            btn.textContent = "Confirmar Pedido"; btn.disabled = false;
        }
    }
}