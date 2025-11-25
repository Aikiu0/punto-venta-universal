// src/services/pwa.js
export const PwaService = {
    deferredPrompt: null,

    init() {
        // 1. Registrar el Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('SW registrado:', reg.scope))
                    .catch(err => console.log('SW error:', err));
            });
        }

        // 2. Capturar el evento de instalación
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevenir que Chrome muestre su barra automática fea
            e.preventDefault();
            // Guardar el evento para usarlo después
            this.deferredPrompt = e;
            
            // Mostrar nuestro botón personalizado (si existe en el DOM)
            this.showInstallButton();
        });
    },

    showInstallButton() {
        const btn = document.getElementById('btn-install-app');
        if (btn) {
            btn.style.display = 'flex'; // Hacerlo visible
            
            btn.addEventListener('click', async () => {
                if (this.deferredPrompt) {
                    this.deferredPrompt.prompt();
                    const { outcome } = await this.deferredPrompt.userChoice;
                    console.log(`Usuario respondió: ${outcome}`);
                    this.deferredPrompt = null;
                    btn.style.display = 'none'; // Ocultar botón tras instalar
                }
            });
        }
    }
};