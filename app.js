let state = {};
let activeView = "dashboard";
let authToken = localStorage.getItem("brothers_auth_token") || "";
let currentUser = null;
let projectSearch = "";
let customerSearch = "";
let thirdPartySearch = "";
let selectedProjectId = null;
let projectViewMode = "individual";
let projectStatusFilter = "active";
let paymentFromDate = "";
let paymentToDate = "";
let dashboardSelectedProjectId = null;
let dashboardProjectFilter = "active";
let ledgerZoom = 100;
let dashboardProjectSearch = "";
let currentPdfPreviewUrl = "";
let currentPdfPreviewFilename = "";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const paymentModes = ["UPI", "PhonePe", "GPay", "Cheque", "Cash", "Bank Transfer", "NEFT", "RTGS", "IMPS", "Card", "Other"];
const projectStatuses = ["Not Started", "Lead", "Finalised", "Started", "In Progress", "On Hold", "Completed", "Closed", "Cancelled"];
const vendorCategories = ["Fabrication", "Trading Supplier", "Installation", "Transport", "Electrician", "Civil Work", "Gas Pipeline", "Ducting", "Other"];
const agreementTypes = ["Customer Agreement", "Third-Party Agreement", "Purchase Order", "Work Order", "AMC", "Warranty"];
const documentTypes = ["Agreement", "Drawing", "Quotation", "Purchase Order", "Work Order", "Invoice", "Site Photo", "Other"];
const projectCategories = ["Commercial Kitchen", "Civil Construction", "Kitchen + Civil", "Fabrication", "Trading", "Installation", "AMC", "Other"];
const chargeTypes = ["Material + Labour", "Material Only", "Labour Only", "Turnkey", "Service Charge", "Other"];
const communicationModes = ["Call", "WhatsApp", "Email", "Meeting", "Site Visit", "SMS", "Other"];
const indianStates = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];
const indianCities = ["Agra", "Ahmedabad", "Ajmer", "Aligarh", "Amritsar", "Asansol", "Aurangabad", "Bareilly", "Bengaluru", "Bhopal", "Bhubaneswar", "Bikaner", "Chandigarh", "Chennai", "Coimbatore", "Cuttack", "Dehradun", "Delhi", "Dhanbad", "Durgapur", "Faridabad", "Ghaziabad", "Gorakhpur", "Greater Noida", "Gurugram", "Guwahati", "Gwalior", "Howrah", "Hyderabad", "Indore", "Jabalpur", "Jaipur", "Jalandhar", "Jammu", "Jamnagar", "Jamshedpur", "Jodhpur", "Kanpur", "Kochi", "Kolhapur", "Kolkata", "Kota", "Lucknow", "Ludhiana", "Madurai", "Mangalore", "Meerut", "Mumbai", "Mysuru", "Nagpur", "Nashik", "Navi Mumbai", "Noida", "Patna", "Prayagraj", "Pune", "Raipur", "Rajkot", "Ranchi", "Siliguri", "Solapur", "Surat", "Thane", "Thiruvananthapuram", "Udaipur", "Vadodara", "Varanasi", "Vijayawada", "Visakhapatnam"];
const defaultLogo = "https://static.wixstatic.com/media/fcde73_8d267f9ddc364c32bc41b48037e7555b~mv2.png";

async function api(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(path, {
    headers,
    ...options,
  });
  const payload = await response.json();
  if (response.status === 401) {
    showLogin();
  }
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

async function load() {
  state = await api("/api/bootstrap");
  showApp();
  render();
}

async function boot() {
  if (!authToken) {
    showLogin();
    return;
  }
  try {
    const session = await api("/api/session");
    if (!session.authenticated) {
      showLogin();
      return;
    }
    currentUser = session.user;
    await load();
  } catch (error) {
    showLogin();
  }
}

function showLogin(message = "") {
  authToken = "";
  currentUser = null;
  localStorage.removeItem("brothers_auth_token");
  document.body.classList.add("auth-required");
  document.body.classList.remove("auth-ready", "auth-loading");
  document.getElementById("login-error").textContent = message;
}

function showApp() {
  document.body.classList.remove("auth-required", "auth-loading");
  document.body.classList.add("auth-ready");
}

async function signIn(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.getElementById("login-error");
  error.textContent = "";
  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    authToken = result.token;
    currentUser = result.user;
    localStorage.setItem("brothers_auth_token", authToken);
    await load();
  } catch (err) {
    error.textContent = err.message;
  }
}

async function signOut() {
  if (authToken) {
    try {
      await api("/api/logout", { method: "POST", body: "{}" });
    } catch (error) {
      // Sign out locally even if the server session has already expired.
    }
  }
  showLogin("Signed out successfully.");
}

