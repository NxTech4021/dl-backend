import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import { BugStatus, BugPriority, BugSeverity, BugReportType } from "@prisma/client";
import { syncBugReportToSheet } from "../services/bug/googleSheetsSync";
import { notifyNewBugReport, notifyStatusChange } from "../services/bug/bugNotificationService";

// =============================================
// UTILITY FUNCTIONS
// =============================================

async function generateReportNumber(appId: string): Promise<string> {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) throw new Error("App not found");

  const lastReport = await prisma.bugReport.findFirst({
    where: { appId },
    orderBy: { createdAt: "desc" },
    select: { reportNumber: true },
  });

  let nextNumber = 1;
  if (lastReport) {
    const match = lastReport.reportNumber.match(/(\d+)$/);
    if (match && match[1]) nextNumber = parseInt(match[1]) + 1;
  }

  return `${app.code}-BUG-${nextNumber.toString().padStart(4, "0")}`;
}

// =============================================
// PUBLIC ENDPOINTS (Widget)
// =============================================

// Get modules for dropdown
export const getModulesByApp = async (req: Request, res: Response) => {
  const { appId } = req.params;

  try {
    const modules = await prisma.bugModule.findMany({
      where: { appId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
      },
    });
    res.json(modules);
  } catch (err: unknown) {
    console.error("Get Modules Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve modules.";
    res.status(500).json({ error: errorMessage });
  }
};

// Create bug report
export const createBugReport = async (req: Request, res: Response) => {
  const {
    appId,
    moduleId,
    module: moduleName, // Accept module as string
    title,
    description,
    reportType,
    severity,
    stepsToReproduce,
    expectedBehavior,
    actualBehavior,
    // Auto-captured context
    pageUrl,
    userAgent,
    browserName,
    browserVersion,
    osName,
    osVersion,
    screenWidth,
    screenHeight,
    appVersion,
    sessionId,
    consoleErrors,
    networkRequests,
  } = req.body;

  // Get reporter from auth
  const reporterId = (req as any).user?.id;
  if (!reporterId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  // Require either moduleId or module name
  if (!appId || (!moduleId && !moduleName) || !title || !description) {
    return res.status(400).json({ error: "appId, module/moduleId, title, and description are required." });
  }

  try {
    // Verify app exists
    const app = await prisma.app.findUnique({ where: { id: appId } });
    if (!app) return res.status(404).json({ error: "App not found." });

    // Find or create module
    let bugModule;
    if (moduleId) {
      bugModule = await prisma.bugModule.findUnique({ where: { id: moduleId } });
      if (!bugModule) return res.status(404).json({ error: "Module not found." });
    } else {
      // Find by name or create new
      bugModule = await prisma.bugModule.findFirst({
        where: { appId, name: { equals: moduleName, mode: "insensitive" } },
      });

      if (!bugModule) {
        // Create new module with the provided name
        const moduleCode = moduleName.toUpperCase().replace(/[^A-Z0-9]/g, "_").substring(0, 20);
        bugModule = await prisma.bugModule.create({
          data: {
            name: moduleName,
            code: moduleCode,
            description: `User-submitted module: ${moduleName}`,
            sortOrder: 100,
            app: { connect: { id: appId } },
          },
        });
      }
    }

    // Generate report number
    const reportNumber = await generateReportNumber(appId);

    // Get app settings for default assignee
    const settings = await prisma.bugReportSettings.findUnique({ where: { appId } });

    const bugReport = await prisma.bugReport.create({
      data: {
        reportNumber,
        title,
        description,
        reportType: reportType || BugReportType.BUG,
        severity: severity || BugSeverity.MEDIUM,
        stepsToReproduce,
        expectedBehavior,
        actualBehavior,
        // Context
        pageUrl,
        userAgent,
        browserName,
        browserVersion,
        osName,
        osVersion,
        screenWidth,
        screenHeight,
        appVersion,
        sessionId,
        consoleErrors,
        networkRequests,
        // Relations
        app: { connect: { id: appId } },
        module: { connect: { id: bugModule.id } },
        reporter: { connect: { id: reporterId } },
        // Default assignee from settings
        ...(settings?.defaultAssigneeId && {
          assignedTo: { connect: { id: settings.defaultAssigneeId } },
        }),
        // Default priority from settings
        priority: settings?.defaultPriority || BugPriority.NORMAL,
      },
      include: {
        app: { select: { code: true, displayName: true } },
        module: { select: { name: true, code: true } },
        reporter: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, user: { select: { name: true, email: true } } } },
      },
    });

    // Create initial status change record
    await prisma.bugStatusChange.create({
      data: {
        bugReport: { connect: { id: bugReport.id } },
        newStatus: BugStatus.NEW,
        changedBy: { connect: { id: reporterId } },
        notes: "Bug report created",
      },
    });

    // Send notifications and sync to Google Sheets (async, don't wait)
    notifyNewBugReport(bugReport.id).catch(console.error);
    syncBugReportToSheet(bugReport.id).catch(console.error);

    res.status(201).json(bugReport);
  } catch (err: unknown) {
    console.error("Create Bug Report Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to create bug report.";
    res.status(500).json({ error: errorMessage });
  }
};

// Get user's bug reports
export const getMyBugReports = async (req: Request, res: Response) => {
  const reporterId = (req as any).user?.id;
  if (!reporterId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const reports = await prisma.bugReport.findMany({
      where: { reporterId },
      orderBy: { createdAt: "desc" },
      include: {
        app: { select: { code: true, displayName: true } },
        module: { select: { name: true } },
        assignedTo: { select: { user: { select: { name: true } } } },
        _count: { select: { comments: true, screenshots: true } },
      },
    });
    res.json(reports);
  } catch (err: unknown) {
    console.error("Get My Bug Reports Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve bug reports.";
    res.status(500).json({ error: errorMessage });
  }
};

// Get single bug report
export const getBugReportById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  if (!id) return res.status(400).json({ error: "Bug report ID is required." });

  try {
    const report = await prisma.bugReport.findUnique({
      where: { id },
      include: {
        app: { select: { code: true, displayName: true } },
        module: { select: { name: true, code: true } },
        reporter: { select: { id: true, name: true, email: true, image: true } },
        assignedTo: { select: { id: true, user: { select: { name: true, email: true } } } },
        resolvedBy: { select: { user: { select: { name: true } } } },
        screenshots: true,
        comments: {
          where: { isInternal: false }, // Only show public comments to reporter
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true, image: true } },
          },
        },
        statusChanges: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            changedBy: { select: { name: true } },
          },
        },
      },
    });

    if (!report) return res.status(404).json({ error: "Bug report not found." });

    // Check access: reporter can view, or if public
    if (report.reporterId !== userId && !report.isPublic) {
      return res.status(403).json({ error: "Access denied." });
    }

    // Increment view count
    await prisma.bugReport.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    res.json(report);
  } catch (err: unknown) {
    console.error("Get Bug Report Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve bug report.";
    res.status(500).json({ error: errorMessage });
  }
};

