// admin_rooms.js

// ── Auth guard ──
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'admin') {
    window.location.href = 'index.html';
} else {
    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = currentUser.name || 'Admin';
}

document.addEventListener('DOMContentLoaded', fetchRooms);

const roomModal = new bootstrap.Modal(document.getElementById('roomModal'));
const roomForm  = document.getElementById('roomForm');

// ── State ──
let globalRooms      = [];
let currentSortField = 'room_no';
let isAscending      = true;
let currentPage      = 1;
let totalPages       = 1;
const limit          = 10;
let searchQuery      = '';
let searchTimeout;

// ── 1. Fetch rooms ──
async function fetchRooms() {
    try {
        const dir = isAscending ? 'asc' : 'desc';
        const res  = await fetch(`http://localhost:5000/api/rooms/all-rooms?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(searchQuery)}&sort=${currentSortField}&dir=${dir}`);
        const data = await res.json();

        globalRooms = data.rooms || [];
        totalPages  = data.totalPages || 1;

        renderRoomsTable(globalRooms);
        renderPagination(data.currentPage, data.totalPages, data.totalRooms);
        updateSortIcons();
        updateStats(globalRooms, data.totalRooms);
    } catch (err) {
        console.error("Error fetching rooms:", err);
        document.getElementById('roomTableBody').innerHTML = `
            <tr><td colspan="7" class="text-center py-4 text-muted">
                <i class="fas fa-circle-exclamation me-2"></i>Failed to load rooms. Is the server running?
            </td></tr>`;
    }
}

// ── 2. Render table ──
function renderRoomsTable(rooms) {
    const body = document.getElementById('roomTableBody');

    if (!rooms || rooms.length === 0) {
        body.innerHTML = `
            <tr><td colspan="7" class="text-center py-4 text-muted">
                <i class="fas fa-door-open me-2"></i>No rooms found.
            </td></tr>`;
        return;
    }

    body.innerHTML = rooms.map(room => {
        const current = room.occupancy_count || 0;
        const max     = room.capacity || 1;

        // Occupancy bar
        const pct         = Math.round((current / max) * 100);
        const barColor    = current === 0 ? '#16a34a' : current >= max ? '#dc2626' : '#ca8a04';
        const occupancyBar = `
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="flex:1; height:5px; background:#f3f4f6; border-radius:99px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:${barColor}; border-radius:99px;"></div>
                </div>
                <span style="font-family:'DM Mono',monospace; font-size:12px; color:#6b7280; white-space:nowrap;">${current}/${max}</span>
            </div>`;

        // Status badge
        let statusBadge;
        if (current === 0) {
            statusBadge = `<span class="badge status-vacant">Vacant</span>`;
        } else if (current >= max) {
            statusBadge = `<span class="badge status-overdue">Full</span>`;
        } else {
            statusBadge = `<span class="badge status-pending">Partial</span>`;
        }

        return `
        <tr class="align-middle">
            <td><strong class="amount">${room.room_no}</strong></td>
            <td style="color:#6b7280; font-size:13px;">${room.floor}</td>
            <td>
                <span style="font-size:13px; font-weight:500; color:#374151;">${room.type}</span>
            </td>
            <td>
                <span class="amount" style="font-size:13px;">₱${room.base_price.toLocaleString()}</span>
                <div style="font-size:11px; color:#9ca3af;">per month</div>
            </td>
            <td style="min-width:120px;">${occupancyBar}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-secondary" onclick="prepareEdit('${room.room_no}')" title="Edit">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn btn-sm" style="background:#fee2e2; color:#dc2626; border:none;"
                        onclick="deleteRoom('${room.room_no}')" title="Delete"
                        ${current > 0 ? 'disabled title="Move students out first"' : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ── 3. Update stat cards ──
function updateStats(rooms, totalRooms) {
    const vacant  = rooms.filter(r => (r.occupancy_count || 0) === 0).length;
    const full    = rooms.filter(r => (r.occupancy_count || 0) >= (r.capacity || 1)).length;
    const partial = rooms.filter(r => {
        const c = r.occupancy_count || 0;
        return c > 0 && c < (r.capacity || 1);
    }).length;

    setText('statTotal',   totalRooms ?? rooms.length);
    setText('statVacant',  vacant);
    setText('statPartial', partial);
    setText('statFull',    full);
}

// ── 4. Render pagination ──
function renderPagination(current, total, totalItems) {
    const info = document.getElementById('roomCountInfo');
    const nav  = document.getElementById('paginationControls');

    if (info) info.textContent = `Showing ${globalRooms.length} of ${totalItems ?? 0} rooms`;
    if (!nav) return;

    nav.innerHTML = '';
    if (total <= 1) return;

    // Prev
    nav.innerHTML += `
        <li class="page-item ${current === 1 ? 'disabled' : ''}">
            <button class="page-link" onclick="changePage(${current - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        </li>`;

    // Page numbers (show max 5 around current)
    const start = Math.max(1, current - 2);
    const end   = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
        nav.innerHTML += `
            <li class="page-item ${i === current ? 'active' : ''}">
                <button class="page-link" onclick="changePage(${i})">${i}</button>
            </li>`;
    }

    // Next
    nav.innerHTML += `
        <li class="page-item ${current === total ? 'disabled' : ''}">
            <button class="page-link" onclick="changePage(${current + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        </li>`;
}

// ── 5. Change page ──
function changePage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    fetchRooms();
}