function rupees(value) {
  return money.format(Number(value || 0));
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function displayDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function displayValue(value) {
  return esc(displayDate(value));
}

function title(value) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function render() {
  document.querySelectorAll(".nav").forEach((button) => button.classList.toggle("active", button.dataset.view === activeView));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${activeView}`));
  document.getElementById("page-title").textContent = "Project Management App";
  document.getElementById("business-line").textContent = `Team Brother | ${state.business.phone} | GST ${state.business.gst}`;
  setLogo("app-logo");
  setLogo("login-logo");
  renderDashboard();
  renderProjects();
  renderCustomers();
  renderThirdParties();
  renderReceipts();
  renderVendorAccounts();
  renderCommunications();
  renderDocuments();
  renderWip();
  renderReports();
  renderSettings();
}

function companyLogo() {
  const logo = state.business?.logo || defaultLogo;
  return logo.startsWith("data/") ? `/${logo}` : logo;
}

function setLogo(id) {
  const logo = document.getElementById(id);
  if (logo) logo.src = companyLogo();
}

function table(headers, rows, emptyText = "No records yet") {
  if (!rows.length) return `<div class="table-wrap"><div class="empty">${emptyText}</div></div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr class="${rowClass(row)}">
              ${headers.map((header) => `<td class="${header.money ? "money" : ""}">${header.render ? header.render(row) : displayValue(row[header.key])}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function rowClass(row) {
  if (isClosedStatus(row.status)) return "row-closed";
  if (String(row.status || "") === "Completed") return "row-completed";
  return "";
}

function dateInRange(value, fromDate = paymentFromDate, toDate = paymentToDate) {
  if (!value) return false;
  if (fromDate && value < fromDate) return false;
  if (toDate && value > toDate) return false;
  return true;
}

function filterByDate(items, key, fromDate = paymentFromDate, toDate = paymentToDate) {
  return items.filter((item) => dateInRange(item[key], fromDate, toDate));
}

function dateRangeText(fromDate = paymentFromDate, toDate = paymentToDate) {
  if (fromDate && toDate) return `${displayDate(fromDate)} to ${displayDate(toDate)}`;
  if (fromDate) return `From ${displayDate(fromDate)}`;
  if (toDate) return `Up to ${displayDate(toDate)}`;
  return "All dates";
}

function isClosedStatus(status) {
  return ["Closed", "Completed", "Cancelled"].includes(status);
}

function isNotStartedStatus(status) {
  return ["Not Started", "Lead", "Finalised"].includes(status);
}

function isStartedStatus(status) {
  return ["Started", "In Progress", "On Hold"].includes(status);
}

function statusMatches(status) {
  if (projectStatusFilter === "all") return true;
  if (projectStatusFilter === "closed") return isClosedStatus(status);
  if (projectStatusFilter === "not-started") return isNotStartedStatus(status) && !isClosedStatus(status);
  if (projectStatusFilter === "started") return isStartedStatus(status) && !isClosedStatus(status);
  return !isClosedStatus(status);
}

function filteredProjectFinance() {
  const term = projectSearch.trim().toLowerCase();
  return state.projectFinance.filter((item) => {
    const haystack = `${item.project_no} ${item.name} ${item.customer_name} ${item.location} ${item.contact_person || ""} ${item.contact_phone || ""} ${item.status || ""}`.toLowerCase();
    const projectNameStarts = String(item.name || "").toLowerCase().startsWith(term);
    return (!term || projectNameStarts || haystack.includes(term)) && statusMatches(item.status);
  });
}

function customerCumulativeRows(financeRows = state.projectFinance) {
  const grouped = new Map();
  financeRows.forEach((project) => {
    const key = project.customer_name || "Unknown Customer";
    if (!grouped.has(key)) {
      grouped.set(key, {
        customer_name: key,
        projects: 0,
        active_projects: 0,
        closed_projects: 0,
        not_started_projects: 0,
        finalized_amount: 0,
        received_amount: 0,
        customer_balance: 0,
        third_party_finalized: 0,
        third_party_paid: 0,
        gross_margin: 0,
        project_ids: [],
      });
    }
    const row = grouped.get(key);
    row.projects += 1;
    row.active_projects += isClosedStatus(project.status) ? 0 : 1;
    row.closed_projects += isClosedStatus(project.status) ? 1 : 0;
    row.not_started_projects += isNotStartedStatus(project.status) && !isClosedStatus(project.status) ? 1 : 0;
    row.finalized_amount += Number(project.finalized_amount || 0);
    row.received_amount += Number(project.received_amount || 0);
    row.customer_balance += Number(project.customer_balance || 0);
    row.third_party_finalized += Number(project.third_party_finalized || 0);
    row.third_party_paid += Number(project.third_party_paid || 0);
    row.gross_margin += Number(project.gross_margin || 0);
    row.project_ids.push(project.id);
  });
  return Array.from(grouped.values()).sort((a, b) => a.customer_name.localeCompare(b.customer_name));
}

function renderDashboard() {
  const el = document.getElementById("view-dashboard");
  api("/api/dashboard").then((dashboard) => {
    const totals = dashboard.totals;
    const receivablePct = percent(totals.received, totals.finalized);
    const payablePct = percent(totals.vendor_paid, totals.vendor_finalized);
    const pendingCustomer = state.customerPaymentSchedules.filter((item) => item.status !== "Received");
    const pendingVendors = state.thirdPartyPaymentSchedules.filter((item) => item.status !== "Paid");
    const activeProjects = dashboard.finance.filter((item) => !isClosedStatus(item.status));
    const closedProjects = dashboard.finance.filter((item) => isClosedStatus(item.status));
    const notStartedProjects = dashboard.finance.filter((item) => isNotStartedStatus(item.status) && !isClosedStatus(item.status));
    const startedProjects = dashboard.finance.filter((item) => isStartedStatus(item.status) && !isClosedStatus(item.status));
    const customerRows = customerCumulativeRows(dashboard.finance);
    const dashboardTerm = dashboardProjectSearch.trim().toLowerCase();
    const dashboardBaseProjects = dashboardProjectFilter === "closed" ? closedProjects : activeProjects;
    const dashboardMatches = dashboardBaseProjects.filter((project) => {
      const haystack = `${project.project_no} ${project.name} ${project.customer_name} ${project.status} ${project.project_category || ""}`.toLowerCase();
      const starts = String(project.name || "").toLowerCase().startsWith(dashboardTerm);
      return !dashboardTerm || starts || haystack.includes(dashboardTerm);
    });
    const selectedFinance = dashboardMatches.find((item) => Number(item.id) === Number(dashboardSelectedProjectId)) || dashboardMatches[0] || null;
    if (selectedFinance) dashboardSelectedProjectId = selectedFinance.id;
    el.innerHTML = `
      <div class="dashboard-hero">
        <div>
          <span class="eyebrow">Live business overview</span>
          <h2>PROJECT -AR/AP</h2>
          <p class="muted">${esc(state.business.name)} | ${esc(state.business.phone)}</p>
        </div>
        <div class="actions">
          <button onclick="printSection('view-dashboard')">Print Dashboard</button>
          <button onclick="openAllProjectsLedger()">All Ledger Preview</button>
          <button onclick="downloadPdf('/api/reports/all-projects-ledger.pdf', 'all-projects-ledger.pdf')">All Ledger PDF</button>
          <button onclick="switchView('projects')" class="primary">Open Projects</button>
        </div>
      </div>
      <div class="grid stats dashboard-stats">
        ${stat("Projects", totals.projects, "projects")}
        ${stat("Active Projects", activeProjects.length, "projects")}
        ${stat("Started / WIP", startedProjects.length, "projects")}
        ${stat("Not Started / Lead", notStartedProjects.length, "projects")}
        ${stat("Closed Projects", closedProjects.length, "balance")}
        ${stat("Finalised", rupees(totals.finalized), "money")}
        ${stat("Received", rupees(totals.received), "received")}
        ${stat("Customer Balance", rupees(totals.customer_balance), "balance")}
        ${stat("Third-Party Finalised", rupees(totals.vendor_finalized), "vendor")}
        ${stat("Third-Party Paid", rupees(totals.vendor_paid), "paid")}
        ${stat("Expected Gross Margin", rupees(totals.gross_margin), "margin")}
        ${stat("Pending Payable", rupees(totals.vendor_finalized - totals.vendor_paid), "payable")}
      </div>
      <div class="dashboard-grid">
        <div class="panel chart-panel">
          <div class="panel-head">
            <h2>Finance Preview</h2>
            <button onclick="printSection('view-dashboard')">Print</button>
          </div>
          <div class="chart-row">
            ${donutChart(receivablePct, "Customer Collection", `${receivablePct}%`, "#315c8f")}
            ${donutChart(payablePct, "Vendor Paid", `${payablePct}%`, "#475569")}
          </div>
          <div class="mini-ledger">
            ${progressLine("Customer Received", totals.received, totals.finalized, "#315c8f")}
            ${progressLine("Customer Balance", totals.customer_balance, totals.finalized, "#c2410c")}
            ${progressLine("Third-Party Paid", totals.vendor_paid, totals.vendor_finalized, "#475569")}
            ${progressLine("Expected Margin", totals.gross_margin, totals.finalized, "#0f766e")}
          </div>
        </div>
        <div class="panel entry-panel">
          <div class="panel-head">
            <h2>Entry Options</h2>
            <button onclick="printSection('view-dashboard')">Print</button>
          </div>
          <div class="entry-grid">
            ${entryButton("Project", "Add new project", "openProjectForm()")}
            ${entryButton("Customer", "Add customer details", "openCustomerForm()")}
            ${entryButton("Third Party", "Add vendor/contractor", "openThirdPartyForm()")}
            ${entryButton("Receipt", "Customer payment entry", `openReceiptForm(${selectedFinance?.id || "null"})`)}
            ${entryButton("Vendor Account", "Assign third party", `openProjectThirdPartyForm(null, ${selectedFinance?.id || "null"})`)}
            ${entryButton("Vendor Payment", "Pay selected project vendor", `openThirdPartyPaymentForm(${selectedFinance?.id || "null"})`)}
            ${entryButton("Document", "Add document/agreement", "openProjectDocumentForm()")}
            ${entryButton("WIP", "Daily work progress", `openWipForm(null, ${selectedFinance?.id || "null"})`)}
          </div>
        </div>
      </div>
      <div class="dashboard-workbench">
        <div class="panel">
          <div class="panel-head">
            <h2>Find Project</h2>
            <div class="actions">
              <button onclick="openAllProjectsLedger()">Zoom Ledger</button>
              <button onclick="downloadPdf('/api/reports/all-projects-ledger.pdf', 'all-projects-ledger.pdf')">PDF</button>
            </div>
          </div>
          <div class="dashboard-search-box">
            <input id="dashboard-project-search" placeholder="Type project starting letter/name" value="${esc(dashboardProjectSearch)}" oninput="setDashboardProjectSearchLive(this.value)">
            <button onclick="setDashboardProjectSearch()">Search</button>
            <button onclick="clearDashboardProjectSearch()">Clear</button>
          </div>
          <label class="full">Select Project
            <select onchange="selectDashboardProject(Number(this.value))">
              ${dashboardMatches.slice(0, 25).map((project) => `<option value="${project.id}" ${Number(project.id) === Number(selectedFinance?.id) ? "selected" : ""}>${esc(project.project_no)} - ${esc(project.name)} | ${esc(project.customer_name)}</option>`).join("")}
            </select>
          </label>
          <p class="muted">${dashboardMatches.length} ${dashboardProjectFilter === "closed" ? "closed" : "active"} matching project(s). Showing maximum 25 in selector. Open Projects for full table.</p>
          <div class="actions" style="margin-top:12px">
            <button onclick="activeView='projects'; render()">Open Projects Table</button>
            <button class="primary" onclick="openProjectForm()">New Project</button>
          </div>
        </div>
        ${selectedFinance ? dashboardProjectDetail(selectedFinance) : `<div class="panel empty">Select a project</div>`}
      </div>
      <div class="split">
        <div class="panel">
          <div class="panel-head">
            <h2>Customer-Wise Cumulative Preview</h2>
            <div class="actions">
              <button onclick="projectViewMode='customer'; switchView('projects')">Open Customer View</button>
              <button onclick="printSection('view-dashboard')">Print</button>
            </div>
          </div>
          ${customerCumulativeTable(customerRows.slice(0, 8))}
        </div>
        <div class="grid">
          <div class="panel color-card color-blue">
            <div class="panel-head"><h2>Customer Payment Modes</h2><button onclick="printSection('view-dashboard')">Print</button></div>
            ${barList(dashboard.modes, "mode", "amount")}
          </div>
          <div class="panel color-card color-teal">
            <div class="panel-head"><h2>Vendor Category Cost</h2><button onclick="printSection('view-dashboard')">Print</button></div>
            ${barList(dashboard.vendorCategories, "category", "amount")}
          </div>
          <div class="panel color-card color-amber">
            <div class="panel-head"><h2>Pending Schedule Preview</h2><button onclick="switchView('projects')">Open</button></div>
            ${schedulePreview("Customer Receivable", pendingCustomer, "actual_received", "scheduled_amount")}
            ${schedulePreview("Third-Party Payable", pendingVendors, "actual_paid", "scheduled_amount")}
          </div>
        </div>
      </div>
    `;
  });
}

function dashboardProjectRow(project) {
  const active = Number(project.id) === Number(dashboardSelectedProjectId) ? "active" : "";
  return `
    <button class="dashboard-project-row ${active}" onclick="selectDashboardProject(${project.id})">
      <span><strong>${esc(project.project_no)} - ${esc(project.name)}</strong><small>${esc(project.customer_name)} | ${esc(project.status)} | ${esc(project.project_category || "")}</small></span>
      <span>${rupees(project.finalized_amount)}<small>Finalised</small></span>
      <span>${rupees(project.received_amount)}<small>Received</small></span>
      <span>${rupees(project.third_party_paid)}<small>3rd Party Paid</small></span>
    </button>
  `;
}

function selectDashboardProject(projectId) {
  dashboardSelectedProjectId = projectId;
  renderDashboard();
}

function setDashboardProjectSearch() {
  dashboardProjectSearch = document.getElementById("dashboard-project-search")?.value || "";
  renderDashboard();
}

function setDashboardProjectSearchLive(value) {
  dashboardProjectSearch = value || "";
  renderDashboard();
  refocusInput("dashboard-project-search");
}

function clearDashboardProjectSearch() {
  dashboardProjectSearch = "";
  dashboardSelectedProjectId = null;
  renderDashboard();
}

function dashboardProjectDetail(finance) {
  const project = state.projects.find((item) => Number(item.id) === Number(finance.id));
  const projectThirdParties = state.projectThirdParties.filter((item) => Number(item.project_id) === Number(finance.id));
  const projectReceipts = state.receipts.filter((item) => Number(item.project_id) === Number(finance.id));
  const wipUpdates = state.wipUpdates.filter((item) => Number(item.project_id) === Number(finance.id));
  const thirdPartyPaid = projectThirdParties.reduce((sum, item) => sum + projectThirdPartyPaidTotal(item.id), 0);
  const thirdPartyAdvance = projectThirdParties.reduce((sum, item) => sum + Number(item.advance_amount || 0), 0);
  const payable = Number(finance.third_party_finalized || 0) - thirdPartyAdvance - thirdPartyPaid;
  const collectionPct = percent(finance.received_amount, finance.finalized_amount);
  const vendorPct = percent(thirdPartyAdvance + thirdPartyPaid, finance.third_party_finalized);
  return `
    <div class="panel dashboard-detail">
      <div class="panel-head">
        <div>
          <h2>${esc(finance.project_no)} - ${esc(finance.name)}</h2>
          <p class="muted">${esc(finance.customer_name)} | ${esc(finance.status)} | ${esc(finance.charge_type || "")}</p>
        </div>
        <div class="actions">
          <button onclick="selectProject(${finance.id})">Open Full Details</button>
          <button onclick="openLedger(${finance.id}, 'combined')">Print Ledger</button>
          <button onclick="downloadPdf('/api/reports/project-ledger.pdf?project_id=${finance.id}', 'project-ledger-${finance.id}.pdf')">PDF</button>
        </div>
      </div>
      <div class="chart-row">
        ${donutChart(collectionPct, "Customer Collection", `${collectionPct}%`, "#2563eb")}
        ${donutChart(vendorPct, "3rd Party Paid", `${vendorPct}%`, "#0f766e")}
      </div>
      <div class="mini-ledger">
        ${progressLine("Customer Received", finance.received_amount, finance.finalized_amount, "#2563eb")}
        ${progressLine("Customer Balance", finance.customer_balance, finance.finalized_amount, "#c2410c")}
        ${progressLine("3rd Party Paid", thirdPartyAdvance + thirdPartyPaid, finance.third_party_finalized, "#0f766e")}
        ${progressLine("Gross Margin", finance.gross_margin, finance.finalized_amount, "#7c3aed")}
      </div>
      ${wipProgressPanel(project, wipUpdates, projectThirdParties)}
      <div class="detail-grid dashboard-detail-grid">
        ${detail("Finalised", rupees(finance.finalized_amount))}
        ${detail("Received", rupees(finance.received_amount))}
        ${detail("Customer Balance", rupees(finance.customer_balance))}
        ${detail("3rd Party Finalised", rupees(finance.third_party_finalized))}
        ${detail("3rd Party Advance", rupees(thirdPartyAdvance))}
        ${detail("3rd Party Later Paid", rupees(thirdPartyPaid))}
        ${detail("3rd Party Payable", rupees(payable))}
        ${detail("Gross Margin", rupees(finance.gross_margin))}
      </div>
      <div class="dashboard-next-actions">
        <button onclick="activeView='projects'; selectedProjectId=${finance.id}; render()">Project Detail Tables</button>
        <button onclick="activeView='receipts'; render()">Customer Receipt Table</button>
        <button onclick="activeView='vendor-accounts'; render()">3rd Party Tables</button>
        <button onclick="activeView='communications'; selectedProjectId=${finance.id}; render()">Communication Table</button>
      </div>
    </div>
  `;
}

function stat(label, value, tone = "") {
  return `<button class="stat stat-${tone}" onclick="dashboardStatAction('${esc(label)}')"><span>${esc(label)}</span><strong>${esc(value)}</strong></button>`;
}

function dashboardStatAction(label) {
  if (label.includes("Closed")) {
    dashboardProjectFilter = "closed";
    dashboardSelectedProjectId = null;
    projectStatusFilter = "closed";
    renderDashboard();
  } else if (label.includes("Started / WIP")) {
    dashboardProjectFilter = "active";
    projectStatusFilter = "started";
    switchView("projects");
  } else if (label.includes("Not Started")) {
    dashboardProjectFilter = "active";
    projectStatusFilter = "not-started";
    switchView("projects");
  } else if (label.includes("Project")) {
    dashboardProjectFilter = "active";
    projectStatusFilter = label.includes("Active") ? "active" : "all";
    switchView("projects");
  }
  else if (label.includes("Third-Party") || label.includes("Payable")) switchView("vendor-accounts");
  else if (label.includes("Received") || label.includes("Balance")) switchView("receipts");
  else switchView("reports");
}

function percent(part, total) {
  const base = Number(total || 0);
  if (!base) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(part || 0) / base) * 100)));
}

function donutChart(value, label, center, color) {
  const dash = `${value} ${100 - value}`;
  return `
    <div class="donut-card">
      <svg viewBox="0 0 42 42" class="donut" aria-hidden="true">
        <circle cx="21" cy="21" r="15.915" class="donut-bg"></circle>
        <circle cx="21" cy="21" r="15.915" class="donut-ring" stroke="${color}" stroke-dasharray="${dash}" stroke-dashoffset="25"></circle>
        <text x="21" y="22.5" text-anchor="middle">${esc(center)}</text>
      </svg>
      <strong>${esc(label)}</strong>
    </div>
  `;
}

function progressLine(label, value, total, color) {
  const pct = percent(value, total);
  return `
    <div>
      <div class="bar-label"><span>${esc(label)}</span><strong>${rupees(value)}</strong></div>
      <div class="bar"><span style="width:${pct}%; background:${color}"></span></div>
    </div>
  `;
}

function percentProgressLine(label, pct, color = "#0f766e") {
  const value = Math.max(0, Math.min(100, Math.round(Number(pct || 0))));
  return `
    <div>
      <div class="bar-label"><span>${esc(label)}</span><strong>${value}%</strong></div>
      <div class="bar"><span style="width:${value}%; background:${color}"></span></div>
    </div>
  `;
}

function latestWipItems(items) {
  const latest = new Map();
  items.forEach((item) => {
    const key = `${item.work_category || "Work"}|${item.work_item || "Item"}`;
    const current = latest.get(key);
    if (!current || `${item.update_date || ""}-${item.id || 0}` > `${current.update_date || ""}-${current.id || 0}`) {
      latest.set(key, item);
    }
  });
  return Array.from(latest.values()).sort((a, b) => String(a.work_category || "").localeCompare(String(b.work_category || "")));
}

function averageWip(items) {
  const latest = latestWipItems(items);
  if (!latest.length) return 0;
  return latest.reduce((sum, item) => sum + Number(item.progress_percent || 0), 0) / latest.length;
}

function wipProgressPanel(project, items, projectThirdParties = []) {
  const latest = latestWipItems(items);
  const customer = project ? customerName(project.customer_id) : (items[0]?.customer_name || "");
  const thirdPartyNames = projectThirdParties.length
    ? projectThirdParties.map((item) => thirdPartyName(item.third_party_id)).filter(Boolean).join(", ")
    : "No 3rd party assigned";
  const latestDate = items.reduce((max, item) => !max || item.update_date > max ? item.update_date : max, "");
  return `
    <div class="wip-chart">
      <div class="wip-chart-head">
        <div>
          <h3>Work In Progress Chart</h3>
          <p class="muted">${esc(customer || "Customer not selected")} | ${esc(thirdPartyNames)}</p>
        </div>
        <strong>${Math.round(averageWip(items))}%</strong>
      </div>
      <div class="wip-context">
        <span>${items.length} daily update(s)</span>
        <span>${latest.length} work item(s)</span>
        <span>Latest: ${displayValue(latestDate || "No date")}</span>
      </div>
      <div class="wip-bars">
        ${latest.length ? latest.map((item, index) => percentProgressLine(`${item.work_category || "Work"} - ${item.work_item || "Item"}`, item.progress_percent, ["#2563eb", "#0f766e", "#c2410c", "#7c3aed"][index % 4])).join("") : `<p class="empty">No WIP entry yet. Add daily WIP to show chart.</p>`}
      </div>
    </div>
  `;
}

function entryButton(label, sub, action) {
  return `<button class="entry-button" onclick="${action}"><strong>${esc(label)}</strong><span>${esc(sub)}</span></button>`;
}

function schedulePreview(label, items, actualKey, scheduleKey) {
  const total = items.reduce((sum, item) => sum + Number(item[scheduleKey] || 0), 0);
  const actual = items.reduce((sum, item) => sum + Number(item[actualKey] || 0), 0);
  return `
    <div class="schedule-preview">
      <div class="bar-label"><span>${esc(label)}</span><strong>${rupees(total - actual)}</strong></div>
      <div class="bar"><span style="width:${percent(actual, total)}%"></span></div>
      <p class="muted">${items.length} pending item(s)</p>
    </div>
  `;
}

function barList(items, labelKey, valueKey) {
  if (!items.length) return `<p class="empty">No chart data yet</p>`;
  const max = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1);
  return `
    <div class="bar-list">
      ${items.map((item) => {
        const width = Math.max(4, (Number(item[valueKey] || 0) / max) * 100);
        return `
          <div>
            <div class="bar-label"><span>${esc(item[labelKey] || "Not set")}</span><strong>${rupees(item[valueKey])}</strong></div>
            <div class="bar"><span style="width:${width}%"></span></div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function projectFinanceTable(finance) {
  return table([
    { label: "Project", render: (r) => `<strong>${esc(r.project_no)}</strong><br>${esc(r.name)}<br><span class="muted">${esc(r.project_category || "")}</span>` },
    { label: "Customer", key: "customer_name" },
    { label: "Status", render: (r) => `${statusPill(r.status)}<br><span class="muted">${esc(r.charge_type || "")}</span>` },
    { label: "Finalised", money: true, render: (r) => rupees(r.finalized_amount) },
    { label: "Received", money: true, render: (r) => rupees(r.received_amount) },
    { label: "Balance", money: true, render: (r) => rupees(r.customer_balance) },
    { label: "3rd Party", money: true, render: (r) => rupees(r.third_party_finalized) },
    { label: "Margin", money: true, render: (r) => rupees(r.gross_margin) },
    { label: "Action", render: (r) => `<div class="row-actions"><button onclick="selectProject(${r.id})">Select</button><button onclick="openLedger(${r.id}, 'customer')">Customer</button><button onclick="openLedger(${r.id}, 'third-party')">3rd Party</button><button onclick="openLedger(${r.id}, 'combined')">Both</button><button onclick="downloadPdf('/api/reports/project-ledger.pdf?project_id=${r.id}', 'project-ledger-${r.id}.pdf')">PDF</button><button onclick="openProjectForm(${r.id})">Modify</button>${projectStatusActionButton(r)}<button class="danger" onclick="deleteRecord('projects', ${r.id}, 'Delete this project and its linked records?')">Delete</button></div>` },
  ], finance);
}

function statusPill(status) {
  const cls = isClosedStatus(status) ? "pill pill-closed" : String(status || "") === "Completed" ? "pill pill-completed" : "pill";
  return `<span class="${cls}">${esc(status || "")}</span>`;
}

function projectStatusActionButton(project) {
  if (isClosedStatus(project.status)) return `<button onclick="setProjectStatus(${project.id}, 'Started')">Reopen</button>`;
  return `<button onclick="setProjectStatus(${project.id}, 'Closed')">Close</button>`;
}

function customerCumulativeTable(rows) {
  return table([
    { label: "Customer", render: (r) => `<strong>${esc(r.customer_name)}</strong><br>${r.projects} project(s): ${r.active_projects} active, ${r.closed_projects} closed` },
    { label: "Not Started", key: "not_started_projects" },
    { label: "Finalised", money: true, render: (r) => rupees(r.finalized_amount) },
    { label: "Received", money: true, render: (r) => rupees(r.received_amount) },
    { label: "Balance", money: true, render: (r) => rupees(r.customer_balance) },
    { label: "3rd Party", money: true, render: (r) => rupees(r.third_party_finalized) },
    { label: "Margin", money: true, render: (r) => rupees(r.gross_margin) },
    { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openCustomerCumulativeLedger('${encodeURIComponent(r.customer_name)}')">Cumulative Ledger</button><button onclick="downloadCustomerPdfByName('${encodeURIComponent(r.customer_name)}')">PDF</button></div>` },
  ], rows);
}

function renderProjects() {
  const finance = filteredProjectFinance();
  if (!finance.some((item) => Number(item.id) === Number(selectedProjectId))) selectedProjectId = finance[0]?.id || null;
  const cumulative = customerCumulativeRows(finance);
  const selected = state.projects.find((item) => Number(item.id) === Number(selectedProjectId));
  const selectedFinance = state.projectFinance.find((item) => Number(item.id) === Number(selectedProjectId));
  document.getElementById("view-projects").innerHTML = `
    <div class="grid">
      <div class="panel">
        <div class="panel-head">
          <h2>Projects</h2>
          <div class="actions">
            <button class="primary" onclick="openProjectForm()">Add Project</button>
            ${selected ? `<button onclick="openProjectForm(${selected.id})">Modify Selected</button><button class="danger" onclick="deleteRecord('projects', ${selected.id}, 'Delete selected project and all linked records?')">Delete Selected</button>` : ""}
          </div>
        </div>
        <div class="toolbar">
          <input id="project-search" placeholder="Type project starting letter/name" value="${esc(projectSearch)}" oninput="setProjectSearchLive(this.value)">
          <button onclick="setProjectSearch()">Search</button>
          <button onclick="clearProjectSearch()">Clear</button>
        </div>
        <div class="date-toolbar">
          <label>Payment Received From <input id="payment-from-date" type="date" value="${esc(paymentFromDate)}"></label>
          <label>Payment Received To <input id="payment-to-date" type="date" value="${esc(paymentToDate)}"></label>
          <button onclick="setPaymentDateRange()">Apply Dates</button>
          <button onclick="clearPaymentDateRange()">All Dates</button>
        </div>
        <div class="segmented">
          <button class="${projectViewMode === "individual" ? "active" : ""}" onclick="setProjectViewMode('individual')">Project Wise</button>
          <button class="${projectViewMode === "customer" ? "active" : ""}" onclick="setProjectViewMode('customer')">Customer Cumulative</button>
        </div>
        <div class="segmented status-filter">
          ${statusFilterButton("active", "Active")}
          ${statusFilterButton("started", "Started / WIP")}
          ${statusFilterButton("not-started", "Not Started")}
          ${statusFilterButton("closed", "Closed")}
          ${statusFilterButton("all", "All")}
        </div>
        <div class="detail-grid project-summary">
          ${detail("Projects In View", finance.length)}
          ${detail("Customers In View", cumulative.length)}
          ${detail("Finalised", rupees(finance.reduce((sum, row) => sum + Number(row.finalized_amount || 0), 0)))}
          ${detail("Balance", rupees(finance.reduce((sum, row) => sum + Number(row.customer_balance || 0), 0)))}
        </div>
        ${projectViewMode === "customer" ? customerCumulativeTable(cumulative) : projectFinanceTable(finance)}
      </div>
      ${selected ? renderSelectedProject(selected, selectedFinance) : `<div class="panel empty">No project selected</div>`}
    </div>
  `;
  const searchInput = document.getElementById("project-search");
  if (searchInput) {
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") setProjectSearch();
    });
  }
}

function statusFilterButton(value, label) {
  return `<button class="${projectStatusFilter === value ? "active" : ""}" onclick="setProjectStatusFilter('${value}')">${label}</button>`;
}

function renderSelectedProject(project, finance) {
  const customerSchedules = state.customerPaymentSchedules.filter((item) => Number(item.project_id) === Number(project.id));
  const projectReceipts = state.receipts.filter((item) => Number(item.project_id) === Number(project.id));
  const filteredReceipts = filterByDate(projectReceipts, "receipt_date");
  const filteredReceived = filteredReceipts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const projectThirdParties = state.projectThirdParties.filter((item) => Number(item.project_id) === Number(project.id));
  const thirdPartyPaid = projectThirdParties.reduce((sum, item) => sum + projectThirdPartyPaidTotal(item.id), 0);
  const thirdPartyAdvance = projectThirdParties.reduce((sum, item) => sum + Number(item.advance_amount || 0), 0);
  const thirdPartyPayable = Number(finance?.third_party_finalized || 0) - thirdPartyAdvance - thirdPartyPaid;
  const thirdPartyScheduleIds = new Set(projectThirdParties.map((item) => Number(item.id)));
  const thirdPartyPayments = state.thirdPartyPayments.filter((item) => thirdPartyScheduleIds.has(Number(item.project_third_party_id)));
  const thirdPartySchedules = state.thirdPartyPaymentSchedules.filter((item) => thirdPartyScheduleIds.has(Number(item.project_third_party_id)));
  const documents = state.projectDocuments.filter((item) => Number(item.project_id) === Number(project.id));
  const communicationNotes = state.communicationNotes.filter((item) => Number(item.project_id) === Number(project.id));
  const wipUpdates = state.wipUpdates.filter((item) => Number(item.project_id) === Number(project.id));
  return `
    <div class="panel selected-project ${isClosedStatus(project.status) ? "project-closed-panel" : ""}">
      <div class="panel-head">
        <div>
          <h2>${esc(project.project_no)} - ${esc(project.name)}</h2>
          <p class="muted">${esc(customerName(project.customer_id))} | ${esc(project.location || "")}</p>
        </div>
        <div class="actions">
          <button onclick="openLedger(${project.id}, 'customer')">Customer Ledger</button>
          <button onclick="openLedger(${project.id}, 'third-party')">3rd Party Ledger</button>
          <button onclick="openLedger(${project.id}, 'combined')">Both Ledger</button>
          <button onclick="downloadPdf('/api/reports/project-ledger.pdf?project_id=${project.id}', 'project-ledger-${project.id}.pdf')">PDF</button>
          <button onclick="openReceiptForm(${project.id})">Add Receipt</button>
          <button onclick="openProjectThirdPartyForm(null, ${project.id})">Link 3rd Party</button>
          <button onclick="openThirdPartyPaymentForm(${project.id})">Pay 3rd Party</button>
          <button onclick="openCustomerScheduleForm(null, ${project.id})">Customer Schedule</button>
          <button onclick="openCommunicationNoteForm(null, ${project.id}, 'Customer')">Customer Note</button>
          <button onclick="openCommunicationNoteForm(null, ${project.id}, 'Third Party')">3rd Party Note</button>
          <button onclick="openProjectDocumentForm(null, ${project.id})">Upload Document</button>
          ${projectStatusActionButton(project)}
        </div>
      </div>
      <div class="detail-grid">
        ${detail("Contact Person", project.contact_person)}
        ${detail("Contact Phone", project.contact_phone)}
        ${detail("Contact Email", project.contact_email)}
        ${detail("Site Address", project.site_address)}
        ${detail("Project Type", project.project_category)}
        ${detail("Charge Type", project.charge_type)}
        ${detail("Material Charge", rupees(project.material_amount))}
        ${detail("Labour Charge", rupees(project.labour_amount))}
        ${detail("Other Charge", rupees(project.other_amount))}
        ${detail("Finalised", rupees(project.finalized_amount))}
        ${detail("Received", rupees(finance?.received_amount))}
        ${detail(`Received (${dateRangeText()})`, rupees(filteredReceived))}
        ${detail("Balance", rupees(finance?.customer_balance))}
        ${detail("3rd Party Finalised", rupees(finance?.third_party_finalized))}
        ${detail("3rd Party Advance", rupees(thirdPartyAdvance))}
        ${detail("3rd Party Later Paid", rupees(thirdPartyPaid))}
        ${detail("3rd Party Payable", rupees(thirdPartyPayable))}
        ${detail("Gross Margin", rupees(finance?.gross_margin))}
        ${detail("Status", project.status)}
      </div>
      <div class="accountability-strip">
        <div>
          <span>Customer Accountability</span>
          <strong>${rupees(finance?.finalized_amount)} finalised - ${rupees(finance?.received_amount)} received = ${rupees(finance?.customer_balance)} balance</strong>
        </div>
        <div>
          <span>3rd Party Accountability</span>
          <strong>${rupees(finance?.third_party_finalized)} finalised - ${rupees(thirdPartyAdvance + thirdPartyPaid)} paid = ${rupees(thirdPartyPayable)} payable</strong>
        </div>
      </div>
      <div class="split">
        <div>
          <div class="panel-head compact"><h3>Payment Received Details (${esc(dateRangeText())})</h3><div class="actions"><button onclick="openReceiptForm(${project.id})">Add</button><button onclick="openLedger(${project.id}, 'customer')">Print</button><button onclick="downloadPdf('/api/reports/project-ledger.pdf?project_id=${project.id}', 'project-ledger-${project.id}.pdf')">PDF</button></div></div>
          ${table([
            { label: "Date", key: "receipt_date" },
            { label: "Mode", key: "mode" },
            { label: "Reference", key: "reference_no" },
            { label: "Amount", money: true, render: (r) => rupees(r.amount) },
            { label: "Notes", key: "notes" },
            { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openReceiptForm(${project.id}, ${r.id})">Modify</button><button class="danger" onclick="deleteRecord('receipts', ${r.id})">Delete</button></div>` },
          ], filteredReceipts)}
          <div class="panel-head compact"><h3>Customer Payment Schedule</h3><button onclick="openCustomerScheduleForm(null, ${project.id})">Add</button></div>
          ${table([
            { label: "Milestone", key: "milestone" },
            { label: "Due", key: "due_date" },
            { label: "Schedule", money: true, render: (r) => rupees(r.scheduled_amount) },
            { label: "Actual Received", money: true, render: (r) => rupees(r.actual_received) },
            { label: "Status", key: "status" },
            { label: "Action", render: (r) => `<button onclick="openCustomerScheduleForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('customer-payment-schedules', ${r.id})">Delete</button>` },
          ], customerSchedules)}
        </div>
        <div>
          <div class="panel-head compact"><h3>Documents</h3><button onclick="openProjectDocumentForm(null, ${project.id})">Add</button></div>
          ${table([
            { label: "Type", key: "document_type" },
            { label: "Title", render: (r) => r.stored_path ? `<a href="/${esc(r.stored_path)}" target="_blank">${esc(r.title)}</a>` : esc(r.title) },
            { label: "Date", key: "document_date" },
            { label: "Ref", key: "reference_no" },
            { label: "Action", render: (r) => `<button onclick="openProjectDocumentForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('project-documents', ${r.id})">Delete</button>` },
          ], documents)}
        </div>
      </div>
      <div style="margin-top:14px">
        <div class="panel-head compact"><h3>3rd Parties Linked With This Customer Project</h3><button onclick="openProjectThirdPartyForm(null, ${project.id})">Link 3rd Party</button></div>
        ${table([
          { label: "3rd Party", render: (r) => thirdPartyName(r.third_party_id) },
          { label: "Work Scope", key: "work_scope" },
          { label: "Finalised", money: true, render: (r) => rupees(r.finalized_amount) },
          { label: "Advance Given", money: true, render: (r) => rupees(r.advance_amount) },
          { label: "Later Paid", money: true, render: (r) => rupees(projectThirdPartyPaidTotal(r.id)) },
          { label: "Payable", money: true, render: (r) => rupees(Number(r.finalized_amount || 0) - Number(r.advance_amount || 0) - projectThirdPartyPaidTotal(r.id)) },
          { label: "Status", key: "status" },
          { label: "Action", render: (r) => `<button onclick="openProjectThirdPartyForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('project-third-parties', ${r.id}, 'Delete this project-wise 3rd party account?')">Delete</button>` },
        ], projectThirdParties)}
      </div>
      <div style="margin-top:14px">
        <div class="panel-head compact"><h3>Third-Party Payment Schedule</h3><div class="actions"><button onclick="openThirdPartyScheduleForm()">Add Schedule</button><button onclick="openThirdPartyPaymentForm(${project.id})">Add Payment</button></div></div>
        ${table([
          { label: "Third Party", render: (r) => projectThirdPartyName(r.project_third_party_id) },
          { label: "Milestone", key: "milestone" },
          { label: "Due", key: "due_date" },
          { label: "Schedule", money: true, render: (r) => rupees(r.scheduled_amount) },
          { label: "Actual Paid", money: true, render: (r) => rupees(r.actual_paid) },
          { label: "Status", key: "status" },
          { label: "Action", render: (r) => `<button onclick="openThirdPartyScheduleForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('third-party-payment-schedules', ${r.id})">Delete</button>` },
        ], thirdPartySchedules)}
      </div>
      <div style="margin-top:14px">
        <div class="panel-head compact"><h3>Third-Party Payment Given Details</h3><button onclick="openThirdPartyPaymentForm(${project.id})">Add Payment</button></div>
        ${table([
          { label: "Date", key: "payment_date" },
          { label: "3rd Party Account", render: (r) => projectThirdPartyName(r.project_third_party_id) },
          { label: "Mode", key: "mode" },
          { label: "Reference", key: "reference_no" },
          { label: "Amount", money: true, render: (r) => rupees(r.amount) },
          { label: "Notes", key: "notes" },
          { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openThirdPartyPaymentForm(${project.id}, ${r.id})">Modify</button><button class="danger" onclick="deleteRecord('third-party-payments', ${r.id})">Delete</button></div>` },
        ], thirdPartyPayments)}
      </div>
      <div style="margin-top:14px">
        <div class="panel-head compact"><h3>Communication Notes</h3><div class="actions"><button onclick="openCommunicationNoteForm(null, ${project.id}, 'Customer')">Customer Note</button><button onclick="openCommunicationNoteForm(null, ${project.id}, 'Third Party')">3rd Party Note</button></div></div>
        ${communicationNotesTable(communicationNotes)}
      </div>
      <div style="margin-top:14px">
        <div class="panel-head compact"><h3>Daily WIP Progress</h3><button onclick="openWipForm(null, ${project.id})">Add WIP</button></div>
        ${wipProgressPanel(project, wipUpdates, projectThirdParties)}
        ${wipTable(wipUpdates)}
      </div>
    </div>
  `;
}

function projectThirdPartyPaidTotal(projectThirdPartyId) {
  return state.thirdPartyPayments
    .filter((item) => Number(item.project_third_party_id) === Number(projectThirdPartyId))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function communicationNotesTable(notes) {
  return table([
    { label: "Date", key: "note_date" },
    { label: "Party", render: (r) => `${esc(r.party_type)}<br>${esc(r.customer_name || r.third_party_name || "")}` },
    { label: "Mode", key: "mode" },
    { label: "Subject", key: "subject" },
    { label: "Short Note", key: "note" },
    { label: "Follow-up", key: "next_followup_date" },
    { label: "Action", render: (r) => `<button onclick="openCommunicationNoteForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('communication-notes', ${r.id})">Delete</button>` },
  ], notes);
}

function detail(label, value) {
  return `<div class="detail"><span>${esc(label)}</span><strong>${displayValue(value || "")}</strong></div>`;
}

function selectProject(id) {
  selectedProjectId = id;
  activeView = "projects";
  render();
}

function switchView(view) {
  activeView = view;
  render();
}

function setProjectViewMode(mode) {
  projectViewMode = mode;
  renderProjects();
}

function setProjectStatusFilter(filter) {
  projectStatusFilter = filter;
  renderProjects();
}

function printSection(viewId) {
  const view = String(viewId || `view-${activeView}`).replace(/^view-/, "");
  downloadPdf(`/api/reports/view-preview.pdf?view=${encodeURIComponent(view)}`, `${view}-preview.pdf`);
}

function setProjectSearch() {
  projectSearch = document.getElementById("project-search")?.value || "";
  renderProjects();
}

function setProjectSearchLive(value) {
  projectSearch = value || "";
  renderProjects();
  refocusInput("project-search");
}

function clearProjectSearch() {
  projectSearch = "";
  renderProjects();
}

function setCustomerSearchLive(value) {
  customerSearch = value || "";
  renderCustomers();
  refocusInput("customer-search");
}

function clearCustomerSearch() {
  customerSearch = "";
  renderCustomers();
}

function setThirdPartySearchLive(value) {
  thirdPartySearch = value || "";
  renderThirdParties();
  refocusInput("third-party-search");
}

function clearThirdPartySearch() {
  thirdPartySearch = "";
  renderThirdParties();
}

function refocusInput(id) {
  requestAnimationFrame(() => {
    const input = document.getElementById(id);
    if (!input) return;
    input.focus();
    const length = input.value.length;
    input.setSelectionRange(length, length);
  });
}

function setPaymentDateRange() {
  paymentFromDate = document.getElementById("payment-from-date")?.value || "";
  paymentToDate = document.getElementById("payment-to-date")?.value || "";
  renderProjects();
}

function clearPaymentDateRange() {
  paymentFromDate = "";
  paymentToDate = "";
  renderProjects();
}

async function openCustomerCumulativeLedger(encodedCustomerName) {
  const customerNameText = decodeURIComponent(encodedCustomerName);
  const customer = state.customers.find((item) => item.name === customerNameText);
  const projects = state.projectFinance.filter((project) => project.customer_name === customerNameText && statusMatches(project.status));
  const totals = customerCumulativeRows(projects)[0];
  const ledgerDetails = await Promise.all(projects.map((project) => api(`/api/project-ledger?project_id=${project.id}`)));
  const allReceipts = filterByDate(ledgerDetails.flatMap((ledger) => ledger.receipts), "receipt_date");
  const allSchedules = ledgerDetails.flatMap((ledger) => ledger.customerPaymentSchedules);
  const receivedInRange = allReceipts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  openModal("Customer Cumulative Ledger / Print Preview", `
    <div class="print-company">
      <img class="print-logo" src="${esc(companyLogo())}" alt="Company logo">
      <div>
        <h2>${esc(state.business.print_name)} - ${esc(state.business.name)}</h2>
        <p>${esc(state.business.address)} | ${esc(state.business.phone)} | ${esc(state.business.email)}</p>
      </div>
    </div>
    <div class="ledger-title">
      <div>
        <h2>${esc(customerNameText)} - Cumulative Account</h2>
        <p class="muted">${projects.length} project(s) in ${esc(projectStatusFilter)} view | Payment received: ${esc(dateRangeText())}</p>
      </div>
      <div class="actions">
        <button onclick="downloadPdf('/api/reports/customer-accountability.pdf?customer_id=${customer.id}', 'customer-accountability-${customer.id}.pdf')" type="button">Print</button>
        ${customer ? `<button onclick="downloadPdf('/api/reports/customer-accountability.pdf?customer_id=${customer.id}', 'customer-accountability-${customer.id}.pdf')" type="button">PDF</button>` : ""}
      </div>
    </div>
    <div class="grid stats">
      ${stat("Projects", totals?.projects || 0)}
      ${stat("Finalised", rupees(totals?.finalized_amount))}
      ${stat("Received", rupees(totals?.received_amount))}
      ${stat(`Received ${dateRangeText()}`, rupees(receivedInRange))}
      ${stat("Balance", rupees(totals?.customer_balance))}
      ${stat("Third-Party Cost", rupees(totals?.third_party_finalized))}
      ${stat("Margin", rupees(totals?.gross_margin))}
    </div>
    <div class="grid" style="margin-top:14px">
      <div class="panel"><h3>Project Wise Summary</h3>${projectFinanceTable(projects)}</div>
      <div class="panel"><h3>All Customer Payment Schedules</h3>${table([
        { label: "Project", render: (r) => projectName(r.project_id) },
        { label: "Milestone", key: "milestone" },
        { label: "Due", key: "due_date" },
        { label: "Schedule", money: true, render: (r) => rupees(r.scheduled_amount) },
        { label: "Actual Received", money: true, render: (r) => rupees(r.actual_received) },
        { label: "Status", key: "status" },
      ], allSchedules)}</div>
      <div class="panel"><h3>All Receipts (${esc(dateRangeText())})</h3>${table([
        { label: "Project", render: (r) => projectName(r.project_id) },
        { label: "Date", key: "receipt_date" },
        { label: "Mode", key: "mode" },
        { label: "Reference", key: "reference_no" },
        { label: "Amount", money: true, render: (r) => rupees(r.amount) },
      ], allReceipts)}</div>
    </div>
    <div class="form-actions">${customer ? `<button type="button" onclick="downloadPdf('/api/reports/customer-accountability.pdf?customer_id=${customer.id}', 'customer-accountability-${customer.id}.pdf')">Download PDF</button>` : ""}<button type="button" onclick="document.getElementById('modal').close()">Close</button></div>
  `, async () => {});
}

function setLedgerZoom(delta) {
  ledgerZoom = Math.max(70, Math.min(140, ledgerZoom + delta));
  const body = document.querySelector(".ledger-zoom-body");
  const label = document.getElementById("ledger-zoom-label");
  if (body) body.style.fontSize = `${ledgerZoom}%`;
  if (label) label.textContent = `${ledgerZoom}%`;
}

function openAllProjectsLedger() {
  const finance = state.projectFinance.slice().sort((a, b) => String(a.project_no).localeCompare(String(b.project_no)));
  const totals = finance.reduce((acc, row) => {
    acc.finalized += Number(row.finalized_amount || 0);
    acc.received += Number(row.received_amount || 0);
    acc.balance += Number(row.customer_balance || 0);
    acc.vendor += Number(row.third_party_finalized || 0);
    acc.vendorPaid += Number(row.third_party_paid || 0);
    acc.margin += Number(row.gross_margin || 0);
    return acc;
  }, { finalized: 0, received: 0, balance: 0, vendor: 0, vendorPaid: 0, margin: 0 });
  openModal("All Projects Ledger / Zoom Preview", `
    <div class="print-company">
      <img class="print-logo" src="${esc(companyLogo())}" alt="Company logo">
      <div>
        <h2>${esc(state.business.print_name)} - ${esc(state.business.name)}</h2>
        <p>${esc(state.business.address)} | ${esc(state.business.phone)} | ${esc(state.business.email)}</p>
      </div>
    </div>
    <div class="ledger-title">
      <div>
        <h2>All Projects Ledger</h2>
        <p class="muted">${finance.length} project(s) | Customer receipt period: ${esc(dateRangeText())}</p>
      </div>
      <div class="actions">
        <button type="button" onclick="setLedgerZoom(-10)">Zoom -</button>
        <button type="button" id="ledger-zoom-label">${ledgerZoom}%</button>
        <button type="button" onclick="setLedgerZoom(10)">Zoom +</button>
        <button type="button" onclick="downloadPdf('/api/reports/all-projects-ledger.pdf', 'all-projects-ledger.pdf')">Print</button>
        <button type="button" onclick="downloadPdf('/api/reports/all-projects-ledger.pdf', 'all-projects-ledger.pdf')">PDF</button>
      </div>
    </div>
    <div class="ledger-zoom-body" style="font-size:${ledgerZoom}%">
      <div class="grid stats">
        ${stat("Finalised", rupees(totals.finalized))}
        ${stat("Received", rupees(totals.received))}
        ${stat("Customer Balance", rupees(totals.balance))}
        ${stat("3rd Party Cost", rupees(totals.vendor))}
        ${stat("3rd Party Paid", rupees(totals.vendorPaid))}
        ${stat("Gross Margin", rupees(totals.margin))}
      </div>
      ${finance.map((project) => allProjectLedgerBlock(project)).join("") || `<p class="empty">No projects yet</p>`}
    </div>
    <div class="form-actions"><button type="button" onclick="document.getElementById('modal').close()">Close</button></div>
  `, async () => {});
}

function allProjectLedgerBlock(finance) {
  const receipts = state.receipts.filter((item) => Number(item.project_id) === Number(finance.id));
  const projectThirdParties = state.projectThirdParties.filter((item) => Number(item.project_id) === Number(finance.id));
  const schedules = state.customerPaymentSchedules.filter((item) => Number(item.project_id) === Number(finance.id));
  const thirdPartyScheduleIds = new Set(projectThirdParties.map((item) => Number(item.id)));
  const thirdPartySchedules = state.thirdPartyPaymentSchedules.filter((item) => thirdPartyScheduleIds.has(Number(item.project_third_party_id)));
  return `
    <section class="ledger-project-block">
      <div class="ledger-project-head">
        <div>
          <h3>${esc(finance.project_no)} - ${esc(finance.name)}</h3>
          <p class="muted">${esc(finance.customer_name)} | ${esc(finance.status)} | ${esc(finance.project_category || "")}</p>
        </div>
        <div class="actions">
          <button type="button" onclick="selectProject(${finance.id})">Open</button>
          <button type="button" onclick="downloadPdf('/api/reports/project-ledger.pdf?project_id=${finance.id}', 'project-ledger-${finance.id}.pdf')">Project PDF</button>
        </div>
      </div>
      <div class="detail-grid dashboard-detail-grid">
        ${detail("Finalised", rupees(finance.finalized_amount))}
        ${detail("Received", rupees(finance.received_amount))}
        ${detail("Balance", rupees(finance.customer_balance))}
        ${detail("3rd Party", rupees(finance.third_party_finalized))}
        ${detail("3rd Party Paid", rupees(finance.third_party_paid))}
        ${detail("Margin", rupees(finance.gross_margin))}
      </div>
      <div class="split compact-split">
        <div>
          <h3>Payment Received</h3>
          ${table([
            { label: "Date", key: "receipt_date" },
            { label: "Mode", key: "mode" },
            { label: "Reference", key: "reference_no" },
            { label: "Amount", money: true, render: (r) => rupees(r.amount) },
          ], receipts)}
        </div>
        <div>
          <h3>3rd Party Assigned / Paid</h3>
          ${table([
            { label: "3rd Party", render: (r) => thirdPartyName(r.third_party_id) || "Not assigned" },
            { label: "Finalised", money: true, render: (r) => rupees(r.finalized_amount) },
            { label: "Advance", money: true, render: (r) => rupees(r.advance_amount) },
            { label: "Later Paid", money: true, render: (r) => rupees(projectThirdPartyPaidTotal(r.id)) },
            { label: "Payable", money: true, render: (r) => rupees(Number(r.finalized_amount || 0) - Number(r.advance_amount || 0) - projectThirdPartyPaidTotal(r.id)) },
          ], projectThirdParties)}
        </div>
      </div>
      <div class="split compact-split">
        <div>
          <h3>Customer Schedule</h3>
          ${table([
            { label: "Milestone", key: "milestone" },
            { label: "Due", key: "due_date" },
            { label: "Scheduled", money: true, render: (r) => rupees(r.scheduled_amount) },
            { label: "Actual", money: true, render: (r) => rupees(r.actual_received) },
            { label: "Status", key: "status" },
          ], schedules)}
        </div>
        <div>
          <h3>3rd Party Schedule</h3>
          ${table([
            { label: "3rd Party", render: (r) => projectThirdPartyName(r.project_third_party_id) },
            { label: "Due", key: "due_date" },
            { label: "Scheduled", money: true, render: (r) => rupees(r.scheduled_amount) },
            { label: "Actual", money: true, render: (r) => rupees(r.actual_paid) },
            { label: "Status", key: "status" },
          ], thirdPartySchedules)}
        </div>
      </div>
    </section>
  `;
}

function renderCustomers() {
  const term = customerSearch.trim().toLowerCase();
  const customers = state.customers.filter((item) => {
    const starts = String(item.name || "").toLowerCase().startsWith(term) || String(item.company || "").toLowerCase().startsWith(term);
    const haystack = `${item.name || ""} ${item.company || ""} ${item.contact_person || ""} ${item.phone || ""} ${item.city || ""} ${item.state || ""}`.toLowerCase();
    return !term || starts || haystack.includes(term);
  });
  document.getElementById("view-customers").innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h2>Customers</h2>
          <div class="actions"><button onclick="printSection('view-customers')">Print</button><button class="primary" onclick="openCustomerForm()">Add Customer</button></div>
        </div>
        <div class="toolbar">
          <input id="customer-search" placeholder="Type customer starting letter/name" value="${esc(customerSearch)}" oninput="setCustomerSearchLive(this.value)">
          <button onclick="clearCustomerSearch()">Clear</button>
        </div>
      ${table([
        { label: "Name", render: (r) => `<strong>${esc(r.name)}</strong><br>${esc(r.company || "")}<br><span class="muted">${esc(r.business_type || "")}</span>` },
        { label: "Contact", render: (r) => `${esc(r.contact_person || "")}<br>${esc(r.phone || "")}${r.alternate_phone ? " / " + esc(r.alternate_phone) : ""}` },
        { label: "Email", key: "email" },
        { label: "GST / PAN", render: (r) => `${esc(r.gstin || "")}<br>${esc(r.pan || "")}` },
        { label: "City", render: (r) => `${esc(r.city || "")} ${esc(r.state || "")}` },
        { label: "Action", render: (r) => `<div class="row-actions"><button onclick="downloadPdf('/api/reports/customer-accountability.pdf?customer_id=${r.id}', 'customer-accountability-${r.id}.pdf')">PDF</button><button onclick="openCustomerForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('customers', ${r.id}, 'Delete this customer? Existing projects must be deleted or moved first.')">Delete</button></div>` },
      ], customers)}
    </div>
  `;
}

