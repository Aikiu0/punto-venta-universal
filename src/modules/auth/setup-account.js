// src/modules/auth/setup-account.js
// ── Onboarding para clientes que aceptan la invitación de Supabase ──
// Flujo: Admin invita por email → cliente llega aquí → llena negocio + contraseña
// → se crea el registro en 'businesses' y se vincula en 'profiles' automáticamente.
import { supabase } from '../../data/supabase.js';

function generateSlug(name) {
    const base = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 30);
    const suffix = Math.random().toString(36).substring(2, 7);
    return `${base}-${suffix}`;
}

// ── HTML ──────────────────────────────────────────────────────────
export function renderSetupAccount() {
    return `
        <div class="login-container">
            <div class="login-card register-card">

                <div class="register-brand">
                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none"
                        stroke="#7A3F9D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    <span>ArchSell POS</span>
                </div>

                <h1>Configura tu Cuenta</h1>
                <p class="register-subtitle">
                    ¡Bienvenido! Solo faltan unos pasos para dejar listo tu sistema.
                </p>

                <!-- Spinner mientras verificamos sesión -->
                <div id="setup-loading" style="text-align:center;padding:2rem 0;">
                    <div class="setup-spinner"></div>
                    <p style="color:#6b7280;margin-top:12px;font-size:0.9rem;">Verificando tu acceso…</p>
                </div>

                <!-- Formulario (oculto hasta confirmar sesión) -->
                <form id="setup-form" style="display:none;" autocomplete="off" novalidate>

                    <!-- Email de solo lectura -->
                    <div class="form-group">
                        <label>Correo Electrónico</label>
                        <input type="email" id="setup-email" readonly
                            style="background:#f9fafb;color:#6b7280;cursor:default;">
                    </div>

                    <div class="register-section-label" style="margin-top:1.2rem;">
                        <i class="bi bi-person-circle"></i> Tus Datos
                    </div>

                    <div class="form-group">
                        <label for="setup-owner-name">Tu Nombre Completo <span class="required">*</span></label>
                        <input type="text" id="setup-owner-name" placeholder="Ej: Juan Pérez" required>
                    </div>

                    <div class="register-section-label" style="margin-top:1.2rem;">
                        <i class="bi bi-shop"></i> Tu Negocio
                    </div>

                    <div class="form-group">
                        <label for="setup-business-name">Nombre del Negocio <span class="required">*</span></label>
                        <input type="text" id="setup-business-name" placeholder="Ej: Tienda El Sol" required>
                    </div>

                    <div class="register-section-label" style="margin-top:1.2rem;">
                        <i class="bi bi-lock"></i> Crea tu Contraseña
                    </div>

                    <div class="form-group">
                        <label for="setup-password">Contraseña <span class="required">*</span></label>
                        <div class="password-input-wrapper">
                            <input type="password" id="setup-password"
                                placeholder="Mínimo 8 caracteres" required minlength="8"
                                autocomplete="new-password">
                            <button type="button" class="toggle-password" data-target="setup-password"
                                aria-label="Ver contraseña">
                                <i class="bi bi-eye"></i>
                            </button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="setup-confirm">Confirmar Contraseña <span class="required">*</span></label>
                        <div class="password-input-wrapper">
                            <input type="password" id="setup-confirm"
                                placeholder="Repite la contraseña" required minlength="8"
                                autocomplete="new-password">
                            <button type="button" class="toggle-password" data-target="setup-confirm"
                                aria-label="Ver contraseña">
                                <i class="bi bi-eye"></i>
                            </button>
                        </div>
                    </div>

                    <div id="setup-error" class="error-msg" style="display:none;"></div>

                    <button type="submit" class="btn-login" id="btn-setup">
                        Activar mi Sistema
                    </button>

                </form>

                <!-- Pantalla de éxito -->
                <div id="setup-success" class="register-success-box" style="display:none;"></div>

                <!-- Error de acceso si no hay sesión válida -->
                <div id="setup-no-session" style="display:none;text-align:center;padding:1rem 0;">
                    <i class="bi bi-exclamation-triangle-fill"
                        style="font-size:2.5rem;color:#d97706;"></i>
                    <h2 style="color:#111827;margin:0.75rem 0 0.5rem;">
                        Enlace no válido o expirado
                    </h2>
                    <p style="color:#4b5563;font-size:0.9rem;line-height:1.6;">
                        Este enlace de configuración ya no es válido.<br>
                        Solicita un nuevo enlace de invitación.
                    </p>
                    <a href="#/" class="btn-login"
                        style="display:inline-block;margin-top:1.2rem;text-decoration:none;
                               padding:0.7rem 1.5rem;">
                        Volver al inicio
                    </a>
                </div>

            </div>
        </div>
    `;
}

