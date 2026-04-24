// src/services/permissions.js - FIX ESTILOS MODAL
const PLANS = {
    'esencial': ['pos', 'inventory', 'dashboard','settings'],
    'profesional': ['pos', 'inventory', 'dashboard', 'history', 'settings', 'import_excel','web_orders', 'suppliers', 'billing', 'export_excel', 'suppliers',  'billing_individual'],
    'empresarial': ['pos', 'inventory', 'dashboard', 'history', 'settings', 'import_excel', 'web_orders', 'export_excel', 'suppliers', 'billing', 'billing_individual'],
    'petmarc': ['pos', 'inventory', 'dashboard', 'history', 'settings', 'import_excel','web_orders', 'suppliers', 'billing', 'export_excel', 'suppliers',  'billing_individual']
};

function createUpsellModal() {
    if (document.getElementById('upsell-modal')) return;

    const style = document.createElement('style');
    style.innerHTML = `
        /* MODAL CENTRADO Y FLOTANTE */
        .upsell-overlay { 
            position: fixed !important; /* Forzamos que sea fijo a la ventana */
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0,0,0,0.6); 
            z-index: 99999 !important; /* Encima de absolutamente todo */
            display: flex; 
            justify-content: center; 
            align-items: center; 
            backdrop-filter: blur(4px); 
        }
        
        .upsell-card { 
            background: white; 
            padding: 40px 30px; 
            border-radius: 20px; 
            text-align: center; 
            max-width: 400px; 
            width: 90%; 
            box-shadow: 0 20px 50px rgba(0,0,0,0.3); 
            animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
            position: relative; 
            font-family: system-ui, -apple-system, sans-serif;
        }

        .upsell-icon { font-size: 60px; margin-bottom: 15px; display:block; }
        .upsell-title { font-size: 1.6rem; color: #1e293b; margin: 0 0 10px 0; font-weight: 800; }
        .upsell-text { color: #64748b; margin-bottom: 25px; line-height: 1.5; font-size: 1rem; }
        
        .upsell-btn { 
            background: linear-gradient(135deg, #25D366 0%, #128c7e 100%);
            color: white; 
            padding: 12px 30px; 
            border-radius: 50px; 
            text-decoration: none; 
            font-weight: bold; 
            display: inline-flex; 
            align-items: center; 
            gap: 10px; 
            transition: transform 0.2s, box-shadow 0.2s; 
            border: none; 
            cursor: pointer; 
            font-size: 1rem; 
            box-shadow: 0 5px 15px rgba(37, 211, 102, 0.4);
        }
        .upsell-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(37, 211, 102, 0.6); }
        
        .upsell-close { 
            position: absolute; 
            top: 15px; 
            right: 15px; 
            background: #f1f5f9; 
            border: none; 
            width: 30px; 
            height: 30px; 
            border-radius: 50%;
            font-size: 1.2rem; 
            cursor: pointer; 
            color: #64748b; 
            display:flex; justify-content:center; align-items:center;
            transition: background 0.2s;
        }
        .upsell-close:hover { background: #e2e8f0; color: #ef4444; }

        @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        /* Estilos para gráficas borrosas */
        .premium-blur-container { position: relative; overflow: hidden; border-radius: 10px; }
        .premium-blur-content { filter: blur(8px); opacity: 0.6; pointer-events: none; user-select: none; }
        .premium-lock-overlay { 
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
            z-index: 50; cursor: pointer; 
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            background: rgba(255,255,255,0.1); 
            transition: background 0.3s;
        }
        .premium-lock-overlay:hover { background: rgba(255,255,255,0.3); }
        .lock-badge { font-size: 3rem; margin-bottom: 10px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.2)); }
        .lock-text { font-weight: bold; color: #1e293b; background: rgba(255,255,255,0.9); padding: 5px 15px; border-radius: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'upsell-modal';
    modal.className = 'upsell-overlay';
    modal.style.display = 'none'; // Oculto por defecto
    modal.innerHTML = `
        <div class="upsell-card">
            <button class="upsell-close" onclick="document.getElementById('upsell-modal').style.display='none'">&times;</button>
            <div class="upsell-icon">💎</div>
            <h2 class="upsell-title">Función Premium</h2>
            <p class="upsell-text">Esta función está disponible exclusivamente en nuestros planes superiores. ¡Actualiza para desbloquear todo el potencial!</p>
            <a href="https://wa.me/527711836546h?text=Hola,%20me%20interesa%20actualizar%20mi%20plan%20pos." target="_blank" class="upsell-btn">
                <span>Contactar Ventas</span>
            </a>
        </div>
    `;
    
    // Aseguramos que se inyecte al final del body
    if(document.body) {
        document.body.appendChild(modal);
    } else {
        window.addEventListener('DOMContentLoaded', () => document.body.appendChild(modal));
    }
}

// Iniciar
createUpsellModal();

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

// Función global de bloqueo (CRÍTICA)
window.checkPlan = function(event, feature) {
    if (!PermissionService.can(feature)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        const modal = document.getElementById('upsell-modal');
        if(modal) {
            modal.style.display = 'flex'; // Usamos Flex para centrar
        }
        return false;
    }
    return true;
};