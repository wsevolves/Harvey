// routes/prayerRoutes.js
const express = require("express");
const Prayer = require("../models/Prayer");
const router = express.Router();

// Get all prayers
router.get("/get", async (req, res) => {
  try {
    const prayers = await Prayer.find();
    res.json(prayers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a new prayer
router.post("/add", async (req, res) => {
  const prayer = new Prayer(req.body);
  try {
    const newPrayer = await prayer.save();
    res.status(201).json(newPrayer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update a prayer
// Update a prayer entry by date
router.put("/update", async (req, res) => {
    try {
      const { month, year, date, updatedTimes } = req.body;
      const updatedPrayer = await Prayer.findOneAndUpdate(
        { month, year, date }, // Find by date
        { updatedTimes }, // Update times
        { new: true }
      );
  
      if (!updatedPrayer) return res.status(404).json({ message: "Prayer entry not found" });
  
      res.json(updatedPrayer);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });
  

// Delete a prayer
router.delete("/:id", async (req, res) => {
  try {
    const deletedPrayer = await Prayer.findByIdAndDelete(req.params.id);
    if (!deletedPrayer) return res.status(404).json({ message: "Prayer not found" });
    res.json({ message: "Prayer deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;
