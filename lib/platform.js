import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dataDir = join(root, "data");
const dbPath = join(dataDir, "db.json");
const usePostgres = Boolean(process.env.DATABASE_URL);
let pgPool;
let postgresSchemaReady;

export const categories = [
  "Lifestyle",
  "Уход за лицом",
  "Уход за волосами",
  "Тело и Гигиена",
  "Макияж",
  "Парфюмерия",
  "Люкс Бренды",
];

const staffUsers = [
  { name: "Super Admin", email: "khusanyusupkhujaev", role: "superadmin", password: process.env.SUPERADMIN_PASSWORD || "password123" },
  { name: "Bloom Manager", email: "manager@bloom.test", role: "manager" },
  { name: "A. Petrova", email: "cm1@bloom.test", role: "cm" },
  { name: "D. Karimov", email: "cm2@bloom.test", role: "cm" },
  { name: "Commercial Director", email: "director@bloom.test", role: "director" },
  { name: "Admin", email: "admin@bloom.test", role: "admin" },
];

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(String(password), salt, 210000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const test = hashPassword(password, salt).split(":")[1];
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(test, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function id(prefix) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function createInitialDb() {
  const users = staffUsers.map((user) => ({
    id: id("usr"),
    name: user.name,
    email: user.email,
    role: user.role,
    passwordHash: hashPassword(user.password || "password123"),
    supplierId: null,
  }));
  users.push({
    id: id("usr"),
    name: "Aurora Beauty LLC",
    email: "sales@aurora.example",
    role: "supplier",
    passwordHash: hashPassword("password123"),
    supplierId: "sup_demo",
  });

  return {
    users,
    suppliers: [
      {
        id: "sup_demo",
        legalName: "Aurora Beauty LLC",
        tin: "301223445",
        phone: "+998 90 123 45 67",
        email: "sales@aurora.example",
      },
    ],
    categoryManagers: Object.fromEntries(
      categories.map((category, index) => [category, staffUsers.filter((user) => user.role === "cm")[index % 2].email]),
    ),
    proposals: [
      {
        id: "BLM-2026-0001",
        supplierId: "sup_demo",
        brandName: "Northern Glow",
        category: "Уход за лицом",
        brandDescription: "Daily skincare assortment for beauty retail.",
        brandLink: "https://example.com/northern-glow",
        assignedCmEmail: "cm1@bloom.test",
        status: "Under Review",
        submittedAt: "2026-08-19T07:24:00.000Z",
        updatedAt: "2026-08-19T07:24:00.000Z",
        skus: [
          skuSeed("Hydra Cream 50 ml", "4780012345678", "Selected / Recommended"),
          skuSeed("Daily Foam 120 ml", "4780099999999", "Under Review"),
          skuSeed("Night Serum 30 ml", "4780012345678", "Rejected by CM"),
        ],
        history: [{ at: "2026-08-19T07:24:00.000Z", actor: "system", action: "Seeded proposal" }],
      },
    ],
    products: [],
    notifications: [],
    sessions: [],
  };
}

function skuSeed(productName, ean, state) {
  return {
    id: id("sku"),
    productName,
    ean,
    volume: productName.includes("120") ? "120 ml" : productName.includes("30") ? "30 ml" : "50 ml",
    dimensions: "45 x 45 x 130 mm",
    priceExVat: 52000,
    priceIncVat: 58240,
    currency: "UZS",
    rrp: 89000,
    casePack: "12 units",
    shelfLife: "24 months",
    frontPhoto: "https://placehold.co/420x520?text=Front",
    backPhoto: "https://placehold.co/420x520?text=Back",
    competitors: [{ name: "Retail.uz", price: 91000, currency: "UZS", url: "https://example.com" }],
    state,
    cmComment: "",
    directorComment: "",
  };
}

async function pool() {
  if (!pgPool) {
    const { Pool } = await import("pg");
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pgPool;
}

export async function ensurePostgresSchema() {
  if (postgresSchemaReady) return postgresSchemaReady;
  const client = await pool();
  postgresSchemaReady = client.query(`
      create table if not exists app_state (
        id text primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      )
    `)
    .catch((error) => {
      postgresSchemaReady = null;
      throw error;
    });
  return postgresSchemaReady;
}

export async function loadDb() {
  if (usePostgres) {
    await ensurePostgresSchema();
    const client = await pool();
    const result = await client.query("select data from app_state where id = 'main'");
    if (result.rowCount) return normalizeDb(result.rows[0].data);
    const seeded = createInitialDb();
    await saveDb(seeded);
    return seeded;
  }
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(dbPath)) {
    const seeded = createInitialDb();
    await saveDb(seeded);
    return seeded;
  }
  return normalizeDb(JSON.parse(await readFile(dbPath, "utf8")));
}

export async function saveDb(db) {
  db.sessions = (db.sessions || []).filter((session) => session.expiresAt > Date.now());
  if (usePostgres) {
    await ensurePostgresSchema();
    const client = await pool();
    await client.query(
      `
        insert into app_state (id, data, updated_at)
        values ('main', $1::jsonb, now())
        on conflict (id) do update set data = excluded.data, updated_at = now()
      `,
      [JSON.stringify(db)],
    );
    return;
  }
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

function normalizeDb(db) {
  return {
    users: db.users || [],
    suppliers: db.suppliers || [],
    categoryManagers: db.categoryManagers || {},
    proposals: db.proposals || [],
    products: db.products || [],
    notifications: db.notifications || [],
    sessions: db.sessions || [],
  };
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value),
  );
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
}

function publicUser(user, db) {
  if (!user) return null;
  const supplier = user.supplierId ? db.suppliers.find((item) => item.id === user.supplierId) : null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, supplier };
}

