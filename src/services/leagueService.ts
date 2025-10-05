import { PrismaClient, League, LeagueSettings, LeagueJoinRequest, LeagueTemplate, Prisma } from "@prisma/client";
import {
  CreateLeagueInput,
  UpdateLeagueInput,
  ListLeaguesInput,
  LeagueSettingsInput,
  CreateLeagueJoinRequestInput,
  UpdateLeagueJoinRequestStatusInput,
  CreateLeagueTemplateInput,
  BulkCreateLeaguesInput,
  CopyLeagueSettingsInput,
} from "../validators/leagueValidation";
import { emailService } from "./emailService";

const prisma = new PrismaClient();

export class LeagueService {
  // Default settings for new leagues
  private readonly DEFAULT_SETTINGS = {
    durationUnit: "WEEKS" as const,
    durationValue: 8,
    minPlayersPerDivision: 4,
    maxPlayersPerDivision: 16,
    registrationDeadlineDays: 7,
    paymentSettings: {
      fees: { percentage: 0, flat: 0 },
      refundPolicy: "Standard refund within 7 days of league start",
      paymentMethods: ["credit_card", "bank_transfer"],
    },
    divisionRules: {
      ratingRanges: [],
      allowManualAssignment: true,
    },
    playoffConfiguration: {
      enabled: true,
      format: "single_elimination",
      seededBy: "regular_season",
    },
    finalsConfiguration: {
      bestOf: 3,
      venue: "TBD",
    },
    workflowConfiguration: {
      statuses: ["DRAFT", "REGISTRATION", "ACTIVE", "COMPLETED"],
      allowSkipRegistration: false,
    },
    archiveRetentionMonths: 12,
    validationRules: {
      enforceUniqueLeagueNamePerSport: true,
      requirePaymentSettings: false,
    },
    errorHandling: {
      notifyOnFailure: true,
      escalationEmails: [],
    },
  };