function renderThirdParties() {
  const term = thirdPartySearch.trim().toLowerCase();
  const thirdParties = state.thirdParties.filter((item) => {
    const starts = String(item.name || "").toLowerCase().startsWith(term);
    const haystack = `${item.name || ""} ${item.category || ""} ${item.contact_person || ""} ${item.phone || ""} ${item.service_area || ""}`.toLowerCase();
    return !term || starts || haystack.includes(term);
  });
  document.getElementById("view-third-parties").innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h2>Third Parties</h2>
          <div class="actions"><button onclick="printSection('view-third-parties')">Print</button><button class="primary" onclick="openThirdPartyForm()">Add Third Party</button></div>
        </div>
        <div class="toolbar">
          <input id="third-party-search" placeholder="Type 3rd party starting letter/name" value="${esc(thirdPartySearch)}" oninput="setThirdPartySearchLive(this.value)">
          <button onclick="clearThirdPartySearch()">Clear</button>
        </div>
      ${table([
        { label: "Name", render: (r) => `<strong>${esc(r.name)}</strong><br><span class="pill">${esc(r.category)}</span>` },
        { label: "Contact", render: (r) => `${esc(r.contact_person || "")}<br>${esc(r.phone || "")}${r.alternate_phone ? " / " + esc(r.alternate_phone) : ""}` },
        { label: "Email", key: "email" },
        { label: "GST / PAN", render: (r) => `${esc(r.gstin || "")}<br>${esc(r.pan || "")}` },
        { label: "Area", key: "service_area" },
        { label: "Bank / UPI", key: "bank_details" },
        { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openThirdPartyForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('third-parties', ${r.id}, 'Delete this 3rd party? Linked project accounts must be deleted first.')">Delete</button></div>` },
      ], thirdParties)}
    </div>
  `;
}

function renderReceipts() {
  document.getElementById("view-receipts").innerHTML = `
    <div class="grid">
      <div class="panel">
        <div class="panel-head">
          <h2>Customer Receipts</h2>
          <div class="actions"><button onclick="printSection('view-receipts')">Print</button><button class="primary" onclick="openReceiptForm()">Add Receipt</button></div>
        </div>
      ${table([
        { label: "Date", key: "receipt_date" },
        { label: "Project", render: (r) => projectName(r.project_id) },
        { label: "Customer", render: (r) => customerName(r.customer_id) },
        { label: "Mode", key: "mode" },
        { label: "Reference", key: "reference_no" },
        { label: "Amount", money: true, render: (r) => rupees(r.amount) },
        { label: "Notes", key: "notes" },
        { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openReceiptForm(null, ${r.id})">Modify</button><button class="danger" onclick="deleteRecord('receipts', ${r.id})">Delete</button></div>` },
      ], state.receipts)}
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>Customer Payment Schedule</h2>
          <div class="actions"><button onclick="printSection('view-receipts')">Print</button><button class="primary" onclick="openCustomerScheduleForm()">Add Schedule</button></div>
        </div>
        ${table([
          { label: "Project", render: (r) => projectName(r.project_id) },
          { label: "Milestone", key: "milestone" },
          { label: "Due Date", key: "due_date" },
          { label: "Scheduled", money: true, render: (r) => rupees(r.scheduled_amount) },
          { label: "Actual Received", money: true, render: (r) => rupees(r.actual_received) },
          { label: "Received Date", key: "received_date" },
          { label: "Mode", key: "mode" },
          { label: "Status", key: "status" },
          { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openCustomerScheduleForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('customer-payment-schedules', ${r.id})">Delete</button></div>` },
        ], state.customerPaymentSchedules)}
      </div>
    </div>
  `;
}

function renderVendorAccounts() {
  document.getElementById("view-vendor-accounts").innerHTML = `
    <div class="grid">
      <div class="panel">
        <div class="panel-head">
          <h2>Project Third-Party Finalisation</h2>
          <div class="actions"><button onclick="printSection('view-vendor-accounts')">Print</button><button class="primary" onclick="openProjectThirdPartyForm()">Assign Third Party</button></div>
        </div>
        ${table([
          { label: "Project", render: (r) => projectName(r.project_id) },
          { label: "Third Party", render: (r) => thirdPartyName(r.third_party_id) },
          { label: "Scope", key: "work_scope" },
          { label: "Finalised", money: true, render: (r) => rupees(r.finalized_amount) },
          { label: "Advance", money: true, render: (r) => `${rupees(r.advance_amount)}<br>${displayValue(r.advance_date || "")}` },
          { label: "Status", render: (r) => `<span class="pill">${esc(r.status)}</span>` },
          { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openProjectThirdPartyForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('project-third-parties', ${r.id}, 'Delete this project-wise 3rd party account?')">Delete</button></div>` },
        ], state.projectThirdParties)}
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>Third-Party Payments</h2>
          <div class="actions"><button onclick="printSection('view-vendor-accounts')">Print</button><button class="primary" onclick="openThirdPartyPaymentForm()">Add Payment</button></div>
        </div>
        ${table([
          { label: "Date", key: "payment_date" },
          { label: "Account", render: (r) => projectThirdPartyName(r.project_third_party_id) },
          { label: "Mode", key: "mode" },
          { label: "Reference", key: "reference_no" },
          { label: "Amount", money: true, render: (r) => rupees(r.amount) },
          { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openThirdPartyPaymentForm(null, ${r.id})">Modify</button><button class="danger" onclick="deleteRecord('third-party-payments', ${r.id})">Delete</button></div>` },
        ], state.thirdPartyPayments)}
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>Third-Party Payment Schedule</h2>
          <div class="actions"><button onclick="printSection('view-vendor-accounts')">Print</button><button class="primary" onclick="openThirdPartyScheduleForm()">Add Schedule</button></div>
        </div>
        ${table([
          { label: "Project / 3rd Party", render: (r) => projectThirdPartyName(r.project_third_party_id) },
          { label: "Milestone", key: "milestone" },
          { label: "Due Date", key: "due_date" },
          { label: "Scheduled", money: true, render: (r) => rupees(r.scheduled_amount) },
          { label: "Actual Paid", money: true, render: (r) => rupees(r.actual_paid) },
          { label: "Paid Date", key: "paid_date" },
          { label: "Mode", key: "mode" },
          { label: "Status", key: "status" },
          { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openThirdPartyScheduleForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('third-party-payment-schedules', ${r.id})">Delete</button></div>` },
        ], state.thirdPartyPaymentSchedules)}
      </div>
    </div>
  `;
}

function renderCommunications() {
  document.getElementById("view-communications").innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Communication Notes</h2>
          <p class="muted">Add unlimited customer and 3rd-party follow-up notes project-wise until the project is closed.</p>
        </div>
        <div class="actions">
          <button onclick="printSection('view-communications')">Print</button>
          <button class="primary" onclick="openCommunicationNoteForm(null, selectedProjectId, 'Customer')">Add Communication</button>
        </div>
      </div>
      ${table([
        { label: "Project", render: (r) => projectName(r.project_id) },
        { label: "Date", key: "note_date" },
        { label: "Party Type", key: "party_type" },
        { label: "Party", render: (r) => esc(r.customer_name || r.third_party_name || "") },
        { label: "Contact", key: "contact_person" },
        { label: "Mode", key: "mode" },
        { label: "Subject", key: "subject" },
        { label: "Short Note", key: "note" },
        { label: "Follow-up", key: "next_followup_date" },
        { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openCommunicationNoteForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('communication-notes', ${r.id})">Delete</button></div>` },
      ], state.communicationNotes)}
    </div>
  `;
}

function renderDocuments() {
  document.getElementById("view-documents").innerHTML = `
    <div class="grid">
      <div class="panel">
        <div class="panel-head">
          <h2>Documents</h2>
          <div class="actions"><button onclick="printSection('view-documents')">Print</button><button onclick="openProjectDocumentForm()">Upload Document</button><button class="primary" onclick="openAgreementForm()">Add Document Record</button></div>
        </div>
      ${table([
        { label: "Document", render: (r) => `<strong>${esc(r.document_no || "")}</strong><br>${esc(r.agreement_type)}` },
        { label: "Project", render: (r) => projectName(r.project_id) },
        { label: "Parties", render: (r) => `${esc(r.party_one)}<br>${esc(r.party_two)}` },
        { label: "Date", key: "agreement_date" },
        { label: "Amount", money: true, render: (r) => rupees(r.finalized_amount) },
        { label: "Advance", money: true, render: (r) => rupees(r.advance_amount) },
        { label: "Status", render: (r) => `<span class="pill">${esc(r.status)}</span>` },
      ], state.agreements)}
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>Uploaded Project Documents</h2>
          <div class="actions"><button onclick="printSection('view-documents')">Print</button><button class="primary" onclick="openProjectDocumentForm()">Upload Document</button></div>
        </div>
        ${table([
          { label: "Project", render: (r) => projectName(r.project_id) },
          { label: "Type", key: "document_type" },
          { label: "Title", render: (r) => r.stored_path ? `<a href="/${esc(r.stored_path)}" target="_blank">${esc(r.title)}</a>` : esc(r.title) },
          { label: "Date", key: "document_date" },
          { label: "Reference", key: "reference_no" },
          { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openProjectDocumentForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('project-documents', ${r.id})">Delete</button></div>` },
        ], state.projectDocuments)}
      </div>
    </div>
  `;
}

function renderWip() {
  const customerRows = customerWipRows();
  document.getElementById("view-wip").innerHTML = `
    <div class="grid">
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>WIP Progress</h2>
            <p class="muted">Daily work progress for kitchen, civil, fabrication, installation, and other work.</p>
          </div>
          <div class="actions"><button onclick="printSection('view-wip')">Print</button><button class="primary" onclick="openWipForm()">Add Daily WIP</button></div>
        </div>
        ${table([
          { label: "Customer", key: "customer_name" },
          { label: "Projects", key: "projects" },
          { label: "Updates", key: "updates" },
          { label: "Average WIP", render: (r) => `${Math.round(r.avg_progress || 0)}%` },
          { label: "Latest Date", key: "latest_date" },
          { label: "Action", render: (r) => `<button onclick="showCustomerWip('${encodeURIComponent(r.customer_name)}')">Show Customer WIP</button>` },
        ], customerRows)}
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>Daily WIP Entries</h2>
          <button class="primary" onclick="openWipForm()">Add Row</button>
        </div>
        ${wipTable(state.wipUpdates)}
      </div>
    </div>
  `;
}

function renderReports() {
  document.getElementById("view-reports").innerHTML = `
    <div class="grid">
      <div class="panel">
        <div class="panel-head"><h2>Print And Excel Reports</h2><button onclick="printSection('view-reports')">Print</button></div>
        <p class="muted">Use print for current view, Excel for raw data, and PDF for structured customer/project accountability reports.</p>
        <div class="actions" style="margin-top:12px">
          <button onclick="downloadReport('/api/reports/projects.csv', 'brothers-project-report.csv')">Projects Excel</button>
          <button onclick="downloadReport('/api/reports/customers.csv', 'brothers-customers.csv')">Customers Excel</button>
          <button onclick="downloadReport('/api/reports/third-parties.csv', 'brothers-third-parties.csv')">Third Parties Excel</button>
          <button onclick="downloadReport('/api/reports/receipts.csv', 'brothers-customer-receipts.csv')">Customer Receipts Excel</button>
          <button onclick="downloadReport('/api/reports/vendor-payments.csv', 'brothers-third-party-payments.csv')">Vendor Payments Excel</button>
          <button onclick="downloadReport('/api/reports/customer-schedules.csv', 'brothers-customer-payment-schedule.csv')">Customer Schedule Excel</button>
          <button onclick="downloadReport('/api/reports/third-party-schedules.csv', 'brothers-third-party-payment-schedule.csv')">Third-Party Schedule Excel</button>
          <button onclick="printSection('view-reports')">Print Preview</button>
        </div>
      </div>
      <div class="panel">
        <h2>Customer Accountability PDF</h2>
        <p class="muted">Download customer-wise report with collections, project status, assigned/not assigned 3rd parties, advances, payments, schedules, and communication notes.</p>
        <div class="actions" style="margin-top:12px">
          ${state.customers.map((customer) => `<button onclick="downloadPdf('/api/reports/customer-accountability.pdf?customer_id=${customer.id}', 'customer-accountability-${customer.id}.pdf')">${esc(customer.name)} PDF</button>`).join("")}
        </div>
      </div>
      <div class="panel">
        <h2>Useful Modules Added From Project Accounting Apps</h2>
        <p class="muted">Project-wise ledgers, customer cumulative ledgers, customer receivable balance, third-party payable balance, payment mode tracking, documents, WIP progress, status reports, print/export, gross margin, vendor category cost, and audit-ready dates/references.</p>
      </div>
    </div>
  `;
}

function customerWipRows() {
  const grouped = new Map();
  state.wipUpdates.forEach((item) => {
    const key = item.customer_name || "Unknown Customer";
    if (!grouped.has(key)) {
      grouped.set(key, { customer_name: key, projects: new Set(), updates: 0, total_progress: 0, avg_progress: 0, latest_date: "" });
    }
    const row = grouped.get(key);
    row.projects.add(item.project_id);
    row.updates += 1;
    row.total_progress += Number(item.progress_percent || 0);
    if (!row.latest_date || item.update_date > row.latest_date) row.latest_date = item.update_date;
    row.avg_progress = row.total_progress / row.updates;
  });
  return Array.from(grouped.values()).map((row) => ({ ...row, projects: row.projects.size }));
}

function wipTable(items) {
  return table([
    { label: "Date", key: "update_date" },
    { label: "Customer", key: "customer_name" },
    { label: "Project", render: (r) => `${esc(r.project_no || "")}<br>${esc(r.project_name || projectName(r.project_id))}` },
    { label: "Work", render: (r) => `${esc(r.work_category)}<br>${esc(r.work_item)}` },
    { label: "Progress", render: (r) => `${esc(r.progress_percent)}%` },
    { label: "Qty", key: "quantity" },
    { label: "Manpower", key: "manpower" },
    { label: "Remarks", key: "remarks" },
    { label: "Next Action", key: "next_action" },
    { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openWipForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('wip-updates', ${r.id})">Delete</button></div>` },
  ], items);
}

