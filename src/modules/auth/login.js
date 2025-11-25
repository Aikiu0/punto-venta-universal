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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Feedback visual
        btnSubmit.textContent = "Verificando...";
        btnSubmit.disabled = true;
        errorMsg.style.display = 'none';

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            // 2. Autenticación Auth
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            // 3. Obtener ROL y BUSINESS_ID (CRÍTICO PARA SAAS)
            const user = data.user;
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role, business_id') // <--- AQUÍ PEDIMOS EL ID DEL NEGOCIO
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;

            // 4. Guardar credenciales en el navegador
            localStorage.setItem('archsell_business_id', profile.business_id);
            localStorage.setItem('archsell_role', profile.role);

            console.log("Login exitoso. Negocio ID:", profile.business_id);
            
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
            if (error.message.includes("profile")) mensaje = "Error crítico: Usuario sin perfil de negocio asignado.";
            
            errorMsg.textContent = mensaje;
            errorMsg.style.display = 'block';
            console.error(error);
        }
    });
}