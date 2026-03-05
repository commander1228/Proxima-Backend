import { FeedService } from "../services/FeedService";
import { withAuth } from "../utils/handler";

const feedService = new FeedService();

export const getFeed = withAuth(async (req, res) => {
  try {
    const user = req.user;

    let before: Date | undefined;
    if (req.query.before) {
      const parsed = new Date(req.query.before as string);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid 'before' date" });
      }
      before = parsed;
    }

    const result = await feedService.getFeedForUser(user.id, before);
    return res.status(200).json(result);
  } catch (error: any) {
    // Distinguish "no location" from real server errors
    if (
      error.message?.includes("User location not found") ||
      error.message?.includes("location not found")
    ) {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message });
  }
});