// Add comment to bug report
export const addComment = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, parentId } = req.body;
  const authorId = (req as any).user?.id;

  if (!authorId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  if (!id || !content) {
    return res.status(400).json({ error: "Bug report ID and content are required." });
  }

  try {
    const report = await prisma.bugReport.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: "Bug report not found." });

    // Check if user can comment (reporter or admin)
    if (report.reporterId !== authorId) {
      // Check if admin
      const admin = await prisma.admin.findUnique({ where: { userId: authorId } });
      if (!admin) {
        return res.status(403).json({ error: "Access denied." });
      }
    }

    const comment = await prisma.bugComment.create({
      data: {
        content,
        isInternal: false,
        bugReport: { connect: { id } },
        author: { connect: { id: authorId } },
        ...(parentId && { parent: { connect: { id: parentId } } }),
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    res.status(201).json(comment);
  } catch (err: unknown) {
    console.error("Add Comment Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to add comment.";
    res.status(500).json({ error: errorMessage });
  }
};

// Upload screenshot
export const uploadScreenshot = async (req: Request, res: Response) => {
  const { bugReportId, fileName, fileSize, mimeType, imageUrl, thumbnailUrl, width, height, caption } = req.body;

  if (!bugReportId || !fileName || !imageUrl) {
    return res.status(400).json({ error: "bugReportId, fileName, and imageUrl are required." });
  }

  try {
    const report = await prisma.bugReport.findUnique({ where: { id: bugReportId } });
    if (!report) return res.status(404).json({ error: "Bug report not found." });

    // Check max screenshots from settings
    const settings = await prisma.bugReportSettings.findUnique({ where: { appId: report.appId } });
    const maxScreenshots = settings?.maxScreenshots || 5;

    const currentCount = await prisma.bugScreenshot.count({ where: { bugReportId } });
    if (currentCount >= maxScreenshots) {
      return res.status(400).json({ error: `Maximum ${maxScreenshots} screenshots allowed.` });
    }

    const screenshot = await prisma.bugScreenshot.create({
      data: {
        fileName,
        fileSize: fileSize || 0,
        mimeType: mimeType || "image/png",
        imageUrl,
        thumbnailUrl,
        width,
        height,
        caption,
        bugReport: { connect: { id: bugReportId } },
      },
    });

    res.status(201).json(screenshot);
  } catch (err: unknown) {
    console.error("Upload Screenshot Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to upload screenshot.";
    res.status(500).json({ error: errorMessage });
  }
};

// =============================================
// ADMIN ENDPOINTS
// =============================================

// Get all bug reports (admin)
export const getAllBugReports = async (req: Request, res: Response) => {
  const {
    appId,
    status,
    priority,
    severity,
    moduleId,
    assignedToId,
    reporterId,
    search,
    page = "1",
    limit = "20",
  } = req.query;

  try {
    const where: any = {};

    if (appId) where.appId = appId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (severity) where.severity = severity;
    if (moduleId) where.moduleId = moduleId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (reporterId) where.reporterId = reporterId;

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
        { reportNumber: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [reports, total] = await Promise.all([
      prisma.bugReport.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          app: { select: { code: true, displayName: true } },
          module: { select: { name: true } },
          reporter: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, user: { select: { name: true } } } },
          _count: { select: { comments: true, screenshots: true } },
        },
      }),
      prisma.bugReport.count({ where }),
    ]);

    res.json({
      data: reports,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (err: unknown) {
    console.error("Get All Bug Reports Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve bug reports.";
    res.status(500).json({ error: errorMessage });
  }
};

// Get bug report details (admin)
export const getAdminBugReportById = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ error: "Bug report ID is required." });

  try {
    const report = await prisma.bugReport.findUnique({
      where: { id },
      include: {
        app: { select: { code: true, displayName: true } },
        module: { select: { name: true, code: true } },
        reporter: { select: { id: true, name: true, email: true, image: true } },
        assignedTo: { select: { id: true, user: { select: { name: true, email: true } } } },
        resolvedBy: { select: { user: { select: { name: true } } } },
        duplicateOf: { select: { id: true, reportNumber: true, title: true } },
        screenshots: true,
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true, image: true } },
            replies: {
              include: {
                author: { select: { id: true, name: true, image: true } },
              },
            },
          },
        },
        statusChanges: {
          orderBy: { createdAt: "desc" },
          include: {
            changedBy: { select: { name: true } },
          },
        },
      },
    });

    if (!report) return res.status(404).json({ error: "Bug report not found." });

    // Increment view count
    await prisma.bugReport.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    res.json(report);
  } catch (err: unknown) {
    console.error("Get Admin Bug Report Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve bug report.";
    res.status(500).json({ error: errorMessage });
  }
};

