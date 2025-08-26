import nodemailer from "nodemailer";
import 'dotenv/config';

// Create a single Ethereal test account when the module is initialized.
// This is more efficient than creating an account for every email.
const etherealAccountPromise = nodemailer.createTestAccount();

export const sendEmail = async (options: {
  to: string;
  subject: string;
  text: string;
}) => {
  try {
    const account = await etherealAccountPromise;

    const transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });

    const info = await transporter.sendMail({
      from: '"Deuce League (Test)" <noreply@deuceleague.com>',
      to: options.to,
      subject: options.subject,
      text: options.text, // We keep the text for email clients that don't render HTML
      html: `<p>Click the link to verify your email: <a href="${options.text.split(' ').pop()}">${options.text.split(' ').pop()}</a></p>`,
    });

    console.log("Message sent: %s", info.messageId);
    // Preview only available when sending through an Ethereal account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

  } catch (error) {
    console.error("Error creating Ethereal account or sending email:", error);
  }
};
