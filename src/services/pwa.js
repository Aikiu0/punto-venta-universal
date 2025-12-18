// src/services/pwa.js
export const PwaService = {
    deferredPrompt: null,
    updateAvailable: false,
    waitingWorker: null,

    init() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(reg => {
                if (reg.waiting) {
                    this.setUpdateAvailable(reg.waiting);
                }

                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.setUpdateAvailable(newWorker);
                        }
                    });
                });
            });

            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        }

        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });
    },

    setUpdateAvailable(worker) {
        this.updateAvailable = true;
        this.waitingWorker = worker;
        window.dispatchEvent(new Event('pwa-update-available'));
    },

    applyUpdate() {
        if (this.waitingWorker) {
            this.waitingWorker.postMessage('SKIP_WAITING');
        }
    },

    showInstallButton() {
        const btn = document.getElementById('btn-install-app');
        if (!btn) return;

        btn.style.display = 'flex';
        btn.onclick = async () => {
            if (!this.deferredPrompt) return;
            this.deferredPrompt.prompt();
            await this.deferredPrompt.userChoice;
            this.deferredPrompt = null;
            btn.style.display = 'none';
        };
    }
};