function showCustomerWip(encodedCustomerName) {
  const customerNameText = decodeURIComponent(encodedCustomerName);
  const items = state.wipUpdates.filter((item) => item.customer_name === customerNameText);
  const projects = Array.from(new Set(items.map((item) => Number(item.project_id)))).map((projectId) => state.projects.find((project) => Number(project.id) === projectId)).filter(Boolean);
  const projectThirdParties = state.projectThirdParties.filter((item) => projects.some((project) => Number(project.id) === Number(item.project_id)));
  openModal(`${customerNameText} - WIP Progress`, `
    <div class="panel-head">
      <div><h2>${esc(customerNameText)} WIP</h2><p class="muted">${items.length} daily update(s)</p></div>
      <div class="actions"><button type="button" onclick="printSection('view-wip')">Print</button><button type="button" onclick="openWipForm()">Add WIP</button></div>
    </div>
    ${wipProgressPanel(projects[0] || null, items, projectThirdParties)}
    ${wipTable(items)}
    <div class="form-actions"><button type="button" onclick="document.getElementById('modal').close()">Close</button></div>
  `, async () => {});
}

function renderSettings() {
  document.getElementById("view-settings").innerHTML = `
    <div class="grid">
      <div class="panel">
        <div class="panel-head">
          <h2>Company Details / Print Settings</h2>
          <div class="actions"><button onclick="printSection('view-settings')">Print</button><button class="primary" onclick="openSettingsForm()">Modify Settings</button></div>
        </div>
        <div class="company-preview">
          <img src="${esc(companyLogo())}" alt="Company logo">
          <div>
            <strong>${esc(state.settings.company_name)}</strong>
            <span>${esc(state.settings.address)}</span>
          </div>
        </div>
        <div class="detail-grid">
          ${detail("Logo URL", state.settings.logo_url)}
          ${detail("Uploaded Logo", state.settings.logo_path)}
          ${detail("Print Name", state.settings.print_name)}
          ${detail("Company Name", state.settings.company_name)}
          ${detail("GSTIN", state.settings.gstin)}
          ${detail("Phone", state.settings.phone)}
          ${detail("Email", state.settings.email)}
          ${detail("Website", state.settings.website)}
          ${detail("Address", state.settings.address)}
          ${detail("Print Terms", state.settings.terms)}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>User ID / Password</h2>
          <div class="actions"><button onclick="printSection('view-settings')">Print</button><button class="primary" onclick="openUserForm()">Create User</button></div>
        </div>
        ${table([
          { label: "User ID", key: "username" },
          { label: "Name", key: "display_name" },
          { label: "Role", key: "role" },
          { label: "Action", render: (r) => `<button onclick="openUserForm(${r.id})">Modify</button><button class="danger" onclick="deleteRecord('users', ${r.id}, 'Delete this user?')">Delete</button>` },
        ], state.users)}
      </div>
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Data Backup / Restore</h2>
            <p class="muted">Backup includes SQLite accounts data, uploaded documents, and company logo files.</p>
          </div>
          <div class="actions">
            <button class="primary" onclick="downloadReport('/api/backup', 'team-brother-backup.zip')">Download Backup</button>
            <button class="danger" onclick="openRestoreForm()">Restore Backup</button>
          </div>
        </div>
        <div class="detail-grid">
          ${detail("Database", "data/brothers_project_accounts.db")}
          ${detail("Uploads", "data/uploads")}
          ${detail("Safety", "Restore creates a before-restore backup automatically")}
          ${detail("Use", "Settings > Download Backup before major edits")}
        </div>
      </div>
    </div>
  `;
}

