const labels = {
  en: {
    subtitle: "Supplier Portal",
    login: "Login",
    loginIdentifier: "Email / login",
    register: "Register supplier",
    email: "Email",
    password: "Password",
    legalName: "Full legal company name",
    tin: "TIN / INN",
    phone: "Phone",
    demo: "Demo accounts use password123",
    supplierDemo: "Supplier: sales@aurora.example",
    managerDemo: "Manager: manager@bloom.test",
    cmDemo: "CM: cm1@bloom.test / cm2@bloom.test",
    directorDemo: "Director: director@bloom.test",
    superadminDemo: "Superadmin: khusanyusupkhujaev",
    dashboard: "Proposals",
    users: "Users",
    newProposal: "New proposal",
    profile: "Profile",
    assignments: "Assignments",
    products: "Products",
    notifications: "Notifications",
    logout: "Logout",
    brandName: "Brand name",
    category: "Category",
    brandDescription: "Brand description",
    brandLink: "Brand website / social link",
    addSku: "Add SKU",
    submit: "Submit proposal",
    productName: "Product / SKU name",
    ean: "EAN / Barcode",
    volume: "Volume / weight",
    dimensions: "Dimensions L x W x H",
    priceExVat: "Purchase price excl. VAT",
    priceIncVat: "Purchase price incl. VAT",
    currency: "Currency",
    rrp: "RRP",
    casePack: "Supply quantum / case pack",
    shelfLife: "Shelf life",
    frontPhoto: "Front product photo URL",
    backPhoto: "Back product photo URL",
    competitor: "Competitor",
    competitorPrice: "Competitor price",
    productUrl: "Product URL",
    addCompetitor: "Add competitor",
    search: "Search",
    status: "Status",
    all: "All",
    supplier: "Supplier",
    assignedCm: "Assigned CM",
    submitted: "Submitted",
    actions: "Actions",
    assign: "Assign",
    select: "Select",
    reject: "Reject",
    keep: "Keep under review",
    sendFinal: "Send selected to director",
    approve: "Approve",
    duplicate: "Possible duplicate EAN",
    save: "Save",
    noRows: "No records.",
  },
  ru: {
    subtitle: "Портал поставщика",
    login: "Войти",
    loginIdentifier: "Email / логин",
    register: "Регистрация поставщика",
    email: "Email",
    password: "Пароль",
    legalName: "Полное юридическое название",
    tin: "ИНН",
    phone: "Телефон",
    demo: "Пароль для демо аккаунтов: password123",
    supplierDemo: "Поставщик: sales@aurora.example",
    managerDemo: "Менеджер: manager@bloom.test",
    cmDemo: "КМ: cm1@bloom.test / cm2@bloom.test",
    directorDemo: "Директор: director@bloom.test",
    superadminDemo: "Суперадмин: khusanyusupkhujaev",
    dashboard: "Заявки",
    users: "Пользователи",
    newProposal: "Новая заявка",
    profile: "Профиль",
    assignments: "Назначения",
    products: "Продукты",
    notifications: "Уведомления",
    logout: "Выйти",
    brandName: "Название бренда",
    category: "Категория",
    brandDescription: "Описание бренда",
    brandLink: "Сайт / социальная ссылка",
    addSku: "Добавить SKU",
    submit: "Отправить заявку",
    productName: "Название продукта / SKU",
    ean: "EAN / Штрихкод",
    volume: "Объем / вес",
    dimensions: "Габариты Д x Ш x В",
    priceExVat: "Закупочная цена без НДС",
    priceIncVat: "Закупочная цена с НДС",
    currency: "Валюта",
    rrp: "РРЦ",
    casePack: "Квант поставки / короб",
    shelfLife: "Срок годности",
    frontPhoto: "URL фото спереди",
    backPhoto: "URL фото сзади",
    competitor: "Конкурент",
    competitorPrice: "Цена конкурента",
    productUrl: "Ссылка на продукт",
    addCompetitor: "Добавить конкурента",
    search: "Поиск",
    status: "Статус",
    all: "Все",
    supplier: "Поставщик",
    assignedCm: "Ответственный КМ",
    submitted: "Подана",
    actions: "Действия",
    assign: "Назначить",
    select: "Выбрать",
    reject: "Отклонить",
    keep: "Оставить на рассмотрении",
    sendFinal: "Отправить директору",
    approve: "Одобрить",
    duplicate: "Возможный дубликат EAN",
    save: "Сохранить",
    noRows: "Нет записей.",
  },
};

