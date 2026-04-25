// backend/routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const { getStudent, getMyBills, requestPay } = require('../controllers/studentController');

router.get('/get-student/:id', getStudent);
router.get('/get-bills/:id', getMyBills);
router.post('/request-pay', requestPay);

module.exports = router;