// ── Auth Guard ──
const user = JSON.parse(localStorage.getItem('currentUser'));

if (!user || user.role !== 'admin') {
    window.location.href = 'index.html';
} else {
    document.addEventListener('DOMContentLoaded', () => {
        // Set admin name
        const nameEl = document.getElementById('adminName');
        if (nameEl) nameEl.textContent = user.name || 'Admin';

        // Set current date
        const dateEl = document.getElementById('currentDate');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('en-PH', {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
            });
        }

        loadDashboardData();
    });
}

function logout() {
    if (confirm("Are you sure you want to log out?")) {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

// ── Chart instances ──
let paymentChart, studentChart;

// ── Main loader ──
async function loadDashboardData() {
    try {
        const response = await fetch('http://localhost:5000/api/admin/dashboard-stats');
        const data = await response.json();

        if (!data.success) {
            console.error("Failed to fetch dashboard stats");
            return;
        }

        // Parse revenueByStatus
        let paidAmt = 0, pendingAmt = 0, unpaidAmt = 0, overdueAmt = 0;
        let paidCount = 0, pendingCount = 0, unpaidCount = 0, overdueCount = 0;

        data.revenueByStatus.forEach(stat => {
            switch (stat._id) {
                case 'paid':
                    paidAmt = stat.totalAmount;
                    paidCount = stat.billCount;
                    break;
                case 'pending':
                    pendingAmt = stat.totalAmount;
                    pendingCount = stat.billCount;
                    break;
                case 'unpaid':
                    unpaidAmt = stat.totalAmount;
                    unpaidCount = stat.billCount;
                    break;
                case 'overdue':
                    overdueAmt = stat.totalAmount;
                    overdueCount = stat.billCount;
                    break;
            }
        });

        // Parse categoryStats
        let rentTotal = 0, elecTotal = 0;
        data.categoryStats.forEach(stat => {
            if (stat._id === 'Rent') rentTotal = stat.total;
            if (stat._id === 'Electricity') elecTotal = stat.total;
        });

        // Parse studentStats
        let activeStudents = 0, archivedStudents = 0;
        data.studentStats.forEach(stat => {
            if (stat._id === 'Active') activeStudents = stat.count;
            if (stat._id === 'Archived') archivedStudents = stat.count;
        });

        // ── Update stat cards ──
        setText('totalCollected', `₱${paidAmt.toLocaleString()}`);
        setText('totalOverdue',   `₱${overdueAmt.toLocaleString()}`);
        setText('totalPending',   pendingCount);
        setText('totalStudents',  activeStudents);

        // ── Update bill status list ──
        setText('sl-paid',           `₱${paidAmt.toLocaleString()}`);
        setText('sl-paid-count',     paidCount);
        setText('sl-pending',        `₱${pendingAmt.toLocaleString()}`);
        setText('sl-pending-count',  pendingCount);
        setText('sl-unpaid',         `₱${unpaidAmt.toLocaleString()}`);
        setText('sl-unpaid-count',   unpaidCount);
        setText('sl-overdue',        `₱${overdueAmt.toLocaleString()}`);
        setText('sl-overdue-count',  overdueCount);

        // ── Category progress bars ──
        const totalCategory = rentTotal + elecTotal || 1;
        setText('rentTotal', `₱${rentTotal.toLocaleString()}`);
        setText('elecTotal', `₱${elecTotal.toLocaleString()}`);
        setWidth('rentBar', (rentTotal / totalCategory * 100).toFixed(1));
        setWidth('elecBar', (elecTotal / totalCategory * 100).toFixed(1));

        // ── Charts ──
        renderPaymentChart(paidAmt, pendingAmt, unpaidAmt, overdueAmt);
        renderStudentChart(activeStudents, archivedStudents);

    } catch (error) {
        console.error("Dashboard load error:", error);
    }
}

// ── Payment Bar Chart ──
function renderPaymentChart(paid, pending, unpaid, overdue) {
    const ctx = document.getElementById('paymentChart')?.getContext('2d');
    if (!ctx) return;
    if (paymentChart) paymentChart.destroy();

    paymentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Collected', 'Pending', 'Unpaid', 'Overdue'],
            datasets: [{
                label: 'Amount (₱)',
                data: [paid, pending, unpaid, overdue],
                backgroundColor: ['#dcfce7', '#fef9c3', '#f3f4f6', '#fee2e2'],
                borderColor:     ['#16a34a', '#ca8a04', '#6b7280', '#dc2626'],
                borderWidth: 1.5,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ₱${ctx.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f3f4f6' },
                    ticks: {
                        font: { family: 'DM Mono', size: 11 },
                        color: '#9ca3af',
                        callback: val => `₱${val.toLocaleString()}`
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'DM Sans', size: 12 }, color: '#374151' }
                }
            }
        }
    });
}

// ── Student Doughnut Chart ──
function renderStudentChart(active, archived) {
    const ctx = document.getElementById('studentChart')?.getContext('2d');
    if (!ctx) return;
    if (studentChart) studentChart.destroy();

    studentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Archived'],
            datasets: [{
                data: [active, archived],
                backgroundColor: ['#dbeafe', '#f3f4f6'],
                borderColor:     ['#2563eb', '#9ca3af'],
                borderWidth: 1.5,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: 'DM Sans', size: 12 },
                        color: '#374151',
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 8
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.parsed} students`
                    }
                }
            }
        }
    });
}

function downloadBackup() {
    // The browser just follows this link — the server sends back the file
    window.location.href = 'http://localhost:5000/api/admin/backup';
}

function exportCSV(type) {
    window.location.href = `http://localhost:5000/api/admin/export-csv?type=${type}`;
}

// ── Helpers ──
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setWidth(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = `${pct}%`;
}