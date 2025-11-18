import Job from "../models/Job.js";
import User from "../models/User.js";
import Application from "../models/Application.js";
import SavedJob from "../models/SavedJob.js";
import redisClient from "../utils/redisClient.js";

// -----------------------------
// CREATE JOB
// -----------------------------
export const createJob = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employer can post jobs" });
        }

        const job = await Job.create({ ...req.body, company: req.user._id });

        // ❗ CACHE INVALIDATION
        await redisClient.del("jobs:all");

        // 🔵 SEND LIVE UPDATE USING WEBSOCKET
        global.io.emit("jobCreated", {
            message: "A new job was posted",
            job
        });

        res.status(200).json(job);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// -----------------------------
// GET ALL JOBS
// -----------------------------
export const getJobs = async (req, res) => {
    const cached = await redisClient.get("jobs:all");
    if (cached) {
        return res.json(JSON.parse(cached));
    }

    const {
        keyword,
        location,
        category,
        type,
        minSalary,
        maxSalary,
        userId,
    } = req.query;

    const query = {
        isClosed: false,
        ...(keyword && { title: { $regex: keyword, $options: "i" } }),
        ...(location && { location: { $regex: location, $options: "i" } }),
        ...(category && { category }),
        ...(type && { type }),
    };

    if (minSalary || maxSalary) {
        query.$and = [];

        if (minSalary) {
            query.$and.push({ salaryMax: { $gte: Number(minSalary) } });
        }

        if (maxSalary) {
            query.$and.push({ salaryMin: { $lte: Number(maxSalary) } });
        }

        if (query.$and.length === 0) delete query.$and;
    }

    try {
        const jobs = await Job.find(query).populate(
            "company",
            "name companyName companyLogo"
        );

        let savedJobIds = [];
        let appliedJobStatusMap = {};

        if (userId) {
            const savedJobs = await SavedJob.find({ jobseeker: userId }).select("job");
            savedJobIds = savedJobs.map((s) => String(s.job));

            const applications = await Application.find({ applicant: userId }).select("job status");
            applications.forEach((app) => {
                appliedJobStatusMap[String(app.job)] = app.status;
            });
        }

        const jobsWithExtras = jobs.map((job) => {
            const jobIdStr = String(job._id);
            return {
                ...job.toObject(),
                isSaved: savedJobIds.includes(jobIdStr),
                applicationStatus: appliedJobStatusMap[jobIdStr] || null,
            };
        });

        await redisClient.setEx("jobs:all", 600, JSON.stringify(jobsWithExtras));

        res.json(jobsWithExtras);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// -----------------------------
// GET JOB BY ID
// -----------------------------
export const getJobById = async (req, res) => {
    const cached = await redisClient.get(`job:${req.params.id}`);
    if (cached) {
        return res.json(JSON.parse(cached));
    }

    try {
        const { userId } = req.query;

        const job = await Job.findById(req.params.id).populate(
            "company",
            "name companyName companyLogo"
        );

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        let applicationStatus = null;

        if (userId) {
            const application = await Application.findOne({
                job: job._id,
                applicant: userId,
            }).select("status");

            if (application) applicationStatus = application.status;
        }

        const finalJob = { ...job.toObject(), applicationStatus };

        await redisClient.setEx(`job:${req.params.id}`, 600, JSON.stringify(finalJob));

        res.json(finalJob);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// -----------------------------
// GET JOBS POSTED BY EMPLOYER
// -----------------------------
export const getJobsEmployer = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employer can view their jobs" });
        }

        const employerId = req.user._id;

        // CACHE CHECK
        const cached = await redisClient.get(`jobs:employer:${employerId}`);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const jobs = await Job.find({ company: employerId }).populate(
            "company",
            "name companyName companyLogo"
        );

        await redisClient.setEx(
            `jobs:employer:${employerId}`,
            600,
            JSON.stringify(jobs)
        );

        res.json(jobs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// -----------------------------
// UPDATE JOB
// -----------------------------
export const updateJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ message: "Job not Found" });

        if (job.company.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized to update" });
        }

        Object.assign(job, req.body);
        const updated = await job.save();

        await redisClient.del("jobs:all");
        await redisClient.del(`job:${req.params.id}`);
        await redisClient.del(`jobs:employer:${req.user._id}`);

        global.io.emit("jobUpdated", {
            message: "A job was updated",
            job: updated
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// -----------------------------
// DELETE JOB
// -----------------------------
export const deleteJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) return res.status(404).json({ message: "Job not found" });

        if (job.company.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized to delete" });
        }

        await job.deleteOne();

        await redisClient.del("jobs:all");
        await redisClient.del(`job:${req.params.id}`);
        await redisClient.del(`jobs:employer:${req.user._id}`);

        global.io.emit("jobDeleted", {
            message: "A job was deleted",
            jobId: req.params.id
        });

        res.json({ message: "Job deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// -----------------------------
// TOGGLE CLOSE JOB
// -----------------------------
export const toggleCloseJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ message: "Job not found" });

        if (job.company.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }

        job.isClosed = !job.isClosed;
        await job.save();

        await redisClient.del("jobs:all");
        await redisClient.del(`job:${req.params.id}`);
        await redisClient.del(`jobs:employer:${req.user._id}`);

        global.io.emit("jobClosed", {
            message: "Job status changed",
            job
        });

        res.json({ message: "Job marked as closed" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
