const express = require('express');
const router = express.Router();
const controller = require('../controllers/disaMachineChecklistController');

// Operator & PDF Routes
router.get('/details', controller.getChecklistDetails);
router.get('/monthly-report', controller.getMonthlyReport); 
router.post('/report-nc', controller.saveNCReport);
router.post('/submit-batch', controller.saveBatchChecklist);

// HOD Dashboard Routes
router.get('/hod/:name', controller.getReportsByHOD);
router.post('/sign', controller.signReportByHOD);

// 🔥 ADD THIS MISSING ROUTE FOR THE ADMIN PDF EXPORT:
router.get('/bulk-data', controller.getBulkData);

module.exports = router;