let state = {
  lang: localStorage.getItem("bloomLang") || "en",
  user: null,
  page: "dashboard",
  authMode: null,
  mobileMenu: false,
  categories: [],
  categoryManagers: {},
  staff: [],
  proposals: [],
  products: [],
  notifications: [],
  users: [],
  suppliers: [],
  error: "",
};

const app = document.getElementById("app");
const t = (key) => labels[state.lang][key] || labels.en[key] || key;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function boot() {
  applyWorkspace(await api("/api/workspace"));
  const requestedAuth = new URLSearchParams(window.location.search).get("auth");
  if (!state.user && ["login", "register"].includes(requestedAuth)) state.authMode = requestedAuth;
  render();
}

async function loadWorkspace() {
  applyWorkspace(await api("/api/workspace"));
}

function applyWorkspace(workspace) {
  state.user = workspace.user;
  state.categories = workspace.categories || [];
  state.categoryManagers = workspace.categoryManagers || {};
  state.staff = workspace.staff || [];
  state.proposals = workspace.proposals || [];
  state.products = workspace.products || [];
  state.notifications = workspace.notifications || [];
  state.users = workspace.users || [];
  state.suppliers = workspace.suppliers || [];
}

function render() {
  app.innerHTML = state.user ? shell() : authScreen();
}

function authScreen() {
  return `
    <main class="landing">
      ${landingHeader()}
      ${landingHero()}
      ${whyBloom()}
      ${startSteps()}
      ${portalFeatures()}
      ${categorySection()}
      ${faqSection()}
      ${landingFooter()}
      ${state.authMode ? authPanel() : ""}
    </main>
  `;
}

window.showAuth = (mode) => {
  if (mode === "login") {
    window.location.href = "./login.html";
    return;
  }
  state.authMode = mode;
  state.error = "";
  render();
};

window.closeAuth = () => {
  state.authMode = null;
  state.error = "";
  render();
};

window.toggleMobileMenu = () => {
  state.mobileMenu = !state.mobileMenu;
  render();
};

function bloomLogo(className = "bloom-logo") {
  return `<img class="${className}" src="https://bloombeauty.uz/_nuxt/img/logo.f331bda.svg" alt="Bloom Beauty" />`;
}

function landingHeader() {
  const navItems = [
    ["#why", "Почему Bloom"],
    ["#start", "Как начать"],
    ["#features", "Возможности портала"],
    ["#categories", "Категории"],
    ["#faq", "FAQ"],
  ];
  return `
    <header class="landing-header">
      <div class="landing-container header-inner">
        <a class="landing-logo" href="#" aria-label="Bloom Beauty">${bloomLogo()}</a>
        <nav class="landing-nav" aria-label="Основная навигация">
          ${navItems.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}
        </nav>
        <div class="header-actions">
          <button class="btn-dark" onclick="showAuth('login')">Войти</button>
          <button class="btn-coral" onclick="showAuth('register')">Зарегистрироваться</button>
        </div>
        <button class="menu-button" onclick="toggleMobileMenu()" aria-label="Открыть меню" aria-expanded="${state.mobileMenu ? "true" : "false"}">
          <span></span><span></span><span></span>
        </button>
      </div>
      ${state.mobileMenu ? `
        <div class="mobile-menu">
          ${navItems.map(([href, label]) => `<a href="${href}" onclick="toggleMobileMenu()">${label}</a>`).join("")}
          <button class="btn-dark" onclick="showAuth('login')">Войти</button>
          <button class="btn-coral" onclick="showAuth('register')">Зарегистрироваться</button>
        </div>
      ` : ""}
    </header>
  `;
}

