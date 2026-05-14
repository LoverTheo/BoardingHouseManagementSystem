// app.js

document.addEventListener('DOMContentLoaded', () => {

    // ── If already logged in, skip login page ──
    const existing = JSON.parse(localStorage.getItem('currentUser'));
    if (existing) {
        redirect(existing.role);
        return;
    }

    const loginForm  = document.getElementById('loginForm');
    const loginBtn   = document.getElementById('loginBtn');
    const btnSpinner = document.getElementById('btnSpinner');
    const btnText    = document.getElementById('btnText');
    const errorBox   = document.getElementById('loginError');
    const errorMsg   = document.getElementById('loginErrorMsg');

    // ── Password show/hide toggle ──
    const toggleBtn  = document.getElementById('togglePw');
    const toggleIcon = document.getElementById('togglePwIcon');
    const pwInput    = document.getElementById('password');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = pwInput.type === 'password';
            pwInput.type = isHidden ? 'text' : 'password';
            toggleIcon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
        });
    }

    // ── Clear error when user starts typing ──
    document.getElementById('student_id')?.addEventListener('input', hideError);
    pwInput?.addEventListener('input', hideError);

    // ── Login submit ──
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        setLoading(true);

        const student_id = document.getElementById('student_id').value.trim();
        const password   = document.getElementById('password').value;

        try {
            const response = await fetch('https://boardingms.onrender.com/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id, password })
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                redirect(data.user.role);
            } else {
                showError(data.message || "Invalid ID or password.");
                setLoading(false);
            }
        } catch (err) {
            console.error("Login error:", err);
            showError("Could not reach the server. Is it running?");
            setLoading(false);
        }
    });

    // ── Helpers ──
    function setLoading(loading) {
        loginBtn.disabled    = loading;
        btnSpinner.style.display = loading ? 'block' : 'none';
        btnText.textContent  = loading ? 'Signing in…' : 'Sign in';
    }

    function showError(msg) {
        errorMsg.textContent = msg;
        errorBox.classList.add('show');
        // Shake the card slightly
        const card = document.querySelector('.login-card');
        if (card) {
            card.style.animation = 'none';
            card.offsetHeight; // reflow
            card.style.animation = 'shake 0.35s ease';
        }
    }

    function hideError() {
        errorBox.classList.remove('show');
    }

    function redirect(role) {
        window.location.href = role === 'admin' ? 'admin.html' : 'dashboard.html';
    }
});

// ── Shake animation (injected once) ──
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%       { transform: translateX(-6px); }
        40%       { transform: translateX(6px); }
        60%       { transform: translateX(-4px); }
        80%       { transform: translateX(4px); }
    }
`;
document.head.appendChild(style);