// --- src/modules/admin/components/sidebarHeader.js ---
import { SettingsService } from '../../../services/settings.js'; 
import { PermissionService } from '../../../services/permissions.js';

// Estilos del brillo (CSS) - Se mantiene igual
const styleSheet = document.createElement("style");
styleSheet.id = 'shine-style-v3'; // Actualizamos versión ID
styleSheet.innerText = `
    @keyframes shineEffectPremium {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }
    .plan-badge-premium {
        /* Gradiente más sofisticado (Oro viejo / Bronce) */
        background: linear-gradient(270deg, #b45309, #d97706, #f59e0b, #d97706, #b45309);
        background-size: 400% 400%;
        animation: shineEffectPremium 4s ease infinite;
        box-shadow: 0 2px 10px rgba(180, 83, 9, 0.3), inset 0 1px 0 rgba(255,255,255,0.2);
        text-shadow: 0 1px 1px rgba(0,0,0,0.3);
    }
    /* Efecto de cristal oscuro para el contenedor del logo */
    .premium-glass-container {
        background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(0,0,0,0.2));
        border: 1px solid rgba(245, 158, 11, 0.15); /* Borde sutil dorado/bronce */
        box-shadow: 
            inset 0 1px 1px rgba(255,255,255,0.1), 
            0 4px 15px rgba(0,0,0,0.3);
    }
`;
if (!document.getElementById('shine-style-v3')) document.head.appendChild(styleSheet);

export function renderSidebarHeader() {
    const s = SettingsService.get() || {}; 
    const logo = s.logo_url || 'https://via.placeholder.com/100?text=Logo';
    const name = s.name || 'Cargando...';
    const planName = PermissionService.getCurrentPlanName(); 

    return `
        <div id="sidebar-header-root" style="
            width: 100%;
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center;
            text-align: center; 
            padding: 20px 10px 15px 10px;
            /* Separador inferior más elegante usando sombras en lugar de borde sólido */
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
            background: linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.2));
            box-sizing: border-box;
            margin-bottom: 15px;
            position: relative;
            z-index: 1;
        ">
            <div class="premium-glass-container" style="
                width: 50px; 
                height: 50px; 
                border-radius: 14px; /* Bordes un poco más suaves */
                /* QUITAMOS background: white y padding */
                padding: 0; 
                margin-bottom: 10px; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                overflow: hidden;
                position: relative;
            ">
                <img id="sb-real-logo" src="${logo}" style="
                    width: 100%; 
                    height: 100%; 
                    object-fit: cover; /* Cover para que llene el espacio sin bordes blancos */
                    border-radius: 14px;
                    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.2)); /* Sombra interna al logo */
                " onerror="this.src='https://via.placeholder.com/45?text=Error'">
            </div>

            <h3 id="sb-real-name" style="
                color: #e2e8f0; /* Blanco hueso, no blanco puro */
                margin: 0 0 8px 0; 
                font-size: 0.9rem; 
                font-weight: 700; 
                width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                letter-spacing: 0.5px;
                text-shadow: 0 2px 4px rgba(0,0,0,0.5); /* Profundidad */
            ">
                ${name}
            </h3>

            <span class="plan-badge-premium" style="
                color: white; 
                font-size: 0.65rem; 
                padding: 3px 12px; 
                border-radius: 6px; 
                font-weight: 800; 
                text-transform: uppercase; 
                letter-spacing: 1px;
            ">
                ${planName}
            </span>
        </div>
    `;
}