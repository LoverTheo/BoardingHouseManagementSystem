// admin_students.js

// ── Auth guard ──
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'admin') {
    window.location.href = 'index.html';
} else {
    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = currentUser.name || 'Admin';
}

document.addEventListener('DOMContentLoaded', () => {
    fetchStudents();
    document.getElementById('studentSearch').addEventListener('input', applyFiltersAndSort);
});

// Bootstrap modal instances
const studentModal = new bootstrap.Modal(document.getElementById('studentModal'));
const studentForm  = document.getElementById('studentForm');
const billModal    = new bootstrap.Modal(document.getElementById('billModal'));

// ── State — cleaned up, one variable for each thing ──
let sortDirection    = true;    // true = asc, false = desc
let currentSortField = 'name';  // remove lastSortKey entirely
let currentPage      = 1;
let totalPages       = 1;
const itemsPerPage   = 10;

// ── 1. Fetch — use currentSortField, not lastSortKey ──
async function fetchStudents() {
    try {
        const search = document.getElementById('studentSearch').value.trim();
        const dir    = sortDirection ? 'asc' : 'desc';

        const res  = await fetch(`http://localhost:5000/api/admin/all-users?search=${encodeURIComponent(search)}&sort=${currentSortField}&dir=${dir}&page=${currentPage}&limit=${itemsPerPage}`);
        const data = await res.json();

        totalPages = data.totalPages || 1;

        renderTable(data.students);
        updateSortIcons();
        updatePagination(data.currentPage, data.totalPages, data.totalStudents);
        updateStats(data.totalStudents);

    } catch (err) {
        console.error("Error fetching students:", err);
        document.getElementById('studentTableBody').innerHTML = `
            <tr><td colspan="7" class="text-center py-4 text-muted">
                <i class="fas fa-circle-exclamation me-2"></i>Failed to load students. Is the server running?
            </td></tr>`;
    }
}

