// backend/models/Bill.js
const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
    // Connects the bill to the specific Student document's _id
    student:   { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    bill_id:   { type: String, required: true, unique: true },
    category:  { type: String, enum: ['Rent', 'Electricity', 'Water'], required: true },
    amount:    { type: Number, required: true },
    due_date:  { type: String, required: true },
    status:    { type: String, enum: ['unpaid', 'pending', 'paid'], default: 'unpaid' },

    // ── Stamped automatically by updateBillStatus when status → 'paid' ──
    // Cleared back to null if a bill is ever reverted from paid.
    paid_date: { type: Date, default: null },

}, { timestamps: true });

module.exports = mongoose.model('Bill', billSchema);



// const mongoose = require('mongoose');

// const billSchema = new mongoose.Schema({
//     // This connects the bill to the specific Student document
//     student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
//     bill_id: { type: String, required: true, unique: true },
//     category: { 
//         type: String, 
//         enum: ['Rent', 'Electricity', 'Water'], 
//         required: true 
//     },
//     amount: { type: Number, required: true },
//     due_date: { type: String, required: true },
//     status: { 
//         type: String, 
//         enum: ['unpaid', 'pending', 'paid'], 
//         default: 'unpaid' 
//     }
// }, { timestamps: true });

// module.exports = mongoose.model('Bill', billSchema);

// const mongoose = require('mongoose');

// const billSchema = new mongoose.Schema({
//     // This connects the bill to the specific Student document's _id
//     student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
//     bill_id: { type: String, required: true, unique: true },
//     category: { 
//         type: String, 
//         enum: ['Rent', 'Electricity', 'Water'], 
//         required: true 
//     },
//     amount: { type: Number, required: true },
//     due_date: { type: String, required: true },
//     status: { 
//         type: String, 
//         enum: ['unpaid', 'pending', 'paid'], 
//         default: 'unpaid' 
//     }
// }, { timestamps: true });

// module.exports = mongoose.model('Bill', billSchema);

