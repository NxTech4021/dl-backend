import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  console.log("Sending email to:", to);
  console.log("Using EMAIL_USER:", process.env.EMAIL_USER);
  console.log("EMAIL_PASS length:", process.env.EMAIL_PASS?.length);

  try {
    const info = await transporter.sendMail({
      from: `"Deuce League" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    
    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);
    
    return { id: info.messageId };
  } catch (error: any) {
    console.error("Gmail SMTP Error:", error.message);
    console.error("Full error:", error);
    throw error;
  }
};
