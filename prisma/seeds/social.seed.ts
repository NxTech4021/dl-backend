/**
 * Social Features Seeding
 * Creates friendships, threads, messages, and notifications
 */

import {
  User,
  FriendshipStatus,
  NotificationCategory,
  MessageType,
} from "@prisma/client";
import {
  prisma,
  randomDate,
  randomElement,
  randomInt,
  randomBoolean,
  monthsAgo,
  daysAgo,
  logSection,
  logSuccess,
  logProgress,
} from "./utils";

// =============================================
// TYPES
// =============================================

export interface SeededSocialData {
  friendshipCount: number;
  threadCount: number;
  messageCount: number;
  notificationCount: number;
}

// =============================================
// NOTIFICATION MESSAGES
// =============================================

const NOTIFICATION_TEMPLATES: Record<NotificationCategory, string[]> = {
  MATCH: [
    "Your match is starting in 1 hour",
    "Don't forget your match today",
    "Match reminder: opponent is waiting",
    "Your scheduled match begins soon",
    "Match result submitted - please verify",
    "Your match has been rescheduled",
    "Your match has been cancelled",
  ],
  DIVISION: [
    "You've been assigned to a new division",
    "Division standings updated",
    "New matches scheduled in your division",
    "Your rating has been updated",
    "New rating calculated after recent match",
  ],
  LEAGUE: [
    "New league available",
    "League registration is now open",
    "League update notification",
    "Check the latest league standings",
  ],
  CHAT: [
    "New message received",
    "You have a new chat message",
    "Someone sent you a message",
    "New message in your chat",
    "New friend request",
    "Friend request accepted",
  ],
  SEASON: [
    "Season registration is now open",
    "New season available for registration",
    "Register now for the upcoming season",
    "Registration deadline approaching",
    "Season schedule has been updated",
    "Important season announcement",
  ],
  PAYMENT: [
    "Payment received successfully",
    "Payment reminder",
    "Invoice generated",
    "Refund processed",
  ],
  ADMIN: [
    "Your dispute has been updated",
    "Admin responded to your dispute",
    "Dispute resolution pending",
    "New information on your dispute",
    "A player report has been filed",
    "Player report requires attention",
    "Team change request received",
    "Partner change request pending",
  ],
  GENERAL: [
    "System maintenance scheduled",
    "Important system announcement",
    "Platform update notification",
    "Check out what's new",
    "Withdrawal request submitted",
    "Your withdrawal is being processed",
  ],
};

const CHAT_MESSAGES = [
  "Hey! Ready for our match?",
  "What time works best for you?",
  "See you at the courts!",
  "Great game today!",
  "Let's practice sometime",
  "Can we reschedule?",
  "I'll be there in 10 minutes",
  "Which court are we on?",
  "Good luck!",
  "That was a close one!",
  "Want to play again next week?",
  "Thanks for the game!",
  "My partner can't make it, any suggestions?",
  "What's your availability this week?",
  "The weather looks good for tomorrow",
  "I found a great venue we should try",
  "Are you joining the new season?",
  "Who's your partner for the tournament?",
  "Nice serve today!",
  "Let me know when you're free",
  "I'll bring extra balls",
  "See you at registration",
  "Good warm-up session!",
  "Can you recommend a coach?",
  "What racket do you use?",
];

// =============================================
// SEED FRIENDSHIPS
// =============================================

export async function seedFriendships(users: User[]): Promise<number> {
  logSection("👫 Seeding friendships...");

  const activeUsers = users.filter(u => u.status === "ACTIVE" && u.completedOnboarding);
  let created = 0;

  // Create ~300 friendships with various statuses
  const targetFriendships = 300;
  const usedPairs = new Set<string>();

  for (let i = 0; i < targetFriendships; i++) {
    const user1 = randomElement(activeUsers);
    const user2 = randomElement(activeUsers.filter(u => u.id !== user1.id));

    // Create unique pair key
    const pairKey = [user1.id, user2.id].sort().join("-");
    if (usedPairs.has(pairKey)) continue;
    usedPairs.add(pairKey);

    // Check if friendship exists
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: user1.id, recipientId: user2.id },
          { requesterId: user2.id, recipientId: user1.id },
        ],
      },
    });

    if (existing) continue;

    // Weighted status distribution: 70% accepted, 15% pending, 10% rejected, 5% blocked
    const statusWeights = [0.7, 0.15, 0.1, 0.05];
    const random = Math.random();
    let status: FriendshipStatus;
    if (random < statusWeights[0]) status = FriendshipStatus.ACCEPTED;
    else if (random < statusWeights[0] + statusWeights[1]) status = FriendshipStatus.PENDING;
    else if (random < statusWeights[0] + statusWeights[1] + statusWeights[2]) status = FriendshipStatus.REJECTED;
    else status = FriendshipStatus.BLOCKED;

    const createdAt = randomDate(monthsAgo(10), daysAgo(1));

    await prisma.friendship.create({
      data: {
        requesterId: user1.id,
        recipientId: user2.id,
        status,
        createdAt,
        respondedAt: status !== FriendshipStatus.PENDING ? randomDate(createdAt, new Date()) : null,
      },
    });
    created++;

    if (created % 50 === 0) {
      logProgress(`   Friendships: ${created}/${targetFriendships}`);
    }
  }

  logSuccess(`Created ${created} friendships`);
  return created;
}