// ── Lógica ────────────────────────────────────────────────────────
export async function setupSetupAccountLogic(router) {
    const loadingEl   = document.getElementById('setup-loading');
    const formEl      = document.getElementById('setup-form');
    const noSessionEl = document.getElementById('setup-no-session');
    const successEl   = document.getElementById('setup-success');
    const errorBox    = document.getElementById('setup-error');
    const btnSetup    = document.getElementById('btn-setup');

    // ── 1. Verificar que hay sesión activa (del invite token) ────
    let currentUser = null;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user ?? null;
    } catch (_) {
        currentUser = null;
    }

    loadingEl.style.display = 'none';

    if (!currentUser) {
        noSessionEl.style.display = 'block';
        return;
    }

    // ── 2. Verificar si ya tiene negocio vinculado (doble click) ─
    try {
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('business_id')
            .eq('id', currentUser.id)
            .single();

        if (existingProfile?.business_id) {
            // Ya está configurado, redirigir al login
            await supabase.auth.signOut();
            router.navigate('/');
            return;
        }
    } catch (_) { /* Si no existe el perfil, continuamos */ }

    // ── 3. Mostrar formulario prellenado ─────────────────────────
    formEl.style.display = 'block';
    const emailInput = document.getElementById('setup-email');
    if (emailInput) emailInput.value = currentUser.email || '';

    // ── Toggle de contraseña ─────────────────────────────────────
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            const icon  = btn.querySelector('i');
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('bi-eye', 'bi-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('bi-eye-slash', 'bi-eye');
            }
        });
    });

    // ── 4. Envío del formulario ───────────────────────────────────
    formEl.addEventListener('submit', async (e) => {
        e.preventDefault();

        const ownerName    = document.getElementById('setup-owner-name').value.trim();
        const businessName = document.getElementById('setup-business-name').value.trim();
        const password     = document.getElementById('setup-password').value;
        const confirm      = document.getElementById('setup-confirm').value;

        // Validaciones
        if (!ownerName || !businessName || !password || !confirm) {
            showError('Por favor completa todos los campos.');
            return;
        }
        if (password.length < 8) {
            showError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }
        if (password !== confirm) {
            showError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        hideError();

        try {
            // ── PASO 1: Establecer contraseña y nombre ────────────
            const { error: updateError } = await supabase.auth.updateUser({
                password,
                data: { full_name: ownerName }
            });
            if (updateError) throw updateError;

            // ── PASO 2: Crear registro del negocio ────────────────
            const slug = generateSlug(businessName);

            const { data: business, error: bizError } = await supabase
                .from('businesses')
                .insert({
                    name:                businessName,
                    slug:                slug,
                    plan:                'esencial',
                    subscription_status: 'trialing',
                    current_period_end:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                })
                .select()
                .single();

            if (bizError) throw bizError;

            // ── PASO 3: Vincular perfil al negocio ────────────────
            // Upsert: por si el trigger ya creó la fila o no
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id:          currentUser.id,
                    email:       currentUser.email,
                    full_name:   ownerName,
                    role:        'admin',
                    business_id: business.id,
                }, { onConflict: 'id' });

            if (profileError) throw profileError;

            // ── PASO 4: Cerrar sesión y mostrar éxito ─────────────
            await supabase.auth.signOut();
            showSuccess(ownerName);

        } catch (err) {
            console.error('Error en setup-account:', err);
            setLoading(false);
            showError(mapError(err));
        }
    });

    // ── Helpers ───────────────────────────────────────────────────
    function setLoading(on) {
        btnSetup.disabled    = on;
        btnSetup.textContent = on ? 'Configurando…' : 'Activar mi Sistema';
    }

    function showError(msg) {
        errorBox.textContent   = msg;
        errorBox.style.display = 'block';
    }

    function hideError() {
        errorBox.style.display = 'none';
    }

    function showSuccess(name) {
        formEl.style.display      = 'none';
        successEl.style.display   = 'block';
        successEl.innerHTML = `
            <div class="register-success-icon">
                <i class="bi bi-check-circle-fill"></i>
            </div>
            <h2>¡Todo listo, ${escapeHtml(name)}!</h2>
            <p>
                Tu negocio ha sido configurado correctamente.<br>
                Ya puedes iniciar sesión con tu correo y contraseña.
            </p>
            <a href="#/" class="btn-login"
                style="display:inline-block;margin-top:1.2rem;text-decoration:none;">
                Ir al inicio de sesión
            </a>
        `;
    }

    function mapError(err) {
        const msg = (err?.message || '').toLowerCase();
        if (msg.includes('new password should be different') || msg.includes('different from the old password')) {
            return 'La contraseña nueva debe ser diferente a la contraseña anterior. Elige otra contraseña.';
        }
        if (msg.includes('password')) return 'Error al guardar la contraseña. Intenta de nuevo.';
        if (msg.includes('duplicate') || msg.includes('unique')) return 'Ya existe un negocio con esos datos.';
        if (msg.includes('jwt') || msg.includes('token') || msg.includes('session')) {
            return 'Tu sesión expiró. Solicita un nuevo enlace de invitación.';
        }
        return 'Ocurrió un error. Por favor intenta de nuevo.';
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
