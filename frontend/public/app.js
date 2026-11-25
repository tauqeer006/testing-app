// Frontend state
let currentTab = "users";
let countdown = 5;
let refreshTimer = null;
let countdownTimer = null;
let selectedCurrency = "USD";
let activeRatesProvider = "frankfurter";

// DOM Elements
const dbBadge = document.getElementById("db-badge");
const dbBadgeText = document.getElementById("db-badge-text");
const ratesBadge = document.getElementById("rates-badge");
const ratesBadgeText = document.getElementById("rates-badge-text");
const refreshCounter = document.getElementById("refresh-counter");
const errorBanner = document.getElementById("error-banner");
const errorTitle = document.getElementById("error-title");
const errorMessage = document.getElementById("error-message");
const errorCode = document.getElementById("error-code");
const successBanner = document.getElementById("success-banner");
const successMessage = document.getElementById("success-message");
const attributionContainer = document.getElementById("attribution-container");
const selectCurrency = document.getElementById("select-currency");
const currencyWarningNote = document.getElementById("currency-warning-note");

// Update DB Header Badge
function updateDbBadge(servedBy, isError = false) {
  dbBadge.className = "badge";
  if (isError || servedBy === "ERROR") {
    dbBadge.classList.add("badge-error");
    dbBadgeText.textContent = "Reads served by: ERROR";
  } else if (servedBy === "PRIMARY") {
    dbBadge.classList.add("badge-primary");
    dbBadgeText.textContent = "Reads served by: PRIMARY";
  } else if (servedBy === "SECONDARY") {
    dbBadge.classList.add("badge-secondary");
    dbBadgeText.textContent = "Reads served by: SECONDARY";
  } else {
    dbBadge.classList.add("badge-checking");
    dbBadgeText.textContent = `Reads served by: ${servedBy || "UNKNOWN"}`;
  }
}

// Update Rates Provider Header Badge & Attribution
function updateRatesBadge(provider, isStale = false, isError = false) {
  activeRatesProvider = provider || activeRatesProvider;
  ratesBadge.className = "badge";

  if (isError) {
    ratesBadge.classList.add("badge-error");
    ratesBadgeText.textContent = `Rates: ERROR (${activeRatesProvider})`;
  } else if (isStale) {
    ratesBadge.classList.add("badge-secondary");
    ratesBadgeText.textContent = `Rates from: ${activeRatesProvider} (stale)`;
  } else {
    ratesBadge.classList.add("badge-primary");
    ratesBadgeText.textContent = `Rates from: ${activeRatesProvider}`;
  }

  // Required attribution for open_er_api
  if (activeRatesProvider === "open_er_api") {
    attributionContainer.classList.remove("hidden");
  } else {
    attributionContainer.classList.add("hidden");
  }
}

// Show Error Notification
function showError(title, message, code = "ERR-UNKNOWN") {
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  errorCode.textContent = code;
  errorBanner.classList.remove("hidden");
}

function hideError() {
  errorBanner.classList.add("hidden");
}

// Show Success Notification
function showSuccess(message) {
  successMessage.textContent = message;
  successBanner.classList.remove("hidden");
  setTimeout(() => {
    successBanner.classList.add("hidden");
  }, 4000);
}

// Helper: Custom fetch with DB and Provider header inspection
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const servedBy = res.headers.get("X-DB-Served-By");
    const providerUsed = res.headers.get("X-Provider-Used");

    if (servedBy) {
      updateDbBadge(servedBy, false);
    }
    if (providerUsed) {
      updateRatesBadge(providerUsed, false, false);
    }

    if (!res.ok) {
      let errBody;
      try {
        errBody = await res.json();
      } catch (_) {
        errBody = { error: `Server error: ${res.statusText}`, code: `HTTP-${res.status}` };
      }

      if (options.method === undefined || options.method === "GET") {
        if (!url.includes("/api/convert") && !url.includes("/api/rates")) {
          updateDbBadge("ERROR", true);
        } else {
          updateRatesBadge(activeRatesProvider, false, true);
        }
      }

      showError(
        "Request Failed",
        errBody.error || "Failed to complete operation.",
        errBody.code || `HTTP-${res.status}`
      );
      throw errBody;
    }

    hideError();
    return await res.json();
  } catch (err) {
    if (!err.code) {
      if (!url.includes("/api/convert") && !url.includes("/api/rates")) {
        updateDbBadge("ERROR", true);
      }
      showError(
        "Network / Connection Failure",
        err.message || "Failed to connect to backend service.",
        "CONN_ERR"
      );
    }
    throw err;
  }
}

