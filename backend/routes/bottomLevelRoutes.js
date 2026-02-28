const express = require('express');
const router = express.Router();
const controller = require('../controllers/bottomLevelController');

// ==========================================
//   1. OPERATOR & MONTHLY PDF ROUTES
// ==========================================
router.get('/details', controller.getChecklistDetails);
router.get('/monthly-report', controller.getMonthlyReport);
router.post('/report-nc', controller.saveNCReport);
router.post('/submit-batch', controller.saveBatchChecklist);

// ==========================================
//   2. ADMIN DASHBOARD (BULK PDF EXPORT)
// ==========================================
router.get('/bulk-data', controller.getBulkData);

// ==========================================
//   3. SUPERVISOR DASHBOARD ROUTES
// ==========================================
// Daily Audit Signoffs
router.get('/supervisor/:name', controller.getReportsBySupervisor);
router.post('/sign-supervisor', controller.signReportBySupervisor);

// NCR Signoffs
router.get('/supervisor-ncr/:name', controller.getNcrReportsBySupervisor);
router.post('/sign-ncr', controller.signNcrBySupervisor);

// ==========================================
//   4. HOF DASHBOARD ROUTES
// ==========================================
router.get('/hof/:name', controller.getReportsByHOF);
router.post('/sign-hof', controller.signReportByHOF);

module.exports = router;