import { prisma } from '../lib/prisma';
import { Prisma, MatchStatus } from '@prisma/client';

// Types
export interface CreatePostData {
  matchId: string;
  authorId: string;
  caption?: string;
}

export interface CreatePostResult {
  post: PostWithDetails;
  alreadyExists: boolean;
}

export interface FeedFilters {
  sport?: string;
  limit?: number;
  cursor?: string;
  filter?: 'all' | 'friends' | 'recommended';
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
  leagueId: string | null;
  divisionId: string | null;
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

export const createPost = async (data: CreatePostData): Promise<CreatePostResult> => {
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
      },
      league: {
        select: { id: true, name: true, sportType: true }
      },
      division: {
        select: { id: true, name: true, gameType: true }
      },
      season: {
        select: { id: true, name: true }
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
    where: { matchId, authorId, isDeleted: false },
    include: {
      author: {
        select: { id: true, name: true, username: true, displayUsername: true, image: true }
      },
      match: {
        select: {
          id: true,
          matchType: true,
          matchDate: true,
          sport: true,
          team1Score: true,
          team2Score: true,
          isWalkover: true,
          location: true,
          setScores: true,
          participants: {
            select: {
              userId: true,
              team: true,
              user: {
                select: { id: true, name: true, username: true, displayUsername: true, image: true }
              }
            }
          },
          league: {
            select: { id: true, name: true, sportType: true }
          },
          division: {
            select: { id: true, name: true, gameType: true }
          },
          season: {
            select: { id: true, name: true }
          }
        }
      }
    }
  });

  if (existingPost) {
    // Return existing post with flag indicating it already existed
    return { 
      post: existingPost as PostWithDetails, 
      alreadyExists: true 
    };
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
      leagueId: match.leagueId || null,
      divisionId: match.divisionId || null,
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

  return { post: post as PostWithDetails, alreadyExists: false };
};

export const getFeedPosts = async (
  filters: FeedFilters,
  currentUserId?: string
): Promise<{ posts: PostWithDetails[]; nextCursor: string | null }> => {
  const { sport, limit = 10, cursor, filter = 'all' } = filters;

  const where: Prisma.FeedPostWhereInput = {
    isDeleted: false,
    ...(sport && { sport: sport.toUpperCase() }),
  };

  // Apply filter logic
  if (currentUserId && filter === 'friends') {
    // Get user's friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: currentUserId, status: 'ACCEPTED' },
          { recipientId: currentUserId, status: 'ACCEPTED' }
        ]
      },
      select: {
        requesterId: true,
        recipientId: true
      }
    });

    const friendIds = friendships.map(f => 
      f.requesterId === currentUserId ? f.recipientId : f.requesterId
    );

    // Include posts from friends AND the current user
    where.authorId = { in: [...friendIds, currentUserId] };
  }
  // 'recommended' and 'all' show all posts (no additional filtering needed)

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
          matchType: true,
          matchDate: true,
          sport: true,
          team1Score: true,
          team2Score: true,
          isWalkover: true,
          location: true,
          setScores: true,
          participants: {
            select: {
              userId: true,
              team: true,
              user: {
                select: { id: true, name: true, username: true, displayUsername: true, image: true }
              }
            }
          },
          league: {
            select: { id: true, name: true, sportType: true }
          },
          division: {
            select: { id: true, name: true, gameType: true }
          },
          season: {
            select: { id: true, name: true }
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

  // Transform posts: add isLikedByUser and convert participants to team1Players/team2Players
  const transformedPosts = resultPosts.map(post => {
    const match = post.match as any;
    const participants = match?.participants || [];

    // Split participants into teams
    const team1Players = participants
      .filter((p: any) => p.team === 'team1')
      .map((p: any) => ({
        id: p.user.id,
        name: p.user.name,
        username: p.user.username || p.user.displayUsername,
        image: p.user.image,
      }));

    const team2Players = participants
      .filter((p: any) => p.team === 'team2')
      .map((p: any) => ({
        id: p.user.id,
        name: p.user.name,
        username: p.user.username || p.user.displayUsername,
        image: p.user.image,
      }));

    // Determine outcome based on scores
    const team1Score = match?.team1Score ?? 0;
    const team2Score = match?.team2Score ?? 0;
    const outcome = team1Score > team2Score ? 'team1' : team1Score < team2Score ? 'team2' : 'draw';

    // Parse setScores/gameScores from JSON
    let parsedSetScores: any[] = [];
    let parsedGameScores: any[] = [];
    
    if (match?.setScores) {
      try {
        const scoresData = Array.isArray(match.setScores) ? match.setScores : JSON.parse(match.setScores as string);
        
        // Determine if this is gameScores (pickleball) or setScores (tennis/padel)
        // Pickleball uses: gameNumber, team1Points, team2Points
        // Tennis/Padel uses: setNumber, team1Games, team2Games
        if (scoresData.length > 0) {
          const firstScore = scoresData[0];
          if ('gameNumber' in firstScore || 'team1Points' in firstScore) {
            // This is pickleball - move to gameScores
            parsedGameScores = scoresData;
            parsedSetScores = [];
          } else {
            // This is tennis/padel - keep in setScores
            parsedSetScores = scoresData;
            parsedGameScores = [];
          }
        }
      } catch (e) {
        console.error('Error parsing setScores:', e);
        parsedSetScores = [];
        parsedGameScores = [];
      }
    }

    return {
      ...post,
      isLikedByUser: currentUserId ? (post as any).likes?.length > 0 : false,
      likes: undefined,
      match: {
        id: match?.id,
        matchType: match?.matchType?.toLowerCase() || 'singles',
        matchDate: match?.matchDate,
        sport: match?.sport,
        team1Score,
        team2Score,
        outcome,
        setScores: parsedSetScores,
        gameScores: parsedGameScores,
        team1Players,
        team2Players,
        isWalkover: match?.isWalkover || false,
        location: match?.location,
        leagueName: (match as any)?.league?.name,
        seasonName: (match as any)?.season?.name,
        divisionName: (match as any)?.division?.name,
      },
    };
  });

  return { posts: transformedPosts as unknown as PostWithDetails[], nextCursor };
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
  postId: string;
  userId: string;
  text: string;
  createdAt: Date;
  user: { id: string; name: string | null; username: string | null; image: string | null };
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

  // Transform author to user to match frontend PostComment type
  return {
    id: comment.id,
    postId: comment.postId,
    userId: comment.authorId,
    text: comment.text,
    createdAt: comment.createdAt,
    user: {
      id: comment.author.id,
      name: comment.author.name,
      username: comment.author.username || comment.author.displayUsername,
      image: comment.author.image,
    }
  };
};

export const getPostComments = async (
  postId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Array<{
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: Date;
  user: { id: string; name: string | null; username: string | null; image: string | null };
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

  // Transform author to user to match frontend PostComment type
  return comments.map(comment => ({
    id: comment.id,
    postId: comment.postId,
    userId: comment.authorId,
    text: comment.text,
    createdAt: comment.createdAt,
    user: {
      id: comment.author.id,
      name: comment.author.name,
      username: comment.author.username || comment.author.displayUsername,
      image: comment.author.image,
    }
  }));
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
