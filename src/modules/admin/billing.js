import { supabase } from '../../data/supabase.js';
import { renderSidebarHeader } from './components/sidebarHeader.js';
import { PermissionService } from '../../services/permissions.js';
import { ThemeService } from '../../services/theme.js';
import { renderAdminSidebarNav } from './components/adminSidebarNav.js';

const PAGE_TITLE = "Facturación";

export function renderAdminBilling() {
    // Variables de Bloqueo
    const lockOrders = !PermissionService.can('web_orders');
    const lockSuppliers = !PermissionService.can('suppliers');
    const lockSettings = !PermissionService.can('settings');
    const lockHistory = !PermissionService.can('history');
    const lockInventory = !PermissionService.can('inventory');
    
    // Estilos Específicos de Facturación (Sin romper el sidebar)
    const styles = `
    <style>
        /* --- ESTILOS INTERNOS DE FACTURACIÓN --- */
        .billing-grid { 
            display: grid; grid-template-columns: 1fr 1fr; gap: 30px;
            animation: fadeInUp 0.4s ease-out;
        }
        @media(max-width: 900px) { .billing-grid { grid-template-columns: 1fr; } }

        /* Tabs más modernos */
        .tabs-container { display: flex; gap: 15px; border-bottom: 1px solid var(--border-color); margin-bottom: 25px; }
        .tab-btn { 
            padding: 10px 20px; border-bottom: 3px solid transparent; color: var(--text-secondary); 
            cursor: pointer; font-weight: 600; background: none; border-top: none; 
            border-left: none; border-right: none; transition: all 0.3s;
            font-size: 0.95rem;
        }
        .tab-btn.active { border-bottom-color: var(--brand-color); color: var(--brand-color); }
        .tab-btn:hover { color: var(--text-primary); }

        /* Inputs Premium */
        .input-group { margin-bottom: 15px; }
        .input-group label { 
            display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); 
            margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .premium-input { 
            width: 100%; padding: 12px; 
            border: 1px solid var(--border-color); border-radius: 8px; 
            background: var(--bg-input); color: var(--text-primary); 
            outline: none; font-size: 0.95rem; transition: all 0.2s;
        }
        .premium-input:focus { border-color: var(--brand-color); box-shadow: 0 0 0 3px rgba(var(--brand-rgb), 0.1); }
        .premium-input:disabled { opacity: 0.7; cursor: not-allowed; background: var(--bg-card); }

        /* Botones */
        .btn-primary { 
            background: var(--brand-color); color: white; border: none;
            padding: 12px 20px; border-radius: 8px; font-weight: 700; cursor: pointer;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: transform 0.2s;
            width: 100%; display: flex; justify-content: center; align-items: center; gap: 8px;
        }
        .btn-primary:hover { transform: translateY(-2px); opacity: 0.9; }

        .btn-secondary {
            background: transparent; color: var(--text-secondary); border: 1px solid var(--border-color);
            padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;
            width: 100%; transition: background 0.2s;
        }
        .btn-secondary:hover { background: var(--bg-input); color: var(--text-primary); }

        .btn-icon-add {
            height: 42px; width: 42px; border-radius: 8px; border: none;
            background: var(--brand-color); color: white; font-size: 1.5rem; 
            cursor: pointer; display: flex; justify-content: center; align-items: center;
            transition: transform 0.2s;
        }
        .btn-icon-add:hover { transform: scale(1.05); }

        .concept-container {
            background: var(--bg-card); border: 1px solid var(--border-color); 
            border-radius: 12px; padding: 20px; margin-top: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.02);
        }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
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
                    active: 'billing',
                    lockOrders,
                    lockSuppliers,
                    lockHistory,
                    lockSettings,
                    lockBilling: ''
                })}
            </aside>

            <main class="admin-content">
                <header class="content-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button id="mobile-menu-btn" aria-label="Abrir menú" style="background:none; border:none; font-size:1.25rem; color:var(--text-primary); cursor:pointer; display:none;"><i class="bi bi-list"></i></button>
                        <div>
                            <h1>${PAGE_TITLE}</h1>
                            <p style="font-size:0.8rem; color:var(--text-secondary);">Emite comprobantes fiscales (CFDI 4.0) válidos ante el SAT.</p>
                        </div>
                    </div>
                </header>

                <div class="card-panel">
                    <div class="tabs-container">
                        <button id="tab-emitir" class="tab-btn active"><i class="bi bi-receipt-cutoff" aria-hidden="true"></i> Nueva factura</button>
                        <button id="tab-config" class="tab-btn"><i class="bi bi-gear" aria-hidden="true"></i> Mis datos fiscales</button>
                    </div>

                    <div id="view-emitir">
                        
                        <div style="background: linear-gradient(to right, rgba(59, 130, 246, 0.1), transparent); border:1px solid #93c5fd; padding:15px 20px; border-radius:12px; margin-bottom:30px; display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <h4 style="margin:0 0 5px 0; color:var(--text-primary); font-size:1.05rem;">Factura Global del Día</h4>
                                <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Importar todas las ventas de hoy automáticamente.</p>
                            </div>
                            <button id="btn-load-global" class="btn-primary" style="width:auto; background: #2563eb;">
                                <span><i class="bi bi-arrow-repeat" aria-hidden="true"></i></span> Cargar ventas hoy
                            </button>
                        </div>

                        <div id="plan-notice-area"></div>

                        <div class="billing-grid">
                            <div>
                                <h3 style="color:var(--text-primary); margin-bottom:15px; font-size:1.1rem; border-bottom:1px solid var(--border-color); padding-bottom:5px;">1. Datos del Cliente</h3>
                                <div style="display:grid; gap:10px;">
                                    <div class="input-group">
                                        <label>RFC</label>
                                        <input type="text" id="cli-rfc" placeholder="XAXX010101000" class="premium-input" style="text-transform:uppercase;">
                                    </div>
                                    <div class="input-group">
                                        <label>Razón Social</label>
                                        <input type="text" id="cli-razon" placeholder="Ej: JUAN PEREZ LOPEZ" class="premium-input" style="text-transform:uppercase;">
                                    </div>
                                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                                        <div class="input-group">
                                            <label>C.P. Fiscal</label>
                                            <input type="text" id="cli-cp" placeholder="00000" class="premium-input">
                                        </div>
                                        <div class="input-group">
                                            <label>Uso CFDI</label>
                                            <select id="cli-uso" class="premium-input">
                                                <option value="G03">G03 - Gastos en general</option>
                                                <option value="G01">G01 - Adquisición de mercancías</option>
                                                <option value="S01">S01 - Sin efectos fiscales</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="input-group">
                                        <label>Régimen Fiscal</label>
                                        <select id="cli-regimen" class="premium-input">
                                            <option value="616">616 - Sin obligaciones (Público Gral)</option>
                                            <option value="601">601 - General de Ley P.M.</option>
                                            <option value="626">626 - RESICO</option>
                                            <option value="612">612 - Personas Físicas</option>
                                        </select>
                                    </div>
                                    <div class="input-group">
                                        <label>Correo Electrónico</label>
                                        <input type="email" id="cli-email" placeholder="cliente@email.com" class="premium-input">
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 style="color:var(--text-primary); margin-bottom:15px; font-size:1.1rem; border-bottom:1px solid var(--border-color); padding-bottom:5px;">2. Detalles de Pago</h3>
                                <div style="display:grid; gap:10px;">
                                    <div class="input-group">
                                        <label>Forma de Pago</label>
                                        <select id="fac-forma" class="premium-input">
                                            <option value="01">01 - Efectivo</option>
                                            <option value="03">03 - Transferencia (SPEI)</option>
                                            <option value="04">04 - Tarjeta de Crédito</option>
                                            <option value="28">28 - Tarjeta de Débito</option>
                                        </select>
                                    </div>
                                    <div class="input-group">
                                        <label>Método de Pago</label>
                                        <select id="fac-metodo" class="premium-input">
                                            <option value="PUE">PUE - Pago en una sola exhibición</option>
                                            <option value="PPD">PPD - Pago en parcialidades</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style="margin-top: 30px;">
                            <h3 style="color:var(--text-primary); margin-bottom:15px; font-size:1.1rem; border-bottom:1px solid var(--border-color); padding-bottom:5px;">3. Conceptos</h3>
                            <div class="concept-container">
                                <div style="display:flex; gap:10px; margin-bottom:20px; align-items:flex-end;">
                                    <div style="flex:3">
                                        <label class="input-group label" style="font-size:0.7rem;">Descripción</label>
                                        <input type="text" id="con-desc" placeholder="Producto o Servicio" class="premium-input">
                                    </div>
                                    <div style="width:80px;">
                                        <label class="input-group label" style="font-size:0.7rem;">Cant.</label>
                                        <input type="number" id="con-cant" placeholder="1" class="premium-input">
                                    </div>
                                    <div style="width:110px;">
                                        <label class="input-group label" style="font-size:0.7rem;">Precio</label>
                                        <input type="number" id="con-precio" placeholder="$" class="premium-input">
                                    </div>
                                    <button id="btn-add-concept" class="btn-icon-add">+</button>
                                </div>
                                
                                <ul id="concept-list" style="list-style:none; padding:0; min-height:50px;"></ul>
                                
                                <div style="text-align:right; margin-top:25px; padding-top:20px; border-top:1px solid var(--border-color);">
                                    <div style="color:var(--text-secondary); font-size:0.95rem; margin-bottom:5px;">Subtotal: <span id="lbl-subtotal">$0.00</span></div>
                                    <div style="color:var(--text-secondary); font-size:0.95rem; margin-bottom:10px;">IVA (16%): <span id="lbl-iva">$0.00</span></div>
                                    <div style="color:var(--text-primary); font-weight:800; font-size:1.8rem;">Total: <span id="lbl-total">$0.00</span></div>
                                </div>
                            </div>
                        </div>

                        <div style="display:flex; gap:20px; margin-top:40px;">
                            <button id="btn-preview" class="btn-secondary" style="flex:1;">
                                 Vista Previa PDF
                            </button>
                            <button id="btn-timbrar" class="btn-primary" style="flex:2;">
                                 Timbrar Factura
                            </button>
                        </div>
                    </div>

                    <div id="view-config" style="display:none; max-width:650px; margin:0 auto;">
                        <div style="background:rgba(249, 115, 22, 0.1); border:1px solid rgba(249, 115, 22, 0.3); padding:20px; margin-bottom:30px; border-radius:12px; display:flex; gap:15px;">
                            <div style="font-size:1.5rem;">🔐</div>
                            <div>
                                <h4 style="margin:0 0 5px 0; color:var(--text-primary);">Datos del Emisor</h4>
                                <p style="margin:0; font-size:0.9rem; color:var(--text-secondary);">Configura tus datos fiscales para emitir facturas.</p>
                            </div>
                        </div>
                        
                        <div style="display:grid; gap:15px;">
                            <div class="input-group">
                                <label>Tu RFC</label>
                                <input type="text" id="my-rfc" class="premium-input" style="text-transform:uppercase;">
                            </div>
                            <div class="input-group">
                                <label>Razón Social</label>
                                <input type="text" id="my-name" class="premium-input" style="text-transform:uppercase;">
                            </div>
                            <div class="input-group">
                                <label>Régimen Fiscal</label>
                                <select id="my-regimen" class="premium-input">
                                    <option value="626">626 - RESICO</option>
                                    <option value="612">612 - Persona Física Act. Empresarial</option>
                                    <option value="601">601 - General de Ley P.M.</option>
                                </select>
                            </div>
                            <div class="input-group">
                                <label>Código Postal Fiscal</label>
                                <input type="text" id="my-cp" class="premium-input">
                            </div>
                            
                            <div class="input-group" style="margin-top:10px;">
                                <label>Certificado Digital (.cer)</label>
                                <input type="file" disabled class="premium-input" style="background:var(--bg-input); opacity:0.6;">
                                <small style="color:var(--text-secondary); display:block; margin-top:5px;">* Se activará al conectar la API del PAC.</small>
                            </div>
                            
                            <button id="btn-save-config" class="btn-primary" style="margin-top:20px;">
                                <i class="bi bi-floppy" aria-hidden="true"></i> Guardar configuración
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    `;
}

