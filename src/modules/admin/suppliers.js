import { supabase } from '../../data/supabase.js';
import { renderSidebarHeader } from './components/sidebarHeader.js';
import { PermissionService } from '../../services/permissions.js';
import { ThemeService } from '../../services/theme.js';

// --- CONFIGURACIÓN ---
const PAGE_TITLE = "Proveedores"; 

export function renderSuppliers() {
    const lockOrders = PermissionService.can('web_orders') ? '' : '🔒 ';
    const lockBilling = PermissionService.can('billing') ? '' : '🔒 ';
    const lockSettings = PermissionService.can('settings') ? '' : '🔒 ';
    const lockHistory = PermissionService.can('history') ? '' : '🔒 ';

    // ESTILOS MEJORADOS (Layout corregido y Modal de Pago añadido)
    const styles = `
    <style>
        /* --- TRANSICIONES SUAVES --- */
        .admin-content, .card-panel, .premium-input, 
        .modern-table th, .modern-table td, 
        .modal-overlay, .premium-modal-card,
        .sidebar-menu .menu-item {
            transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        /* --- TABLAS --- */
        .modern-table { width: 100%; border-collapse: collapse; }
        .modern-table th {
            text-align: left; padding: 16px;
            background-color: var(--bg-input, rgba(0,0,0,0.02)); 
            color: var(--text-secondary);
            font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;
            border-bottom: 2px solid var(--border-color);
        }
        .modern-table td {
            padding: 16px;
            border-bottom: 1px solid var(--border-color);
            color: var(--text-primary);
        }
        
        /* --- MODALES --- */
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.6);
            z-index: 1000; display: none; justify-content: center; align-items: center;
            backdrop-filter: blur(4px);
        }

        .premium-modal-card {
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 35px;
            border-radius: 20px;
            width: 90%; max-width: 700px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            display: flex; flex-direction: column;
            max-height: 90vh; /* Evita que el modal sea más alto que la pantalla */
        }
        
        .modal-body-scroll {
            overflow-y: auto; /* Scroll interno si el contenido es muy largo */
            padding-right: 5px;
        }

        .modal-header h2 { margin-top: 0; color: var(--text-primary); font-size: 1.5rem; }
        .modal-header p { color: var(--text-secondary); margin-bottom: 25px; }

        /* --- INPUTS Y FORMULARIOS --- */
        
        /* CORRECCIÓN: Separamos el formulario de compra en filas para que no se encimen */
        .purchase-row-top {
            margin-bottom: 15px;
            width: 100%;
        }

        .purchase-row-bottom {
            display: grid;
            grid-template-columns: 1fr 1fr auto; /* Costo | Cantidad | Botón */
            gap: 20px;
            align-items: end; 
            margin-bottom: 25px;
        }
        
        .input-group-premium {
            margin-bottom: 15px;
            width: 100%;
        }

        .input-group-premium label {
            display: block; font-size: 0.85rem; font-weight: 600;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }
        
        .premium-input {
            width: 100%; 
            padding: 12px 14px;
            background-color: var(--bg-input, transparent);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            color: var(--text-primary);
            font-size: 0.95rem; 
            height: 48px;
            box-sizing: border-box; /* Asegura que el padding no rompa el ancho */
        }

        .premium-input:focus {
            border-color: var(--primary-color, #6366f1) !important;
            outline: none;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        /* --- AUTOCOMPLETE --- */
        .autocomplete-wrapper { position: relative; width: 100%; }
        
        .autocomplete-results {
            position: absolute;
            top: 100%; left: 0; right: 0;
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            max-height: 250px;
            overflow-y: auto;
            z-index: 100;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            margin-top: 5px;
            display: none;
        }
        
        .result-item {
            padding: 12px 15px; cursor: pointer;
            border-bottom: 1px solid var(--border-color);
            display: flex; justify-content: space-between;
            transition: background 0.2s;
        }
        .result-item:last-child { border-bottom: none; }
        .result-item:hover { background-color: var(--bg-input, rgba(0,0,0,0.05)); }
        
        .result-name { font-weight: 600; color: var(--text-primary); }
        .result-code { font-size: 0.8rem; color: var(--text-secondary); }

        /* --- BOTONES --- */
        .modal-footer-premium { display: flex; gap: 20px; margin-top: 20px; }
        
        .btn-cancel-premium {
            flex: 1; padding: 12px; border-radius: 10px; cursor: pointer;
            background: transparent; border: 1px solid var(--border-color); 
            color: var(--text-primary); font-weight: 600;
        }
        
        .btn-save-premium {
            flex: 2; padding: 12px; border-radius: 10px; cursor: pointer; border: none;
            background: var(--primary-color, #6366f1); color: white;
            font-weight: 600; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.3);
        }

        #btn-add-item {
            height: 48px; width: 48px; min-width: 48px;
            background: var(--primary-color, #6366f1); color: white; border: none; 
            border-radius: 10px; cursor: pointer; font-size: 1.4rem;
            display: flex; align-items: center; justify-content: center;
            margin-bottom: 1px; transition: transform 0.1s;
        }
        #btn-add-item:active { transform: scale(0.95); }
        
        @media(max-width: 700px) { 
            .purchase-row-bottom { 
                grid-template-columns: 1fr 1fr; /* En móvil, el botón pasa abajo */
            }
            #btn-add-item { width: 100%; margin-top: 5px; grid-column: span 2; }
            .modal-footer-premium { flex-direction: column-reverse; }
        }
    </style>
    `;

    return `
        ${styles}
        <div class="admin-container">
            <div class="sidebar-overlay" id="sidebar-overlay"></div>
            
            <aside class="admin-sidebar" id="admin-sidebar">
                <div class="sidebar-logo">
                    ${renderSidebarHeader()}
                </div>
                <nav class="sidebar-menu">
                    <button class="menu-item" id="nav-dash">📊 Dashboard</button>
                    <button class="menu-item" id="nav-orders" onclick="window.checkPlan(event, 'web_orders')">
                        ${lockOrders}🔔 Pedidos Web
                    </button>
                    <button class="menu-item" id="nav-inventory">📦 Inventario</button>
                    <button class="menu-item" id="nav-pos">🛒 Ir a Caja</button>
                    
                    <button class="menu-item active">🚚 ${PAGE_TITLE}</button>
                    
                    <button class="menu-item" id="nav-history" onclick="window.checkPlan(event, 'history')">
                        ${lockHistory}📅 Historial
                    </button>

                    <button class="menu-item" id="nav-billing" onclick="window.checkPlan(event, 'billing')">
                        ${lockBilling}💎 Facturación
                    </button>
                    <button class="menu-item" id="nav-settings" onclick="window.checkPlan(event, 'settings')">
                        ${lockSettings}⚙️ Configuración
                    </button>
                    <button class="menu-item logout" id="nav-logout">🚪 Salir</button>
                </nav>
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button id="mobile-menu-btn" style="background:none; border:none; font-size:1.8rem; color:var(--text-primary); cursor:pointer;" class="mobile-only">☰</button>
                        <div class="page-title">
                            <h1>${PAGE_TITLE}</h1>
                            <p>Gestión de compras y cuentas por pagar.</p>
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:15px; align-items:center;">
                        <button id="theme-toggle-sup" title="Cambiar Tema" 
                            style="background:var(--bg-card); border:1px solid var(--border-color); color:var(--text-primary); padding:10px; border-radius:50%; cursor:pointer; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
                            🌗
                        </button>
                        
                        <button id="btn-add-supplier" class="btn-primary" style="display:flex; align-items:center; gap:8px;">
                            <span>+</span> <span class="desktop-only">Nuevo</span>
                        </button>
                    </div>
                </header>

                <div class="card-panel">
                    <div style="overflow-x:auto;">
                        <table class="modern-table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Contacto</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="suppliers-table-body">
                                <tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-secondary);">Cargando datos...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            <div id="supplier-modal" class="modal-overlay">
                <div class="premium-modal-card">
                    <div class="modal-header">
                        <h2>Nuevo ${PAGE_TITLE.slice(0, -1)}</h2> 
                        <p>Información del socio comercial.</p>
                    </div>
                    <div class="modal-body-scroll">
                        <input type="hidden" id="sup-id">
                        
                        <div style="display:grid; gap:15px;">
                            <div class="input-group-premium">
                                <label for="sup-name">Empresa / Razón Social</label>
                                <input type="text" id="sup-name" class="premium-input" placeholder="Ej: Distribuidora El Sol S.A.">
                            </div>
                            
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                                <div class="input-group-premium">
                                    <label for="sup-contact">Contacto</label>
                                    <input type="text" id="sup-contact" class="premium-input" placeholder="Nombre completo">
                                </div>
                                <div class="input-group-premium">
                                    <label for="sup-phone">Teléfono</label>
                                    <input type="text" id="sup-phone" class="premium-input" placeholder="55 1234 5678">
                                </div>
                            </div>
                            
                            <div class="input-group-premium">
                                <label for="sup-rfc">RFC (Opcional)</label>
                                <input type="text" id="sup-rfc" class="premium-input" placeholder="RFC Genérico">
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer-premium">
                        <button id="btn-cancel-sup" class="btn-cancel-premium">Cancelar</button>
                        <button id="btn-save-sup" class="btn-save-premium">Guardar</button>
                    </div>
                </div>
            </div>

            <div id="purchase-modal" class="modal-overlay">
                <div class="premium-modal-card" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2>Registrar Compra</h2>
                        <p>Busca productos y agrégalos al pedido.</p>
                    </div>
                    
                    <div class="modal-body-scroll">
                        <div class="supplier-banner-info" style="margin-bottom: 20px;">
                            <span style="font-size:0.85rem; opacity:0.8;">Proveedor seleccionado:</span><br>
                            <strong id="lbl-supplier-pur" style="font-size:1.2rem; color:var(--primary-color, #6366f1);">--</strong>
                        </div>
                        <input type="hidden" id="pur-supplier-id">

                        <div class="purchase-row-top">
                            <div class="input-group-premium autocomplete-wrapper">
                                <label>Buscar Producto</label>
                                <input type="text" id="pur-search-input" class="premium-input" placeholder="Nombre o código..." autocomplete="off">
                                <input type="hidden" id="pur-selected-id"> 
                                <div id="pur-search-results" class="autocomplete-results"></div>
                            </div>
                        </div>

                        <div class="purchase-row-bottom">
                            <div class="input-group-premium">
                                <label>Costo Unit.</label>
                                <input type="number" id="pur-cost" placeholder="$0.00" class="premium-input">
                            </div>
                            
                            <div class="input-group-premium">
                                <label>Cant.</label>
                                <input type="number" id="pur-qty" placeholder="1" class="premium-input">
                            </div>
                            
                            <button id="btn-add-item" title="Agregar a la lista">+</button>
                        </div>

                        <div class="purchase-list-container" style="background:var(--bg-input, rgba(0,0,0,0.02)); padding:15px; border-radius:12px; max-height:200px; overflow-y:auto; border:1px solid var(--border-color); margin-bottom:25px;">
                            <ul id="purchase-list" style="list-style:none; padding:0; margin:0; color:var(--text-primary);"></ul>
                            <div id="empty-list-msg" style="text-align:center; color:var(--text-secondary); font-size:0.9rem; padding:20px;">
                                Tu lista de compra está vacía.
                            </div>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:20px;">
                            <div>
                                <div style="font-size:0.85rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:1px;">Total a Pagar</div>
                                <div id="pur-total" style="font-size:1.8rem; font-weight:800; color:var(--text-primary);">$0.00</div>
                            </div>
                            <div style="text-align:right;">
                                 <label style="font-size:0.85rem; color:var(--text-secondary); display:block; margin-bottom:8px;">¿Cuánto se pagará hoy?</label>
                                 <input type="number" id="pur-paid" value="0" class="premium-input" style="width:180px; text-align:right; font-weight:bold;">
                                 <div id="pur-debt-msg" style="font-size:0.9rem; margin-top:8px; font-weight:600; color:var(--text-primary);"></div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer-premium">
                        <button id="btn-cancel-pur" class="btn-cancel-premium">Cancelar Operación</button>
                        <button id="btn-save-pur" class="btn-save-premium">Finalizar Compra</button>
                    </div>
                </div>
            </div>

            <div id="history-modal" class="modal-overlay">
                <div class="premium-modal-card" style="max-width: 800px;">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:20px;">
                        <div>
                            <h2 style="margin:0; font-size:1.5rem; color:var(--text-primary);">Estado de Cuenta</h2>
                            <p id="lbl-hist-supplier" style="color:var(--primary-color, #6366f1); font-weight:600; margin:5px 0 0 0;">--</p>
                        </div>
                        <button id="btn-close-hist" style="background:none; border:none; color:var(--text-secondary); font-size:2rem; cursor:pointer; line-height:1;">&times;</button>
                    </div>
                    
                    <div style="max-height:400px; overflow-y:auto; border: 1px solid var(--border-color); border-radius: 12px; background:var(--bg-input, transparent);">
                        <table class="modern-table" style="font-size:0.9rem;">
                            <thead style="position:sticky; top:0; background:var(--bg-card); z-index:5;">
                                <tr>
                                    <th>Fecha</th>
                                    <th>Total</th>
                                    <th>Pagado</th>
                                    <th>Deuda</th>
                                    <th style="text-align:right;">Acción</th>
                                </tr>
                            </thead>
                            <tbody id="history-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="pay-modal" class="modal-overlay">
                <div class="premium-modal-card" style="max-width: 400px;">
                    <div class="modal-header">
                        <h2>Abonar a Deuda</h2>
                        <p>Registrar pago a proveedor.</p>
                    </div>
                    
                    <div class="modal-body-scroll">
                        <div style="margin-bottom: 20px; background:rgba(239, 68, 68, 0.1); padding:15px; border-radius:10px; border:1px solid rgba(239, 68, 68, 0.2); text-align:center;">
                            <span style="display:block; font-size:0.85rem; color:#ef4444; margin-bottom:5px;">Deuda actual de esta compra:</span>
                            <strong id="lbl-debt-amount" style="font-size:1.5rem; color:#ef4444;">$0.00</strong>
                        </div>

                        <div class="input-group-premium">
                            <label>Monto a abonar</label>
                            <input type="number" id="pay-amount-input" class="premium-input" placeholder="$0.00" style="font-size:1.2rem; font-weight:bold; text-align:center;">
                        </div>
                    </div>

                    <div class="modal-footer-premium">
                        <button id="btn-cancel-pay" class="btn-cancel-premium">Cancelar</button>
                        <button id="btn-confirm-pay" class="btn-save-premium">Confirmar Pago</button>
                    </div>
                </div>
            </div>

        </div>
    `;
}

