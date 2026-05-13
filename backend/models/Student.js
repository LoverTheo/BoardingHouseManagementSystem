// const mongoose = require('mongoose');

// const studentSchema = new mongoose.Schema({
//     student_id: { type: String, required: true, unique: true },
//     name: { type: String, required: true },
//     password: { type: String, required: true },
//     role: { type: String, default: 'student' },
//     due_day: { type: Number, default: 1 },
//     room_no: { type: String, required: true },
//     profile: {
//         nickname: { type: String },
//         contact: { type: String, default: "" },
//         course: { type: String },      // 👈 ADD THIS
//         year_level: { type: String }   // 👈 ADD THIS
//     }
// }, { timestamps: true });

// module.exports = mongoose.model('Student', studentSchema); 

const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    student_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'student' },
    due_day: { type: Number, default: 1 },
    status: { 
        type: String, 
        enum: ['Active', 'Archived', 'Inactive'], 
        default: 'Active' 
    },
    // This is our link to the Room model
    // room_no: { type: String, required: true },
    room_no: { type: String, required: false, default: null },
    profile: {
        nickname: { type: String },
        contact: { type: String, default: "" },
        course: { type: String },      // Added to fix N/A
        year_level: { type: String }   // Added to fix N/A
    }
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);