const express = require("express");
const Category = require("../models/Category");

function categoryRouter(io) {
  const router = express.Router();

  router.get("/get", async (req, res) => {
    try {
      const categories = await Category.find();
      res.status(200).json(categories);
    } catch (err) {
      console.error("Error fetching categories:", err);
      res.status(500).json({ message: "Server error. Try again later." });
    }
  });

  router.post("/add", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Category name is required" });

      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({ message: "Category already exists" });
      }

      const newCategory = new Category({ name });
      const savedCategory = await newCategory.save();

      io.emit("categoryAdded", savedCategory);
      res.status(201).json(savedCategory);
    } catch (err) {
      console.error("Error adding category:", err);
      res.status(500).json({ message: "Failed to add category" });
    }
  });

  router.put("/update/:id", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Category name is required" });

      const updatedCategory = await Category.findByIdAndUpdate(req.params.id, { name }, { new: true });
      if (!updatedCategory) return res.status(404).json({ message: "Category not found" });

      io.emit("categoryUpdated", updatedCategory);
      res.status(200).json(updatedCategory);
    } catch (err) {
      console.error("Error updating category:", err);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  router.delete("/delete/:id", async (req, res) => {
    try {
      const deletedCategory = await Category.findByIdAndDelete(req.params.id);
      if (!deletedCategory) return res.status(404).json({ message: "Category not found" });

      io.emit("categoryDeleted", req.params.id);
      res.status(200).json({ message: "Category deleted successfully" });
    } catch (err) {
      console.error("Error deleting category:", err);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  return router;
}

module.exports = categoryRouter;