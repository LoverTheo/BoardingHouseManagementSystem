// backend/controllers/studentController.js
const Student = require('../models/Student');
const Bill = require('../models/Bill');

async function getStudent(req, res) {
    try {
        const user = await Student.findOne({ student_id: req.params.id }).lean();
        if (!user) return res.status(404).json({ message: "Student not found." });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Error fetching student." });
    }
}

// Separate endpoint so bills are fetched on demand, not at login
async function getMyBills(req, res) {
    try {
        const user = await Student.findOne({ student_id: req.params.id });
        if (!user) return res.status(404).json({ message: "Student not found." });

        const bills = await Bill.find({ student: user._id }).sort({ createdAt: -1 });
        res.json(bills);
    } catch (error) {
        res.status(500).json({ message: "Error fetching bills." });
    }
}

async function requestPay(req, res) {
    const { bill_id } = req.body;
    try {
        const updated = await Bill.findOneAndUpdate(
            { bill_id },
            { status: "pending" },
            { returnDocument: 'after', runValidators: false }
        );
        if (!updated) return res.status(404).json({ success: false, message: "Bill not found." });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = { getStudent, getMyBills, requestPay };