export async function setupBillingLogic(router) {
    // --- LÓGICA DE MENÚ MÓVIL (Igual a Dashboard) ---
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btnOpen = document.getElementById('mobile-menu-btn');
    
    // Mostrar botón móvil si es necesario
    if (window.innerWidth <= 900) {
        if(btnOpen) btnOpen.style.display = 'block';
    }

    function toggleMenu(show) {
        if (show) { sidebar.classList.add('active'); overlay.classList.add('active'); }
        else { sidebar.classList.remove('active'); overlay.classList.remove('active'); }
    }
    if (btnOpen) btnOpen.addEventListener('click', () => toggleMenu(true));
    if (overlay) overlay.addEventListener('click', () => toggleMenu(false));

    const navTo = (p) => { toggleMenu(false); router.navigate(p); };

    // --- NAVEGACIÓN ---
    document.getElementById('nav-dash').addEventListener('click', () => navTo('/admin'));
    document.getElementById('nav-orders').addEventListener('click', () => navTo('/admin/orders'));
    document.getElementById('nav-inventory').addEventListener('click', () => navTo('/admin/inventory'));
    document.getElementById('nav-pos').addEventListener('click', () => navTo('/pos'));
    document.getElementById('nav-suppliers').addEventListener('click', (e) => window.checkPlan(e, 'suppliers') ? navTo('/admin/suppliers') : null);
    document.getElementById('nav-settings').addEventListener('click', (e) => window.checkPlan(e, 'settings') ? navTo('/admin/settings') : null);
    document.getElementById('nav-history').addEventListener('click', (e) => window.checkPlan(e, 'history') ? navTo('/admin/history') : null);
    document.getElementById('nav-logout').addEventListener('click', async () => { await supabase.auth.signOut(); router.navigate('/'); });

    // TABS
    const tabEmitir = document.getElementById('tab-emitir');
    const tabConfig = document.getElementById('tab-config');
    const viewEmitir = document.getElementById('view-emitir');
    const viewConfig = document.getElementById('view-config');

    function switchTab(view) {
        if(view === 'emitir') {
            viewEmitir.style.display='block'; viewConfig.style.display='none';
            tabEmitir.classList.add('active'); tabConfig.classList.remove('active');
        } else {
            viewEmitir.style.display='none'; viewConfig.style.display='block';
            tabConfig.classList.add('active'); tabEmitir.classList.remove('active');
            loadMyConfig();
        }
    }
    tabEmitir.onclick = () => switchTab('emitir');
    tabConfig.onclick = () => switchTab('config');

    // --- LOGICA CONFIGURACIÓN ---
    async function loadMyConfig() {
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase.from('billing_profile').select('*').eq('user_id', user.id).single();
        if(data) {
            document.getElementById('my-rfc').value = data.rfc || '';
            document.getElementById('my-name').value = data.razon_social || '';
            document.getElementById('my-regimen').value = data.regimen_fiscal || '626';
            document.getElementById('my-cp').value = data.codigo_postal || '';
        }
    }

    document.getElementById('btn-save-config').onclick = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const payload = {
            rfc: document.getElementById('my-rfc').value.toUpperCase(),
            razon_social: document.getElementById('my-name').value.toUpperCase(),
            regimen_fiscal: document.getElementById('my-regimen').value,
            codigo_postal: document.getElementById('my-cp').value,
            user_id: user.id
        };

        const { data } = await supabase.from('billing_profile').select('id').eq('user_id', user.id).single();
        if(data) {
            await supabase.from('billing_profile').update(payload).eq('id', data.id);
        } else {
            await supabase.from('billing_profile').insert(payload);
        }
        alert("✅ Datos fiscales guardados exitosamente.");
    };

    // --- LÓGICA FACTURA & FEATURE GATING (CANDADOS) ---
    
    // 1. Verificar Permiso VIP (Factura Individual)
    const canIndividual = PermissionService.can('billing_individual');
    
    const inputRfc = document.getElementById('cli-rfc');
    const inputRazon = document.getElementById('cli-razon');
    const inputCp = document.getElementById('cli-cp');
    const inputEmail = document.getElementById('cli-email');
    const selectRegimen = document.getElementById('cli-regimen');
    const selectUso = document.getElementById('cli-uso');

    // Si es PLAN PROFESIONAL (No tiene permiso billing_individual)
    if (!canIndividual) {
        // Llenar datos de Público en General obligatorios
        inputRfc.value = "XAXX010101000";
        inputRazon.value = "PÚBLICO EN GENERAL";
        selectRegimen.value = "616"; 
        selectUso.value = "S01";
        
        // Bloquear campos
        const fieldsToLock = [inputRfc, inputRazon, selectRegimen, selectUso];
        fieldsToLock.forEach(el => {
            el.disabled = true;
            el.title = "Solo Factura Global disponible en este plan.";
        });

        // Aviso visual
        const noticeArea = document.getElementById('plan-notice-area');
        noticeArea.innerHTML = `
            <div style="background:var(--bg-input); border:1px solid var(--border-color); padding:15px; border-radius:10px; margin-bottom:25px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; gap:10px; align-items:center;">
                    <span style="font-size:1.2rem;">🔒</span>
                    <div>
                        <strong style="color:var(--text-primary);">Modo Factura Global Activo</strong>
                        <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Tu plan actual solo permite facturar al público en general.</p>
                    </div>
                </div>
                <button id="btn-unlock-factura" style="background:var(--brand-color); color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:0.9rem; transition:transform 0.2s;">
                    Desbloquear Factura Individual 💎
                </button>
            </div>
        `;

        // Activar el modal de Upsell al hacer clic
        document.getElementById('btn-unlock-factura').onclick = (e) => {
            window.checkPlan(e, 'billing_individual'); 
        };
    }

    // --- LÓGICA DE CONCEPTOS ---
    let conceptos = [];

    document.getElementById('btn-add-concept').onclick = () => {
        const desc = document.getElementById('con-desc').value;
        const cant = parseFloat(document.getElementById('con-cant').value);
        const precio = parseFloat(document.getElementById('con-precio').value);

        if(!desc || !cant || !precio) return alert("Por favor completa los datos del concepto.");

        conceptos.push({ desc, cant, precio, subtotal: cant * precio });
        renderConceptos();
        
        document.getElementById('con-desc').value = '';
        document.getElementById('con-cant').value = '';
        document.getElementById('con-precio').value = '';
        document.getElementById('con-desc').focus();
    };

    function renderConceptos() {
        const list = document.getElementById('concept-list');
        list.innerHTML = '';
        let subtotal = 0;

        conceptos.forEach((c, idx) => {
            subtotal += c.subtotal;
            list.innerHTML += `
                <li style="display:flex; justify-content:space-between; padding:12px; border-bottom:1px solid var(--border-color); align-items:center;">
                    <span style="color:var(--text-primary);"><strong>${c.cant}</strong> x ${c.desc}</span>
                    <div style="display:flex; gap:15px; align-items:center;">
                        <b style="font-size:1rem; color:var(--text-primary);">$${c.subtotal.toFixed(2)}</b>
                        <button class="rm-con" data-i="${idx}" style="color:var(--danger-color); border:none; background:rgba(239, 68, 68, 0.1); width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
                    </div>
                </li>
            `;
        });

        const iva = subtotal * 0.16;
        const total = subtotal + iva;

        document.getElementById('lbl-subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('lbl-iva').textContent = `$${iva.toFixed(2)}`;
        document.getElementById('lbl-total').textContent = `$${total.toFixed(2)}`;
        
        document.querySelectorAll('.rm-con').forEach(b => b.onclick = (e) => {
            const index = e.target.closest('button').dataset.i;
            conceptos.splice(index, 1);
            renderConceptos();
        });
    }

    // --- CARGA DE FACTURA GLOBAL (FIX: VENTAS POR BUSINESS_ID) ---
    document.getElementById('btn-load-global').onclick = async () => {
        const btn = document.getElementById('btn-load-global');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-hourglass-split" aria-hidden="true"></i> Buscando...'; btn.disabled = true;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const businessId = localStorage.getItem('archsell_business_id');
            const today = new Date().toISOString().split('T')[0]; 
            
            // CONSTRUIR CONSULTA
            let query = supabase.from('sales')
                .select('*')
                .gte('created_at', `${today}T00:00:00`)
                .lte('created_at', `${today}T23:59:59`);

            // FIX CRÍTICO: Priorizar business_id si existe
            if (businessId) {
                query = query.eq('business_id', businessId);
            } else {
                query = query.eq('user_id', user.id);
            }

            const { data: ventas, error } = await query;

            if(error) throw error;

            if(!ventas || ventas.length === 0) {
                alert("⚠️ No se encontraron ventas registradas hoy.");
                btn.innerHTML = originalText; btn.disabled = false;
                return;
            }

            // Procesar Ventas
            conceptos = [];
            ventas.forEach(v => {
                // Verificar si ya fue facturada (opcional, lógica futura)
                conceptos.push({
                    desc: `Venta folio ${v.id.substring(0,8)}...`, // ID corto para el concepto
                    cant: 1,
                    precio: parseFloat(v.total),
                    subtotal: parseFloat(v.total)
                });
            });
            renderConceptos();
            
            // Si estamos en modo global, asegurar RFC genérico
            if(!inputRfc.disabled) {
                if(confirm("¿Establecer datos de Público en General?")) {
                    inputRfc.value = "XAXX010101000";
                    inputRazon.value = "PÚBLICO EN GENERAL";
                    selectRegimen.value = "616";
                    selectUso.value = "S01";
                }
            }

            alert(`✅ ${ventas.length} ventas cargadas correctamente.`);
        
        } catch (err) {
            console.error(err);
            alert("Error al cargar ventas: " + err.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    // --- GENERAR PDF ---
    document.getElementById('btn-preview').onclick = () => {
        if(conceptos.length === 0) return alert("No hay conceptos.");
        const rfc = document.getElementById('cli-rfc').value || "XAXX010101000";
        const razon = document.getElementById('cli-razon').value || "PÚBLICO EN GENERAL";
        
        const printContent = `
            <div style="font-family: 'Courier New', monospace; padding: 40px; max-width: 800px; margin: 0 auto; border:1px solid #ccc;">
                <h2 style="text-align:center;">FACTURA (VISTA PREVIA)</h2>
                <hr>
                <div style="display:flex; justify-content:space-between; margin-top:20px;">
                    <div>
                        <strong>EMISOR:</strong><br>
                        (Tus Datos)<br>
                        RFC: TU_RFC_AQUI
                    </div>
                    <div style="text-align:right;">
                        <strong>RECEPTOR:</strong><br>
                        ${razon}<br>
                        RFC: ${rfc}
                    </div>
                </div>
                <br><br>
                <table style="width:100%; border-collapse:collapse;">
                    <thead style="border-bottom:2px solid #000;">
                        <tr><th style="text-align:left;">Cant.</th><th style="text-align:left;">Descripción</th><th style="text-align:right;">Importe</th></tr>
                    </thead>
                    <tbody>
                        ${conceptos.map(c => `
                            <tr>
                                <td style="padding:10px 0;">${c.cant}</td>
                                <td>${c.desc}</td>
                                <td style="text-align:right;">$${c.subtotal.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <br>
                <h3 style="text-align:right;">Total: ${document.getElementById('lbl-total').textContent}</h3>
                <p style="text-align:center; font-size:0.8rem; margin-top:50px;">Documento sin validez fiscal (Simulación).</p>
            </div>
        `;

        const printWindow = window.open('', '', 'width=850,height=600');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
    };

    document.getElementById('btn-timbrar').onclick = async () => {
        if(conceptos.length === 0) return alert("Agrega al menos un concepto.");
        const clienteRfc = document.getElementById('cli-rfc').value;
        if(!clienteRfc) return alert("Falta el RFC del cliente.");
        
        const btn = document.getElementById('btn-timbrar');
        btn.innerHTML = '<i class="bi bi-hourglass-split" aria-hidden="true"></i> Generando...'; btn.disabled = true;
        
        // Simulación de timbrado
        setTimeout(() => {
            alert(`✅ ¡Factura Timbrada con Éxito! \n\nUUID: 550e8400-e29b-41d4-a716-446655440000\nSe envió el XML y PDF al correo.`);
            btn.innerHTML = '🚀 Timbrar Factura'; btn.disabled = false;
        }, 1500);
    };
}
