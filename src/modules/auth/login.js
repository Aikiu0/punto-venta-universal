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
        
        // 1. Feedback visual (Cargando...)
        btnSubmit.textContent = "Verificando...";
        btnSubmit.disabled = true;
        errorMsg.style.display = 'none';

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            // 2. Preguntar a Supabase
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            // 3. Si login es correcto, obtener el ROL de la tabla profiles
            const user = data.user;
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;

            // 4. Redirigir según el rol
            console.log("Login exitoso. Rol:", profile.role);
            
            if (profile.role === 'admin') {
                router.navigate('/admin');
            } else {
                router.navigate('/pos');
            }

        } catch (error) {
            // Manejo de errores
            btnSubmit.textContent = "Iniciar Sesión";
            btnSubmit.disabled = false;
            errorMsg.textContent = "Error: Usuario o contraseña incorrectos.";
            errorMsg.style.display = 'block';
            console.error(error);
        }
    });
}