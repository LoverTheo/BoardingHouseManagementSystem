// admin_bills.js

// ── Auth guard ──
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'admin') {
    window.location.href = 'index.html';
} else {
    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = currentUser.name || 'Admin';
}

// ── PH time helper ──
function getToday() {
    const now = new Date();
    return new Date(now - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

function effectiveStatus(bill) {
    if (bill.status === 'paid' || bill.status === 'pending') return bill.status;
    if (bill.due_date && bill.due_date < getToday()) return 'overdue';
    return bill.status;
}

// ── Raw data ──
let allBills    = [];
let activeBills = [];
let paidBills   = [];

// ── Time range state ──
let currentRange = 'all';

// ── Active list state ──
let activeFiltered  = [];
let activeSortField = 'due_date';
let activeSortAsc   = true;
let activePage      = 1;
const activePerPage = 10;

// ── Paid list state ──
let paidFiltered  = [];
let paidSortField = 'paid_date';
let paidSortAsc   = false;   // newest paid first by default
let paidPage      = 1;
const paidPerPage = 10;

// ═══════════════════════════════════════════
// 1. FETCH
// ═══════════════════════════════════════════
async function fetchAllBills() {
    try {
        const res   = await fetch('http://10.198.104.172:5000/api/bills/all-bills');
        const bills = await res.json();

        allBills = bills.map(b => ({
            ...b,
            _effectiveStatus: effectiveStatus(b),
            _name: b.student?.name    || 'Unknown',
            _room: b.student?.room_no || 'N/A',
        }));

        applyRangeAndRender();
    } catch (err) {
        console.error("Error loading bills:", err);
        document.getElementById('activeBillTable').innerHTML =
            `<tr><td colspan="7" class="text-center py-4 text-muted">
                <i class="fas fa-circle-exclamation me-2"></i>Failed to load bills.
            </td></tr>`;
    }
}

// ═══════════════════════════════════════════
// 2. TIME RANGE FILTER
// ═══════════════════════════════════════════
function applyTimeRange(btn) {
    // Update active button style
    document.querySelectorAll('.time-range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRange = btn.dataset.range;

    // Update the label on the stat card footer
    const labels = {
        all:        'All time',
        this_month: 'This month',
        prev_month: 'Previous month',
        this_year:  'This year',
        prev_year:  'Previous year',
    };
    setText('statRangeLabel', labels[currentRange] || 'All time');

    applyRangeAndRender();
}

// Returns only bills that fall within the selected time range
function filterByRange(bills) {
    if (currentRange === 'all') return bills;

    const now      = new Date();
    const thisYear = now.getFullYear();
    const thisMon  = now.getMonth(); // 0-indexed

    return bills.filter(b => {
        const dateStr = b.due_date || b.paid_date;
        if (!dateStr) return false;
        const d = new Date(dateStr);

        switch (currentRange) {
            case 'this_month':
                return d.getFullYear() === thisYear && d.getMonth() === thisMon;
            case 'prev_month': {
                const pm = thisMon === 0 ? 11 : thisMon - 1;
                const py = thisMon === 0 ? thisYear - 1 : thisYear;
                return d.getFullYear() === py && d.getMonth() === pm;
            }
            case 'this_year':
                return d.getFullYear() === thisYear;
            case 'prev_year':
                return d.getFullYear() === thisYear - 1;
            default:
                return true;
        }
    });
}

function applyRangeAndRender() {
    const ranged = filterByRange(allBills);

    activeBills = ranged.filter(b => b._effectiveStatus !== 'paid');
    paidBills   = ranged.filter(b => b._effectiveStatus === 'paid');

    updateStatCards(ranged);
    applyActiveFilters();
    applyPaidFilters();
}

// ═══════════════════════════════════════════
// 3. STAT CARDS
// ═══════════════════════════════════════════
function updateStatCards(bills) {
    let expected = 0, collected = 0, unpaid = 0, pending = 0;

    bills.forEach(b => {
        const amt = parseFloat(b.amount) || 0;
        expected += amt;
        if (b._effectiveStatus === 'paid')    collected += amt;
        else                                   unpaid    += amt;
        if (b._effectiveStatus === 'pending') pending++;
    });

    setText('totalExpected',  `₱${expected.toLocaleString()}`);
    setText('totalCollected', `₱${collected.toLocaleString()}`);
    setText('unpaidBalance',  `₱${unpaid.toLocaleString()}`);
    setText('totalPending',   pending);
}

// ═══════════════════════════════════════════
// 4. ACTIVE LIST
// ═══════════════════════════════════════════
function applyActiveFilters() {
    const search   = document.getElementById('activeSearch').value.trim().toLowerCase();
    const category = document.getElementById('activeCategoryFilter').value;
    const status   = document.getElementById('activeStatusFilter').value;

    activeFiltered = activeBills.filter(b => {
        const matchSearch   = !search   || b._name.toLowerCase().includes(search) || b._room.toLowerCase().includes(search) || b.bill_id?.toLowerCase().includes(search);
        const matchCategory = !category || b.category === category;
        const matchStatus   = !status   || b._effectiveStatus === status;
        return matchSearch && matchCategory && matchStatus;
    });

    activePage = 1;
    sortAndRenderActive();
}

function sortActive(field) {
    activeSortField = activeSortField === field ? (activeSortAsc = !activeSortAsc, field) : (activeSortAsc = true, field);
    activePage = 1;
    sortAndRenderActive();
}

function sortAndRenderActive() {
    activeFiltered.sort((a, b) => {
        const va = getSortValue(a, activeSortField);
        const vb = getSortValue(b, activeSortField);
        if (va < vb) return activeSortAsc ? -1 : 1;
        if (va > vb) return activeSortAsc ?  1 : -1;
        return 0;
    });
    updateSortIcons('active', activeSortField, activeSortAsc);
    renderActiveTable();
    renderPaginationBar('active', activePage, Math.ceil(activeFiltered.length / activePerPage), activeFiltered.length);
    setText('activeCount', activeFiltered.length);
}

function renderActiveTable() {
    const body  = document.getElementById('activeBillTable');
    const start = (activePage - 1) * activePerPage;
    const slice = activeFiltered.slice(start, start + activePerPage);

    if (slice.length === 0) {
        body.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">
            <i class="fas fa-check-circle me-2 text-success"></i>No active bills — all clear!
        </td></tr>`;
        return;
    }

    body.innerHTML = slice.map(bill => {
        const amt    = parseFloat(bill.amount) || 0;
        const status = bill._effectiveStatus;

        const badgeClass = status === 'overdue' ? 'status-overdue'
                         : status === 'pending' ? 'status-pending'
                         : 'status-unpaid';

        // Action column — mark paid (pending only) + delete
        const markPaidBtn = status === 'pending'
            ? `<button class="btn btn-sm btn-primary" onclick="markAsPaid('${bill.student_id}', '${bill.bill_id}')">
                   <i class="fas fa-check me-1"></i>Mark Paid
               </button>`
            : `<span style="font-size:12px; color:#9ca3af;">Awaiting student</span>`;

        return `
        <tr>
            <td>
                <div style="font-weight:500; color:#1a1a2e;">${bill._name}</div>
                <div style="font-size:11px; color:#9ca3af;">${bill.bill_id}</div>
            </td>
            <td><span class="badge status-occupied">${bill._room !== 'N/A' ? 'Room ' + bill._room : 'N/A'}</span></td>
            <td><span class="badge status-unpaid">${bill.category}</span></td>
            <td><span class="amount">₱${amt.toLocaleString()}</span></td>
            <td style="font-family:'DM Mono',monospace; font-size:13px;">${bill.due_date || '—'}</td>
            <td><span class="badge ${badgeClass}">${status.toUpperCase()}</span></td>
            <td>
                <div class="d-flex gap-1 align-items-center">
                    ${markPaidBtn}
                    <button class="btn btn-sm" style="background:#fee2e2; color:#dc2626; border:none;"
                        onclick="deleteBill('${bill.bill_id}')" title="Delete bill">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function changeActivePage(page) {
    const total = Math.ceil(activeFiltered.length / activePerPage);
    if (page < 1 || page > total) return;
    activePage = page;
    renderActiveTable();
    renderPaginationBar('active', activePage, total, activeFiltered.length);
}

// ═══════════════════════════════════════════
// 5. PAID LIST
// ═══════════════════════════════════════════
function applyPaidFilters() {
    const search   = document.getElementById('paidSearch').value.trim().toLowerCase();
    const category = document.getElementById('paidCategoryFilter').value;

    paidFiltered = paidBills.filter(b => {
        const matchSearch   = !search   || b._name.toLowerCase().includes(search) || b._room.toLowerCase().includes(search) || b.bill_id?.toLowerCase().includes(search);
        const matchCategory = !category || b.category === category;
        return matchSearch && matchCategory;
    });

    paidPage = 1;
    sortAndRenderPaid();
}

function sortPaid(field) {
    paidSortField = paidSortField === field ? (paidSortAsc = !paidSortAsc, field) : (paidSortAsc = true, field);
    paidPage = 1;
    sortAndRenderPaid();
}

function sortAndRenderPaid() {
    paidFiltered.sort((a, b) => {
        const va = getSortValue(a, paidSortField);
        const vb = getSortValue(b, paidSortField);
        if (va < vb) return paidSortAsc ? -1 : 1;
        if (va > vb) return paidSortAsc ?  1 : -1;
        return 0;
    });
    updateSortIcons('paid', paidSortField, paidSortAsc);
    renderPaidTable();
    renderPaginationBar('paid', paidPage, Math.ceil(paidFiltered.length / paidPerPage), paidFiltered.length);
    setText('paidCount', paidFiltered.length);
}

function renderPaidTable() {
    const body  = document.getElementById('paidBillTable');
    const start = (paidPage - 1) * paidPerPage;
    const slice = paidFiltered.slice(start, start + paidPerPage);

    if (slice.length === 0) {
        body.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No payment records found.</td></tr>`;
        return;
    }

    body.innerHTML = slice.map(bill => {
        const amt = parseFloat(bill.amount) || 0;
        return `
        <tr>
            <td>
                <div style="font-weight:500; color:#1a1a2e;">${bill._name}</div>
                <div style="font-size:11px; color:#9ca3af;">${bill.bill_id}</div>
            </td>
            <td><span class="badge status-occupied">${bill._room !== 'N/A' ? 'Room ' + bill._room : 'N/A'}</span></td>
            <td><span class="badge status-unpaid">${bill.category}</span></td>
            <td><span class="amount">₱${amt.toLocaleString()}</span></td>
            <td style="font-family:'DM Mono',monospace; font-size:13px;">${bill.due_date || '—'}</td>
            <td style="font-family:'DM Mono',monospace; font-size:13px; color:#16a34a;">
                ${bill.paid_date || '—'}
            </td>
            <td><span class="badge status-paid"><i class="fas fa-check me-1"></i>PAID</span></td>
        </tr>`;
    }).join('');
}

function changePaidPage(page) {
    const total = Math.ceil(paidFiltered.length / paidPerPage);
    if (page < 1 || page > total) return;
    paidPage = page;
    renderPaidTable();
    renderPaginationBar('paid', paidPage, total, paidFiltered.length);
}

// ═══════════════════════════════════════════
// 6. SHARED HELPERS
// ═══════════════════════════════════════════
function getSortValue(bill, field) {
    switch (field) {
        case 'name':      return bill._name.toLowerCase();
        case 'room':      return bill._room.toLowerCase();
        case 'category':  return bill.category?.toLowerCase() || '';
        case 'amount':    return parseFloat(bill.amount) || 0;
        case 'due_date':  return bill.due_date  || '';
        case 'paid_date': return bill.paid_date || '';  // ← new
        default:          return '';
    }
}

function updateSortIcons(table, activeField, isAsc) {
    const prefix = `sort-${table}-`;
    document.querySelectorAll(`[id^="${prefix}"]`).forEach(icon => {
        icon.className = 'fas fa-sort text-muted ms-1';
        icon.style.fontSize = '10px';
    });
    const active = document.getElementById(`${prefix}${activeField}`);
    if (active) {
        active.className = `fas ${isAsc ? 'fa-sort-up' : 'fa-sort-down'} ms-1`;
        active.style.fontSize = '10px';
        active.classList.remove('text-muted');
    }
}

function renderPaginationBar(table, currentPage, totalPages, totalItems) {
    const infoEl  = document.getElementById(`${table}PageInfo`);
    const navEl   = document.getElementById(`${table}Pagination`);
    const fn      = table === 'active' ? 'changeActivePage' : 'changePaidPage';
    const perPage = table === 'active' ? activePerPage : paidPerPage;

    const from = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
    const to   = Math.min(currentPage * perPage, totalItems);
    if (infoEl) infoEl.textContent = totalItems === 0 ? 'No results' : `Showing ${from}–${to} of ${totalItems}`;

    if (!navEl) return;
    navEl.innerHTML = '';
    if (totalPages <= 1) return;

    navEl.innerHTML += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
        <button class="page-link" onclick="${fn}(${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>
    </li>`;

    const start = Math.max(1, currentPage - 2);
    const end   = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        navEl.innerHTML += `<li class="page-item ${i === currentPage ? 'active' : ''}">
            <button class="page-link" onclick="${fn}(${i})">${i}</button>
        </li>`;
    }

    navEl.innerHTML += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <button class="page-link" onclick="${fn}(${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>
    </li>`;
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ═══════════════════════════════════════════
// 7. MARK AS PAID
// ═══════════════════════════════════════════
async function markAsPaid(studentId, billId) {
    if (!confirm("Confirm payment for this bill?")) return;
    try {
        const res    = await fetch('http://10.198.104.172:5000/api/bills/update-bill-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: studentId, bill_id: billId, status: 'paid' })
        });
        const result = await res.json();
        if (res.ok && result.success) {
            fetchAllBills();
        } else {
            alert("Error: " + (result.error || "Could not update."));
        }
    } catch (err) {
        alert("Server error. Is the backend running?");
    }
}

// ═══════════════════════════════════════════
// 8. DELETE BILL
// ═══════════════════════════════════════════
async function deleteBill(billId) {
    if (!confirm(`Delete bill ${billId}? This cannot be undone.`)) return;
    try {
        const res    = await fetch('http://10.198.104.172:5000/api/bills/delete-bill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bill_id: billId })
        });
        const result = await res.json();
        if (result.success) {
            fetchAllBills();
        } else {
            alert("Error: " + (result.message || "Could not delete."));
        }
    } catch (err) {
        alert("Server error.");
    }
}

// ═══════════════════════════════════════════
// 9. GENERATE MONTHLY BILLS
// ═══════════════════════════════════════════
async function triggerMonthlyBilling() {
    if (!confirm("Generate Rent and Electricity bills for all active students for the current month?")) return;
    try {
        const now = new Date();
        const res = await fetch('http://10.198.104.172:5000/api/bills/generate-monthly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month: now.getMonth() + 1, year: now.getFullYear() })
        });
        if (res.ok) {
            const result = await res.json();
            alert(`Success! Generated bills for ${result.count} student(s).`);
            fetchAllBills();
        } else {
            alert("Failed to generate bills. Check server logs.");
        }
    } catch (err) {
        console.error("Billing Error:", err);
    }
}

// ═══════════════════════════════════════════
// 10. LOGOUT
// ═══════════════════════════════════════════
function logout() {
    if (confirm("Are you sure you want to log out?")) {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

// ── Init ──
fetchAllBills();