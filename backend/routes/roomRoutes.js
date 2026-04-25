const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

// Define the endpoints and link them to the controller
router.get('/all-rooms', roomController.getAllRooms);
router.post('/add-room', roomController.addRoom);
router.post('/update-room', roomController.updateRoom);
router.post('/delete-room', roomController.deleteRoom);

module.exports = router;