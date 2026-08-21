import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
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

export const ApplicationStatus = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED_TO_MANAGER: "SUBMITTED_TO_MANAGER",
  MANAGER_REVIEW: "MANAGER_REVIEW",
  RETURNED_TO_SUPPLIER: "RETURNED_TO_SUPPLIER",
  SUBMITTED_TO_CCO: "SUBMITTED_TO_CCO",
  CCO_REVIEW: "CCO_REVIEW",
  RETURNED_TO_MANAGER: "RETURNED_TO_MANAGER",
  APPROVED: "APPROVED",
  DECLINED: "DECLINED",
});

const statusLabels = {
  DRAFT: "Черновик",
  SUBMITTED_TO_MANAGER: "На рассмотрении менеджера",
  MANAGER_REVIEW: "В работе у менеджера",
  RETURNED_TO_SUPPLIER: "Возвращено поставщику",
  SUBMITTED_TO_CCO: "На согласовании CCO",
  CCO_REVIEW: "На рассмотрении CCO",
  RETURNED_TO_MANAGER: "Возвращено менеджеру",
  APPROVED: "Одобрено",
  DECLINED: "Отклонено",
};

const supplierFieldDefinitions = [
  { key: "productName", label: "Название товара", section: "Основная информация", type: "text", required: true, editableBy: ["supplier"] },
  { key: "brandName", label: "Бренд", section: "Бренд и категория", type: "text", required: true, editableBy: ["supplier"] },
  { key: "category", label: "Категория", section: "Бренд и категория", type: "select", required: true, options: categories, editableBy: ["supplier"] },
  { key: "barcode", label: "EAN / Штрихкод", section: "Информация о товаре", type: "text", required: true, editableBy: ["supplier"] },
  { key: "description", label: "Описание товара", section: "Информация о товаре", type: "textarea", required: false, editableBy: ["supplier"] },
  { key: "purchasePrice", label: "Закупочная цена", section: "Цены и коммерческие условия", type: "number", required: true, editableBy: ["supplier"] },
  { key: "currency", label: "Валюта", section: "Цены и коммерческие условия", type: "select", required: true, options: ["UZS", "USD", "EUR"], editableBy: ["supplier"] },
  { key: "casePack", label: "Квант поставки", section: "Логистика", type: "text", required: false, editableBy: ["supplier"] },
  { key: "launchDate", label: "Желаемая дата запуска", section: "Логистика", type: "date", required: false, editableBy: ["supplier"] },
  { key: "documentUrl", label: "Ссылка на документы", section: "Документы", type: "url", required: false, editableBy: ["supplier"] },
  { key: "additionalInfo", label: "Дополнительная информация", section: "Дополнительная информация", type: "textarea", required: false, editableBy: ["supplier"] },
];

const managerFieldDefinitions = [
  { key: "assortmentFit", label: "Соответствие ассортименту Bloom", section: "Данные Bloom / Заполняется менеджером", type: "select", required: true, options: ["Высокое", "Среднее", "Низкое"], editableBy: ["manager"] },
  { key: "recommendedRrp", label: "Рекомендованная РРЦ", section: "Данные Bloom / Заполняется менеджером", type: "number", required: true, editableBy: ["manager"] },
  { key: "listingPriority", label: "Приоритет листинга", section: "Данные Bloom / Заполняется менеджером", type: "select", required: true, options: ["A", "B", "C"], editableBy: ["manager"] },
  { key: "managerComment", label: "Комментарий менеджера", section: "Данные Bloom / Заполняется менеджером", type: "textarea", required: false, editableBy: ["manager"] },
];

const applicationFieldDefinitions = {
  supplier: supplierFieldDefinitions,
  manager: managerFieldDefinitions,
};

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
    productApplications: [applicationSeed("sup_demo")],
    approvedProducts: [],
    nextBloomNumber: 1,
    notifications: [],
    sessions: [],
  };
}