function landingHero() {
  return `
    <section class="landing-container hero">
      <div class="hero-copy">
        <span class="eyebrow">Bloom Beauty Uzbekistan</span>
        <h1>Станьте поставщиком Bloom</h1>
        <p class="hero-lead">Предложите свою продукцию Bloom, пройдите процесс согласования и получите доступ к порталу поставщиков для дальнейшей работы.</p>
        <button class="btn-coral hero-cta" onclick="showAuth('register')">Стать поставщиком</button>
        <div class="document-grid" aria-label="Документы для поставщиков">
          ${documentCard("Требования к поставщикам")}
          ${documentCard("Требования к качеству поставляемых товаров")}
        </div>
      </div>
      <div class="hero-visual" aria-label="Bloom beauty retail">
        <img src="https://avatars.mds.yandex.net/get-altay/16480550/2a00000199e61b28ff00ef4cca1b403afade/orig" alt="Bloom beauty retail interior" />
      </div>
    </section>
  `;
}

function documentCard(title) {
  return `
    <a class="document-card" href="#" onclick="event.preventDefault()">
      <span class="document-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l4 4v14H7V3Z" stroke="currentColor" stroke-width="1.8"/><path d="M14 3v5h5M9.5 14.5 12 17m0 0 2.5-2.5M12 17v-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <strong>${title}</strong>
      <span>Скачать файл</span>
    </a>
  `;
}

function whyBloom() {
  const items = [
    ["Доступ к широкой аудитории", "Bloom объединяет покупателей, которые выбирают косметику, уход и парфюмерию премиального уровня."],
    ["Прозрачный процесс сотрудничества", "Заявки, решения и статусы фиксируются в едином цифровом пространстве."],
    ["Быстрое рассмотрение заявок", "Категорийные менеджеры получают полную карточку SKU и коммерческие данные сразу."],
    ["Удобный портал поставщика", "Поставщик видит свои предложения, решения по SKU и дальнейшие шаги."],
  ];
  return section("why", "Почему Bloom", "Партнерство с Bloom строится вокруг качества, доверия и аккуратного коммерческого процесса.", `
    <div class="benefit-grid">${items.map(([title, text]) => `
      <article class="benefit-card"><span></span><h3>${title}</h3><p>${text}</p></article>
    `).join("")}</div>
  `);
}

function startSteps() {
  const steps = [
    ["01", "Подайте заявку", "Зарегистрируйтесь и отправьте коммерческое предложение с SKU."],
    ["02", "Пройдите проверку", "Bloom рассмотрит бренд, категорию, цены, фотографии и EAN."],
    ["03", "Согласуйте условия", "Категорийный менеджер выберет подходящие SKU для финального решения."],
    ["04", "Начните сотрудничество", "Одобренные товары переходят в рабочий контур поставщика."],
  ];
  return section("start", "Как начать", "Четкий путь от первого предложения до утвержденных товаров.", `
    <div class="steps">${steps.map(([number, title, text]) => `
      <article class="step"><strong>${number}</strong><h3>${title}</h3><p>${text}</p></article>
    `).join("")}</div>
  `);
}

function portalFeatures() {
  const features = ["Управлять товарами", "Подавать новые SKU", "Отслеживать статус заявок", "Работать с документами", "Получать уведомления"];
  return section("features", "Возможности портала", "После регистрации поставщики и команда Bloom работают в едином цифровом процессе.", `
    <div class="feature-list">${features.map((item) => `
      <div class="feature-item"><span aria-hidden="true">✓</span>${item}</div>
    `).join("")}</div>
  `);
}

function categorySection() {
  const categories = ["Макияж", "Уход за лицом", "Парфюмерия", "Уход за волосами", "Тело и гигиена", "Lifestyle"];
  return section("categories", "Категории", "Bloom работает с ассортиментом, который помогает клиентам создавать персональный beauty-ритуал.", `
    <div class="category-grid">${categories.map((item) => `<div class="category-pill">${item}</div>`).join("")}</div>
  `);
}

