import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const { controlModels } = require("../control/models");

async function main() {
  const email = String(process.env.PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.PLATFORM_ADMIN_PASSWORD || "");
  const name = String(process.env.PLATFORM_ADMIN_NAME || "Hospitalia Super Admin").trim();
  if (!email || !email.includes("@")) throw new Error("PLATFORM_ADMIN_EMAIL is required");
  if (password.length < 12) throw new Error("PLATFORM_ADMIN_PASSWORD must contain at least 12 characters");
  const { PlatformUser } = await controlModels();
  const existing = await PlatformUser.findOne({ email });
  if (existing) {
    console.log("Platform administrator already exists; no changes made.");
    return;
  }
  await PlatformUser.create({
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: "PLATFORM_SUPER_ADMIN",
    status: "ACTIVE",
  });
  console.log("Platform administrator created.");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