// Update bug report (admin)
export const updateBugReport = async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminUserId = (req as any).user?.id;
  const {
    status,
    priority,
    assignedToId,
    resolutionNotes,
    rootCause,
    externalTicketUrl,
    isPublic,
  } = req.body;

  if (!id) return res.status(400).json({ error: "Bug report ID is required." });

  try {
    const existingReport = await prisma.bugReport.findUnique({ where: { id } });
    if (!existingReport) return res.status(404).json({ error: "Bug report not found." });

    const updateData: any = {};
    let statusChanged = false;
    let priorityChanged = false;

    if (status !== undefined && status !== existingReport.status) {
      updateData.status = status;
      statusChanged = true;

      // If resolved, set resolved fields
      if (status === BugStatus.RESOLVED || status === BugStatus.CLOSED) {
        const admin = await prisma.admin.findUnique({ where: { userId: adminUserId } });
        if (admin) {
          updateData.resolvedById = admin.id;
          updateData.resolvedAt = new Date();
          // Calculate time to resolve
          const created = new Date(existingReport.createdAt);
          const resolved = new Date();
          updateData.timeToResolve = Math.floor((resolved.getTime() - created.getTime()) / 60000);
        }
      }
    }

    if (priority !== undefined && priority !== existingReport.priority) {
      updateData.priority = priority;
      priorityChanged = true;
    }

    if (assignedToId !== undefined) {
      updateData.assignedTo = assignedToId
        ? { connect: { id: assignedToId } }
        : { disconnect: true };
    }

    if (resolutionNotes !== undefined) updateData.resolutionNotes = resolutionNotes;
    if (rootCause !== undefined) updateData.rootCause = rootCause;
    if (externalTicketUrl !== undefined) updateData.externalTicketUrl = externalTicketUrl;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const report = await prisma.bugReport.update({
      where: { id },
      data: updateData,
      include: {
        app: { select: { code: true, displayName: true } },
        module: { select: { name: true } },
        reporter: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, user: { select: { name: true } } } },
      },
    });

    // Create status change record
    if (statusChanged || priorityChanged) {
      await prisma.bugStatusChange.create({
        data: {
          bugReport: { connect: { id } },
          previousStatus: statusChanged ? existingReport.status : undefined,
          newStatus: status || existingReport.status,
          previousPriority: priorityChanged ? existingReport.priority : undefined,
          newPriority: priority || existingReport.priority,
          changedBy: { connect: { id: adminUserId } },
        },
      });
    }

    // Send notifications and sync (async, don't wait)
    if (statusChanged) {
      notifyStatusChange(id, existingReport.status, status).catch(console.error);
    }
    syncBugReportToSheet(id).catch(console.error);

    res.json(report);
  } catch (err: unknown) {
    console.error("Update Bug Report Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to update bug report.";
    res.status(500).json({ error: errorMessage });
  }
};

