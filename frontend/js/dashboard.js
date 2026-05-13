// dashboard.js

// ── Auth guard ──
const user = JSON.parse(localStorage.getItem('currentUser'));
if (!user) { window.location.href = 'index.html'; }

// ── PH time helper ──
function getToday() {
    const now = new Date();
    return new Date(now - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

// ── Effective status ──
function effectiveStatus(bill) {
    if (bill.status === 'paid' || bill.status === 'pending') return bill.status;
    if (bill.due_date && bill.due_date < getToday()) return 'overdue';
    return 'unpaid';
}

// ── State ──
let allBills    = [];
let filtered    = [];
let sortField   = 'due_date';
let sortAsc     = true;       // true = oldest first, false = newest first
let currentPage = 1;
const perPage   = 10;

// ── 1. Init ──
document.addEventListener('DOMContentLoaded', () => {
    setText('topbarName', user.name || 'Student');
    setText('userName',   user.name?.split(' ')[0] || 'Student');
    setText('studentId',  user.student_id || '—');
    setText('nickname',   user.profile?.nickname || '—');
    setText('roomNum',    user.room_no || '—');
    setText('floorNum',   user.room_info?.floor || '—');
    setText('roomType',   user.room_info?.type  || '—');
    setText('courseYear', buildCourseYear(user.profile));

    const avatarEl = document.getElementById('avatarInitial');
    if (avatarEl) avatarEl.textContent = (user.name || 'S')[0].toUpperCase();

    // Close filter panel on outside click
    document.addEventListener('click', e => {
        const dropdown = document.getElementById('filterDropdown');
        if (dropdown && !dropdown.contains(e.target)) closeFilterPanel();
    });

    fetchBills();
});

function buildCourseYear(profile) {
    if (!profile) return '—';
    const parts = [];
    if (profile.course) parts.push(profile.course);
    if (profile.year_level) parts.push(`Year ${profile.year_level}`);
    return parts.length ? parts.join(' · ') : '—';
}

// ── 2. Fetch bills ──
async function fetchBills() {
    try {
        const res   = await fetch(`http://10.198.104.172:5000/api/student/get-bills/${user.student_id}`);
        const bills = await res.json();
        allBills = (bills || []).map(b => ({ ...b, _status: effectiveStatus(b) }));
        updateStats();
        applyFilter();
    } catch (err) {
        console.error("Error fetching bills:", err);
        document.getElementById('billTableBody').innerHTML = `
            <tr><td colspan="6" class="text-center py-4 text-muted">
                <i class="fas fa-circle-exclamation me-2"></i>Could not load bills. Is the server running?
            </td></tr>`;
    }
}

// ── 3. Stats (always from allBills, not filtered) ──
function updateStats() {
    let outstanding = 0, pending = 0, paid = 0;
    allBills.forEach(b => {
        const amt = parseFloat(b.amount) || 0;
        if (b._status === 'unpaid' || b._status === 'overdue') outstanding += amt;
        if (b._status === 'pending') pending++;
        if (b._status === 'paid')    paid++;
    });
    setText('statTotal',       allBills.length);
    setText('statOutstanding', `₱${outstanding.toLocaleString()}`);
    setText('statPending',     pending);
    setText('statPaid',        paid);
}

// ── 4. Filter panel toggle ──
function toggleFilterPanel() {
    const panel = document.getElementById('filterPanel');
    const btn   = document.getElementById('filterBtn');
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
        panel.classList.remove('open');
        btn.classList.remove('active');
    } else {
        panel.classList.add('open');
        btn.classList.add('active');
    }
}

function closeFilterPanel() {
    document.getElementById('filterPanel')?.classList.remove('open');
    document.getElementById('filterBtn')?.classList.remove('active');
}

function selectAll() {
    ['chk-overdue', 'chk-unpaid', 'chk-pending', 'chk-paid'].forEach(id => {
        document.getElementById(id).checked = true;
    });
    applyFilter();
}

function selectNone() {
    ['chk-overdue', 'chk-unpaid', 'chk-pending', 'chk-paid'].forEach(id => {
        document.getElementById(id).checked = false;
    });
    applyFilter();
}

// ── 5. Apply checkbox filter ──
function applyFilter() {
    const active = [];
    if (document.getElementById('chk-overdue')?.checked) active.push('overdue');
    if (document.getElementById('chk-unpaid')?.checked)  active.push('unpaid');
    if (document.getElementById('chk-pending')?.checked) active.push('pending');
    if (document.getElementById('chk-paid')?.checked)    active.push('paid');

    // Update badge count
    const countEl = document.getElementById('filterCount');
    if (countEl) countEl.textContent = active.length;

    filtered = active.length === 0
        ? []
        : allBills.filter(b => active.includes(b._status));

    currentPage = 1;
    sortAndRender();
    closeFilterPanel();
}

// ── 6. Sort ──
function sortBills(field) {
    if (sortField === field) {
        sortAsc = !sortAsc;
    } else {
        sortField = field;
        sortAsc   = true;
    }
    currentPage = 1;
    sortAndRender();
}

function sortAndRender() {
    filtered.sort((a, b) => {
        let va = a[sortField] ?? '';
        let vb = b[sortField] ?? '';
        if (sortField === 'amount') { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
        if (va < vb) return sortAsc ? -1 : 1;
        if (va > vb) return sortAsc ?  1 : -1;
        return 0;
    });

    updateSortIcons();
    renderBills();
    renderPagination();
}

function updateSortIcons() {
    ['due_date', 'amount'].forEach(field => {
        const el = document.getElementById(`sort-${field}`);
        if (!el) return;
        el.className = 'fas fa-sort text-muted ms-1';
        el.style.fontSize = '10px';
    });
    const active = document.getElementById(`sort-${sortField}`);
    if (active) {
        active.className = `fas ${sortAsc ? 'fa-sort-up' : 'fa-sort-down'} ms-1`;
        active.style.fontSize = '10px';
        active.classList.remove('text-muted');
    }
}

// ── 7. Render current page ──
function renderBills() {
    const body  = document.getElementById('billTableBody');
    const footer = document.getElementById('billFooter');

    if (!filtered || filtered.length === 0) {
        body.innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <div style="font-size:15px; font-weight:500; color:#374151; margin-bottom:4px;">No bills found</div>
                    <div style="font-size:13px;">Try adjusting your filter.</div>
                </div>
            </td></tr>`;
        if (footer) footer.textContent = '0 bills';
        return;
    }

    const start = (currentPage - 1) * perPage;
    const slice = filtered.slice(start, start + perPage);
    const total = filtered.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);

    body.innerHTML = slice.map(bill => {
        const amt    = parseFloat(bill.amount) || 0;
        const status = bill._status;
        const isOverdue = status === 'overdue';

        const badgeClass = status === 'paid'    ? 'status-paid'
                         : status === 'pending' ? 'status-pending'
                         : status === 'overdue' ? 'status-overdue'
                         : 'status-unpaid';

        let action = '';
        if (status === 'unpaid' || status === 'overdue') {
            action = `<button class="btn btn-sm btn-primary" onclick="requestPayment('${bill.bill_id}')">
                <i class="fas fa-paper-plane me-1"></i>Pay Now
            </button>`;
        } else if (status === 'pending') {
            action = `<span style="font-size:12px; color:#ca8a04;"><i class="fas fa-clock me-1"></i>Awaiting admin</span>`;
        } else {
            action = `<span style="font-size:12px; color:#16a34a;"><i class="fas fa-check me-1"></i>Settled</span>`;
        }

        return `
        <tr class="align-middle">           
            <td>
                <span style="font-family:'DM Mono',monospace; font-size:13px; ${isOverdue ? 'color:#dc2626;' : 'color:#374151;'}">
                    ${bill.due_date || '—'}
                </span>
                ${isOverdue ? `<div class="overdue-pulse" style="font-size:10px; color:#dc2626; font-weight:500; margin-top:1px;">PAST DUE</div>` : ''}
            </td>
            <td><span class="amount" style="font-size:14px; font-weight:600;">₱${amt.toLocaleString()}</span></td>
            <td><span class="badge ${badgeClass}">${status.toUpperCase()}</span></td>
            <td>${action}</td>
        </tr>`;
    }).join('');

    if (footer) {
        const from = start + 1;
        const to   = Math.min(start + perPage, filtered.length);
        footer.textContent = `Showing ${from}–${to} of ${filtered.length} bill${filtered.length !== 1 ? 's' : ''} · Total: ₱${total.toLocaleString()}`;
    }
}

// ── 8. Pagination ──
function renderPagination() {
    const nav        = document.getElementById('billPagination');
    const totalPages = Math.ceil(filtered.length / perPage);
    if (!nav) return;
    nav.innerHTML = '';
    if (totalPages <= 1) return;

    nav.innerHTML += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
        <button class="page-link" onclick="changePage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>
    </li>`;

    const start = Math.max(1, currentPage - 2);
    const end   = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        nav.innerHTML += `<li class="page-item ${i === currentPage ? 'active' : ''}">
            <button class="page-link" onclick="changePage(${i})">${i}</button>
        </li>`;
    }

    nav.innerHTML += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <button class="page-link" onclick="changePage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>
    </li>`;
}

function changePage(page) {
    const totalPages = Math.ceil(filtered.length / perPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderBills();
    renderPagination();
}

// ── 9. Request payment ──
async function requestPayment(billId) {
    if (!confirm("Submit this bill for admin payment review?")) return;
    try {
        const res    = await fetch('http://10.198.104.172:5000/api/student/request-pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: user.student_id, bill_id: billId })
        });
        const result = await res.json();
        if (result.success) {
            const bill = allBills.find(b => b.bill_id === billId);
            if (bill) { bill.status = 'pending'; bill._status = 'pending'; }
            updateStats();
            applyFilter();
        } else {
            alert("Failed: " + (result.message || "Unknown error."));
        }
    } catch (err) {
        console.error("Payment request error:", err);
        alert("Server error. Is the backend running?");
    }
}

// ── 10. Logout ──
function logout() {
    if (confirm("Are you sure you want to log out?")) {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

// ── Helper ──
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? '—';
}