function userFromRequest(req, db) {
  const sid = parseCookies(req).sid;
  const session = sid && (db.sessions || []).find((item) => item.sid === sid);
  if (!session || session.expiresAt < Date.now()) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function requireUser(req, db) {
  const user = userFromRequest(req, db);
  if (!user) throw Object.assign(new Error("Authentication required"), { status: 401 });
  return user;
}

function requireRole(user, roles) {
  if (!roles.includes(user.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
}

function validate(value, field) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw Object.assign(new Error(`${field} is required`), { status: 400 });
  }
  return String(value).trim();
}

function proposalForUser(proposal, user) {
  if (user.role === "supplier") return proposal.supplierId === user.supplierId;
  if (user.role === "cm") return proposal.assignedCmEmail === user.email;
  return ["manager", "director", "admin", "superadmin"].includes(user.role);
}

function supplierView(db, supplierId) {
  return db.suppliers.find((supplier) => supplier.id === supplierId) || null;
}

function decorateProposal(proposal, db) {
  const duplicateEans = findDuplicateEans(db);
  return {
    ...proposal,
    supplier: supplierView(db, proposal.supplierId),
    counts: countSkus(proposal),
    skus: proposal.skus.map((sku) => ({ ...sku, duplicateEan: duplicateEans.has(sku.ean) })),
  };
}

function countSkus(proposal) {
  return {
    proposed: proposal.skus.length,
    selected: proposal.skus.filter((sku) =>
      ["Selected / Recommended", "Pending Commercial Director", "Approved"].includes(sku.state),
    ).length,
    rejected: proposal.skus.filter((sku) =>
      ["Rejected by CM", "Rejected by Commercial Director"].includes(sku.state),
    ).length,
    underReview: proposal.skus.filter((sku) => sku.state === "Under Review").length,
    approved: proposal.skus.filter((sku) => sku.state === "Approved").length,
  };
}

function deriveStatus(proposal) {
  if (!proposal.submittedAt) return "Draft";
  if (proposal.skus.length && proposal.skus.every((sku) => sku.state === "Approved")) return "Approved";
  if (
    proposal.skus.length &&
    proposal.skus.every((sku) => ["Rejected by CM", "Rejected by Commercial Director"].includes(sku.state))
  ) {
    return "Rejected";
  }
  return proposal.assignedCmEmail ? "Under Review" : "Submitted";
}

function findDuplicateEans(db) {
  const seen = new Set();
  const dupes = new Set();
  for (const proposal of db.proposals) {
    for (const sku of proposal.skus) {
      if (seen.has(sku.ean)) dupes.add(sku.ean);
      seen.add(sku.ean);
    }
  }
  return dupes;
}

function addNotification(db, type, recipientEmail, message) {
  db.notifications.unshift({
    id: id("ntf"),
    type,
    recipientEmail,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function touchProposal(proposal, user, action) {
  proposal.status = deriveStatus(proposal);
  proposal.updatedAt = new Date().toISOString();
  proposal.history.unshift({ at: proposal.updatedAt, actor: user.email, action });
}

function createProductsForApprovedSku(db, proposal, sku, user) {
  if (db.products.some((product) => product.sourceSkuId === sku.id)) return;
  db.products.push({
    id: id("prd"),
    sourceProposalId: proposal.id,
    sourceSkuId: sku.id,
    supplierId: proposal.supplierId,
    brandName: proposal.brandName,
    category: proposal.category,
    productName: sku.productName,
    ean: sku.ean,
    rrp: sku.rrp,
    currency: sku.currency,
    status: "Approved",
    createdAt: new Date().toISOString(),
    createdBy: user.email,
  });
}

function proposalsForUser(db, current, search = "", status = "") {
  return db.proposals
    .filter((proposal) => proposalForUser(proposal, current))
    .filter((proposal) => (current.role === "director" ? proposal.skus.some((sku) => sku.state === "Pending Commercial Director") : true))
    .filter((proposal) => {
      const supplier = supplierView(db, proposal.supplierId);
      const haystack = [proposal.id, proposal.brandName, proposal.category, proposal.status, proposal.assignedCmEmail, supplier?.legalName].join(" ").toLowerCase();
      return (!search || haystack.includes(search)) && (!status || proposal.status === status);
    })
    .map((proposal) => decorateProposal(proposal, db));
}

function productsForUser(db, current) {
  return db.products.filter((product) => current.role !== "supplier" || product.supplierId === current.supplierId);
}

function notificationsForUser(db, current) {
  return db.notifications.filter((notification) =>
    ["manager", "admin", "superadmin"].includes(current.role) || notification.recipientEmail === current.email,
  );
}

function workspacePayload(db, user) {
  const payload = {
    user: publicUser(user, db),
    categories,
    categoryManagers: db.categoryManagers,
    staff: db.users.filter((item) => item.role !== "supplier").map((item) => publicUser(item, db)),
    proposals: [],
    products: [],
    notifications: [],
    users: [],
    suppliers: [],
  };

  if (!user) return payload;

  payload.proposals = proposalsForUser(db, user);
  payload.products = productsForUser(db, user);
  payload.notifications = notificationsForUser(db, user);

  if (["admin", "superadmin"].includes(user.role)) {
    payload.users = db.users.map((item) => publicUser(item, db));
    payload.suppliers = db.suppliers;
  }

  return payload;
}

export async function handleApi(req, res) {
  const db = await loadDb();
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const method = req.method || "GET";
  try {
    const user = userFromRequest(req, db);

    if (method === "GET" && url.pathname === "/api/me") {
      return sendJson(res, 200, {
        user: publicUser(user, db),
        categories,
        categoryManagers: db.categoryManagers,
        staff: db.users.filter((item) => item.role !== "supplier").map((item) => publicUser(item, db)),
      });
    }

    if (method === "GET" && url.pathname === "/api/workspace") {
      return sendJson(res, 200, workspacePayload(db, user));
    }

    if (method === "POST" && url.pathname === "/api/auth/register") {
      const body = await readBody(req);
      const legalName = validate(body.legalName, "Legal company name");
      const tin = validate(body.tin, "TIN / INN");
      const phone = validate(body.phone, "Phone");
      const email = validate(body.email, "Email").toLowerCase();
      const password = validate(body.password, "Password");
      if (db.suppliers.some((supplier) => supplier.tin === tin)) throw Object.assign(new Error("TIN / INN already exists"), { status: 409 });
      if (db.users.some((candidate) => candidate.email === email)) throw Object.assign(new Error("Email already exists"), { status: 409 });
      const supplier = { id: id("sup"), legalName, tin, phone, email };
      const newUser = { id: id("usr"), name: legalName, email, role: "supplier", passwordHash: hashPassword(password), supplierId: supplier.id };
      db.suppliers.push(supplier);
      db.users.push(newUser);
      return createSession(res, db, newUser);
    }

    if (method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readBody(req);
      const email = validate(body.email, "Email").toLowerCase();
      const password = validate(body.password, "Password");
      const found = db.users.find((candidate) => candidate.email.toLowerCase() === email);
      if (!found || !verifyPassword(password, found.passwordHash)) throw Object.assign(new Error("Invalid email or password"), { status: 401 });
      return createSession(res, db, found);
    }

    if (method === "POST" && url.pathname === "/api/auth/logout") {
      const sid = parseCookies(req).sid;
      db.sessions = (db.sessions || []).filter((session) => session.sid !== sid);
      await saveDb(db);
      res.writeHead(204, { "set-cookie": "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
      return res.end();
    }

    const current = requireUser(req, db);

    if (method === "PATCH" && url.pathname === "/api/profile") {
      requireRole(current, ["supplier"]);
      const body = await readBody(req);
      const supplier = db.suppliers.find((item) => item.id === current.supplierId);
      const nextTin = validate(body.tin, "TIN / INN");
      if (db.suppliers.some((item) => item.id !== supplier.id && item.tin === nextTin)) throw Object.assign(new Error("TIN / INN already exists"), { status: 409 });
      supplier.legalName = validate(body.legalName, "Legal company name");
      supplier.tin = nextTin;
      supplier.phone = validate(body.phone, "Phone");
      supplier.email = validate(body.email, "Email").toLowerCase();
      current.name = supplier.legalName;
      current.email = supplier.email;
      await saveDb(db);
      return sendJson(res, 200, { user: publicUser(current, db) });
    }

    if (method === "GET" && url.pathname === "/api/proposals") {
      const search = String(url.searchParams.get("search") || "").toLowerCase();
      const status = url.searchParams.get("status");
      return sendJson(res, 200, { proposals: proposalsForUser(db, current, search, status) });
    }

    if (method === "POST" && url.pathname === "/api/proposals") {
      requireRole(current, ["supplier"]);
      const body = await readBody(req);
      const category = validate(body.category, "Category");
      if (!categories.includes(category)) throw Object.assign(new Error("Unknown category"), { status: 400 });
      const skus = Array.isArray(body.skus) ? body.skus : [];
      if (!skus.length) throw Object.assign(new Error("At least one SKU is required"), { status: 400 });
      const now = new Date().toISOString();
      const proposal = {
        id: nextProposalId(db),
        supplierId: current.supplierId,
        brandName: validate(body.brandName, "Brand name"),
        category,
        brandDescription: String(body.brandDescription || ""),
        brandLink: String(body.brandLink || ""),
        assignedCmEmail: db.categoryManagers[category] || null,
        status: "Submitted",
        submittedAt: now,
        updatedAt: now,
        skus: skus.map(validateSku),
        history: [{ at: now, actor: current.email, action: "Submitted proposal" }],
      };
      db.proposals.unshift(proposal);
      addNotification(db, "New proposal submitted", "manager@bloom.test", `${proposal.id} ${proposal.brandName}`);
      if (proposal.assignedCmEmail) addNotification(db, "Proposal assigned", proposal.assignedCmEmail, `${proposal.id} assigned by category mapping`);
      await saveDb(db);
      return sendJson(res, 201, { proposal: decorateProposal(proposal, db) });
    }

    const assignMatch = url.pathname.match(/^\/api\/proposals\/([^/]+)\/assign$/);
    if (method === "PATCH" && assignMatch) {
      requireRole(current, ["manager", "admin", "superadmin"]);
      const body = await readBody(req);
      const proposal = db.proposals.find((item) => item.id === assignMatch[1]);
      if (!proposal) throw Object.assign(new Error("Proposal not found"), { status: 404 });
      const cmEmail = validate(body.cmEmail, "Category manager");
      const cm = db.users.find((item) => item.email === cmEmail && item.role === "cm");
      if (!cm) throw Object.assign(new Error("Category manager not found"), { status: 400 });
      proposal.assignedCmEmail = cmEmail;
      touchProposal(proposal, current, `Assigned to ${cmEmail}`);
      addNotification(db, "Proposal assigned", cmEmail, `${proposal.id} assigned to you`);
      await saveDb(db);
      return sendJson(res, 200, { proposal: decorateProposal(proposal, db) });
    }

    const sendFinalMatch = url.pathname.match(/^\/api\/proposals\/([^/]+)\/send-final$/);
    if (method === "POST" && sendFinalMatch) {
      requireRole(current, ["cm", "superadmin"]);
      const proposal = db.proposals.find((item) => item.id === sendFinalMatch[1] && (item.assignedCmEmail === current.email || current.role === "superadmin"));
      if (!proposal) throw Object.assign(new Error("Proposal not found"), { status: 404 });
      let sent = 0;
      for (const sku of proposal.skus) {
        if (sku.state === "Selected / Recommended") {
          sku.state = "Pending Commercial Director";
          sent += 1;
        }
      }
      if (!sent) throw Object.assign(new Error("No selected SKUs to send"), { status: 400 });
      touchProposal(proposal, current, `Sent ${sent} SKU(s) for Commercial Director approval`);
      addNotification(db, "Selected SKUs sent for final approval", "director@bloom.test", `${proposal.id}: ${sent} SKU(s)`);
      await saveDb(db);
      return sendJson(res, 200, { proposal: decorateProposal(proposal, db) });
    }

    const cmDecisionMatch = url.pathname.match(/^\/api\/skus\/([^/]+)\/cm-decision$/);
    if (method === "PATCH" && cmDecisionMatch) {
      requireRole(current, ["cm", "superadmin"]);
      const body = await readBody(req);
      const found = findSku(db, cmDecisionMatch[1]);
      if (!found || (found.proposal.assignedCmEmail !== current.email && current.role !== "superadmin")) throw Object.assign(new Error("SKU not found"), { status: 404 });
      if (!["Under Review", "Selected / Recommended", "Rejected by CM"].includes(body.state)) throw Object.assign(new Error("Invalid CM decision"), { status: 400 });
      found.sku.state = body.state;
      found.sku.cmComment = String(body.comment || "");
      touchProposal(found.proposal, current, `CM decision for ${found.sku.productName}: ${body.state}`);
      await saveDb(db);
      return sendJson(res, 200, { proposal: decorateProposal(found.proposal, db) });
    }

    const finalDecisionMatch = url.pathname.match(/^\/api\/skus\/([^/]+)\/final-decision$/);
    if (method === "PATCH" && finalDecisionMatch) {
      requireRole(current, ["director", "superadmin"]);
      const body = await readBody(req);
      const found = findSku(db, finalDecisionMatch[1]);
      if (!found || found.sku.state !== "Pending Commercial Director") throw Object.assign(new Error("SKU not pending final approval"), { status: 404 });
      if (!["Approved", "Rejected by Commercial Director"].includes(body.state)) throw Object.assign(new Error("Invalid final decision"), { status: 400 });
      found.sku.state = body.state;
      found.sku.directorComment = String(body.comment || "");
      if (body.state === "Approved") createProductsForApprovedSku(db, found.proposal, found.sku, current);
      touchProposal(found.proposal, current, `Director decision for ${found.sku.productName}: ${body.state}`);
      const supplier = supplierView(db, found.proposal.supplierId);
      addNotification(db, "Final decision completed", found.proposal.assignedCmEmail, `${found.proposal.id}: ${found.sku.productName} ${body.state}`);
      addNotification(db, "Proposal status changed", supplier.email, `${found.proposal.id}: ${found.sku.productName} ${body.state}`);
      await saveDb(db);
      return sendJson(res, 200, { proposal: decorateProposal(found.proposal, db), products: db.products });
    }

    if (method === "GET" && url.pathname === "/api/products") {
      return sendJson(res, 200, { products: productsForUser(db, current) });
    }

    if (method === "PATCH" && url.pathname === "/api/category-managers") {
      requireRole(current, ["manager", "admin", "superadmin"]);
      const body = await readBody(req);
      for (const category of categories) {
        if (body[category]) {
          const cm = db.users.find((item) => item.email === body[category] && item.role === "cm");
          if (!cm) throw Object.assign(new Error(`Invalid CM for ${category}`), { status: 400 });
          db.categoryManagers[category] = body[category];
        }
      }
      await saveDb(db);
      return sendJson(res, 200, { categoryManagers: db.categoryManagers });
    }

    if (method === "GET" && url.pathname === "/api/notifications") {
      return sendJson(res, 200, { notifications: notificationsForUser(db, current) });
    }

    if (method === "GET" && url.pathname === "/api/users") {
      requireRole(current, ["admin", "superadmin"]);
      return sendJson(res, 200, {
        users: db.users.map((user) => publicUser(user, db)),
        suppliers: db.suppliers,
      });
    }

    throw Object.assign(new Error("Not found"), { status: 404 });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
}

async function createSession(res, db, user) {
  const sid = id("sid");
  db.sessions = [
    ...(db.sessions || []).filter((session) => session.userId !== user.id),
    { sid, userId: user.id, expiresAt: Date.now() + 1000 * 60 * 60 * 12 },
  ];
  await saveDb(db);
  return sendJson(res, 200, workspacePayload(db, user), { "set-cookie": `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200` });
}

function nextProposalId(db) {
  return `BLM-2026-${String(db.proposals.length + 1).padStart(4, "0")}`;
}

function validateSku(raw) {
  return {
    id: id("sku"),
    productName: validate(raw.productName, "Product / SKU name"),
    ean: validate(raw.ean, "EAN / Barcode"),
    volume: validate(raw.volume, "Volume / weight"),
    dimensions: validate(raw.dimensions, "Dimensions"),
    priceExVat: Number(validate(raw.priceExVat, "Purchase price excl. VAT")),
    priceIncVat: Number(validate(raw.priceIncVat, "Purchase price incl. VAT")),
    currency: validate(raw.currency || "UZS", "Currency"),
    rrp: Number(validate(raw.rrp, "RRP")),
    casePack: validate(raw.casePack, "Supply quantum / case pack"),
    shelfLife: validate(raw.shelfLife, "Shelf life"),
    frontPhoto: validate(raw.frontPhoto, "Front product photo"),
    backPhoto: validate(raw.backPhoto, "Back product photo"),
    competitors: Array.isArray(raw.competitors)
      ? raw.competitors
          .filter((item) => item.name || item.price || item.url)
          .map((item) => ({
            name: validate(item.name, "Competitor name"),
            price: Number(validate(item.price, "Competitor price")),
            currency: item.currency || raw.currency || "UZS",
            url: String(item.url || ""),
          }))
      : [],
    state: "Under Review",
    cmComment: "",
    directorComment: "",
  };
}

function findSku(db, skuId) {
  for (const proposal of db.proposals) {
    const sku = proposal.skus.find((item) => item.id === skuId);
    if (sku) return { proposal, sku };
  }
  return null;
}
