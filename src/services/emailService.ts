import nodemailer from "nodemailer";
import { Resend } from "resend";

interface EmailData {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

class EmailService {
  private resend: Resend | null = null;
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || "noreply@deuceleague.com";
    this.initializeEmailProvider();
  }

  private initializeEmailProvider() {
    // Try to initialize Resend first (if API key is available)
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
      console.log("Email service initialized with Resend");
      return;
    }

    // Fallback to nodemailer with SMTP
    const smtpConfig = {
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    if (smtpConfig.auth.user && smtpConfig.auth.pass) {
      this.transporter = nodemailer.createTransport(smtpConfig);
      console.log("Email service initialized with SMTP");
    } else {
      console.warn("No email configuration found. Email notifications will be logged only.");
    }
  }

  async sendEmail(data: EmailData): Promise<boolean> {
    try {
      // If no email provider is configured, log the email instead
      if (!this.resend && !this.transporter) {
        console.log("📧 Email would be sent:", {
          to: data.to,
          subject: data.subject,
          text: data.text,
        });
        return true;
      }

      // Use Resend if available
      if (this.resend) {
        const emailPayload: any = {
          from: data.from || this.fromEmail,
          to: Array.isArray(data.to) ? data.to : [data.to],
          subject: data.subject,
        };

        if (data.html) {
          emailPayload.html = data.html;
        } else if (data.text) {
          emailPayload.text = data.text;
        }

        await this.resend.emails.send(emailPayload);
        console.log(`✅ Email sent via Resend to: ${data.to}`);
        return true;
      }

      // Use nodemailer as fallback
      if (this.transporter) {
        await this.transporter.sendMail({
          from: data.from || this.fromEmail,
          to: data.to,
          subject: data.subject,
          text: data.text,
          html: data.html,
        });
        console.log(`✅ Email sent via SMTP to: ${data.to}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error("❌ Failed to send email:", error);
      return false;
    }
  }

  // Email templates for league-related notifications
  getJoinRequestApprovedTemplate(data: {
    userName: string;
    leagueName: string;
    leagueId: string;
  }): EmailTemplate {
    return {
      subject: `League Join Request Approved - ${data.leagueName}`,
      text: `Hello ${data.userName},

Congratulations! Your request to join "${data.leagueName}" has been approved.

You can now access the league and view its details.

Best regards,
The League Management Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">League Join Request Approved</h2>
          <p>Hello <strong>${data.userName}</strong>,</p>
          <p>Congratulations! Your request to join "<strong>${data.leagueName}</strong>" has been approved.</p>
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #155724;">
              ✅ You can now access the league and view its details.
            </p>
          </div>
          <p>Best regards,<br/>The League Management Team</p>
        </div>
      `,
    };
  }

  getJoinRequestDeniedTemplate(data: {
    userName: string;
    leagueName: string;
    decisionReason?: string;
  }): EmailTemplate {
    return {
      subject: `League Join Request Update - ${data.leagueName}`,
      text: `Hello ${data.userName},

Your request to join "${data.leagueName}" has been denied.

${data.decisionReason ? `Reason: ${data.decisionReason}` : ''}

If you have any questions, please contact the league administrators.

Best regards,
The League Management Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">League Join Request Update</h2>
          <p>Hello <strong>${data.userName}</strong>,</p>
          <p>Your request to join "<strong>${data.leagueName}</strong>" has been denied.</p>
          ${data.decisionReason ? `
            <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #721c24;">
                <strong>Reason:</strong> ${data.decisionReason}
              </p>
            </div>
          ` : ''}
          <p>If you have any questions, please contact the league administrators.</p>
          <p>Best regards,<br/>The League Management Team</p>
        </div>
      `,
    };
  }

  getLeagueStatusChangeTemplate(data: {
    leagueName: string;
    oldStatus: string;
    newStatus: string;
    adminName: string;
  }): EmailTemplate {
    return {
      subject: `League Status Update - ${data.leagueName}`,
      text: `League Status Update

The status of "${data.leagueName}" has been changed from ${data.oldStatus} to ${data.newStatus} by ${data.adminName}.

This is an automated notification.

Best regards,
The League Management Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #007bff;">League Status Update</h2>
          <p>The status of "<strong>${data.leagueName}</strong>" has been updated:</p>
          <div style="background-color: #e7f3ff; border: 1px solid #b3d4fc; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #004085;">
              <strong>Previous Status:</strong> ${data.oldStatus}<br/>
              <strong>New Status:</strong> ${data.newStatus}<br/>
              <strong>Updated by:</strong> ${data.adminName}
            </p>
          </div>
          <p>This is an automated notification.</p>
          <p>Best regards,<br/>The League Management Team</p>
        </div>
      `,
    };
  }

  getLeagueSettingsChangeTemplate(data: {
    leagueName: string;
    changedFields: string[];
    adminName: string;
  }): EmailTemplate {
    return {
      subject: `League Settings Updated - ${data.leagueName}`,
      text: `League Settings Updated

The settings for "${data.leagueName}" have been updated by ${data.adminName}.

Updated fields: ${data.changedFields.join(", ")}

This is an automated notification for audit purposes.

Best regards,
The League Management Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6f42c1;">League Settings Updated</h2>
          <p>The settings for "<strong>${data.leagueName}</strong>" have been updated by <strong>${data.adminName}</strong>.</p>
          <div style="background-color: #f3e5f5; border: 1px solid #d1c4e9; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #4a148c;">
              <strong>Updated fields:</strong><br/>
              ${data.changedFields.map(field => `• ${field}`).join('<br/>')}
            </p>
          </div>
          <p>This is an automated notification for audit purposes.</p>
          <p>Best regards,<br/>The League Management Team</p>
        </div>
      `,
    };
  }

  // Convenience methods for common league operations
  async sendJoinRequestApproval(data: {
    userEmail: string;
    userName: string;
    leagueName: string;
    leagueId: string;
  }): Promise<boolean> {
    const template = this.getJoinRequestApprovedTemplate(data);
    return this.sendEmail({
      to: data.userEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  async sendJoinRequestDenial(data: {
    userEmail: string;
    userName: string;
    leagueName: string;
    decisionReason?: string;
  }): Promise<boolean> {
    const template = this.getJoinRequestDeniedTemplate(data);
    return this.sendEmail({
      to: data.userEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  async sendLeagueStatusChange(data: {
    recipientEmails: string[];
    leagueName: string;
    oldStatus: string;
    newStatus: string;
    adminName: string;
  }): Promise<boolean> {
    const template = this.getLeagueStatusChangeTemplate(data);
    return this.sendEmail({
      to: data.recipientEmails,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  async sendLeagueSettingsChange(data: {
    recipientEmails: string[];
    leagueName: string;
    changedFields: string[];
    adminName: string;
  }): Promise<boolean> {
    const template = this.getLeagueSettingsChangeTemplate(data);
    return this.sendEmail({
      to: data.recipientEmails,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  // Bulk email operations
  async sendBulkEmails(emails: EmailData[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const email of emails) {
      const result = await this.sendEmail(email);
      if (result) {
        success++;
      } else {
        failed++;
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { success, failed };
  }

  // Test email functionality
  async testEmailConfiguration(): Promise<boolean> {
    const testEmail = process.env.TEST_EMAIL || "test@example.com";

    return this.sendEmail({
      to: testEmail,
      subject: "League Management System - Email Test",
      text: "This is a test email from the League Management System. If you receive this, email configuration is working correctly.",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Email Configuration Test</h2>
          <p>This is a test email from the League Management System.</p>
          <p>If you receive this, email configuration is working correctly.</p>
          <p>Best regards,<br/>The League Management Team</p>
        </div>
      `,
    });
  }
}

export const emailService = new EmailService();