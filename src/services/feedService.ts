import { prisma } from '../lib/prisma';
import { Prisma, MatchStatus } from '@prisma/client';

// Types
export interface CreatePostData {
  matchId: string;
  authorId: string;
  caption?: string;
}

export interface FeedFilters {
  sport?: string;
  limit?: number;
  cursor?: string;
}

export interface PostWithDetails {
  id: string;
  matchId: string;
  authorId: string;
  caption: string | null;
  sport: string;
  matchType: string;
  gameType: string;
  winnerIds: string[];
  loserIds: string[];
  matchDate: Date;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  author: {
    id: string;
    name: string | null;
    username: string | null;
    displayUsername: string | null;
    image: string | null;
  };
  match: {
    id: string;
    setScores: Prisma.JsonValue;
    participants: Array<{
      userId: string;
      team: string | null;
      user: {
        id: string;
        name: string | null;
        username: string | null;
        displayUsername: string | null;
        image: string | null;
      };
    }>;
  };
  isLikedByUser?: boolean;
}

// ============================================
// POST OPERATIONS
// ============================================

export const createPost = async (data: CreatePostData): Promise<PostWithDetails> => {
  const { matchId, authorId, caption } = data;

  // Fetch match with participants and scores
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      participants: {
        select: {
          userId: true,
          team: true,
          user: {
            select: { id: true, name: true, username: true, displayUsername: true, image: true }
          }
        }
      }
    }
  });

  if (!match) {
    throw new Error('Match not found');
  }

  // Verify author is a participant
  const isParticipant = match.participants.some(p => p.userId === authorId);
  if (!isParticipant) {
    throw new Error('Only match participants can create posts');
  }

  // Check match is completed
  if (match.status !== MatchStatus.COMPLETED) {
    throw new Error('Can only post completed matches');
  }

  // Check for existing post by this author for this match
  const existingPost = await prisma.feedPost.findFirst({
    where: { matchId, authorId, isDeleted: false }
  });

  if (existingPost) {
    throw new Error('You have already posted this match');
  }

  // Determine winning team based on scores
  const team1Score = match.team1Score ?? 0;
  const team2Score = match.team2Score ?? 0;
  const winningTeam = team1Score > team2Score ? 'team1' : 'team2';

  // Extract winner/loser IDs based on team assignment
  const winnerIds = match.participants
    .filter(p => p.team === winningTeam)
    .map(p => p.userId);
  const loserIds = match.participants
    .filter(p => p.team !== winningTeam)
    .map(p => p.userId);

  // Determine game type (league vs friendly)
  const gameType = match.leagueId ? 'league' : 'friendly';

  // Create the post
  const post = await prisma.feedPost.create({
    data: {
      matchId,
      authorId,
      caption: caption?.trim() || null,
      sport: match.sport,
      matchType: match.matchType.toLowerCase(),
      gameType,
      winnerIds,
      loserIds,
      matchDate: match.matchDate,
    },
    include: {
      author: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true }
      },
      match: {
        select: {
          id: true,
          setScores: true,
          participants: {
            select: {
              userId: true,
              team: true,
              user: {
                select: { id: true, name: true, username: true, displayUsername: true, image: true }
              }
            }
          }
        }
      }
    }
  });

  return post as PostWithDetails;
};

export const getFeedPosts = async (
  filters: FeedFilters,
  currentUserId?: string
): Promise<{ posts: PostWithDetails[]; nextCursor: string | null }> => {
  const { sport, limit = 10, cursor } = filters;

  const where: Prisma.FeedPostWhereInput = {
    isDeleted: false,
    ...(sport && { sport }),
  };

  const posts = await prisma.feedPost.findMany({
    where,
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true }
      },
      match: {
        select: {
          id: true,
          setScores: true,
          participants: {
            select: {
              userId: true,
              team: true,
              user: {
                select: { id: true, name: true, username: true, displayUsername: true, image: true }
              }
            }
          }
        }
      },
      ...(currentUserId && {
        likes: {
          where: { userId: currentUserId },
          select: { id: true }
        }
      })
    }
  });

  const hasMore = posts.length > limit;
  const resultPosts = hasMore ? posts.slice(0, limit) : posts;
  const lastPost = resultPosts[resultPosts.length - 1];
  const nextCursor = hasMore && lastPost ? lastPost.id : null;

  // Transform to include isLikedByUser
  const postsWithLikeStatus = resultPosts.map(post => ({
    ...post,
    isLikedByUser: currentUserId ? (post as any).likes?.length > 0 : false,
    likes: undefined,
  }));

  return { posts: postsWithLikeStatus as PostWithDetails[], nextCursor };
};

