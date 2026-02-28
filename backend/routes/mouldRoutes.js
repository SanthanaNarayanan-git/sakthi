const express = require('express');
const router = express.Router();
const mouldController = require('../controllers/mouldController');

router.get('/details', mouldController.getMouldDetails);
router.post('/save', mouldController.saveMouldDetails);
// Add this line to mouldRoutes.js
router.get('/bulk-data', mouldController.getBulkData);
module.exports = router;