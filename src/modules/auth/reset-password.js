// src/modules/auth/reset-password.js
import { supabase } from '../../data/supabase.js';

export function renderResetPassword() {
    return `
        <div class="login-container">
            <div class="login-card">
                <h1>Nueva Contraseña</h1>
                <p style="text-align:center; color:#666; font-size:0.9rem; margin-bottom:20px;">
                    Escribe tu nueva contraseña para acceder al sistema.
                </p>
                <form id="reset-password-form">
                    <div class="form-group">
                        <label>Nueva Contraseña</label>
                        <input type="password" id="new-password" placeholder="Mínimo 6 caracteres" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label>Confirmar Contraseña</label>
                        <input type="password" id="confirm-password" placeholder="Repite la contraseña" required minlength="6">
                    </div>
                    
                    <button type="submit" class="btn-login" id="btn-reset">Guardar y Entrar</button>
                    <div id="reset-error" class="error-msg" style="display:none; color:red; margin-top:10px; font-size:0.9rem;"></div>
                </form>
            </div>
        </div>
    `;
}

export function setupResetPasswordLogic(router) {
    const form = document.getElementById('reset-password-form');
    const btnReset = document.getElementById('btn-reset');
    const errorMsg = document.getElementById('reset-error');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            errorMsg.textContent = "Las contraseñas no coinciden.";
            errorMsg.style.display = 'block';
            return;
        }

        btnReset.textContent = "Guardando...";
        btnReset.disabled = true;
        errorMsg.style.display = 'none';

        try {
            // Actualizamos la contraseña del usuario autenticado
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            alert("¡Contraseña actualizada con éxito!");
            
            // Redirigir al inicio de sesión o al POS según tu preferencia
            router.navigate('/'); 

        } catch (error) {
            console.error("Error al actualizar:", error);
            errorMsg.textContent = "Hubo un error al guardar la contraseña. Intenta nuevamente.";
            errorMsg.style.display = 'block';
            btnReset.textContent = "Guardar y Entrar";
            btnReset.disabled = false;
        }
    });
}