export async function setupSuppliersLogic(router) {
    const navTo = (p) => router.navigate(p);
    
    // --- Lógica del Theme y Menú ---
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btnOpen = document.getElementById('mobile-menu-btn');
    const themeBtn = document.getElementById('theme-toggle-sup');

    const updateThemeIcon = () => {
        if(themeBtn) {
            const isDark = document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('dark-mode');
            themeBtn.textContent = isDark ? '☀️' : '🌗';
        }
    };
    updateThemeIcon();

    function toggleMenu(show) {
        if (show) { sidebar.classList.add('active'); overlay.classList.add('active'); }
        else { sidebar.classList.remove('active'); overlay.classList.remove('active'); }
    }

    if (btnOpen) btnOpen.addEventListener('click', () => toggleMenu(true));
    if (overlay) overlay.addEventListener('click', () => toggleMenu(false));
    
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            ThemeService.toggle();
            updateThemeIcon();
            document.body.style.display='none';
            document.body.offsetHeight; 
            document.body.style.display='';
        });
    }

    const setupNav = (id, path) => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('click', () => { toggleMenu(false); navTo(path); });
    };

    setupNav('nav-dash', '/admin');
    setupNav('nav-orders', '/admin/orders');
    setupNav('nav-inventory', '/admin/inventory');
    setupNav('nav-pos', '/pos');
    setupNav('nav-history', '/admin/history');
    setupNav('nav-billing', '/admin/billing');
    setupNav('nav-settings', '/admin/settings');
    
    document.getElementById('nav-logout').addEventListener('click', async () => { 
        await supabase.auth.signOut(); 
        router.navigate('/'); 
    });

    // --- Helpers DOM ---
    const tableBody = document.getElementById('suppliers-table-body');
    const modalSup = document.getElementById('supplier-modal');
    const modalPur = document.getElementById('purchase-modal');
    const modalHist = document.getElementById('history-modal');
    const modalPay = document.getElementById('pay-modal'); // Nuevo modal

    // Transiciones suaves en Modales
    const openModal = (modal) => { 
        modal.style.display = 'flex'; 
        modal.style.opacity = '0';
        requestAnimationFrame(() => {
            modal.style.transition = 'opacity 0.3s ease';
            modal.style.opacity = '1'; 
        });
    };
    const closeModal = (modal) => { 
        modal.style.opacity = '0'; 
        setTimeout(() => modal.style.display = 'none', 300); 
    };

    // --- 1. CARGAR DATOS ---
    async function loadSuppliers() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: suppliers } = await supabase.from('suppliers').select('*').eq('user_id', user.id).order('name');
        const { data: debts } = await supabase.from('supplier_purchases').select('*').eq('user_id', user.id).eq('status', 'pending');

        tableBody.innerHTML = '';
        if (!suppliers || suppliers.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-secondary);">No hay ${PAGE_TITLE.toLowerCase()} registrados.</td></tr>`;
            return;
        }

        suppliers.forEach(s => {
            const myDebts = debts ? debts.filter(d => d.supplier_id === s.id) : [];
            const totalDebt = myDebts.reduce((acc, d) => acc + (d.total - (d.amount_paid || 0)), 0);
            
            const debtBadge = totalDebt > 0.5 
                ? `<span style="background:rgba(239, 68, 68, 0.15); color:#ef4444; padding:6px 12px; border-radius:20px; font-weight:700; font-size:0.75rem; border:1px solid rgba(239, 68, 68, 0.2);">Debe: $${totalDebt.toFixed(2)}</span>`
                : `<span style="background:rgba(16, 185, 129, 0.15); color:#10b981; padding:6px 12px; border-radius:20px; font-weight:700; font-size:0.75rem; border:1px solid rgba(16, 185, 129, 0.2);">Al corriente</span>`;

            const tr = document.createElement('tr');
            tr.onmouseover = () => tr.style.background = 'var(--bg-input, rgba(0,0,0,0.02))';
            tr.onmouseout = () => tr.style.background = 'transparent';

            tr.innerHTML = `
                <td><div style="font-weight:700; color:var(--text-primary); font-size:1rem;">${s.name}</div></td>
                <td>
                    <div style="font-weight:600; color:var(--text-secondary); font-size:0.9rem;">${s.contact_name || '--'}</div>
                    <div style="color:var(--text-secondary); opacity:0.7; font-size:0.8rem;">${s.phone||''}</div>
                </td>
                <td>${debtBadge}</td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-buy" title="Nueva Compra" style="background:var(--primary-color, #6366f1); color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-size:0.9rem;">🛒</button>
                        <button class="btn-hist" title="Ver Historial" style="background:var(--bg-input, transparent); color:var(--text-primary); border:1px solid var(--border-color); padding:8px 12px; border-radius:8px; cursor:pointer; font-size:0.9rem;">📜</button>
                        <button class="btn-del" title="Eliminar" style="background:transparent; color:#ef4444; border:none; padding:8px; cursor:pointer; font-size:1.1rem;">🗑️</button>
                    </div>
                </td>
            `;
            
            tr.querySelector('.btn-buy').onclick = () => openPurchaseModal(s);
            tr.querySelector('.btn-hist').onclick = () => openHistoryModal(s);
            tr.querySelector('.btn-del').onclick = () => deleteSupplier(s.id);
            tableBody.appendChild(tr);
        });
    }

    // --- 2. MODAL COMPRA (LOGICA NUEVA DE BÚSQUEDA) ---
    let purchaseItems = [];
    let availableProducts = [];
    
    async function openPurchaseModal(supplier) {
        document.getElementById('lbl-supplier-pur').textContent = supplier.name;
        document.getElementById('pur-supplier-id').value = supplier.id;
        
        document.getElementById('pur-search-input').value = '';
        document.getElementById('pur-selected-id').value = '';
        document.getElementById('pur-cost').value = '';
        document.getElementById('pur-qty').value = '';
        document.getElementById('pur-search-results').style.display = 'none';

        const { data: products } = await supabase.from('products').select('*');
        availableProducts = products || [];

        purchaseItems = [];
        renderPurchaseList();
        document.getElementById('pur-paid').value = 0;
        updateDebtMsg();
        openModal(modalPur);
        
        setTimeout(() => document.getElementById('pur-search-input').focus(), 100);
    }

    const searchInput = document.getElementById('pur-search-input');
    const resultsBox = document.getElementById('pur-search-results');
    const selectedIdInput = document.getElementById('pur-selected-id');
    const costInput = document.getElementById('pur-cost');

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        selectedIdInput.value = '';
        
        if (term.length < 1) {
            resultsBox.style.display = 'none';
            return;
        }

        const matches = availableProducts.filter(p => {
            const nameMatch = p.name.toLowerCase().includes(term);
            const codeMatch = p.code ? p.code.toLowerCase().includes(term) : false;
            return nameMatch || codeMatch;
        });

        renderSearchResults(matches);
    });

    function renderSearchResults(matches) {
        resultsBox.innerHTML = '';
        if (matches.length === 0) {
            resultsBox.style.display = 'none';
            return;
        }

        matches.forEach(p => {
            const div = document.createElement('div');
            div.className = 'result-item';
            div.innerHTML = `
                <span class="result-name">${p.name}</span>
                <span class="result-code">${p.code || ''}</span>
            `;
            div.onclick = () => {
                selectProduct(p);
            };
            resultsBox.appendChild(div);
        });
        resultsBox.style.display = 'block';
    }

    function selectProduct(product) {
        searchInput.value = product.name;
        selectedIdInput.value = product.id;
        resultsBox.style.display = 'none';
        
        if(product.cost_price || product.cost) {
            costInput.value = product.cost_price || product.cost;
        }
        
        document.getElementById('pur-qty').focus();
        document.getElementById('pur-qty').select();
    }

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsBox.contains(e.target)) {
            resultsBox.style.display = 'none';
        }
    });

    document.getElementById('btn-add-item').onclick = () => {
        const prodId = selectedIdInput.value;
        const prodName = searchInput.value;
        const cost = parseFloat(document.getElementById('pur-cost').value);
        const qty = parseFloat(document.getElementById('pur-qty').value);

        if(!prodId) return alert("Por favor selecciona un producto de la lista.");
        if(isNaN(cost) || isNaN(qty) || qty <= 0) return alert("Ingresa costo y cantidad válidos.");

        purchaseItems.push({
            id: prodId,
            name: prodName,
            cost: cost,
            qty: qty,
            total: cost * qty
        });
        
        renderPurchaseList();
        
        searchInput.value = '';
        selectedIdInput.value = '';
        document.getElementById('pur-cost').value = '';
        document.getElementById('pur-qty').value = '';
        searchInput.focus();
    };

    function renderPurchaseList() {
        const list = document.getElementById('purchase-list');
        const emptyMsg = document.getElementById('empty-list-msg');
        list.innerHTML = '';
        
        if (purchaseItems.length === 0) {
            emptyMsg.style.display = 'block';
        } else {
            emptyMsg.style.display = 'none';
        }

        let total = 0;
        purchaseItems.forEach((i, idx) => {
            total += i.total;
            const li = document.createElement('li');
            li.style.borderBottom = '1px solid var(--border-color)';
            li.style.padding = '12px 5px';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            
            li.innerHTML = `
                <div>
                    <strong style="color:var(--text-primary); font-size:1rem;">${i.name}</strong><br>
                    <span style="color:var(--text-secondary); font-size:0.85rem;">
                        ${i.qty} pzas x $${i.cost}
                    </span>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <b style="color:var(--text-primary); font-size:1.1rem;">$${i.total.toFixed(2)}</b>
                    <button class="rm-item" data-idx="${idx}" style="background:rgba(239,68,68,0.1); border:none; color:#ef4444; cursor:pointer; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center;">&times;</button>
                </div>
            `;
            list.appendChild(li);
        });

        list.querySelectorAll('.rm-item').forEach(btn => {
            btn.onclick = (e) => {
                const idx = e.target.closest('button').getAttribute('data-idx');
                purchaseItems.splice(idx, 1);
                renderPurchaseList();
            };
        });

        document.getElementById('pur-total').textContent = `$${total.toFixed(2)}`;
        updateDebtMsg();
    }

    document.getElementById('pur-paid').oninput = updateDebtMsg;

    function updateDebtMsg() {
        const totalStr = document.getElementById('pur-total').textContent.replace('$','');
        const total = parseFloat(totalStr) || 0;
        const paid = parseFloat(document.getElementById('pur-paid').value) || 0;
        const debt = total - paid;
        
        const msg = document.getElementById('pur-debt-msg');
        if(debt > 0.01) {
            msg.textContent = `Pendiente por pagar: $${debt.toFixed(2)}`;
            msg.style.color = '#ef4444';
        } else {
            msg.textContent = 'Liquidado (Sin deuda) ✅';
            msg.style.color = '#10b981';
        }
    }

    document.getElementById('btn-save-pur').onclick = async () => {
        if(purchaseItems.length === 0) return alert("Agrega al menos un producto a la lista.");
        
        const btn = document.getElementById('btn-save-pur');
        btn.textContent = 'Procesando...';
        btn.disabled = true;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const supplierId = document.getElementById('pur-supplier-id').value;
            const totalStr = document.getElementById('pur-total').textContent.replace('$','');
            const total = parseFloat(totalStr);
            const paid = parseFloat(document.getElementById('pur-paid').value) || 0;
            const status = paid >= total ? 'completed' : 'pending';

            const { data: pur, error } = await supabase.from('supplier_purchases').insert({
                supplier_id: supplierId, total: total, amount_paid: paid, status: status, user_id: user.id
            }).select().single();

            if(error) throw error;

            for (const item of purchaseItems) {
                await supabase.from('purchase_items').insert({
                    purchase_id: pur.id, product_id: item.id, quantity: item.qty, cost_price: item.cost, user_id: user.id
                });
                
                const { data: prod } = await supabase.from('products').select('stock').eq('id', item.id).single();
                const newStock = (prod.stock || 0) + item.qty;
                await supabase.from('products').update({stock: newStock}).eq('id', item.id);
            }

            alert("✅ Compra registrada correctamente. Inventario actualizado.");
            closeModal(modalPur);
            loadSuppliers();

        } catch (e) {
            console.error(e);
            alert("Error al procesar la compra. Verifica tu conexión.");
        } finally {
            btn.textContent = 'Finalizar Compra';
            btn.disabled = false;
        }
    };

    document.getElementById('btn-cancel-pur').onclick = () => closeModal(modalPur);

    // --- 3. HISTORIAL ---
    async function openHistoryModal(supplier) {
        document.getElementById('lbl-hist-supplier').textContent = supplier.name;
        const tbody = document.getElementById('history-table-body');
        tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center;">Consultando historial...</td></tr>';
        openModal(modalHist);

        const { data: purchases } = await supabase.from('supplier_purchases')
            .select('*')
            .eq('supplier_id', supplier.id)
            .order('created_at', {ascending: false});

        tbody.innerHTML = '';
        if(!purchases || purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-secondary);">Sin historial previo.</td></tr>';
            return;
        }

        purchases.forEach(p => {
            const deuda = p.total - (p.amount_paid || 0);
            const tr = document.createElement('tr');
            
            let actionBtn = '';
            if(deuda > 0.5) {
                actionBtn = `<button class="btn-pay-debt" style="background:var(--primary-color, #6366f1); color:white; border:none; padding:6px 15px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:600;">Abonar</button>`;
            } else {
                 actionBtn = `<span style="color:#10b981; font-size:0.9rem; font-weight:600;">✔ Pagado</span>`;
            }

            tr.innerHTML = `
                <td>${new Date(p.created_at).toLocaleDateString()}</td>
                <td style="font-weight:700;">$${p.total.toFixed(2)}</td>
                <td style="color:var(--text-secondary);">$${(p.amount_paid||0).toFixed(2)}</td>
                <td style="color:${deuda > 0.5 ? '#ef4444' : '#10b981'}; font-weight:700;">$${deuda.toFixed(2)}</td>
                <td style="text-align:right;">${actionBtn}</td>
            `;
            
            if(deuda > 0.5) {
                // Ahora llamamos a openPayModal en lugar de abonarDeuda (prompt)
                tr.querySelector('.btn-pay-debt').onclick = () => openPayModal(p);
            }
            tbody.appendChild(tr);
        });
    }

    // --- LÓGICA DE PAGO CON MODAL (NUEVA) ---
    let currentPurchaseToPay = null;

    function openPayModal(purchase) {
        currentPurchaseToPay = purchase;
        const deuda = purchase.total - (purchase.amount_paid || 0);
        
        document.getElementById('lbl-debt-amount').textContent = `$${deuda.toFixed(2)}`;
        document.getElementById('pay-amount-input').value = '';
        document.getElementById('pay-amount-input').focus();
        
        openModal(modalPay);
    }

    document.getElementById('btn-cancel-pay').onclick = () => closeModal(modalPay);

    document.getElementById('btn-confirm-pay').onclick = async () => {
        if(!currentPurchaseToPay) return;

        const deuda = currentPurchaseToPay.total - (currentPurchaseToPay.amount_paid || 0);
        const pagoInput = document.getElementById('pay-amount-input');
        const pago = parseFloat(pagoInput.value);

        if(isNaN(pago) || pago <= 0) return alert("Monto inválido");
        if(pago > (deuda + 0.1)) return alert("El monto excede la deuda.");

        const btn = document.getElementById('btn-confirm-pay');
        btn.textContent = 'Procesando...'; btn.disabled = true;

        try {
            const nuevoPagado = (currentPurchaseToPay.amount_paid || 0) + pago;
            const nuevoStatus = nuevoPagado >= currentPurchaseToPay.total ? 'completed' : 'pending';

            await supabase.from('supplier_purchases').update({
                amount_paid: nuevoPagado,
                status: nuevoStatus
            }).eq('id', currentPurchaseToPay.id);

            alert("✅ Abono registrado correctamente.");
            closeModal(modalPay);
            
            // Recargar para ver cambios
            const { data: sup } = await supabase.from('suppliers').select('*').eq('id', currentPurchaseToPay.supplier_id).single();
            openHistoryModal(sup);
            loadSuppliers();
        } catch(e) {
            console.error(e);
            alert("Error al registrar pago.");
        } finally {
            btn.textContent = 'Confirmar Pago'; btn.disabled = false;
        }
    };

    document.getElementById('btn-close-hist').onclick = () => closeModal(modalHist);

    // --- 4. CRUD BASIC ---
    document.getElementById('btn-add-supplier').onclick = () => {
        document.getElementById('sup-id').value = '';
        document.getElementById('sup-name').value = '';
        document.getElementById('sup-contact').value = '';
        document.getElementById('sup-phone').value = '';
        document.getElementById('sup-rfc').value = '';
        openModal(modalSup);
    };
    document.getElementById('btn-cancel-sup').onclick = () => closeModal(modalSup);
    
    document.getElementById('btn-save-sup').onclick = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const name = document.getElementById('sup-name').value;
        const contact = document.getElementById('sup-contact').value;
        const phone = document.getElementById('sup-phone').value;
        const rfc = document.getElementById('sup-rfc').value;

        if(!name) return alert("El nombre de la empresa es obligatorio");

        const btn = document.getElementById('btn-save-sup');
        btn.textContent = 'Guardando...'; btn.disabled = true;

        await supabase.from('suppliers').insert({
            name, contact_name: contact, phone, rfc, user_id: user.id
        });
        
        btn.textContent = 'Guardar Proveedor'; btn.disabled = false;
        closeModal(modalSup);
        loadSuppliers();
    };

    async function deleteSupplier(id) {
        if(confirm("¿Estás seguro de eliminar este proveedor?\n\nSe eliminará todo su historial de compras.")) {
            await supabase.from('suppliers').delete().eq('id', id);
            loadSuppliers();
        }
    }

    loadSuppliers();
}