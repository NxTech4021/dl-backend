/**
 * Like Notification Grouping Service
 *
 * Groups multiple like notifications for the same post into a single notification
 * using an in-memory cache with time-based expiry.
 *
 * When multiple users like a post within the grouping window (5 minutes),
 * instead of sending individual notifications, we send grouped messages like:
 * - "Alice liked your post"
 * - "Alice and Bob liked your post"
 * - "Alice and 3 others liked your post"
 */

import { notificationService } from "../notificationService";
import { socialCommunityNotifications } from "../../helpers/notifications/socialCommunityNotifications";

// Grouping window in milliseconds (5 minutes)
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

// Cleanup interval (run every minute)
const CLEANUP_INTERVAL_MS = 60 * 1000;

interface PendingLikeGroup {
  postId: string;
  authorId: string;
  likerNames: string[];
  likerIds: string[];
  firstLikeAt: number;
  lastLikeAt: number;
  notificationSent: boolean;
  timeoutId: NodeJS.Timeout | null;
}

// In-memory store for pending like groups
// Key: `${postId}:${authorId}`
const pendingLikeGroups = new Map<string, PendingLikeGroup>();

/**
 * Get the cache key for a post/author combination
 */
function getCacheKey(postId: string, authorId: string): string {
  return `${postId}:${authorId}`;
}

/**
 * Send the grouped notification
 */
async function sendGroupedNotification(group: PendingLikeGroup): Promise<void> {
  if (group.notificationSent || group.likerNames.length === 0) {
    return;
  }

  group.notificationSent = true;

  const notification = socialCommunityNotifications.postLikedGrouped(
    group.likerNames,
    group.postId,
    group.likerNames.length
  );

  await notificationService.createNotification({
    userIds: [group.authorId],
    ...notification,
    metadata: {
      ...notification.metadata,
      likerIds: group.likerIds,
    },
  });

  // Remove the group from the cache after sending
  const key = getCacheKey(group.postId, group.authorId);
  pendingLikeGroups.delete(key);
}

/**
 * Add a like to the grouping queue
 * Will batch likes within the grouping window and send a single notification
 */
export async function addLikeToGroup(
  postId: string,
  authorId: string,
  likerId: string,
  likerName: string
): Promise<void> {
  const key = getCacheKey(postId, authorId);
  const now = Date.now();

  let group = pendingLikeGroups.get(key);

  if (!group) {
    // Create a new group
    group = {
      postId,
      authorId,
      likerNames: [],
      likerIds: [],
      firstLikeAt: now,
      lastLikeAt: now,
      notificationSent: false,
      timeoutId: null,
    };
    pendingLikeGroups.set(key, group);
  }

  // Check if we're still within the grouping window from the first like
  if (now - group.firstLikeAt > GROUPING_WINDOW_MS) {
    // Window expired, send current group and start new one
    await sendGroupedNotification(group);

    group = {
      postId,
      authorId,
      likerNames: [],
      likerIds: [],
      firstLikeAt: now,
      lastLikeAt: now,
      notificationSent: false,
      timeoutId: null,
    };
    pendingLikeGroups.set(key, group);
  }

  // Don't add duplicates
  if (group.likerIds.includes(likerId)) {
    return;
  }

  // Add the liker to the group
  group.likerNames.push(likerName);
  group.likerIds.push(likerId);
  group.lastLikeAt = now;

  // Clear existing timeout
  if (group.timeoutId) {
    clearTimeout(group.timeoutId);
  }

  // Set a short delay before sending (2 seconds)
  // This allows rapid likes to be batched together
  group.timeoutId = setTimeout(async () => {
    const currentGroup = pendingLikeGroups.get(key);
    if (currentGroup && !currentGroup.notificationSent) {
      await sendGroupedNotification(currentGroup);
    }
  }, 2000);
}

/**
 * Clean up expired groups (safety net)
 */
function cleanupExpiredGroups(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];

  pendingLikeGroups.forEach((group, key) => {
    // If a group has been pending for more than 2x the window, clean it up
    if (now - group.firstLikeAt > GROUPING_WINDOW_MS * 2) {
      if (group.timeoutId) {
        clearTimeout(group.timeoutId);
      }
      if (!group.notificationSent && group.likerNames.length > 0) {
        // Send any unsent notifications before cleanup
        sendGroupedNotification(group).catch(console.error);
      }
      expiredKeys.push(key);
    }
  });

  expiredKeys.forEach((key) => pendingLikeGroups.delete(key));
}

// Start cleanup interval
setInterval(cleanupExpiredGroups, CLEANUP_INTERVAL_MS);

/**
 * Get current group stats (for debugging/monitoring)
 */
export function getGroupStats(): { activeGroups: number; totalPendingLikes: number } {
  let totalPendingLikes = 0;
  pendingLikeGroups.forEach((group) => {
    if (!group.notificationSent) {
      totalPendingLikes += group.likerNames.length;
    }
  });

  return {
    activeGroups: pendingLikeGroups.size,
    totalPendingLikes,
  };
}