function applicationSeed(supplierId) {
  const now = "2026-08-21T08:30:00.000Z";
  return {
    id: "BL-2026-00001",
    supplierId,
    status: ApplicationStatus.SUBMITTED_TO_MANAGER,
    assignedManagerEmail: "manager@bloom.test",
    bloomId: null,
    supplierData: {
      productName: "Hydra Glow Cream 50 ml",
      brandName: "Northern Glow",
      category: "Уход за лицом",
      barcode: "4780012345678",
      description: "Daily moisturizing cream for premium beauty retail.",
      purchasePrice: 52000,
      currency: "UZS",
      casePack: "12 units",
      launchDate: "2026-09-15",
      documentUrl: "https://example.com/product-docs",
      additionalInfo: "Demo application for the new workflow.",
    },
    managerData: {
      assortmentFit: "",
      recommendedRrp: "",
      listingPriority: "",
      managerComment: "",
    },
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
    approvedAt: null,
    declinedAt: null,
    history: [
      {
        id: id("hist"),
        at: now,
        actor: "sales@aurora.example",
        action: "Supplier submitted application to Manager",
        fromStatus: ApplicationStatus.DRAFT,
        toStatus: ApplicationStatus.SUBMITTED_TO_MANAGER,
        comment: "",
      },
      {
        id: id("hist"),
        at: "2026-08-21T08:10:00.000Z",
        actor: "sales@aurora.example",
        action: "Supplier created application",
        fromStatus: null,
        toStatus: ApplicationStatus.DRAFT,
        comment: "",
      },
    ],
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
      );

      create table if not exists bloom_id_sequence (
        id bigserial primary key,
        created_at timestamptz not null default now()
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
    productApplications: (db.productApplications || []).map(normalizeApplication),
    approvedProducts: db.approvedProducts || db.products || [],
    nextBloomNumber: db.nextBloomNumber || 1,
    notifications: db.notifications || [],
    sessions: db.sessions || [],
  };
}

function normalizeApplication(application) {
  return {
    id: application.id,
    supplierId: application.supplierId,
    status: Object.values(ApplicationStatus).includes(application.status) ? application.status : ApplicationStatus.DRAFT,
    assignedManagerEmail: application.assignedManagerEmail || "manager@bloom.test",
    bloomId: application.bloomId || null,
    supplierData: { ...blankSupplierData(), ...(application.supplierData || {}) },
    managerData: { ...blankManagerData(), ...(application.managerData || {}) },
    createdAt: application.createdAt || new Date().toISOString(),
    updatedAt: application.updatedAt || application.createdAt || new Date().toISOString(),
    submittedAt: application.submittedAt || null,
    approvedAt: application.approvedAt || null,
    declinedAt: application.declinedAt || null,
    history: Array.isArray(application.history) ? application.history : [],
  };
}

function blankSupplierData() {
  return Object.fromEntries(supplierFieldDefinitions.map((field) => [field.key, field.key === "currency" ? "UZS" : ""]));
}

function blankManagerData() {
  return Object.fromEntries(managerFieldDefinitions.map((field) => [field.key, ""]));
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

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.DATABASE_URL || "dev-session-secret";
}

