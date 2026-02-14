import { PostService } from "../services/PostService";
import { LocationService } from "../services/LocationService";
import { verifyLocationAndUserInRange } from "../utils/locationUtils";
import { withAuth } from "../utils/handler";
import { PostCommentService } from "../services/PostCommentService";

const postService = new PostService();
const locationService = new LocationService();
const postCommentService = new PostCommentService();

export const createPost = withAuth(async (req, res) => {
  try {
    const { locationId, title, content } = req.body;
    const user = req.user;

    const location = await locationService.getLocationById(locationId);
    if (!location) {
      return res.status(400).json({ message: "invalid locationId" });
    }

    if (
      location.latitude != null &&
      location.longitude != null &&
      location.size != null
    ) {
      if (
        !(await verifyLocationAndUserInRange(location, user.id)) &&
        !user.isAdmin
      ) {
        return res
          .status(403)
          .json({ message: "user out of range to post in this chatroom" });
      }
    } else {
      if (!user.isAdmin) {
        return res
          .status(400)
          .json({ message: "the specified location does not support user location" });
      }
    }

    const createdPost = await postService.createPost({
      posterId: user.id,
      locationId,
      title,
      content,
    });

    const postList = await postService.getPostListByLocation(locationId);

    return res.status(201).json({
      message: `successfully posted`,
      createdPost,
      postList,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
});

export const postDetails = withAuth(async (req, res) => {
  try {
    const postId = Number(req.params.postId);

    if (!postId || Number.isNaN(postId)) {
      return res.status(400).json({ message: "invalid post Id" });
    }

    const payload = await postService.getPostandPostCommentsById(postId);

    return res.status(200).json({
      payload,
    });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
});

export const commentOnPost = withAuth(async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const {content} = req.body;
    const user = req.user;

    if (!postId || Number.isNaN(postId)) {
      return res.status(400).json({ message: "invalid post Id" });
    }

    const post = await postService.getPostWithLocation(postId);

    if (!post?.location) {
      return res.status(400).json({ message: "invalid post location" });
    }

    if (
      post?.location?.latitude != null &&
      post?.location?.longitude != null &&
      post?.location?.size != null
    ) {
      if (
        !(await verifyLocationAndUserInRange(post?.location, user.id)) &&
        !user.isAdmin
      ) {
        return res
          .status(403)
          .json({ message: "user out of range to post in this chatroom" });
      }
    } else {
      if (!user.isAdmin) {
        return res
          .status(400)
          .json({ message: "the specified location does not support user location" });
      }
    }

    const createdComment = await postCommentService.createPostComment({
      commenterId: user.id,
      postId: post.id,
      content,
    });

    const updatedPost = await postService.getPostandPostCommentsById(post.id);

    return res.status(201).json({
      message: "Post comment added",
      createdComment,
      updatedPost,
    });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
});