function faqSection() {
  const faqs = [
    ["Кто может зарегистрироваться?", "Юридическое лицо, готовое предложить ассортимент для рассмотрения Bloom."],
    ["Можно ли предложить несколько брендов?", "Да. Один аккаунт поставщика может создавать предложения для разных брендов."],
    ["Когда SKU считается одобренным?", "Только после финального решения коммерческого директора Bloom."],
    ["Нужно ли переводить описание товаров?", "Свободный текст поставщика не переводится автоматически на этапе MVP."],
  ];
  return section("faq", "FAQ", "Короткие ответы на основные вопросы поставщиков.", `
    <div class="faq-list">${faqs.map(([question, answer]) => `
      <details class="faq-item"><summary>${question}</summary><p>${answer}</p></details>
    `).join("")}</div>
  `);
}

function section(id, title, lead, content) {
  return `
    <section id="${id}" class="landing-section">
      <div class="landing-container">
        <div class="section-heading">
          <span class="eyebrow">Supplier Portal</span>
          <h2>${title}</h2>
          <p>${lead}</p>
        </div>
        ${content}
      </div>
    </section>
  `;
}

function landingFooter() {
  return `
    <footer class="landing-footer">
      <div class="landing-container footer-inner">
        ${bloomLogo("footer-logo")}
        <span>© 2026 Bloom Beauty Uzbekistan · Supplier Portal</span>
        <button class="btn-coral" onclick="showAuth('register')">Стать поставщиком</button>
      </div>
    </footer>
  `;
}

function authPanel() {
  if (state.authMode === "login") return "";
  return `
    <div class="auth-overlay" role="dialog" aria-modal="true" aria-label="${t("register")}">
      <div class="auth-modal">
        <button class="modal-close" onclick="closeAuth()" aria-label="Закрыть">×</button>
        <div class="auth-modal-brand">
          ${bloomLogo("modal-logo")}
          <p>Создайте аккаунт поставщика Bloom</p>
        </div>
        ${state.error ? `<div class="error">${esc(state.error)}</div>` : ""}
        <div class="tabs">
          <button class="secondary" onclick="showAuth('login')">${t("login")}</button>
          <button class="primary" onclick="showAuth('register')">${t("register")}</button>
        </div>
        ${registerForm()}
        <p class="demo-note">${t("demo")}<br>${t("supplierDemo")} · ${t("managerDemo")} · ${t("directorDemo")} · ${t("superadminDemo")}</p>
      </div>
    </div>
  `;
}

function loginForm() {
  return `
    <form class="grid" onsubmit="login(event)">
      ${field("email", t("loginIdentifier"), "text")}
      ${field("password", t("password"), "password")}
      <div class="full actions"><button class="primary">${t("login")}</button></div>
    </form>
  `;
}

function registerForm() {
  return `
    <form class="grid" onsubmit="registerSupplier(event)">
      ${field("legalName", t("legalName"))}
      ${field("tin", t("tin"))}
      ${field("phone", t("phone"))}
      ${field("email", t("email"), "email")}
      ${field("password", t("password"), "password")}
      <div class="full actions"><button class="primary">${t("register")}</button></div>
    </form>
  `;
}

window.login = async (event) => {
  event.preventDefault();
  await run(async () => {
    const data = formData(event.target);
    applyWorkspace(await api("/api/auth/login", { method: "POST", body: data }));
  });
};

window.registerSupplier = async (event) => {
  event.preventDefault();
  await run(async () => {
    applyWorkspace(await api("/api/auth/register", { method: "POST", body: formData(event.target) }));
  });
};

