const base = process.env.BASE_URL || "http://127.0.0.1:4173";

function client() {
  let cookie = "";
  return async function request(path, options = {}) {
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        cookie,
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const payload = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(`${path}: ${payload?.error || response.status}`);
    return payload;
  };
}

const stamp = Date.now();
const supplier = client();
const manager = client();
const cco = client();

await supplier("/api/auth/login", {
  method: "POST",
  body: { email: "sales@aurora.example", password: "password123" },
});

const created = await supplier("/api/applications", {
  method: "POST",
  body: {
    supplierData: {
      productName: `Smoke Product ${stamp}`,
      brandName: `Smoke Brand ${stamp}`,
      category: "Lifestyle",
      barcode: `998${stamp}`,
      description: "Smoke test product application",
      purchasePrice: "12000",
      currency: "UZS",
      casePack: "12 units",
      launchDate: "2026-09-01",
      documentUrl: "https://example.com/smoke-docs",
      additionalInfo: "Automated workflow check",
    },
  },
});

await supplier(`/api/applications/${created.application.id}/submit-manager`, { method: "POST" });

await manager("/api/auth/login", {
  method: "POST",
  body: { email: "manager@bloom.test", password: "password123" },
});

let managerWorkspace = await manager("/api/workspace");
let managerApp = managerWorkspace.applications.find((item) => item.id === created.application.id);
if (!managerApp || managerApp.status !== "SUBMITTED_TO_MANAGER") throw new Error("Application is not visible in manager queue");

await manager(`/api/applications/${created.application.id}/start-manager`, { method: "POST" });
await manager(`/api/applications/${created.application.id}/submit-cco`, {
  method: "POST",
  body: {
    managerData: {
      assortmentFit: "Высокое",
      recommendedRrp: "25000",
      listingPriority: "A",
      managerComment: "Smoke reviewed by manager",
    },
  },
});

await cco("/api/auth/login", {
  method: "POST",
  body: {
    email: process.env.SUPERADMIN_LOGIN || "khusanyusupkhujaev",
    password: process.env.SUPERADMIN_PASSWORD || "password123",
  },
});

const ccoWorkspace = await cco("/api/workspace");
const ccoApp = ccoWorkspace.applications.find((item) => item.id === created.application.id);
if (!ccoApp || ccoApp.status !== "SUBMITTED_TO_CCO") throw new Error("Application is not visible in CCO queue");

const approved = await cco(`/api/applications/${created.application.id}/approve`, {
  method: "POST",
  body: { comment: "Smoke approved by CCO" },
});

if (approved.application.status !== "APPROVED") throw new Error("Application was not approved");
if (!/^BLM-\d{6}$/.test(approved.application.bloomId)) throw new Error("Bloom ID was not generated");

const supplierWorkspace = await supplier("/api/workspace");
if (!supplierWorkspace.approvedProducts.some((product) => product.bloomId === approved.application.bloomId)) {
  throw new Error("Approved product is not visible to supplier");
}

console.log(`OK ${created.application.id}: supplier -> manager -> CCO -> ${approved.application.bloomId}`);
