// const mongoose = require('mongoose');

// const roomSchema = new mongoose.Schema({
//     room_no: { type: String, required: true, unique: true },
//     type: { 
//         type: String, 
//         enum: ['Small Room', 'Big Room'], 
//         required: true 
//     },
//     base_price: { type: Number, required: true },
//     is_occupied: { type: Boolean, default: false }
// });

// module.exports = mongoose.model('Room', roomSchema);

// const mongoose = require('mongoose');

// const roomSchema = new mongoose.Schema({
//     room_no: { type: String, required: true, unique: true },
//     floor: { type: String, required: true }, // Added this back!
//     type: { 
//         type: String, 
//         enum: ['Small Room', 'Big Room'], 
//         required: true 
//     },
//     base_price: { type: Number, required: true },
//     is_occupied: { type: Boolean, default: false }
// });

// module.exports = mongoose.model('Room', roomSchema);

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    room_no: { type: String, required: true, unique: true },
    floor: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['Small Solo', 'Small Duo', 'Big Solo', 'Big Duo', 'Big Trio'], 
        required: true 
    },
    capacity: { type: Number, required: true }, // 1, 2, or 3 based on type
    base_price: { type: Number, required: true }, // The price you listed
    occupancy_count: { type: Number, default: 0 },
    is_occupied: { type: Boolean, default: false }
});

module.exports = mongoose.model('Room', roomSchema);