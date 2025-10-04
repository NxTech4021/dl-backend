import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

const resend = new Resend("re_4WKNJbCW_Q3ERonrPhkQ9HMQyeoeyWZFM");

export const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  console.log("Sending email:", to, subject, html);

  const { data, error } = await resend.emails.send({
    from: "Deuce League <no-reply@staging.appdevelopers.my>",
    to,
    subject,
    html: html,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;

  // await transporter.sendMail({
  //   from: `"DeuceLeague" <${process.env.EMAIL_USER}>`,
  //   to,
  //   subject,
  //   html,
  // });
};