export const getPostById = async (
  postId: string,
  currentUserId?: string
): Promise<PostWithDetails | null> => {
  const post = await prisma.feedPost.findFirst({
    where: { id: postId, isDeleted: false },
    include: {
      author: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true }
      },
      match: {
        select: {
          id: true,
          setScores: true,
          participants: {
            select: {
              userId: true,
              team: true,
              user: {
                select: { id: true, name: true, username: true, displayUsername: true, image: true }
              }
            }
          }
        }
      },
      ...(currentUserId && {
        likes: {
          where: { userId: currentUserId },
          select: { id: true }
        }
      })
    }
  });

  if (!post) return null;

  return {
    ...post,
    isLikedByUser: currentUserId ? (post as any).likes?.length > 0 : false,
  } as PostWithDetails;
};

export const updatePostCaption = async (
  postId: string,
  authorId: string,
  caption: string
): Promise<PostWithDetails> => {
  const post = await prisma.feedPost.findFirst({
    where: { id: postId, authorId, isDeleted: false }
  });

  if (!post) {
    throw new Error('Post not found or you are not the author');
  }

  const updated = await prisma.feedPost.update({
    where: { id: postId },
    data: { caption: caption.trim() || null },
    include: {
      author: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true }
      },
      match: {
        select: {
          id: true,
          setScores: true,
          participants: {
            select: {
              userId: true,
              team: true,
              user: {
                select: { id: true, name: true, username: true, displayUsername: true, image: true }
              }
            }
          }
        }
      }
    }
  });

  return updated as PostWithDetails;
};

export const deletePost = async (postId: string, authorId: string): Promise<void> => {
  const post = await prisma.feedPost.findFirst({
    where: { id: postId, authorId, isDeleted: false }
  });

  if (!post) {
    throw new Error('Post not found or you are not the author');
  }

  await prisma.feedPost.update({
    where: { id: postId },
    data: { isDeleted: true, deletedAt: new Date() }
  });
};

// ============================================
// LIKE OPERATIONS
// ============================================

export const toggleLike = async (
  postId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> => {
  const post = await prisma.feedPost.findFirst({
    where: { id: postId, isDeleted: false }
  });

  if (!post) {
    throw new Error('Post not found');
  }

  const existingLike = await prisma.feedLike.findUnique({
    where: { postId_userId: { postId, userId } }
  });

  if (existingLike) {
    await prisma.$transaction([
      prisma.feedLike.delete({ where: { id: existingLike.id } }),
      prisma.feedPost.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } }
      })
    ]);
    return { liked: false, likeCount: Math.max(0, post.likeCount - 1) };
  } else {
    await prisma.$transaction([
      prisma.feedLike.create({ data: { postId, userId } }),
      prisma.feedPost.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } }
      })
    ]);
    return { liked: true, likeCount: post.likeCount + 1 };
  }
};

export const getPostLikers = async (
  postId: string,
  limit: number = 50
): Promise<Array<{ id: string; name: string | null; username: string | null; image: string | null }>> => {
  const likes = await prisma.feedLike.findMany({
    where: { postId },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true }
      }
    }
  });

  return likes.map(like => like.user);
};

// ============================================
// COMMENT OPERATIONS
// ============================================

export const addComment = async (
  postId: string,
  authorId: string,
  text: string
): Promise<{
  id: string;
  text: string;
  createdAt: Date;
  author: { id: string; name: string | null; username: string | null; image: string | null };
}> => {
  const post = await prisma.feedPost.findFirst({
    where: { id: postId, isDeleted: false }
  });

  if (!post) {
    throw new Error('Post not found');
  }

  if (!text.trim() || text.length > 200) {
    throw new Error('Comment must be 1-200 characters');
  }

  const [comment] = await prisma.$transaction([
    prisma.feedComment.create({
      data: { postId, authorId, text: text.trim() },
      include: {
        author: {
          select: { id: true, name: true, username: true, displayUsername: true, image: true }
        }
      }
    }),
    prisma.feedPost.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } }
    })
  ]);

  return comment;
};

export const getPostComments = async (
  postId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Array<{
  id: string;
  text: string;
  createdAt: Date;
  author: { id: string; name: string | null; username: string | null; image: string | null };
}>> => {
  const comments = await prisma.feedComment.findMany({
    where: { postId, isDeleted: false },
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'asc' },
    include: {
      author: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true }
      }
    }
  });

  return comments;
};

export const deleteComment = async (commentId: string, authorId: string): Promise<void> => {
  const comment = await prisma.feedComment.findFirst({
    where: { id: commentId, authorId, isDeleted: false }
  });

  if (!comment) {
    throw new Error('Comment not found or you are not the author');
  }

  await prisma.$transaction([
    prisma.feedComment.update({
      where: { id: commentId },
      data: { isDeleted: true, deletedAt: new Date() }
    }),
    prisma.feedPost.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } }
    })
  ]);
};