// =============================================
// SEED THREADS AND MESSAGES
// =============================================

export async function seedThreads(users: User[]): Promise<{ threadCount: number; messageCount: number }> {
  logSection("💬 Seeding threads and messages...");

  const activeUsers = users.filter(u => u.status === "ACTIVE" && u.completedOnboarding);
  let threadCount = 0;
  let messageCount = 0;

  // Create ~150 private threads (1:1 chats)
  const targetThreads = 150;
  const usedPairs = new Set<string>();

  for (let i = 0; i < targetThreads; i++) {
    const user1 = randomElement(activeUsers);
    const user2 = randomElement(activeUsers.filter(u => u.id !== user1.id));

    const pairKey = [user1.id, user2.id].sort().join("-");
    if (usedPairs.has(pairKey)) continue;
    usedPairs.add(pairKey);

    const threadCreatedAt = randomDate(monthsAgo(8), daysAgo(7));

    const thread = await prisma.thread.create({
      data: {
        isGroup: false,
        createdAt: threadCreatedAt,
        updatedAt: threadCreatedAt,
        members: {
          create: [
            { userId: user1.id, joinedAt: threadCreatedAt },
            { userId: user2.id, joinedAt: threadCreatedAt },
          ],
        },
      },
    });
    threadCount++;

    // Create 3-15 messages per thread
    const msgCount = randomInt(3, 15);
    let lastMessageTime = threadCreatedAt;

    for (let j = 0; j < msgCount; j++) {
      const sender = j % 2 === 0 ? user1 : user2;
      const messageTime = randomDate(lastMessageTime, daysAgo(1));
      lastMessageTime = messageTime;

      await prisma.message.create({
        data: {
          threadId: thread.id,
          senderId: sender.id,
          content: randomElement(CHAT_MESSAGES),
          messageType: MessageType.TEXT,
          createdAt: messageTime,
          updatedAt: messageTime,
        },
      });
      messageCount++;
    }

    // Update thread's updatedAt
    await prisma.thread.update({
      where: { id: thread.id },
      data: { updatedAt: lastMessageTime },
    });

    if (threadCount % 30 === 0) {
      logProgress(`   Threads: ${threadCount}/${targetThreads}`);
    }
  }

  // Create ~20 group threads (division chats)
  logProgress("Creating division group threads...");
  const divisions = await prisma.division.findMany({
    take: 20,
    include: {
      season: true,
    },
  });

  for (const division of divisions) {
    // Get members of this division
    const memberships = await prisma.seasonMembership.findMany({
      where: {
        seasonId: division.seasonId,
        divisionId: division.id,
      },
      take: 10,
      select: { userId: true },
    });

    if (memberships.length < 2) continue;

    const threadCreatedAt = division.createdAt || monthsAgo(6);

    const thread = await prisma.thread.create({
      data: {
        name: `${division.name} Chat`,
        isGroup: true,
        divisionId: division.id,
        createdAt: threadCreatedAt,
        updatedAt: threadCreatedAt,
        members: {
          create: memberships.map(m => ({
            userId: m.userId,
            joinedAt: threadCreatedAt,
          })),
        },
      },
    });
    threadCount++;

    // Add 5-10 messages
    const msgCount = randomInt(5, 10);
    let lastTime = threadCreatedAt;

    for (let j = 0; j < msgCount; j++) {
      const sender = randomElement(memberships);
      const msgTime = randomDate(lastTime, new Date());
      lastTime = msgTime;

      await prisma.message.create({
        data: {
          threadId: thread.id,
          senderId: sender.userId,
          content: randomElement(CHAT_MESSAGES),
          messageType: MessageType.TEXT,
          createdAt: msgTime,
          updatedAt: msgTime,
        },
      });
      messageCount++;
    }

    await prisma.thread.update({
      where: { id: thread.id },
      data: { updatedAt: lastTime },
    });
  }

  logSuccess(`Created ${threadCount} threads with ${messageCount} messages`);
  return { threadCount, messageCount };
}

