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

const supplier = client();
const cm = client();
const director = client();
const superadmin = client();

await supplier("/api/auth/login", {
  method: "POST",
  body: { email: "sales@aurora.example", password: "password123" },
});

const created = await supplier("/api/proposals", {
  method: "POST",
  body: {
    brandName: `Smoke Brand ${Date.now()}`,
    category: "Lifestyle",
    brandDescription: "Smoke test proposal",
    brandLink: "https://example.com/smoke",
    skus: [
      {
        productName: "Smoke Product One",
        ean: `998${Date.now()}`,
        volume: "100 ml",
        dimensions: "40 x 40 x 120 mm",
        priceExVat: 10000,
        priceIncVat: 11200,
        currency: "UZS",
        rrp: 19000,
        casePack: "6 units",
        shelfLife: "18 months",
        frontPhoto: "https://placehold.co/420x520?text=Front",
        backPhoto: "https://placehold.co/420x520?text=Back",
        competitors: [{ name: "Competitor", price: 20000, currency: "UZS", url: "https://example.com/product" }],
      },
      {
        productName: "Smoke Product Two",
        ean: `999${Date.now()}`,
        volume: "50 ml",
        dimensions: "35 x 35 x 100 mm",
        priceExVat: 9000,
        priceIncVat: 10080,
        currency: "UZS",
        rrp: 17000,
        casePack: "12 units",
        shelfLife: "24 months",
        frontPhoto: "https://placehold.co/420x520?text=Front",
        backPhoto: "https://placehold.co/420x520?text=Back",
        competitors: [{ name: "Competitor", price: 18000, currency: "UZS", url: "" }],
      },
    ],
  },
});

await cm("/api/auth/login", {
  method: "POST",
  body: { email: "cm1@bloom.test", password: "password123" },
});

const cmProposals = await cm("/api/proposals");
const proposal = cmProposals.proposals.find((item) => item.id === created.proposal.id);
if (!proposal) throw new Error("Created proposal is not visible to assigned CM");

const sku = proposal.skus[0];
await cm(`/api/skus/${sku.id}/cm-decision`, {
  method: "PATCH",
  body: { state: "Selected / Recommended" },
});
await cm(`/api/proposals/${proposal.id}/send-final`, { method: "POST" });

await director("/api/auth/login", {
  method: "POST",
  body: { email: "director@bloom.test", password: "password123" },
});

const queue = await director("/api/proposals");
const pending = queue.proposals
  .find((item) => item.id === proposal.id)
  ?.skus.find((item) => item.state === "Pending Commercial Director");
if (!pending) throw new Error("Selected SKU did not reach director queue");

await director(`/api/skus/${pending.id}/final-decision`, {
  method: "PATCH",
  body: { state: "Approved" },
});

const products = await director("/api/products");
if (!products.products.some((product) => product.sourceSkuId === pending.id)) {
  throw new Error("Approved SKU did not create an approved product");
}

if (process.env.SUPERADMIN_LOGIN && process.env.SUPERADMIN_PASSWORD) {
  await superadmin("/api/auth/login", {
    method: "POST",
    body: { email: process.env.SUPERADMIN_LOGIN, password: process.env.SUPERADMIN_PASSWORD },
  });

  const [users, allProposals] = await Promise.all([superadmin("/api/users"), superadmin("/api/proposals")]);
  if (!users.users.some((user) => user.role === "superadmin" && user.email === process.env.SUPERADMIN_LOGIN)) {
    throw new Error("Superadmin account is missing from users dashboard");
  }
  if (!allProposals.proposals.some((item) => item.id === proposal.id)) {
    throw new Error("Superadmin cannot see all proposals");
  }
}

console.log(`OK ${proposal.id}: supplier -> CM -> director -> product`);
