// backend/controllers/billController.js
const crypto = require('crypto');
const Bill    = require('../models/Bill');
const Room    = require('../models/Room');
const Student = require('../models/Student');

// ─────────────────────────────────────────────
// GET  /api/bills/all-bills
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// POST /api/bills/add-bill
// ─────────────────────────────────────────────
async function addBill(req, res) {
    try {
        const { student_id, category, amount, month, due_date } = req.body;
        const student = await Student.findOne({ student_id });
        if (!student) return res.status(404).json({ success: false, message: "Student not found." });

        const now       = new Date();
        const phTime    = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const yearMonth = `${phTime.getFullYear()}${(phTime.getMonth() + 1).toString().padStart(2, '0')}`;
        const prefix    = category === 'Rent' ? 'R' : category === 'Electricity' ? 'E' : 'X';
        const bill_id   = `${prefix}-${yearMonth}-${student_id}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

        const newBill = new Bill({
            student:   student._id,
            bill_id,
            category,
            amount,
            due_date,
            status: 'unpaid',
        });
        await newBill.save();

        res.json({ success: true, message: "Bill added successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// ─────────────────────────────────────────────
// POST /api/bills/update-bill  (amount / due_date edits)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// POST /api/bills/update-bill-status
// Stamps paid_date when marking paid; clears it if reverting.
// ─────────────────────────────────────────────
async function updateBillStatus(req, res) {
    const { bill_id, status } = req.body;
    try {
        const updateData = { status };

        // Record the date when a bill is marked paid
        if (status === 'paid') {
            const now    = new Date();
            const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
            updateData.paid_date = phTime.toISOString().split('T')[0]; // e.g. "2026-05-13"
        } else {
            updateData.paid_date = null; // clear it if status changes back
        }

        const updated = await Bill.findOneAndUpdate(
            { bill_id },
            updateData,
            { returnDocument: 'after' }
        );
        if (!updated) return res.status(404).json({ success: false, message: "Bill not found." });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

// ─────────────────────────────────────────────
// POST /api/bills/delete-bill
// ─────────────────────────────────────────────
async function deleteBill(req, res) {
    try {
        const deleted = await Bill.findOneAndDelete({ bill_id: req.body.bill_id });
        if (!deleted) return res.status(404).json({ success: false, message: "Bill not found." });
        res.json({ success: true, message: "Bill deleted." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// ─────────────────────────────────────────────
// POST /api/bills/generate-monthly
// ─────────────────────────────────────────────
async function generateMonthly(req, res) {
    const { month, year } = req.body;
    try {
        const allStudents = await Student.find({ status: 'Active' });
        const monthName   = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
        const yearMonth   = `${year}${String(month).padStart(2, '0')}`;
        const billsToInsert = [];

        for (const student of allStudents) {
            const exists = await Bill.findOne({ student: student._id, category: 'Rent', due_date: { $regex: `^${year}-${String(month).padStart(2,'0')}` } });
            if (exists) continue;

            const room       = await Room.findOne({ room_no: student.room_no });
            const rentAmount = room ? room.base_price : 3000;
            const dueDate    = `${year}-${String(month).padStart(2, '0')}-${String(student.due_day).padStart(2, '0')}`;

            billsToInsert.push(
                {
                    student:   student._id,
                    bill_id:   `R-${yearMonth}-${student.student_id}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
                    category:  'Rent',
                    amount:    rentAmount,
                    due_date:  dueDate,
                    status:    'unpaid',
                },
                {
                    student:   student._id,
                    bill_id:   `E-${yearMonth}-${student.student_id}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
                    category:  'Electricity',
                    amount:    300,
                    due_date:  dueDate,
                    status:    'unpaid',
                }
            );
        }

        if (billsToInsert.length > 0) await Bill.insertMany(billsToInsert);
        res.json({ success: true, count: billsToInsert.length / 2 });
    } catch (error) {
        res.status(500).json({ success: false, error: "Billing generation failed" });
    }
}

module.exports = { getAllBills, addBill, updateBill, updateBillStatus, deleteBill, generateMonthly };