// Tab: Users
async function loadUsers() {
  const tbody = document.getElementById("users-table-body");
  const countLabel = document.getElementById("users-count");

  try {
    const users = await apiFetch("/api/users");
    countLabel.textContent = `${users.length} users`;

    if (!users || users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="loading-cell">No users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users
      .map(
        (u) => `
        <tr>
          <td><strong>#${u.ID || u.id}</strong></td>
          <td>${escapeHtml(u.NAME || u.name)}</td>
          <td>${escapeHtml(u.EMAIL || u.email)}</td>
        </tr>`
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" class="loading-cell" style="color: #f87171;">Error loading users. Database unavailable.</td></tr>`;
    countLabel.textContent = "Error";
  }
}

// Tab: Orders
async function loadOrders() {
  const tbody = document.getElementById("orders-table-body");
  const countLabel = document.getElementById("orders-count");

  try {
    const orders = await apiFetch("/api/orders");
    countLabel.textContent = `${orders.length} orders`;

    if (!orders || orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">No orders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = orders
      .map((o) => {
        const id = o.ID || o.id;
        const status = o.STATUS || o.status;
        const total = Number(o.TOTAL !== undefined ? o.TOTAL : o.total).toFixed(2);
        const userName = o.USER_NAME || o.user_name || "N/A";
        const userEmail = o.USER_EMAIL || o.user_email || "N/A";
        const canClaim = status !== "CLAIMED";

        return `
        <tr>
          <td><strong>#${id}</strong></td>
          <td>${escapeHtml(userName)}</td>
          <td>${escapeHtml(userEmail)}</td>
          <td><span class="status-badge status-${status}">${status}</span></td>
          <td style="text-align: right; font-weight: 600;">$${total}</td>
          <td style="text-align: center;">
            ${
              canClaim
                ? `<button class="btn btn-warning btn-sm" onclick="claimOrderById(${id})">Claim</button>`
                : `<span style="color: #94a3b8; font-size: 0.8rem;">Claimed</span>`
            }
          </td>
        </tr>`;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-cell" style="color: #f87171;">Error loading orders. Database unavailable.</td></tr>`;
    countLabel.textContent = "Error";
  }
}

// Tab: Products
async function loadProducts() {
  const tbody = document.getElementById("products-table-body");
  const thead = document.getElementById("products-table-header");
  const minPriceInput = document.getElementById("filter-min-price").value;

  let url = "/api/products";
  const params = [];
  if (minPriceInput !== "") {
    params.push(`minPrice=${encodeURIComponent(minPriceInput)}`);
  }
  if (selectedCurrency && selectedCurrency !== "USD") {
    params.push(`currency=${encodeURIComponent(selectedCurrency)}`);
  }
  if (params.length > 0) {
    url += `?${params.join("&")}`;
  }

  try {
    const products = await apiFetch(url);

    // Update table header based on whether conversion is active
    if (selectedCurrency && selectedCurrency !== "USD") {
      thead.innerHTML = `
        <th style="width: 80px;">ID</th>
        <th>Product Name</th>
        <th style="text-align: right;">Price (USD)</th>
        <th style="text-align: right;">Converted (${selectedCurrency})</th>
        <th style="text-align: center; width: 140px;">Provider Rate</th>
      `;
    } else {
      thead.innerHTML = `
        <th style="width: 80px;">ID</th>
        <th>Product Name</th>
        <th style="text-align: right;">Price (USD)</th>
      `;
    }

    if (!products || products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading-cell">No products found.</td></tr>`;
      return;
    }

    let hasConversionError = false;
    let errorDetail = "";

    tbody.innerHTML = products
      .map((p) => {
        const id = p.ID || p.id;
        const name = p.NAME || p.name;
        const originalPrice = Number(p.PRICE !== undefined ? p.PRICE : p.price).toFixed(2);

        if (p.conversionError) {
          hasConversionError = true;
          errorDetail = p.conversionError;
        }

        if (p.convertedPrice !== undefined) {
          updateRatesBadge(p.provider, p.stale, false);
          return `
          <tr>
            <td><strong>#${id}</strong></td>
            <td>${escapeHtml(name)}</td>
            <td style="text-align: right; color: #94a3b8;">$${originalPrice}</td>
            <td style="text-align: right; font-weight: 700; color: #34d399;">${Number(p.convertedPrice).toFixed(2)} ${p.currency}</td>
            <td style="text-align: center; font-size: 0.8rem; color: #cbd5e1;">@ ${p.rate}</td>
          </tr>`;
        }

        if (selectedCurrency && selectedCurrency !== "USD") {
          return `
          <tr>
            <td><strong>#${id}</strong></td>
            <td>${escapeHtml(name)}</td>
            <td style="text-align: right;">$${originalPrice}</td>
            <td colspan="2" style="text-align: center;">
              <span class="badge-error-tag">Conversion unavailable</span>
            </td>
          </tr>`;
        }

        return `
        <tr>
          <td><strong>#${id}</strong></td>
          <td>${escapeHtml(name)}</td>
          <td style="text-align: right; font-weight: 600;">$${originalPrice}</td>
        </tr>`;
      })
      .join("");

    if (hasConversionError) {
      currencyWarningNote.textContent = `⚠️ Note: ${errorDetail}`;
      currencyWarningNote.classList.remove("hidden");
    } else {
      currencyWarningNote.classList.add("hidden");
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading-cell" style="color: #f87171;">Error loading products. Database or provider unavailable.</td></tr>`;
  }
}

// Tab: Stats
async function loadStats() {
  try {
    const stats = await apiFetch("/api/stats/summary");

    document.getElementById("stat-users").textContent = stats.userCount;
    document.getElementById("stat-orders").textContent = stats.orderCount;
    document.getElementById("stat-products").textContent = stats.productCount;
    document.getElementById("stat-revenue").textContent = `$${Number(stats.totalRevenue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById("stat-avg-order").textContent = `$${Number(stats.avgOrderValue).toFixed(2)}`;
  } catch (err) {
    document.getElementById("stat-users").textContent = "-";
    document.getElementById("stat-orders").textContent = "-";
    document.getElementById("stat-products").textContent = "-";
    document.getElementById("stat-revenue").textContent = "Error";
    document.getElementById("stat-avg-order").textContent = "-";
  }
}

// Refresh Current Tab
function refreshActiveTab() {
  countdown = 5;
  refreshCounter.textContent = `${countdown}s`;

  if (currentTab === "users") loadUsers();
  else if (currentTab === "orders") loadOrders();
  else if (currentTab === "products") loadProducts();
  else if (currentTab === "stats") loadStats();
}

// Currency Converter Form Handler
document.getElementById("form-converter").addEventListener("submit", async (e) => {
  e.preventDefault();
  const amount = document.getElementById("convert-amount").value;
  const from = document.getElementById("convert-from").value;
  const to = document.getElementById("convert-to").value;
  const resultBox = document.getElementById("converter-result-box");
  const resultMain = document.getElementById("converter-result-main");
  const resultMeta = document.getElementById("converter-result-meta");

  try {
    const res = await apiFetch(`/api/convert?amount=${encodeURIComponent(amount)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    resultMain.textContent = `${Number(amount).toLocaleString()} ${from} = ${Number(res.result).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${to}`;
    resultMeta.textContent = `Exchange rate: 1 ${from} = ${res.rate} ${to} • Provider: ${res.provider} ${res.stale ? "(Cached/Stale)" : "(Live)"}`;
    resultBox.classList.remove("hidden");
    updateRatesBadge(res.provider, res.stale, false);
  } catch (err) {
    resultMain.textContent = "Conversion Failed";
    resultMeta.textContent = err.error || "Unable to convert between selected currencies.";
    resultBox.classList.remove("hidden");
  }
});

// Currency dropdown change on Products tab
selectCurrency.addEventListener("change", (e) => {
  selectedCurrency = e.target.value;
  loadProducts();
});

// Actions
window.claimOrderById = async function (id) {
  try {
    await apiFetch(`/api/orders/${id}/claim`, { method: "POST" });
    showSuccess(`Order #${id} successfully claimed on write pool!`);
    refreshActiveTab();
  } catch (err) {
    // Handled in apiFetch
  }
};

// Form: Add User
document.getElementById("form-add-user").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("user-name").value.trim();
  const email = document.getElementById("user-email").value.trim();

  try {
    const res = await apiFetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    closeModal("modal-add-user");
    document.getElementById("form-add-user").reset();
    showSuccess(`User "${res.name}" created with ID #${res.id} on write pool!`);

    currentTab = "users";
    activateTab("users");
    loadUsers();
  } catch (err) {
    // Handled in apiFetch
  }
});

// Form: Claim Order Modal
document.getElementById("form-claim-order").addEventListener("submit", async (e) => {
  e.preventDefault();
  const orderId = document.getElementById("claim-order-id").value;
  closeModal("modal-claim-order");
  await claimOrderById(orderId);
});

// Form: Audit Log Modal
document.getElementById("form-audit-log").addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = document.getElementById("audit-message").value.trim();

  try {
    const res = await apiFetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    closeModal("modal-audit-log");
    document.getElementById("form-audit-log").reset();
    showSuccess(res.message || "Audit log entry created via stored procedure!");
  } catch (err) {
    // Handled in apiFetch
  }
});

// Trap: Next User ID
document.getElementById("btn-next-user-id").addEventListener("click", async () => {
  try {
    const res = await apiFetch("/api/next-user-id");
    openResultModal("Next User ID (Trap Endpoint)", JSON.stringify(res, null, 2));
    showSuccess(`Next user ID generated: ${res.nextId} (via writePool)`);
  } catch (err) {
    // Handled in apiFetch
  }
});

// Modal Helpers
function openModal(modalId) {
  document.getElementById(modalId).classList.remove("hidden");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add("hidden");
}

function openResultModal(title, jsonText) {
  document.getElementById("result-modal-title").textContent = title;
  document.getElementById("result-modal-content").textContent = jsonText;
  openModal("modal-result");
}

// Modal Click Listeners
document.querySelectorAll(".modal-close").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-modal");
    if (target) closeModal(target);
  });
});

