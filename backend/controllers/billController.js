// backend/controllers/billController.js
const crypto = require('crypto');
const Bill = require('../models/Bill');
const Room = require('../models/Room');
const Student = require('../models/Student');

async function getAllBills(req, res) {
    try {
        const bills = await Bill.find()
            .populate('student', 'name room_no')
            .sort({ createdAt: -1 });
        res.json(bills);
    } catch (error) {
        res.status(500).json({ message: "Error fetching bills", error: error.message });
    }
}

async function addBill(req, res) {
    try {
        const { student_id, category, amount, month, due_date } = req.body;
        const student = await Student.findOne({ student_id });
        if (!student) return res.status(404).json({ success: false, message: "Student not found." });

        const now = new Date();
        const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const yearMonth = `${phTime.getFullYear()}${(phTime.getMonth() + 1).toString().padStart(2, '0')}`;
        const prefix = category === 'Rent' ? 'R' : category === 'Electricity' ? 'E' : 'X';
        const bill_id = `${prefix}-${yearMonth}-${student_id}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

        const newBill = new Bill({
            student: student._id,
            student_id,
            bill_id,
            category,
            amount,
            month,
            due_date,
            status: 'unpaid'
        });
        await newBill.save();

        res.json({ success: true, message: "Bill added successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function updateBill(req, res) {
    const { bill_id, amount, due_date } = req.body;
    try {
        const updated = await Bill.findOneAndUpdate(
            { bill_id },
            { amount, due_date },
            { returnDocument: 'after', runValidators: false }
        );
        if (!updated) return res.status(404).json({ success: false, message: "Bill not found." });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function updateBillStatus(req, res) {
    const { bill_id, status } = req.body;
    try {
        const updated = await Bill.findOneAndUpdate(
            { bill_id },
            { status },
            { returnDocument: 'after', runValidators: false }
        );
        if (!updated) return res.status(404).json({ success: false, message: "Bill not found." });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function deleteBill(req, res) {
    try {
        const deleted = await Bill.findOneAndDelete({ bill_id: req.body.bill_id });
        if (!deleted) return res.status(404).json({ success: false, message: "Bill not found." });
        res.json({ success: true, message: "Bill deleted." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function generateMonthly(req, res) {
    const { month, year } = req.body;
    try {
        const allStudents = await Student.find({ status: 'Active' });
        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
        const yearMonth = `${year}${String(month).padStart(2, '0')}`;
        const billsToInsert = [];

        for (const student of allStudents) {
            const exists = await Bill.findOne({ student: student._id, category: "Rent", month: monthName });
            if (exists) continue;

            const room = await Room.findOne({ room_no: student.room_no });
            const rentAmount = room ? room.base_price : 3000;
            const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(student.due_day).padStart(2, '0')}`;

            // Each student gets unique serials via crypto — no race condition
            billsToInsert.push(
                {
                    student: student._id,
                    student_id: student.student_id,
                    bill_id: `R-${yearMonth}-${student.student_id}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
                    category: "Rent",
                    amount: rentAmount,
                    month: monthName,
                    due_date: dueDate,
                    status: "unpaid"
                },
                {
                    student: student._id,
                    student_id: student.student_id,
                    bill_id: `E-${yearMonth}-${student.student_id}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
                    category: "Electricity",
                    amount: 300,
                    month: monthName,
                    due_date: dueDate,
                    status: "unpaid"
                }
            );
        }

        // One bulk insert after the loop instead of inserting inside it
        if (billsToInsert.length > 0) await Bill.insertMany(billsToInsert);

        res.json({ success: true, count: billsToInsert.length / 2 });
    } catch (error) {
        res.status(500).json({ success: false, error: "Billing generation failed" });
    }
}

module.exports = { getAllBills, addBill, updateBill, updateBillStatus, deleteBill, generateMonthly };