import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { sendSuccess, sendPaginated, sendError } from '../utils/response';

const MAX_STACK_TRACE_LENGTH = 10000;
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

function sanitizeTrace(trace: string | undefined): string | undefined {
  if (!trace) return undefined;
  return trace
    .replace(/Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g, 'Bearer [REDACTED]')
    .replace(/password['":\s]*['"][^'"]+['"]/gi, 'password: "[REDACTED]"')
    .replace(/token['":\s]*['"][^'"]+['"]/gi, 'token: "[REDACTED]"')
    .slice(0, MAX_STACK_TRACE_LENGTH);
}

export const createCrashReport = async (req: Request, res: Response) => {
  try {
    const {
      type, errorMessage, stackTrace, componentStack,
      screenName, platform, osVersion, appVersion,
      deviceModel, buildType, severity,
    } = req.body;

    if (!type || !errorMessage || !platform) {
      return sendError(res, 'type, errorMessage, and platform are required.', 400);
    }

    const validTypes = ['JS_ERROR', 'RENDER_ERROR', 'UNHANDLED_REJECTION', 'SESSION_LOST'];
    if (!validTypes.includes(type)) {
      return sendError(res, `Invalid type. Must be one of: ${validTypes.join(', ')}`, 400);
    }

    const userId = (req as any).user?.id || null;

    // Dedup: same error + screen + version within 5 minutes
    const dedupeWindow = new Date(Date.now() - DEDUP_WINDOW_MS);
    const existing = await prisma.crashReport.findFirst({
      where: {
        errorMessage: errorMessage.slice(0, 500),
        screenName: screenName || null,
        appVersion: appVersion || null,
        lastSeenAt: { gte: dedupeWindow },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (existing) {
      const updated = await prisma.crashReport.update({
        where: { id: existing.id },
        data: {
          occurrenceCount: { increment: 1 },
          lastSeenAt: new Date(),
          ...(userId && !existing.userId ? { userId } : {}),
        },
      });
      return sendSuccess(res, { id: updated.id, deduplicated: true }, 'Crash report updated.', 200);
    }

    const effectiveSeverity = severity || (
      type === 'RENDER_ERROR' || type === 'JS_ERROR' ? 'HIGH' : 'MEDIUM'
    );

    const sanitizedStackTrace = sanitizeTrace(stackTrace);
    const sanitizedComponentStack = sanitizeTrace(componentStack);
    const report = await prisma.crashReport.create({
      data: {
        userId,
        type,
        errorMessage: errorMessage.slice(0, 2000),
        ...(sanitizedStackTrace ? { stackTrace: sanitizedStackTrace } : {}),
        ...(sanitizedComponentStack ? { componentStack: sanitizedComponentStack } : {}),
        screenName: screenName?.slice(0, 200) || null,
        platform: platform.slice(0, 20),
        osVersion: osVersion?.slice(0, 30) || null,
        appVersion: appVersion?.slice(0, 30) || null,
        deviceModel: deviceModel?.slice(0, 100) || null,
        buildType: buildType?.slice(0, 30) || null,
        severity: effectiveSeverity,
      },
    });

    return sendSuccess(res, { id: report.id }, 'Crash report recorded.', 201);
  } catch (error) {
    console.error('Error creating crash report:', error);
    return sendError(res, 'Failed to record crash report.', 500);
  }
};

export const getCrashReports = async (req: Request, res: Response) => {
  try {
    const {
      page = '1', limit = '20',
      type, severity, resolved, screenName,
      startDate, endDate, userId, search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (resolved !== undefined) where.resolved = resolved === 'true';
    if (screenName) where.screenName = screenName;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }
    if (search) {
      where.errorMessage = { contains: search as string, mode: 'insensitive' };
    }

    const [reports, total] = await Promise.all([
      prisma.crashReport.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { lastSeenAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.crashReport.count({ where }),
    ]);

    return sendPaginated(res, reports, {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Error fetching crash reports:', error);
    return sendError(res, 'Failed to fetch crash reports.', 500);
  }
};

export const getCrashReportById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return sendError(res, 'ID required', 400);
    const report = await prisma.crashReport.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    if (!report) return sendError(res, 'Crash report not found.', 404);
    return sendSuccess(res, report);
  } catch (error) {
    console.error('Error fetching crash report:', error);
    return sendError(res, 'Failed to fetch crash report.', 500);
  }
};

export const updateCrashReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return sendError(res, 'ID required', 400);
    const { resolved, notes } = req.body;

    const updateData: any = {};
    if (resolved !== undefined) {
      updateData.resolved = resolved;
      if (resolved) {
        updateData.resolvedAt = new Date();
        updateData.resolvedById = (req as any).user?.id || null;
      } else {
        updateData.resolvedAt = null;
        updateData.resolvedById = null;
      }
    }
    if (notes !== undefined) updateData.notes = notes;

    const report = await prisma.crashReport.update({
      where: { id },
      data: updateData,
    });

    return sendSuccess(res, report, 'Crash report updated.');
  } catch (error) {
    console.error('Error updating crash report:', error);
    return sendError(res, 'Failed to update crash report.', 500);
  }
};

export const getCrashStats = async (req: Request, res: Response) => {
  try {
    const [total, open, byType, byScreen, bySeverity] = await Promise.all([
      prisma.crashReport.count(),
      prisma.crashReport.count({ where: { resolved: false } }),
      prisma.crashReport.groupBy({ by: ['type'], _count: true, orderBy: { _count: { type: 'desc' } } }),
      prisma.crashReport.groupBy({ by: ['screenName'], _count: true, where: { screenName: { not: null } }, orderBy: { _count: { screenName: 'desc' } }, take: 10 }),
      prisma.crashReport.groupBy({ by: ['severity'], _count: true }),
    ]);

    const sessionLost = await prisma.crashReport.count({ where: { type: 'SESSION_LOST', resolved: false } });
    const last24h = await prisma.crashReport.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    return sendSuccess(res, {
      total, open, sessionLost, last24h,
      byType: byType.map(t => ({ type: t.type, count: t._count })),
      byScreen: byScreen.map(s => ({ screen: s.screenName, count: s._count })),
      bySeverity: bySeverity.map(s => ({ severity: s.severity, count: s._count })),
    });
  } catch (error) {
    console.error('Error fetching crash stats:', error);
    return sendError(res, 'Failed to fetch crash stats.', 500);
  }
};
