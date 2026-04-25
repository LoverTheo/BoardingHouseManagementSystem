// Inside dashboard.js -> DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) { window.location.href = 'index.html'; return; }

    // Fill UI Info
    document.getElementById('userName').textContent = user.name;
    document.getElementById('studentId').textContent = user.student_id;
    document.getElementById('nickname').textContent = user.profile?.nickname || "N/A";

    // ✅ FIXED: Pointing to the new structure
    document.getElementById('roomNum').textContent = user.room_no; 
    document.getElementById('floorNum').textContent = user.room_info ? user.room_info.floor : "N/A";

    const tableBody = document.getElementById('billTableBody');
    tableBody.innerHTML = '';

    // ✅ FIXED: Ensure bills array exists before looping
    const bills = user.bills || [];

    bills.forEach(bill => {
        // --- 1. FIX THE DATE (PH Timezone) ---
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000; 
        const todayStr = new Date(now - offset).toISOString().split('T')[0];
        
        // Create actual Date objects for a mathematical comparison
        const billDate = new Date(bill.due_date);
        const todayDate = new Date(todayStr);

        let displayStatus = bill.status;
        let statusClass = '';

        // --- 2. IMPROVED 4-WAY STATUS LOGIC ---
        if (bill.status === 'paid') {
            statusClass = 'status-paid';
        } 
        else if (bill.status === 'pending') {
            statusClass = 'status-pending';
        } 
        // Compare using Date objects instead of just strings
        else if (bill.due_date && billDate < todayDate) {
            displayStatus = 'overdue';
            statusClass = 'status-overdue';
        } 
        else {
            statusClass = 'status-unpaid';
        }

        // --- 3. BUTTON LOGIC ---
        // We use displayStatus here so 'overdue' bills still show the button
        let payButton = "";
        if (displayStatus === 'unpaid' || displayStatus === 'overdue') {
            payButton = `<button class="btn btn-sm btn-primary" onclick="requestPayment('${bill.bill_id}')">Pay Now</button>`;
        } else if (displayStatus === 'pending') {
            payButton = `<span class="text-muted small">Processing...</span>`;
        } else {
            payButton = `<span class="text-success fw-bold">✔ Paid</span>`;
        }

        // --- 4. RENDER ROW ---
        const row = `
            <tr class="align-middle">
                <td><strong>${bill.category}</strong></td>
                <td>${bill.due_date}</td> 
                <td>₱${bill.amount.toLocaleString()}</td>
                <td>
                    <span class="badge ${statusClass}">${displayStatus.toUpperCase()}</span>
                </td>
                <td>${payButton}</td> 
            </tr>
        `;
        tableBody.innerHTML += row;
    });
});

// ==========================================
// MISSING FUNCTION 1: Handle Payment Request
// ==========================================
async function requestPayment(billId) {
    const user = JSON.parse(localStorage.getItem('currentUser'));

    // Ask for confirmation
    if (!confirm("Mark this bill as PENDING for admin review?")) return;

    try {
        // Send request to your server
        const response = await fetch('http://localhost:5000/api/student/request-pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                student_id: user.student_id, 
                bill_id: billId 
            })
        });

        const result = await response.json();

        if (result.success) {
            // Update the local storage so the change is visible instantly
            const billIndex = user.bills.findIndex(b => b.bill_id === billId);
            if (billIndex !== -1) {
                user.bills[billIndex].status = 'pending';
                localStorage.setItem('currentUser', JSON.stringify(user));
            }
            
            // Reload the page to show the Yellow "PENDING" badge
            location.reload(); 
        } else {
            alert("Failed to update status on server.");
        }
    } catch (err) {
        console.error("Payment Request Error:", err);
        alert("Server Error: Check if your backend is running.");
    }
}

// ==========================================
// MISSING FUNCTION 2: Handle Logout
// ==========================================
function logout() {
    if (confirm("Are you sure you want to log out?")) {
        localStorage.removeItem('currentUser'); // Clear the session data
        window.location.href = 'index.html';    // Kick back to login screen
    }
}