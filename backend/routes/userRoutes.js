const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// GET request to fetch all users for the table
router.get("/", userController.getUsers);

// POST request to add a new user (Your original route)
router.post("/add", userController.addUser);

// PUT request to update an existing user
router.put("/:id", userController.updateUser);

// DELETE request to remove a user
router.delete("/:id", userController.deleteUser);

module.exports = router;