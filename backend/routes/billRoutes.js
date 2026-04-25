// backend/routes/billRoutes.js
const express = require('express');
const router = express.Router();
const { getAllBills, addBill, updateBill, updateBillStatus, deleteBill, generateMonthly } = require('../controllers/billController');

router.get('/all-bills', getAllBills);
router.post('/add-bill', addBill);
router.post('/update-bill', updateBill);
router.post('/update-bill-status', updateBillStatus);
router.post('/delete-bill', deleteBill);
router.post('/generate-monthly', generateMonthly);

module.exports = router;