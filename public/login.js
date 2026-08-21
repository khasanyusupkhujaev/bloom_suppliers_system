const form = document.getElementById("login-form");
const errorBox = document.getElementById("login-error");
const submitButton = document.getElementById("login-submit");
const passwordInput = document.getElementById("password-input");
const togglePassword = document.getElementById("toggle-password");
const corporateLogin = document.getElementById("corporate-login");
const recoverPassword = document.getElementById("recover-password");

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed: ${response.status}`);
  return payload;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = "";
  errorBox.hidden = true;
}

async function redirectIfAuthenticated() {
  const workspace = await api("/api/workspace");
  if (workspace.user) window.location.replace("./index.html");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  submitButton.disabled = true;
  submitButton.textContent = "Входим...";

  try {
    const data = Object.fromEntries(new FormData(form).entries());
    await api("/api/auth/login", { method: "POST", body: data });
    window.location.replace("./index.html");
  } catch (error) {
    showError(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Войти";
  }
});

togglePassword.addEventListener("click", () => {
  const nextType = passwordInput.type === "password" ? "text" : "password";
  passwordInput.type = nextType;
  togglePassword.setAttribute("aria-pressed", String(nextType === "text"));
  togglePassword.setAttribute("aria-label", nextType === "text" ? "Скрыть пароль" : "Показать пароль");
});

corporateLogin.addEventListener("click", () => {
  showError("Corporate Account authentication is not configured yet.");
});

recoverPassword.addEventListener("click", (event) => {
  event.preventDefault();
  showError("Password recovery is not configured yet. Please contact Bloom support.");
});

redirectIfAuthenticated().catch(() => {});