function shell() {
  return `
    <header class="topbar">
      <div class="brand"><div class="mark">B</div><div><h1>BLOOM</h1><p>${t("subtitle")}</p></div></div>
      <div class="actions">
        <select onchange="setLang(this.value)">
          <option value="en" ${state.lang === "en" ? "selected" : ""}>English</option>
          <option value="ru" ${state.lang === "ru" ? "selected" : ""}>Русский</option>
        </select>
        <button class="secondary" onclick="logout()">${t("logout")}</button>
      </div>
    </header>
    <div class="layout">
      <aside class="sidebar">
        <div class="identity"><strong>${esc(state.user.name)}</strong><span>${state.user.role} · ${esc(state.user.email)}</span></div>
        <nav class="nav">
          ${nav("dashboard", t("dashboard"))}
          ${state.user.role === "supplier" ? nav("new", t("newProposal")) : ""}
          ${state.user.role === "supplier" ? nav("profile", t("profile")) : ""}
          ${["manager", "admin", "superadmin"].includes(state.user.role) ? nav("assignments", t("assignments")) : ""}
          ${["admin", "superadmin"].includes(state.user.role) ? nav("users", t("users")) : ""}
          ${nav("products", t("products"))}
          ${nav("notifications", t("notifications"))}
        </nav>
      </aside>
      <main class="main">
        ${state.error ? `<div class="error">${esc(state.error)}</div>` : ""}
        ${page()}
      </main>
    </div>
  `;
}

function nav(page, label) {
  return `<button class="${state.page === page ? "active" : ""}" onclick="go('${page}')">${label}</button>`;
}

window.go = async (page) => {
  state.page = page;
  render();
};

window.setLang = (lang) => {
  state.lang = lang;
  localStorage.setItem("bloomLang", lang);
  render();
};

window.logout = async () => {
  await api("/api/auth/logout", { method: "POST" });
  state.user = null;
  render();
};

function page() {
  if (state.page === "new") return newProposal();
  if (state.page === "profile") return profile();
  if (state.page === "assignments") return assignments();
  if (state.page === "users") return usersDashboard();
  if (state.page === "products") return products();
  if (state.page === "notifications") return notifications();
  return dashboard();
}

function dashboard() {
  return `
    <section class="panel">
      <div class="head"><div><h2>${t("dashboard")}</h2><p>${state.proposals.length} ${t("all").toLowerCase()}</p></div></div>
      <div class="filters">
        <input id="search" placeholder="${t("search")}" oninput="filterRows()" />
        <select id="status" onchange="filterRows()">
          <option value="">${t("all")} ${t("status").toLowerCase()}</option>
          <option>Submitted</option><option>Under Review</option><option>Approved</option><option>Rejected</option>
        </select>
      </div>
      ${proposalTable()}
    </section>
    ${state.proposals.map(proposalDetail).join("")}
  `;
}

