// src/modules/admin/inventory.js - CON BUSCADOR INTELIGENTE
import { supabase } from '../../data/supabase.js';

let allProducts = []; // Memoria local para búsqueda rápida

export function renderAdminInventory() {
    return `
        <div class="admin-container">
            <aside class="admin-sidebar">
                <div class="sidebar-logo">🚀 Mi Negocio</div>
                <nav class="sidebar-menu">
                    <button class="menu-item" id="nav-dash">📊 Dashboard</button>
                    <button class="menu-item" id="nav-orders">🔔 Pedidos Web</button>
                    <button class="menu-item active">📦 Inventario</button>
                    <button class="menu-item" id="nav-pos">🛒 Ir a Caja (POS)</button>
                    <button class="menu-item logout" id="nav-logout">🚪 Cerrar Sesión</button>
                </nav>
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div class="page-title">
                        <h1>Gestión de Inventario</h1>
                        <p>Administra productos, precios y existencias.</p>
                    </div>
                    <button id="btn-add-product" class="btn-primary">
                        <span>+</span> Nuevo Producto
                    </button>
                </header>

                <div class="card-panel">
                    
                    <div style="margin-bottom: 20px; display:flex; gap:10px;">
                        <input type="text" id="inventory-search" placeholder="🔍 Buscar por nombre, código o categoría..." 
                            style="width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1rem; outline: none;">
                    </div>

                    <table class="modern-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>SKU</th>
                                <th>Categoría</th>
                                <th>Unidad</th>
                                <th>Precio</th>
                                <th>Stock</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="inventory-table-body">
                            <tr><td colspan="7" style="text-align:center; padding:30px;">Cargando inventario...</td></tr>
                        </tbody>
                    </table>
                </div>
            </main>

            <div id="product-modal" class="admin-modal">
                <div class="modal-glass">
                    <h2 id="modal-title" style="margin-bottom:20px; color:#1e293b;">Producto</h2>
                    <input type="hidden" id="prod-id">
                    
                    <div style="display:flex; flex-direction:column; gap:15px;">
                        <input type="text" id="prod-name" placeholder="Nombre del Producto" class="form-input" style="padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                        <input type="text" id="prod-sku" placeholder="SKU / Código de Barras" class="form-input" style="padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                        
                        <div style="display:flex; gap:5px;">
                            <select id="prod-cat" class="form-input" style="flex:1; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                                <option value="" disabled selected>Cargando categorías...</option>
                            </select>
                            <button id="btn-new-cat" title="Nueva Categoría" style="background:#7A3F9D; color:white; border:none; border-radius:6px; width:40px; cursor:pointer; font-weight:bold;">+</button>
                        </div>

                        <div style="display:flex; gap:10px;">
                            <input type="number" id="prod-price" placeholder="Precio ($)" class="form-input" style="flex:1; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                            <select id="prod-unit" style="padding:10px; border:1px solid #cbd5e1; border-radius:6px; background:white;">
                                <option value="pz">Pieza (pz)</option>
                                <option value="m">Metro (m)</option>
                                <option value="cm">Cm (cm)</option>
                                <option value="kg">Kilo (kg)</option>
                                <option value="g">Gramo (g)</option>
                                <option value="lt">Litro (lt)</option>
                                <option value="pq">Paquete (pq)</option>
                            </select>
                        </div>

                        <input type="number" id="prod-stock" placeholder="Stock Inicial" class="form-input" style="padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                        
                        <div style="display:flex; align-items:center; gap:10px; background:#f1f5f9; padding:10px; border-radius:6px;">
                            <input type="checkbox" id="prod-bulk" style="transform:scale(1.2); cursor:pointer;">
                            <label for="prod-bulk" style="font-size:0.9rem; cursor:pointer; user-select:none;">📏 Venta a Granel (Permitir decimales)</label>
                        </div>
                    </div>

                    <div style="display:flex; gap:10px; margin-top:25px;">
                        <button id="btn-cancel-prod" style="flex:1; padding:10px; border:1px solid #cbd5e1; background:white; border-radius:6px; cursor:pointer;">Cancelar</button>
                        <button id="btn-save-prod" style="flex:1; padding:10px; background:#7A3F9D; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Guardar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export async function setupInventoryLogic(router) {
    // Navegación
    document.getElementById('nav-dash').addEventListener('click', () => router.navigate('/admin'));
    document.getElementById('nav-orders').addEventListener('click', () => router.navigate('/admin/orders'));
    document.getElementById('nav-pos').addEventListener('click', () => router.navigate('/pos'));
    document.getElementById('nav-logout').addEventListener('click', async () => { await supabase.auth.signOut(); router.navigate('/'); });

    // Elementos
    const tableBody = document.getElementById('inventory-table-body');
    const modal = document.getElementById('product-modal');
    const searchInput = document.getElementById('inventory-search');
    
    // Form elements
    const pId = document.getElementById('prod-id');
    const pName = document.getElementById('prod-name');
    const pSku = document.getElementById('prod-sku');
    const pCat = document.getElementById('prod-cat');
    const pUnit = document.getElementById('prod-unit');
    const pPrice = document.getElementById('prod-price');
    const pStock = document.getElementById('prod-stock');
    const pBulk = document.getElementById('prod-bulk');

    // --- 1. CARGAR PRODUCTOS ---
    async function loadProducts() {
        const { data, error } = await supabase.from('products').select('*').order('name');
        if (error) {
            console.error(error);
            tableBody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">Error cargando datos</td></tr>`;
            return;
        }
        allProducts = data; // Guardar en memoria
        renderTable(allProducts); // Mostrar todos
    }

    // --- 2. RENDERIZAR TABLA ---
    function renderTable(products) {
        tableBody.innerHTML = '';
        if(products.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#999; padding:20px;">No se encontraron productos.</td></tr>`;
            return;
        }

        products.forEach(p => {
            const tr = document.createElement('tr');
            const bulkIcon = p.is_bulk ? ' <span title="Granel">📏</span>' : '';
            
            tr.innerHTML = `
                <td><b>${p.name}</b>${bulkIcon}</td>
                <td>${p.sku || '<span style="color:#ccc">--</span>'}</td>
                <td><span style="background:#f1f5f9; padding:4px 8px; border-radius:12px; font-size:0.8rem; color:#475569;">${p.category}</span></td>
                <td>${p.unit || 'pz'}</td>
                <td style="font-weight:bold; color:#166534;">$${p.price}</td>
                <td>${p.stock}</td>
                <td>
                    <button class="action-btn edit-btn" data-id="${p.id}" title="Editar">✏️</button>
                    <button class="action-btn delete-btn" data-id="${p.id}" title="Borrar">🗑️</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        document.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => openEdit(b.dataset.id)));
        document.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.id)));
    }

    // --- 3. BUSCADOR EN TIEMPO REAL ---
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        
        const filtered = allProducts.filter(p => 
            p.name.toLowerCase().includes(term) || 
            (p.sku && p.sku.toLowerCase().includes(term)) ||
            p.category.toLowerCase().includes(term)
        );
        
        renderTable(filtered);
    });

    // --- 4. CATEGORÍAS Y MODAL ---
    async function loadCategories() {
        const { data } = await supabase.from('categories').select('*').order('name');
        if (data) {
            const currentVal = pCat.value; 
            pCat.innerHTML = `<option value="" disabled selected>Selecciona Categoría</option>`;
            data.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name; option.textContent = cat.name;
                pCat.appendChild(option);
            });
            if(currentVal) pCat.value = currentVal;
        }
    }

    document.getElementById('btn-new-cat').addEventListener('click', async () => {
        const newCatName = prompt("Nombre de la nueva categoría:");
        if (newCatName && newCatName.trim() !== "") {
            await supabase.from('categories').insert({ name: newCatName.trim() });
            loadCategories(); pCat.value = newCatName.trim();
        }
    });

    function openEdit(id) {
        const prod = allProducts.find(p => p.id == id);
        if (prod) {
            document.getElementById('modal-title').textContent = "Editar Producto";
            pId.value = prod.id; pName.value = prod.name; pSku.value = prod.sku;
            pCat.value = prod.category; pPrice.value = prod.price; pStock.value = prod.stock;
            pUnit.value = prod.unit || 'pz'; pBulk.checked = prod.is_bulk;
        }
        modal.style.display = 'flex';
    }

    document.getElementById('btn-add-product').addEventListener('click', () => {
        document.getElementById('modal-title').textContent = "Nuevo Producto";
        pId.value = ''; pName.value = ''; pSku.value = ''; pPrice.value = ''; pStock.value = '';
        pCat.value = ''; pUnit.value = 'pz'; pBulk.checked = false;
        modal.style.display = 'flex';
    });

    document.getElementById('btn-cancel-prod').addEventListener('click', () => modal.style.display = 'none');

    document.getElementById('btn-save-prod').addEventListener('click', async () => {
        const productData = {
            name: pName.value, sku: pSku.value, category: pCat.value, unit: pUnit.value,
            price: parseFloat(pPrice.value), stock: parseFloat(pStock.value), is_bulk: pBulk.checked
        };

        if (!productData.name || !productData.price || !productData.category) return alert("Datos faltantes");

        if (pId.value) {
            await supabase.from('products').update(productData).eq('id', pId.value);
        } else {
            await supabase.from('products').insert(productData);
        }
        modal.style.display = 'none';
        loadProducts();
    });

    async function deleteProduct(id) {
        if (confirm("¿Borrar?")) {
            await supabase.from('products').delete().eq('id', id);
            loadProducts();
        }
    }

    loadCategories();
    loadProducts();
}