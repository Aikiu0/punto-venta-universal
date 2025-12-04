// src/modules/admin/inventory.js - UNIFICADO: ESTILO MODERNO + LÓGICA DE BLOQUEO
import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';
import { db } from '../../data/db-local.js';
import { syncService } from '../../services/sync.js';
import { PermissionService } from '../../services/permissions.js';
import { renderSidebarHeader } from './components/sidebarHeader.js';
let allProducts = [];

export function renderAdminInventory() {
    // --- CONTROL DE PERMISOS (LÓGICA DEL ARCHIVO 1) ---
    // En lugar de ocultar con display:none, definimos el icono de candado y opacidad
    // para que el usuario vea la opción pero sepa que es Premium.
    
    const lockHistory = PermissionService.can('history') ? '' : '🔒 ';
    const lockOrders = PermissionService.can('web_orders') ? '' : '🔒 ';
    const lockSettings = PermissionService.can('settings') ? '' : '🔒 ';
    const lockSuppliers = PermissionService.can('suppliers') ? '' : '🔒 ';
    const lockBilling = PermissionService.can('billing') ? '' : '🔒 ';
    const canImport = PermissionService.can('import_excel');
    const lockImport = canImport ? '' : '🔒';
    const opacityImport = canImport ? '1' : '0.6';

    const canExport = PermissionService.can('export_excel');
    const lockExport = canExport ? '' : '🔒';
    const opacityExport = canExport ? '1' : '0.6';

    return `
        <div class="admin-container">
            <div class="sidebar-overlay" id="sidebar-overlay"></div>

            <aside class="admin-sidebar" id="admin-sidebar">
                <div class="sidebar-logo">
                    ${renderSidebarHeader()}
                </div>
                <nav class="sidebar-menu">
                    <button class="menu-item" id="nav-dash">📊 Dashboard</button>
                    
                    <button class="menu-item" id="nav-orders" onclick="return window.checkPlan(event, 'web_orders')">
                        ${lockOrders}🔔 Pedidos Web
                    </button>
                    
                    <button class="menu-item active">📦 Inventario</button>
                    
                    <button class="menu-item" id="nav-pos">🛒 Ir a Caja</button>
                     <button class="menu-item" id="nav-suppliers" onclick="return window.checkPlan(event, 'suppliers')">${lockSuppliers}🚚 Proveedores</button>
                    
                    <button class="menu-item" id="nav-history" onclick="return window.checkPlan(event, 'history')">
                        ${lockHistory}📅 Historial
                    </button>
                    <button class="menu-item" id="nav-billing" onclick="window.checkPlan(event, 'billing')">
                    ${lockBilling}💎 Facturación
                    </button>
                    <button class="menu-item" id="nav-settings" onclick="return window.checkPlan(event, 'settings')">
                        ${lockSettings}⚙️ Configuración
                    </button>
                    
                    <button class="menu-item logout" id="nav-logout" style="margin-top:auto; color:var(--danger-color);">🚪 Salir</button>
                </nav>
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button id="mobile-menu-btn" style="background:none; border:none; font-size:1.8rem; color:var(--text-primary); cursor:pointer;">☰</button>
                        <div class="page-title">
                            <h1>Gestión de Inventario</h1>
                            <p>Administra productos, costos y precios.</p>
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <button id="theme-toggle-inv" class="icon-btn" title="Cambiar Tema" style="background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); width:40px; height:40px; border-radius:8px; cursor:pointer;">
                            🌗
                        </button>
                        
                        <input type="file" id="csv-input" accept=".csv" style="display:none;">
                        <button id="btn-import-csv" class="btn-secondary" 
                            style="background:#10b981; color:white; border:none; padding:10px 15px; border-radius:8px; cursor:pointer; font-weight:bold; display:flex; align-items:center; gap:5px; opacity: ${opacityImport};"
                            onclick="if(window.checkPlan(event, 'import_excel')) document.getElementById('csv-input').click();">
                            ${lockImport} 📥 Importar
                        </button>

                        <button id="btn-export-csv" class="btn-secondary" 
                            style="background:#6366f1; color:white; border:none; padding:10px 15px; border-radius:8px; cursor:pointer; font-weight:bold; display:flex; align-items:center; gap:5px; opacity: ${opacityExport};"
                            onclick="return window.checkPlan(event, 'export_excel')">
                            ${lockExport} 📤 Exportar
                        </button>

                        <button id="btn-add-product" class="btn-primary" style="padding:10px 15px; border-radius:8px;">
                            <span>+</span> Nuevo
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
    const businessId = localStorage.getItem('archsell_business_id');

    // --- MENÚ MÓVIL ---
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btnOpen = document.getElementById('mobile-menu-btn');
    const btnClose = document.getElementById('btn-close-sidebar');
    
    // Si estamos en móvil, mostrar botón de cerrar
    if(window.innerWidth <= 768 && btnClose) btnClose.style.display = 'block';
    
    function toggleMenu(show) {
        if(show) { sidebar.classList.add('active'); overlay.classList.add('active'); }
        else { sidebar.classList.remove('active'); overlay.classList.remove('active'); }
    }
    if(btnOpen) btnOpen.addEventListener('click', () => toggleMenu(true));
    if(btnClose) btnClose.addEventListener('click', () => toggleMenu(false));
    if(overlay) overlay.addEventListener('click', () => toggleMenu(false));

    const navigateTo = (path) => { toggleMenu(false); router.navigate(path); };
    
    document.getElementById('nav-dash').addEventListener('click', () => navigateTo('/admin'));
    
    // Botones de navegación (los bloqueados ya tienen el onclick inline)
    const btnOrders = document.getElementById('nav-orders'); 
    if(btnOrders && !PermissionService.can('web_orders')) { /* Lógica inline maneja el bloqueo */ }
    else if (btnOrders) { btnOrders.addEventListener('click', () => navigateTo('/admin/orders')); }

    const btnPos = document.getElementById('nav-pos'); if(btnPos) btnPos.addEventListener('click', () => navigateTo('/pos'));
    
    const btnHist = document.getElementById('nav-history'); 
    if(btnHist && !PermissionService.can('history')) { /* Lógica inline */ }
    else if(btnHist) { btnHist.addEventListener('click', () => navigateTo('/admin/history')); }
    const btnSup = document.getElementById('nav-suppliers'); 
    if (btnSup) btnSup.addEventListener('click', () => navigateTo('/admin/suppliers'));
    const btnSet = document.getElementById('nav-settings'); 
    if(btnSet && !PermissionService.can('settings')) { /* Lógica inline */ }
    else if(btnSet) { btnSet.addEventListener('click', () => navigateTo('/admin/settings')); }
    
    document.getElementById('nav-logout').addEventListener('click', async () => { await supabase.auth.signOut(); navigateTo('/'); });
    document.getElementById('theme-toggle-inv').addEventListener('click', () => ThemeService.toggle());

    // --- VARIABLES UI ---
    const tableBody = document.getElementById('inventory-table-body');
    const modal = document.getElementById('product-modal');
    const searchInput = document.getElementById('inventory-search');
    // Inputs del modal
    const pId = document.getElementById('prod-id');
    const pName = document.getElementById('prod-name');
    const pSku = document.getElementById('prod-sku');
    const pCat = document.getElementById('prod-cat');
    const pCost = document.getElementById('prod-cost');
    const pPrice = document.getElementById('prod-price');
    const pStock = document.getElementById('prod-stock');
    const pUnit = document.getElementById('prod-unit');
    const pBulk = document.getElementById('prod-bulk');

    // --- LÓGICA IMPORTAR CSV ---
    const inputCsv = document.getElementById('csv-input');
    // Nota: El click del input file se dispara desde el HTML si window.checkPlan devuelve true
    if (inputCsv) {
        inputCsv.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!confirm("¿Estás seguro de importar este archivo?")) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                const text = event.target.result;
                const rows = text.split('\n');
                let importedCount = 0;
                const productsToInsert = [];

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i].trim();
                    if (!row) continue;
                    const cols = row.split(',');
                    if (cols.length < 3) continue; 
                    // Ignorar cabecera si existe
                    if (cols[0].toLowerCase().includes('nombre') && i === 0) continue;

                    // Mapear columnas (Orden esperado: Nombre, SKU, Precio, Costo, Stock, Categoria)
                    const name = cols[0].trim();
                    const sku = cols[1].trim();
                    const price = parseFloat(cols[2]) || 0;
                    const cost = parseFloat(cols[3]) || 0;
                    const stock = parseFloat(cols[4]) || 0;
                    const category = cols[5] ? cols[5].trim() : 'General';

                    if (name && price >= 0) {
                        productsToInsert.push({
                            name, sku, price, cost_price: cost, stock, category,
                            business_id: businessId
                        });
                        importedCount++;
                    }
                }

                if (productsToInsert.length > 0) {
                    const { error } = await supabase.from('products').insert(productsToInsert);
                    if (error) {
                        alert("Error al importar: " + error.message);
                    } else {
                        alert(`✅ Éxito: ${importedCount} productos importados.`);
                        if(navigator.onLine) await syncService.downloadProducts();
                        loadProducts();
                    }
                } else {
                    alert("Archivo inválido o vacío.");
                }
                inputCsv.value = '';
            };
            reader.readAsText(file);
        });
    }

    // --- LÓGICA EXPORTAR CSV ---
    const btnExport = document.getElementById('btn-export-csv');
    // El bloqueo ya está en el onclick del HTML, aquí solo añadimos la lógica funcional
    if(btnExport) {
        btnExport.addEventListener('click', () => {
            // Verificación extra por seguridad (aunque checkPlan lo filtra visualmente)
            if(!PermissionService.can('export_excel')) return; 

            if(allProducts.length === 0) return alert("No hay productos para exportar.");
            
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Nombre,SKU,Precio,Costo,Stock,Categoria\n";

            allProducts.forEach(p => {
                const row = [
                    `"${p.name}"`,
                    p.sku || '',
                    p.price,
                    p.cost_price || 0,
                    p.stock,
                    p.category || 'General'
                ].join(",");
                csvContent += row + "\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "inventario_archsell.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // --- CARGA DE PRODUCTOS ---
    async function loadProducts() {
        allProducts = await db.products.toArray();
        if (allProducts.length > 0) renderTable(allProducts);
        else tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-secondary);">Sin datos locales. Conectando...</td></tr>`;

        if (navigator.onLine) {
            await syncService.downloadProducts();
            allProducts = await db.products.toArray();
            renderTable(allProducts);
        }
    }

    function renderTable(products) {
        tableBody.innerHTML = '';
        if(products.length === 0) return tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Inventario Vacío</td></tr>`;

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

    // --- LÓGICA CATEGORÍAS ---
    async function loadCategories() {
        const { data } = await supabase.from('categories').select('*').eq('business_id', businessId).order('name');
        if (data) {
            const val = pCat.value;
            pCat.innerHTML = `<option value="" disabled selected>Categoría</option>`;
            data.forEach(c => { const o = document.createElement('option'); o.value=c.name; o.textContent=c.name; pCat.appendChild(o); });
            if(val) pCat.value = val;
        }
    }

    document.getElementById('btn-new-cat').addEventListener('click', async () => {
        const n = prompt("Nueva Categoría:");
        if(n){ 
            const { error } = await supabase.from('categories').insert({name: n, business_id: businessId});
            if(!error) { loadCategories(); pCat.value=n; }
        }
    });

    // --- LÓGICA MODAL (CRUD) ---
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
        if (!businessId) return alert("Error crítico: No hay ID de negocio.");

        const data = {
            name: pName.value, sku: pSku.value, category: pCat.value, unit: pUnit.value,
            cost_price: parseFloat(pCost.value) || 0,
            price: parseFloat(pPrice.value), stock: parseFloat(pStock.value), is_bulk: pBulk.checked,
            business_id: businessId 
        };
        
        if(!data.name || !data.price) return alert("Faltan datos");

        if(pId.value) await supabase.from('products').update(data).eq('id', pId.value);
        else await supabase.from('products').insert(data);
        
        modal.style.display='none'; 
        if(navigator.onLine) await syncService.downloadProducts();
        loadProducts();
    });

    async function deleteProduct(id) {
        if(!confirm("¿Borrar producto?")) return;

        try {
            // 1. ACTUALIZACIÓN VISUAL INSTANTÁNEA (Optimistic UI)
            // Eliminamos el producto del array en memoria inmediatamente
            allProducts = allProducts.filter(p => p.id != id);
            // Redibujamos la tabla sin esperar al servidor
            renderTable(allProducts);

            // 2. ELIMINAR DE SUPABASE
            const { error } = await supabase.from('products').delete().eq('id', id);
            
            if (error) throw error;

            // 3. ELIMINAR DE BD LOCAL (Para consistencia si se recarga la página)
            // Convertimos a número por seguridad, ya que del HTML viene como string
            const idParsed = isNaN(Number(id)) ? id : Number(id);
            await db.products.delete(idParsed);

            // 4. SINCRONIZACIÓN SILENCIOSA (Opcional, para asegurar todo)
            if(navigator.onLine) {
                 await syncService.downloadProducts();
            }

        } catch (error) {
            console.error("Error al eliminar:", error);
            alert("Hubo un error al eliminar. Se recargarán los datos.");
            // Si falló, volvemos a cargar todo para que el producto reaparezca
            loadProducts(); 
        }
    }

    loadCategories(); loadProducts();
}