function field(name, label, type = "text", value = "", options = null, full = false, required = false) {
  const requiredAttr = required ? " required" : "";
  if (options) {
    return `
      <label class="${full ? "full" : ""}">${label}
        <select name="${name}"${requiredAttr}>
          ${options.map((option) => `<option value="${esc(option.value ?? option)}" ${(option.value ?? option) == value ? "selected" : ""}>${esc(option.label ?? option)}</option>`).join("")}
        </select>
      </label>
    `;
  }
  if (type === "textarea") {
    return `<label class="${full ? "full" : ""}">${label}<textarea name="${name}"${requiredAttr}>${esc(value)}</textarea></label>`;
  }
  if (type === "file") {
    return `<label class="${full ? "full" : ""}">${label}<input name="${name}" type="file"${requiredAttr}></label>`;
  }
  return `<label class="${full ? "full" : ""}">${label}<input name="${name}" type="${type}" value="${esc(value)}"${requiredAttr}></label>`;
}

function readonlyField(name, label, value = "", full = false) {
  return `<label class="${full ? "full" : ""}">${label}<input name="${name}" type="text" value="${esc(value)}" readonly></label>`;
}

function dataListField(name, label, value = "", options = [], full = false) {
  const listId = `${name}-${Math.random().toString(36).slice(2)}-list`;
  return `
    <label class="${full ? "full" : ""}">${label}
      <input name="${name}" type="text" value="${esc(value)}" list="${listId}">
      <datalist id="${listId}">
        ${options.map((option) => `<option value="${esc(option)}"></option>`).join("")}
      </datalist>
    </label>
  `;
}