// ── 2. Render table rows ──
function renderTable(students) {
    const body = document.getElementById('studentTableBody');

    if (!students || students.length === 0) {
        body.innerHTML = `
            <tr><td colspan="7" class="text-center py-4 text-muted">
                <i class="fas fa-user-slash me-2"></i>No students found.
            </td></tr>`;
        return;
    }

    body.innerHTML = students.map(s => {
        const statusClass = s.status === 'Active' ? 'status-active' : 'status-archived';
        return `
        <tr>
            <td><span class="amount">${s.student_id}</span></td>
            <td>
                <div style="font-weight:500; color:#1a1a2e;">${s.name}</div>
                <div style="font-size:11px; color:#9ca3af;">${s.profile?.contact || '—'}</div>
            </td>
            <td>
                ${s.room_no
                    ? `<span class="badge status-occupied">Room ${s.room_no}</span>`
                    : `<span class="badge status-archived">No Room</span>`}
            </td>
            <td style="color:#6b7280; font-size:13px;">
                ${s.profile?.course || 'N/A'} · Yr ${s.profile?.year_level || '?'}
            </td>
            <td>
                <span class="badge status-unpaid">Day ${s.due_day || '??'}</span>
            </td>
            <td>
                <span class="badge ${statusClass}">${s.status || 'Active'}</span>
            </td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-secondary" onclick="prepareEdit('${s.student_id}')" title="Edit">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="manageBills('${s.student_id}', '${s.name}')" title="Bills">
                        <i class="fas fa-file-invoice-dollar"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="archiveStudent('${s.student_id}')" title="Archive">
                        <i class="fas fa-box-archive"></i>
                    </button>
                    <button class="btn btn-sm" style="background:#fee2e2; color:#dc2626; border:none;" onclick="deleteStudent('${s.student_id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ── 3. Update pagination UI ──
function updatePagination(page, total, totalStudents) {
    document.getElementById('pageIndicator').textContent      = page;
    document.getElementById('totalPagesIndicator').textContent = total;
    document.getElementById('pageIndicatorBottom').textContent = page;
    document.getElementById('totalPagesBottom').textContent    = total;
    document.getElementById('totalCount').textContent          = totalStudents || 0;

    document.getElementById('prevBtn').disabled = page <= 1;
    document.getElementById('nextBtn').disabled = page >= total;
}

// ── 4. Update quick stats ──
function updateStats(total) {
    // total from paginated endpoint is all matching students
    // For active/archived split, use what we have
    if (document.getElementById('statTotal')) {
        document.getElementById('statTotal').textContent = total ?? '—';
    }
}

// ── 5. Sorting — parameter is key, variable is sortDirection ──
function sortStudents(key) {
    if (currentSortField === key) {
        sortDirection = !sortDirection;  // toggle asc/desc
    } else {
        currentSortField = key;          // switch column
        sortDirection = true;            // reset to asc
    }
    currentPage = 1;
    fetchStudents();
}

// ── 5.1. Sort icons — use sortDirection, not isAscending ──
function updateSortIcons() {
    document.querySelectorAll('thead i').forEach(icon => {
        icon.className = 'fas fa-sort text-muted ms-1';
        icon.style.fontSize = '10px';
    });
    const active = document.getElementById(`sort-${currentSortField}`);
    if (active) {
        active.className = `fas ${sortDirection ? 'fa-sort-up' : 'fa-sort-down'} ms-1`;
        active.style.fontSize = '10px';
        active.classList.remove('text-muted');
    }
}

// ── 6. Search ──
function applyFiltersAndSort() {
    currentPage = 1;
    fetchStudents();
}

// ── 7. Pagination ──
function changePage(direction) {
    const next = currentPage + direction;
    if (next < 1 || next > totalPages) return;
    currentPage = next;
    fetchStudents();
}

// ── 8. Prepare Add ──
function prepareAdd() {
    document.getElementById('modalTitle').textContent = "Register New Boarder";
    document.getElementById('is_edit_mode').value = "false";
    studentForm.reset();
    document.getElementById('s_id').readOnly = false;
    loadAvailableRooms();
}

// ── 9. Prepare Edit ──
async function prepareEdit(id) {
    try {
        // ✅ Fixed: now calls studentController route
        const res = await fetch(`http://localhost:5000/api/student/get-student/${id}`);
        const s   = await res.json();

        document.getElementById('modalTitle').textContent  = "Edit Boarder Profile";
        document.getElementById('is_edit_mode').value      = "true";
        document.getElementById('s_id').value              = s.student_id;
        document.getElementById('s_id').readOnly           = true;
        document.getElementById('s_name').value            = s.name;
        document.getElementById('s_course').value          = s.profile?.course || '';
        document.getElementById('s_year').value            = s.profile?.year_level || '';
        document.getElementById('s_contact').value         = s.profile?.contact || '';
        document.getElementById('s_room').value            = s.room_no || '';
        document.getElementById('s_pass').value            = '';

        await loadAvailableRooms(s.room_no);
        studentModal.show();
    } catch (err) {
        console.error("Error loading student:", err);
        alert("Could not load student data.");
    }
}

// ── 10. Manage Bills ──
async function manageBills(id, name) {
    document.getElementById('billStudentId').value = id;
    document.getElementById('billModalSub').textContent = name || id;
    document.getElementById('billList').innerHTML = `<p class="text-muted text-center py-3"><i class="fas fa-spinner fa-spin me-2"></i>Loading bills…</p>`;

    billModal.show();

    try {
        // ✅ Fixed: uses the new dedicated bills endpoint
        const res   = await fetch(`http://localhost:5000/api/student/get-bills/${id}`);
        const bills = await res.json();

        const billList = document.getElementById('billList');

        if (!bills || bills.length === 0) {
            billList.innerHTML = `<p class="text-muted text-center py-3">No bills found for this student.</p>`;
            return;
        }

        billList.innerHTML = bills.map((bill, index) => {
            const statusClass = bill.status === 'paid' ? 'paid' : bill.status === 'pending' ? 'pending' : bill.status === 'overdue' ? 'overdue' : '';
            const badgeClass  = bill.status === 'paid' ? 'status-paid' : bill.status === 'pending' ? 'status-pending' : 'status-unpaid';
            return `
            <div class="bill-card ${statusClass} mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <strong style="font-size:14px;">${bill.category}</strong>
                    <span class="badge ${badgeClass}">${bill.status.toUpperCase()}</span>
                </div>
                <div style="font-size:11px; color:#9ca3af; margin-bottom:10px;">${bill.month} · Bill #${bill.bill_id}</div>
                <div class="row g-2">
                    <div class="col-6">
                        <label class="form-label">Amount (₱)</label>
                        <input type="number" class="form-control" id="amt_${index}" value="${bill.amount}">
                    </div>
                    <div class="col-6">
                        <label class="form-label">Due Date</label>
                        <input type="date" class="form-control" id="date_${index}" value="${bill.due_date}">
                    </div>
                </div>
                <button class="btn btn-primary w-100 mt-3 btn-sm" onclick="updateSingleBill('${bill.bill_id}', ${index})">
                    <i class="fas fa-save me-1"></i> Save ${bill.category}
                </button>
            </div>`;
        }).join('');

    } catch (err) {
        console.error("Error loading bills:", err);
        document.getElementById('billList').innerHTML = `<p class="text-danger text-center py-3">Failed to load bills.</p>`;
    }
}

// ── 11. Update single bill ──
async function updateSingleBill(billId, index) {
    const amount   = parseFloat(document.getElementById(`amt_${index}`).value);
    const due_date = document.getElementById(`date_${index}`).value;

    try {
        // ✅ Fixed: now calls billController route
        const res = await fetch('http://localhost:5000/api/bills/update-bill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bill_id: billId, amount, due_date })
        });
        const result = await res.json();
        if (result.success) {
            alert("Bill updated successfully!");
        } else {
            alert("Failed to update bill.");
        }
    } catch (err) {
        console.error("Update bill error:", err);
    }
}

