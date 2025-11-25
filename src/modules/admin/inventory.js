// src/modules/admin/inventory.js - OFFLINE FIRST + COSTOS
import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';
import { db } from '../../data/db-local.js';
import { syncService } from '../../services/sync.js';

let allProducts = [];

export function renderAdminInventory() {
    return `
        <div class="admin-container">
            <aside class="admin-sidebar">
                <div class="sidebar-logo" style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                    <img src="" class="app-logo-img" style="width:80px; height:auto; object-fit:contain; display:none;">
                    <span class="app-name" style="font-size:1.2rem;">Cargando...</span>
                </div>
                <nav class="sidebar-menu">
                    <button class="menu-item" id="nav-dash">📊 Dashboard</button>
                    <button class="menu-item" id="nav-orders">🔔 Pedidos Web</button>
                    <button class="menu-item active">📦 Inventario</button>
                    <button class="menu-item" id="nav-pos">🛒 Ir a Caja (POS)</button>
                    <button class="menu-item" id="nav-settings">⚙️ Configuración</button>
                    <button class="menu-item logout" id="nav-logout">🚪 Cerrar Sesión</button>
                </nav>
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div class="page-title">
                        <h1>Gestión de Inventario</h1>
                        <p>Administra productos, costos y precios.</p>
                    </div>
                    
                    <div style="display:flex; gap:10px; align-items:center;">
                        <button id="theme-toggle-inv" class="icon-btn" title="Cambiar Tema" style="background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); width:40px; height:40px; border-radius:8px; cursor:pointer;">
                            🌗
                        </button>
                        
                        <button id="btn-add-product" class="btn-primary">
                            <span>+</span> Nuevo Producto
                        </button>
                    </div>
                </header>

                <div class="card-panel">
                    <div style="margin-bottom: 20px; display:flex; gap:10px;">
                        <input type="text" id="inventory-search" placeholder="🔍 Buscar por nombre, código o categoría..." 
                            style="width: 100%; padding: 12px; border: 1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); border-radius: 8px; font-size: 1rem; outline: none;">
                    </div>

                    <table class="modern-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>SKU</th>
                                <th>Costo</th>
                                <th>Precio</th>
                                <th>Stock</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="inventory-table-body">
                            <tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-secondary);">Cargando inventario...</td></tr>
                        </tbody>
                    </table>
                </div>
            </main>

            <div id="product-modal" class="admin-modal">
                <div class="modal-glass">
                    <h2 id="modal-title" style="margin-bottom:20px; color:var(--text-primary);">Producto</h2>
                    <input type="hidden" id="prod-id">
                    
                    <div style="display:flex; flex-direction:column; gap:15px;">
                        <input type="text" id="prod-name" placeholder="Nombre del Producto" class="form-input" style="padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); border-radius:6px;">
                        <input type="text" id="prod-sku" placeholder="SKU / Código de Barras" class="form-input" style="padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); border-radius:6px;">
                        
                        <div style="display:flex; gap:5px;">
                            <select id="prod-cat" class="form-input" style="flex:1; padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); border-radius:6px;">
                                <option value="" disabled selected>Categoría</option>
                            </select>
                            <button id="btn-new-cat" title="Nueva Categoría" style="background:var(--brand-color); color:white; border:none; border-radius:6px; width:40px; cursor:pointer; font-weight:bold;">+</button>
                        </div>

                        <div style="display:flex; gap:10px;">
                            <div style="flex:1;">
                                <label style="font-size:0.8rem; color:var(--text-secondary);">Costo</label>
                                <input type="number" id="prod-cost" placeholder="$0.00" class="form-input" style="width:100%; padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); border-radius:6px;">
                            </div>
                            <div style="flex:1;">
                                <label style="font-size:0.8rem; color:var(--text-secondary);">Precio</label>
                                <input type="number" id="prod-price" placeholder="$0.00" class="form-input" style="width:100%; padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); border-radius:6px; font-weight:bold;">
                            </div>
                        </div>

                        <div style="display:flex; gap:10px;">
                            <input type="number" id="prod-stock" placeholder="Stock Inicial" class="form-input" style="flex:1; padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); border-radius:6px;">
                            <select id="prod-unit" style="padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); border-radius:6px;">
                                <option value="pz">Pieza</option>
                                <option value="kg">Kg</option>
                                <option value="m">Metro</option>
                                <option value="lt">Litro</option>
                                <option value="pq">Paquete</option>
                            </select>
                        </div>
                        
                        <div style="display:flex; align-items:center; gap:10px; background:var(--bg-input); padding:10px; border-radius:6px; color:var(--text-primary);">
                            <input type="checkbox" id="prod-bulk" style="transform:scale(1.2); cursor:pointer;">
                            <label for="prod-bulk" style="font-size:0.9rem; cursor:pointer; user-select:none;">📏 Venta a Granel</label>
                        </div>
                    </div>

                    <div style="display:flex; gap:10px; margin-top:25px;">
                        <button id="btn-cancel-prod" style="flex:1; padding:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); border-radius:6px; cursor:pointer;">Cancelar</button>
                        <button id="btn-save-prod" style="flex:1; padding:10px; background:var(--brand-color); color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Guardar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export async function setupInventoryLogic(router) {
    document.getElementById('nav-dash').addEventListener('click', () => router.navigate('/admin'));
    document.getElementById('nav-orders').addEventListener('click', () => router.navigate('/admin/orders'));
    document.getElementById('nav-pos').addEventListener('click', () => router.navigate('/pos'));
    document.getElementById('nav-settings').addEventListener('click', () => router.navigate('/admin/settings'));
    document.getElementById('nav-logout').addEventListener('click', async () => { await supabase.auth.signOut(); router.navigate('/'); });
    document.getElementById('theme-toggle-inv').addEventListener('click', () => ThemeService.toggle());

    const tableBody = document.getElementById('inventory-table-body');
    const modal = document.getElementById('product-modal');
    const searchInput = document.getElementById('inventory-search');
    
    const pId = document.getElementById('prod-id');
    const pName = document.getElementById('prod-name');
    const pSku = document.getElementById('prod-sku');
    const pCat = document.getElementById('prod-cat');
    const pCost = document.getElementById('prod-cost');
    const pPrice = document.getElementById('prod-price');
    const pStock = document.getElementById('prod-stock');
    const pUnit = document.getElementById('prod-unit');
    const pBulk = document.getElementById('prod-bulk');

    async function loadProducts() {
        // 1. Carga rápida Local
        allProducts = await db.products.toArray();
        if (allProducts.length > 0) {
            renderTable(allProducts);
        } else {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-secondary);">Sin datos locales. Conectando...</td></tr>`;
        }

        // 2. Sincronización Nube
        if (navigator.onLine) {
            await syncService.downloadProducts();
            allProducts = await db.products.toArray();
            renderTable(allProducts);
        }
    }

    function renderTable(products) {
        tableBody.innerHTML = '';
        if(products.length === 0) return tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Vacío</td></tr>`;

        products.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${p.name}</b>${p.is_bulk ? ' 📏' : ''}</td>
                <td><small style="color:var(--text-secondary)">${p.sku || '--'}</small></td>
                <td style="color:var(--text-secondary);">$${(p.cost_price || 0).toFixed(2)}</td>
                <td style="font-weight:bold; color:var(--success-bg);">$${p.price.toFixed(2)}</td>
                <td>${p.stock} <small>${p.unit||'pz'}</small></td>
                <td>
                    <button class="action-btn edit-btn" data-id="${p.id}">✏️</button>
                    <button class="action-btn delete-btn" data-id="${p.id}">🗑️</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        document.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => openEdit(b.dataset.id)));
        document.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.id)));
    }

    searchInput.addEventListener('input', (e) => {
        const t = e.target.value.toLowerCase();
        renderTable(allProducts.filter(p => p.name.toLowerCase().includes(t) || (p.sku && p.sku.toLowerCase().includes(t))));
    });

    async function loadCategories() {
        const { data } = await supabase.from('categories').select('*').order('name');
        if (data) {
            const val = pCat.value;
            pCat.innerHTML = `<option value="" disabled selected>Categoría</option>`;
            data.forEach(c => { const o = document.createElement('option'); o.value=c.name; o.textContent=c.name; pCat.appendChild(o); });
            if(val) pCat.value = val;
        }
    }
    document.getElementById('btn-new-cat').addEventListener('click', async () => {
        const n = prompt("Nueva Categoría:");
        if(n){ await supabase.from('categories').insert({name:n}); loadCategories(); pCat.value=n; }
    });

    function openEdit(id) {
        const p = allProducts.find(x => x.id == id);
        if(p) {
            document.getElementById('modal-title').textContent = "Editar";
            pId.value=p.id; pName.value=p.name; pSku.value=p.sku; pCat.value=p.category;
            pCost.value=p.cost_price || 0;
            pPrice.value=p.price; pStock.value=p.stock; pUnit.value=p.unit||'pz'; pBulk.checked=p.is_bulk;
        }
        modal.style.display = 'flex';
    }

    document.getElementById('btn-add-product').addEventListener('click', () => {
        document.getElementById('modal-title').textContent = "Nuevo";
        pId.value=''; pName.value=''; pSku.value=''; pCat.value=''; pCost.value=''; pPrice.value=''; pStock.value=''; pUnit.value='pz'; pBulk.checked=false;
        modal.style.display = 'flex';
    });

    document.getElementById('btn-cancel-prod').addEventListener('click', () => modal.style.display = 'none');

    document.getElementById('btn-save-prod').addEventListener('click', async () => {
        const data = {
            name: pName.value, sku: pSku.value, category: pCat.value, unit: pUnit.value,
            cost_price: parseFloat(pCost.value) || 0,
            price: parseFloat(pPrice.value), stock: parseFloat(pStock.value), is_bulk: pBulk.checked
        };
        if(!data.name || !data.price) return alert("Faltan datos");

        if(pId.value) await supabase.from('products').update(data).eq('id', pId.value);
        else await supabase.from('products').insert(data);
        
        modal.style.display='none'; loadProducts();
    });

    async function deleteProduct(id) {
        if(confirm("¿Borrar?")) { await supabase.from('products').delete().eq('id', id); loadProducts(); }
    }

    loadCategories(); loadProducts();
}