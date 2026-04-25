const item = ({ id, label, icon, active = false, extraClass = '', onClick = '', lock = false }) => `
    <button
        class="menu-item${active ? ' active' : ''}${extraClass ? ` ${extraClass}` : ''}"
        ${id ? `id="${id}"` : ''}
        ${active ? 'aria-current="page"' : ''}
        ${onClick ? `onclick="${onClick}"` : ''}
    >
        <i class="bi ${icon} menu-item-icon" aria-hidden="true"></i>
        <span>${lock ? '<i class="bi bi-lock-fill menu-lock-icon" aria-hidden="true"></i>' : ''}${label}</span>
    </button>
`;

export function renderAdminSidebarNav({
    active,
    lockOrders = false,
    lockSuppliers = false,
    lockHistory = false,
    lockSettings = false,
    lockBilling = null,
    includeBranches = false,
    includeTransfers = false
} = {}) {
    return `
        <nav class="sidebar-menu" id="sidebar-menu-nav">
            <div class="sidebar-menu-main">
                ${item({ id: 'nav-dash', label: 'Dashboard', icon: 'bi-house-door-fill', active: active === 'dashboard' })}
                ${item({ id: 'nav-orders', label: 'Pedidos web', icon: 'bi-bag-fill', active: active === 'orders', onClick: "return window.checkPlan(event,'web_orders')", lock: lockOrders })}
                ${item({ id: 'nav-inventory', label: 'Inventario', icon: 'bi-box-seam-fill', active: active === 'inventory' })}
                ${item({ id: 'nav-pos', label: 'Ir a caja', icon: 'bi-credit-card-2-front-fill', active: active === 'pos' })}
                ${item({ id: 'nav-suppliers', label: 'Estados de cuenta', icon: 'bi-wallet2', active: active === 'suppliers', onClick: "return window.checkPlan(event,'suppliers')", lock: lockSuppliers })}
                ${item({ id: 'nav-history', label: 'Historial', icon: 'bi-clock-history', active: active === 'history', onClick: "return window.checkPlan(event,'history')", lock: lockHistory })}
                ${includeBranches ? item({ id: 'nav-branches', label: 'Sucursales', icon: 'bi-shop', active: active === 'branches' }) : ''}
                ${includeTransfers ? item({ id: 'nav-transfers', label: 'Traspasos', icon: 'bi-arrow-left-right', active: active === 'transfers' }) : ''}
                ${lockBilling !== null ? item({ id: 'nav-billing', label: 'Facturación', icon: 'bi-receipt-cutoff', active: active === 'billing', onClick: "return window.checkPlan(event,'billing')", lock: lockBilling }) : ''}
                ${item({ id: 'nav-settings', label: 'Configuración', icon: 'bi-gear-fill', active: active === 'settings', onClick: "return window.checkPlan(event,'settings')", lock: lockSettings })}
            </div>
            <div class="sidebar-menu-footer">
                ${item({ id: 'nav-logout', label: 'Salir', icon: 'bi-box-arrow-right', extraClass: 'logout' })}
            </div>
        </nav>
    `;
}