function hidden(name, value) {
  return `<input name="${name}" type="hidden" value="${esc(value)}">`;
}

function openModal(name, html, onSubmit) {
  const modal = document.getElementById("modal");
  document.getElementById("modal-title").textContent = name;
  document.getElementById("modal-body").innerHTML = html;
  const form = modal.querySelector("form");
  form.onsubmit = async (event) => {
    event.preventDefault();
    const payload = await formPayload(event.target);
    try {
      await onSubmit(payload);
      modal.close();
      await load();
    } catch (error) {
      alert(error.message || "Could not save this record.");
    }
  };
  if (!modal.open) modal.showModal();
}

async function formPayload(form) {
  const data = new FormData(form);
  const payload = {};
  for (const [key, value] of data.entries()) {
    if (value instanceof File) {
      if (value.size > 0) {
        payload.file_name = value.name;
        payload.file_data = await readFile(value);
      }
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formShell(fields) {
  return `<div class="form-grid">${fields}</div><div class="form-actions"><button type="button" onclick="document.getElementById('modal').close()">Cancel</button><button class="primary" type="submit">Save</button></div>`;
}

function formSection(title, fields) {
  return `<div class="form-section full"><h3>${esc(title)}</h3><div class="form-grid">${fields.join("")}</div></div>`;
}

function openCustomerForm(id = null) {
  const item = state.customers.find((r) => r.id === id) || {};
  openModal("Customer Details", formShell([
    dataListField("name", "Customer Name", item.name, state.customers.map((c) => c.name)),
    field("company", "Company / Hotel / Restaurant", "text", item.company),
    field("contact_person", "Contact Person", "text", item.contact_person),
    field("phone", "Mobile No (Required)", "tel", item.phone, null, false, true),
    field("alternate_phone", "Alternate Phone", "tel", item.alternate_phone),
    field("email", "Email", "email", item.email),
    field("gstin", "GSTIN", "text", item.gstin),
    field("pan", "PAN", "text", item.pan),
    dataListField("business_type", "Business Type", item.business_type, ["Hotel", "Restaurant", "Cafe", "Cloud Kitchen", "Caterer", "Hospital", "School", "College", "Corporate Canteen", "Factory Canteen", "Civil Client", "Contractor", "Other"]),
    dataListField("city", "City", item.city, indianCities),
    dataListField("state", "State", item.state, indianStates),
    field("address", "Address", "textarea", item.address, null, true),
    field("payment_terms", "Customer Payment Terms", "textarea", item.payment_terms, null, true),
    field("notes", "Notes", "textarea", item.notes, null, true),
  ].join("")), (payload) => save("customers", id, payload));
}

function openThirdPartyForm(id = null) {
  const item = state.thirdParties.find((r) => r.id === id) || {};
  openModal("Third-Party Details", formShell([
    dataListField("name", "Name", item.name, state.thirdParties.map((p) => p.name)),
    dataListField("category", "Category", item.category || "Vendor", vendorCategories),
    field("contact_person", "Contact Person", "text", item.contact_person),
    field("phone", "Mobile No (Required)", "tel", item.phone, null, false, true),
    field("alternate_phone", "Alternate Phone", "tel", item.alternate_phone),
    field("email", "Email", "email", item.email),
    field("gstin", "GSTIN", "text", item.gstin),
    field("pan", "PAN", "text", item.pan),
    dataListField("service_area", "Service Area / City", item.service_area, indianCities),
    field("payment_terms", "Third-Party Payment Terms", "textarea", item.payment_terms, null, true),
    field("bank_details", "Bank / UPI Details", "textarea", item.bank_details, null, true),
    field("address", "Address", "textarea", item.address, null, true),
    field("notes", "Notes", "textarea", item.notes, null, true),
  ].join("")), (payload) => save("third-parties", id, payload));
}

function openProjectForm(id = null) {
  const item = state.projects.find((r) => r.id === id) || {};
  const allProjectTypes = Array.from(new Set([...projectCategories, ...vendorCategories, "Kitchen Equipment", "Civil Material", "Labour Work", "Kitchen + Civil", "Electrical", "Plumbing"]));
  openModal("Project Details", formShell([
    formSection("Basic Project", [
      readonlyField("project_no", "Project No (Automatic)", item.project_no || nextProjectNo()),
      field("name", "Project Name", "text", item.name),
      field("customer_id", "Customer", "text", item.customer_id, state.customers.map((c) => ({ value: c.id, label: `${c.name} ${c.company ? "- " + c.company : ""}` }))),
      dataListField("project_category", "Project Type", item.project_category || "Commercial Kitchen", allProjectTypes),
      field("charge_type", "Charge Type", "text", item.charge_type || "Material + Labour", chargeTypes),
      field("status", "Status", "text", item.status || "Not Started", projectStatuses),
    ]),
    formSection("Amount Breakup", [
      field("finalized_amount", "Total Finalised Amount", "number", item.finalized_amount || 0),
      field("material_amount", "Material Charge", "number", item.material_amount || 0),
      field("labour_amount", "Labour Charge", "number", item.labour_amount || 0),
      field("other_amount", "Other Charge", "number", item.other_amount || 0),
    ]),
    formSection("Site And Contact", [
      dataListField("location", "Location / City", item.location, indianCities),
      field("contact_person", "Contact Person", "text", item.contact_person),
      field("contact_phone", "Contact Phone", "tel", item.contact_phone),
      field("contact_email", "Contact Email", "email", item.contact_email),
      field("site_address", "Project / Site Address", "textarea", item.site_address, null, true),
    ]),
    formSection("Dates And Scope", [
      field("start_date", "Start Date", "date", item.start_date),
      field("due_date", "Due Date", "date", item.due_date),
      field("product_scope", "Product / Work Scope", "textarea", item.product_scope, null, true),
      field("remarks", "Remarks", "textarea", item.remarks, null, true),
    ]),
  ].join("")), (payload) => save("projects", id, payload));
}

function openReceiptForm(projectId = null, id = null) {
  const item = state.receipts.find((r) => r.id === id) || {};
  const project = state.projects.find((p) => Number(p.id) === Number(item.project_id || projectId || selectedProjectId)) || {};
  openModal("Customer Receipt", formShell([
    formSection("Project And Customer", [
      field("project_id", "Project", "text", item.project_id || project.id || "", state.projects.map((p) => ({ value: p.id, label: `${p.project_no} - ${p.name}` }))),
      field("customer_id", "Customer", "text", item.customer_id || project.customer_id || "", state.customers.map((c) => ({ value: c.id, label: c.name }))),
    ]),
    formSection("Receipt Details", [
      field("receipt_date", "Receipt Date", "date", item.receipt_date || today()),
      field("amount", "Amount", "number", item.amount || 0),
      field("mode", "Payment Mode", "text", item.mode || "UPI", paymentModes),
      field("reference_no", "Reference / Cheque No", "text", item.reference_no || ""),
      field("notes", "Notes", "textarea", item.notes || "", null, true),
    ]),
  ].join("")), (payload) => save("receipts", id, payload));
}

function openProjectThirdPartyForm(id = null, projectId = null) {
  const item = state.projectThirdParties.find((r) => r.id === id) || { project_id: projectId || selectedProjectId };
  openModal("Project-Wise 3rd Party Account", formShell([
    formSection("Link 3rd Party With Customer Project", [
      field("project_id", "Customer Project", "text", item.project_id || "", state.projects.map((p) => ({ value: p.id, label: `${p.project_no} - ${p.name} | ${customerName(p.customer_id)}` }))),
      field("third_party_id", "Select 3rd Party Name", "text", item.third_party_id || "", state.thirdParties.map((p) => ({ value: p.id, label: `${p.name} - ${p.category}` }))),
      field("status", "Status", "text", item.status || "Assigned", ["Assigned", "In Progress", "Completed", "Hold", "Closed"]),
    ]),
    formSection("Amount And Scope", [
      field("finalized_amount", "Amount Finalised With 3rd Party", "number", item.finalized_amount || 0),
      field("advance_amount", "Advance Given To 3rd Party", "number", item.advance_amount || 0),
      field("advance_date", "Advance Date", "date", item.advance_date || today()),
      field("work_scope", "Work Scope For This Same Work", "textarea", item.work_scope || "", null, true),
      field("notes", "Accountability Notes", "textarea", item.notes || "", null, true),
    ]),
  ].join("")), (payload) => save("project-third-parties", id, payload));
}

function openThirdPartyPaymentForm(projectId = null, id = null) {
  const item = state.thirdPartyPayments.find((r) => r.id === id) || {};
  const selectedAccounts = state.projectThirdParties.filter((pt) => !projectId || Number(pt.project_id) === Number(projectId) || Number(pt.id) === Number(item.project_third_party_id));
  openModal("Third-Party Payment", formShell([
    formSection("Select Project-Wise 3rd Party", [
      field("project_third_party_id", "Project-Wise 3rd Party Account", "text", item.project_third_party_id || "", selectedAccounts.map((pt) => ({ value: pt.id, label: projectThirdPartyName(pt.id) }))),
    ]),
    formSection("Payment Given", [
      field("payment_date", "Payment Date", "date", item.payment_date || today()),
      field("amount", "Amount", "number", item.amount || 0),
      field("mode", "Payment Mode", "text", item.mode || "UPI", paymentModes),
      field("reference_no", "Reference / Cheque No", "text", item.reference_no || ""),
      field("notes", "Notes", "textarea", item.notes || "", null, true),
    ]),
  ].join("")), (payload) => save("third-party-payments", id, payload));
}

function openCustomerScheduleForm(id = null, projectId = null) {
  const item = state.customerPaymentSchedules.find((r) => r.id === id) || { project_id: projectId || selectedProjectId };
  openModal("Customer Payment Schedule", formShell([
    field("project_id", "Project", "text", item.project_id, state.projects.map((p) => ({ value: p.id, label: `${p.project_no} - ${p.name}` }))),
    field("milestone", "Payment Stage / Milestone", "text", item.milestone),
    field("due_date", "Due Date", "date", item.due_date),
    field("scheduled_amount", "Schedule Amount", "number", item.scheduled_amount || 0),
    field("actual_received", "Actual Received", "number", item.actual_received || 0),
    field("received_date", "Received Date", "date", item.received_date),
    field("mode", "Mode", "text", item.mode || "UPI", paymentModes),
    field("reference_no", "Reference / Cheque No", "text", item.reference_no),
    field("status", "Status", "text", item.status || "Pending", ["Pending", "Part Received", "Received", "Overdue", "Cancelled"]),
    field("notes", "Notes", "textarea", item.notes, null, true),
  ].join("")), (payload) => save("customer-payment-schedules", id, payload));
}

function openThirdPartyScheduleForm(id = null) {
  const item = state.thirdPartyPaymentSchedules.find((r) => r.id === id) || {};
  const selectedAccounts = state.projectThirdParties.filter((pt) => !selectedProjectId || Number(pt.project_id) === Number(selectedProjectId));
  openModal("Third-Party Payment Schedule", formShell([
    field("project_third_party_id", "Project Third-Party Account", "text", item.project_third_party_id, selectedAccounts.map((pt) => ({ value: pt.id, label: projectThirdPartyName(pt.id) }))),
    field("milestone", "Payment Stage / Milestone", "text", item.milestone),
    field("due_date", "Due Date", "date", item.due_date),
    field("scheduled_amount", "Schedule Amount", "number", item.scheduled_amount || 0),
    field("actual_paid", "Actual Paid", "number", item.actual_paid || 0),
    field("paid_date", "Paid Date", "date", item.paid_date),
    field("mode", "Mode", "text", item.mode || "UPI", paymentModes),
    field("reference_no", "Reference / Cheque No", "text", item.reference_no),
    field("status", "Status", "text", item.status || "Pending", ["Pending", "Part Paid", "Paid", "Overdue", "Cancelled"]),
    field("notes", "Notes", "textarea", item.notes, null, true),
  ].join("")), (payload) => save("third-party-payment-schedules", id, payload));
}

function openProjectDocumentForm(id = null, projectId = null) {
  const item = state.projectDocuments.find((r) => r.id === id) || { project_id: projectId || selectedProjectId };
  openModal("Project Document", formShell([
    field("project_id", "Project", "text", item.project_id, state.projects.map((p) => ({ value: p.id, label: `${p.project_no} - ${p.name}` }))),
    field("document_type", "Document Type", "text", item.document_type || "Agreement", documentTypes),
    field("title", "Document Title", "text", item.title),
    field("document_date", "Document Date", "date", item.document_date || today()),
    field("reference_no", "Reference No", "text", item.reference_no),
    field("upload_file", "Upload File", "file", ""),
    hidden("file_name", item.file_name || "") + hidden("stored_path", item.stored_path || ""),
    field("notes", "Notes", "textarea", item.notes, null, true),
  ].join("")), (payload) => save("project-documents", id, payload));
}

function openWipForm(id = null, projectId = null) {
  const item = state.wipUpdates.find((r) => r.id === id) || { project_id: projectId || selectedProjectId };
  openModal("Daily WIP Progress", formShell([
    formSection("Project And Work", [
      field("project_id", "Project", "text", item.project_id || "", state.projects.map((p) => ({ value: p.id, label: `${p.project_no} - ${p.name} | ${customerName(p.customer_id)}` }))),
      field("update_date", "Update Date", "date", item.update_date || today()),
      field("work_category", "Work Category", "text", item.work_category || "Kitchen", ["Kitchen", "Civil", "Fabrication", "Installation", "Trading", "Electrical", "Gas Pipeline", "Ducting", "Other"]),
      field("work_item", "Work Item", "text", item.work_item || ""),
    ]),
    formSection("Progress Details", [
      field("progress_percent", "Completed Till Date (%)", "number", item.progress_percent || 0),
      field("quantity", "Quantity / Area / Nos", "text", item.quantity || ""),
      field("manpower", "Manpower / Team", "text", item.manpower || ""),
      field("remarks", "Daily Remarks", "textarea", item.remarks || "", null, true),
      field("next_action", "Next Action", "textarea", item.next_action || "", null, true),
    ]),
  ].join("")), (payload) => save("wip-updates", id, payload));
}

function openCommunicationNoteForm(id = null, projectId = null, partyType = "Customer") {
  const item = state.communicationNotes.find((r) => r.id === id) || { project_id: projectId || selectedProjectId, party_type: partyType };
  const project = state.projects.find((p) => Number(p.id) === Number(item.project_id || selectedProjectId));
  const projectThirdParties = state.projectThirdParties.filter((pt) => Number(pt.project_id) === Number(item.project_id || selectedProjectId));
  const thirdPartyOptions = projectThirdParties.map((pt) => ({ value: pt.third_party_id, label: thirdPartyName(pt.third_party_id) }));
  openModal("Communication Short Note", formShell([
    field("project_id", "Project", "text", item.project_id, state.projects.map((p) => ({ value: p.id, label: `${p.project_no} - ${p.name}` }))),
    field("party_type", "Party Type", "text", item.party_type || partyType, ["Customer", "Third Party"]),
    field("customer_id", "Customer", "text", item.customer_id || project?.customer_id || "", state.customers.map((c) => ({ value: c.id, label: c.name }))),
    field("third_party_id", "Third Party", "text", item.third_party_id || "", [{ value: "", label: "Not applicable" }, ...thirdPartyOptions]),
    field("note_date", "Date", "date", item.note_date || today()),
    field("contact_person", "Contact Person", "text", item.contact_person || project?.contact_person || ""),
    field("mode", "Communication Mode", "text", item.mode || "Call", communicationModes),
    field("subject", "Subject", "text", item.subject || ""),
    field("note", "Short Note", "textarea", item.note || "", null, true),
    field("next_followup_date", "Next Follow-up Date", "date", item.next_followup_date || ""),
  ].join("")), (payload) => {
    if (payload.party_type === "Customer") payload.third_party_id = "";
    if (payload.party_type === "Third Party") payload.customer_id = "";
    return save("communication-notes", id, payload);
  });
}

function openAgreementForm() {
  openModal("Document Record", formShell([
    field("project_id", "Project", "text", "", state.projects.map((p) => ({ value: p.id, label: `${p.project_no} - ${p.name}` }))),
    field("agreement_type", "Document Type", "text", "Customer Agreement", agreementTypes),
    field("party_one", "Party One", "text", state.business.name),
    field("party_two", "Party Two", "text", ""),
    field("agreement_date", "Document Date", "date", today()),
    field("document_no", "Document No", "text", ""),
    field("finalized_amount", "Finalised Amount", "number", 0),
    field("advance_amount", "Advance Amount", "number", 0),
    field("status", "Status", "text", "Draft", ["Draft", "Signed", "Active", "Completed", "Cancelled"]),
    field("terms", "Terms", "textarea", "", null, true),
  ].join("")), (payload) => save("agreements", null, payload));
}

function openSettingsForm() {
  const item = state.settings;
  openModal("Company Details / Print Settings", formShell([
    field("print_name", "Print Short Name", "text", item.print_name),
    field("company_name", "Company Name", "text", item.company_name),
    field("gstin", "GSTIN", "text", item.gstin),
    field("phone", "Phone No", "text", item.phone),
    field("email", "Mail ID", "email", item.email),
    field("website", "Website", "text", item.website),
    field("logo_url", "Logo URL", "text", item.logo_url || defaultLogo),
    field("logo_file", "Upload Logo", "file", ""),
    hidden("logo_path", item.logo_path || ""),
    field("address", "Address", "textarea", item.address, null, true),
    field("terms", "Print Terms / Footer", "textarea", item.terms, null, true),
  ].join("")), (payload) => api("/api/settings", { method: "PUT", body: JSON.stringify(payload) }));
}

function openRestoreForm() {
  openModal("Restore Backup", formShell([
    formSection("Select Backup File", [
      field("backup_file", "Backup ZIP / Database DB File", "file", ""),
    ]),
    formSection("Important", [
      `<div class="full restore-warning">Restore accepts Team Brother backup ZIP or brothers_project_accounts.db. It will replace current accounts data and create a safety backup first.</div>`,
    ]),
  ].join("")), async (payload) => {
    if (!confirm("Restore backup now? Current data will be replaced after creating a safety backup.")) return;
    const result = await api("/api/restore", { method: "POST", body: JSON.stringify(payload) });
    if (result.pending_restart) {
      alert(`${result.message}\n\nStep 1: Close this app window/server.\nStep 2: Start the app again.\nStep 3: The restore will apply automatically.`);
      return;
    }
    alert(`Restore completed. Safety backup: ${result.safety_backup}`);
  });
}

function openUserForm(id = null) {
  const item = state.users.find((r) => r.id === id) || {};
  openModal(id ? "Modify User" : "Create User", formShell([
    field("username", "User ID", "text", item.username),
    field("display_name", "Display Name", "text", item.display_name),
    field("role", "Role", "text", item.role || "Staff", ["Admin", "Accounts", "Project", "Staff"]),
    field("password", id ? "New Password (optional)" : "Password", "password", ""),
  ].join("")), (payload) => save("users", id, payload));
}

async function openLedger(projectId, ledgerType = "combined") {
  const ledger = await api(`/api/project-ledger?project_id=${projectId}`);
  const f = ledger.finance;
  const receiptsInRange = filterByDate(ledger.receipts, "receipt_date");
  const receivedInRange = receiptsInRange.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const showCustomer = ledgerType === "customer" || ledgerType === "combined";
  const showThirdParty = ledgerType === "third-party" || ledgerType === "combined";
  const titleText = ledgerType === "customer" ? "Customer Ledger" : ledgerType === "third-party" ? "Third-Party Ledger" : "Combined Ledger";
  openModal(`${titleText} / Print Preview`, `
    <div class="print-company">
      <img class="print-logo" src="${esc(companyLogo())}" alt="Company logo">
      <div>
        <h2>${esc(ledger.settings.print_name)} - ${esc(ledger.settings.company_name)}</h2>
        <p>${esc(ledger.settings.address)} | ${esc(ledger.settings.phone)} | ${esc(ledger.settings.email)}</p>
      </div>
    </div>
    <div class="ledger-title">
      <div>
        <h2>${esc(titleText)}: ${esc(ledger.project.project_no)} - ${esc(ledger.project.name)}</h2>
        <p class="muted">${esc(ledger.project.customer_name)} | ${esc(ledger.project.location || "")} | ${esc(ledger.project.contact_person || "")} ${esc(ledger.project.contact_phone || "")}</p>
        <p class="muted">${esc(ledger.project.project_category || "")} | ${esc(ledger.project.charge_type || "")}</p>
        <p class="muted">Payment received period: ${esc(dateRangeText())}</p>
      </div>
      <div class="actions">
        <button onclick="downloadPdf('/api/reports/project-ledger.pdf?project_id=${projectId}', 'project-ledger-${projectId}.pdf')" type="button">Print</button>
        <button onclick="downloadPdf('/api/reports/project-ledger.pdf?project_id=${projectId}', 'project-ledger-${projectId}.pdf')" type="button">PDF</button>
        <button onclick="openLedger(${projectId}, 'customer')" type="button">Customer</button>
        <button onclick="openLedger(${projectId}, 'third-party')" type="button">3rd Party</button>
        <button onclick="openLedger(${projectId}, 'combined')" type="button">Both</button>
      </div>
    </div>
    <div class="grid stats">
      ${stat("Finalised", rupees(f.finalized_amount))}
      ${stat("Material", rupees(ledger.project.material_amount))}
      ${stat("Labour", rupees(ledger.project.labour_amount))}
      ${stat("Other", rupees(ledger.project.other_amount))}
      ${showCustomer ? stat("Received", rupees(f.received_amount)) : ""}
      ${showCustomer ? stat(`Received ${dateRangeText()}`, rupees(receivedInRange)) : ""}
      ${showCustomer ? stat("Customer Balance", rupees(f.customer_balance)) : ""}
      ${showThirdParty ? stat("Third-Party Finalised", rupees(f.third_party_finalized)) : ""}
      ${showThirdParty ? stat("Third-Party Paid", rupees(f.third_party_paid)) : ""}
      ${stat("Gross Margin", rupees(f.gross_margin))}
    </div>
    <div class="grid" style="margin-top:14px">
      ${showCustomer ? `<div class="panel"><div class="panel-head compact"><h3>Customer Receipts (${esc(dateRangeText())})</h3><button onclick="downloadPdf('/api/reports/project-ledger.pdf?project_id=${projectId}', 'project-ledger-${projectId}.pdf')" type="button">Print</button></div>${table([
        { label: "Date", key: "receipt_date" },
        { label: "Mode", key: "mode" },
        { label: "Reference", key: "reference_no" },
        { label: "Amount", money: true, render: (r) => rupees(r.amount) },
        { label: "Notes", key: "notes" },
        { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openReceiptForm(${projectId}, ${r.id})" type="button">Modify</button><button class="danger" onclick="deleteRecord('receipts', ${r.id})" type="button">Delete</button></div>` },
      ], receiptsInRange)}</div>` : ""}
      ${showCustomer ? `<div class="panel"><div class="panel-head compact"><h3>Customer Payment Schedule</h3><button onclick="downloadPdf('/api/reports/project-ledger.pdf?project_id=${projectId}', 'project-ledger-${projectId}.pdf')" type="button">Print</button></div>${table([
        { label: "Milestone", key: "milestone" },
        { label: "Due", key: "due_date" },
        { label: "Schedule", money: true, render: (r) => rupees(r.scheduled_amount) },
        { label: "Actual Received", money: true, render: (r) => rupees(r.actual_received) },
        { label: "Status", key: "status" },
        { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openCustomerScheduleForm(${r.id}, ${projectId})" type="button">Modify</button><button class="danger" onclick="deleteRecord('customer-payment-schedules', ${r.id})" type="button">Delete</button></div>` },
      ], ledger.customerPaymentSchedules)}</div>` : ""}
      ${showThirdParty ? `<div class="panel"><div class="panel-head compact"><h3>Third-Party Accounts</h3><button onclick="downloadPdf('/api/reports/project-ledger.pdf?project_id=${projectId}', 'project-ledger-${projectId}.pdf')" type="button">Print</button></div>${table([
        { label: "Name", key: "name" },
        { label: "Category", key: "category" },
        { label: "Scope", key: "work_scope" },
        { label: "Finalised", money: true, render: (r) => rupees(r.finalized_amount) },
        { label: "Advance", money: true, render: (r) => rupees(r.advance_amount) },
        { label: "Later Paid", money: true, render: (r) => rupees(projectThirdPartyPaidTotal(r.id)) },
        { label: "Balance", money: true, render: (r) => rupees(r.balance) },
      ], ledger.thirdParties)}</div>` : ""}
      ${showThirdParty ? `<div class="panel"><div class="panel-head compact"><h3>Third-Party Payment Given Details</h3><button onclick="openThirdPartyPaymentForm(${projectId})" type="button">Add Payment</button></div>${table([
        { label: "Date", key: "payment_date" },
        { label: "Third Party", key: "third_party_name" },
        { label: "Mode", key: "mode" },
        { label: "Reference", key: "reference_no" },
        { label: "Amount", money: true, render: (r) => rupees(r.amount) },
        { label: "Notes", key: "notes" },
        { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openThirdPartyPaymentForm(${projectId}, ${r.id})" type="button">Modify</button><button class="danger" onclick="deleteRecord('third-party-payments', ${r.id})" type="button">Delete</button></div>` },
      ], ledger.thirdPartyPayments)}</div>` : ""}
      ${showThirdParty ? `<div class="panel"><div class="panel-head compact"><h3>Third-Party Payment Schedule</h3><button onclick="downloadPdf('/api/reports/project-ledger.pdf?project_id=${projectId}', 'project-ledger-${projectId}.pdf')" type="button">Print</button></div>${table([
        { label: "Third Party", key: "third_party_name" },
        { label: "Milestone", key: "milestone" },
        { label: "Due", key: "due_date" },
        { label: "Schedule", money: true, render: (r) => rupees(r.scheduled_amount) },
        { label: "Actual Paid", money: true, render: (r) => rupees(r.actual_paid) },
        { label: "Status", key: "status" },
        { label: "Action", render: (r) => `<div class="row-actions"><button onclick="openThirdPartyScheduleForm(${r.id})" type="button">Modify</button><button class="danger" onclick="deleteRecord('third-party-payment-schedules', ${r.id})" type="button">Delete</button></div>` },
      ], ledger.thirdPartyPaymentSchedules)}</div>` : ""}
      <div class="panel"><h3>Documents</h3>${table([
        { label: "Document", key: "document_no" },
        { label: "Type", key: "agreement_type" },
        { label: "Parties", render: (r) => `${esc(r.party_one)}<br>${esc(r.party_two)}` },
        { label: "Status", key: "status" },
      ], ledger.agreements)}</div>
      <div class="panel"><h3>Documents</h3>${table([
        { label: "Type", key: "document_type" },
        { label: "Title", render: (r) => r.stored_path ? `<a href="/${esc(r.stored_path)}" target="_blank">${esc(r.title)}</a>` : esc(r.title) },
        { label: "Date", key: "document_date" },
        { label: "Reference", key: "reference_no" },
      ], ledger.documents)}</div>
      <div class="panel"><h3>Communication Notes</h3>${communicationNotesTable(ledger.communicationNotes || [])}</div>
    </div>
    <p class="muted print-terms">${esc(ledger.settings.terms || "")}</p>
    <div class="form-actions"><button type="button" onclick="document.getElementById('modal').close()">Close</button></div>
  `, async () => {});
}

async function save(resource, id, payload) {
  await api(`/api/${resource}${id ? "/" + id : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });
}

async function setProjectStatus(id, status) {
  const project = state.projects.find((item) => Number(item.id) === Number(id));
  if (!project) return;
  const message = status === "Closed" ? "Mark this project as closed?" : "Reopen this project for future work?";
  if (!confirm(message)) return;
  try {
    await save("projects", id, { ...project, status });
    if (Number(selectedProjectId) === Number(id)) selectedProjectId = null;
    if (Number(dashboardSelectedProjectId) === Number(id)) dashboardSelectedProjectId = null;
    dashboardProjectFilter = status === "Closed" ? "closed" : "active";
    projectStatusFilter = status === "Closed" ? "closed" : "active";
    await load();
  } catch (error) {
    alert(error.message || "Could not update project status.");
  }
}

async function deleteRecord(resource, id, message = "Delete this record?") {
  if (!confirm(message)) return;
  try {
    await api(`/api/${resource}/${id}`, { method: "DELETE" });
    if (resource === "projects" && Number(selectedProjectId) === Number(id)) selectedProjectId = null;
    await load();
  } catch (error) {
    alert(error.message || "Could not delete this record. It may be linked with another account.");
  }
}

async function downloadReport(path, filename) {
  const response = await fetch(path, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
  if (response.status === 401) {
    showLogin("Please sign in again to export.");
    return;
  }
  if (!response.ok) {
    alert("Could not export this report.");
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadPdf(path, filename) {
  const response = await fetch(path, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
  if (response.status === 401) {
    showLogin("Please sign in again to preview PDF.");
    return;
  }
  if (!response.ok) {
    alert("Could not preview this PDF.");
    return;
  }
  if (currentPdfPreviewUrl) URL.revokeObjectURL(currentPdfPreviewUrl);
  const blob = await response.blob();
  currentPdfPreviewUrl = URL.createObjectURL(blob);
  currentPdfPreviewFilename = filename;
  openPdfPreview(filename);
}

function openPdfPreview(filename) {
  const modal = document.getElementById("modal");
  document.getElementById("modal-title").textContent = "PDF Preview";
  document.getElementById("modal-body").innerHTML = `
    <div class="pdf-preview-actions">
      <strong>${esc(filename)}</strong>
      <div class="actions">
        <button type="button" onclick="printPdfPreview()">Print</button>
        <button type="button" onclick="downloadCurrentPdf()">Download</button>
        <button type="button" onclick="document.getElementById('modal').close()">Close</button>
      </div>
    </div>
    <iframe id="pdf-preview-frame" class="pdf-preview-frame" src="${currentPdfPreviewUrl}"></iframe>
  `;
  modal.querySelector("form").onsubmit = (event) => event.preventDefault();
  if (!modal.open) modal.showModal();
}

function printPdfPreview() {
  const frame = document.getElementById("pdf-preview-frame");
  if (frame?.contentWindow) {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }
}

function downloadCurrentPdf() {
  if (!currentPdfPreviewUrl) return;
  const link = document.createElement("a");
  link.href = currentPdfPreviewUrl;
  link.download = currentPdfPreviewFilename || "report.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadCustomerPdfByName(encodedCustomerName) {
  const customerNameText = decodeURIComponent(encodedCustomerName);
  const customer = state.customers.find((item) => item.name === customerNameText);
  if (!customer) {
    alert("Customer not found for PDF.");
    return;
  }
  downloadPdf(`/api/reports/customer-accountability.pdf?customer_id=${customer.id}`, `customer-accountability-${customer.id}.pdf`);
}

function customerName(id) {
  return state.customers.find((c) => Number(c.id) === Number(id))?.name || "";
}

function thirdPartyName(id) {
  return state.thirdParties.find((c) => Number(c.id) === Number(id))?.name || "";
}

function projectName(id) {
  const p = state.projects.find((item) => Number(item.id) === Number(id));
  return p ? `${p.project_no} - ${p.name}` : "";
}

function projectThirdPartyName(id) {
  const pt = state.projectThirdParties.find((item) => Number(item.id) === Number(id));
  return pt ? `${projectName(pt.project_id)} | ${thirdPartyName(pt.third_party_id)}` : "";
}

function nextProjectNo() {
  const year = new Date().getFullYear();
  const maxNo = state.projects.reduce((max, project) => {
    const match = String(project.project_no || "").match(new RegExp(`^BEE-${year}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1] || 0)) : max;
  }, 0);
  const next = String(maxNo + 1).padStart(3, "0");
  return `BEE-${year}-${next}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

document.querySelectorAll(".nav").forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    render();
  });
});

document.getElementById("login-form").addEventListener("submit", signIn);

window.addEventListener("beforeprint", () => {
  if (document.getElementById("modal").open) document.body.classList.add("modal-print");
});

window.addEventListener("afterprint", () => {
  document.body.classList.remove("modal-print", "print-single");
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("print-target"));
});

boot().catch((error) => {
  showLogin(error.message);
});
