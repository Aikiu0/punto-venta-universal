import { supabase } from '../../data/supabase';

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
                    
                    <div style="text-align: right; margin-top: -10px; margin-bottom: 15px;">
                        <a href="#" id="forgot-password" style="color:#7A3F9D; font-size: 0.85rem; text-decoration:none; font-weight: 500;">¿Olvidaste tu contraseña?</a>
                    </div>

                    <button type="submit" class="btn-login" id="btn-submit">Iniciar Sesión</button>
                    <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                    <p style="color:#666;">¿Eres cliente?</p>
                    <a href="#/shop" style="color:#7A3F9D; font-weight:bold; text-decoration:none;">Visitar Tienda en Línea &rarr;</a>
                    </div>
                    <div id="error-message" class="error-msg"></div>
                </form>
            </div>
        </div>
    `;
}

export function setupLoginLogic(router) {
    const form = document.getElementById('login-form');
    const errorMsg = document.getElementById('error-message');
    const btnSubmit = document.getElementById('btn-submit');

    const forgotPasswordLink = document.getElementById('forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Tomamos el correo si ya lo escribió, si no, lo dejamos en blanco
            const emailActual = document.getElementById('email').value.trim();
            const correoRecuperacion = prompt("Ingresa tu correo electrónico para enviarte un enlace de recuperación:", emailActual);
            
            // Si el usuario canceló el prompt o lo dejó vacío, no hacemos nada
            if (!correoRecuperacion) return;

            try {
                // Llamada directa a Supabase
                const { error } = await supabase.auth.resetPasswordForEmail(correoRecuperacion, {
                    redirectTo: window.location.origin // Lo devuelve a la raíz de tu app
                });

                if (error) throw error;

                alert(" ¡Listo! Te hemos enviado un enlace de recuperación. Por favor revisa tu bandeja de entrada o la carpeta de Spam.");
            } catch (err) {
                console.error("Error recuperando contraseña:", err);
                alert(" Ocurrió un error al intentar enviar el correo. Verifica que la dirección sea correcta o intenta más tarde.");
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Feedback visual
        btnSubmit.textContent = "Verificando...";
        btnSubmit.disabled = true;
        errorMsg.style.display = 'none';

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            // --- PASO 1: AUTENTICACIÓN ---
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;
            const user = data.user;

            // --- PASO 2: OBTENER PERFIL (ROL Y ID NEGOCIO) ---
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role, business_id') 
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;

            // --- PASO 3: OBTENER PLAN DEL NEGOCIO (CONSULTA DIRECTA) ---
            // Esto es más seguro que el join automático
            let planNegocio = 'esencial'; // Valor por defecto

            if (profile.business_id) {
                const { data: businessData, error: businessError } = await supabase
                    .from('businesses')
                    .select('plan')
                    .eq('id', profile.business_id)
                    .single();
                
                if (!businessError && businessData) {
                    planNegocio = businessData.plan;
                }
            }

            // 4. Guardar credenciales en el navegador
            localStorage.setItem('archsell_business_id', profile.business_id);
            localStorage.setItem('archsell_role', profile.role);
            localStorage.setItem('archsell_plan', planNegocio); // <--- AQUÍ GUARDAMOS EL PLAN REAL

            console.log("Login exitoso. Rol:", profile.role, "Plan:", planNegocio);
            
            // 5. Redirigir
            if (profile.role === 'admin') {
                router.navigate('/admin');
            } else {
                router.navigate('/pos');
            }

        } catch (error) {
            btnSubmit.textContent = "Iniciar Sesión";
            btnSubmit.disabled = false;
            
            let mensaje = "Error: Usuario o contraseña incorrectos.";
            if (error.message && error.message.includes("profile")) mensaje = "Error crítico: Usuario sin perfil de negocio asignado.";
            
            errorMsg.textContent = mensaje;
            errorMsg.style.display = 'block';
            console.error(error);
        }
    });
}