export const inviteEmailTemplate = (inviteLink: string) => `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="https://yourcompany.com/logo.png" alt="Deuce League Company Logo" style="height: 60px;" />
    </div>
    <h2 style="color: #1a73e8;">You're Invited!</h2>
    <p>Hello,</p>
    <p>You've been invited to join as an <strong>Admin</strong> at <strong>Deuce League</strong>.</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${inviteLink}" target="_blank" style="background-color: #1a73e8; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Accept Invitation</a>
    </p>
    <p>This link will expire in 30 days. If you did not expect this email, please ignore it.</p>
    <hr style="margin: 30px 0;" />
    <p style="font-size: 12px; color: #888; text-align: center;">&copy; ${new Date().getFullYear()} Your Company. All rights reserved.</p>
  </div>
`;
