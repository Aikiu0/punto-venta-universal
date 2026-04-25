import { supabase } from '../../data/supabase.js';
import { renderSidebarHeader } from './components/sidebarHeader.js';
import { PermissionService } from '../../services/permissions.js';
import { ThemeService } from '../../services/theme.js';
import { renderAdminSidebarNav } from './components/adminSidebarNav.js';

// --- CONFIGURACIÓN ---
const PAGE_TITLE = "Proveedores & Clientes";

export function renderSuppliers() {
    const lockOrders = !PermissionService.can('web_orders');
    const lockBilling = !PermissionService.can('billing');
    const lockSettings = !PermissionService.can('settings');
    const lockHistory = !PermissionService.can('history');

    const styles = `
    <style>
        /* --- TRANSICIONES SUAVES --- */
        .admin-content, .card-panel, .premium-input,
        .modern-table th, .modern-table td,
        .modal-overlay, .premium-modal-card,
        .sidebar-menu .menu-item {
            transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        /* --- TABS PRINCIPALES --- */
        .main-tabs-bar {
            display: flex;
            gap: 0;
            border-bottom: 2px solid var(--border-color);
            margin-bottom: 25px;
        }
        .main-tab-btn {
            padding: 12px 28px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: 0.95rem;
            font-weight: 700;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            margin-bottom: -2px;
            transition: all 0.25s;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .main-tab-btn.active {
            color: var(--brand-color);
            border-bottom-color: var(--brand-color);
        }
        .main-tab-btn:hover:not(.active) {
            color: var(--text-primary);
            background: var(--bg-input);
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
            max-height: 90vh;
        }

        .modal-body-scroll {
            overflow-y: auto;
            padding-right: 5px;
        }

        .modal-header h2 { margin-top: 0; color: var(--text-primary); font-size: 1.5rem; }
        .modal-header p { color: var(--text-secondary); margin-bottom: 25px; }

        /* --- INPUTS Y FORMULARIOS --- */
        .purchase-row-top { margin-bottom: 15px; width: 100%; }
        .purchase-row-bottom {
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            gap: 20px;
            align-items: end;
            margin-bottom: 25px;
        }

        .input-group-premium { margin-bottom: 15px; width: 100%; }
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
            box-sizing: border-box;
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

        /* --- TARJETAS KPI CLIENTES --- */
        .client-kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 15px;
            margin-bottom: 25px;
        }
        .client-kpi-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 18px 20px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .client-kpi-label {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
        }
        .client-kpi-value {
            font-size: 1.6rem;
            font-weight: 800;
            color: var(--text-primary);
            line-height: 1;
        }

        /* --- ESTADOS VISUALES --- */
        .badge-green {
            background: rgba(16, 185, 129, 0.15);
            color: #10b981;
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 0.75rem;
            border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .badge-red {
            background: rgba(239, 68, 68, 0.15);
            color: #ef4444;
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 0.75rem;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .badge-yellow {
            background: rgba(245, 158, 11, 0.15);
            color: #f59e0b;
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 0.75rem;
            border: 1px solid rgba(245, 158, 11, 0.2);
        }

        /* --- HISTORIAL TIMELINE (Estado de cuenta) --- */
        .timeline-entry {
            display: flex;
            gap: 15px;
            padding: 14px 0;
            border-bottom: 1px solid var(--border-color);
            align-items: flex-start;
        }
        .timeline-entry:last-child { border-bottom: none; }
        .timeline-dot {
            width: 10px; height: 10px; border-radius: 50%;
            margin-top: 6px; flex-shrink: 0;
        }
        .timeline-dot.charge { background: #ef4444; }
        .timeline-dot.payment { background: #10b981; }

        /* --- BUSCADOR CLIENTES --- */
        .client-search-bar {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid var(--border-color);
            border-radius: 10px;
            background: var(--bg-input);
            color: var(--text-primary);
            font-size: 0.95rem;
            margin-bottom: 20px;
            box-sizing: border-box;
            outline: none;
        }
        .client-search-bar:focus {
            border-color: var(--brand-color);
            box-shadow: 0 0 0 3px rgba(122, 63, 157, 0.1);
        }

        @media(max-width: 700px) {
            .purchase-row-bottom { grid-template-columns: 1fr 1fr; }
            #btn-add-item { width: 100%; margin-top: 5px; grid-column: span 2; }
            .modal-footer-premium { flex-direction: column-reverse; }
            .main-tab-btn { padding: 10px 16px; font-size: 0.85rem; }
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
                ${renderAdminSidebarNav({
                    active: 'suppliers',
                    lockOrders,
                    lockHistory,
                    lockSettings
                })}
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button id="mobile-menu-btn" aria-label="Abrir menú" style="background:none; border:none; font-size:1.25rem; color:var(--text-primary); cursor:pointer;" class="mobile-only"><i class="bi bi-list"></i></button>
                        <div class="page-title">
                            <h1>${PAGE_TITLE}</h1>
                            <p>Gestión de compras, cuentas por pagar y estados de cuenta de clientes.</p>
                        </div>
                    </div>

                    <div style="display:flex; gap:15px; align-items:center;">
                        <button id="theme-toggle-sup" title="Cambiar Tema"
                            style="background:var(--bg-card); border:1px solid var(--border-color); color:var(--text-primary); padding:10px; border-radius:50%; cursor:pointer; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
                            <i class="bi bi-circle-half" aria-hidden="true"></i>
                        </button>
                        <button id="btn-main-add" class="btn-primary" style="display:flex; align-items:center; gap:8px;">
                            <i class="bi bi-plus-lg" aria-hidden="true"></i> <span class="desktop-only">Nuevo</span>
                        </button>
                    </div>
                </header>

                <!-- TABS PRINCIPALES -->
                <div class="card-panel">
                    <div class="main-tabs-bar">
                        <button class="main-tab-btn active" id="tab-suppliers-btn"> Proveedores</button>
                        <button class="main-tab-btn" id="tab-clients-btn"> Clientes / Cuentas</button>
                    </div>

                    <!-- ===== VISTA PROVEEDORES ===== -->
                    <div id="view-suppliers">
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

                    <!-- ===== VISTA CLIENTES ===== -->
                    <div id="view-clients" style="display:none;">
                        <!-- KPIs -->
                        <div class="client-kpi-grid" id="client-kpi-grid">
                            <div class="client-kpi-card" style="border-left: 4px solid #3b82f6;">
                                <span class="client-kpi-label">Total Clientes</span>
                                <span class="client-kpi-value" id="kpi-total-clients">—</span>
                            </div>
                            <div class="client-kpi-card" style="border-left: 4px solid #ef4444;">
                                <span class="client-kpi-label">Deuda Total</span>
                                <span class="client-kpi-value" id="kpi-total-debt" style="color:#ef4444;">—</span>
                            </div>
                            <div class="client-kpi-card" style="border-left: 4px solid #f59e0b;">
                                <span class="client-kpi-label">Con Deuda Activa</span>
                                <span class="client-kpi-value" id="kpi-clients-debt" style="color:#f59e0b;">—</span>
                            </div>
                            <div class="client-kpi-card" style="border-left: 4px solid #10b981;">
                                <span class="client-kpi-label">Al Corriente</span>
                                <span class="client-kpi-value" id="kpi-clients-ok" style="color:#10b981;">—</span>
                            </div>
                        </div>

                        <input type="text" class="client-search-bar" id="client-search" placeholder="🔍  Buscar cliente por nombre o teléfono...">

                        <div style="overflow-x:auto;">
                            <table class="modern-table">
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Contacto</th>
                                        <th>Total Comprado</th>
                                        <th>Deuda</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="clients-table-body">
                                    <tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-secondary);">Cargando clientes...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

            <!-- =========================================
                 MODALES PROVEEDORES (sin cambios)
                 ========================================= -->
            <div id="supplier-modal" class="modal-overlay">
                <div class="premium-modal-card">
                    <div class="modal-header">
                        <h2>Nuevo Proveedor</h2>
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
                            <button id="btn-add-item" title="Agregar a la lista" aria-label="Agregar a la lista"><i class="bi bi-plus-lg"></i></button>
                        </div>
                        <div class="purchase-list-container" style="background:var(--bg-input, rgba(0,0,0,0.02)); padding:15px; border-radius:12px; max-height:200px; overflow-y:auto; border:1px solid var(--border-color); margin-bottom:25px;">
                            <ul id="purchase-list" style="list-style:none; padding:0; margin:0; color:var(--text-primary);"></ul>
                            <div id="empty-list-msg" style="text-align:center; color:var(--text-secondary); font-size:0.9rem; padding:20px;">Tu lista de compra está vacía.</div>
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
                            <h2 style="margin:0; font-size:1.5rem; color:var(--text-primary);">Estado de Cuenta — Proveedor</h2>
                            <p id="lbl-hist-supplier" style="color:var(--primary-color, #6366f1); font-weight:600; margin:5px 0 0 0;">--</p>
                        </div>
                        <button id="btn-close-hist" style="background:none; border:none; color:var(--text-secondary); font-size:2rem; cursor:pointer; line-height:1;">&times;</button>
                    </div>
                    <div style="max-height:400px; overflow-y:auto; border: 1px solid var(--border-color); border-radius: 12px; background:var(--bg-input, transparent);">
                        <table class="modern-table" style="font-size:0.9rem;">
                            <thead style="position:sticky; top:0; background:var(--bg-card); z-index:5;">
                                <tr>
                                    <th>Fecha</th><th>Total</th><th>Pagado</th><th>Deuda</th>
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

            <!-- =========================================
                 MODALES CLIENTES (NUEVOS)
                 ========================================= -->

            <!-- Modal: Nuevo / Editar Cliente -->
            <div id="client-modal" class="modal-overlay">
                <div class="premium-modal-card" style="max-width: 520px;">
                    <div class="modal-header">
                        <h2 id="client-modal-title">Nuevo Cliente</h2>
                        <p>Información de contacto y crédito.</p>
                    </div>
                    <div class="modal-body-scroll">
                        <input type="hidden" id="cli-id">
                        <div style="display:grid; gap:15px;">
                            <div class="input-group-premium">
                                <label>Nombre Completo *</label>
                                <input type="text" id="cli-name" class="premium-input" placeholder="Ej: Juan Pérez López">
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                                <div class="input-group-premium">
                                    <label>Teléfono / WhatsApp</label>
                                    <input type="text" id="cli-phone" class="premium-input" placeholder="55 1234 5678">
                                </div>
                                <div class="input-group-premium">
                                    <label>Correo Electrónico</label>
                                    <input type="email" id="cli-email" class="premium-input" placeholder="cliente@email.com">
                                </div>
                            </div>
                            <div class="input-group-premium">
                                <label>Dirección (Opcional)</label>
                                <input type="text" id="cli-address" class="premium-input" placeholder="Calle, Colonia, Ciudad">
                            </div>
                            <div class="input-group-premium">
                                <label>Límite de Crédito ($)</label>
                                <input type="number" id="cli-credit-limit" class="premium-input" placeholder="0.00 = Sin límite">
                            </div>
                            <div class="input-group-premium">
                                <label>Notas Internas</label>
                                <textarea id="cli-notes" class="premium-input" rows="2" style="height:auto; resize:vertical;" placeholder="Ej: Cliente frecuente, paga quincenas..."></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer-premium">
                        <button id="btn-cancel-cli" class="btn-cancel-premium">Cancelar</button>
                        <button id="btn-save-cli" class="btn-save-premium">Guardar Cliente</button>
                    </div>
                </div>
            </div>

            <!-- Modal: Registrar Cargo al Cliente -->
            <div id="client-charge-modal" class="modal-overlay">
                <div class="premium-modal-card" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>Registrar Cargo / Venta a Crédito</h2>
                        <p id="lbl-charge-client" style="color:var(--brand-color); font-weight:700;">--</p>
                    </div>
                    <div class="modal-body-scroll">
                        <input type="hidden" id="charge-client-id">

                        <div class="input-group-premium">
                            <label>Descripción del cargo *</label>
                            <input type="text" id="charge-desc" class="premium-input" placeholder="Ej: Venta de cemento, 5 sacos">
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                            <div class="input-group-premium">
                                <label>Monto Total ($) *</label>
                                <input type="number" id="charge-amount" class="premium-input" placeholder="0.00">
                            </div>
                            <div class="input-group-premium">
                                <label>Abono Inicial ($)</label>
                                <input type="number" id="charge-initial-payment" class="premium-input" placeholder="0.00">
                            </div>
                        </div>
                        <div id="charge-debt-preview" style="background:var(--bg-input); border-radius:10px; padding:15px; margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:var(--text-secondary); font-size:0.9rem;">Deuda resultante:</span>
                            <strong id="lbl-charge-debt-preview" style="font-size:1.4rem; color:#ef4444;">$0.00</strong>
                        </div>
                        <div id="charge-limit-warning" style="display:none; margin-top:12px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); padding:12px; border-radius:10px; color:#f59e0b; font-size:0.9rem; font-weight:600;">
                            <i class="bi bi-exclamation-triangle" aria-hidden="true"></i> Este cargo supera el límite de crédito del cliente.
                        </div>
                    </div>
                    <div class="modal-footer-premium">
                        <button id="btn-cancel-charge" class="btn-cancel-premium">Cancelar</button>
                        <button id="btn-save-charge" class="btn-save-premium">Registrar Cargo</button>
                    </div>
                </div>
            </div>

            <!-- Modal: Estado de Cuenta del Cliente -->
            <div id="client-account-modal" class="modal-overlay">
                <div class="premium-modal-card" style="max-width: 820px;">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:5px;">
                        <div>
                            <h2 style="margin:0; font-size:1.5rem; color:var(--text-primary);">Estado de Cuenta</h2>
                            <p id="lbl-account-client" style="color:var(--brand-color); font-weight:700; margin:4px 0 0 0; font-size:1.05rem;">--</p>
                        </div>
                        <button id="btn-close-account" style="background:none; border:none; color:var(--text-secondary); font-size:2rem; cursor:pointer; line-height:1;">&times;</button>
                    </div>

                    <!-- Resumen financiero del cliente -->
                    <div id="account-summary" style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin:20px 0; padding:20px; background:var(--bg-input); border-radius:12px; border:1px solid var(--border-color);">
                        <div style="text-align:center;">
                            <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-secondary); margin-bottom:6px;">Total Comprado</div>
                            <div id="acc-total-bought" style="font-size:1.4rem; font-weight:800; color:var(--text-primary);">$0.00</div>
                        </div>
                        <div style="text-align:center; border-left:1px solid var(--border-color); border-right:1px solid var(--border-color);">
                            <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-secondary); margin-bottom:6px;">Total Pagado</div>
                            <div id="acc-total-paid" style="font-size:1.4rem; font-weight:800; color:#10b981;">$0.00</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-secondary); margin-bottom:6px;">Saldo Pendiente</div>
                            <div id="acc-total-debt" style="font-size:1.4rem; font-weight:800; color:#ef4444;">$0.00</div>
                        </div>
                    </div>

                    <!-- Botón abonar rápido -->
                    <div style="display:flex; justify-content:flex-end; margin-bottom:15px;">
                        <button id="btn-quick-payment" style="background:var(--brand-color); color:white; border:none; padding:10px 20px; border-radius:10px; cursor:pointer; font-weight:700; font-size:0.9rem; display:flex; align-items:center; gap:8px;">
                            <i class="bi bi-cash-coin" aria-hidden="true"></i> Registrar abono
                        </button>
                    </div>

                    <!-- Timeline de movimientos -->
                    <div style="max-height:380px; overflow-y:auto; border:1px solid var(--border-color); border-radius:12px; padding:15px 20px; background:var(--bg-input);">
                        <div id="account-timeline">
                            <p style="text-align:center; color:var(--text-secondary); padding:20px;">Cargando movimientos...</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal: Abono Rápido al Cliente -->
            <div id="client-pay-modal" class="modal-overlay">
                <div class="premium-modal-card" style="max-width: 420px;">
                    <div class="modal-header">
                        <h2>Registrar Abono</h2>
                        <p id="lbl-cli-pay-name" style="color:var(--brand-color); font-weight:700;">--</p>
                    </div>
                    <div class="modal-body-scroll">
                        <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); padding:18px; border-radius:12px; text-align:center; margin-bottom:20px;">
                            <span style="font-size:0.85rem; color:#ef4444; display:block; margin-bottom:5px;">Saldo pendiente del cliente:</span>
                            <strong id="lbl-cli-total-debt" style="font-size:1.6rem; color:#ef4444;">$0.00</strong>
                        </div>
                        <div class="input-group-premium">
                            <label>Monto del abono *</label>
                            <input type="number" id="cli-pay-amount" class="premium-input" placeholder="$0.00" style="font-size:1.2rem; text-align:center; font-weight:700;">
                        </div>
                        <div class="input-group-premium">
                            <label>Referencia / Nota (Opcional)</label>
                            <input type="text" id="cli-pay-note" class="premium-input" placeholder="Ej: Transferencia SPEI, efectivo...">
                        </div>
                        <input type="hidden" id="cli-pay-client-id">
                    </div>
                    <div class="modal-footer-premium">
                        <button id="btn-cancel-cli-pay" class="btn-cancel-premium">Cancelar</button>
                        <button id="btn-confirm-cli-pay" class="btn-save-premium">Confirmar Abono</button>
                    </div>
                </div>
            </div>

        </div>
    `;
}

