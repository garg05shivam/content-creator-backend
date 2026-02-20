import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import Otp from "../models/Otp.js";

// Helper to handle OTP generation, storage, and email delivery
const sendOtp = async (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  console.log(`Starting OTP process for: ${normalizedEmail}`);

  try {
    // Refresh the OTP for this email
    await Otp.deleteMany({ email: normalizedEmail });
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otpCode, salt);
    await Otp.create({ email: normalizedEmail, otp: hashedOtp });
    console.log("OTP code saved to DB.");

    const emailPass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");
    if (!process.env.EMAIL_USER || !emailPass) {
      throw new Error("Email configuration is missing. Set EMAIL_USER and EMAIL_PASS.");
    }

    // Configure the mail transport (Gmail SMTP)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: emailPass,
      }
    });

    // Check if we can actually talk to the mail server
    console.log("Verifying SMTP connection...");
    await transporter.verify();
    console.log("SMTP is ready.");

    const mailOptions = {
      from: `"CreatorConnect" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Your Verification Code - CreatorConnect",
      html: `
        <div style="font-family: 'Courier New', Courier, monospace; border: 2px solid black; padding: 20px; max-width: 500px;">
          <h2 style="border-bottom: 2px solid black;">CREATOR CONNECT</h2>
          <p>YOUR VERIFICATION CODE IS:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">${otpCode}</p>
          <p>THIS CODE WILL EXPIRE IN 10 MINUTES.</p>
        </div>
      `,
    };

    // Send the actual email
    const info = await transporter.sendMail(mailOptions);
    console.log("OTP email sent successfully. ID:", info.messageId);

    return otpCode;

  } catch (error) {
    await Otp.deleteMany({ email: normalizedEmail });
    console.error("Failed to deliver OTP email.");
    console.error({
      message: error.message,
      code: error.code,
      response: error.response,
    });
    
    // Quick config check for debugging
    console.log("Current user:", process.env.EMAIL_USER);

    return null;
  }
};

export default sendOtp;