// Add admin comment (can be internal)
export const addAdminComment = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, isInternal, parentId } = req.body;
  const authorId = (req as any).user?.id;

  if (!id || !content) {
    return res.status(400).json({ error: "Bug report ID and content are required." });
  }

  try {
    const report = await prisma.bugReport.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: "Bug report not found." });

    const comment = await prisma.bugComment.create({
      data: {
        content,
        isInternal: isInternal || false,
        bugReport: { connect: { id } },
        author: { connect: { id: authorId } },
        ...(parentId && { parent: { connect: { id: parentId } } }),
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    res.status(201).json(comment);
  } catch (err: unknown) {
    console.error("Add Admin Comment Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to add comment.";
    res.status(500).json({ error: errorMessage });
  }
};

// Mark as duplicate
export const markAsDuplicate = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { duplicateOfId } = req.body;
  const adminUserId = (req as any).user?.id;

  if (!id || !duplicateOfId) {
    return res.status(400).json({ error: "Bug report ID and duplicateOfId are required." });
  }

  try {
    const [report, duplicateOf] = await Promise.all([
      prisma.bugReport.findUnique({ where: { id } }),
      prisma.bugReport.findUnique({ where: { id: duplicateOfId } }),
    ]);

    if (!report) return res.status(404).json({ error: "Bug report not found." });
    if (!duplicateOf) return res.status(404).json({ error: "Duplicate target not found." });

    const updatedReport = await prisma.bugReport.update({
      where: { id },
      data: {
        status: BugStatus.DUPLICATE,
        duplicateOf: { connect: { id: duplicateOfId } },
      },
    });

    // Create status change record
    await prisma.bugStatusChange.create({
      data: {
        bugReport: { connect: { id } },
        previousStatus: report.status,
        newStatus: BugStatus.DUPLICATE,
        changedBy: { connect: { id: adminUserId } },
        notes: `Marked as duplicate of ${duplicateOf.reportNumber}`,
      },
    });

    res.json(updatedReport);
  } catch (err: unknown) {
    console.error("Mark as Duplicate Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to mark as duplicate.";
    res.status(500).json({ error: errorMessage });
  }
};

// Delete bug report
export const deleteBugReport = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ error: "Bug report ID is required." });

  try {
    const report = await prisma.bugReport.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: "Bug report not found." });

    await prisma.bugReport.delete({ where: { id } });
    res.json({ message: "Bug report deleted successfully." });
  } catch (err: unknown) {
    console.error("Delete Bug Report Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to delete bug report.";
    res.status(500).json({ error: errorMessage });
  }
};

// Get bug statistics
export const getBugStats = async (req: Request, res: Response) => {
  const { appId } = req.query;

  try {
    const where = appId ? { appId: appId as string } : {};

    const [
      total,
      byStatus,
      bySeverity,
      byPriority,
      recentlyCreated,
      avgResolutionTime,
    ] = await Promise.all([
      prisma.bugReport.count({ where }),
      prisma.bugReport.groupBy({
        by: ["status"],
        where,
        _count: true,
      }),
      prisma.bugReport.groupBy({
        by: ["severity"],
        where,
        _count: true,
      }),
      prisma.bugReport.groupBy({
        by: ["priority"],
        where,
        _count: true,
      }),
      prisma.bugReport.count({
        where: {
          ...where,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.bugReport.aggregate({
        where: { ...where, timeToResolve: { not: null } },
        _avg: { timeToResolve: true },
      }),
    ]);

    res.json({
      total,
      byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item.status]: item._count }), {}),
      bySeverity: bySeverity.reduce((acc, item) => ({ ...acc, [item.severity]: item._count }), {}),
      byPriority: byPriority.reduce((acc, item) => ({ ...acc, [item.priority]: item._count }), {}),
      recentlyCreated,
      avgResolutionTimeMinutes: avgResolutionTime._avg.timeToResolve || 0,
    });
  } catch (err: unknown) {
    console.error("Get Bug Stats Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve statistics.";
    res.status(500).json({ error: errorMessage });
  }
};

