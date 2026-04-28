// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { getAllUsers, addStudent, deleteStudent, archiveStudent, updateStudent, getDashboardStats, backupData, exportCSV } = require('../controllers/adminController');

router.get('/all-users', getAllUsers);
router.post('/add-student', addStudent);
router.post('/delete-student', deleteStudent);
router.post('/archive-student', archiveStudent);
router.post('/update-student', updateStudent);
router.get('/dashboard-stats', getDashboardStats);
router.get('/backup',     backupData);
router.get('/export-csv', exportCSV);

module.exports = router;