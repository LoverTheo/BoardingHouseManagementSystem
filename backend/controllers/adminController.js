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
        student.status = 'Archived';
        student.room_no = null;
        await student.save();

        if (roomNo) {
            const room = await Room.findOne({ room_no: roomNo });
            if (room) {
                room.occupancy_count = Math.max(0, room.occupancy_count - 1);
                room.is_occupied = false;
                await room.save();
            }
        }

        res.json({ success: true, message: "Student archived." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function updateStudent(req, res) {
    const { student_id, name, room_no, profile } = req.body;
    try {
        const updated = await Student.findOneAndUpdate(
            { student_id },
            { name, room_no, profile },
            { new: true }
        );
        if (!updated) return res.status(404).json({ success: false, message: "Student not found." });
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

module.exports = { getAllUsers, addStudent, deleteStudent, archiveStudent, updateStudent, getDashboardStats };