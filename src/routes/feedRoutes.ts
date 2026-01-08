import { Router } from "express";
import { verifyAuth, optionalAuth } from "../middlewares/auth.middleware";
import {
  createPostHandler,
  getFeedPostsHandler,
  getPostByIdHandler,
  updatePostCaptionHandler,
  deletePostHandler,
  toggleLikeHandler,
  getPostLikersHandler,
  addCommentHandler,
  getPostCommentsHandler,
  deleteCommentHandler,
} from "../controllers/feedController";

const feedRoutes = Router();

// Posts - Public access with optional auth (for isLikedByUser)
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
feedRoutes.get("/posts", optionalAuth, getFeedPostsHandler as any);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
feedRoutes.get("/posts/:postId", optionalAuth, getPostByIdHandler as any);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
feedRoutes.get("/posts/:postId/likers", optionalAuth, getPostLikersHandler as any);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
feedRoutes.get("/posts/:postId/comments", optionalAuth, getPostCommentsHandler as any);

// Posts - Auth required
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
feedRoutes.post("/posts", verifyAuth, createPostHandler as any);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
feedRoutes.patch("/posts/:postId", verifyAuth, updatePostCaptionHandler as any);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
feedRoutes.delete("/posts/:postId", verifyAuth, deletePostHandler as any);

// Likes - Auth required
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
feedRoutes.post("/posts/:postId/like", verifyAuth, toggleLikeHandler as any);

// Comments - Auth required
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
feedRoutes.post("/posts/:postId/comments", verifyAuth, addCommentHandler as any);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
feedRoutes.delete("/comments/:commentId", verifyAuth, deleteCommentHandler as any);

export default feedRoutes;
