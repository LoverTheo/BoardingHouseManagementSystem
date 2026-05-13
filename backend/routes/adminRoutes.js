// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { getAllUsers, addStudent, deleteStudent, archiveStudent, updateStudent, getDashboardStats, backupData, exportCSV, syncRoomOccupancy } = require('../controllers/adminController');

router.get('/all-users', getAllUsers);
router.post('/add-student', addStudent);
router.post('/delete-student', deleteStudent);
router.post('/archive-student', archiveStudent);
router.post('/update-student', updateStudent);
router.get('/dashboard-stats', getDashboardStats);
router.get('/backup',     backupData);
router.get('/export-csv', exportCSV);
router.post('/sync-rooms', syncRoomOccupancy);

module.exports = router;