/**
 * Multer Configuration for Profile Image Uploads
 * Uses memory storage to upload directly to Google Cloud Storage
 */

// TODO(AWS-M-6, docs/plans/2026-04-14-aws-migration-architecture-stress-tests.md):
// Aspirational for post-AWS-migration: replace server-side multer upload with
// direct-to-S3 pre-signed URL flow. Client PUTs the file straight to S3; backend
// only generates a signed URL + records the resulting S3 key in the DB. Removes
// the backend from the file-transfer critical path entirely.
//
// NOT a migration blocker: current 5MB file cap + memoryStorage is fine on
// a 1GB Fargate task. This is architectural cleanup, not a correctness fix.

import multer from "multer";
import path from "path";

// Use memory storage instead of disk storage to avoid local file system
const storage = multer.memoryStorage();

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});