function signSession(userId, expiresAt) {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySessionToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.userId || !session.expiresAt || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
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
  const signedSession = verifySessionToken(sid);
  if (signedSession) return db.users.find((user) => user.id === signedSession.userId) || null;
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

function roleKind(user) {
  if (!user) return "anonymous";
  if (user.role === "supplier") return "supplier";
  if (user.role === "manager" || user.role === "admin" || user.role === "cm") return "manager";
  if (user.role === "superadmin" || user.email === "khusanyusupkhujaev" || user.role === "director") return "cco";
  return user.role;
}

function canSeeApplication(application, user) {
  const role = roleKind(user);
  if (role === "supplier") return application.supplierId === user.supplierId;
  if (role === "manager" || role === "cco") return true;
  return false;
}

function applicationsForUser(db, user) {
  if (!user) return [];
  return db.productApplications
    .filter((application) => canSeeApplication(application, user))
    .map((application) => decorateApplication(application, db));
}

function decorateApplication(application, db) {
  return {
    ...application,
    supplier: supplierView(db, application.supplierId),
    statusLabel: statusLabels[application.status] || application.status,
  };
}

function approvedProductsForUser(db, user) {
  if (!user) return [];
  return db.approvedProducts.filter((product) => roleKind(user) !== "supplier" || product.supplierId === user.supplierId);
}

function applicationCounters(applications, role) {
  const byStatus = (statuses) => applications.filter((item) => statuses.includes(item.status)).length;
  return {
    drafts: byStatus([ApplicationStatus.DRAFT]),
    managerQueue: byStatus([ApplicationStatus.SUBMITTED_TO_MANAGER, ApplicationStatus.MANAGER_REVIEW]),
    returnedSupplier: byStatus([ApplicationStatus.RETURNED_TO_SUPPLIER]),
    ccoQueue: byStatus([ApplicationStatus.SUBMITTED_TO_CCO, ApplicationStatus.CCO_REVIEW]),
    returnedManager: byStatus([ApplicationStatus.RETURNED_TO_MANAGER]),
    approved: byStatus([ApplicationStatus.APPROVED]),
    declined: byStatus([ApplicationStatus.DECLINED]),
    pendingPrimary: role === "cco" ? byStatus([ApplicationStatus.SUBMITTED_TO_CCO, ApplicationStatus.CCO_REVIEW]) : byStatus([ApplicationStatus.SUBMITTED_TO_MANAGER, ApplicationStatus.MANAGER_REVIEW]),
  };
}

function updateApplicationData(application, body, user) {
  const role = roleKind(user);
  if (body.supplierData) {
    if (role !== "supplier") {
      throw Object.assign(new Error("Supplier fields can only be edited by supplier"), { status: 403 });
    }
    if (![ApplicationStatus.DRAFT, ApplicationStatus.RETURNED_TO_SUPPLIER].includes(application.status)) {
      throw Object.assign(new Error("Supplier data is locked for this status"), { status: 403 });
    }
    application.supplierData = { ...application.supplierData, ...pickKnownFields(body.supplierData, supplierFieldDefinitions) };
  }
  if (body.managerData) {
    if (role !== "manager") {
      throw Object.assign(new Error("Manager fields can only be edited by Bloom manager"), { status: 403 });
    }
    if (![ApplicationStatus.SUBMITTED_TO_MANAGER, ApplicationStatus.MANAGER_REVIEW, ApplicationStatus.RETURNED_TO_MANAGER].includes(application.status)) {
      throw Object.assign(new Error("Manager data is locked for this status"), { status: 403 });
    }
    application.managerData = { ...application.managerData, ...pickKnownFields(body.managerData, managerFieldDefinitions) };
  }
  application.updatedAt = new Date().toISOString();
}

function pickKnownFields(data, definitions) {
  return Object.fromEntries(
    definitions
      .filter((field) => Object.prototype.hasOwnProperty.call(data, field.key))
      .map((field) => [field.key, String(data[field.key] ?? "").trim()]),
  );
}

function validateRequiredFields(data, definitions) {
  const missing = definitions.filter((field) => field.required && !String(data[field.key] ?? "").trim()).map((field) => field.label);
  if (missing.length) {
    throw Object.assign(new Error(`Заполните обязательные поля: ${missing.join(", ")}`), { status: 400, missing });
  }
}

function addHistory(application, actor, action, fromStatus, toStatus, comment = "") {
  application.history.unshift({
    id: id("hist"),
    at: new Date().toISOString(),
    actor: actor.email,
    action,
    fromStatus,
    toStatus,
    comment: String(comment || ""),
  });
}

function transitionApplication(application, user, nextStatus, action, comment = "") {
  const previous = application.status;
  application.status = nextStatus;
  application.updatedAt = new Date().toISOString();
  addHistory(application, user, action, previous, nextStatus, comment);
}

function findApplicationForUser(db, applicationId, user) {
  const application = db.productApplications.find((item) => item.id === applicationId);
  if (!application || !canSeeApplication(application, user)) throw Object.assign(new Error("Application not found"), { status: 404 });
  return application;
}

async function nextBloomId(db) {
  if (usePostgres) {
    await ensurePostgresSchema();
    const client = await pool();
    const result = await client.query("insert into bloom_id_sequence default values returning id");
    return `BLM-${String(result.rows[0].id).padStart(6, "0")}`;
  }
  const number = db.nextBloomNumber || 1;
  db.nextBloomNumber = number + 1;
  return `BLM-${String(number).padStart(6, "0")}`;
}

function createApprovedProduct(db, application, user) {
  if (db.approvedProducts.some((product) => product.applicationId === application.id)) return;
  db.approvedProducts.push({
    id: id("prd"),
    bloomId: application.bloomId,
    applicationId: application.id,
    supplierId: application.supplierId,
    productName: application.supplierData.productName,
    brandName: application.supplierData.brandName,
    category: application.supplierData.category,
    barcode: application.supplierData.barcode,
    status: "ACTIVE",
    approvedAt: application.approvedAt,
    approvedBy: user.email,
  });
}

function notify(db, recipientEmail, message, type = "workflow") {
  addNotification(db, type, recipientEmail, message);
}

function workspacePayload(db, user) {
  const applications = applicationsForUser(db, user);
  const role = roleKind(user);
  const payload = {
    user: publicUser(user, db),
    role,
    categories,
    applicationStatuses: statusLabels,
    applicationFieldDefinitions,
    applications,
    applicationCounters: applicationCounters(applications, role),
    categoryManagers: db.categoryManagers,
    staff: db.users.filter((item) => item.role !== "supplier").map((item) => publicUser(item, db)),
    proposals: [],
    products: [],
    approvedProducts: [],
    notifications: [],
    users: [],
    suppliers: [],
  };

  if (!user) return payload;

  payload.proposals = proposalsForUser(db, user);
  payload.products = productsForUser(db, user);
  payload.approvedProducts = approvedProductsForUser(db, user);
  payload.notifications = notificationsForUser(db, user);

  if (["manager", "cm", "director", "admin", "superadmin"].includes(user.role)) {
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
      await saveDb(db);
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

    if (method === "GET" && url.pathname === "/api/applications") {
      return sendJson(res, 200, { applications: applicationsForUser(db, current) });
    }

    if (method === "POST" && url.pathname === "/api/applications") {
      requireRole(current, ["supplier"]);
      const body = await readBody(req);
      const now = new Date().toISOString();
      const application = {
        id: nextApplicationId(db),
        supplierId: current.supplierId,
        status: ApplicationStatus.DRAFT,
        assignedManagerEmail: "manager@bloom.test",
        bloomId: null,
        supplierData: blankSupplierData(),
        managerData: blankManagerData(),
        createdAt: now,
        updatedAt: now,
        submittedAt: null,
        approvedAt: null,
        declinedAt: null,
        history: [],
      };
      addHistory(application, current, "Supplier created application", null, ApplicationStatus.DRAFT);
      if (body.supplierData) updateApplicationData(application, body, current);
      db.productApplications.unshift(application);
      await saveDb(db);
      return sendJson(res, 201, { application: decorateApplication(application, db) });
    }

    const applicationMatch = url.pathname.match(/^\/api\/applications\/([^/]+)$/);
    if (applicationMatch) {
      const application = findApplicationForUser(db, applicationMatch[1], current);
      if (method === "GET") return sendJson(res, 200, { application: decorateApplication(application, db) });
      if (method === "PATCH") {
        updateApplicationData(application, await readBody(req), current);
        addHistory(application, current, "Application draft saved", application.status, application.status);
        await saveDb(db);
        return sendJson(res, 200, { application: decorateApplication(application, db) });
      }
    }

    const applicationActionMatch = url.pathname.match(/^\/api\/applications\/([^/]+)\/([a-z-]+)$/);
    if (applicationActionMatch) {
      const application = findApplicationForUser(db, applicationActionMatch[1], current);
      const action = applicationActionMatch[2];
      const body = await readBody(req);
      const role = roleKind(current);

      if (action === "submit-manager" && method === "POST") {
        requireRole(current, ["supplier"]);
        if (![ApplicationStatus.DRAFT, ApplicationStatus.RETURNED_TO_SUPPLIER].includes(application.status)) {
          throw Object.assign(new Error("Application cannot be submitted to manager from this status"), { status: 400 });
        }
        if (body.supplierData) updateApplicationData(application, body, current);
        validateRequiredFields(application.supplierData, supplierFieldDefinitions);
        application.submittedAt = new Date().toISOString();
        transitionApplication(application, current, ApplicationStatus.SUBMITTED_TO_MANAGER, application.status === ApplicationStatus.RETURNED_TO_SUPPLIER ? "Supplier resubmitted application to Manager" : "Supplier submitted application to Manager", body.comment);
        notify(db, "manager@bloom.test", `Получена новая заявка ${application.id}.`);
        await saveDb(db);
        return sendJson(res, 200, { application: decorateApplication(application, db) });
      }

      if (action === "start-manager" && method === "POST") {
        if (role !== "manager") throw Object.assign(new Error("Forbidden"), { status: 403 });
        if (![ApplicationStatus.SUBMITTED_TO_MANAGER, ApplicationStatus.RETURNED_TO_MANAGER].includes(application.status)) {
          throw Object.assign(new Error("Application is not in manager queue"), { status: 400 });
        }
        transitionApplication(application, current, ApplicationStatus.MANAGER_REVIEW, "Manager started review");
        await saveDb(db);
        return sendJson(res, 200, { application: decorateApplication(application, db) });
      }

      if (action === "return-supplier" && method === "POST") {
        if (role !== "manager") throw Object.assign(new Error("Forbidden"), { status: 403 });
        const comment = validate(body.comment, "Причина возврата");
        transitionApplication(application, current, ApplicationStatus.RETURNED_TO_SUPPLIER, "Manager returned application to Supplier", comment);
        const supplier = supplierView(db, application.supplierId);
        notify(db, supplier.email, `Ваша заявка ${application.id} возвращена на доработку.`);
        await saveDb(db);
        return sendJson(res, 200, { application: decorateApplication(application, db) });
      }

      if (action === "submit-cco" && method === "POST") {
        if (role !== "manager") throw Object.assign(new Error("Forbidden"), { status: 403 });
        if (body.managerData) updateApplicationData(application, body, current);
        validateRequiredFields(application.supplierData, supplierFieldDefinitions);
        validateRequiredFields(application.managerData, managerFieldDefinitions);
        transitionApplication(application, current, ApplicationStatus.SUBMITTED_TO_CCO, "Manager submitted application to CCO", body.comment);
        notify(db, "khusanyusupkhujaev", `Заявка ${application.id} ожидает вашего согласования.`);
        await saveDb(db);
        return sendJson(res, 200, { application: decorateApplication(application, db) });
      }

      if (action === "return-manager" && method === "POST") {
        if (role !== "cco") throw Object.assign(new Error("Forbidden"), { status: 403 });
        const comment = validate(body.comment, "Комментарий CCO");
        const target = body.target === "supplier" ? ApplicationStatus.RETURNED_TO_SUPPLIER : ApplicationStatus.RETURNED_TO_MANAGER;
        transitionApplication(application, current, target, target === ApplicationStatus.RETURNED_TO_SUPPLIER ? "CCO returned application to Supplier" : "CCO returned application to Manager", comment);
        if (target === ApplicationStatus.RETURNED_TO_SUPPLIER) {
          const supplier = supplierView(db, application.supplierId);
          notify(db, supplier.email, `Заявка ${application.id} возвращена CCO на доработку.`);
        } else {
          notify(db, application.assignedManagerEmail, `Заявка ${application.id} возвращена CCO менеджеру.`);
        }
        await saveDb(db);
        return sendJson(res, 200, { application: decorateApplication(application, db) });
      }

      if (action === "decline" && method === "POST") {
        if (role !== "cco") throw Object.assign(new Error("Forbidden"), { status: 403 });
        const comment = validate(body.comment, "Причина отклонения");
        application.declinedAt = new Date().toISOString();
        transitionApplication(application, current, ApplicationStatus.DECLINED, "CCO declined application", comment);
        const supplier = supplierView(db, application.supplierId);
        notify(db, supplier.email, `Заявка ${application.id} отклонена.`);
        notify(db, application.assignedManagerEmail, `Заявка ${application.id} отклонена CCO.`);
        await saveDb(db);
        return sendJson(res, 200, { application: decorateApplication(application, db) });
      }

      if (action === "approve" && method === "POST") {
        if (role !== "cco") throw Object.assign(new Error("Forbidden"), { status: 403 });
        if (![ApplicationStatus.SUBMITTED_TO_CCO, ApplicationStatus.CCO_REVIEW].includes(application.status)) {
          throw Object.assign(new Error("Application is not ready for CCO approval"), { status: 400 });
        }
        if (!application.bloomId) application.bloomId = await nextBloomId(db);
        application.approvedAt = new Date().toISOString();
        transitionApplication(application, current, ApplicationStatus.APPROVED, `CCO approved product. Bloom ID generated: ${application.bloomId}`, body.comment);
        createApprovedProduct(db, application, current);
        const supplier = supplierView(db, application.supplierId);
        notify(db, supplier.email, `Товар одобрен. Bloom ID: ${application.bloomId}.`);
        notify(db, application.assignedManagerEmail, `Заявка ${application.id} одобрена. Bloom ID: ${application.bloomId}.`);
        await saveDb(db);
        return sendJson(res, 200, { application: decorateApplication(application, db), approvedProducts: approvedProductsForUser(db, current) });
      }
    }

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
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12;
  const sid = signSession(user.id, expiresAt);
  return sendJson(res, 200, workspacePayload(db, user), { "set-cookie": `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200` });
}

function nextProposalId(db) {
  return `BLM-2026-${String(db.proposals.length + 1).padStart(4, "0")}`;
}

function nextApplicationId(db) {
  const year = new Date().getFullYear();
  const max = db.productApplications
    .map((application) => String(application.id || "").match(/^BL-\d{4}-(\d+)$/)?.[1])
    .filter(Boolean)
    .map(Number)
    .reduce((highest, number) => Math.max(highest, number), 0);
  return `BL-${year}-${String(max + 1).padStart(5, "0")}`;
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