// ── 6. Search (debounced) ──
function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchQuery = document.getElementById('searchInput').value.trim();
        currentPage = 1;
        fetchRooms();
    }, 300);
}

// ── 7. Sort ──
function sortRooms(field) {
    if (currentSortField === field) {
        isAscending = !isAscending;
    } else {
        currentSortField = field;
        isAscending = true;
    }
    currentPage = 1;
    fetchRooms();
}

// ── 8. Sort icon feedback ──
function updateSortIcons() {
    document.querySelectorAll('thead i').forEach(icon => {
        icon.className = 'fas fa-sort text-muted ms-1';
        icon.style.fontSize = '10px';
    });
    const active = document.getElementById(`sort-${currentSortField}`);
    if (active) {
        active.className = `fas ${isAscending ? 'fa-sort-up' : 'fa-sort-down'} ms-1`;
        active.style.fontSize = '10px';
        active.classList.remove('text-muted');
    }
}

// ── 9. Prepare Add ──
function prepareAdd() {
    document.getElementById('modalTitle').textContent = "Add New Room";
    document.getElementById('is_edit_mode').value = "false";
    document.getElementById('r_no').readOnly = false;
    roomForm.reset();
}

// ── 10. Prepare Edit ──
function prepareEdit(roomNo) {
    const room = globalRooms.find(r => r.room_no === roomNo);
    if (!room) return;

    document.getElementById('modalTitle').textContent = "Edit Room Details";
    document.getElementById('is_edit_mode').value     = "true";
    document.getElementById('r_no').value             = room.room_no;
    document.getElementById('r_no').readOnly          = true;
    document.getElementById('r_floor').value          = room.floor;
    document.getElementById('r_type').value           = room.type;
    document.getElementById('r_price').value          = room.base_price;
    document.getElementById('r_capacity').value       = room.capacity;

    roomModal.show();
}

