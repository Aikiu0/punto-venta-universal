// src/services/upselling.js
import { PermissionService } from './permissions.js';

export const UpsellingUI = {
    // 1. INYECTA LOS ESTILOS (Solo se ejecuta una vez)
    injectStyles() {
        if (document.getElementById('upselling-styles')) return;
        const style = document.createElement('style');
        style.id = 'upselling-styles';
        style.innerHTML = `
            /* --- ESTILOS DE UPSELLING (No tocan tu diseño original) --- */
            .locked-item { opacity: 0.6; cursor: not-allowed !important; position: relative; background: rgba(0,0,0,0.02); }
            .locked-icon { float: right; font-size: 0.9rem; opacity: 0.7; }
            
            /* Efecto Blur para Contenedores */
            .blur-wrapper { position: relative; overflow: hidden; height: 100%; width: 100%; }
            .blur-content { filter: blur(5px); pointer-events: none; user-select: none; height: 100%; opacity: 0.6; }
            .lock-overlay {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                background: rgba(255,255,255,0.2); z-index: 10; backdrop-filter: blur(2px); cursor: pointer;
            }
            .lock-badge { 
                background: #7A3F9D; color: white; padding: 6px 14px; border-radius: 20px; 
                font-size: 0.8rem; font-weight: bold; box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            }

            /* Modal Upgrade */
            .upg-modal {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.8); z-index: 99999; display: none;
                justify-content: center; align-items: center; backdrop-filter: blur(4px);
                animation: fadeIn 0.2s ease-out;
            }
            .upg-card {
                background: white; padding: 30px; border-radius: 16px; text-align: center;
                max-width: 400px; width: 90%; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            }
            .upg-btn {
                background: #25D366; color: white; padding: 12px 24px; border-radius: 50px;
                text-decoration: none; font-weight: bold; display: inline-block; margin-top: 15px;
                transition: transform 0.2s;
            }
            .upg-btn:hover { transform: scale(1.05); }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            
            /* Dark Mode Fix para el Modal */
            body.dark-mode .upg-card { background: #1e293b; color: #f8fafc; border: 1px solid #334155; }
        `;
        document.head.appendChild(style);
    },

    // 2. RENDERIZA EL MODAL (Poner al final del return HTML)
    renderModalHTML() {
        return `
            <div id="upgrade-modal" class="upg-modal">
                <div class="upg-card">
                    <button id="close-upg" style="position:absolute; top:15px; right:15px; background:none; border:none; font-size:1.5rem; cursor:pointer; color:inherit;">&times;</button>
                    <div style="font-size:3rem; margin-bottom:10px;">🚀</div>
                    <h2 style="margin-bottom:10px;">Función Premium</h2>
                    <p style="opacity:0.8; margin-bottom:20px; line-height:1.5;">
                        Esta característica está disponible en los planes superiores.
                    </p>
                    <a href="https://wa.me/527712351341" target="_blank" class="upg-btn">
                        ⭐ Mejorar Plan Ahora
                    </a>
                </div>
            </div>
        `;
    },

    // 3. RENDERIZA UN BOTÓN DEL MENÚ (Con o sin candado)
    renderMenuItem(id, label, icon, permission, isActive = false) {
        const allowed = PermissionService.can(permission);
        const activeClass = isActive ? 'active' : '';
        const lockClass = allowed ? '' : 'locked-item';
        const lockIcon = allowed ? '' : '<span class="locked-icon">🔒</span>';
        
        // El atributo data-locked es la clave para interceptar el click
        return `
            <button class="menu-item ${activeClass} ${lockClass}" id="${id}" data-locked="${!allowed}">
                ${icon} ${label} ${lockIcon}
            </button>
        `;
    },

    // 4. ENVUELVE CONTENIDO BLOQUEADO (Para gráficas o secciones enteras)
    renderSecuredSection(htmlContent, permission) {
        if (PermissionService.can(permission)) {
            return htmlContent; // Retorna limpio si tiene permiso
        }
        // Retorna borroso con candado si no tiene permiso
        return `
            <div class="blur-wrapper" data-locked-section="true">
                <div class="lock-overlay">
                    <div style="font-size:2rem; margin-bottom:5px;">🔒</div>
                    <span class="lock-badge">Requiere Plan Pro</span>
                </div>
                <div class="blur-content">
                    ${htmlContent}
                </div>
            </div>
        `;
    },

    // 5. INICIALIZA LOS LISTENERS (Llamar en setupLogic)
    setupListeners(router) {
        this.injectStyles(); // Asegurar estilos

        const modal = document.getElementById('upgrade-modal');
        const closeBtn = document.getElementById('close-upg');

        const openModal = () => { if(modal) modal.style.display = 'flex'; };
        const closeModal = () => { if(modal) modal.style.display = 'none'; };

        if(closeBtn) closeBtn.addEventListener('click', closeModal);
        if(modal) modal.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });

        // Interceptamos TODOS los botones con data-locked="true"
        document.querySelectorAll('[data-locked="true"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openModal();
            });
        });
        
        // Interceptamos secciones bloqueadas (click en el overlay)
        document.querySelectorAll('[data-locked-section="true"] .lock-overlay').forEach(overlay => {
            overlay.addEventListener('click', openModal);
        });

        // Retornamos funciones útiles por si el archivo las necesita
        return { openModal, closeModal };
    }
};