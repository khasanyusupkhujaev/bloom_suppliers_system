import { randomUUID } from "node:crypto";
import { hashPassword, loadDb, saveDb } from "../lib/platform.js";

const login = process.env.SUPERADMIN_LOGIN || "khusanyusupkhujaev";
const password = process.env.SUPERADMIN_PASSWORD;

if (!password) {
  console.error("SUPERADMIN_PASSWORD is required.");
  process.exit(1);
}

const db = await loadDb();
db.users ||= [];

const normalizedLogin = login.toLowerCase();
const existing = db.users.find((user) => String(user.email || "").toLowerCase() === normalizedLogin);

if (existing) {
  existing.name = existing.name || "Super Admin";
  existing.email = login;
  existing.role = "superadmin";
  existing.passwordHash = hashPassword(password);
  existing.supplierId = null;
} else {
  db.users.push({
    id: `usr_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
    name: "Super Admin",
    email: login,
    role: "superadmin",
    passwordHash: hashPassword(password),
    supplierId: null,
  });
}

await saveDb(db);
console.log(`${existing ? "Updated" : "Created"} superadmin account: ${login}`);
