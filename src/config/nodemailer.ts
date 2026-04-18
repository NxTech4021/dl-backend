import nodemailer from "nodemailer";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

// Initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Gmail fallback transporter
export const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  // Use Resend if API key is available
  if (resend) {
    console.log("📧 Sending email via Resend to:", to);
    try {
      const result = await resend.emails.send({
        from: "Deuce League <no-reply@deuceleague.com>",
        to,
        subject,
        html,
      });

      console.log("✅ Email sent via Resend!");
      console.log("Message ID:", result.data?.id);

      return { id: result.data?.id };
    } catch (error: any) {
      console.error("❌ Resend Error:", error.message);
      console.error("Full error:", error);
      throw error;
    }
  }

  // Fallback to Gmail SMTP
  console.log("📧 Sending email via Gmail SMTP to:", to);
  console.log("Using EMAIL_USER:", process.env.EMAIL_USER);
  console.log("EMAIL_PASS length:", process.env.EMAIL_PASS?.length);

  try {
    const info = await transporter.sendMail({
      from: `"Deuce League" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent via Gmail SMTP!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);

    return { id: info.messageId };
  } catch (error: any) {
    console.error("❌ Gmail SMTP Error:", error.message);
    console.error("Full error:", error);
    throw error;
  }
};
