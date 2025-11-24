// src/services/theme.js
import { supabase } from '../data/supabase.js';

export const themeService = {
    async init() {
        try {
            // 1. Tema Oscuro Local
            const savedTheme = localStorage.getItem('app_theme');
            if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

            // 2. Colores desde la Nube
            const { data } = await supabase.from('business_settings').select('*').single();
            if (data && data.primary_color) {
                document.documentElement.style.setProperty('--primary', data.primary_color);
                
                // Intentar cambiar logos si existen
                setTimeout(() => {
                    document.querySelectorAll('.sidebar-logo, .brand-logo').forEach(el => {
                        el.textContent = data.business_name || 'Mi Negocio';
                    });
                }, 500); // Pequeño retraso para asegurar que el DOM cargó
            }
        } catch (e) {
            console.error("Error cargando tema:", e);
        }
    },

    toggleDarkMode() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('app_theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('app_theme', 'dark');
        }
    }
};