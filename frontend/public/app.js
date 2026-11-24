// Frontend state
let currentTab = "users";
let countdown = 5;
let refreshTimer = null;
let countdownTimer = null;

// DOM Elements
const badge = document.getElementById("db-badge");
const badgeText = document.getElementById("db-badge-text");
const refreshCounter = document.getElementById("refresh-counter");
const errorBanner = document.getElementById("error-banner");
const errorTitle = document.getElementById("error-title");
const errorMessage = document.getElementById("error-message");
const errorCode = document.getElementById("error-code");
const successBanner = document.getElementById("success-banner");
const successMessage = document.getElementById("success-message");

// Update DB Header Badge
function updateBadge(servedBy, isError = false) {
  badge.className = "badge";
  if (isError || servedBy === "ERROR") {
    badge.classList.add("badge-error");
    badgeText.textContent = "Reads served by: ERROR";
  } else if (servedBy === "PRIMARY") {
    badge.classList.add("badge-primary");
    badgeText.textContent = "Reads served by: PRIMARY";
  } else if (servedBy === "SECONDARY") {
    badge.classList.add("badge-secondary");
    badgeText.textContent = "Reads served by: SECONDARY";
  } else {
    badge.classList.add("badge-checking");
    badgeText.textContent = `Reads served by: ${servedBy || "UNKNOWN"}`;
  }
}

// Show Error Notification
function showError(title, message, code = "ORA-UNKNOWN") {
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

// Helper: Custom fetch with DB header inspection
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const servedBy = res.headers.get("X-DB-Served-By");

    if (servedBy) {
      updateBadge(servedBy, false);
    }

    if (!res.ok) {
      let errBody;
      try {
        errBody = await res.json();
      } catch (_) {
        errBody = { error: `Server error: ${res.statusText}`, code: `HTTP-${res.status}` };
      }

      if (options.method === undefined || options.method === "GET") {
        updateBadge("ERROR", true);
      }

      showError(
        "Database Request Failed",
        errBody.error || "Failed to complete database operation.",
        errBody.code || `ORA-${res.status}`
      );
      throw errBody;
    }

    // Hide error banner on successful request
    hideError();
    return await res.json();
  } catch (err) {
    if (!err.code) {
      updateBadge("ERROR", true);
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
  const minPriceInput = document.getElementById("filter-min-price").value;

  let url = "/api/products";
  if (minPriceInput !== "") {
    url += `?minPrice=${encodeURIComponent(minPriceInput)}`;
  }

  try {
    const products = await apiFetch(url);

    if (!products || products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="loading-cell">No products found matching filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = products
      .map((p) => {
        const id = p.ID || p.id;
        const name = p.NAME || p.name;
        const price = Number(p.PRICE !== undefined ? p.PRICE : p.price).toFixed(2);

        return `
        <tr>
          <td><strong>#${id}</strong></td>
          <td>${escapeHtml(name)}</td>
          <td style="text-align: right; font-weight: 600;">$${price}</td>
        </tr>`;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" class="loading-cell" style="color: #f87171;">Error loading products. Database unavailable.</td></tr>`;
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

// Actions
window.claimOrderById = async function (id) {
  try {
    const res = await apiFetch(`/api/orders/${id}/claim`, {
      method: "POST",
    });
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
