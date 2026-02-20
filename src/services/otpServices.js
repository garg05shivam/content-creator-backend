import bcrypt from "bcrypt";
import Otp from "../models/Otp.js";

export const generateAndStoreOtp = async (email) => {
  await Otp.deleteMany({ email });

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  const salt = await bcrypt.genSalt(10);
  const hashedOtp = await bcrypt.hash(otpCode, salt);

  await Otp.create({ email, otp: hashedOtp });

  return otpCode;
};


export const verifyStoredOtp = async (email, otp) => {
  const otpDoc = await Otp.findOne({ email });

  if (!otpDoc) {
    return { valid: false, message: "OTP not found. Please request a new one" };
  }

  if (otpDoc.expiresAt < new Date()) {
    await Otp.deleteMany({ email });
    return { valid: false, message: "OTP has expired. Please request a new one" };
  }

  const isValid = await bcrypt.compare(otp, otpDoc.otp);
  if (!isValid) {
    return { valid: false, message: "Invalid OTP" };
  }

  await Otp.deleteMany({ email });

  return { valid: true, message: "OTP verified successfully" };
};
