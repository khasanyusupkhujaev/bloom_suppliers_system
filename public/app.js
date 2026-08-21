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
  role: "anonymous",
  applications: [],
  approvedProducts: [],
  applicationStatuses: {},
  applicationFieldDefinitions: { supplier: [], manager: [] },
  applicationCounters: {},
  selectedApplicationId: null,
  filters: { search: "", status: "", category: "", brand: "", supplier: "", manager: "" },
  modal: null,
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
  state.role = workspace.role || "anonymous";
  state.categories = workspace.categories || [];
  state.applications = workspace.applications || [];
  state.approvedProducts = workspace.approvedProducts || [];
  state.applicationStatuses = workspace.applicationStatuses || {};
  state.applicationFieldDefinitions = workspace.applicationFieldDefinitions || { supplier: [], manager: [] };
  state.applicationCounters = workspace.applicationCounters || {};
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
    <div class="app-shell">
      <aside class="app-sidebar">
        <a class="app-logo" href="#" onclick="go('dashboard'); return false;">${bloomLogo()}</a>
        ${state.role === "supplier" ? `<button class="sidebar-cta" onclick="createApplication()">+ Добавить товар</button>` : ""}
        <nav class="side-nav">${sidebarItems().map(sideNavItem).join("")}</nav>
        <div class="sidebar-bottom">
          ${sideNavItem({ page: "notifications", label: "Уведомления", count: state.notifications.length })}
          <button class="side-link" onclick="logout()">Выйти</button>
        </div>
      </aside>
      <div class="app-frame">
        <header class="app-topbar">
          <div><p class="topbar-kicker">Bloom Supplier Portal</p><h1>${pageTitle()}</h1></div>
          <button class="profile-chip" onclick="go('profile')">
            <span><strong>${esc(state.user.name)}</strong><small>${roleLabel(state.role)}</small></span>
            <i>${initials(state.user.name)}</i>
          </button>
        </header>
        <main class="main">
        ${state.error ? `<div class="error">${esc(state.error)}</div>` : ""}
        ${page()}
        </main>
      </div>
      ${state.modal ? modal() : ""}
    </div>
  `;
}

function sidebarItems() {
  if (state.role === "supplier") {
    return [
      { page: "dashboard", label: "Главная" },
      { page: "applications", label: "Все заявки", count: state.applications.length },
      { page: "drafts", label: "Черновики", count: state.applicationCounters.drafts },
      { page: "review", label: "На рассмотрении", count: state.applicationCounters.managerQueue + state.applicationCounters.ccoQueue },
      { page: "returned", label: "Возвращённые", count: state.applicationCounters.returnedSupplier },
      { page: "approved", label: "Одобренные товары", count: state.approvedProducts.length },
      { page: "documents", label: "Документы" },
    ];
  }
  if (state.role === "cco") {
    return [
      { page: "dashboard", label: "Главная" },
      { page: "ccoQueue", label: "На согласование", count: state.applicationCounters.ccoQueue, prominent: true },
      { page: "returnedManager", label: "Возвращённые", count: state.applicationCounters.returnedManager },
      { page: "approved", label: "Одобренные", count: state.applicationCounters.approved },
      { page: "declined", label: "Отклонённые", count: state.applicationCounters.declined },
      { page: "applications", label: "Все заявки", count: state.applications.length },
    ];
  }
  return [
    { page: "dashboard", label: "Главная" },
    { page: "managerQueue", label: "Поступившие", count: countBy(["SUBMITTED_TO_MANAGER"]) },
    { page: "managerTasks", label: "Мои задачи", count: countBy(["MANAGER_REVIEW", "RETURNED_TO_MANAGER"]) },
    { page: "returned", label: "Возвращённые", count: countBy(["RETURNED_TO_SUPPLIER"]) },
    { page: "sentCco", label: "Отправленные CCO", count: countBy(["SUBMITTED_TO_CCO", "CCO_REVIEW"]) },
    { page: "applications", label: "Архив", count: state.applications.length },
    { page: "suppliers", label: "Поставщики", count: state.suppliers.length },
    { page: "approved", label: "Товары", count: state.approvedProducts.length },
    { page: "documents", label: "Документы" },
  ];
}

function sideNavItem(item) {
  const active = state.page === item.page || (state.page === "detail" && item.page === "applications");
  return `<button class="side-link ${active ? "active" : ""} ${item.prominent && item.count ? "prominent" : ""}" onclick="go('${item.page}')"><span>${item.label}</span>${item.count ? `<b>${item.count}</b>` : ""}</button>`;
}

window.go = async (page) => {
  state.page = page;
  state.selectedApplicationId = page === "new" ? null : state.selectedApplicationId;
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
  if (state.page === "new") return applicationDetail(null);
  if (state.page === "detail") return applicationDetail(selectedApplication());
  if (state.page === "profile") return profile();
  if (state.page === "approved") return approvedProductsPage();
  if (state.page === "notifications") return notifications();
  if (state.page === "suppliers") return suppliersPage();
  if (state.page === "documents") return simplePage("Документы", "Раздел документов подготовлен для будущих требований и шаблонов.");
  if (["applications", "drafts", "review", "returned", "managerQueue", "managerTasks", "returnedManager", "sentCco", "ccoQueue", "declined"].includes(state.page)) return applicationList();
  return dashboard();
}

function dashboard() {
  if (state.role === "supplier") return supplierDashboard();
  if (state.role === "cco") return ccoDashboard();
  return managerDashboard();
}

function supplierDashboard() {
  return `
    <section class="dash-hero">
      <div><p>Поставщик</p><h2>Управляйте новыми товарами для Bloom</h2><span>Создавайте заявки, отслеживайте статусы и получайте Bloom ID после финального одобрения.</span></div>
      <button class="primary" onclick="createApplication()">+ Добавить новый товар</button>
    </section>
    <div class="metric-grid">
      ${metric("Черновики", state.applicationCounters.drafts)}
      ${metric("На рассмотрении", state.applicationCounters.managerQueue + state.applicationCounters.ccoQueue)}
      ${metric("Требуют исправления", state.applicationCounters.returnedSupplier)}
      ${metric("Одобренные товары", state.approvedProducts.length)}
    </div>
    ${applicationList(filteredApplicationsForPage("recent"), "Последние заявки")}
  `;
}

function managerDashboard() {
  return `
    <div class="metric-grid">
      ${metric("Новые заявки", countBy(["SUBMITTED_TO_MANAGER"]))}
      ${metric("Мои задачи", countBy(["MANAGER_REVIEW", "RETURNED_TO_MANAGER"]))}
      ${metric("Возвращённые", countBy(["RETURNED_TO_SUPPLIER"]))}
      ${metric("Ожидают решения CCO", countBy(["SUBMITTED_TO_CCO", "CCO_REVIEW"]))}
    </div>
    ${applicationList(filteredApplicationsForPage("managerQueue"), "Поступившие заявки")}
  `;
}

function ccoDashboard() {
  return `
    <section class="dash-hero cco-focus">
      <div><p>CCO Review</p><h2>${state.applicationCounters.ccoQueue || 0} заявок ожидают решения</h2><span>Финальное одобрение создает постоянный Bloom ID для товара.</span></div>
      <button class="primary" onclick="go('ccoQueue')">Открыть очередь</button>
    </section>
    <div class="metric-grid">
      ${metric("Ожидают моего решения", state.applicationCounters.ccoQueue)}
      ${metric("Одобрено", state.applicationCounters.approved)}
      ${metric("Возвращено", state.applicationCounters.returnedManager + state.applicationCounters.returnedSupplier)}
      ${metric("Отклонено", state.applicationCounters.declined)}
    </div>
    ${applicationList(filteredApplicationsForPage("ccoQueue"), "На согласование")}
  `;
}

function applicationList(applications = filteredApplicationsForPage(state.page), title = "Заявки") {
  return `
    <section class="work-panel">
      <div class="list-head"><div><h2>${title}</h2><p>${applications.length} записей</p></div>${state.role === "supplier" ? `<button class="primary" onclick="createApplication()">+ Добавить товар</button>` : ""}</div>
      ${filters()}
      ${applications.length ? applicationTable(applications) : `<div class="empty">Нет заявок.</div>`}
    </section>
  `;
}

function filters() {
  return `
    <div class="app-filters">
      <input placeholder="Поиск по номеру, товару, бренду" value="${escAttr(state.filters.search)}" oninput="setFilter('search', this.value)" />
      <select onchange="setFilter('status', this.value)"><option value="">Все статусы</option>${Object.entries(state.applicationStatuses).map(([key, label]) => `<option value="${key}" ${state.filters.status === key ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>
      <select onchange="setFilter('category', this.value)"><option value="">Все категории</option>${state.categories.map((item) => `<option value="${escAttr(item)}" ${state.filters.category === item ? "selected" : ""}>${esc(item)}</option>`).join("")}</select>
      <input placeholder="Бренд" value="${escAttr(state.filters.brand)}" oninput="setFilter('brand', this.value)" />
      ${state.role !== "supplier" ? `<input placeholder="Поставщик" value="${escAttr(state.filters.supplier)}" oninput="setFilter('supplier', this.value)" />` : ""}
    </div>
  `;
}

function applicationTable(applications) {
  return `
    <div class="table-wrap app-table-wrap">
      <table class="app-table">
        <thead><tr><th>№ заявки</th><th>Статус</th><th>Товар</th><th>Категория</th><th>Бренд</th><th>Поставщик</th><th>Менеджер</th><th>Создана</th><th>Изменена</th><th>Действие</th></tr></thead>
        <tbody>${applications.map((item) => `
          <tr>
            <td><button class="link-button" onclick="openApplication('${item.id}')">${item.id}</button>${item.bloomId ? `<small>Bloom ID ${item.bloomId}</small>` : ""}</td>
            <td>${statusBadge(item.status)}</td>
            <td><strong>${esc(item.supplierData.productName || "Новый товар")}</strong></td>
            <td>${esc(item.supplierData.category || "-")}</td>
            <td>${esc(item.supplierData.brandName || "-")}</td>
            <td>${esc(item.supplier?.legalName || "-")}</td>
            <td>${esc(managerName(item.assignedManagerEmail))}</td>
            <td>${shortDate(item.createdAt)}</td>
            <td>${shortDate(item.updatedAt)}</td>
            <td><button class="secondary" onclick="openApplication('${item.id}')">Открыть</button></td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>`;
}

function applicationDetail(application) {
  const isNew = !application;
  const draft = application || {
    id: "",
    status: "DRAFT",
    statusLabel: "Черновик",
    supplierData: {},
    managerData: {},
    history: [],
    supplier: state.user.supplier,
  };
  return `
    <div class="detail-layout">
      <section class="application-form-shell">
        <button class="back-link" onclick="go('applications')">← Назад</button>
        <div class="detail-title"><h2>${isNew ? "Новый товар" : `Заявка ${draft.id}`}</h2><p>${esc(draft.supplier?.legalName || state.user.supplier?.legalName || "Bloom Beauty")}</p></div>
        ${lastComment(draft) ? `<div class="return-note"><strong>Комментарий</strong><p>${esc(lastComment(draft))}</p></div>` : ""}
        <form id="applicationForm" class="application-form">
          ${renderFieldSections("supplier", draft)}
          ${state.role !== "supplier" ? renderFieldSections("manager", draft) : ""}
        </form>
      </section>
      ${actionPanel(draft, isNew)}
    </div>
  `;
}

function renderFieldSections(scope, application) {
  const defs = state.applicationFieldDefinitions[scope] || [];
  const data = scope === "supplier" ? application.supplierData : application.managerData;
  const editable = canEditScope(scope, application.status);
  const sections = [...new Set(defs.map((field) => field.section))];
  return `
    <div class="form-block ${scope === "manager" ? "internal" : ""}">
      <h3>${scope === "supplier" ? "Данные поставщика" : "Данные Bloom / Заполняется менеджером"}</h3>
      ${sections.map((sectionName) => `
        <details class="form-section" open>
          <summary>${esc(sectionName)}</summary>
          <div class="field-grid">${defs.filter((field) => field.section === sectionName).map((field) => appField(scope, field, data[field.key], editable)).join("")}</div>
        </details>
      `).join("")}
    </div>`;
}

function appField(scope, field, value, editable) {
  const name = `${scope}.${field.key}`;
  const required = field.required ? "required" : "";
  const disabled = editable ? "" : "disabled";
  const label = `${esc(field.label)}${field.required ? " *" : ""}`;
  if (field.type === "textarea") return `<label class="app-field wide"><span>${label}</span><textarea name="${name}" ${required} ${disabled}>${esc(value || "")}</textarea></label>`;
  if (field.type === "select") return `<label class="app-field"><span>${label}</span><select name="${name}" ${required} ${disabled}>${(field.options || []).map((option) => `<option value="${escAttr(option)}" ${String(value || "") === String(option) ? "selected" : ""}>${esc(option)}</option>`).join("")}</select></label>`;
  return `<label class="app-field"><span>${label}</span><input name="${name}" type="${field.type || "text"}" value="${escAttr(value || "")}" ${required} ${disabled}></label>`;
}

function actionPanel(application, isNew) {
  return `
    <aside class="action-panel">
      <span class="panel-label">Статус заявки</span>
      ${statusBadge(application.status)}
      <div class="panel-id">${isNew ? "Новая заявка" : application.id}</div>
      ${application.bloomId ? `<div class="bloom-id"><span>Bloom ID</span><strong>${application.bloomId}</strong></div>` : ""}
      <button class="secondary full-button" onclick="showHistory('${application.id || ""}')">История согласований</button>
      <div class="panel-actions">${contextActions(application, isNew)}</div>
    </aside>
  `;
}

function contextActions(application, isNew) {
  if (state.role === "supplier" && (isNew || ["DRAFT", "RETURNED_TO_SUPPLIER"].includes(application.status))) {
    return `<button class="secondary full-button" onclick="saveApplication(${isNew})">Сохранить черновик</button><button class="primary full-button" onclick="submitManager(${isNew})">${application.status === "RETURNED_TO_SUPPLIER" ? "Повторно отправить" : "Отправить менеджеру"}</button>`;
  }
  if (state.role === "manager" && ["SUBMITTED_TO_MANAGER", "MANAGER_REVIEW", "RETURNED_TO_MANAGER"].includes(application.status)) {
    return `${application.status !== "MANAGER_REVIEW" ? `<button class="secondary full-button" onclick="startManager('${application.id}')">Начать проверку</button>` : ""}<button class="secondary full-button" onclick="saveApplication(false)">Сохранить черновик</button><button class="secondary full-button" onclick="openCommentModal('returnSupplier','${application.id}')">Вернуть поставщику</button><button class="primary full-button" onclick="submitCco('${application.id}')">Отправить CCO</button>`;
  }
  if (state.role === "cco" && ["SUBMITTED_TO_CCO", "CCO_REVIEW"].includes(application.status)) {
    return `<button class="secondary full-button" onclick="openCommentModal('returnManager','${application.id}')">Вернуть на доработку</button><button class="danger full-button" onclick="openCommentModal('decline','${application.id}')">Отклонить</button><button class="primary full-button" onclick="openCommentModal('approve','${application.id}')">Одобрить товар</button>`;
  }
  return `<p class="panel-muted">Нет доступных действий для текущего статуса.</p>`;
}

function approvedProductsPage() {
  return `
    <section class="work-panel">
      <div class="list-head"><div><h2>Одобренные товары</h2><p>${state.approvedProducts.length} товаров с Bloom ID</p></div></div>
      ${state.approvedProducts.length ? `<div class="table-wrap"><table class="app-table"><thead><tr><th>Bloom ID</th><th>Товар</th><th>Бренд</th><th>Категория</th><th>Поставщик</th><th>Одобрен</th></tr></thead><tbody>${state.approvedProducts.map((product) => `<tr><td><strong>${esc(product.bloomId)}</strong></td><td>${esc(product.productName)}</td><td>${esc(product.brandName)}</td><td>${esc(product.category)}</td><td>${esc(supplierName(product.supplierId))}</td><td>${shortDate(product.approvedAt)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Пока нет одобренных товаров.</div>`}
    </section>
  `;
}

function profile() {
  const supplier = state.user.supplier;
  if (state.role !== "supplier") return simplePage("Профиль", `${esc(state.user.name)} · ${roleLabel(state.role)}`);
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

function suppliersPage() {
  return `
    <section class="work-panel"><div class="list-head"><div><h2>Поставщики</h2><p>${state.suppliers.length} компаний</p></div></div>
    <div class="table-wrap"><table class="app-table"><thead><tr><th>Компания</th><th>ИНН</th><th>Email</th><th>Телефон</th></tr></thead><tbody>${state.suppliers.map((supplier) => `<tr><td>${esc(supplier.legalName)}</td><td>${esc(supplier.tin)}</td><td>${esc(supplier.email)}</td><td>${esc(supplier.phone)}</td></tr>`).join("")}</tbody></table></div></section>
  `;
}

function notifications() {
  return `<section class="work-panel"><div class="list-head"><div><h2>Уведомления</h2></div></div>${state.notifications.length ? `<div class="activity-list">${state.notifications.map((item) => `<div class="activity-item"><strong>${esc(item.message)}</strong><span>${esc(item.recipientEmail)} · ${date(item.createdAt)}</span></div>`).join("")}</div>` : `<div class="empty">Нет уведомлений.</div>`}</section>`;
}

function pageTitle() {
  const titles = { dashboard: "Главная", applications: "Заявки", new: "Новый товар", detail: "Заявка", approved: "Одобренные товары", notifications: "Уведомления", profile: "Профиль" };
  return titles[state.page] || "Заявки";
}

function roleLabel(role) {
  return { supplier: "Supplier", manager: "Manager", cco: "CCO", admin: "Admin" }[role] || role;
}

function initials(name) {
  return String(name || "B").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function metric(label, value) {
  return `<article class="metric"><span>${label}</span><strong>${Number(value || 0)}</strong></article>`;
}

function countBy(statuses) {
  return state.applications.filter((item) => statuses.includes(item.status)).length;
}

function filteredApplicationsForPage(page) {
  const pageStatuses = {
    drafts: ["DRAFT"],
    review: ["SUBMITTED_TO_MANAGER", "MANAGER_REVIEW", "SUBMITTED_TO_CCO", "CCO_REVIEW"],
    returned: state.role === "supplier" ? ["RETURNED_TO_SUPPLIER"] : ["RETURNED_TO_SUPPLIER"],
    managerQueue: ["SUBMITTED_TO_MANAGER"],
    managerTasks: ["MANAGER_REVIEW", "RETURNED_TO_MANAGER"],
    returnedManager: ["RETURNED_TO_MANAGER"],
    sentCco: ["SUBMITTED_TO_CCO", "CCO_REVIEW"],
    ccoQueue: ["SUBMITTED_TO_CCO", "CCO_REVIEW"],
    declined: ["DECLINED"],
    recent: [],
  };
  const statuses = pageStatuses[page] || [];
  return state.applications
    .filter((item) => !statuses.length || statuses.includes(item.status))
    .filter((item) => !state.filters.status || item.status === state.filters.status)
    .filter((item) => !state.filters.category || item.supplierData.category === state.filters.category)
    .filter((item) => !state.filters.brand || item.supplierData.brandName.toLowerCase().includes(state.filters.brand.toLowerCase()))
    .filter((item) => !state.filters.supplier || (item.supplier?.legalName || "").toLowerCase().includes(state.filters.supplier.toLowerCase()))
    .filter((item) => {
      const q = state.filters.search.toLowerCase();
      const haystack = [item.id, item.bloomId, item.supplierData.productName, item.supplierData.brandName, item.supplier?.legalName].join(" ").toLowerCase();
      return !q || haystack.includes(q);
    })
    .slice(0, page === "recent" ? 8 : undefined);
}

function selectedApplication() {
  return state.applications.find((item) => item.id === state.selectedApplicationId) || state.applications[0];
}

function canEditScope(scope, status) {
  if (scope === "supplier") return state.role === "supplier" && ["DRAFT", "RETURNED_TO_SUPPLIER"].includes(status);
  if (scope === "manager") return state.role === "manager" && ["SUBMITTED_TO_MANAGER", "MANAGER_REVIEW", "RETURNED_TO_MANAGER"].includes(status);
  return false;
}

function formPayload() {
  const data = Object.fromEntries(new FormData(document.getElementById("applicationForm")).entries());
  const supplierData = {};
  const managerData = {};
  for (const [key, value] of Object.entries(data)) {
    const [scope, field] = key.split(".");
    if (scope === "supplier") supplierData[field] = value;
    if (scope === "manager") managerData[field] = value;
  }
  return {
    ...(Object.keys(supplierData).length ? { supplierData } : {}),
    ...(Object.keys(managerData).length ? { managerData } : {}),
  };
}

window.setFilter = (key, value) => {
  state.filters[key] = value;
  render();
};

window.createApplication = async () => {
  state.page = "new";
  state.selectedApplicationId = null;
  render();
};

window.openApplication = (id) => {
  state.selectedApplicationId = id;
  state.page = "detail";
  render();
};

window.saveApplication = async (isNew) => {
  await run(async () => {
    const payload = formPayload();
    if (isNew) {
      const result = await api("/api/applications", { method: "POST", body: payload });
      state.selectedApplicationId = result.application.id;
    } else {
      await api(`/api/applications/${selectedApplication().id}`, { method: "PATCH", body: payload });
    }
    await loadWorkspace();
    state.page = "detail";
  });
};

window.submitManager = async (isNew) => {
  await run(async () => {
    let id = selectedApplication()?.id;
    const payload = formPayload();
    if (isNew) {
      const result = await api("/api/applications", { method: "POST", body: payload });
      id = result.application.id;
      state.selectedApplicationId = id;
    } else {
      await api(`/api/applications/${id}`, { method: "PATCH", body: payload });
    }
    await api(`/api/applications/${id}/submit-manager`, { method: "POST", body: {} });
    await loadWorkspace();
    state.page = "applications";
  });
};

window.startManager = async (id) => {
  await run(async () => {
    await api(`/api/applications/${id}/start-manager`, { method: "POST" });
    await loadWorkspace();
  });
};

window.submitCco = async (id) => {
  await run(async () => {
    await api(`/api/applications/${id}/submit-cco`, { method: "POST", body: formPayload() });
    await loadWorkspace();
    state.page = "sentCco";
  });
};

window.openCommentModal = (type, id) => {
  state.modal = { type, id, comment: "", target: "manager" };
  render();
};

window.closeModal = () => {
  state.modal = null;
  render();
};

window.submitModal = async (event) => {
  event.preventDefault();
  const data = formData(event.target);
  const { type, id } = state.modal;
  await run(async () => {
    if (type === "returnSupplier") await api(`/api/applications/${id}/return-supplier`, { method: "POST", body: { comment: data.comment } });
    if (type === "returnManager") await api(`/api/applications/${id}/return-manager`, { method: "POST", body: { comment: data.comment, target: data.target } });
    if (type === "decline") await api(`/api/applications/${id}/decline`, { method: "POST", body: { comment: data.comment } });
    if (type === "approve") await api(`/api/applications/${id}/approve`, { method: "POST", body: { comment: data.comment } });
    state.modal = null;
    await loadWorkspace();
  });
};

window.showHistory = (id) => {
  const application = id ? state.applications.find((item) => item.id === id) : null;
  state.modal = { type: "history", id, application };
  render();
};

function modal() {
  if (state.modal.type === "history") {
    const application = state.modal.application || selectedApplication();
    return `<div class="app-modal"><div class="modal-card wide"><button class="modal-close" onclick="closeModal()">×</button><h2>История согласований</h2><div class="history-list">${(application?.history || []).map(historyItem).join("") || `<div class="empty">История пока пуста.</div>`}</div></div></div>`;
  }
  const title = { returnSupplier: "Причина возврата", returnManager: "Комментарий CCO", decline: "Причина отклонения", approve: "Одобрить товар" }[state.modal.type];
  const actionLabel = { returnSupplier: "Вернуть на доработку", returnManager: "Вернуть на доработку", decline: "Отклонить", approve: "Одобрить товар" }[state.modal.type];
  return `
    <div class="app-modal">
      <form class="modal-card" onsubmit="submitModal(event)">
        <button type="button" class="modal-close" onclick="closeModal()">×</button>
        <h2>${title}</h2>
        ${state.modal.type === "approve" ? `<p>Вы уверены, что хотите одобрить этот товар?</p>` : ""}
        ${state.modal.type === "returnManager" ? `<label class="app-field"><span>Кому вернуть</span><select name="target"><option value="manager">Менеджеру</option><option value="supplier">Поставщику</option></select></label>` : ""}
        <label class="app-field wide"><span>Комментарий${state.modal.type === "approve" ? "" : " *"}</span><textarea name="comment" ${state.modal.type === "approve" ? "" : "required"}></textarea></label>
        <button class="${state.modal.type === "decline" ? "danger" : "primary"} full-button">${actionLabel}</button>
      </form>
    </div>`;
}

function historyItem(item) {
  return `<article class="history-item"><strong>${date(item.at)}</strong><span>${esc(item.action)}</span><small>${esc(item.actor)} · ${item.fromStatus ? statusText(item.fromStatus) : "—"} → ${statusText(item.toStatus)}</small>${item.comment ? `<p>${esc(item.comment)}</p>` : ""}</article>`;
}

function statusText(status) {
  return state.applicationStatuses[status] || status || "—";
}

function statusBadge(status) {
  const tone = status === "APPROVED" ? "ok" : status === "DECLINED" ? "bad" : status.includes("RETURNED") ? "warn" : status.includes("CCO") ? "info" : status === "DRAFT" ? "" : "review";
  return `<span class="status-badge ${tone}"><i></i>${esc(statusText(status))}</span>`;
}

function lastComment(application) {
  return application.history?.find((item) => item.comment)?.comment || "";
}

function managerName(email) {
  return state.staff.find((user) => user.email === email)?.name || email || "-";
}

function supplierName(id) {
  return state.suppliers.find((supplier) => supplier.id === id)?.legalName || state.user.supplier?.legalName || "-";
}

function shortDate(value) {
  return value ? new Date(value).toLocaleDateString("ru-RU") : "-";
}

function simplePage(title, text) {
  return `<section class="work-panel"><h2>${title}</h2><p class="muted">${text}</p></section>`;
}

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
