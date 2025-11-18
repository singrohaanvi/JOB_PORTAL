import express from "express";
import {
    createJob,
    getJobs,
    getJobById,
    updateJob,
    deleteJob,
    toggleCloseJob,
    getJobsEmployer
} from "../controllers/jobController.js";

import { protect } from "../middleware/authMiddleware.js";
import { cache } from "../middleware/cacheMiddleware.js";

const router = express.Router();

// Public + Cached
router.route("/")
  .post(protect, createJob)
  .get(cache("jobs"), getJobs);

// Employer-only jobs
router.route("/get-jobs-employer")
  .get(protect, getJobsEmployer);

// Single job - cached
router.route("/:id")
  .get(cache("job"), getJobById)
  .put(protect, updateJob)
  .delete(protect, deleteJob);

// Open / Close job
router.put("/:id/toggle-close", protect, toggleCloseJob);

export default router;