document.getElementById("btn-open-add-user").addEventListener("click", () => openModal("modal-add-user"));
document.getElementById("btn-open-claim-order").addEventListener("click", () => openModal("modal-claim-order"));
document.getElementById("btn-open-audit-log").addEventListener("click", () => openModal("modal-audit-log"));
document.getElementById("btn-close-error").addEventListener("click", hideError);
document.getElementById("btn-close-success").addEventListener("click", () => successBanner.classList.add("hidden"));

// Tabs Switching
function activateTab(tabKey) {
  currentTab = tabKey;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabKey);
  });
  document.querySelectorAll(".tab-pane").forEach((pane) => {
    pane.classList.toggle("active", pane.id === `tab-${tabKey}`);
  });
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabKey = btn.getAttribute("data-tab");
    activateTab(tabKey);
    refreshActiveTab();
  });
});

// Products Filter
document.getElementById("btn-filter-products").addEventListener("click", () => loadProducts());
document.getElementById("btn-reset-products").addEventListener("click", () => {
  document.getElementById("filter-min-price").value = "";
  loadProducts();
});

// Manual Refresh
document.getElementById("btn-manual-refresh").addEventListener("click", () => refreshActiveTab());

// HTML Escaping Utility
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Init & Timers
function startTimers() {
  countdownTimer = setInterval(() => {
    countdown -= 1;
    if (countdown < 0) {
      countdown = 5;
    }
    refreshCounter.textContent = `${countdown}s`;
  }, 1000);

  refreshTimer = setInterval(() => {
    refreshActiveTab();
  }, 5000);
}

// Initial bootstrap
refreshActiveTab();
startTimers();
