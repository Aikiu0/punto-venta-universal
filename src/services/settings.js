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
            // 1. Cargar desde Dexie (rápido, mientras llega la red)
            const local = await db.settings.toArray();
            if (local.length > 0) {
                this.config = local[0];
                this.applyToDOM();
            }
        } catch (e) { console.log("Iniciando configuración..."); }

        // 2. Sincronizar con Supabase usando el negocio del usuario actual
        if (navigator.onLine) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) return;

                // Obtener business_id del perfil del usuario
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('business_id')
                    .eq('id', session.user.id)
                    .single();

                if (!profile?.business_id) return;

                // Leer configuración del negocio del usuario actual
                const { data: business } = await supabase
                    .from('businesses')
                    .select('id, name, logo_url, address, phone, ticket_footer, primary_color')
                    .eq('id', profile.business_id)
                    .single();

                if (business) {
                    this.config = { ...this.config, ...business };
                    await db.settings.clear();
                    await db.settings.add({ ...this.config, id: business.id });
                    this.applyToDOM();
                }
            } catch (e) {
                console.warn("SettingsService: no se pudo sincronizar con Supabase:", e.message);
            }
        }
    },

    applyToDOM() {
        // Actualizar Textos
        document.querySelectorAll('.app-name').forEach(el => el.textContent = this.config.name);
        
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

            // Guardar en Supabase usando el negocio del usuario actual
            const businessId = this.config.id;
            if (businessId) {
                await supabase.from('businesses').update(updates).eq('id', businessId);
            }

            // Guardar en Local
            this.config = { ...this.config, ...updates };
            await db.settings.clear();
            await db.settings.add({ ...this.config, id: this.config.id ?? 1 });
            
            this.applyToDOM();
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
};