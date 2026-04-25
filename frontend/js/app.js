// This runs when the user clicks "Login"
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('form'); // Finds your <form> tag

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevents the page from refreshing

        const student_id = document.querySelector('input[name="student_id"]').value;
        const password = document.querySelector('input[name="password"]').value;

        try {
            const response = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id, password })
            });

            const data = await response.json();

            if (data.success) {
                // 💾 Save user data
                localStorage.setItem('currentUser', JSON.stringify(data.user));

                // 🚦 ROLE-BASED ROUTING
                if (data.user.role === 'admin') {
                    window.location.href = 'admin.html'; // Path for the Landlord
                } else {
                    window.location.href = 'dashboard.html'; // Path for Students
                }
            } else {
                alert("❌ " + data.message);
            }
        } catch (error) {
            console.error("Error:", error);
            alert("⚠️ Could not connect to the server. Is it running?");
        }
    });
});