// ── 11. Form submit ──
roomForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = document.getElementById('is_edit_mode').value === "true";

    const roomData = {
        room_no:    document.getElementById('r_no').value,
        floor:      document.getElementById('r_floor').value,
        type:       document.getElementById('r_type').value,
        capacity:   parseInt(document.getElementById('r_capacity').value),
        base_price: parseFloat(document.getElementById('r_price').value)
    };

    const url = isEdit ? '/api/rooms/update-room' : '/api/rooms/add-room';

    try {
        const res    = await fetch(`http://localhost:5000${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roomData)
        });
        const result = await res.json();

        if (res.ok && result.success) {
            roomModal.hide();
            fetchRooms();
            alert(isEdit ? "Room updated!" : "Room added successfully!");
        } else {
            alert("Error: " + (result.message || "Something went wrong."));
        }
    } catch (err) {
        alert("Server error. Is the backend running?");
    }
});

// ── 12. Auto-fill from type ──
function autoFillRoomDetails() {
    const type = document.getElementById('r_type').value;
    const configs = {
        'Small Solo': { price: 3000, capacity: 1 },
        'Small Duo':  { price: 1650, capacity: 2 },
        'Big Solo':   { price: 4000, capacity: 1 },
        'Big Duo':    { price: 2100, capacity: 2 },
        'Big Trio':   { price: 1500, capacity: 3 }
    };
    if (configs[type]) {
        document.getElementById('r_price').value    = configs[type].price;
        document.getElementById('r_capacity').value = configs[type].capacity;
    }
}

// ── 13. Delete room ──
async function deleteRoom(roomNo) {
    const room = globalRooms.find(r => r.room_no === roomNo);
    if (room && room.occupancy_count > 0) {
        alert(`Cannot delete Room ${roomNo} — it still has ${room.occupancy_count} student(s). Move them out first.`);
        return;
    }
    if (!confirm(`Permanently delete Room ${roomNo}? This cannot be undone.`)) return;

    try {
        const res = await fetch('http://localhost:5000/api/rooms/delete-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_no: roomNo })
        });
        const result = await res.json();
        if (result.success) {
            fetchRooms();
        } else {
            alert("Error: " + (result.message || "Could not delete."));
        }
    } catch (err) {
        alert("Server error.");
    }
}

async function syncRooms() {
    if (!confirm("Recalculate all room occupancy counts from actual student assignments? This fixes any data mismatches.")) return;
    try {
        const res    = await fetch('http://localhost:5000/api/admin/sync-rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await res.json();
        if (result.success) {
            alert(result.message);
            fetchRooms(); // refresh the table
        } else {
            alert("Sync failed: " + result.message);
        }
    } catch (err) {
        alert("Server error.");
    }
}

// ── 14. Logout ──
function logout() {
    if (confirm("Are you sure you want to log out?")) {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

// ── Helper ──
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// document.addEventListener('DOMContentLoaded', fetchRooms);

// const roomModal = new bootstrap.Modal(document.getElementById('roomModal'));
// const roomForm = document.getElementById('roomForm');
// let globalRooms = []; 

// // --- NEW/UPDATED STATE VARIABLES ---
// let currentSortField = 'room_no';
// let isAscending = true;
// let currentPage = 1;
// const limit = 10; 
// let searchQuery = '';

// // 1. UPDATED Fetch Rooms
// async function fetchRooms() {
//     try {
//         const dir = isAscending ? 'asc' : 'desc';
//         // Now sending page, limit, and search parameters to the backend
//         const response = await fetch(`http://localhost:5000/api/rooms/all-rooms?page=${currentPage}&limit=${limit}&search=${searchQuery}&sort=${currentSortField}&dir=${dir}`);
//         const data = await response.json();
        
//         // Backend now returns { rooms, totalPages, currentPage, totalRooms }
//         globalRooms = data.rooms; 
        
//         renderRoomsTable(globalRooms); 
//         renderPagination(data.currentPage, data.totalPages, data.totalRooms); // Call the new pagination renderer
//         updateSortIcons();
//     } catch (err) {
//         console.error("Error fetching rooms:", err);
//     }
// }

// // --- NEW SEARCH FUNCTIONALITY ---
// let searchTimeout;
// function handleSearch() {
//     clearTimeout(searchTimeout);
//     searchTimeout = setTimeout(() => {
//         searchQuery = document.getElementById('searchInput').value.trim();
//         currentPage = 1; // Always reset to page 1 when searching
//         fetchRooms();
//     }, 300); // 300ms delay prevents spamming the database while typing
// }

// // --- NEW PAGINATION FUNCTIONALITY ---
// function renderPagination(current, totalPages, totalItems) {
//     const paginationEl = document.getElementById('paginationControls');
//     const infoEl = document.getElementById('roomCountInfo');
    
//     infoEl.textContent = `Showing ${globalRooms.length} of ${totalItems} rooms`;
//     paginationEl.innerHTML = '';

//     if (totalPages <= 1) return;

//     // Previous Button
//     paginationEl.innerHTML += `
//         <li class="page-item ${current === 1 ? 'disabled' : ''}">
//             <button class="page-link" onclick="changePage(${current - 1})">Previous</button>
//         </li>
//     `;

//     // Page Numbers
//     for (let i = 1; i <= totalPages; i++) {
//         paginationEl.innerHTML += `
//             <li class="page-item ${current === i ? 'active' : ''}">
//                 <button class="page-link" onclick="changePage(${i})">${i}</button>
//             </li>
//         `;
//     }

//     // Next Button
//     paginationEl.innerHTML += `
//         <li class="page-item ${current === totalPages ? 'disabled' : ''}">
//             <button class="page-link" onclick="changePage(${current + 1})">Next</button>
//         </li>
//     `;
// }

// function changePage(page) {
//     currentPage = page;
//     fetchRooms();
// }

// // 2. Render Table (Builds the HTML rows based on the sorted data)
// function renderRoomsTable(rooms) {
//     const tableBody = document.getElementById('roomTableBody');
//     tableBody.innerHTML = '';

//     rooms.forEach(room => {
//         // Get the numbers (default to 0 or 1 to avoid errors)
//         const current = room.occupancy_count || 0;
//         const max = room.capacity || 1;

//         // Decide what the badge looks like
//         let statusBadge = "";
//         if (current === 0) {
//             statusBadge = `<span class="badge bg-success">Vacant (0/${max})</span>`;
//         } else if (current >= max) {
//             statusBadge = `<span class="badge bg-danger">Full (${current}/${max})</span>`;
//         } else {
//             statusBadge = `<span class="badge bg-warning text-dark">${current}/${max} Occupied</span>`;
//         }

//         // Add the row to the table
//         tableBody.innerHTML += `
//             <tr class="align-middle">
//                 <td><strong>${room.room_no}</strong></td>
//                 <td>${room.floor}</td>
//                 <td>${room.type}</td>
//                 <td>₱${room.base_price.toLocaleString()}</td>
//                 <td>${statusBadge}</td> 
//                 <td>
//                     <button class="btn btn-sm btn-info text-white" onclick="prepareEdit('${room.room_no}')">
//                         <i class="fas fa-edit"></i>
//                     </button>
//                     <button class="btn btn-sm btn-danger" onclick="deleteRoom('${room.room_no}')">
//                         <i class="fas fa-trash"></i>
//                     </button>
//                 </td>
//             </tr>
//         `;
//     });
// }

// // 3. The Sorting Logic (File Explorer style)
// function sortRooms(field) {
//     if (currentSortField === field) {
//         // If clicking the same header, toggle direction
//         isAscending = !isAscending;
//     } else {
//         // If clicking a new header, default to Ascending
//         currentSortField = field;
//         isAscending = true;
//     }
//     fetchRooms();
// }

// // 4. Visual Feedback (Arrows)
// function updateSortIcons() {
//     // Reset all icons to default
//     document.querySelectorAll('thead i').forEach(icon => {
//         icon.className = 'fas fa-sort text-muted ms-1';
//     });
//     // Update active icon
//     const activeIcon = document.getElementById(`sort-${currentSortField}`);
//     if (activeIcon) {
//         activeIcon.className = isAscending ? 'fas fa-sort-up ms-1' : 'fas fa-sort-down ms-1';
//         activeIcon.classList.remove('text-muted');
//     }
// }

// // 5. Prepare Form for ADDING
// function prepareAdd() {
//     document.getElementById('modalTitle').textContent = "Add New Room";
//     document.getElementById('is_edit_mode').value = "false";
//     document.getElementById('r_no').readOnly = false;
//     roomForm.reset();
// }

// // 6. Prepare Form for EDITING
// function prepareEdit(roomNo) {
//     const room = globalRooms.find(r => r.room_no === roomNo);
//     if (!room) return;

//     document.getElementById('modalTitle').textContent = "Edit Room Details";
//     document.getElementById('is_edit_mode').value = "true";
    
//     document.getElementById('r_no').value = room.room_no;
//     document.getElementById('r_no').readOnly = true; 
//     document.getElementById('r_floor').value = room.floor;
//     document.getElementById('r_type').value = room.type;
//     document.getElementById('r_price').value = room.base_price;
//     document.getElementById('r_capacity').value = room.capacity;
    
//     roomModal.show();
// }

// // 7. Save Room (Handles both Add and Edit)
// roomForm.addEventListener('submit', async (e) => {
//     e.preventDefault();
//     const isEdit = document.getElementById('is_edit_mode').value === "true";

//     const roomData = {
//         room_no: document.getElementById('r_no').value,
//         floor: document.getElementById('r_floor').value,
//         type: document.getElementById('r_type').value,
//         capacity: parseInt(document.getElementById('r_capacity').value),
//         base_price: parseFloat(document.getElementById('r_price').value)
//     };

//     const url = isEdit ? '/api/rooms/update-room' : '/api/rooms/add-room';
    
//     try {
//         const response = await fetch(`http://localhost:5000${url}`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(roomData)
//         });

//         const result = await response.json();

//         if (response.ok && result.success) {
//             roomModal.hide();
//             fetchRooms(); // Refresh table
//             alert(isEdit ? "Room updated successfully!" : "Room added successfully!");
//         } else {
//             alert("Error: " + (result.message || "Something went wrong."));
//         }
//     } catch (err) {
//         alert("Server Error: Cannot save room.");
//     }
// });

// // 8. Auto-fill Room Details
// function autoFillRoomDetails() {
//     const type = document.getElementById('r_type').value;
//     const priceInput = document.getElementById('r_price');
//     const capacityInput = document.getElementById('r_capacity');

//     const roomConfigs = {
//         'Small Solo': { price: 3000, capacity: 1 },
//         'Small Duo':  { price: 1650, capacity: 2 },
//         'Big Solo':   { price: 4000, capacity: 1 },
//         'Big Duo':    { price: 2100, capacity: 2 },
//         'Big Trio':   { price: 1500, capacity: 3 }
//     };

//     if (roomConfigs[type]) {
//         priceInput.value = roomConfigs[type].price;
//         capacityInput.value = roomConfigs[type].capacity;
//     }
// }

// // 9. Delete Room
// async function deleteRoom(roomNo) {
//     const room = globalRooms.find(r => r.room_no === roomNo);
    
//     if (room && room.occupancy_count > 0) {
//         alert(`Cannot delete Room ${roomNo} because it still has ${room.occupancy_count} student(s) inside. Move them out first!`);
//         return;
//     }
    
//     if (confirm(`Are you sure you want to delete Room ${roomNo}? This cannot be undone.`)) {
//         try {
//             const response = await fetch('http://localhost:5000/api/rooms/delete-room', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({ room_no: roomNo })
//             });

//             if (response.ok) {
//                 fetchRooms(); // Refresh table
//             } else {
//                 alert("Error deleting room.");
//             }
//         } catch (err) {
//             alert("Server Error: Cannot delete room.");
//         }
//     }
// }

// // 10. Logout Function
// function logout() {
//     if (confirm("Are you sure you want to log out?")) {
//         localStorage.removeItem('currentUser'); 
//         window.location.href = 'index.html';    
//     }
// }