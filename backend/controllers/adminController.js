// backend/controllers/adminController.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Student = require('../models/Student');
const Bill = require('../models/Bill');
const Room = require('../models/Room');

async function getAllUsers(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const sortField = req.query.sort || 'name';
        const sortDir = req.query.dir === 'desc' ? -1 : 1;

        let query = { role: 'student' };
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { student_id: { $regex: search, $options: 'i' } },
                { room_no: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;
        const students = await Student.find(query)
            .sort({ [sortField]: sortDir })
            .skip(skip)
            .limit(limit);

        const total = await Student.countDocuments(query);

        res.json({
            students,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalStudents: total
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching students" });
    }
}

async function addStudent(req, res) {
    try {
        const { student_id, name, password, room_no, profile } = req.body;

        const room = await Room.findOne({ room_no });
        if (!room) return res.status(404).json({ success: false, message: "Room not found." });
        if (room.occupancy_count >= room.capacity) return res.status(400).json({ success: false, message: "Room is full!" });

        const now = new Date();
        const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const yearMonth = `${phTime.getFullYear()}${(phTime.getMonth() + 1).toString().padStart(2, '0')}`;
        const formattedDate = phTime.toISOString().split('T')[0];
        const monthName = phTime.toLocaleString('default', { month: 'long' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newStudent = new Student({
            student_id,
            name,
            password: hashedPassword,
            due_day: phTime.getDate(),
            room_no,
            status: 'Active',
            profile: profile || { nickname: name.split(' ')[0], contact: "" }
        });
        const savedStudent = await newStudent.save();

        room.occupancy_count += 1;
        if (room.occupancy_count === room.capacity) room.is_occupied = true;
        await room.save();

        // Use crypto for unique serials — avoids race conditions from countDocuments
        const getSuffix = () => crypto.randomBytes(2).toString('hex').toUpperCase();
        const rentSerial = `R-${yearMonth}-${student_id}-${getSuffix()}`;
        const elecSerial = `E-${yearMonth}-${student_id}-${getSuffix()}`;

        await Bill.insertMany([
            {
                student: savedStudent._id,
                student_id: savedStudent.student_id,
                bill_id: rentSerial,
                category: 'Rent',
                amount: room.base_price,
                month: monthName,
                due_date: formattedDate,
                status: 'unpaid'
            },
            {
                student: savedStudent._id,
                student_id: savedStudent.student_id,
                bill_id: elecSerial,
                category: 'Electricity',
                amount: 300,
                month: monthName,
                due_date: formattedDate,
                status: 'unpaid'
            }
        ]);

        res.json({ success: true, message: "Student and bills created successfully!" });
    } catch (error) {
        console.error("Add student error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function deleteStudent(req, res) {
    try {
        const { student_id } = req.body;
        const student = await Student.findOne({ student_id });

        if (!student) return res.status(404).json({ success: false, message: "Student not found." });

        const roomNo = student.room_no;
        await Student.findByIdAndDelete(student._id);
        await Bill.deleteMany({ student: student._id });

        if (roomNo) {
            const room = await Room.findOne({ room_no: roomNo });
            if (room) {
                room.occupancy_count = Math.max(0, room.occupancy_count - 1);
                room.is_occupied = false;
                await room.save();
            }
        }

        res.json({ success: true, message: "Student deleted permanently." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function archiveStudent(req, res) {
    try {
        const { student_id } = req.body;
        const student = await Student.findOne({ student_id });

        if (!student) return res.status(404).json({ success: false, message: "Student not found." });

        const roomNo = student.room_no;

        // ✅ Use findOneAndUpdate + $unset to bypass the required validator
        await Student.findOneAndUpdate(
            { student_id },
            { status: 'Archived', $unset: { room_no: "" } },
            { returnDocument: 'after', runValidators: false }
        );

        if (roomNo) {
            const room = await Room.findOne({ room_no: roomNo });
            if (room) {
                room.occupancy_count = Math.max(0, room.occupancy_count - 1);
                room.is_occupied = room.occupancy_count >= room.capacity;
                await room.save();
            }
        }

        res.json({ success: true, message: "Student archived." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function updateStudent(req, res) {
    const { student_id, name, room_no, profile, password } = req.body;
    try {
        const student = await Student.findOne({ student_id });
        if (!student) return res.status(404).json({ success: false, message: "Student not found." });

        const oldRoom = student.room_no;
        const newRoom = room_no;
        const roomChanged = oldRoom !== newRoom;

        // ── Handle room transfer ──
        if (roomChanged) {
            // Decrement old room
            if (oldRoom) {
                const prevRoom = await Room.findOne({ room_no: oldRoom });
                if (prevRoom) {
                    prevRoom.occupancy_count = Math.max(0, prevRoom.occupancy_count - 1);
                    prevRoom.is_occupied = prevRoom.occupancy_count >= prevRoom.capacity;
                    await prevRoom.save();
                }
            }

            // Increment new room — but check capacity first
            if (newRoom) {
                const nextRoom = await Room.findOne({ room_no: newRoom });
                if (!nextRoom) return res.status(404).json({ success: false, message: `Room ${newRoom} not found.` });
                if (nextRoom.occupancy_count >= nextRoom.capacity) {
                    return res.status(400).json({ success: false, message: `Room ${newRoom} is already full!` });
                }
                nextRoom.occupancy_count += 1;
                nextRoom.is_occupied = nextRoom.occupancy_count >= nextRoom.capacity;
                await nextRoom.save();
            }
        }

        // ── Build update payload ──
        const updateData = { name, room_no, profile };
        if (password && password.trim() !== '') {
            updateData.password = await bcrypt.hash(password.trim(), 10);
        }

        await Student.findOneAndUpdate({ student_id }, updateData, { returnDocument: 'after', runValidators: false });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getDashboardStats(req, res) {
    try {
        const now = new Date();
        const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const today = phTime.toISOString().split('T')[0];

        const revenueByStatus = await Bill.aggregate([
            {
                $project: {
                    amount: 1, status: 1, due_date: 1,
                    currentStatus: {
                        $cond: {
                            if: { $and: [
                                { $ne: ["$status", "paid"] },
                                { $ne: ["$status", "pending"] },
                                { $lt: ["$due_date", today] }
                            ]},
                            then: "overdue",
                            else: "$status"
                        }
                    }
                }
            },
            { $group: { _id: "$currentStatus", totalAmount: { $sum: "$amount" }, billCount: { $sum: 1 } } }
        ]);

        const categoryStats = await Bill.aggregate([
            { $group: { _id: "$category", total: { $sum: "$amount" } } }
        ]);

        const studentStats = await Student.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        res.json({ success: true, revenueByStatus, categoryStats, studentStats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function backupData(req, res) {
    try {
        // Fetch all collections — strip passwords from students
        const students = await Student.find().lean().then(list =>
            list.map(({ password, __v, ...s }) => s)
        );
        const rooms = await Room.find().lean().then(list =>
            list.map(({ __v, ...r }) => r)
        );
        const bills = await Bill.find()
            .populate('student', 'name student_id')
            .lean()
            .then(list => list.map(({ __v, ...b }) => b));

        // PH timestamp
        const now    = new Date();
        const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const stamp  = phTime.toISOString().replace('T', ' ').substring(0, 19);
        const fileTs = phTime.toISOString().substring(0, 10); // 2026-04-28

        const backup = {
            meta: {
                system:       'BoardingMS — Boarding House Management System',
                generated_at:  stamp + ' (PH Time)',
                generated_by: 'Admin Backup',
                counts: {
                    students: students.length,
                    rooms:    rooms.length,
                    bills:    bills.length,
                }
            },
            students,
            rooms,
            bills,
        };

        const filename = `BoardingMS_Backup_${fileTs}.json`;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(JSON.stringify(backup, null, 2));

    } catch (error) {
        console.error("Backup error:", error);
        res.status(500).json({ success: false, message: "Backup failed." });
    }
}

async function exportCSV(req, res) {
    try {
        const type = req.query.type || 'students'; // ?type=students|rooms|bills

        const now    = new Date();
        const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const fileTs = phTime.toISOString().substring(0, 10);

        let csv = '';
        let filename = '';

        if (type === 'students') {
            const students = await Student.find().lean();
            filename = `BoardingMS_Students_${fileTs}.csv`;
            csv = 'Student ID,Name,Room,Course,Year Level,Contact,Status,Due Day\n';
            csv += students.map(s =>
                [
                    s.student_id,
                    `"${s.name}"`,
                    s.room_no || '',
                    s.profile?.course || '',
                    s.profile?.year_level || '',
                    s.profile?.contact || '',
                    s.status,
                    s.due_day || ''
                ].join(',')
            ).join('\n');

        } else if (type === 'rooms') {
            const rooms = await Room.find().lean();
            filename = `BoardingMS_Rooms_${fileTs}.csv`;
            csv = 'Room No,Floor,Type,Capacity,Occupancy,Monthly Rate,Status\n';
            csv += rooms.map(r =>
                [
                    r.room_no,
                    `"${r.floor}"`,
                    `"${r.type}"`,
                    r.capacity,
                    r.occupancy_count,
                    r.base_price,
                    r.is_occupied ? 'Occupied' : 'Vacant'
                ].join(',')
            ).join('\n');

        } else if (type === 'bills') {
            const bills = await Bill.find()
                .populate('student', 'name student_id')
                .lean();
            filename = `BoardingMS_Bills_${fileTs}.csv`;
            csv = 'Bill ID,Student ID,Student Name,Category,Month,Amount,Due Date,Status\n';
            csv += bills.map(b =>
                [
                    b.bill_id,
                    b.student_id,
                    `"${b.student?.name || 'Unknown'}"`,
                    b.category,
                    b.month,
                    b.amount,
                    b.due_date,
                    b.status
                ].join(',')
            ).join('\n');
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);

    } catch (error) {
        console.error("CSV export error:", error);
        res.status(500).json({ success: false, message: "Export failed." });
    }
}

async function syncRoomOccupancy(req, res) {
    try {
        const rooms = await Room.find().lean();
        let synced = 0;

        for (const room of rooms) {
            // Count active students actually assigned to this room
            const count = await Student.countDocuments({
                room_no: room.room_no,
                status: 'Active'
            });

            await Room.findOneAndUpdate(
                { room_no: room.room_no },
                {
                    occupancy_count: count,
                    is_occupied: count >= room.capacity
                }
            );
            synced++;
        }

        res.json({ success: true, message: `Synced ${synced} rooms.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = { getAllUsers, addStudent, deleteStudent, archiveStudent, updateStudent, getDashboardStats, backupData, exportCSV, syncRoomOccupancy };