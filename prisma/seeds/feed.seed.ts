/**
 * Activity Feed Seed
 * Creates FeedPost, FeedLike, and FeedComment records from completed matches.
 */

import {
  prisma,
  randomElement,
  randomElements,
  randomInt,
  logSection,
  logSuccess,
  logProgress,
} from "./utils";

// =============================================
// CONSTANTS
// =============================================

const CAPTIONS = [
  "Great match today!",
  "What a battle!",
  "Close one!",
  "GG!",
  "Back on the court!",
  "Tough opponent!",
  "Love this sport!",
  "Best game I've played in weeks!",
  "Feeling good on court today!",
  "Need to work on my serve...",
  "Doubles partner was on fire!",
  "Started slow but came back strong!",
  "Can't wait for the next one!",
  "Courts were in great condition today",
  "Rain almost cancelled us!",
  "New personal best!",
  "What a rally in the final set!",
  "Thanks for the game!",
  "See you next week!",
  null,
  null,
  null, // ~15% chance of no caption
];

const COMMENTS = [
  "Great job!",
  "Well played!",
  "Nice match!",
  "Congrats!",
  "That was a tough one",
  "Looking forward to our rematch",
  "You played well out there",
  "Good game!",
  "So close!",
  "Better luck next time!",
  "Your forehand was lethal today",
  "Amazing rally in the second set",
  "Let's play again soon",
  "Good sportsmanship as always",
];

// =============================================
// SEED FUNCTION
// =============================================

export async function seedFeed(): Promise<{
  postCount: number;
  likeCount: number;
  commentCount: number;
}> {
  logSection("📰 Seeding Activity Feed...");

  // Get completed matches with participants
  const matches = await prisma.match.findMany({
    where: { status: "COMPLETED", isWalkover: false },
    include: {
      participants: {
        select: { userId: true, team: true, role: true },
      },
    },
    orderBy: { matchDate: "desc" },
    take: 300,
  });

  // Get active users for likes/comments
  const activeUsers = await prisma.user.findMany({
    where: { status: "ACTIVE", completedOnboarding: true },
    select: { id: true },
    take: 100,
  });

  let postCount = 0;
  let likeCount = 0;
  let commentCount = 0;

  for (const match of matches) {
    if (match.participants.length < 2) continue;

    // Determine winners and losers based on score
    const team1Ids = match.participants
      .filter((p) => p.team === "team1" || p.role === "CREATOR")
      .map((p) => p.userId);
    const team2Ids = match.participants
      .filter((p) => p.team === "team2" || p.role === "OPPONENT")
      .map((p) => p.userId);

    // Determine winner by score
    const t1Score = match.team1Score ?? match.playerScore ?? 0;
    const t2Score = match.team2Score ?? match.opponentScore ?? 0;
    const team1Won = t1Score >= t2Score;

    const winnerIds = team1Won ? team1Ids : team2Ids;
    const loserIds = team1Won ? team2Ids : team1Ids;

    if (winnerIds.length === 0) continue;

    const authorId = winnerIds[0]!;
    const gameType = match.isFriendly ? "friendly" : "league";

    const postCreatedAt = new Date(
      match.matchDate.getTime() + randomInt(10, 120) * 60 * 1000
    );

    const post = await prisma.feedPost.create({
      data: {
        matchId: match.id,
        authorId,
        caption: randomElement(CAPTIONS),
        sport: match.sport.toLowerCase(),
        matchType: match.matchType.toLowerCase(),
        gameType,
        winnerIds,
        loserIds,
        matchDate: match.matchDate,
        leagueId: match.leagueId,
        divisionId: match.divisionId,
        createdAt: postCreatedAt,
        updatedAt: postCreatedAt,
      },
    });
    postCount++;

    // Add 0-5 likes from random users
    let postLikes = 0;
    const likersCount = randomInt(0, 5);
    const likers = randomElements(activeUsers, likersCount);
    for (const liker of likers) {
      if (liker.id === authorId) continue;
      try {
        await prisma.feedLike.create({
          data: {
            postId: post.id,
            userId: liker.id,
            createdAt: new Date(
              postCreatedAt.getTime() + randomInt(5, 1440) * 60 * 1000
            ),
          },
        });
        postLikes++;
        likeCount++;
      } catch {
        // Skip duplicate likes
      }
    }

    // Add 0-3 comments from random users
    let postComments = 0;
    const commenterCount = randomInt(0, 3);
    const commenters = randomElements(activeUsers, commenterCount);
    for (const commenter of commenters) {
      await prisma.feedComment.create({
        data: {
          postId: post.id,
          authorId: commenter.id,
          text: randomElement(COMMENTS)!,
          createdAt: new Date(
            postCreatedAt.getTime() + randomInt(5, 2880) * 60 * 1000
          ),
          updatedAt: new Date(
            postCreatedAt.getTime() + randomInt(5, 2880) * 60 * 1000
          ),
        },
      });
      postComments++;
      commentCount++;
    }

    // Update denormalized counters
    if (postLikes > 0 || postComments > 0) {
      await prisma.feedPost.update({
        where: { id: post.id },
        data: { likeCount: postLikes, commentCount: postComments },
      });
    }

    if (postCount % 50 === 0) {
      logProgress(`   Feed posts: ${postCount}/300`);
    }
  }

  logSuccess(
    `Created ${postCount} feed posts, ${likeCount} likes, ${commentCount} comments`
  );
  return { postCount, likeCount, commentCount };
}