  // League CRUD operations
  async createLeague(data: CreateLeagueInput, adminId?: string): Promise<League> {
    // Check for unique league name per sport if validation is enabled
    const existingLeague = await prisma.league.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        sport: { equals: data.sport, mode: "insensitive" },
        isArchived: false,
      },
    });

    if (existingLeague) {
      throw new Error("A league with this name already exists for this sport.");
    }

    const league = await prisma.league.create({
      data: {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create default settings for the league
    await this.ensureLeagueSettings(league.id);

    return league;
  }

  async getLeagues(filters: ListLeaguesInput): Promise<{
    items: (League & { settings: LeagueSettings | null; _count: { seasons: number; joinRequests: number } })[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    const pageNumber = Math.max(parseInt(filters.page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(filters.pageSize, 10) || 20, 1), 100);
    const skip = (pageNumber - 1) * take;

    const where: Prisma.LeagueWhereInput = {};

    if (filters.search?.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { location: { contains: term, mode: "insensitive" } },
      ];
    }

    if (filters.sport?.trim()) {
      where.sport = { equals: filters.sport.trim(), mode: "insensitive" };
    }

    if (filters.status?.trim()) {
      const upperStatus = filters.status.toUpperCase();
      if (["DRAFT", "REGISTRATION", "ACTIVE", "COMPLETED", "CANCELLED", "ARCHIVED"].includes(upperStatus)) {
        where.status = upperStatus as any;
      }
    }

    if (filters.location?.trim()) {
      where.location = { contains: filters.location.trim(), mode: "insensitive" };
    }

    const [leagues, total] = await prisma.$transaction([
      prisma.league.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take,
        include: {
          settings: true,
          _count: {
            select: { seasons: true, joinRequests: true },
          },
        },
      }),
      prisma.league.count({ where }),
    ]);

    return {
      items: leagues,
      meta: {
        total,
        page: pageNumber,
        pageSize: take,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  async getLeagueById(leagueId: string): Promise<League & {
    settings: LeagueSettings | null;
    seasons: any[];
    _count: { joinRequests: number }
  } | null> {
    return await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        settings: true,
        seasons: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        _count: {
          select: { joinRequests: true },
        },
      },
    });
  }

  async updateLeague(leagueId: string, data: UpdateLeagueInput): Promise<League> {
    const existing = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!existing) {
      throw new Error("League not found.");
    }

    // Check for unique name if updating name
    if (data.name && data.name !== existing.name) {
      const existingLeague = await prisma.league.findFirst({
        where: {
          id: { not: leagueId },
          name: { equals: data.name, mode: "insensitive" },
          sport: { equals: data.sport || existing.sport, mode: "insensitive" },
          isArchived: false,
        },
      });

      if (existingLeague) {
        throw new Error("A league with this name already exists for this sport.");
      }
    }

    const updates: Prisma.LeagueUpdateInput = { ...data, updatedAt: new Date() };

    if (data.isArchived !== undefined) {
      updates.archivedAt = data.isArchived ? new Date() : null;
    }

    return await prisma.league.update({
      where: { id: leagueId },
      data: updates,
    });
  }

  async deleteLeague(leagueId: string): Promise<void> {
    const seasonCount = await prisma.season.count({ where: { leagueId } });
    if (seasonCount > 0) {
      throw new Error("Cannot delete a league that has one or more seasons.");
    }

    await prisma.$transaction([
      prisma.leagueSettings.deleteMany({ where: { leagueId } }),
      prisma.leagueJoinRequest.deleteMany({ where: { leagueId } }),
      prisma.league.delete({ where: { id: leagueId } }),
    ]);
  }

  // League Settings operations
  async ensureLeagueSettings(leagueId: string): Promise<LeagueSettings> {
    const existing = await prisma.leagueSettings.findUnique({
      where: { leagueId },
    });

    if (existing) {
      return existing;
    }

    return await prisma.leagueSettings.create({
      data: {
        leagueId,
        durationUnit: this.DEFAULT_SETTINGS.durationUnit,
        durationValue: this.DEFAULT_SETTINGS.durationValue,
        minPlayersPerDivision: this.DEFAULT_SETTINGS.minPlayersPerDivision,
        maxPlayersPerDivision: this.DEFAULT_SETTINGS.maxPlayersPerDivision,
        registrationDeadlineDays: this.DEFAULT_SETTINGS.registrationDeadlineDays,
        paymentSettings: this.DEFAULT_SETTINGS.paymentSettings as Prisma.JsonObject,
        divisionRules: this.DEFAULT_SETTINGS.divisionRules as Prisma.JsonObject,
        playoffConfiguration: this.DEFAULT_SETTINGS.playoffConfiguration as Prisma.JsonObject,
        finalsConfiguration: this.DEFAULT_SETTINGS.finalsConfiguration as Prisma.JsonObject,
        workflowConfiguration: this.DEFAULT_SETTINGS.workflowConfiguration as Prisma.JsonObject,
        archiveRetentionMonths: this.DEFAULT_SETTINGS.archiveRetentionMonths,
        validationRules: this.DEFAULT_SETTINGS.validationRules as Prisma.JsonObject,
        errorHandling: this.DEFAULT_SETTINGS.errorHandling as Prisma.JsonObject,
      },
    });
  }

  async getLeagueSettings(leagueId: string): Promise<{
    settings: LeagueSettings;
    audits: any[];
  }> {
    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) {
      throw new Error("League not found.");
    }

    const settings = await this.ensureLeagueSettings(leagueId);
    const audits = await prisma.leagueSettingsAudit.findMany({
      where: { settingsId: settings.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        admin: { select: { id: true, name: true, email: true } },
      },
    });

    return { settings, audits };
  }

  async updateLeagueSettings(
    leagueId: string,
    data: LeagueSettingsInput,
    adminId?: string
  ): Promise<LeagueSettings> {
    const existingSettings = await this.ensureLeagueSettings(leagueId);

    const updates: Prisma.LeagueSettingsUpdateInput = {};

    // Process each field in the data
    Object.keys(data).forEach((key) => {
      const value = (data as any)[key];
      if (value !== undefined) {
        if (
          [
            "paymentSettings",
            "divisionRules",
            "playoffConfiguration",
            "finalsConfiguration",
            "workflowConfiguration",
            "templates",
            "branding",
            "integrationSettings",
            "bulkOperations",
            "validationRules",
            "errorHandling",
            "previewPayload",
          ].includes(key)
        ) {
          updates[key as keyof Prisma.LeagueSettingsUpdateInput] = value as Prisma.InputJsonValue;
        } else {
          updates[key as keyof Prisma.LeagueSettingsUpdateInput] = value;
        }
      }
    });

    if (Object.keys(updates).length === 0) {
      throw new Error("No valid settings provided.");
    }

    const updated = await prisma.leagueSettings.update({
      where: { id: existingSettings.id },
      data: updates,
    });

    // Create audit record
    await prisma.leagueSettingsAudit.create({
      data: {
        settingsId: updated.id,
        adminId,
        changes: {
          updatedFields: Object.keys(updates),
          appliedAt: new Date().toISOString(),
        } as Prisma.JsonObject,
      },
    });

    return updated;
  }

  async previewLeagueSettings(
    leagueId: string,
    previewPayload: any,
    expiresInMinutes: number = 30
  ): Promise<LeagueSettings> {
    const settings = await this.ensureLeagueSettings(leagueId);
    const previewExpiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    return await prisma.leagueSettings.update({
      where: { id: settings.id },
      data: {
        previewPayload: previewPayload as Prisma.InputJsonValue,
        previewExpiresAt,
      },
    });
  }

  // Join Request operations
  async getLeagueJoinRequests(
    leagueId: string,
    filters: { status?: string; search?: string }
  ): Promise<LeagueJoinRequest[]> {
    const where: Prisma.LeagueJoinRequestWhereInput = { leagueId };

    if (filters.status?.trim()) {
      const upperStatus = filters.status.toUpperCase();
      if (["PENDING", "APPROVED", "DENIED"].includes(upperStatus)) {
        where.status = upperStatus as any;
      }
    }

    if (filters.search?.trim()) {
      const term = filters.search.trim();
      where.user = {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { username: { contains: term, mode: "insensitive" } },
        ],
      };
    }

    return await prisma.leagueJoinRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        user: { select: { id: true, name: true, email: true, username: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async createLeagueJoinRequest(
    leagueId: string,
    data: CreateLeagueJoinRequestInput
  ): Promise<LeagueJoinRequest> {
    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) {
      throw new Error("League not found.");
    }

    const existingRequest = await prisma.leagueJoinRequest.findUnique({
      where: { leagueId_userId: { leagueId, userId: data.userId } },
    });

    if (existingRequest) {
      throw new Error("Join request already exists.");
    }

    return await prisma.leagueJoinRequest.create({
      data: {
        leagueId,
        userId: data.userId,
        notes: data.notes,
        status: "PENDING",
      },
    });
  }

  async updateLeagueJoinRequestStatus(
    leagueId: string,
    requestId: string,
    data: UpdateLeagueJoinRequestStatusInput,
    adminId?: string
  ): Promise<LeagueJoinRequest> {
    const requestRecord = await prisma.leagueJoinRequest.findFirst({
      where: { id: requestId, leagueId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        league: { select: { id: true, name: true } },
      },
    });

    if (!requestRecord) {
      throw new Error("Join request not found.");
    }

    const updated = await prisma.leagueJoinRequest.update({
      where: { id: requestRecord.id },
      data: {
        status: data.status,
        decisionReason: data.status === "DENIED" ? data.decisionReason : requestRecord.decisionReason,
        decidedById: adminId,
        decidedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
        league: { select: { id: true, name: true } },
      },
    });

    // Send email notification
    await this.sendJoinRequestNotification(updated);

    return updated;
  }

  private async sendJoinRequestNotification(request: any): Promise<void> {
    try {
      const isApproved = request.status === "APPROVED";
      const subject = isApproved
        ? `League Join Request Approved - ${request.league.name}`
        : `League Join Request Denied - ${request.league.name}`;

      const message = isApproved
        ? `Congratulations! Your request to join "${request.league.name}" has been approved.`
        : `Your request to join "${request.league.name}" has been denied. ${request.decisionReason ? `Reason: ${request.decisionReason}` : ''}`;

      await emailService.sendEmail({
        to: request.user.email,
        subject,
        text: message,
        html: `
          <h2>${subject}</h2>
          <p>Hello ${request.user.name},</p>
          <p>${message}</p>
          ${isApproved ? '<p>You can now access the league and view its details.</p>' : ''}
          <p>Best regards,<br/>The League Management Team</p>
        `,
      });
    } catch (error) {
      console.error("Failed to send join request notification:", error);
    }
  }

  // Template operations
  async getLeagueTemplates(): Promise<LeagueTemplate[]> {
    return await prisma.leagueTemplate.findMany({
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async createLeagueTemplate(
    data: CreateLeagueTemplateInput,
    adminId?: string
  ): Promise<LeagueTemplate> {
    return await prisma.leagueTemplate.create({
      data: {
        ...data,
        createdById: adminId,
      },
    });
  }

  // Bulk operations
  async bulkCreateLeagues(
    data: BulkCreateLeaguesInput,
    adminId?: string
  ): Promise<League[]> {
    const results: League[] = [];

    // Get source league settings if specified
    let sourceSettings: LeagueSettings | null = null;
    if (data.copySettingsFromLeagueId) {
      sourceSettings = await prisma.leagueSettings.findUnique({
        where: { leagueId: data.copySettingsFromLeagueId },
      });
    }

    for (const leagueData of data.leagues) {
      try {
        const league = await this.createLeague(leagueData, adminId);

        // Copy settings if source is specified
        if (sourceSettings) {
          await this.copySettingsToLeague(league.id, sourceSettings);
        }

        results.push(league);
      } catch (error) {
        console.error(`Failed to create league "${leagueData.name}":`, error);
        // Continue with other leagues
      }
    }

    return results;
  }

  async copyLeagueSettings(data: CopyLeagueSettingsInput): Promise<void> {
    const sourceSettings = await prisma.leagueSettings.findUnique({
      where: { leagueId: data.sourceLeagueId },
    });

    if (!sourceSettings) {
      throw new Error("Source league settings not found.");
    }

    for (const targetLeagueId of data.targetLeagueIds) {
      try {
        await this.copySettingsToLeague(targetLeagueId, sourceSettings);
      } catch (error) {
        console.error(`Failed to copy settings to league ${targetLeagueId}:`, error);
      }
    }
  }

  private async copySettingsToLeague(
    targetLeagueId: string,
    sourceSettings: LeagueSettings
  ): Promise<void> {
    await prisma.leagueSettings.upsert({
      where: { leagueId: targetLeagueId },
      update: {
        durationUnit: sourceSettings.durationUnit,
        durationValue: sourceSettings.durationValue,
        minPlayersPerDivision: sourceSettings.minPlayersPerDivision,
        maxPlayersPerDivision: sourceSettings.maxPlayersPerDivision,
        registrationDeadlineDays: sourceSettings.registrationDeadlineDays,
        paymentSettings: sourceSettings.paymentSettings,
        divisionRules: sourceSettings.divisionRules,
        playoffConfiguration: sourceSettings.playoffConfiguration,
        finalsConfiguration: sourceSettings.finalsConfiguration,
        workflowConfiguration: sourceSettings.workflowConfiguration,
        templates: sourceSettings.templates,
        customRulesText: sourceSettings.customRulesText,
        branding: sourceSettings.branding,
        integrationSettings: sourceSettings.integrationSettings,
        bulkOperations: sourceSettings.bulkOperations,
        archiveRetentionMonths: sourceSettings.archiveRetentionMonths,
        validationRules: sourceSettings.validationRules,
        errorHandling: sourceSettings.errorHandling,
      },
      create: {
        leagueId: targetLeagueId,
        durationUnit: sourceSettings.durationUnit,
        durationValue: sourceSettings.durationValue,
        minPlayersPerDivision: sourceSettings.minPlayersPerDivision,
        maxPlayersPerDivision: sourceSettings.maxPlayersPerDivision,
        registrationDeadlineDays: sourceSettings.registrationDeadlineDays,
        paymentSettings: sourceSettings.paymentSettings,
        divisionRules: sourceSettings.divisionRules,
        playoffConfiguration: sourceSettings.playoffConfiguration,
        finalsConfiguration: sourceSettings.finalsConfiguration,
        workflowConfiguration: sourceSettings.workflowConfiguration,
        templates: sourceSettings.templates,
        customRulesText: sourceSettings.customRulesText,
        branding: sourceSettings.branding,
        integrationSettings: sourceSettings.integrationSettings,
        bulkOperations: sourceSettings.bulkOperations,
        archiveRetentionMonths: sourceSettings.archiveRetentionMonths,
        validationRules: sourceSettings.validationRules,
        errorHandling: sourceSettings.errorHandling,
      },
    });
  }
}

export const leagueService = new LeagueService();