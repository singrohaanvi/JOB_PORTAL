import redisClient from "../utils/redisClient.js";

export const cache = (keyPrefix) => {
  return async (req, res, next) => {
    const key = keyPrefix + ":" + (req.params.id || "all");

    const cachedData = await redisClient.get(key);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    res.sendResponse = res.json;
    res.json = async (body) => {
      await redisClient.setEx(key, 600, JSON.stringify(body)); // 10 min
      res.sendResponse(body);
    };

    next();
  };
};
