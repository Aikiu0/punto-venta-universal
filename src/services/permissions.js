// src/services/permissions.js - REGLAS DE NEGOCIO ACTUALIZADAS
const PLANS = {
    // PLAN 1: ESENCIAL (Operación básica)
    'esencial': ['pos', 'inventory', 'dashboard'],
    
    // PLAN 2: PROFESIONAL (Control + Carga Masiva)
    // Aquí movimos 'import_excel'
    'profesional': ['pos', 'inventory', 'dashboard', 'history', 'settings', 'import_excel'],
    
    // PLAN 3: EMPRESARIAL (Todo incluido + Tienda Online + Exportar)
    'empresarial': ['pos', 'inventory', 'dashboard', 'history', 'settings', 'import_excel', 'web_orders', 'export_excel']
};

export const PermissionService = {
    can(feature) {
        const currentPlan = localStorage.getItem('archsell_plan') || 'esencial';
        const allowedFeatures = PLANS[currentPlan];
        
        if (!allowedFeatures) return false;
        return allowedFeatures.includes(feature);
    },

    getCurrentPlanName() {
        const p = localStorage.getItem('archsell_plan') || 'esencial';
        return p.charAt(0).toUpperCase() + p.slice(1);
    }
};