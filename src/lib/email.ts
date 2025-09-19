import nodemailer from "nodemailer"

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT),
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
  secure: process.env.NODE_ENV === "production",
})

export async function sendVerificationEmail(email: string, name: string, code: string) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify your email address",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #000; text-align: center;">Verify your email address</h1>
        <p>Hello ${name},</p>
        <p>Thank you for signing up for Synapse. Please use the following code to verify your email address:</p>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${code}
        </div>
        <p>This code will expire in 30 minutes.</p>
        <p>If you did not sign up for Synapse, please ignore this email.</p>
        <p>Best regards,<br>The Synapse Team</p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
}
