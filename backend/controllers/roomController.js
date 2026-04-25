// backend/controllers/roomController.js
const Room = require('../models/Room');

exports.getAllRooms = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const sortField = req.query.sort || 'room_no';
        const sortDir = req.query.dir === 'desc' ? -1 : 1;

        let query = {};
        if (search) {
            query.$or = [
                { room_no: { $regex: search, $options: 'i' } },
                { type: { $regex: search, $options: 'i' } },
                // floor is a Number — cast to string before regex matching
                { $expr: { $regexMatch: { input: { $toString: "$floor" }, regex: search, options: "i" } } }
            ];
        }

        const skip = (page - 1) * limit;
        const rooms = await Room.find(query)
            .sort({ [sortField]: sortDir })
            .collation({ locale: "en", numericOrdering: true })
            .skip(skip)
            .limit(limit);

        const total = await Room.countDocuments(query);

        res.json({
            rooms,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalRooms: total
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching rooms" });
    }
};

exports.addRoom = async (req, res) => {
    try {
        const newRoom = new Room(req.body);
        await newRoom.save();
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, message: "Room number already exists." });
    }
};

exports.updateRoom = async (req, res) => {
    try {
        const { room_no, ...updateData } = req.body;
        const updated = await Room.findOneAndUpdate({ room_no }, updateData, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: "Room not found." });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteRoom = async (req, res) => {
    try {
        const deleted = await Room.findOneAndDelete({ room_no: req.body.room_no });
        if (!deleted) return res.status(404).json({ success: false, message: "Room not found." });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};