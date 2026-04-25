// backend/controllers/authController.js
const bcrypt = require('bcrypt');
const Student = require('../models/Student');
const Room = require('../models/Room');

async function login(req, res) {
    const { student_id, password } = req.body;
    try {
        const user = await Student.findOne({ student_id });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: "Invalid ID or Password" });
        }

        // Only fetch room info at login — bills are fetched on demand via /api/student/:id/bills
        const roomInfo = await Room.findOne({ room_no: user.room_no });

        const userData = user.toObject();
        delete userData.password;
        userData.room_info = roomInfo;

        res.json({ success: true, user: userData });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

module.exports = { login };