function proposalTable() {
  if (!state.proposals.length) return `<div class="empty">${t("noRows")}</div>`;
  return `
    <div class="table-wrap">
      <table id="proposalTable">
        <thead><tr><th>ID</th><th>${t("supplier")}</th><th>${t("brandName")}</th><th>${t("category")}</th><th>${t("status")}</th><th>${t("assignedCm")}</th><th>${t("submitted")}</th><th>${t("actions")}</th></tr></thead>
        <tbody>${state.proposals.map((proposal) => `
          <tr data-search="${escAttr([proposal.id, proposal.supplier?.legalName, proposal.brandName, proposal.category, proposal.status, proposal.assignedCmEmail].join(" ").toLowerCase())}" data-status="${proposal.status}">
            <td><strong>${proposal.id}</strong></td><td>${esc(proposal.supplier?.legalName || "")}</td><td>${esc(proposal.brandName)}</td><td>${esc(proposal.category)}</td>
            <td>${badge(proposal.status)}</td><td>${esc(cmName(proposal.assignedCmEmail) || "-")}</td><td>${date(proposal.submittedAt)}</td><td>${managerAssign(proposal)}</td>
          </tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function managerAssign(proposal) {
  if (!["manager", "admin", "superadmin"].includes(state.user.role)) return "";
  const cms = state.staff.filter((user) => user.role === "cm");
  return `<div class="row"><select id="assign-${proposal.id}">${cms.map((cm) => `<option value="${cm.email}" ${proposal.assignedCmEmail === cm.email ? "selected" : ""}>${esc(cm.name)}</option>`).join("")}</select><button class="secondary" onclick="assignProposal('${proposal.id}')">${t("assign")}</button></div>`;
}

function proposalDetail(proposal) {
  const canDirector = state.user.role === "director" || state.user.role === "superadmin";
  const canCm = state.user.role === "cm" || state.user.role === "superadmin";
  return `
    <section class="panel">
      <div class="head">
        <div><h3>${proposal.id} · ${esc(proposal.brandName)}</h3><p>${esc(proposal.category)} · ${esc(cmName(proposal.assignedCmEmail) || "")}</p></div>
        <div class="summary">${tile(proposal.counts.proposed, "proposed")}${tile(proposal.counts.selected, "selected")}${tile(proposal.counts.rejected, "rejected")}${tile(proposal.counts.underReview, "review")}</div>
      </div>
      ${canCm ? `<button class="primary" onclick="sendFinal('${proposal.id}')">${t("sendFinal")}</button>` : ""}
      ${proposal.skus.map((sku) => skuCard(proposal, sku, canCm, canDirector)).join("")}
    </section>
  `;
}

function skuCard(proposal, sku, canCm, canDirector) {
  return `
    <article class="sku ${sku.duplicateEan ? "duplicate" : ""}">
      <div class="head"><div><h3>${esc(sku.productName)}</h3><p>${esc(sku.ean)} · ${esc(sku.volume)} · ${esc(sku.dimensions)}</p></div>${badge(sku.state)}</div>
      ${sku.duplicateEan ? `<div class="notice">${t("duplicate")}</div>` : ""}
      <div class="grid three">
        <div><strong>${t("priceExVat")}</strong><br>${money(sku.priceExVat, sku.currency)}</div>
        <div><strong>${t("priceIncVat")}</strong><br>${money(sku.priceIncVat, sku.currency)}</div>
        <div><strong>${t("rrp")}</strong><br>${money(sku.rrp, sku.currency)}</div>
        <div><strong>${t("casePack")}</strong><br>${esc(sku.casePack)}</div>
        <div><strong>${t("shelfLife")}</strong><br>${esc(sku.shelfLife)}</div>
        <div class="photo">${t("frontPhoto")}: ${esc(sku.frontPhoto)}<br>${t("backPhoto")}: ${esc(sku.backPhoto)}</div>
      </div>
      <p class="small"><strong>${t("competitor")}:</strong> ${sku.competitors.map((item) => `${esc(item.name)} ${money(item.price, item.currency)}`).join(", ") || "-"}</p>
      <div class="actions">
        ${canCm ? `<button class="secondary" onclick="cmDecision('${sku.id}','Selected / Recommended')">${t("select")}</button><button class="danger" onclick="cmDecision('${sku.id}','Rejected by CM')">${t("reject")}</button><button class="ghost" onclick="cmDecision('${sku.id}','Under Review')">${t("keep")}</button>` : ""}
        ${canDirector && sku.state === "Pending Commercial Director" ? `<button class="primary" onclick="finalDecision('${sku.id}','Approved')">${t("approve")}</button><button class="danger" onclick="finalDecision('${sku.id}','Rejected by Commercial Director')">${t("reject")}</button>` : ""}
      </div>
    </article>
  `;
}

function newProposal() {
  return `
    <section class="panel">
      <div class="head"><div><h2>${t("newProposal")}</h2><p>${esc(state.user.supplier?.legalName || "")}</p></div></div>
      <form id="proposalForm" onsubmit="submitProposal(event)">
        <div class="grid">
          ${field("brandName", t("brandName"))}
          <div class="field"><label>${t("category")}</label><select name="category" required>${state.categories.map((item) => `<option>${esc(item)}</option>`).join("")}</select></div>
          ${field("brandLink", t("brandLink"), "url", "", false)}
          <div class="field full"><label>${t("brandDescription")}</label><textarea name="brandDescription"></textarea></div>
        </div>
        <div id="skuList">${skuForm(0)}</div>
        <div class="actions"><button type="button" class="secondary" onclick="addSku()">${t("addSku")}</button><button class="primary">${t("submit")}</button></div>
      </form>
    </section>
  `;
}

function skuForm(index) {
  return `
    <div class="sku" data-sku>
      <div class="head"><h3>SKU ${index + 1}</h3></div>
      <div class="grid three">
        ${field("productName", t("productName"))}${field("ean", t("ean"))}${field("volume", t("volume"))}
        ${field("dimensions", t("dimensions"))}${field("priceExVat", t("priceExVat"), "number")}${field("priceIncVat", t("priceIncVat"), "number")}
        ${field("currency", t("currency"), "text", "UZS")}${field("rrp", t("rrp"), "number")}${field("casePack", t("casePack"))}
        ${field("shelfLife", t("shelfLife"))}${field("frontPhoto", t("frontPhoto"), "url", "https://placehold.co/420x520?text=Front")}${field("backPhoto", t("backPhoto"), "url", "https://placehold.co/420x520?text=Back")}
      </div>
      <div data-competitors>${competitorForm()}</div>
      <button type="button" class="ghost" onclick="addCompetitor(this)">${t("addCompetitor")}</button>
    </div>
  `;
}

function competitorForm() {
  return `<div class="grid three" data-competitor>${field("competitorName", t("competitor"))}${field("competitorPrice", t("competitorPrice"), "number")}${field("competitorUrl", t("productUrl"), "url", "", false)}</div>`;
}

window.addSku = () => {
  document.getElementById("skuList").insertAdjacentHTML("beforeend", skuForm(document.querySelectorAll("[data-sku]").length));
};

window.addCompetitor = (button) => {
  button.previousElementSibling.insertAdjacentHTML("beforeend", competitorForm());
};

window.submitProposal = async (event) => {
  event.preventDefault();
  await run(async () => {
    const rootData = formData(event.target);
    const skus = [...document.querySelectorAll("[data-sku]")].map((skuNode) => {
      const inputs = formData(skuNode);
      return {
        productName: inputs.productName,
        ean: inputs.ean,
        volume: inputs.volume,
        dimensions: inputs.dimensions,
        priceExVat: inputs.priceExVat,
        priceIncVat: inputs.priceIncVat,
        currency: inputs.currency,
        rrp: inputs.rrp,
        casePack: inputs.casePack,
        shelfLife: inputs.shelfLife,
        frontPhoto: inputs.frontPhoto,
        backPhoto: inputs.backPhoto,
        competitors: [...skuNode.querySelectorAll("[data-competitor]")].map((node) => {
          const data = formData(node);
          return { name: data.competitorName, price: data.competitorPrice, currency: inputs.currency, url: data.competitorUrl };
        }),
      };
    });
    await api("/api/proposals", { method: "POST", body: { ...rootData, skus } });
    state.page = "dashboard";
    await loadWorkspace();
  });
};

function profile() {
  const supplier = state.user.supplier;
  return `
    <section class="panel">
      <div class="head"><div><h2>${t("profile")}</h2><p>${esc(state.user.email)}</p></div></div>
      <form class="grid" onsubmit="saveProfile(event)">
        ${field("legalName", t("legalName"), "text", supplier.legalName)}
        ${field("tin", t("tin"), "text", supplier.tin)}
        ${field("phone", t("phone"), "text", supplier.phone)}
        ${field("email", t("email"), "email", supplier.email)}
        <div class="actions full"><button class="primary">${t("save")}</button></div>
      </form>
    </section>
  `;
}

window.saveProfile = async (event) => {
  event.preventDefault();
  await run(async () => {
    const result = await api("/api/profile", { method: "PATCH", body: formData(event.target) });
    state.user = result.user;
  });
};

function assignments() {
  const cms = state.staff.filter((user) => user.role === "cm");
  return `
    <section class="panel">
      <div class="head"><div><h2>${t("assignments")}</h2></div></div>
      <form class="grid" onsubmit="saveAssignments(event)">
        ${state.categories.map((category) => `<div class="field"><label>${esc(category)}</label><select name="${escAttr(category)}">${cms.map((cm) => `<option value="${cm.email}" ${state.categoryManagers[category] === cm.email ? "selected" : ""}>${esc(cm.name)}</option>`).join("")}</select></div>`).join("")}
        <div class="actions full"><button class="primary">${t("save")}</button></div>
      </form>
    </section>
  `;
}

function usersDashboard() {
  return `
    <section class="panel">
      <div class="head"><div><h2>${t("users")}</h2><p>${state.users.length} accounts · ${state.suppliers.length} suppliers</p></div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Login</th><th>Role</th><th>Supplier</th></tr></thead>
          <tbody>${state.users.map((user) => `
            <tr>
              <td>${esc(user.name)}</td>
              <td>${esc(user.email)}</td>
              <td>${badge(user.role)}</td>
              <td>${esc(user.supplier?.legalName || "-")}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

window.saveAssignments = async (event) => {
  event.preventDefault();
  await run(async () => {
    const result = await api("/api/category-managers", { method: "PATCH", body: formData(event.target) });
    state.categoryManagers = result.categoryManagers || {};
  });
};

function products() {
  return `
    <section class="panel">
      <div class="head"><div><h2>${t("products")}</h2><p>${state.products.length} approved</p></div></div>
      ${state.products.length ? `<div class="table-wrap"><table><thead><tr><th>EAN</th><th>${t("productName")}</th><th>${t("brandName")}</th><th>${t("category")}</th><th>${t("rrp")}</th></tr></thead><tbody>${state.products.map((product) => `<tr><td>${esc(product.ean)}</td><td>${esc(product.productName)}</td><td>${esc(product.brandName)}</td><td>${esc(product.category)}</td><td>${money(product.rrp, product.currency)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${t("noRows")}</div>`}
    </section>
  `;
}

function notifications() {
  return `<section class="panel"><div class="head"><div><h2>${t("notifications")}</h2></div></div>${state.notifications.length ? state.notifications.map((item) => `<p><strong>${esc(item.type)}</strong><br>${esc(item.message)}<br><span class="muted small">${esc(item.recipientEmail)} · ${date(item.createdAt)}</span></p>`).join("") : `<div class="empty">${t("noRows")}</div>`}</section>`;
}

window.assignProposal = async (id) => {
  await run(async () => {
    await api(`/api/proposals/${id}/assign`, { method: "PATCH", body: { cmEmail: document.getElementById(`assign-${id}`).value } });
    await loadWorkspace();
  });
};

window.cmDecision = async (skuId, decision) => {
  await run(async () => {
    await api(`/api/skus/${skuId}/cm-decision`, { method: "PATCH", body: { state: decision } });
    await loadWorkspace();
  });
};

window.sendFinal = async (proposalId) => {
  await run(async () => {
    await api(`/api/proposals/${proposalId}/send-final`, { method: "POST" });
    await loadWorkspace();
  });
};

window.finalDecision = async (skuId, decision) => {
  await run(async () => {
    await api(`/api/skus/${skuId}/final-decision`, { method: "PATCH", body: { state: decision } });
    await loadWorkspace();
  });
};

window.filterRows = () => {
  const query = document.getElementById("search").value.toLowerCase();
  const status = document.getElementById("status").value;
  document.querySelectorAll("#proposalTable tbody tr").forEach((row) => {
    row.style.display = row.dataset.search.includes(query) && (!status || row.dataset.status === status) ? "" : "none";
  });
};

async function run(fn) {
  state.error = "";
  try {
    await fn();
  } catch (error) {
    state.error = error.message;
  }
  render();
}

function field(name, label, type = "text", value = "", required = true) {
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${escAttr(value)}" ${required ? "required" : ""}></div>`;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function badge(value) {
  const klass = value === "Approved" ? "ok" : value.includes("Rejected") ? "bad" : value.includes("Pending") || value.includes("Submitted") ? "info" : value.includes("Selected") ? "warn" : "";
  return `<span class="badge ${klass}">${esc(value)}</span>`;
}

function tile(number, label) {
  return `<div class="tile"><strong>${number}</strong><span>${label}</span></div>`;
}

function cmName(email) {
  return state.staff.find((user) => user.email === email)?.name || email;
}

function money(amount, currency) {
  return `${Number(amount || 0).toLocaleString()} ${esc(currency || "")}`;
}

function date(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escAttr(value) {
  return esc(value).replaceAll('"', "&quot;");
}

boot().catch((error) => {
  state.error = error.message;
  render();
});
