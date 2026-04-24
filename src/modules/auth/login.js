// src/modules/auth/login.js
// ── VERSIÓN ACTUALIZADA CON MULTISUCURSAL ──
import { supabase } from '../../data/supabase.js';
import { BranchService } from '../../services/branchService.js';

export function renderLogin() {
    return `
        <div class="login-container">
            <div class="login-card">
                <h1>Punto de Venta</h1>
                <form id="login-form">
                    <div class="form-group">
                        <label>Correo Electrónico</label>
                        <input type="email" id="email" placeholder="admin@empresa.com" required>
                    </div>
                    <div class="form-group">
                        <label>Contraseña</label>
                        <input type="password" id="password" placeholder="Contraseña" required>
                    </div>

                    <div style="text-align:right;margin-top:-10px;margin-bottom:15px;">
                        <a href="#" id="forgot-password"
                            style="color:#7A3F9D;font-size:0.85rem;text-decoration:none;font-weight:500;">
                            ¿Olvidaste tu contraseña?
                        </a>
                    </div>

                    <button type="submit" class="btn-login" id="btn-submit">Iniciar Sesión</button>

                    <div style="margin-top:30px;border-top:1px solid #eee;padding-top:20px;">
                        <p style="color:#666;">¿Eres cliente?</p>
                        <a href="#/shop" style="color:#7A3F9D;font-weight:bold;text-decoration:none;">
                            Visitar Tienda en Línea &rarr;
                        </a>
                    </div>

                    <div id="error-message" class="error-msg"></div>
                </form>
            </div>
        </div>
    `;
}

export function setupLoginLogic(router) {
    const form      = document.getElementById('login-form');
    const errorMsg  = document.getElementById('error-message');
    const btnSubmit = document.getElementById('btn-submit');

    // ── Recuperar contraseña ──────────────────────────────────
    const forgotPasswordLink = document.getElementById('forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const emailActual = document.getElementById('email').value.trim();
            const correo = prompt('Ingresa tu correo para enviarte un enlace de recuperación:', emailActual);
            if (!correo) return;

            try {
                const { error } = await supabase.auth.resetPasswordForEmail(correo, {
                    redirectTo: window.location.origin
                });
                if (error) throw error;
                alert('✅ ¡Listo! Revisa tu bandeja de entrada o carpeta de Spam.');
            } catch (err) {
                console.error('Error recuperando contraseña:', err);
                alert('⚠️ Ocurrió un error. Verifica la dirección o intenta más tarde.');
            }
        });
    }

    // ── Login ─────────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        btnSubmit.textContent = 'Verificando...';
        btnSubmit.disabled    = true;
        errorMsg.style.display = 'none';

        const email    = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            // PASO 1: Autenticación
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            const user = data.user;

            // PASO 2: Obtener perfil (rol y business_id)
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role, business_id')
                .eq('id', user.id)
                .single();
            if (profileError) throw profileError;

            // PASO 3: Obtener plan del negocio
            let planNegocio = 'esencial';
            if (profile.business_id) {
                const { data: businessData } = await supabase
                    .from('businesses')
                    .select('plan')
                    .eq('id', profile.business_id)
                    .single();
                if (businessData) planNegocio = businessData.plan;
            }

            // PASO 4: Guardar en localStorage
            localStorage.setItem('archsell_business_id', profile.business_id);
            localStorage.setItem('archsell_role',        profile.role);
            localStorage.setItem('archsell_plan',        planNegocio);

            // ── PASO 5 NUEVO: Inicializar sistema de sucursales ──
            // Detecta si es owner, cajero, etc. y guarda la sucursal activa.
            await BranchService.initFromLogin(user.id, profile.business_id);
            // ─────────────────────────────────────────────────────

            console.log('Login exitoso. Rol:', profile.role, '| Plan:', planNegocio,
                '| Sucursal activa:', BranchService.getActiveBranchName());

            // PASO 6: Redirigir según rol
            if (profile.role === 'admin') {
                router.navigate('/admin');
            } else {
                router.navigate('/pos');
            }

        } catch (error) {
            btnSubmit.textContent  = 'Iniciar Sesión';
            btnSubmit.disabled     = false;

            let mensaje = 'Error: Usuario o contraseña incorrectos.';
            if (error.message?.includes('profile')) {
                mensaje = 'Error crítico: Usuario sin perfil de negocio asignado.';
            }

            errorMsg.textContent   = mensaje;
            errorMsg.style.display = 'block';
            console.error(error);
        }
    });
}