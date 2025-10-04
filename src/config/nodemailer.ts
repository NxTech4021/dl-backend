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
  console.log("Sending email:", to, subject, html);
  return await transporter.sendMail({
    from: `"DeuceLeague" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};