// ── 12. Form submit (Add / Edit) ──
studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = document.getElementById('is_edit_mode').value === "true";

    const payload = {
        student_id: document.getElementById('s_id').value,
        name:       document.getElementById('s_name').value,
        password:   document.getElementById('s_pass').value,
        room_no:    document.getElementById('s_room').value,
        due_day:    new Date().getDate(),
        profile: {
            course:      document.getElementById('s_course').value,
            year_level:  document.getElementById('s_year').value,
            contact:     document.getElementById('s_contact').value,
            nickname:    document.getElementById('s_name').value.split(' ')[0],
        }
    };

    const url = isEdit ? '/api/admin/update-student' : '/api/admin/add-student';

    try {
        const res    = await fetch(`http://localhost:5000${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (res.ok && result.success) {
            studentModal.hide();
            fetchStudents();
            alert(isEdit ? "Student updated!" : "Student added successfully!");
        } else {
            alert("Error: " + (result.message || "Something went wrong."));
        }
    } catch (err) {
        console.error("Save student error:", err);
        alert("Server error. Is the backend running?");
    }
});

// ── 13. Archive ──
async function archiveStudent(id) {
    if (!confirm(`Archive student ${id}? They will be moved out and their room freed.`)) return;
    try {
        const res    = await fetch('http://localhost:5000/api/admin/archive-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: id })
        });
        const result = await res.json();
        if (result.success) {
            fetchStudents();
        } else {
            alert("Error: " + (result.message || "Could not archive."));
        }
    } catch (err) {
        alert("Server error.");
    }
}

// ── 14. Delete ──
async function deleteStudent(id) {
    if (!confirm(`Permanently delete student ${id}? This cannot be undone.`)) return;
    try {
        const res    = await fetch('http://localhost:5000/api/admin/delete-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: id })
        });
        const result = await res.json();
        if (result.success) {
            fetchStudents();
        } else {
            alert("Error: " + (result.message || "Could not delete."));
        }
    } catch (err) {
        alert("Server error.");
    }
}

// ── 15. Load available rooms ──
async function loadAvailableRooms(currentRoom = null) {
    try {
        // ✅ Fixed: now calls roomController route
        const res   = await fetch('http://localhost:5000/api/rooms/all-rooms?limit=100');
        const data  = await res.json();
        const rooms = data.rooms || [];

        const select = document.getElementById('s_room');
        select.innerHTML = '<option value="" disabled>Select available room…</option>';

        rooms.forEach(room => {
            const slotsLeft = (room.capacity || 1) - (room.occupancy_count || 0);
            // Show all rooms in edit mode (including current room), only vacant in add mode
            if (slotsLeft > 0 || room.room_no === currentRoom) {
                const opt = document.createElement('option');
                opt.value = room.room_no;
                opt.textContent = `Room ${room.room_no} (${room.type}) — ${slotsLeft} slot${slotsLeft !== 1 ? 's' : ''} left`;
                if (room.room_no === currentRoom) {
                    opt.textContent += ' · current';
                    opt.selected = true;
                }
                select.appendChild(opt);
            }
        });
    } catch (err) {
        console.error("Error loading rooms:", err);
    }
}

// ── 16. Logout ──
function logout() {
    if (confirm("Are you sure you want to log out?")) {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}