export async function setupSuppliersLogic(router) {
    const navTo = (p) => router.navigate(p);

    // --- Sidebar & Theme ---
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btnOpen = document.getElementById('mobile-menu-btn');
    const themeBtn = document.getElementById('theme-toggle-sup');

    const updateThemeIcon = () => {
        if (themeBtn) {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            themeBtn.innerHTML = isDark
                ? '<i class="bi bi-sun-fill" aria-hidden="true"></i>'
                : '<i class="bi bi-circle-half" aria-hidden="true"></i>';
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
        });
    }

    const setupNav = (id, path) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => { toggleMenu(false); navTo(path); });
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

    // =====================================================
    // TABS PRINCIPALES
    // =====================================================
    const tabSuppliersBtn = document.getElementById('tab-suppliers-btn');
    const tabClientsBtn = document.getElementById('tab-clients-btn');
    const viewSuppliers = document.getElementById('view-suppliers');
    const viewClients = document.getElementById('view-clients');
    const btnMainAdd = document.getElementById('btn-main-add');

    let currentTab = 'suppliers';

    function switchMainTab(tab) {
        currentTab = tab;
        if (tab === 'suppliers') {
            viewSuppliers.style.display = 'block';
            viewClients.style.display = 'none';
            tabSuppliersBtn.classList.add('active');
            tabClientsBtn.classList.remove('active');
            btnMainAdd.innerHTML = '<span>+</span> <span class="desktop-only">Nuevo Proveedor</span>';
        } else {
            viewSuppliers.style.display = 'none';
            viewClients.style.display = 'block';
            tabSuppliersBtn.classList.remove('active');
            tabClientsBtn.classList.add('active');
            btnMainAdd.innerHTML = '<span>+</span> <span class="desktop-only">Nuevo Cliente</span>';
            loadClients();
        }
    }

    tabSuppliersBtn.addEventListener('click', () => switchMainTab('suppliers'));
    tabClientsBtn.addEventListener('click', () => switchMainTab('clients'));
    btnMainAdd.addEventListener('click', () => {
        if (currentTab === 'suppliers') openSupplierModal();
        else openClientModal();
    });

    // =====================================================
    // HELPERS
    // =====================================================
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

    const fmtMoney = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // =====================================================
    // PROVEEDORES — Lógica existente (íntegra)
    // =====================================================
    const tableBody = document.getElementById('suppliers-table-body');
    const modalSup = document.getElementById('supplier-modal');
    const modalPur = document.getElementById('purchase-modal');
    const modalHist = document.getElementById('history-modal');
    const modalPay = document.getElementById('pay-modal');

    async function loadSuppliers() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: suppliers } = await supabase.from('suppliers').select('*').eq('user_id', user.id).order('name');
        const { data: debts } = await supabase.from('supplier_purchases').select('*').eq('user_id', user.id).eq('status', 'pending');

        tableBody.innerHTML = '';
        if (!suppliers || suppliers.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-secondary);">No hay proveedores registrados.</td></tr>`;
            return;
        }

        suppliers.forEach(s => {
            const myDebts = debts ? debts.filter(d => d.supplier_id === s.id) : [];
            const totalDebt = myDebts.reduce((acc, d) => acc + (d.total - (d.amount_paid || 0)), 0);
            const debtBadge = totalDebt > 0.5
                ? `<span class="badge-red">Debe: ${fmtMoney(totalDebt)}</span>`
                : `<span class="badge-green">Al corriente</span>`;

            const tr = document.createElement('tr');
            tr.onmouseover = () => tr.style.background = 'var(--bg-input, rgba(0,0,0,0.02))';
            tr.onmouseout = () => tr.style.background = 'transparent';
            tr.innerHTML = `
                <td><div style="font-weight:700; color:var(--text-primary); font-size:1rem;">${s.name}</div></td>
                <td>
                    <div style="font-weight:600; color:var(--text-secondary); font-size:0.9rem;">${s.contact_name || '--'}</div>
                    <div style="color:var(--text-secondary); opacity:0.7; font-size:0.8rem;">${s.phone || ''}</div>
                </td>
                <td>${debtBadge}</td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-buy" title="Nueva compra" style="background:var(--primary-color, #6366f1); color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-size:0.9rem;"><i class="bi bi-cart-plus"></i></button>
                        <button class="btn-hist" title="Ver historial" style="background:var(--bg-input, transparent); color:var(--text-primary); border:1px solid var(--border-color); padding:8px 12px; border-radius:8px; cursor:pointer; font-size:0.9rem;"><i class="bi bi-clock-history"></i></button>
                        <button class="btn-del" title="Eliminar" style="background:transparent; color:#ef4444; border:none; padding:8px; cursor:pointer; font-size:1.1rem;"><i class="bi bi-trash3"></i></button>
                    </div>
                </td>`;
            tr.querySelector('.btn-buy').onclick = () => openPurchaseModal(s);
            tr.querySelector('.btn-hist').onclick = () => openHistoryModal(s);
            tr.querySelector('.btn-del').onclick = () => deleteSupplier(s.id);
            tableBody.appendChild(tr);
        });
    }

    // Purchase Modal
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
        if (term.length < 1) { resultsBox.style.display = 'none'; return; }
        const matches = availableProducts.filter(p => p.name.toLowerCase().includes(term) || (p.code && p.code.toLowerCase().includes(term)));
        renderSearchResults(matches);
    });

    function renderSearchResults(matches) {
        resultsBox.innerHTML = '';
        if (matches.length === 0) { resultsBox.style.display = 'none'; return; }
        matches.forEach(p => {
            const div = document.createElement('div');
            div.className = 'result-item';
            div.innerHTML = `<span class="result-name">${p.name}</span><span class="result-code">${p.code || ''}</span>`;
            div.onclick = () => selectProduct(p);
            resultsBox.appendChild(div);
        });
        resultsBox.style.display = 'block';
    }

    function selectProduct(product) {
        searchInput.value = product.name;
        selectedIdInput.value = product.id;
        resultsBox.style.display = 'none';
        if (product.cost_price || product.cost) costInput.value = product.cost_price || product.cost;
        document.getElementById('pur-qty').focus();
        document.getElementById('pur-qty').select();
    }

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsBox.contains(e.target)) resultsBox.style.display = 'none';
    });

    document.getElementById('btn-add-item').onclick = () => {
        const prodId = selectedIdInput.value;
        const prodName = searchInput.value;
        const cost = parseFloat(document.getElementById('pur-cost').value);
        const qty = parseFloat(document.getElementById('pur-qty').value);
        if (!prodId) return alert("Selecciona un producto de la lista.");
        if (isNaN(cost) || isNaN(qty) || qty <= 0) return alert("Ingresa costo y cantidad válidos.");
        purchaseItems.push({ id: prodId, name: prodName, cost, qty, total: cost * qty });
        renderPurchaseList();
        searchInput.value = ''; selectedIdInput.value = '';
        document.getElementById('pur-cost').value = ''; document.getElementById('pur-qty').value = '';
        searchInput.focus();
    };

    function renderPurchaseList() {
        const list = document.getElementById('purchase-list');
        const emptyMsg = document.getElementById('empty-list-msg');
        list.innerHTML = '';
        emptyMsg.style.display = purchaseItems.length === 0 ? 'block' : 'none';
        let total = 0;
        purchaseItems.forEach((i, idx) => {
            total += i.total;
            const li = document.createElement('li');
            li.style.cssText = 'border-bottom:1px solid var(--border-color); padding:12px 5px; display:flex; justify-content:space-between; align-items:center;';
            li.innerHTML = `
                <div>
                    <strong style="color:var(--text-primary);">${i.name}</strong><br>
                    <span style="color:var(--text-secondary); font-size:0.85rem;">${i.qty} pzas x $${i.cost}</span>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <b style="color:var(--text-primary);">${fmtMoney(i.total)}</b>
                    <button class="rm-item" data-idx="${idx}" style="background:rgba(239,68,68,0.1); border:none; color:#ef4444; cursor:pointer; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center;">&times;</button>
                </div>`;
            list.appendChild(li);
        });
        list.querySelectorAll('.rm-item').forEach(btn => {
            btn.onclick = (e) => { purchaseItems.splice(e.target.closest('button').getAttribute('data-idx'), 1); renderPurchaseList(); };
        });
        document.getElementById('pur-total').textContent = fmtMoney(total);
        updateDebtMsg();
    }

    document.getElementById('pur-paid').oninput = updateDebtMsg;
    function updateDebtMsg() {
        const total = parseFloat(document.getElementById('pur-total').textContent.replace('$', '').replace(',', '')) || 0;
        const paid = parseFloat(document.getElementById('pur-paid').value) || 0;
        const debt = total - paid;
        const msg = document.getElementById('pur-debt-msg');
        if (debt > 0.01) { msg.textContent = `Pendiente: ${fmtMoney(debt)}`; msg.style.color = '#ef4444'; }
        else { msg.textContent = 'Liquidado'; msg.style.color = '#10b981'; }
    }

    document.getElementById('btn-save-pur').onclick = async () => {
        if (purchaseItems.length === 0) return alert("Agrega al menos un producto.");
        const btn = document.getElementById('btn-save-pur');
        btn.textContent = 'Procesando...'; btn.disabled = true;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const supplierId = document.getElementById('pur-supplier-id').value;
            const total = parseFloat(document.getElementById('pur-total').textContent.replace('$', '').replace(',', ''));
            const paid = parseFloat(document.getElementById('pur-paid').value) || 0;
            const status = paid >= total ? 'completed' : 'pending';
            const { data: pur, error } = await supabase.from('supplier_purchases').insert({
                supplier_id: supplierId, total, amount_paid: paid, status, user_id: user.id
            }).select().single();
            if (error) throw error;
            for (const item of purchaseItems) {
                await supabase.from('purchase_items').insert({ purchase_id: pur.id, product_id: item.id, quantity: item.qty, cost_price: item.cost, user_id: user.id });
                const { data: prod } = await supabase.from('products').select('stock').eq('id', item.id).single();
                await supabase.from('products').update({ stock: (prod.stock || 0) + item.qty }).eq('id', item.id);
            }
            alert("✅ Compra registrada. Inventario actualizado.");
            closeModal(modalPur);
            loadSuppliers();
        } catch (e) { console.error(e); alert("Error al procesar la compra."); }
        finally { btn.textContent = 'Finalizar Compra'; btn.disabled = false; }
    };
    document.getElementById('btn-cancel-pur').onclick = () => closeModal(modalPur);

    // History Modal
    async function openHistoryModal(supplier) {
        document.getElementById('lbl-hist-supplier').textContent = supplier.name;
        const tbody = document.getElementById('history-table-body');
        tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center;">Consultando...</td></tr>';
        openModal(modalHist);
        const { data: purchases } = await supabase.from('supplier_purchases').select('*').eq('supplier_id', supplier.id).order('created_at', { ascending: false });
        tbody.innerHTML = '';
        if (!purchases || purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-secondary);">Sin historial.</td></tr>';
            return;
        }
        purchases.forEach(p => {
            const deuda = p.total - (p.amount_paid || 0);
            const tr = document.createElement('tr');
            const actionBtn = deuda > 0.5
                ? `<button class="btn-pay-debt" style="background:var(--primary-color,#6366f1); color:white; border:none; padding:6px 15px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:600;">Abonar</button>`
                : `<span style="color:#10b981; font-size:0.9rem; font-weight:600;">✔ Pagado</span>`;
            tr.innerHTML = `
                <td>${new Date(p.created_at).toLocaleDateString()}</td>
                <td style="font-weight:700;">${fmtMoney(p.total)}</td>
                <td style="color:var(--text-secondary);">${fmtMoney(p.amount_paid || 0)}</td>
                <td style="color:${deuda > 0.5 ? '#ef4444' : '#10b981'}; font-weight:700;">${fmtMoney(deuda)}</td>
                <td style="text-align:right;">${actionBtn}</td>`;
            if (deuda > 0.5) tr.querySelector('.btn-pay-debt').onclick = () => openPayModal(p);
            tbody.appendChild(tr);
        });
    }

    let currentPurchaseToPay = null;
    function openPayModal(purchase) {
        currentPurchaseToPay = purchase;
        const deuda = purchase.total - (purchase.amount_paid || 0);
        document.getElementById('lbl-debt-amount').textContent = fmtMoney(deuda);
        document.getElementById('pay-amount-input').value = '';
        openModal(modalPay);
        setTimeout(() => document.getElementById('pay-amount-input').focus(), 100);
    }

    document.getElementById('btn-cancel-pay').onclick = () => closeModal(modalPay);
    document.getElementById('btn-confirm-pay').onclick = async () => {
        if (!currentPurchaseToPay) return;
        const deuda = currentPurchaseToPay.total - (currentPurchaseToPay.amount_paid || 0);
        const pago = parseFloat(document.getElementById('pay-amount-input').value);
        if (isNaN(pago) || pago <= 0) return alert("Monto inválido");
        if (pago > deuda + 0.1) return alert("El monto excede la deuda.");
        const btn = document.getElementById('btn-confirm-pay');
        btn.textContent = 'Procesando...'; btn.disabled = true;
        try {
            const nuevoPagado = (currentPurchaseToPay.amount_paid || 0) + pago;
            await supabase.from('supplier_purchases').update({ amount_paid: nuevoPagado, status: nuevoPagado >= currentPurchaseToPay.total ? 'completed' : 'pending' }).eq('id', currentPurchaseToPay.id);
            alert("✅ Abono registrado.");
            closeModal(modalPay);
            const { data: sup } = await supabase.from('suppliers').select('*').eq('id', currentPurchaseToPay.supplier_id).single();
            openHistoryModal(sup);
            loadSuppliers();
        } catch (e) { console.error(e); alert("Error al registrar pago."); }
        finally { btn.textContent = 'Confirmar Pago'; btn.disabled = false; }
    };

    document.getElementById('btn-close-hist').onclick = () => closeModal(modalHist);

    // Supplier CRUD
    function openSupplierModal() {
        document.getElementById('sup-id').value = '';
        document.getElementById('sup-name').value = '';
        document.getElementById('sup-contact').value = '';
        document.getElementById('sup-phone').value = '';
        document.getElementById('sup-rfc').value = '';
        openModal(modalSup);
    }
    document.getElementById('btn-cancel-sup').onclick = () => closeModal(modalSup);
    document.getElementById('btn-save-sup').onclick = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const name = document.getElementById('sup-name').value;
        if (!name) return alert("El nombre es obligatorio");
        const btn = document.getElementById('btn-save-sup');
        btn.textContent = 'Guardando...'; btn.disabled = true;
        await supabase.from('suppliers').insert({ name, contact_name: document.getElementById('sup-contact').value, phone: document.getElementById('sup-phone').value, rfc: document.getElementById('sup-rfc').value, user_id: user.id });
        btn.textContent = 'Guardar'; btn.disabled = false;
        closeModal(modalSup);
        loadSuppliers();
    };

    async function deleteSupplier(id) {
        if (confirm("¿Eliminar este proveedor y todo su historial?")) {
            await supabase.from('suppliers').delete().eq('id', id);
            loadSuppliers();
        }
    }

    // =====================================================
    // CLIENTES — Módulo Nuevo
    // =====================================================
    const modalClient = document.getElementById('client-modal');
    const modalCharge = document.getElementById('client-charge-modal');
    const modalAccount = document.getElementById('client-account-modal');
    const modalCliPay = document.getElementById('client-pay-modal');

    let allClients = [];
    let currentAccountClient = null;

    // --- Carga y renderizado de clientes ---
    async function loadClients() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: clients, error } = await supabase
            .from('customers')
            .select('*')
            .eq('user_id', user.id)
            .order('name');

        if (error) {
            console.error('Error cargando clientes:', error);
            document.getElementById('clients-table-body').innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#ef4444;">Error al cargar. Verifica que la tabla "customers" existe en Supabase.</td></tr>`;
            return;
        }

        allClients = clients || [];

        // Cargar deudas/cargos de todos los clientes de una vez
        const { data: charges } = await supabase
            .from('customer_charges')
            .select('*')
            .eq('user_id', user.id);

        const chargesMap = {};
        (charges || []).forEach(c => {
            if (!chargesMap[c.customer_id]) chargesMap[c.customer_id] = [];
            chargesMap[c.customer_id].push(c);
        });

        renderClientsTable(allClients, chargesMap);
        updateClientKPIs(allClients, chargesMap);
    }

    function renderClientsTable(clients, chargesMap) {
        const tbody = document.getElementById('clients-table-body');
        tbody.innerHTML = '';

        if (clients.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-secondary);">No hay clientes registrados. Agrega el primero con el botón "+".</td></tr>`;
            return;
        }

        clients.forEach(c => {
            const clientCharges = chargesMap[c.id] || [];
            const totalBought = clientCharges.filter(ch => ch.type === 'charge').reduce((a, b) => a + Number(b.amount), 0);
            const totalPaid = clientCharges.filter(ch => ch.type === 'payment').reduce((a, b) => a + Number(b.amount), 0);
            const debt = totalBought - totalPaid;

            let statusBadge;
            if (debt > 0.5 && c.credit_limit > 0 && debt >= c.credit_limit * 0.9) {
                statusBadge = `<span class="badge-red"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i> Límite</span>`;
            } else if (debt > 0.5) {
                statusBadge = `<span class="badge-yellow">Con deuda</span>`;
            } else {
                statusBadge = `<span class="badge-green">Al corriente</span>`;
            }

            const tr = document.createElement('tr');
            tr.onmouseover = () => tr.style.background = 'var(--bg-input)';
            tr.onmouseout = () => tr.style.background = 'transparent';
            tr.innerHTML = `
                <td>
                    <div style="font-weight:700; color:var(--text-primary);">${c.name}</div>
                    ${c.notes ? `<div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">${c.notes}</div>` : ''}
                </td>
                <td>
                    <div style="color:var(--text-secondary); font-size:0.9rem;">${c.phone || '--'}</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); opacity:0.7;">${c.email || ''}</div>
                </td>
                <td style="font-weight:600; color:var(--text-primary);">${fmtMoney(totalBought)}</td>
                <td style="font-weight:700; color:${debt > 0.5 ? '#ef4444' : 'var(--text-secondary)'};">${fmtMoney(debt)}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn-cli-charge" title="Registrar cargo" style="background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); padding:7px 11px; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:700;">+ Cargo</button>
                        <button class="btn-cli-account" title="Ver estado de cuenta" style="background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); padding:7px 11px; border-radius:8px; cursor:pointer; font-size:0.85rem;">📋 Cuenta</button>
                        <button class="btn-cli-edit" title="Editar" style="background:transparent; color:var(--text-secondary); border:none; padding:7px; cursor:pointer; font-size:1rem;"><i class="bi bi-pencil-square"></i></button>
                        <button class="btn-cli-del" title="Eliminar" style="background:transparent; color:#ef4444; border:none; padding:7px; cursor:pointer; font-size:1rem;"><i class="bi bi-trash3"></i></button>
                    </div>
                </td>`;

            tr.querySelector('.btn-cli-charge').onclick = () => openChargeModal(c, debt);
            tr.querySelector('.btn-cli-account').onclick = () => openAccountModal(c);
            tr.querySelector('.btn-cli-edit').onclick = () => openClientModal(c);
            tr.querySelector('.btn-cli-del').onclick = () => deleteClient(c.id, c.name);
            tbody.appendChild(tr);
        });
    }

    function updateClientKPIs(clients, chargesMap) {
        let totalDebt = 0;
        let clientsWithDebt = 0;
        let clientsOk = 0;

        clients.forEach(c => {
            const charges = chargesMap[c.id] || [];
            const totalBought = charges.filter(ch => ch.type === 'charge').reduce((a, b) => a + Number(b.amount), 0);
            const totalPaid = charges.filter(ch => ch.type === 'payment').reduce((a, b) => a + Number(b.amount), 0);
            const debt = totalBought - totalPaid;
            totalDebt += debt;
            if (debt > 0.5) clientsWithDebt++;
            else clientsOk++;
        });

        document.getElementById('kpi-total-clients').textContent = clients.length;
        document.getElementById('kpi-total-debt').textContent = fmtMoney(totalDebt);
        document.getElementById('kpi-clients-debt').textContent = clientsWithDebt;
        document.getElementById('kpi-clients-ok').textContent = clientsOk;
    }

    // --- Buscador de clientes ---
    document.getElementById('client-search').addEventListener('input', async (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allClients.filter(c =>
            c.name.toLowerCase().includes(term) ||
            (c.phone && c.phone.includes(term)) ||
            (c.email && c.email.toLowerCase().includes(term))
        );

        // Recargar cargos para los filtrados
        const { data: charges } = await supabase.from('customer_charges').select('*');
        const chargesMap = {};
        (charges || []).forEach(c => {
            if (!chargesMap[c.customer_id]) chargesMap[c.customer_id] = [];
            chargesMap[c.customer_id].push(c);
        });
        renderClientsTable(filtered, chargesMap);
    });

    // --- Modal: Nuevo / Editar cliente ---
    function openClientModal(client = null) {
        document.getElementById('client-modal-title').textContent = client ? 'Editar Cliente' : 'Nuevo Cliente';
        document.getElementById('cli-id').value = client ? client.id : '';
        document.getElementById('cli-name').value = client ? client.name : '';
        document.getElementById('cli-phone').value = client ? (client.phone || '') : '';
        document.getElementById('cli-email').value = client ? (client.email || '') : '';
        document.getElementById('cli-address').value = client ? (client.address || '') : '';
        document.getElementById('cli-credit-limit').value = client ? (client.credit_limit || 0) : 0;
        document.getElementById('cli-notes').value = client ? (client.notes || '') : '';
        openModal(modalClient);
        setTimeout(() => document.getElementById('cli-name').focus(), 100);
    }

    document.getElementById('btn-cancel-cli').onclick = () => closeModal(modalClient);
    document.getElementById('btn-save-cli').onclick = async () => {
        const name = document.getElementById('cli-name').value.trim();
        if (!name) return alert("El nombre es obligatorio.");
        const btn = document.getElementById('btn-save-cli');
        btn.textContent = 'Guardando...'; btn.disabled = true;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const id = document.getElementById('cli-id').value;
            const payload = {
                name,
                phone: document.getElementById('cli-phone').value.trim(),
                email: document.getElementById('cli-email').value.trim(),
                address: document.getElementById('cli-address').value.trim(),
                credit_limit: parseFloat(document.getElementById('cli-credit-limit').value) || 0,
                notes: document.getElementById('cli-notes').value.trim(),
                user_id: user.id
            };

            if (id) {
                await supabase.from('customers').update(payload).eq('id', id);
            } else {
                await supabase.from('customers').insert(payload);
            }

            closeModal(modalClient);
            loadClients();
        } catch (e) { console.error(e); alert("Error al guardar cliente."); }
        finally { btn.textContent = 'Guardar Cliente'; btn.disabled = false; }
    };

    // --- Modal: Registrar Cargo ---
    function openChargeModal(client, currentDebt) {
        document.getElementById('lbl-charge-client').textContent = `${client.name}`;
        document.getElementById('charge-client-id').value = client.id;
        document.getElementById('charge-desc').value = '';
        document.getElementById('charge-amount').value = '';
        document.getElementById('charge-initial-payment').value = '';
        document.getElementById('lbl-charge-debt-preview').textContent = fmtMoney(currentDebt);
        document.getElementById('charge-limit-warning').style.display = 'none';

        const updatePreview = () => {
            const amount = parseFloat(document.getElementById('charge-amount').value) || 0;
            const initial = parseFloat(document.getElementById('charge-initial-payment').value) || 0;
            const newDebt = currentDebt + amount - initial;
            document.getElementById('lbl-charge-debt-preview').textContent = fmtMoney(newDebt < 0 ? 0 : newDebt);
            const warning = document.getElementById('charge-limit-warning');
            if (client.credit_limit > 0 && newDebt > client.credit_limit) {
                warning.style.display = 'block';
            } else {
                warning.style.display = 'none';
            }
        };

        document.getElementById('charge-amount').addEventListener('input', updatePreview);
        document.getElementById('charge-initial-payment').addEventListener('input', updatePreview);

        openModal(modalCharge);
        setTimeout(() => document.getElementById('charge-desc').focus(), 100);
    }

    document.getElementById('btn-cancel-charge').onclick = () => closeModal(modalCharge);
    document.getElementById('btn-save-charge').onclick = async () => {
        const desc = document.getElementById('charge-desc').value.trim();
        const amount = parseFloat(document.getElementById('charge-amount').value);
        const initialPayment = parseFloat(document.getElementById('charge-initial-payment').value) || 0;
        const clientId = document.getElementById('charge-client-id').value;

        if (!desc) return alert("La descripción es obligatoria.");
        if (isNaN(amount) || amount <= 0) return alert("El monto debe ser mayor a 0.");

        const btn = document.getElementById('btn-save-charge');
        btn.textContent = 'Registrando...'; btn.disabled = true;

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Registrar el cargo
            await supabase.from('customer_charges').insert({
                customer_id: clientId,
                user_id: user.id,
                type: 'charge',
                amount,
                description: desc,
                created_at: new Date().toISOString()
            });

            // Si hay abono inicial, registrarlo también
            if (initialPayment > 0) {
                await supabase.from('customer_charges').insert({
                    customer_id: clientId,
                    user_id: user.id,
                    type: 'payment',
                    amount: initialPayment,
                    description: `Abono inicial — ${desc}`,
                    created_at: new Date().toISOString()
                });
            }

            closeModal(modalCharge);
            loadClients();
            alert(`✅ Cargo registrado correctamente.`);
        } catch (e) { console.error(e); alert("Error al registrar cargo."); }
        finally { btn.textContent = 'Registrar Cargo'; btn.disabled = false; }
    };

    // --- Modal: Estado de Cuenta ---
    async function openAccountModal(client) {
        currentAccountClient = client;
        document.getElementById('lbl-account-client').textContent = `${client.name}${client.phone ? ' · ' + client.phone : ''}`;
        document.getElementById('acc-total-bought').textContent = '...';
        document.getElementById('acc-total-paid').textContent = '...';
        document.getElementById('acc-total-debt').textContent = '...';
        document.getElementById('account-timeline').innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding:20px;">Cargando movimientos...</p>';
        openModal(modalAccount);

        const { data: charges, error } = await supabase
            .from('customer_charges')
            .select('*')
            .eq('customer_id', client.id)
            .order('created_at', { ascending: false });

        if (error) {
            document.getElementById('account-timeline').innerHTML = '<p style="text-align:center; color:#ef4444; padding:20px;">Error al cargar movimientos.</p>';
            return;
        }

        const allCharges = charges || [];
        const totalBought = allCharges.filter(c => c.type === 'charge').reduce((a, b) => a + Number(b.amount), 0);
        const totalPaid = allCharges.filter(c => c.type === 'payment').reduce((a, b) => a + Number(b.amount), 0);
        const totalDebt = totalBought - totalPaid;

        document.getElementById('acc-total-bought').textContent = fmtMoney(totalBought);
        document.getElementById('acc-total-paid').textContent = fmtMoney(totalPaid);
        document.getElementById('acc-total-debt').textContent = fmtMoney(totalDebt < 0 ? 0 : totalDebt);
        document.getElementById('acc-total-debt').style.color = totalDebt > 0.5 ? '#ef4444' : '#10b981';

        // Renderizar timeline
        const timeline = document.getElementById('account-timeline');
        if (allCharges.length === 0) {
            timeline.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-secondary);">Sin movimientos registrados.</div>';
            return;
        }

        timeline.innerHTML = allCharges.map(c => {
            const isCharge = c.type === 'charge';
            const dateStr = new Date(c.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
            const timeStr = new Date(c.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            return `
            <div class="timeline-entry">
                <div class="timeline-dot ${isCharge ? 'charge' : 'payment'}"></div>
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                        <div>
                            <span style="font-weight:700; color:var(--text-primary); font-size:0.95rem;">${c.description || (isCharge ? 'Cargo' : 'Abono')}</span>
                            <span style="display:block; font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">${dateStr} a las ${timeStr}</span>
                        </div>
                        <span style="font-weight:800; font-size:1rem; white-space:nowrap; color:${isCharge ? '#ef4444' : '#10b981'};">
                            ${isCharge ? '-' : '+'} ${fmtMoney(c.amount)}
                        </span>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    document.getElementById('btn-close-account').onclick = () => closeModal(modalAccount);

    // Botón de abono rápido dentro del estado de cuenta
    document.getElementById('btn-quick-payment').onclick = () => {
        if (!currentAccountClient) return;
        const debtEl = document.getElementById('acc-total-debt');
        const debtVal = parseFloat(debtEl.textContent.replace(/[$,]/g, '')) || 0;
        openCliPayModal(currentAccountClient, debtVal);
    };

    // --- Modal: Abono al cliente ---
    function openCliPayModal(client, totalDebt) {
        document.getElementById('lbl-cli-pay-name').textContent = client.name;
        document.getElementById('lbl-cli-total-debt').textContent = fmtMoney(totalDebt);
        document.getElementById('cli-pay-amount').value = '';
        document.getElementById('cli-pay-note').value = '';
        document.getElementById('cli-pay-client-id').value = client.id;
        openModal(modalCliPay);
        setTimeout(() => document.getElementById('cli-pay-amount').focus(), 100);
    }

    document.getElementById('btn-cancel-cli-pay').onclick = () => closeModal(modalCliPay);
    document.getElementById('btn-confirm-cli-pay').onclick = async () => {
        const amount = parseFloat(document.getElementById('cli-pay-amount').value);
        const note = document.getElementById('cli-pay-note').value.trim();
        const clientId = document.getElementById('cli-pay-client-id').value;

        if (isNaN(amount) || amount <= 0) return alert("Ingresa un monto válido.");

        const btn = document.getElementById('btn-confirm-cli-pay');
        btn.textContent = 'Procesando...'; btn.disabled = true;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('customer_charges').insert({
                customer_id: clientId,
                user_id: user.id,
                type: 'payment',
                amount,
                description: note || 'Abono',
                created_at: new Date().toISOString()
            });

            alert(`✅ Abono de ${fmtMoney(amount)} registrado correctamente.`);
            closeModal(modalCliPay);

            // Actualizar estado de cuenta si está abierto
            if (currentAccountClient && currentAccountClient.id === clientId) {
                await openAccountModal(currentAccountClient);
            }
            loadClients();
        } catch (e) { console.error(e); alert("Error al registrar abono."); }
        finally { btn.textContent = 'Confirmar Abono'; btn.disabled = false; }
    };

    // --- Eliminar cliente ---
    async function deleteClient(id, name) {
        if (!confirm(`¿Eliminar al cliente "${name}" y todo su historial de cuenta?`)) return;
        try {
            await supabase.from('customer_charges').delete().eq('customer_id', id);
            await supabase.from('customers').delete().eq('id', id);
            loadClients();
        } catch (e) { console.error(e); alert("Error al eliminar cliente."); }
    }

    // --- Carga inicial ---
    loadSuppliers();
}
