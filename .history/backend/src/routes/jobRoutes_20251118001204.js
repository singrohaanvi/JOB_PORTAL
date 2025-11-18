import express from "express";
import {
    createJob,
    getJobs,
    getJobById,
    updateJob,
    deleteJob,
    toggleCloseJob,
    getJobsEmployer,
} from "../controllers/jobController.js";
import { protect } from "../middleware/authMiddleware.js";
import { cache } from "../middleware/cacheMiddleware.js";   // ⬅️ added

const router = express.Router();

// Cache all jobs (public)
router.route("/")
  .post(protect, createJob)
  .get(cache("jobs"), getJobs);  // ⬅️ added cache

// Employer listing (no caching, private)
router.route("/get-jobs-employer")
  .get(protect, getJobsEmployer);

// Cache single job
router.route("/:id")
  .get(cache("job"), getJobById)   // ⬅️ cache added
  .put(protect, updateJob)
  .delete(protect, deleteJob);

// Close/open job → must clear cache
router.put("/:id/toggle-close", protect, toggleCloseJob);

export default router;
