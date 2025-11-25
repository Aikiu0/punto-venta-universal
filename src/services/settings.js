import { supabase } from '../data/supabase.js';
import { db } from '../data/db-local.js'; 

export const SettingsService = {
    // Configuración por defecto
    config: {
        store_name: 'Mi Negocio',
        logo_url: '',
        address: '',
        phone: '',
        primary_color: '#7A3F9D'
    },

    async init() {
        try {
            // 1. Cargar desde Dexie (rápido)
            const local = await db.settings.toArray();
            if (local.length > 0) {
                this.config = local[0];
                this.applyToDOM();
            }
        } catch (e) { console.log("Iniciando configuración..."); }

        // 2. Sincronizar con Supabase si hay internet
        if (navigator.onLine) {
            const { data } = await supabase.from('store_settings').select('*').single();
            if (data) {
                this.config = data;
                await db.settings.clear();
                await db.settings.add(data);
                this.applyToDOM();
            }
        }
    },

    applyToDOM() {
        // Actualizar Textos
        document.querySelectorAll('.app-name').forEach(el => el.textContent = this.config.store_name);
        
        // Actualizar Logos
        document.querySelectorAll('.app-logo-img').forEach(img => {
            if (this.config.logo_url) {
                img.src = this.config.logo_url;
                img.style.display = 'block';
            } else {
                img.style.display = 'none';
            }
        });

        // Actualizar Color
        if(this.config.primary_color) {
            document.documentElement.style.setProperty('--brand-color', this.config.primary_color);
        }
    },

    get() { return this.config; },

    async update(newSettings, file = null) {
        try {
            let logoUrl = this.config.logo_url;

            // Subir imagen si existe
            if (file) {
                const fileName = `logo-${Date.now()}`;
                const { error } = await supabase.storage.from('logos').upload(fileName, file);
                if (!error) {
                    const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
                    logoUrl = data.publicUrl;
                }
            }

            const updates = { ...newSettings, logo_url: logoUrl };
            
            // Guardar en Supabase
            const { error } = await supabase.from('store_settings').update(updates).eq('id', 1);
            
            // Si falla, intentamos crear la fila
            if (error) await supabase.from('store_settings').insert([{ ...updates, id: 1 }]);

            // Guardar en Local
            this.config = { ...this.config, ...updates };
            await db.settings.clear();
            await db.settings.add(this.config);
            
            this.applyToDOM();
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
};