// applicationController.js
import redisClient from "../utils/redisClient.js";

// --------------------- APPLY TO JOB ------------------------
export const applyToJob = async (req, res) => {
    try {
        const jobId = req.params.jobId;

        const application = await prisma.application.create({
            data: {
                jobId,
                userId: req.user.id,
            },
        });

        // 🔵 CACHE INVALIDATION
        await redisClient.del("applications:all");
        await redisClient.del(`applications:user:${req.user.id}`);
        await redisClient.del(`applications:job:${jobId}`);

        res.status(201).json(application);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --------------------- MY APPLICATIONS ------------------------
export const getMyApplications = async (req, res) => {
    try {
        const cacheKey = `applications:user:${req.user.id}`;
        const cached = await redisClient.get(cacheKey);

        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const applications = await prisma.application.findMany({
            where: { userId: req.user.id },
        });

        await redisClient.set(cacheKey, JSON.stringify(applications), { EX: 300 });

        res.json(applications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --------------------- APPLICANTS FOR A JOB ------------------------
export const getApplicantsForJob = async (req, res) => {
    try {
        const jobId = req.params.jobId;

        const cacheKey = `applications:job:${jobId}`;
        const cached = await redisClient.get(cacheKey);

        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const applicants = await prisma.application.findMany({
            where: { jobId },
            include: { user: true },
        });

        await redisClient.set(cacheKey, JSON.stringify(applicants), { EX: 300 });

        res.json(applicants);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --------------------- GET APPLICATION BY ID ------------------------
export const getApplicationById = async (req, res) => {
    try {
        const cacheKey = `applications:${req.params.id}`;
        const cached = await redisClient.get(cacheKey);

        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const application = await prisma.application.findUnique({
            where: { id: req.params.id },
        });

        await redisClient.set(cacheKey, JSON.stringify(application), { EX: 300 });

        res.json(application);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --------------------- UPDATE STATUS ------------------------
export const updateStatus = async (req, res) => {
    try {
        const applicationId = req.params.id;

        const updated = await prisma.application.update({
            where: { id: applicationId },
            data: { status: req.body.status },
        });

        // 🔴 CACHE INVALIDATION
        await redisClient.del("applications:all");
        await redisClient.del(`applications:${applicationId}`);
        await redisClient.del(`applications:user:${updated.userId}`);
        await redisClient.del(`applications:job:${updated.jobId}`);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
