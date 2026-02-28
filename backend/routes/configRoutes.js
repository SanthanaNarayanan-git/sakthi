const express = require("express");
const router = express.Router();
const configController = require("../controllers/configController");

// Fetch the configuration for a specific form
router.get("/:type/master", configController.getMasterConfig);

// Save/Update the configuration for a specific form
router.post("/:type/master", configController.saveMasterConfig);

module.exports = router;