// =============================================
// APP & MODULE MANAGEMENT
// =============================================

// Get all apps
export const getApps = async (req: Request, res: Response) => {
  try {
    const apps = await prisma.app.findMany({
      where: { isActive: true },
      orderBy: { displayName: "asc" },
      include: {
        _count: { select: { bugReports: true, bugModules: true } },
      },
    });
    res.json(apps);
  } catch (err: unknown) {
    console.error("Get Apps Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve apps.";
    res.status(500).json({ error: errorMessage });
  }
};

// Create app
export const createApp = async (req: Request, res: Response) => {
  const { code, name, displayName, description, appUrl, logoUrl } = req.body;

  if (!code || !name || !displayName) {
    return res.status(400).json({ error: "code, name, and displayName are required." });
  }

  try {
    const app = await prisma.app.create({
      data: {
        code: code.toUpperCase(),
        name,
        displayName,
        description,
        appUrl,
        logoUrl,
      },
    });
    res.status(201).json(app);
  } catch (err: unknown) {
    console.error("Create App Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to create app.";
    res.status(500).json({ error: errorMessage });
  }
};

// Create module
export const createModule = async (req: Request, res: Response) => {
  const { appId } = req.params;
  const { name, code, description, sortOrder } = req.body;

  if (!appId || !name || !code) {
    return res.status(400).json({ error: "appId, name, and code are required." });
  }

  try {
    const app = await prisma.app.findUnique({ where: { id: appId } });
    if (!app) return res.status(404).json({ error: "App not found." });

    const module = await prisma.bugModule.create({
      data: {
        name,
        code: code.toUpperCase(),
        description,
        sortOrder: sortOrder || 0,
        app: { connect: { id: appId } },
      },
    });
    res.status(201).json(module);
  } catch (err: unknown) {
    console.error("Create Module Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to create module.";
    res.status(500).json({ error: errorMessage });
  }
};

// Get app settings
export const getAppSettings = async (req: Request, res: Response) => {
  const { appId } = req.params;

  try {
    let settings = await prisma.bugReportSettings.findUnique({
      where: { appId },
      include: {
        defaultAssignee: { select: { user: { select: { name: true, email: true } } } },
      },
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.bugReportSettings.create({
        data: { appId },
        include: {
          defaultAssignee: { select: { user: { select: { name: true, email: true } } } },
        },
      });
    }

    res.json(settings);
  } catch (err: unknown) {
    console.error("Get App Settings Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to retrieve settings.";
    res.status(500).json({ error: errorMessage });
  }
};

// Update app settings
export const updateAppSettings = async (req: Request, res: Response) => {
  const { appId } = req.params;
  const {
    enableScreenshots,
    enableAutoCapture,
    enableConsoleCapture,
    enableNetworkCapture,
    maxScreenshots,
    maxFileSize,
    notifyEmails,
    slackWebhookUrl,
    discordWebhookUrl,
    notifyOnNew,
    notifyOnStatusChange,
    googleSheetId,
    googleSheetName,
    syncEnabled,
    defaultAssigneeId,
    defaultPriority,
  } = req.body;

  try {
    const settings = await prisma.bugReportSettings.upsert({
      where: { appId },
      create: {
        appId,
        enableScreenshots,
        enableAutoCapture,
        enableConsoleCapture,
        enableNetworkCapture,
        maxScreenshots,
        maxFileSize,
        notifyEmails,
        slackWebhookUrl,
        discordWebhookUrl,
        notifyOnNew,
        notifyOnStatusChange,
        googleSheetId,
        googleSheetName,
        syncEnabled,
        defaultAssigneeId,
        defaultPriority,
      },
      update: {
        enableScreenshots,
        enableAutoCapture,
        enableConsoleCapture,
        enableNetworkCapture,
        maxScreenshots,
        maxFileSize,
        notifyEmails,
        slackWebhookUrl,
        discordWebhookUrl,
        notifyOnNew,
        notifyOnStatusChange,
        googleSheetId,
        googleSheetName,
        syncEnabled,
        defaultAssigneeId,
        defaultPriority,
      },
      include: {
        defaultAssignee: { select: { user: { select: { name: true, email: true } } } },
      },
    });

    res.json(settings);
  } catch (err: unknown) {
    console.error("Update App Settings Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to update settings.";
    res.status(500).json({ error: errorMessage });
  }
};