// =============================================
// SEED NOTIFICATIONS
// =============================================

export async function seedNotifications(users: User[]): Promise<number> {
  logSection("🔔 Seeding notifications...");

  const activeUsers = users.filter(u => u.status === "ACTIVE" && u.completedOnboarding);
  let created = 0;
  const targetNotifications = 1500;

  // Distribution of notification categories
  const categoryDistribution: { category: NotificationCategory; weight: number }[] = [
    { category: NotificationCategory.MATCH, weight: 25 },
    { category: NotificationCategory.DIVISION, weight: 15 },
    { category: NotificationCategory.LEAGUE, weight: 10 },
    { category: NotificationCategory.CHAT, weight: 15 },
    { category: NotificationCategory.SEASON, weight: 12 },
    { category: NotificationCategory.PAYMENT, weight: 5 },
    { category: NotificationCategory.ADMIN, weight: 10 },
    { category: NotificationCategory.GENERAL, weight: 8 },
  ];

  const totalWeight = categoryDistribution.reduce((sum, n) => sum + n.weight, 0);

  for (let i = 0; i < targetNotifications; i++) {
    const user = randomElement(activeUsers);

    // Select notification category based on weight
    let random = Math.random() * totalWeight;
    let selectedCategory = categoryDistribution[0].category;
    for (const { category, weight } of categoryDistribution) {
      random -= weight;
      if (random <= 0) {
        selectedCategory = category;
        break;
      }
    }

    const templates = NOTIFICATION_TEMPLATES[selectedCategory];
    const message = randomElement(templates);
    const createdAt = randomDate(monthsAgo(6), new Date());

    // Create notification
    const notification = await prisma.notification.create({
      data: {
        category: selectedCategory,
        title: selectedCategory.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
        message,
        userId: user.id,
        createdAt,
      },
    });

    // Create UserNotification record (70% read)
    const isRead = randomBoolean(0.7);
    await prisma.userNotification.create({
      data: {
        userId: user.id,
        notificationId: notification.id,
        read: isRead,
        readAt: isRead ? randomDate(createdAt, new Date()) : null,
      },
    });

    created++;

    if (created % 200 === 0) {
      logProgress(`   Notifications: ${created}/${targetNotifications}`);
    }
  }

  logSuccess(`Created ${created} notifications`);
  return created;
}

// =============================================
// SEED FAVORITES
// =============================================

export async function seedFavorites(users: User[]): Promise<number> {
  logSection("⭐ Seeding favorites...");

  const activeUsers = users.filter(u => u.status === "ACTIVE" && u.completedOnboarding);
  let created = 0;
  const targetFavorites = 200;
  const usedPairs = new Set<string>();

  for (let i = 0; i < targetFavorites; i++) {
    const user = randomElement(activeUsers);
    const favorited = randomElement(activeUsers.filter(u => u.id !== user.id));

    const pairKey = `${user.id}-${favorited.id}`;
    if (usedPairs.has(pairKey)) continue;
    usedPairs.add(pairKey);

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_favoritedId: {
          userId: user.id,
          favoritedId: favorited.id,
        },
      },
    });

    if (existing) continue;

    await prisma.favorite.create({
      data: {
        userId: user.id,
        favoritedId: favorited.id,
        createdAt: randomDate(monthsAgo(6), daysAgo(1)),
      },
    });
    created++;
  }

  logSuccess(`Created ${created} favorites`);
  return created;
}

// =============================================
// MAIN SOCIAL SEEDING FUNCTION
// =============================================

export async function seedSocialFeatures(users: User[]): Promise<SeededSocialData> {
  const friendshipCount = await seedFriendships(users);
  const { threadCount, messageCount } = await seedThreads(users);
  const notificationCount = await seedNotifications(users);
  await seedFavorites(users);

  return {
    friendshipCount,
    threadCount,
    messageCount,
    notificationCount,
  };
}
