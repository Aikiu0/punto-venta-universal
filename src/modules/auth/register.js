// src/modules/auth/register.js
// ── Paso 1: el cliente ingresa su correo y recibe el enlace de acceso ──
// Esta ruta es pública pero NO está enlazada desde el login.
// El link se entrega al cliente después de confirmar su pago.
import { supabase } from '../../data/supabase.js';

// ── HTML ──────────────────────────────────────────────────────────
export function renderRegister() {
    return `
        <div class="login-container">
            <div class="login-card">

                <div class="register-brand">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                        stroke="#7A3F9D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    <span>ArchSell POS</span>
                </div>

                <h1>Activar mi Cuenta</h1>
                <p class="register-subtitle">
                    Ingresa tu correo y te enviaremos un enlace<br>
                    para configurar tu sistema.
                </p>

                <form id="register-form" novalidate>
                    <div class="form-group">
                        <label for="reg-email">Correo Electrónico</label>
                        <input type="email" id="reg-email"
                            placeholder="correo@negocio.com" required autocomplete="email">
                    </div>

                    <div id="reg-error" class="error-msg" style="display:none;"></div>

                    <button type="submit" class="btn-login" id="btn-register">
                        Enviar enlace de acceso
                    </button>
                </form>

                <div id="reg-success" class="register-success-box" style="display:none;"></div>

                <div class="register-footer-link">
                    <a href="#/">← Volver al inicio de sesión</a>
                </div>

            </div>
        </div>
    `;
}

// ── Lógica ────────────────────────────────────────────────────────
export function setupRegisterLogic() {
    const form     = document.getElementById('register-form');
    const errorBox = document.getElementById('reg-error');
    const success  = document.getElementById('reg-success');
    const btn      = document.getElementById('btn-register');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('reg-email').value.trim().toLowerCase();

        if (!email) {
            showError('Por favor ingresa tu correo.');
            return;
        }

        setLoading(true);
        hideError();

        try {
            // ── Verificar si el correo ya está registrado y configurado ──
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('id, business_id')
                .eq('email', email)
                .maybeSingle();

            if (existingProfile?.business_id) {
                setLoading(false);
                showAlreadyRegistered(email);
                return;
            }

            // Envía un magic link que crea al usuario si no existe.
            // Al hacer clic, el token llega como type=magiclink en el hash
            // y main.js lo redirige a /setup-account.
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo: window.location.origin,
                },
            });

            if (error) throw error;

            form.style.display    = 'none';
            success.style.display = 'block';
            showSentScreen(email);

        } catch (err) {
            console.error('Error enviando enlace:', err);
            setLoading(false);
            showError(mapError(err));
        }
    });

    function showAlreadyRegistered(email) {
        form.style.display    = 'none';
        success.style.display = 'block';
        success.innerHTML = `
            <div class="register-success-icon" style="color:#d97706;">
                <i class="bi bi-exclamation-circle-fill"></i>
            </div>
            <h2 style="color:#111827;">Correo ya registrado</h2>
            <p style="color:#4b5563;">
                El correo <strong>${escapeHtml(email)}</strong><br>
                ya tiene una cuenta activa en el sistema.
            </p>
            <a href="#/" class="btn-login"
                style="display:inline-block;margin-top:1.2rem;text-decoration:none;
                       padding:0.75rem 1.5rem;text-align:center;">
                Iniciar sesión
            </a>
            <div style="margin-top:0.75rem;">
                <button type="button" class="btn-link-style"
                    style="background:none;border:none;color:#7A3F9D;font-size:0.85rem;cursor:pointer;text-decoration:underline;"
                    id="btn-use-other-email">
                    ← Usar otro correo
                </button>
            </div>
        `;
        document.getElementById('btn-use-other-email').addEventListener('click', () => {
            success.style.display = 'none';
            form.style.display    = 'block';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-email').focus();
        });
    }

    function showSentScreen(email) {
        success.innerHTML = `
            <div class="register-success-icon">
                <i class="bi bi-envelope-check-fill"></i>
            </div>
            <h2>¡Revisa tu correo!</h2>
            <p>
                Te enviamos un enlace a<br>
                <strong>${escapeHtml(email)}</strong><br><br>
                Haz clic en él para continuar con la configuración de tu cuenta.
            </p>
            <p style="font-size:0.8rem;color:#9ca3af;margin-top:0.75rem;">
                ¿No lo encuentras? Revisa tu carpeta de Spam.
            </p>
            <button id="btn-resend" class="btn-resend" disabled>
                Reenviar enlace <span id="resend-countdown">(60s)</span>
            </button>
        `;

        // Contador de 60 s antes de permitir reenvío
        let seconds = 60;
        const countdown = document.getElementById('resend-countdown');
        const btnResend  = document.getElementById('btn-resend');

        const timer = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                clearInterval(timer);
                btnResend.disabled       = false;
                countdown.textContent    = '';
                btnResend.textContent    = 'Reenviar enlace';
            } else {
                countdown.textContent = `(${seconds}s)`;
            }
        }, 1000);

        btnResend.addEventListener('click', async () => {
            btnResend.disabled    = true;
            btnResend.textContent = 'Enviando…';

            try {
                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        shouldCreateUser: true,
                        emailRedirectTo: window.location.origin,
                    },
                });

                if (error) throw error;

                btnResend.textContent = '¡Enviado!';
                // Reinicia el contador
                seconds = 60;
                countdown.textContent = `(${seconds}s)`;
                const retimer = setInterval(() => {
                    seconds--;
                    if (seconds <= 0) {
                        clearInterval(retimer);
                        btnResend.disabled    = false;
                        countdown.textContent = '';
                        btnResend.textContent = 'Reenviar enlace';
                    } else {
                        countdown.textContent = `(${seconds}s)`;
                    }
                }, 1000);

            } catch (err) {
                btnResend.textContent = 'Reenviar enlace';
                btnResend.disabled    = false;
                const msg = (err?.message || '').toLowerCase();
                if (msg.includes('rate limit') || msg.includes('too many')) {
                    alert('Demasiados intentos. Espera unos minutos.');
                } else {
                    alert('Error al reenviar. Intenta de nuevo.');
                }
            }
        });
    }

    function setLoading(on) {
        btn.disabled    = on;
        btn.textContent = on ? 'Enviando…' : 'Enviar enlace de acceso';
    }

    function showError(msg) {
        errorBox.textContent   = msg;
        errorBox.style.display = 'block';
    }

    function hideError() {
        errorBox.style.display = 'none';
    }

    function mapError(err) {
        const msg = (err?.message || '').toLowerCase();
        if (msg.includes('invalid email') || msg.includes('unable to validate')) {
            return 'El correo electrónico no es válido.';
        }
        if (msg.includes('rate limit') || msg.includes('too many')) {
            return 'Supabase limita el envío de correos. Espera unos minutos e intenta de nuevo, o contacta al administrador.';
        }
        return 'Ocurrió un error al enviar el enlace. Intenta nuevamente.';
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

