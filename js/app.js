(() => {
  "use strict";

  const STORAGE_KEY = "scout-record-session";
  const TAB_KEY = "scout-record-tab";

  const STATUS_LABELS = {
    completed: "已完成",
    in_progress: "進行中",
    not_started: "尚未開始",
  };

  const BADGE_ICONS = {
    discovery: "assets/badge-discovery.png",
    standard: "assets/badge-standard.png",
    advanced: "assets/badge-advanced.png",
    chief: "assets/badge-chief.png",
    探索獎章: "assets/badge-discovery.png",
    標準獎章: "assets/badge-standard.png",
    高級獎章: "assets/badge-advanced.png",
    總領袖獎章: "assets/badge-chief.png",
  };

  const ATTENDANCE_LABELS = {
    present: "出席",
    absent: "缺席",
  };

  const ADMIN_ACCOUNTS = [
    {
      name: "李載禧",
      scoutId: "P@ssw0rd",
      role: "admin",
      photo: "assets/members/li-zaihei.png",
    },
    {
      name: "黃子峰",
      scoutId: "0106",
      role: "admin",
      photo: "assets/members/huang-zifeng.png",
    },
    {
      name: "林芷窰",
      scoutId: "63008686",
      role: "admin",
      photo: "assets/members/lin-zhiyao.png",
    },
    {
      name: "吳承軒",
      scoutId: "Ryan1363",
      role: "admin",
      photo: "assets/members/wu-chengxuan.png",
    },
    {
      name: "吳溢潼",
      scoutId: "260724",
      role: "admin",
      photo: "assets/members/wu-yitong.png",
    },
  ];

  const DEMO_SCOUT_IDS = new Set([
    "2025000101",
    "2025000102",
    "2025000103",
  ]);

  const ADMIN_TAB_KEY = "scout-record-admin-tab";
  const ADMIN_YEAR_KEY = "scout-record-admin-year";
  const ADMIN_PROG_ZOOM_KEY = "scout-record-admin-prog-zoom";
  const ADMIN_PROG_ZOOM_MIN = 0.5;
  const ADMIN_PROG_ZOOM_MAX = 1.5;
  const ADMIN_PROG_ZOOM_STEP = 0.1;

  /** 學年：每年 9/1 至翌年 8/31（含） */
  const ACADEMIC_YEARS = [
    { id: "2024-2025", label: "2024-2025年度", start: "2024-09-01", end: "2025-08-31" },
    { id: "2025-2026", label: "2025-2026年度", start: "2025-09-01", end: "2026-08-31" },
    { id: "2026-2027", label: "2026-2027年度", start: "2026-09-01", end: "2027-08-31" },
  ];

  const SECTION_ORDER = [
    "Cobra小隊",
    "Eagle小隊",
    "Falcon小隊",
    "Otter小隊",
    "新成員",
  ];

  const PROG_OVERVIEW_BADGES = [
    { key: "discovery", short: "探索", label: "探索獎章", icon: "assets/badge-discovery.png" },
    { key: "standard", short: "標準", label: "標準獎章", icon: "assets/badge-standard.png" },
    { key: "advanced", short: "高級", label: "高級獎章", icon: "assets/badge-advanced.png" },
    { key: "chief", short: "總領袖", label: "總領袖獎章", icon: "assets/badge-chief.png" },
  ];

  /** 全體出席率只計四隊；「新成員」及其他 section 不進分子／分母 */
  const OVERALL_RATE_SECTIONS = new Set(
    SECTION_ORDER.filter((s) => s !== "新成員")
  );

  const RANK_ORDER = {
    團隊長: 0,
    隊長: 1,
    副隊: 2,
    副隊長: 2,
    隊員: 3,
    成員: 3,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const loginView = $("#login-view");
  const dashboardView = $("#dashboard-view");
  const adminView = $("#admin-view");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const logoutBtn = $("#logout-btn");
  const adminLogoutBtn = $("#admin-logout-btn");
  const adminPreviewBar = $("#admin-preview-bar");

  let members = [];
  let resources = null;
  let syllabus = null;
  let specialtySyllabus = null;
  let specialtyGallery = null;
  let currentMember = null;
  let isAdminSession = false;
  let adminSelectedDate = null;
  let adminSelectedYear = null;
  let adminMeetingDates = [];
  let adminChartAnimFrames = new Set();
  let adminProgOverviewBadgeKey = "discovery";
  let adminProgOverviewZoom = 1;

  /* ---------- Data ---------- */

  async function loadData() {
    const [membersRes, syllabusRes, specialtyRes, galleryRes] = await Promise.all([
      fetch("data/members.json", { cache: "no-store" }),
      fetch("data/progressive-syllabus.json", { cache: "no-store" }),
      fetch("data/specialty-syllabus.json", { cache: "no-store" }),
      fetch("data/specialty-gallery.json", { cache: "no-store" }),
    ]);
    if (!membersRes.ok) throw new Error("無法載入成員資料");
    if (!syllabusRes.ok) throw new Error("無法載入獎章綱要");
    if (!specialtyRes.ok) throw new Error("無法載入專科徽章綱要");
    if (!galleryRes.ok) throw new Error("無法載入專科徽章圖鑑");
    const data = await membersRes.json();
    members = data.members || [];
    resources = data.resources || null;
    syllabus = await syllabusRes.json();
    specialtySyllabus = await specialtyRes.json();
    specialtyGallery = await galleryRes.json();
  }

  function findMember(name, scoutId) {
    const n = name.trim();
    const id = scoutId.trim().toUpperCase();
    return members.find(
      (m) => m.name === n && m.scoutId.toUpperCase() === id
    );
  }

  function findAdminAccount(name, scoutId) {
    const n = name.trim();
    const id = scoutId.trim().toUpperCase();
    return ADMIN_ACCOUNTS.find(
      (a) => a.name === n && String(a.scoutId).toUpperCase() === id
    );
  }

  function isAdminCredentials(name, scoutId) {
    return !!findAdminAccount(name, scoutId);
  }

  /* ---------- Session ---------- */

  function saveSession(member) {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        name: member.name,
        scoutId: member.scoutId,
        role: member.role || "member",
      })
    );
  }

  function saveAdminSession(admin) {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        name: admin.name,
        scoutId: admin.scoutId,
        role: "admin",
      })
    );
  }

  function clearSession() {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TAB_KEY);
    sessionStorage.removeItem(ADMIN_TAB_KEY);
    sessionStorage.removeItem(ADMIN_YEAR_KEY);
    isAdminSession = false;
    exitAdminMemberPreview(false);
  }

  function clampAdminProgZoom(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    const stepped =
      Math.round(n / ADMIN_PROG_ZOOM_STEP) * ADMIN_PROG_ZOOM_STEP;
    return Math.min(
      ADMIN_PROG_ZOOM_MAX,
      Math.max(ADMIN_PROG_ZOOM_MIN, Math.round(stepped * 10) / 10)
    );
  }

  function defaultAdminProgZoom() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches
      ? 0.5
      : 1;
  }

  function loadAdminProgZoom() {
    try {
      const raw = sessionStorage.getItem(ADMIN_PROG_ZOOM_KEY);
      if (raw == null || raw === "") return defaultAdminProgZoom();
      return clampAdminProgZoom(parseFloat(raw));
    } catch {
      return defaultAdminProgZoom();
    }
  }

  function saveAdminProgZoom(zoom) {
    adminProgOverviewZoom = clampAdminProgZoom(zoom);
    try {
      sessionStorage.setItem(ADMIN_PROG_ZOOM_KEY, String(adminProgOverviewZoom));
    } catch {
      /* ignore quota / private mode */
    }
    return adminProgOverviewZoom;
  }

  function applyAdminProgTableZoom(root, zoom = adminProgOverviewZoom, { snap = true } = {}) {
    const scale = snap
      ? clampAdminProgZoom(zoom)
      : Math.min(
          ADMIN_PROG_ZOOM_MAX,
          Math.max(ADMIN_PROG_ZOOM_MIN, Number(zoom) || 1)
        );
    adminProgOverviewZoom = scale;
    const slot = root?.querySelector(".admin-prog-table-scale-slot");
    const scaler = root?.querySelector(".admin-prog-table-scale");
    const label = root?.querySelector("[data-prog-zoom-label]");
    const minusBtn = root?.querySelector("[data-prog-zoom='-1']");
    const plusBtn = root?.querySelector("[data-prog-zoom='1']");
    if (!slot || !scaler) return scale;

    // Prefer CSS zoom (keeps sticky thead / name column working).
    // Fallback: transform:scale + slot footprint so scroll area isn't clipped.
    const supportsZoom =
      typeof CSS !== "undefined" && typeof CSS.supports === "function"
        ? CSS.supports("zoom", "1")
        : "zoom" in document.documentElement.style;
    if (supportsZoom) {
      scaler.style.transform = "";
      scaler.style.zoom = String(scale);
      slot.style.width = "";
      slot.style.height = "";
    } else {
      scaler.style.zoom = "";
      scaler.style.transform = "none";
      const width = scaler.scrollWidth || scaler.offsetWidth;
      const height = scaler.scrollHeight || scaler.offsetHeight;
      scaler.style.transform = `scale(${scale})`;
      scaler.style.transformOrigin = "top left";
      slot.style.width = `${Math.ceil(width * scale)}px`;
      slot.style.height = `${Math.ceil(height * scale)}px`;
    }

    if (label) {
      label.textContent = `${Math.round(scale * 100)}%`;
      label.setAttribute(
        "aria-label",
        `目前縮放 ${Math.round(scale * 100)}%，點按重設為 100%`
      );
    }
    if (minusBtn) minusBtn.disabled = scale <= ADMIN_PROG_ZOOM_MIN + 1e-9;
    if (plusBtn) plusBtn.disabled = scale >= ADMIN_PROG_ZOOM_MAX - 1e-9;
    return scale;
  }

  function bindAdminProgZoomControls(root) {
    adminProgOverviewZoom = loadAdminProgZoom();
    applyAdminProgTableZoom(root, adminProgOverviewZoom);

    const setZoom = (next, { snap = true, persist = true } = {}) => {
      const scale = applyAdminProgTableZoom(root, next, { snap });
      if (persist) saveAdminProgZoom(scale);
      hideAdminProgItemHoverTip();
      hideAdminProgCompletedPopover();
      return scale;
    };

    root.querySelectorAll("[data-prog-zoom]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dir = Number(btn.dataset.progZoom);
        if (!Number.isFinite(dir) || dir === 0) return;
        setZoom(adminProgOverviewZoom + dir * ADMIN_PROG_ZOOM_STEP);
      });
    });

    root.querySelector("[data-prog-zoom-reset]")?.addEventListener("click", () => {
      setZoom(1);
    });

    // Pinch-to-zoom on the table (touch).
    const tableWrap = root.querySelector(".admin-prog-table-wrap");
    if (!tableWrap) return;

    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    const touchDistance = (touches) => {
      const [a, b] = touches;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.hypot(dx, dy);
    };

    tableWrap.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 2) return;
        pinchStartDist = touchDistance(e.touches);
        pinchStartZoom = adminProgOverviewZoom;
      },
      { passive: true }
    );

    tableWrap.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length !== 2 || pinchStartDist <= 0) return;
        e.preventDefault();
        const ratio = touchDistance(e.touches) / pinchStartDist;
        setZoom(pinchStartZoom * ratio, { snap: false, persist: false });
      },
      { passive: false }
    );

    tableWrap.addEventListener(
      "touchend",
      (e) => {
        if (e.touches.length >= 2) return;
        if (pinchStartDist > 0) {
          setZoom(adminProgOverviewZoom, { snap: true, persist: true });
        }
        pinchStartDist = 0;
      },
      { passive: true }
    );

    // Recompute slot after fonts / layout settle.
    requestAnimationFrame(() =>
      applyAdminProgTableZoom(root, adminProgOverviewZoom)
    );
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /* ---------- Format helpers ---------- */

  function formatDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${y}年${Number(m)}月${Number(d)}日`;
  }

  function formatDateYMD(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return "—";
    return `${y}年${m}月${d}日`;
  }

  function formatDateDMY(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return "—";
    return `${d}-${m}-${y}`;
  }

  /** 活動紀錄內頁：電腦版 YYYY年MM月DD日，手機版 DD-MM-YYYY */
  function formatActivityTableDate(iso) {
    if (!iso) return "—";
    return `<span class="date-ymd">${formatDateYMD(iso)}</span><span class="date-dmy">${formatDateDMY(iso)}</span>`;
  }

  function initials(name) {
    return name.slice(0, 1);
  }

  function progressOf(badge) {
    const syl = syllabus && syllabus[badge.key];
    if (!syl) {
      const legacy = badge.requirements || [];
      const done = legacy.filter((r) => r.done).length;
      return { done, total: legacy.length, pct: legacy.length ? Math.round((done / legacy.length) * 100) : 0 };
    }
    const completed = new Set(badge.completedIds || []);
    let done = 0;
    let total = 0;
    const electiveSeen = new Set();

    for (const section of syl.sections) {
      for (const sub of section.subsections) {
        if (sub.electiveGroup) {
          if (electiveSeen.has(sub.electiveGroup)) continue;
          electiveSeen.add(sub.electiveGroup);
          const tracks = collectElectiveTracks(syl, sub.electiveGroup);
          const chosen = chooseElectiveTrack(tracks, completed);
          total += chosen.items.length;
          done += chosen.items.filter((it) => completed.has(it.id)).length;
        } else {
          for (const item of sub.items) {
            total += 1;
            if (completed.has(item.id)) done += 1;
          }
        }
      }
    }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function collectElectiveTracks(syl, groupId) {
    const tracks = [];
    for (const section of syl.sections) {
      for (const sub of section.subsections) {
        if (sub.electiveGroup === groupId) tracks.push(sub);
      }
    }
    return tracks;
  }

  function chooseElectiveTrack(tracks, completedSet) {
    if (!tracks.length) return { items: [] };
    let best = tracks[0];
    let bestDone = -1;
    for (const track of tracks) {
      const n = track.items.filter((it) => completedSet.has(it.id)).length;
      if (n > bestDone) {
        bestDone = n;
        best = track;
      }
    }
    return best;
  }

  function collectItemIds(syl) {
    const ids = [];
    for (const section of syl.sections) {
      for (const sub of section.subsections) {
        for (const item of sub.items) ids.push(item.id);
      }
    }
    return ids;
  }

  function sectionProgress(section, completedSet) {
    let done = 0;
    let total = 0;
    const electiveSeen = new Set();

    for (const sub of section.subsections) {
      if (sub.electiveGroup) {
        if (electiveSeen.has(sub.electiveGroup)) continue;
        electiveSeen.add(sub.electiveGroup);
        const tracks = section.subsections.filter(
          (s) => s.electiveGroup === sub.electiveGroup
        );
        const chosen = chooseElectiveTrack(tracks, completedSet);
        total += chosen.items.length;
        done += chosen.items.filter((it) => completedSet.has(it.id)).length;
      } else {
        for (const item of sub.items) {
          total += 1;
          if (completedSet.has(item.id)) done += 1;
        }
      }
    }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Optional per-member CSS object-position (e.g. "center 20%"). */
  function photoPositionStyle(member) {
    const pos = member && member.photoPosition;
    if (!pos || typeof pos !== "string") return "";
    return ` style="object-position: ${escapeHtml(pos)}"`;
  }

  /* ---------- Tabs ---------- */

  function switchTab(tabId) {
    const validTabs = new Set(["progressive", "badges", "activity", "resources"]);
    if (tabId === "overview" || tabId === "attendance" || !validTabs.has(tabId)) {
      tabId = "progressive";
    }

    const buttons = $$(".tab-btn");
    const panels = $$(".tab-panel");

    buttons.forEach((btn) => {
      const active = btn.dataset.tab === tabId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
    });

    panels.forEach((panel) => {
      const active = panel.id === `panel-${tabId}`;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    sessionStorage.setItem(TAB_KEY, tabId);
    if (tabId !== "progressive") showProgressiveList();
    if (tabId !== "activity") showActivityList();
    if (tabId !== "badges") showSpecialtyList();
    if (tabId !== "resources") showResourcesHome();
  }

  function initTabs() {
    const buttons = $$(".tab-btn");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    $(".tab-nav").addEventListener("keydown", (e) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(e.key)) return;

      e.preventDefault();
      const list = $$(".tab-btn");
      const idx = list.findIndex((b) => b.classList.contains("is-active"));
      let next = idx;

      if (e.key === "ArrowRight") next = (idx + 1) % list.length;
      if (e.key === "ArrowLeft") next = (idx - 1 + list.length) % list.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = list.length - 1;

      list[next].focus();
      switchTab(list[next].dataset.tab);
    });
  }

  /* ---------- Render ---------- */

  function showLogin() {
    currentMember = null;
    isAdminSession = false;
    dashboardView.hidden = true;
    if (adminView) adminView.hidden = true;
    exitAdminMemberPreview(false);
    loginView.hidden = false;
    loginError.hidden = true;
    loginForm.reset();
    showProgressiveList();
    showActivityList();
    showSpecialtyList();
    showResourcesHome();
  }

  function showDashboard(member) {
    currentMember = member;
    loginView.hidden = true;
    if (adminView) adminView.hidden = true;
    dashboardView.hidden = false;
    if (
      adminPreviewBar &&
      !document.body.classList.contains("admin-previewing")
    ) {
      adminPreviewBar.hidden = true;
    }
    showProgressiveList();
    showActivityList();
    showSpecialtyList();
    showResourcesHome();
    renderProfile(member);
    renderProgressive(member);
    renderBadges(member);
    renderActivitySummary(member);
    renderResources();

    const savedTab = sessionStorage.getItem(TAB_KEY) || "progressive";
    switchTab(savedTab);

    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function renderProfile(member) {
    $("#header-name").textContent = member.name;
    $("#header-id").textContent = member.scoutId;

    const avatar = $("#profile-avatar");
    if (member.photo) {
      avatar.classList.add("has-photo");
      avatar.setAttribute("aria-hidden", "false");
      avatar.innerHTML = `<img src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.name)}的成員照片" width="120" height="150"${photoPositionStyle(member)} />`;
    } else {
      avatar.classList.remove("has-photo");
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = initials(member.name);
    }

    const nameText = $("#profile-name-text");
    if (nameText) nameText.textContent = member.name;
    else $("#profile-heading").textContent = member.name;
    $("#profile-rank").textContent = member.rank || "";
    $("#profile-troop").textContent = member.troop;
    $("#profile-section").textContent = member.section;
    const joinEl = $("#profile-join");
    joinEl.textContent = formatDate(member.joinDate);
    joinEl.setAttribute("datetime", member.joinDate);
  }

  function showProgressiveList() {
    cancelProgressAnimations();
    const listView = $("#progressive-list-view");
    const detailView = $("#progressive-detail-view");
    if (listView) listView.hidden = false;
    if (detailView) detailView.hidden = true;
  }

  let attendanceRingAnim = null;
  let selectedAttendanceYear = "2025-2026";
  const ATTENDANCE_YEARS = ["2026-2027", "2025-2026", "2024-2025"];

  function showActivityList() {
    const listView = $("#activity-list-view");
    const detailView = $("#activity-detail-view");
    if (listView) listView.hidden = false;
    if (detailView) detailView.hidden = true;
    if (attendanceRingAnim) {
      cancelAnimationFrame(attendanceRingAnim);
      attendanceRingAnim = null;
    }
    const overviewEl = $("#activity-detail-overview");
    if (overviewEl) overviewEl.hidden = true;
    const chartEl = $("#activity-detail-chart");
    if (chartEl) chartEl.innerHTML = "";
    const statsEl = $("#activity-detail-stats");
    if (statsEl) statsEl.innerHTML = "";
    const yearSwitcher = $("#activity-year-switcher");
    if (yearSwitcher) {
      yearSwitcher.hidden = true;
      yearSwitcher.innerHTML = "";
    }
  }

  function showActivityDetail(kind) {
    if (!currentMember) return;
    const titles = {
      attendance: { title: "出席率", subtitle: "" },
      service: { title: "服務時數", subtitle: "服務活動明細" },
      camping: { title: "露營次數", subtitle: "露營活動明細" },
      outdoor: { title: "戶外活動", subtitle: "參與過的戶外活動明細" },
    };
    const meta = titles[kind];
    if (!meta) return;

    $("#activity-list-view").hidden = true;
    $("#activity-detail-view").hidden = false;
    $("#activity-detail-title").textContent = meta.title;

    const subtitleEl = $("#activity-detail-subtitle");
    if (meta.subtitle) {
      subtitleEl.hidden = false;
      subtitleEl.textContent = meta.subtitle;
    } else {
      subtitleEl.hidden = true;
      subtitleEl.textContent = "";
    }

    if (kind === "attendance") {
      refreshAttendanceDetail(currentMember, true);
    } else {
      renderAttendanceYearSwitcher(false);
      setAttendanceOverviewVisible(false);
      const statsEl = $("#activity-detail-stats");
      if (statsEl) statsEl.innerHTML = "";
      renderActivityDetailChart(currentMember, kind);
      $("#activity-detail-content").innerHTML = renderActivityDetailContent(
        currentMember,
        kind
      );
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function refreshAttendanceDetail(member, animateRing = true) {
    renderActivityDetailStats(member, "attendance");
    if (animateRing) {
      renderActivityDetailChart(member, "attendance");
    } else {
      updateAttendanceRingInstant(member);
    }
    $("#activity-detail-content").innerHTML = renderActivityDetailContent(
      member,
      "attendance"
    );
  }

  function scoutYearRange(yearKey) {
    const [startYear] = String(yearKey).split("-").map(Number);
    return {
      start: `${startYear}-09-01`,
      end: `${startYear + 1}-08-31`,
    };
  }

  function filterAttendanceByYear(records, yearKey) {
    const { start, end } = scoutYearRange(yearKey);
    return (records || []).filter((r) => r.date >= start && r.date <= end);
  }

  function renderAttendanceYearSwitcher(visible) {
    const switcher = $("#activity-year-switcher");
    if (!switcher) return;

    if (!visible) {
      switcher.hidden = true;
      switcher.innerHTML = "";
      return;
    }

    switcher.hidden = false;
    switcher.innerHTML = ATTENDANCE_YEARS.map((y) => {
      const active = y === selectedAttendanceYear;
      return `
        <button
          type="button"
          class="att-year-btn${active ? " is-active" : ""}"
          data-year="${y}"
          aria-pressed="${active ? "true" : "false"}"
        >${y}</button>`;
    }).join("");

    switcher.querySelectorAll(".att-year-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const year = btn.dataset.year;
        if (!year || year === selectedAttendanceYear) return;
        selectedAttendanceYear = year;
        if (currentMember) refreshAttendanceDetail(currentMember, true);
      });
    });
  }

  function setAttendanceOverviewVisible(visible) {
    const overviewEl = $("#activity-detail-overview");
    if (overviewEl) overviewEl.hidden = !visible;
  }

  function renderActivityDetailStats(member, kind) {
    const statsEl = $("#activity-detail-stats");
    if (!statsEl) return;

    if (kind !== "attendance") {
      renderAttendanceYearSwitcher(false);
      setAttendanceOverviewVisible(false);
      statsEl.innerHTML = "";
      return;
    }

    renderAttendanceYearSwitcher(true);
    setAttendanceOverviewVisible(true);

    const { counts, total } = getAttendanceStats(member, selectedAttendanceYear);
    const present = counts.present || 0;
    const absent = counts.absent || 0;

    statsEl.innerHTML = `
      <ul class="att-stat-cards" aria-label="出席統計">
        <li class="att-stat-card att-stat-card--present">
          <span class="att-stat-card-value">${present}</span>
          <span class="att-stat-card-label">出席次數</span>
        </li>
        <li class="att-stat-card att-stat-card--absent">
          <span class="att-stat-card-value">${absent}</span>
          <span class="att-stat-card-label">缺席次數</span>
        </li>
        <li class="att-stat-card att-stat-card--total">
          <span class="att-stat-card-value">${total}</span>
          <span class="att-stat-card-label">活動總數</span>
        </li>
      </ul>
    `;
  }

  function renderActivityDetailChart(member, kind) {
    const chartEl = $("#activity-detail-chart");
    if (!chartEl) return;

    if (attendanceRingAnim) {
      cancelAnimationFrame(attendanceRingAnim);
      attendanceRingAnim = null;
    }

    if (kind !== "attendance") {
      setAttendanceOverviewVisible(false);
      chartEl.innerHTML = "";
      return;
    }

    setAttendanceOverviewVisible(true);

    const { counts, total, rate } = getAttendanceStats(
      member,
      selectedAttendanceYear
    );
    const present = counts.present || 0;
    const absent = counts.absent || 0;
    const presentPct = total ? (present / total) * 100 : 0;
    const absentPct = total ? (absent / total) * 100 : 0;

    chartEl.innerHTML = `
      <div class="att-ring" role="img" aria-label="${selectedAttendanceYear}年度出席率 ${rate}%，出席 ${present} 次，缺席 ${absent} 次，共 ${total} 次">
        <div class="att-ring-chart" id="att-ring-chart" style="background: conic-gradient(var(--cream-warm) 0 100%);">
          <div class="att-ring-hole">
            <span class="att-ring-value" id="att-ring-value">0%</span>
            <span class="att-ring-label">出席率</span>
          </div>
        </div>
      </div>
    `;

    animateAttendanceRing(rate, presentPct, absentPct);
  }

  function updateAttendanceRingInstant(member) {
    const { counts, total, rate } = getAttendanceStats(
      member,
      selectedAttendanceYear
    );
    const presentPct = total ? (counts.present / total) * 100 : 0;
    const absentPct = total ? (counts.absent / total) * 100 : 0;
    const chart = $("#att-ring-chart");
    const valueEl = $("#att-ring-value");
    if (!chart || !valueEl) {
      renderActivityDetailChart(member, "attendance");
      return;
    }
    const endPresent = presentPct;
    const endAbsent = presentPct + absentPct;
    chart.style.background = `conic-gradient(
      var(--green-mid) 0 ${endPresent}%,
      #c45c5c ${endPresent}% ${endAbsent}%,
      var(--cream-warm) ${endAbsent}% 100%
    )`;
    valueEl.textContent = `${rate}%`;
  }

  function animateAttendanceRing(targetRate, presentPct, absentPct) {
    const chart = $("#att-ring-chart");
    const valueEl = $("#att-ring-value");
    if (!chart || !valueEl) return;

    const duration = 2000;
    const start = performance.now();

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function paint(p, a, shownRate) {
      const endPresent = p;
      const endAbsent = p + a;
      chart.style.background = `conic-gradient(
        var(--green-mid) 0 ${endPresent}%,
        #c45c5c ${endPresent}% ${endAbsent}%,
        var(--cream-warm) ${endAbsent}% 100%
      )`;
      valueEl.textContent = `${Math.round(shownRate)}%`;
    }

    paint(0, 0, 0);

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);
      paint(presentPct * e, absentPct * e, targetRate * e);
      if (t < 1) {
        attendanceRingAnim = requestAnimationFrame(frame);
      } else {
        paint(presentPct, absentPct, targetRate);
        attendanceRingAnim = null;
      }
    }

    attendanceRingAnim = requestAnimationFrame(frame);
  }

  function getAttendanceStats(member, yearKey) {
    const all = member.attendance || [];
    const records = yearKey ? filterAttendanceByYear(all, yearKey) : all;
    const counts = { present: 0, absent: 0 };
    for (const r of records) {
      const status = normalizeAttendanceStatus(r);
      if (counts[status] !== undefined) counts[status]++;
    }
    const total = records.length;
    const rate = total
      ? Math.round((counts.present / total) * 100)
      : yearKey
        ? 0
        : (member.activity && member.activity.attendanceRate) || 0;
    return { records, counts, total, rate };
  }

  function getServiceRecords(member) {
    const activity = member.activity || {};
    if (Array.isArray(activity.serviceRecords) && activity.serviceRecords.length) {
      return [...activity.serviceRecords].sort((a, b) =>
        b.date.localeCompare(a.date)
      );
    }
    return (activity.outdoorActivities || [])
      .filter((a) => a.type === "服務")
      .map((a) => ({
        date: a.date,
        name: a.name,
        hours: a.hours || 0,
        note: a.note || "",
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function getCampingRecords(member) {
    const activity = member.activity || {};
    if (Array.isArray(activity.campingRecords) && activity.campingRecords.length) {
      return [...activity.campingRecords].sort((a, b) =>
        b.date.localeCompare(a.date)
      );
    }
    return (activity.outdoorActivities || [])
      .filter((a) => a.type === "露營")
      .map((a) => ({
        date: a.date,
        name: a.name,
        nights: a.nights || 1,
        note: a.note || "",
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function getOutdoorRecords(member) {
    const activity = member.activity || {};
    return [...(activity.outdoorActivities || [])].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }

  function renderActivityDetailContent(member, kind) {
    if (kind === "attendance") {
      const { records } = getAttendanceStats(member, selectedAttendanceYear);
      const rows = [...records]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((r) => {
          const status = normalizeAttendanceStatus(r);
          const note = formatAttendanceNote(r);
          return `
          <tr>
            <td><time datetime="${r.date}">${formatActivityTableDate(r.date)}</time></td>
            <td>${escapeHtml(r.name)}</td>
            <td><span class="activity-type type-${r.type}">${escapeHtml(r.type)}</span></td>
            <td><span class="att-status status-${status}">${ATTENDANCE_LABELS[status]}</span></td>
            <td class="att-note">${note ? escapeHtml(note) : "—"}</td>
          </tr>`;
        })
        .join("");
      return `
        <div class="attendance-table-wrap">
          <table class="attendance-table attendance-table--attendance" aria-label="出席明細">
            <colgroup>
              <col class="col-date" />
              <col class="col-name" />
              <col class="col-type" />
              <col class="col-status" />
              <col class="col-note" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">日期</th>
                <th scope="col">活動／集會</th>
                <th scope="col">類型</th>
                <th scope="col">狀態</th>
                <th scope="col">備註</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    if (kind === "service") {
      const records = getServiceRecords(member);
      const totalHours =
        (member.activity && member.activity.serviceHours) ||
        records.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
      const summary = `
        <div class="detail-meta">
          <span>累計服務時數 <strong>${totalHours}</strong> 小時</span>
          <span>共 ${records.length} 項</span>
        </div>`;
      if (!records.length) {
        return `${summary}<p class="empty-state">暫無服務紀錄</p>`;
      }
      const rows = records
        .map(
          (r) => `
          <tr>
            <td><time datetime="${r.date}">${formatActivityTableDate(r.date)}</time></td>
            <td>${escapeHtml(r.name)}</td>
            <td>${r.hours != null && r.hours !== "" ? `${r.hours} 小時` : "—"}</td>
          </tr>`
        )
        .join("");
      return `${summary}
        <div class="attendance-table-wrap">
          <table class="attendance-table attendance-table--service" aria-label="服務時數明細">
            <colgroup>
              <col class="col-date" />
              <col class="col-name" />
              <col class="col-hours" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">日期</th>
                <th scope="col">服務項目</th>
                <th scope="col">時數</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    if (kind === "camping") {
      const records = getCampingRecords(member);
      const count =
        (member.activity && member.activity.campingCount) || records.length;
      const summary = `
        <div class="detail-meta">
          <span>露營次數 <strong>${count}</strong></span>
          <span>共 ${records.length} 項紀錄</span>
        </div>`;
      if (!records.length) {
        return `${summary}<p class="empty-state">暫無露營紀錄</p>`;
      }
      const rows = records
        .map(
          (r) => `
          <tr>
            <td><time datetime="${r.date}">${formatActivityTableDate(r.date)}</time></td>
            <td>${escapeHtml(r.name)}</td>
            <td class="att-note">${r.note ? escapeHtml(r.note) : "—"}</td>
            <td>${r.nights != null && r.nights !== "" ? `${r.nights} 晚` : "—"}</td>
          </tr>`
        )
        .join("");
      return `${summary}
        <div class="attendance-table-wrap">
          <table class="attendance-table attendance-table--camping" aria-label="露營明細">
            <colgroup>
              <col class="col-date" />
              <col class="col-name" />
              <col class="col-note" />
              <col class="col-nights" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">日期</th>
                <th scope="col">露營活動</th>
                <th scope="col">地點</th>
                <th scope="col">晚數</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    if (kind === "outdoor") {
      const records = getOutdoorRecords(member);
      const summary = `
        <div class="detail-meta">
          <span>戶外活動 <strong>${records.length}</strong> 次</span>
        </div>`;
      if (!records.length) {
        return `${summary}<p class="empty-state">暫無戶外活動紀錄</p>`;
      }
      const rows = records
        .map(
          (r) => `
          <tr>
            <td><time datetime="${r.date}">${formatActivityTableDate(r.date)}</time></td>
            <td>${escapeHtml(r.name)}</td>
            <td class="att-note">${r.note ? escapeHtml(r.note) : "—"}</td>
          </tr>`
        )
        .join("");
      return `${summary}
        <div class="attendance-table-wrap">
          <table class="attendance-table attendance-table--outdoor" aria-label="戶外活動明細">
            <colgroup>
              <col class="col-date" />
              <col class="col-name" />
              <col class="col-note" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">日期</th>
                <th scope="col">活動名稱</th>
                <th scope="col">地點</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    return `<p class="empty-state">暫無資料</p>`;
  }

  function showBadgeDetail(badgeKey) {
    if (!currentMember || !syllabus || !syllabus[badgeKey]) return;
    cancelProgressAnimations();
    const syl = syllabus[badgeKey];
    const progress = currentMember.progressiveBadges.find((b) => b.key === badgeKey);
    if (!progress) return;

    $("#progressive-list-view").hidden = true;
    $("#progressive-detail-view").hidden = false;

    const completed = new Set(progress.completedIds || []);
    const { done, total, pct } = progressOf(progress);

    const icon = $("#badge-detail-icon");
    icon.src = syl.icon;
    icon.alt = `${syl.name}圖示`;

    $("#badge-detail-name").textContent = syl.fullName;
    $("#badge-detail-english").textContent = syl.englishName;

    const statusEl = $("#badge-detail-status");
    statusEl.textContent = STATUS_LABELS[progress.status] || progress.status;
    statusEl.className = `prog-status status-label-${progress.status}`;

    $("#badge-detail-eligibility").textContent = syl.eligibility;
    $("#badge-detail-note").textContent = syl.note || "";

    const bar = $("#badge-detail-bar");
    bar.setAttribute("aria-valuenow", String(pct));
    bar.setAttribute("aria-label", `${syl.name}進度`);

    const fillEl = $("#badge-detail-fill");
    const textEl = $("#badge-detail-progress-text");
    const dateSuffix =
      progress.status === "completed" && progress.completedDate
        ? ` · 完成日期：${formatDate(progress.completedDate)}`
        : "";

    if (fillEl) fillEl.style.width = "0%";
    if (textEl) textEl.textContent = `0 / ${total} 項完成（0%）${dateSuffix}`;

    requestAnimationFrame(() => {
      animateProgressBar(fillEl, textEl, {
        done,
        total,
        pct,
        textFormatter: (d, p) => `${d} / ${total} 項完成（${p}%）${dateSuffix}`,
      });
    });

    const sectionsEl = $("#badge-detail-sections");
    sectionsEl.innerHTML = syl.sections
      .map((section) => {
        const sp = sectionProgress(section, completed);
        const electiveTipShown = new Set();
        const subsHtml = section.subsections
          .map((sub) => {
            const itemsHtml = sub.items
              .map((it) => {
                const isDone = completed.has(it.id);
                const completedOn =
                  isDone &&
                  progress.itemCompletedDates &&
                  progress.itemCompletedDates[it.id]
                    ? progress.itemCompletedDates[it.id]
                    : null;
                const details = (it.details || [])
                  .map((d) => `<li>${escapeHtml(d)}</li>`)
                  .join("");
                return `
                  <li class="syllabus-item ${isDone ? "done" : "pending"}">
                    <div class="syllabus-item-head">
                      <span class="syllabus-item-title">${escapeHtml(it.title)}</span>
                      <div class="item-status-block">
                        <span class="item-status ${isDone ? "is-done" : "is-pending"}">${isDone ? "已完成" : "未完成"}</span>
                        ${
                          completedOn
                            ? `<time class="item-completed-date" datetime="${completedOn}">${formatDate(completedOn)}</time>`
                            : isDone
                              ? `<span class="item-completed-date is-empty">—</span>`
                              : ""
                        }
                      </div>
                    </div>
                    ${details ? `<ul class="syllabus-details">${details}</ul>` : ""}
                  </li>`;
              })
              .join("");

            let tipHtml = "";
            if (sub.electiveGroup && !electiveTipShown.has(sub.electiveGroup)) {
              electiveTipShown.add(sub.electiveGroup);
              tipHtml = `<aside class="elective-tip" role="note">
                  <p class="elective-tip-label">選修提示</p>
                  <p class="elective-tip-text">${escapeHtml(syl.note || "請於下列 4. 戶外活動／5. 海上活動／6. 航空活動中選取其中一項為主要考核項目；各進度性獎章的選項須相同。海童軍必須選海上活動，空童軍必須選航空活動。").replace(/\n/g, "<br>")}</p>
                  <p class="elective-tip-count">進度計算：只計算所選一項的全部分項</p>
                </aside>`;
            }

            return `
              <div class="syllabus-sub ${sub.electiveGroup ? "is-elective-track" : ""}">
                ${tipHtml}
                <h4 class="syllabus-sub-title">${escapeHtml(sub.title)}</h4>
                <ul class="syllabus-items">${itemsHtml}</ul>
              </div>`;
          })
          .join("");

        return `
          <section class="syllabus-section">
            <header class="syllabus-section-header">
              <h3><span class="section-code">${escapeHtml(section.code)}</span>${escapeHtml(section.title)}</h3>
              <span class="section-progress">${sp.done}/${sp.total}</span>
            </header>
            ${subsHtml}
          </section>`;
      })
      .join("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  let progressAnimFrames = new Set();

  function cancelProgressAnimations() {
    for (const id of progressAnimFrames) cancelAnimationFrame(id);
    progressAnimFrames.clear();
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Animate progress fill + optional text from 0 → target over 2s.
   * textFormatter(doneShown, pctShown) → string
   */
  function animateProgressBar(fillEl, textEl, { done, total, pct, textFormatter }) {
    if (!fillEl) return;
    fillEl.style.width = "0%";
    if (textEl && textFormatter) {
      textEl.textContent = textFormatter(0, 0);
    }

    const duration = 2000;
    const start = performance.now();
    let frameId = null;

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);
      const shownPct = pct * e;
      const shownDone = Math.round(done * e);
      fillEl.style.width = `${shownPct}%`;
      if (textEl && textFormatter) {
        textEl.textContent = textFormatter(shownDone, Math.round(shownPct));
      }
      if (t < 1) {
        frameId = requestAnimationFrame(frame);
        progressAnimFrames.add(frameId);
      } else {
        fillEl.style.width = `${pct}%`;
        if (textEl && textFormatter) {
          textEl.textContent = textFormatter(done, pct);
        }
        if (frameId) progressAnimFrames.delete(frameId);
      }
    }

    frameId = requestAnimationFrame(frame);
    progressAnimFrames.add(frameId);
  }

  function renderProgressive(member) {
    cancelProgressAnimations();
    const container = $("#progressive-list");
    container.innerHTML = "";

    for (const badge of member.progressiveBadges) {
      const { done, total, pct } = progressOf(badge);
      const card = document.createElement("button");
      card.type = "button";
      card.className = `prog-card status-${badge.status}`;
      card.dataset.badgeKey = badge.key;

      const completedLine =
        badge.status === "completed" && badge.completedDate
          ? `<p class="prog-meta">完成日期：${formatDate(badge.completedDate)}</p>`
          : "";

      const iconSrc = badge.icon || BADGE_ICONS[badge.key] || BADGE_ICONS[badge.name] || "";
      const iconHtml = iconSrc
        ? `<img class="prog-icon" src="${escapeHtml(iconSrc)}" alt="" width="80" height="80" />`
        : "";

      card.innerHTML = `
        <div class="prog-card-body">
          ${iconHtml}
          <div class="prog-card-main">
            <div class="prog-header">
              <h3 class="prog-name">${escapeHtml(badge.name)}</h3>
              <span class="prog-status">${STATUS_LABELS[badge.status] || badge.status}</span>
            </div>
            ${completedLine}
            <div class="prog-progress">
              <div class="prog-progress-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(badge.name)}進度">
                <div class="prog-progress-fill" data-done="${done}" data-total="${total}" data-pct="${pct}"></div>
              </div>
              <p class="prog-progress-text">0 / ${total} 項完成（0%）</p>
            </div>
            <p class="prog-open-hint">查看完整分項考核內容 →</p>
          </div>
        </div>
      `;

      card.addEventListener("click", () => showBadgeDetail(badge.key));
      container.appendChild(card);
    }

    requestAnimationFrame(() => {
      $$(".prog-card", container).forEach((card) => {
        const fill = $(".prog-progress-fill", card);
        const text = $(".prog-progress-text", card);
        if (!fill) return;
        const done = Number(fill.dataset.done) || 0;
        const total = Number(fill.dataset.total) || 0;
        const pct = Number(fill.dataset.pct) || 0;
        animateProgressBar(fill, text, {
          done,
          total,
          pct,
          textFormatter: (d, p) => `${d} / ${total} 項完成（${p}%）`,
        });
      });
    });
  }

  const SPECIALTY_GROUPS = [
    { key: "interest", label: "興趣組", selector: "#specialty-interest" },
    { key: "skill", label: "技能組", selector: "#specialty-skill" },
    { key: "service", label: "服務組", selector: "#specialty-service" },
    { key: "instructor", label: "教導組", selector: "#specialty-instructor" },
    { key: "water", label: "水上活動組", selector: "#specialty-water" },
    { key: "aviation", label: "航空活動組", selector: "#specialty-aviation" },
    { key: "other", label: "其他獎章及徽章", selector: "#specialty-other" },
  ];

  const SPECIALTY_CATEGORY_MAP = {
    興趣組: "interest",
    技能組: "skill",
    服務組: "service",
    教導組: "instructor",
    水上活動組: "water",
    海上活動組: "water",
    海上活動徽章: "water",
    航空活動組: "aviation",
    航空活動徽章: "aviation",
    其他獎章及徽章: "other",
    其他: "other",
  };

  function normalizeSpecialtyGroup(badge) {
    if (badge.group && SPECIALTY_GROUPS.some((g) => g.key === badge.group)) {
      return badge.group;
    }
    return SPECIALTY_CATEGORY_MAP[badge.category] || "other";
  }

  function renderBadges(member) {
    const badges = (member.specialtyBadges || []).map((badge, index) => ({
      ...badge,
      _index: index,
    }));
    const grouped = {
      interest: [],
      skill: [],
      service: [],
      instructor: [],
      water: [],
      aviation: [],
      other: [],
    };

    for (const badge of badges) {
      grouped[normalizeSpecialtyGroup(badge)].push(badge);
    }

    const orderGroups =
      (specialtyGallery &&
        Object.fromEntries(
          (specialtyGallery.groups || []).map((g) => [
            g.key,
            (g.items || []).map((i) => i.name),
          ])
        )) ||
      {};

    function sortBadges(groupKey, list) {
      const order = orderGroups[groupKey] || [];
      const rank = new Map(order.map((n, i) => [n, i]));
      return [...list].sort((a, b) => {
        const nameA = String(a.name || "")
          .replace(/（教導組）/g, "")
          .replace(/\(教導組\)/g, "")
          .replace(/章$/, "")
          .trim();
        const nameB = String(b.name || "")
          .replace(/（教導組）/g, "")
          .replace(/\(教導組\)/g, "")
          .replace(/章$/, "")
          .trim();
        const basesA = [a.name, nameA, nameA.replace(/獎章$/, "")];
        const basesB = [b.name, nameB, nameB.replace(/獎章$/, "")];
        const ra = basesA.reduce(
          (best, n) => (rank.has(n) ? Math.min(best, rank.get(n)) : best),
          9999
        );
        const rb = basesB.reduce(
          (best, n) => (rank.has(n) ? Math.min(best, rank.get(n)) : best),
          9999
        );
        if (ra !== rb) return ra - rb;
        return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
      });
    }

    for (const group of SPECIALTY_GROUPS) {
      $(group.selector).innerHTML = renderBadgeItems(
        sortBadges(group.key, grouped[group.key]),
        false,
        `暫無${group.label}`
      );
    }

    $("#award-list").innerHTML = renderBadgeItems(
      member.awards || [],
      true,
      "暫無獎項紀錄"
    );

    $$("#specialty-groups .badge-item[data-specialty-index]").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.specialtyIndex);
        showSpecialtyDetail(idx);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          showSpecialtyDetail(Number(el.dataset.specialtyIndex));
        }
      });
    });
  }

  function renderBadgeItems(items, isAward, emptyText) {
    if (!items.length) {
      return `<li class="empty-state">${emptyText}</li>`;
    }
    return items
      .map((b) => {
        const iconSrc = resolveSpecialtyIcon(b);
        const iconHtml = iconSrc
          ? `<img class="badge-icon" src="${escapeHtml(iconSrc)}" alt="${escapeHtml(b.name)}圖示" width="40" height="40" loading="lazy" />`
          : `<span class="badge-icon badge-icon-placeholder" aria-hidden="true"></span>`;
        const indexAttr =
          !isAward && b._index != null
            ? ` data-specialty-index="${b._index}" role="button" tabindex="0"`
            : "";
        const clickable = !isAward ? "is-clickable" : "";
        return `
        <li class="badge-item ${isAward ? "award" : ""} ${iconSrc ? "has-icon" : ""} ${clickable}"${indexAttr}>
          ${isAward ? "" : iconHtml}
          <span class="badge-name">${escapeHtml(b.name)}</span>
          <time class="badge-date" datetime="${b.earnedDate || ""}">${formatDate(b.earnedDate || b.assessmentDate)}</time>
        </li>`;
      })
      .join("");
  }

  function specialtyBaseName(name) {
    return String(name || "")
      .replace(/（教導組）/g, "")
      .replace(/\(教導組\)/g, "")
      .trim()
      .replace(/章$/, "")
      .replace(/獎章$/, "")
      .replace(/徽章$/, "");
  }

  function resolveSpecialtyIcon(badge) {
    const group = normalizeSpecialtyGroup(badge);
    const key =
      badge.syllabusKey ||
      `${group}:${specialtyBaseName(badge.name)}`;
    const fromGallery =
      specialtyGallery &&
      specialtyGallery.groups &&
      specialtyGallery.groups
        .flatMap((g) =>
          (g.items || []).map((i) => ({ ...i, groupKey: g.key }))
        )
        .find((i) => i.key === key || (i.groupKey === group && i.name === specialtyBaseName(badge.name)));
    if (fromGallery && fromGallery.icon) return fromGallery.icon;

    const base = specialtyBaseName(badge.name);
    if (base) return `assets/specialty/${group}/${base}.png`;

    // 僅在路徑已屬正確組別時才沿用資料內 icon，避免誤用同名他組圖示
    const stored = badge.icon || "";
    if (stored.includes(`/specialty/${group}/`)) return stored;
    return null;
  }

  function specialtyKeyOf(badge) {
    if (badge.syllabusKey) return badge.syllabusKey;
    const group = normalizeSpecialtyGroup(badge);
    const raw = String(badge.name || "")
      .replace(/（教導組）/g, "")
      .replace(/\(教導組\)/g, "")
      .trim();
    const bases = [
      raw,
      raw.replace(/章$/, ""),
      raw.replace(/獎章$/, ""),
      raw.replace(/徽章$/, ""),
    ];
    const map = (specialtySyllabus && specialtySyllabus.badges) || {};
    for (const base of bases) {
      const key = `${group}:${base}`;
      if (map[key]) return key;
    }
    return `${group}:${bases[1] || bases[0]}`;
  }

  let specialtyDetailReturnTo = "list";

  function showSpecialtyList() {
    const listView = $("#specialty-list-view");
    const detailView = $("#specialty-detail-view");
    const galleryView = $("#specialty-gallery-view");
    if (listView) listView.hidden = false;
    if (detailView) detailView.hidden = true;
    if (galleryView) galleryView.hidden = true;
    specialtyDetailReturnTo = "list";
    const backBtn = $("#specialty-back-btn");
    if (backBtn) backBtn.textContent = "← 返回專科徽章列表";
  }

  function showSpecialtyGallery() {
    cancelProgressAnimations();
    const listView = $("#specialty-list-view");
    const detailView = $("#specialty-detail-view");
    const galleryView = $("#specialty-gallery-view");
    if (listView) listView.hidden = true;
    if (detailView) detailView.hidden = true;
    if (galleryView) galleryView.hidden = false;
    specialtyDetailReturnTo = "gallery";
    renderSpecialtyGallery();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function memberHasSpecialtyBadge(name, groupKey) {
    if (!currentMember || !name || !groupKey) return false;
    const target = String(name)
      .replace(/（教導組）/g, "")
      .replace(/\(教導組\)/g, "")
      .trim();
    const targetBase = target.replace(/章$/, "").replace(/獎章$/, "");
    return (currentMember.specialtyBadges || []).some((b) => {
      if (normalizeSpecialtyGroup(b) !== groupKey) return false;
      const raw = String(b.name || "")
        .replace(/（教導組）/g, "")
        .replace(/\(教導組\)/g, "")
        .trim();
      const base = raw.replace(/章$/, "").replace(/獎章$/, "");
      return raw === name || raw === target || base === targetBase || base === name;
    });
  }

  function renderSpecialtyGallery() {
    const container = $("#specialty-gallery-content");
    if (!container) return;
    const groups = (specialtyGallery && specialtyGallery.groups) || [];
    if (!groups.length) {
      container.innerHTML = `<p class="empty-state">暫無圖鑑資料</p>`;
      return;
    }
    container.innerHTML = groups
      .map((group) => {
        const items = group.items || [];
        const cards = items
          .map((item) => {
            const earned = memberHasSpecialtyBadge(item.name, group.key);
            return `
            <button
              type="button"
              class="specialty-gallery-card${earned ? " is-earned" : ""}"
              data-syllabus-key="${escapeHtml(item.key || `${group.key}:${item.name}`)}"
            >
              ${
                earned
                  ? `<span class="badge-earned-mark" title="已考獲" aria-label="已考獲"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.2 16.6 4.8 12.2l1.4-1.4 3 3 8-8 1.4 1.4-9.4 9.4z"/></svg></span>`
                  : ""
              }
              <img
                class="specialty-gallery-img"
                src="${escapeHtml(item.icon)}"
                alt="${escapeHtml(item.name)}"
                width="96"
                height="96"
                loading="lazy"
              />
              <span class="specialty-gallery-name">${escapeHtml(item.name)}</span>
            </button>`;
          })
          .join("");
        return `
          <section class="specialty-gallery-group group-${escapeHtml(group.key)}" aria-labelledby="gallery-${escapeHtml(group.key)}">
            <h3 id="gallery-${escapeHtml(group.key)}" class="subsection-title">${escapeHtml(group.label)}</h3>
            <div class="specialty-gallery-grid">${cards}</div>
          </section>`;
      })
      .join("");

    $$("#specialty-gallery-content .specialty-gallery-card").forEach((el) => {
      el.addEventListener("click", () => {
        showGalleryBadgeDetail(el.dataset.syllabusKey);
      });
    });
  }

  function renderSyllabusItemsPreview(items) {
    if (!items.length) {
      return `<p class="empty-state">暫無綱要分項資料</p>`;
    }
    return `
      <section class="syllabus-section">
        <header class="syllabus-section-header">
          <h3>考核分項</h3>
          <span class="section-progress">${items.length} 項</span>
        </header>
        <ul class="syllabus-items">
          ${items
            .map((it) => {
              const details = (it.details || [])
                .map((d) => `<li>${escapeHtml(d)}</li>`)
                .join("");
              return `
                <li class="syllabus-item">
                  <div class="syllabus-item-head">
                    <span class="syllabus-item-title">${escapeHtml(it.title)}</span>
                  </div>
                  ${details ? `<ul class="syllabus-details">${details}</ul>` : ""}
                </li>`;
            })
            .join("")}
        </ul>
      </section>`;
  }

  function showGalleryBadgeDetail(syllabusKey) {
    if (!syllabusKey) return;
    const map = (specialtySyllabus && specialtySyllabus.badges) || {};
    let syl = map[syllabusKey] || null;
    if (!syl && syllabusKey.includes(":")) {
      const groupKey = syllabusKey.slice(0, syllabusKey.indexOf(":"));
      const name = syllabusKey.slice(syllabusKey.indexOf(":") + 1);
      // 只在同一組別內以名稱後備，避免技能組誤用興趣／教導組綱要
      syl =
        Object.values(map).find(
          (b) => b.group === groupKey && (b.name === name || b.key === syllabusKey)
        ) || null;
    }

    const [groupKey, fallbackName] = syllabusKey.includes(":")
      ? [
          syllabusKey.slice(0, syllabusKey.indexOf(":")),
          syllabusKey.slice(syllabusKey.indexOf(":") + 1),
        ]
      : ["other", syllabusKey];
    const name = (syl && syl.name) || fallbackName;
    const groupLabel =
      (syl && syl.category) ||
      (SPECIALTY_GROUPS.find((g) => g.key === groupKey) || {}).label ||
      "";

    specialtyDetailReturnTo = "gallery";
    $("#specialty-list-view").hidden = true;
    $("#specialty-gallery-view").hidden = true;
    $("#specialty-detail-view").hidden = false;

    const backBtn = $("#specialty-back-btn");
    if (backBtn) backBtn.textContent = "← 返回圖鑑";

    const galleryItems =
      (specialtyGallery &&
        specialtyGallery.groups &&
        specialtyGallery.groups.flatMap((g) =>
          (g.items || []).map((i) => ({ ...i, groupKey: g.key }))
        )) ||
      [];
    const iconSrc =
      galleryItems.find((i) => i.key === syllabusKey)?.icon ||
      galleryItems.find(
        (i) => i.groupKey === groupKey && i.name === name
      )?.icon ||
      `assets/specialty/${groupKey}/${name}.png`;

    const icon = $("#specialty-detail-icon");
    if (iconSrc) {
      icon.hidden = false;
      icon.src = iconSrc;
      icon.alt = `${name}圖示`;
    } else {
      icon.hidden = true;
      icon.removeAttribute("src");
    }

    $("#specialty-detail-name").textContent = name;
    $("#specialty-detail-english").textContent = (syl && syl.englishName) || "";
    $("#specialty-detail-group").textContent = groupLabel;
    const earnedEl = $("#specialty-detail-earned");
    if (earnedEl) {
      const earned = memberHasSpecialtyBadge(name, groupKey);
      earnedEl.hidden = !earned;
    }

    const meta = $("#specialty-meta");
    if (meta) meta.hidden = true;

    const sectionsEl = $("#specialty-detail-sections");
    sectionsEl.innerHTML = renderSyllabusItemsPreview((syl && syl.items) || []);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showSpecialtyDetail(index) {
    if (!currentMember) return;
    const badge = (currentMember.specialtyBadges || [])[index];
    if (!badge) return;

    const key = specialtyKeyOf(badge);
    const syl =
      (specialtySyllabus &&
        specialtySyllabus.badges &&
        specialtySyllabus.badges[key]) ||
      null;

    specialtyDetailReturnTo = "list";
    $("#specialty-list-view").hidden = true;
    $("#specialty-detail-view").hidden = false;
    const galleryView = $("#specialty-gallery-view");
    if (galleryView) galleryView.hidden = true;

    const backBtn = $("#specialty-back-btn");
    if (backBtn) backBtn.textContent = "← 返回專科徽章列表";

    const meta = $("#specialty-meta");
    if (meta) meta.hidden = false;

    const iconSrc = resolveSpecialtyIcon(badge);
    const icon = $("#specialty-detail-icon");
    if (iconSrc) {
      icon.hidden = false;
      icon.src = iconSrc;
      icon.alt = `${badge.name}圖示`;
    } else {
      icon.hidden = true;
      icon.removeAttribute("src");
    }

    $("#specialty-detail-name").textContent = badge.name;
    $("#specialty-detail-english").textContent =
      (syl && syl.englishName) || badge.englishName || "";
    const groupLabel =
      badge.category ||
      (SPECIALTY_GROUPS.find((g) => g.key === normalizeSpecialtyGroup(badge)) ||
        {}).label ||
      "";
    $("#specialty-detail-group").textContent = groupLabel;
    const earnedEl = $("#specialty-detail-earned");
    if (earnedEl) earnedEl.hidden = false;

    $("#specialty-meta-activity").textContent =
      badge.activityName || badge.name || "—";
    $("#specialty-meta-organizer").textContent = badge.organizer || "—";
    const dateIso = badge.assessmentDate || badge.earnedDate || "";
    $("#specialty-meta-date").textContent = formatDate(dateIso);
    const noticeEl = $("#specialty-meta-notice");
    if (badge.noticeUrl) {
      const label = badge.noticeTitle || "查看通告";
      noticeEl.innerHTML = `<a class="specialty-notice-link" href="${escapeHtml(badge.noticeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    } else if (normalizeSpecialtyGroup(badge) === "interest") {
      noticeEl.textContent = "經由旅團領袖考核";
    } else {
      noticeEl.textContent = "—";
    }

    const certNoEl = $("#specialty-meta-cert-no");
    if (certNoEl) {
      certNoEl.textContent = badge.certificateNumber || badge.certNo || "—";
    }
    const certCopyEl = $("#specialty-meta-cert-copy");
    if (certCopyEl) {
      const copyUrl = badge.certificateCopy || badge.certCopy || "";
      const copyLabel = badge.certificateCopyTitle || "查看證書";
      if (copyUrl) {
        certCopyEl.innerHTML = `<a class="specialty-notice-link" href="${escapeHtml(copyUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(copyLabel)}</a>`;
      } else {
        certCopyEl.textContent = "—";
      }
    }

    $("#specialty-meta-examiner").innerHTML = (() => {
      const name = badge.examiner || badge.assessor || "";
      const title = badge.examinerTitle || "";
      if (!name && !title) return "—";
      // Support legacy "姓名（職位）" stored in examiner
      let displayName = name;
      let displayTitle = title;
      if (!displayTitle && displayName) {
        const m = displayName.match(/^(.*?)[（(](.+?)[）)]\s*$/);
        if (m) {
          displayName = m[1].trim();
          displayTitle = m[2].trim();
        }
      }
      if (!displayName) return escapeHtml(displayTitle);
      if (!displayTitle) return escapeHtml(displayName);
      return `${escapeHtml(displayName)} <span class="examiner-title">${escapeHtml(displayTitle)}</span>`;
    })();

    const sectionsEl = $("#specialty-detail-sections");
    sectionsEl.innerHTML = renderSyllabusItemsPreview((syl && syl.items) || []);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderActivitySummary(member) {
    const activity = member.activity || {};
    const { rate } = getAttendanceStats(member);
    const outdoorCount = (activity.outdoorActivities || []).length;
    const summary = $("#attendance-summary");

    const icons = {
      attendance: `<span class="att-stat-icon-wrap"><svg class="att-stat-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h10V5H7zm2.3 8.7 1.4 1.4 4.3-4.3-1.4-1.4-2.9 2.9-1.1-1.1-1.4 1.4 1.1 1.1zM9 7h6v2H9V7z"/></svg></span>`,
      service: `<span class="att-stat-icon-wrap"><svg class="att-stat-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 0 1 5 5v1.1c1.7.4 3 2 3 3.9v1l2 3v2h-2.1A5 5 0 0 1 13 21h-2a5 5 0 0 1-4.9-4H4v-2l2-3v-1c0-1.9 1.3-3.5 3-3.9V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v1h6V7a3 3 0 0 0-3-3zM8 10c-.6 0-1 .4-1 1v1.4l-1.6 2.4.2.2h13l.2-.2L17 12.4V11c0-.6-.4-1-1-1H8zm1 8a3 3 0 0 0 3 2h2a3 3 0 0 0 3-2H9z"/></svg></span>`,
      camping: `<span class="att-stat-icon-wrap"><svg class="att-stat-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 2 20h5.2L12 11.2 16.8 20H22L12 3zm0 11.5L9.4 20h5.2L12 14.5z"/></svg></span>`,
      outdoor: `<span class="att-stat-icon-wrap"><svg class="att-stat-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m6.5 16 3.2-4.3 2.1 2.7 3.4-5.1L21 16H6.5zM3 18h18v2H3v-2zm11-9.5A2.5 2.5 0 1 1 16.5 6 2.5 2.5 0 0 1 14 8.5z"/></svg></span>`,
    };

    summary.innerHTML = `
      <button type="button" class="att-stat att-stat--attendance" data-activity-detail="attendance">
        ${icons.attendance}
        <span class="att-stat-body">
          <span class="att-stat-value">${rate}%</span>
          <span class="att-stat-label">出席率</span>
          <span class="att-stat-hint">查看明細</span>
        </span>
      </button>
      <button type="button" class="att-stat att-stat--service" data-activity-detail="service">
        ${icons.service}
        <span class="att-stat-body">
          <span class="att-stat-value">${activity.serviceHours || 0}</span>
          <span class="att-stat-label">服務時數</span>
          <span class="att-stat-hint">查看明細</span>
        </span>
      </button>
      <button type="button" class="att-stat att-stat--camping" data-activity-detail="camping">
        ${icons.camping}
        <span class="att-stat-body">
          <span class="att-stat-value">${activity.campingCount || 0}</span>
          <span class="att-stat-label">露營次數</span>
          <span class="att-stat-hint">查看明細</span>
        </span>
      </button>
      <button type="button" class="att-stat att-stat--outdoor" data-activity-detail="outdoor">
        ${icons.outdoor}
        <span class="att-stat-body">
          <span class="att-stat-value">${outdoorCount}</span>
          <span class="att-stat-label">戶外活動</span>
          <span class="att-stat-hint">查看明細</span>
        </span>
      </button>
    `;

    summary.querySelectorAll("[data-activity-detail]").forEach((btn) => {
      btn.addEventListener("click", () => {
        showActivityDetail(btn.dataset.activityDetail);
      });
    });
  }

  function normalizeAttendanceStatus(record) {
    if (record.status === "present" || record.status === "absent") return record.status;
    // 相容舊資料：遲到視為出席，請假視為缺席
    if (record.status === "late") return "present";
    if (record.status === "excused") return "absent";
    return "absent";
  }

  function formatAttendanceNote(record) {
    if (record.note) return record.note;
    if (record.status === "late") return "遲到";
    if (record.status === "excused") return "請假";
    return "";
  }

  function findCommonLinkByPage(pageId) {
    const commonLinks = (resources && (resources.commonLinks || resources.links)) || [];
    return commonLinks.find((link) => link.type === "page" && link.page === pageId) || null;
  }

  function renderCommonLinkItem(link) {
    const type = link.type || "link";

    if (type === "link") {
      return `
        <li class="link-item">
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
            ${
              link.icon
                ? `<img class="link-icon" src="${escapeHtml(link.icon)}" alt="" width="36" height="36" loading="lazy" decoding="async">`
                : ""
            }
            <span class="link-text">
              <span class="link-title">${escapeHtml(link.title)}</span>
            </span>
          </a>
        </li>`;
    }

    if (type === "page" && link.page) {
      return `
        <li class="link-item">
          <button type="button" class="link-page-btn" data-resources-page="${escapeHtml(link.page)}">
            ${
              link.icon
                ? `<img class="link-icon" src="${escapeHtml(link.icon)}" alt="" width="36" height="36" loading="lazy" decoding="async">`
                : ""
            }
            <span class="link-text">
              <span class="link-title">${escapeHtml(link.title)}</span>
            </span>
            <span class="link-chevron link-chevron--nav" aria-hidden="true"></span>
          </button>
        </li>`;
    }

    return "";
  }

  function renderSkillsPageContent(link) {
    const itemsHtml = (link.items || [])
      .map(
        (item) => `
        <li class="link-item">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
            <span class="link-text">
              <span class="link-title">${escapeHtml(item.title)}</span>
            </span>
          </a>
        </li>`
      )
      .join("");
    return `
      <section class="resource-block">
        <ul class="link-list">
          ${itemsHtml || `<li class="empty-state">暫無資料</li>`}
        </ul>
      </section>`;
  }

  function renderUnitsPageContent(link) {
    const groupsHtml = (link.groups || [])
      .map((group) => {
        const tiles = (group.items || [])
          .map(
            (unit) => `
            <a class="unit-tile" href="${escapeHtml(unit.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(unit.title)}">
              ${
                unit.icon
                  ? `<img class="unit-tile-icon" src="${escapeHtml(unit.icon)}" alt="${escapeHtml(unit.title)}" width="67" height="67" loading="lazy" decoding="async">`
                  : `<span class="unit-tile-fallback">${escapeHtml(unit.title.slice(0, 2))}</span>`
              }
              <span class="unit-tile-name">${escapeHtml(unit.title)}</span>
            </a>`
          )
          .join("");
        return `
          <div class="unit-group">
            <h4 class="unit-group-title">${escapeHtml(group.title)}</h4>
            <div class="unit-grid">${tiles}</div>
          </div>`;
      })
      .join("");
    return `
      <section class="resource-block">
        <div class="unit-groups">
          ${groupsHtml || `<p class="empty-state">暫無單位資料</p>`}
        </div>
      </section>`;
  }

  function showResourcesView(container, viewId) {
    if (!container) return;
    const allowed = new Set(["home", "skills", "units"]);
    const next = allowed.has(viewId) ? viewId : "home";
    container.querySelectorAll("[data-resources-view]").forEach((view) => {
      view.hidden = view.dataset.resourcesView !== next;
    });
    container.dataset.resourcesActiveView = next;
    const panel = container.closest(".tab-panel");
    const panelHeader = panel && panel.querySelector(":scope > .panel-header");
    if (panelHeader) panelHeader.hidden = next !== "home";
  }

  function showResourcesHome(targetId = "resources-content") {
    const container = $(`#${targetId}`);
    if (container) showResourcesView(container, "home");
  }

  function bindResourcesNavigation(container) {
    container.querySelectorAll("[data-resources-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        showResourcesView(container, btn.dataset.resourcesPage);
      });
    });
    container.querySelectorAll("[data-resources-back]").forEach((btn) => {
      btn.addEventListener("click", () => {
        showResourcesView(container, "home");
      });
    });
  }

  function renderResources(targetId = "resources-content") {
    const container = $(`#${targetId}`);
    if (!container) return;
    if (!resources) {
      container.innerHTML = `<p class="empty-state">暫無有用資料</p>`;
      return;
    }

    const infoHtml = (resources.troopInfo || [])
      .map(
        (item) => `
        <div class="info-row">
          <dt>${escapeHtml(item.label)}</dt>
          <dd>
            <span class="info-value">${escapeHtml(item.value)}</span>
            ${
              item.hint
                ? `<span class="info-hint">${escapeHtml(item.hint)}</span>`
                : ""
            }
          </dd>
        </div>`
      )
      .join("");

    const commonLinks = resources.commonLinks || resources.links || [];
    const linksHtml = commonLinks
      .map((link) => renderCommonLinkItem(link))
      .join("");

    const skillsLink = findCommonLinkByPage("skills");
    const unitsLink = findCommonLinkByPage("units");
    const skillsTitle = (skillsLink && skillsLink.title) || "童軍基本技能教材";
    const unitsTitle = (unitsLink && unitsLink.title) || "童軍單位網頁";

    container.innerHTML = `
      <div class="resources-view" data-resources-view="home">
        <div class="resource-grid">
          <section class="resource-block">
            <h3 class="subsection-title">旅團資訊</h3>
            <dl class="info-list">${infoHtml}</dl>
          </section>
          <section class="resource-block">
            <h3 class="subsection-title">常用連結</h3>
            <ul class="link-list">${linksHtml || `<li class="empty-state">暫無連結</li>`}</ul>
          </section>
        </div>
      </div>
      <div class="resources-view resources-subpage" data-resources-view="skills" hidden>
        <button type="button" class="btn-back" data-resources-back>← 返回常用連結</button>
        <header class="panel-header resources-subpage-header">
          <h3 class="resources-subpage-title">${escapeHtml(skillsTitle)}</h3>
        </header>
        ${skillsLink ? renderSkillsPageContent(skillsLink) : `<p class="empty-state">暫無資料</p>`}
      </div>
      <div class="resources-view resources-subpage" data-resources-view="units" hidden>
        <button type="button" class="btn-back" data-resources-back>← 返回常用連結</button>
        <header class="panel-header resources-subpage-header">
          <h3 class="resources-subpage-title">${escapeHtml(unitsTitle)}</h3>
        </header>
        ${unitsLink ? renderUnitsPageContent(unitsLink) : `<p class="empty-state">暫無單位資料</p>`}
      </div>
    `;
    showResourcesView(container, "home");
    bindResourcesNavigation(container);
  }

  /* ---------- Admin ---------- */

  function getAdminMembers() {
    return members.filter((m) => !DEMO_SCOUT_IDS.has(String(m.scoutId || "")));
  }

  function englishSurname(member) {
    const en = String(member.englishName || "").trim();
    if (!en) return "";
    return en.split(/\s+/)[0].toUpperCase();
  }

  function collectMeetingDates() {
    const map = new Map();
    for (const m of getAdminMembers()) {
      for (const r of m.attendance || []) {
        if (!r || !r.date) continue;
        if (!map.has(r.date)) {
          map.set(r.date, {
            date: r.date,
            name: r.name || "",
            type: r.type || "",
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }

  function todayISODate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getAcademicYearForDate(isoDate) {
    if (!isoDate) return null;
    for (const y of ACADEMIC_YEARS) {
      if (isoDate >= y.start && isoDate <= y.end) return y.id;
    }
    return null;
  }

  function getDefaultAcademicYear() {
    const today = todayISODate();
    const match = getAcademicYearForDate(today);
    if (match) return match;
    if (today < ACADEMIC_YEARS[0].start) return ACADEMIC_YEARS[0].id;
    return ACADEMIC_YEARS[ACADEMIC_YEARS.length - 1].id;
  }

  function resolveAdminSelectedYear() {
    const saved = sessionStorage.getItem(ADMIN_YEAR_KEY);
    if (saved && ACADEMIC_YEARS.some((y) => y.id === saved)) return saved;
    return getDefaultAcademicYear();
  }

  function filterMeetingDatesByYear(dates, yearId) {
    const year = ACADEMIC_YEARS.find((y) => y.id === yearId);
    if (!year) return dates;
    return dates.filter((d) => d.date >= year.start && d.date <= year.end);
  }

  function syncAdminYearSelect(yearId) {
    const switcher = $("#admin-year-switcher");
    if (!switcher) return;

    switcher.innerHTML = ACADEMIC_YEARS.map((y) => {
      const active = y.id === yearId;
      return `
        <button
          type="button"
          class="att-year-btn${active ? " is-active" : ""}"
          data-year="${y.id}"
          aria-pressed="${active ? "true" : "false"}"
          aria-label="${escapeHtml(y.label)}"
        >${escapeHtml(y.id)}</button>`;
    }).join("");

    switcher.querySelectorAll(".att-year-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const year = btn.dataset.year;
        if (!year || year === adminSelectedYear) return;
        adminSelectedYear = year;
        sessionStorage.setItem(ADMIN_YEAR_KEY, adminSelectedYear);
        const yearDates = filterMeetingDatesByYear(
          adminMeetingDates,
          adminSelectedYear
        );
        adminSelectedDate = yearDates.length ? yearDates[0].date : null;
        closeAdminDateListbox();
        renderAdminOverview();
      });
    });
  }

  function closeAdminDateListbox() {
    const trigger = $("#admin-date-trigger");
    const listbox = $("#admin-date-listbox");
    if (!trigger || !listbox) return;
    listbox.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function openAdminDateListbox() {
    const trigger = $("#admin-date-trigger");
    const listbox = $("#admin-date-listbox");
    if (!trigger || !listbox || trigger.disabled) return;
    listbox.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    const selected = listbox.querySelector('[aria-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }

  function toggleAdminDateListbox() {
    const listbox = $("#admin-date-listbox");
    if (!listbox) return;
    if (listbox.hidden) openAdminDateListbox();
    else closeAdminDateListbox();
  }

  function syncAdminDateCombo(yearDates) {
    const trigger = $("#admin-date-trigger");
    const listbox = $("#admin-date-listbox");
    const dateLine = $("#admin-date-trigger-date");
    const nameLine = $("#admin-date-trigger-name");
    if (!trigger || !listbox || !dateLine || !nameLine) return;

    closeAdminDateListbox();

    if (!yearDates.length) {
      dateLine.textContent = "";
      nameLine.textContent = "";
      nameLine.hidden = true;
      listbox.innerHTML = "";
      trigger.disabled = true;
      trigger.removeAttribute("aria-label");
      return;
    }

    trigger.disabled = false;
    const selected =
      yearDates.find((d) => d.date === adminSelectedDate) || yearDates[0];
    const dateLabel = formatDateYMD(selected.date);
    dateLine.textContent = dateLabel;
    if (selected.name) {
      nameLine.textContent = selected.name;
      nameLine.hidden = false;
      trigger.setAttribute("aria-label", `${dateLabel} ${selected.name}`);
    } else {
      nameLine.textContent = "";
      nameLine.hidden = true;
      trigger.setAttribute("aria-label", dateLabel);
    }

    listbox.innerHTML = yearDates
      .map((d) => {
        const isSelected = d.date === adminSelectedDate;
        const nameHtml = d.name
          ? `<span class="admin-date-line admin-date-line-name">${escapeHtml(d.name)}</span>`
          : "";
        return `
          <li
            role="option"
            class="admin-date-option${isSelected ? " is-selected" : ""}"
            data-date="${escapeHtml(d.date)}"
            aria-selected="${isSelected ? "true" : "false"}"
          >
            <span class="admin-date-line admin-date-line-date">${escapeHtml(formatDateYMD(d.date))}</span>
            ${nameHtml}
          </li>`;
      })
      .join("");

    trigger.onclick = (e) => {
      e.stopPropagation();
      toggleAdminDateListbox();
    };

    listbox.onclick = (e) => {
      const option = e.target.closest("[data-date]");
      if (!option) return;
      e.stopPropagation();
      const date = option.dataset.date;
      if (!date || date === adminSelectedDate) {
        closeAdminDateListbox();
        return;
      }
      adminSelectedDate = date;
      closeAdminDateListbox();
      renderAdminOverview();
    };
  }

  function initAdminDateCombo() {
    document.addEventListener("click", (e) => {
      const combo = $("#admin-date-combo");
      if (!combo || combo.contains(e.target)) return;
      closeAdminDateListbox();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAdminDateListbox();
    });
  }

  function rankSortValue(rank) {
    if (RANK_ORDER[rank] != null) return RANK_ORDER[rank];
    return 99;
  }

  function sortMembersForPatrol(list) {
    return [...list].sort((a, b) => {
      const rd = rankSortValue(a.rank) - rankSortValue(b.rank);
      if (rd !== 0) return rd;
      const joinA = a.joinDate || "9999-99-99";
      const joinB = b.joinDate || "9999-99-99";
      if (joinA !== joinB) return joinA.localeCompare(joinB);
      const surA = englishSurname(a);
      const surB = englishSurname(b);
      if (surA !== surB) return surA.localeCompare(surB, "en");
      return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
    });
  }

  function getMemberAttendanceOnDate(member, date) {
    return (member.attendance || []).find((r) => r.date === date) || null;
  }

  function memberJoinedByDate(member, date) {
    const join = member.joinDate;
    if (!join || !date) return true;
    return join <= date;
  }

  function cancelAdminChartAnimations() {
    for (const id of adminChartAnimFrames) cancelAnimationFrame(id);
    adminChartAnimFrames.clear();
  }

  function animateAdminCharts(overallRate, presentPct, absentPct, sectionRates) {
    cancelAdminChartAnimations();
    const chart = $("#admin-att-ring-chart");
    const valueEl = $("#admin-att-ring-value");
    const fills = $$("[data-admin-bar-target]");
    const duration = 2000;
    const start = performance.now();

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function paint(e) {
      if (chart && valueEl) {
        const p = presentPct * e;
        const a = absentPct * e;
        chart.style.background = `conic-gradient(
          var(--green-mid) 0 ${p}%,
          #c45c5c ${p}% ${p + a}%,
          var(--cream-warm) ${p + a}% 100%
        )`;
        valueEl.textContent = `${Math.round(overallRate * e)}%`;
      }
      fills.forEach((el, i) => {
        const target = Number(sectionRates[i]) || 0;
        el.style.width = `${target * e}%`;
        const valueNode = el
          .closest(".admin-bar-item")
          ?.querySelector("[data-admin-bar-rate]");
        if (valueNode) {
          const present = valueNode.dataset.present || "0";
          const total = valueNode.dataset.total || "0";
          valueNode.textContent = `${Math.round(target * e)}%（${present}/${total}）`;
        }
      });
    }

    paint(0);

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);
      paint(e);
      if (t < 1) {
        const id = requestAnimationFrame(frame);
        adminChartAnimFrames.add(id);
      } else {
        paint(1);
        adminChartAnimFrames.clear();
      }
    }

    const id = requestAnimationFrame(frame);
    adminChartAnimFrames.add(id);
  }

  function showAdminDashboard(adminAccount) {
    isAdminSession = true;
    currentMember = null;
    loginView.hidden = true;
    dashboardView.hidden = true;
    exitAdminMemberPreview(false);
    if (adminView) adminView.hidden = false;

    const session = getSession();
    const admin =
      adminAccount ||
      (session && findAdminAccount(session.name, session.scoutId)) ||
      ADMIN_ACCOUNTS[0];

    const headerName = $("#admin-header-name");
    if (headerName) headerName.textContent = admin.name;

    const profileName = $("#admin-profile-name-text");
    if (profileName) profileName.textContent = admin.name;
    else {
      const heading = $("#admin-profile-heading");
      if (heading) {
        const nameSpan = heading.querySelector("span:not(.profile-rank)");
        if (nameSpan) nameSpan.textContent = admin.name;
      }
    }

    const adminAvatar = $("#admin-profile-avatar");
    if (adminAvatar) {
      if (admin.photo) {
        adminAvatar.classList.add("has-photo");
        adminAvatar.setAttribute("aria-hidden", "false");
        adminAvatar.innerHTML = `<img src="${escapeHtml(admin.photo)}" alt="${escapeHtml(admin.name)}的成員照片" width="120" height="150" />`;
      } else {
        adminAvatar.classList.remove("has-photo");
        adminAvatar.setAttribute("aria-hidden", "true");
        adminAvatar.textContent = initials(admin.name);
      }
    }

    adminMeetingDates = collectMeetingDates();
    adminSelectedYear = resolveAdminSelectedYear();
    sessionStorage.setItem(ADMIN_YEAR_KEY, adminSelectedYear);

    const yearDates = filterMeetingDatesByYear(
      adminMeetingDates,
      adminSelectedYear
    );
    if (
      !adminSelectedDate ||
      !yearDates.some((d) => d.date === adminSelectedDate)
    ) {
      adminSelectedDate = yearDates.length ? yearDates[0].date : null;
    }

    renderAdminOverview();
    renderAdminMembersGrid();
    renderAdminProgressiveOverview();
    renderResources("admin-resources-content");

    const savedTab = sessionStorage.getItem(ADMIN_TAB_KEY) || "overview";
    switchAdminTab(savedTab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function switchAdminTab(tabId) {
    const tabs = $$("[data-admin-tab]");
    const panels = {
      overview: $("#panel-admin-overview"),
      members: $("#panel-admin-members"),
      resources: $("#panel-admin-resources"),
      "progressive-overview": $("#panel-admin-progressive-overview"),
    };
    if (!panels[tabId]) tabId = "overview";
    sessionStorage.setItem(ADMIN_TAB_KEY, tabId);

    for (const btn of tabs) {
      const active = btn.dataset.adminTab === tabId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
    }
    for (const [key, panel] of Object.entries(panels)) {
      if (!panel) continue;
      const active = key === tabId;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    }
    if (tabId !== "resources") showResourcesHome("admin-resources-content");
    if (tabId === "progressive-overview") renderAdminProgressiveOverview();
  }

  function initAdminTabs() {
    const nav = $(".admin-tab-nav");
    if (!nav) return;
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-admin-tab]");
      if (!btn) return;
      switchAdminTab(btn.dataset.adminTab);
    });
  }

  function renderAdminOverview() {
    const comboEl = $("#admin-date-combo");
    const statsEl = $("#admin-overview-stats");
    const tableEl = $("#admin-overview-table");
    if (!comboEl || !statsEl || !tableEl) return;

    cancelAdminChartAnimations();
    const adminMembers = getAdminMembers();

    if (!adminSelectedYear) {
      adminSelectedYear = resolveAdminSelectedYear();
    }
    syncAdminYearSelect(adminSelectedYear);

    const yearDates = filterMeetingDatesByYear(
      adminMeetingDates,
      adminSelectedYear
    );

    if (!yearDates.length) {
      syncAdminDateCombo([]);
      statsEl.innerHTML = "";
      tableEl.innerHTML = `<p class="empty-state">${
        adminMeetingDates.length
          ? "此學年暫無出席紀錄"
          : "暫無出席紀錄"
      }</p>`;
      return;
    }

    if (
      !adminSelectedDate ||
      !yearDates.some((d) => d.date === adminSelectedDate)
    ) {
      adminSelectedDate = yearDates[0].date;
    }

    syncAdminDateCombo(yearDates);

    const selectedMeta =
      yearDates.find((d) => d.date === adminSelectedDate) || {};

    const eligibleMembers = adminMembers.filter((m) =>
      memberJoinedByDate(m, adminSelectedDate)
    );

    const sectionBuckets = new Map();
    for (const sec of SECTION_ORDER) sectionBuckets.set(sec, []);
    for (const m of eligibleMembers) {
      const sec = m.section || "其他";
      if (!sectionBuckets.has(sec)) sectionBuckets.set(sec, []);
      sectionBuckets.get(sec).push(m);
    }

    const sectionStats = [];
    const tableBodyParts = [];
    let overallPresent = 0;
    let overallTotal = 0;

    const orderedSections = [
      ...SECTION_ORDER.filter((s) => (sectionBuckets.get(s) || []).length),
      ...[...sectionBuckets.keys()].filter((s) => !SECTION_ORDER.includes(s)),
    ];

    for (const sec of orderedSections) {
      const list = sortMembersForPatrol(sectionBuckets.get(sec) || []);
      if (!list.length) continue;

      let present = 0;
      const memberRows = [];
      const countsForOverall = OVERALL_RATE_SECTIONS.has(sec);
      for (const m of list) {
        const rec = getMemberAttendanceOnDate(m, adminSelectedDate);
        const status = rec ? normalizeAttendanceStatus(rec) : "absent";
        const note = rec ? formatAttendanceNote(rec) : "";
        if (status === "present") present += 1;
        if (countsForOverall) {
          overallTotal += 1;
          if (status === "present") overallPresent += 1;
        }
        memberRows.push(`
          <tr>
            <td>${escapeHtml(m.name || "—")}</td>
            <td>${escapeHtml(m.rank || "—")}</td>
            <td><span class="att-status status-${status}">${ATTENDANCE_LABELS[status]}</span></td>
            <td class="att-note">${note ? escapeHtml(note) : "—"}</td>
          </tr>`);
      }

      const total = list.length;
      const rate = total ? Math.round((present / total) * 100) : 0;
      sectionStats.push({ section: sec, present, total, rate });

      tableBodyParts.push(`
        <tr class="admin-section-row">
          <td colspan="4">${escapeHtml(sec)}（出席 ${present}/${total} · ${rate}%）</td>
        </tr>
        ${memberRows.join("")}
      `);
    }

    const overallRate = overallTotal
      ? Math.round((overallPresent / overallTotal) * 100)
      : 0;
    const overallAbsent = Math.max(0, overallTotal - overallPresent);
    const presentPct = overallTotal ? (overallPresent / overallTotal) * 100 : 0;
    const absentPct = overallTotal ? (overallAbsent / overallTotal) * 100 : 0;

    statsEl.innerHTML = `
      <div class="admin-charts">
        <div class="admin-chart-ring-wrap">
          <div class="att-ring admin-att-ring" role="img" aria-label="全體出席率 ${overallRate}%，出席 ${overallPresent} 人，缺席 ${overallAbsent} 人，共 ${overallTotal} 人">
            <div class="att-ring-chart" id="admin-att-ring-chart" style="background: conic-gradient(var(--cream-warm) 0 100%);">
              <div class="att-ring-hole">
                <span class="att-ring-value" id="admin-att-ring-value">0%</span>
                <span class="att-ring-label">全體出席率</span>
              </div>
            </div>
          </div>
          <p class="admin-ring-caption">出席 ${overallPresent}／${overallTotal} 人</p>
        </div>
        <div class="admin-chart-bars-wrap">
          <h3 class="admin-chart-title">各小隊出席率</h3>
          <ul class="admin-bar-list" aria-label="各小隊出席率">
            ${sectionStats
              .map(
                (s) => `
                <li class="admin-bar-item">
                  <div class="admin-bar-meta">
                    <span class="admin-bar-label">${escapeHtml(s.section)}</span>
                    <span class="admin-bar-value" data-admin-bar-rate data-present="${s.present}" data-total="${s.total}">0%（${s.present}/${s.total}）</span>
                  </div>
                  <div class="admin-bar-track" aria-hidden="true">
                    <div class="admin-bar-fill" data-admin-bar-target="${s.rate}" style="width:0%"></div>
                  </div>
                </li>`
              )
              .join("")}
          </ul>
        </div>
      </div>
    `;

    tableEl.innerHTML = tableBodyParts.length
      ? `
      <table class="admin-overview-table" aria-label="${escapeHtml(selectedMeta.name || "成員出席紀錄")}">
        <thead>
          <tr>
            <th>姓名</th>
            <th>職級</th>
            <th>出席</th>
            <th>備註</th>
          </tr>
        </thead>
        <tbody>${tableBodyParts.join("")}</tbody>
      </table>`
      : `<p class="empty-state">該次活動尚無已加入的成員紀錄</p>`;

    animateAdminCharts(
      overallRate,
      presentPct,
      absentPct,
      sectionStats.map((s) => s.rate)
    );
  }

  function renderAdminMembersGrid() {
    const grid = $("#admin-members-grid");
    if (!grid) return;

    const leaderRanks = new Set(["團隊長", "隊長", "副隊", "副隊長"]);

    function memberCard(m) {
      const avatar = m.photo
        ? `<span class="admin-member-avatar has-photo"><img src="${escapeHtml(m.photo)}" alt="${escapeHtml(m.name)}" width="103" height="103" loading="lazy"${photoPositionStyle(m)} /></span>`
        : `<span class="admin-member-avatar" aria-hidden="true">${escapeHtml(initials(m.name))}</span>`;
      return `
        <button type="button" class="admin-member-card" data-admin-member-id="${escapeHtml(m.scoutId)}">
          ${avatar}
          <span class="admin-member-name">${escapeHtml(m.name)}</span>
          <span class="admin-member-rank">${escapeHtml(m.rank || "")}</span>
        </button>`;
    }

    const bySection = new Map();
    for (const m of getAdminMembers()) {
      const sec = m.section || "其他";
      if (!bySection.has(sec)) bySection.set(sec, []);
      bySection.get(sec).push(m);
    }

    const orderedSections = [
      ...SECTION_ORDER.filter((s) => bySection.has(s)),
      ...[...bySection.keys()].filter((s) => !SECTION_ORDER.includes(s)),
    ];

    grid.innerHTML = orderedSections
      .map((sec) => {
        const list = sortMembersForPatrol(bySection.get(sec) || []);
        const leaders = list.filter((m) => leaderRanks.has(m.rank));
        const others = list.filter((m) => !leaderRanks.has(m.rank));
        return `
          <section class="admin-patrol-block" aria-label="${escapeHtml(sec)}">
            <h3 class="admin-patrol-title">${escapeHtml(sec)}</h3>
            <div class="admin-patrol-layout">
              <div class="admin-patrol-leaders" aria-label="隊長及副隊長">
                ${leaders.map(memberCard).join("")}
              </div>
              <div class="admin-patrol-members" aria-label="隊員">
                ${others.map(memberCard).join("")}
              </div>
            </div>
          </section>`;
      })
      .join("");

    grid.querySelectorAll("[data-admin-member-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const member = getAdminMembers().find(
          (m) => m.scoutId === btn.dataset.adminMemberId
        );
        if (member) openAdminMemberPreview(member);
      });
    });
  }

  /** Flatten syllabus items for overview columns (land elective track only). */
  function stripProgOverviewElectiveMark(text) {
    return String(text || "")
      .replace(/[（(]\s*選修項目\s*[）)]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isHiddenProgOverviewElectiveTrack(sub) {
    const title = String(sub?.title || "");
    // Hide sea / aviation elective tracks; keep land「戶外活動」track
    return /海上活動|航空活動/.test(title);
  }

  function formatProgOverviewSectionFullLabel(code, title) {
    const c = String(code || "").trim().replace(/\.$/, "");
    const t = stripProgOverviewElectiveMark(title);
    if (c && t) return `${c}.${t.replace(/^\s+/, "")}`;
    return t || (c ? `${c}.` : "");
  }

  function formatProgOverviewLabel(code, title) {
    // Header shows full section title (A.戶外挑戰); still strip elective mark
    return formatProgOverviewSectionFullLabel(code, title);
  }

  function formatProgOverviewSubLabel(title) {
    const t = stripProgOverviewElectiveMark(title);
    // Header shows number mark only (1 / 2 …); full text stays in hover / detail sheet
    const m = t.match(/^(\d+)\./);
    if (m) return `${m[1]}`;
    return t;
  }

  function formatProgOverviewItemLabel(title, short) {
    const t = String(title || "").trim();
    // Header shows letter mark only (a / b …); full text stays in hover / detail sheet
    const fromTitle = t.match(/^([a-zA-Z])\./);
    if (fromTitle) return `${fromTitle[1].toLowerCase()}`;
    const fromShort = String(short || "").match(/([a-zA-Z])$/);
    if (fromShort) return `${fromShort[1].toLowerCase()}`;
    return short || t || "";
  }

  function collectProgOverviewColumns(syl) {
    const columns = [];
    if (!syl?.sections) return columns;
    for (const section of syl.sections) {
      const sectionKey = section.id || section.code || section.title;
      const sectionLabel = formatProgOverviewLabel(section.code, section.title);
      const sectionFullLabel = formatProgOverviewSectionFullLabel(
        section.code,
        section.title
      );
      for (const sub of section.subsections || []) {
        if (isHiddenProgOverviewElectiveTrack(sub)) continue;
        const subNum = (String(sub.title || "").match(/^(\d+)/) || [])[1] || "";
        const subsectionKey = sub.id || sub.title || `${sectionKey}-${subNum}`;
        const subsectionLabel = formatProgOverviewSubLabel(sub.title);
        for (const item of sub.items || []) {
          const letter =
            (String(item.title || "").match(/^([a-zA-Z])\./) || [])[1] || "";
          const itemNum =
            (String(item.title || "").match(/^(\d+)\./) || [])[1] || "";
          const fromId =
            (String(item.id || "").match(/(\d+[a-zA-Z])$/) || [])[1] || "";
          const short =
            subNum && letter
              ? `${subNum}${letter.toLowerCase()}`
              : itemNum
                ? `${itemNum}a`
                : letter || fromId || item.id;
          const name = String(item.title || "").trim() || short;
          const details = (item.details || [])
            .map((d) => String(d || "").trim())
            .filter(Boolean);
          columns.push({
            id: item.id,
            short,
            name,
            itemLabel: formatProgOverviewItemLabel(name, short),
            details,
            sectionCode: section.code || "",
            sectionTitle: section.title || "",
            sectionKey,
            sectionLabel,
            sectionFullLabel,
            subsectionKey,
            subsectionLabel,
            subsectionTitle: stripProgOverviewElectiveMark(sub.title),
            fullTitle: [stripProgOverviewElectiveMark(sub.title), name]
              .filter(Boolean)
              .join(" · "),
          });
        }
      }
    }
    return columns;
  }

  function buildAdminProgItemTipHtml(col) {
    const tipLines = [col.name, ...(col.details || [])].filter(Boolean);
    if (!tipLines.length) {
      return `<span class="admin-prog-tip-line">暫無詳細考核內容</span>`;
    }
    return tipLines
      .map(
        (line, i) =>
          `<span class="admin-prog-tip-line${i === 0 ? " is-title" : ""}">${escapeHtml(line)}</span>`
      )
      .join("");
  }

  function hideAdminProgItemHoverTip() {
    const tip = document.getElementById("admin-prog-hover-tip");
    if (tip) tip.remove();
  }

  let adminProgCompletedPopoverCloser = null;

  function hideAdminProgCompletedPopover() {
    const tip = document.getElementById("admin-prog-completed-tip");
    if (tip) tip.remove();
    if (adminProgCompletedPopoverCloser) {
      document.removeEventListener("click", adminProgCompletedPopoverCloser, true);
      document.removeEventListener("keydown", adminProgCompletedPopoverCloser);
      adminProgCompletedPopoverCloser = null;
    }
  }

  function showAdminProgCompletedPopover(anchor, dateIso) {
    if (!anchor) return;
    hideAdminProgCompletedPopover();
    hideAdminProgItemHoverTip();
    const tip = document.createElement("div");
    tip.id = "admin-prog-completed-tip";
    tip.className = "admin-prog-completed-tip";
    tip.setAttribute("role", "status");
    tip.textContent = dateIso ? `完成日期：${formatDate(dateIso)}` : "已完成";
    document.body.appendChild(tip);

    const rect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const gap = 6;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    let top = rect.top - tipRect.height - gap;
    if (top < 8) top = rect.bottom + gap;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;

    adminProgCompletedPopoverCloser = (e) => {
      if (e.type === "keydown" && e.key !== "Escape") return;
      if (e.type === "click" && tip.contains(e.target)) return;
      if (e.type === "click" && anchor.contains(e.target)) return;
      hideAdminProgCompletedPopover();
    };
    // Defer so the opening click does not immediately close the tip
    requestAnimationFrame(() => {
      document.addEventListener("click", adminProgCompletedPopoverCloser, true);
      document.addEventListener("keydown", adminProgCompletedPopoverCloser);
    });
  }

  function showAdminProgItemHoverTip(anchor, col) {
    if (!anchor || !col) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    hideAdminProgItemHoverTip();
    const tip = document.createElement("div");
    tip.id = "admin-prog-hover-tip";
    tip.className = "admin-prog-hover-tip";
    tip.setAttribute("role", "tooltip");
    tip.innerHTML = buildAdminProgItemTipHtml(col);
    document.body.appendChild(tip);

    const rect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const gap = 8;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    let top = rect.bottom + gap;
    if (top + tipRect.height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - tipRect.height - gap);
    }
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function closeAdminProgItemDetail() {
    const backdrop = document.getElementById("admin-prog-detail-backdrop");
    if (backdrop) backdrop.remove();
    document.body.classList.remove("admin-prog-detail-open");
  }

  function openAdminProgItemDetail(col) {
    if (!col) return;
    hideAdminProgItemHoverTip();
    hideAdminProgCompletedPopover();
    closeAdminProgItemDetail();
    const detailsHtml = (col.details || []).length
      ? `<ul class="admin-prog-detail-list">${col.details
          .map((d) => `<li>${escapeHtml(d)}</li>`)
          .join("")}</ul>`
      : `<p class="admin-prog-detail-empty">暫無詳細考核內容</p>`;
    const backdrop = document.createElement("div");
    backdrop.id = "admin-prog-detail-backdrop";
    backdrop.className = "admin-prog-detail-backdrop";
    backdrop.innerHTML = `
      <div class="admin-prog-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="admin-prog-detail-title">
        <div class="admin-prog-detail-head">
          <div class="admin-prog-detail-kicker">
            <span>${escapeHtml(col.sectionFullLabel || col.sectionLabel || "")}</span>
            <span>${escapeHtml(col.subsectionTitle || col.subsectionLabel || "")}</span>
          </div>
          <h3 id="admin-prog-detail-title" class="admin-prog-detail-title">${escapeHtml(col.name || col.itemLabel || "")}</h3>
          <button type="button" class="admin-prog-detail-close" aria-label="關閉詳情">×</button>
        </div>
        <div class="admin-prog-detail-body">${detailsHtml}</div>
      </div>`;
    document.body.appendChild(backdrop);
    document.body.classList.add("admin-prog-detail-open");

    const sheet = backdrop.querySelector(".admin-prog-detail-sheet");
    const closeBtn = backdrop.querySelector(".admin-prog-detail-close");
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeAdminProgItemDetail();
        document.removeEventListener("keydown", onKey);
      }
    };
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeAdminProgItemDetail();
    });
    closeBtn?.addEventListener("click", () => closeAdminProgItemDetail());
    sheet?.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("keydown", onKey);
    closeBtn?.focus();
  }

  function renderAdminProgressiveOverview() {
    const root = $("#admin-progressive-overview");
    if (!root) return;

    const adminMembers = getAdminMembers();
    if (!adminMembers.length) {
      root.innerHTML = `<p class="empty-state">暫無成員資料</p>`;
      return;
    }

    if (!PROG_OVERVIEW_BADGES.some((b) => b.key === adminProgOverviewBadgeKey)) {
      adminProgOverviewBadgeKey = "discovery";
    }

    const selectedBadge =
      PROG_OVERVIEW_BADGES.find((b) => b.key === adminProgOverviewBadgeKey) ||
      PROG_OVERVIEW_BADGES[0];
    const syl = syllabus && syllabus[selectedBadge.key];
    if (!syl) {
      root.innerHTML = `<p class="empty-state">無法載入獎章綱要</p>`;
      return;
    }

    const columns = collectProgOverviewColumns(syl);
    const colCount = columns.length + 3; // 姓名 + 分項… + 完成項目 + 完成度
    const memberCount = adminMembers.length;

    // Section / subsection colspan must equal visible item count (after hiding sea/air).
    const sectionGroups = [];
    const subsectionGroups = [];
    for (const col of columns) {
      const lastSec = sectionGroups[sectionGroups.length - 1];
      if (lastSec && lastSec.key === col.sectionKey) {
        lastSec.span += 1;
      } else {
        sectionGroups.push({
          key: col.sectionKey,
          label: col.sectionLabel,
          title: col.sectionFullLabel || col.sectionLabel,
          span: 1,
        });
      }
      const lastSub = subsectionGroups[subsectionGroups.length - 1];
      if (lastSub && lastSub.key === col.subsectionKey) {
        lastSub.span += 1;
      } else {
        subsectionGroups.push({
          key: col.subsectionKey,
          label: col.subsectionLabel,
          title: col.subsectionTitle || col.subsectionLabel,
          span: 1,
        });
      }
    }

    const bySection = new Map();
    for (const m of adminMembers) {
      const sec = m.section || "其他";
      if (!bySection.has(sec)) bySection.set(sec, []);
      bySection.get(sec).push(m);
    }

    const orderedSections = [
      ...SECTION_ORDER.filter((s) => bySection.has(s)),
      ...[...bySection.keys()].filter((s) => !SECTION_ORDER.includes(s)),
    ];

    const itemDoneCounts = columns.map(() => 0);
    let pctSum = 0;
    let doneSum = 0;

    const bodyRows = [];
    for (const sec of orderedSections) {
      const list = sortMembersForPatrol(bySection.get(sec) || []);
      if (!list.length) continue;
      bodyRows.push(`
        <tr class="admin-section-row">
          <td colspan="${colCount}"><span class="admin-prog-patrol-label">${escapeHtml(sec)}（${list.length} 人）</span></td>
        </tr>`);
      for (const m of list) {
        const badge = (m.progressiveBadges || []).find(
          (b) => b.key === selectedBadge.key
        );
        const completed = new Set(badge?.completedIds || []);
        const dates = badge?.itemCompletedDates || {};
        const { done, total, pct } = progressOf({
          key: selectedBadge.key,
          completedIds: badge?.completedIds || [],
        });
        pctSum += pct;
        doneSum += done;
        const cells = columns
          .map((col, colIdx) => {
            const isDone = completed.has(col.id);
            if (isDone) itemDoneCounts[colIdx] += 1;
            const completedOn = isDone && dates[col.id] ? dates[col.id] : null;
            const tip = isDone
              ? completedOn
                ? `${col.fullTitle} · 已考獲（${formatDate(completedOn)}）`
                : `${col.fullTitle} · 已考獲`
              : `${col.fullTitle} · 未考獲`;
            if (isDone) {
              const dateAttr = completedOn
                ? ` data-completed-date="${escapeHtml(completedOn)}"`
                : "";
              const markLabel = completedOn
                ? `已考獲，完成日期 ${formatDate(completedOn)}`
                : "已考獲";
              return `<td class="admin-prog-item-cell is-done" title="${escapeHtml(tip)}">
                <button type="button" class="badge-earned-mark admin-prog-item-mark" data-prog-done-mark${dateAttr} aria-label="${escapeHtml(markLabel)}" title="${escapeHtml(markLabel)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.2 16.6 4.8 12.2l1.4-1.4 3 3 8-8 1.4 1.4-9.4 9.4z"/></svg></button>
              </td>`;
            }
            return `<td class="admin-prog-item-cell is-pending" title="${escapeHtml(tip)}">
              <span class="admin-prog-item-empty" aria-label="未考獲">—</span>
            </td>`;
          })
          .join("");
        const doneTip = `${selectedBadge.label}完成項目 ${done}/${total}`;
        const pctTip = `${selectedBadge.label}完成度 ${pct}%（${done}/${total}）`;
        bodyRows.push(`
          <tr class="admin-prog-member-row">
            <th scope="row" class="admin-prog-name">
              <button type="button" class="admin-prog-name-btn" data-admin-member-id="${escapeHtml(m.scoutId)}" aria-label="查看 ${escapeHtml(m.name || "")} 進度性獎章">
                ${escapeHtml(m.name || "—")}
              </button>
            </th>
            ${cells}
            <td class="admin-prog-done-cell" title="${escapeHtml(doneTip)}">
              <span class="admin-prog-pct-value">${done}</span>
            </td>
            <td class="admin-prog-pct-cell" title="${escapeHtml(pctTip)}">
              <span class="admin-prog-pct-value">${pct}%</span>
            </td>
          </tr>`);
      }
    }

    const avgPct = memberCount ? Math.round(pctSum / memberCount) : 0;
    // Average completed-item count (same basis as avgPct); mirrors per-member「完成項目」.
    const avgDone = memberCount ? Math.round(doneSum / memberCount) : 0;
    const countCells = columns
      .map((col, colIdx) => {
        const doneN = itemDoneCounts[colIdx];
        const tip = `${col.fullTitle} · 全體考獲 ${doneN}/${memberCount}`;
        return `<td class="admin-prog-item-cell admin-prog-completion-cell" title="${escapeHtml(tip)}">
          <span class="admin-prog-pct-value">${doneN}</span>
        </td>`;
      })
      .join("");
    const pctCells = columns
      .map((col, colIdx) => {
        const doneN = itemDoneCounts[colIdx];
        const itemPct = memberCount ? Math.round((doneN / memberCount) * 100) : 0;
        const tip = `${col.fullTitle} · 全體完成度 ${itemPct}%（${doneN}/${memberCount}）`;
        return `<td class="admin-prog-item-cell admin-prog-completion-cell" title="${escapeHtml(tip)}">
          <span class="admin-prog-pct-value">${itemPct}%</span>
        </td>`;
      })
      .join("");
    const avgDoneTip = `${selectedBadge.label} · 全體平均完成項目 ${avgDone}`;
    const avgPctTip = `${selectedBadge.label} · 全體平均完成度 ${avgPct}%`;
    bodyRows.push(`
      <tr class="admin-prog-completion-row admin-prog-completion-count-row">
        <th scope="row" class="admin-prog-name admin-prog-completion-label">完成人數</th>
        ${countCells}
        <td class="admin-prog-done-cell admin-prog-avg-cell" rowspan="2" title="${escapeHtml(avgDoneTip)}">
          <span class="admin-prog-pct-value">${avgDone}</span>
          <span class="admin-prog-pct-detail">平均</span>
        </td>
        <td class="admin-prog-pct-cell admin-prog-avg-cell" rowspan="2" title="${escapeHtml(avgPctTip)}">
          <span class="admin-prog-pct-value">${avgPct}%</span>
          <span class="admin-prog-pct-detail">平均</span>
        </td>
      </tr>
      <tr class="admin-prog-completion-row admin-prog-completion-pct-row">
        <th scope="row" class="admin-prog-name admin-prog-completion-label">完成度</th>
        ${pctCells}
      </tr>`);

    const switcher = PROG_OVERVIEW_BADGES.map((b) => {
      const iconSrc =
        (syllabus && syllabus[b.key] && syllabus[b.key].icon) ||
        b.icon ||
        BADGE_ICONS[b.key] ||
        "";
      const iconHtml = iconSrc
        ? `<img class="admin-prog-badge-switcher-icon" src="${escapeHtml(iconSrc)}" alt="" width="22" height="22" decoding="async" />`
        : "";
      return `
        <button
          type="button"
          class="att-year-btn${b.key === adminProgOverviewBadgeKey ? " is-active" : ""}"
          data-prog-badge-key="${b.key}"
          aria-label="${escapeHtml(b.label)}"
          aria-pressed="${b.key === adminProgOverviewBadgeKey ? "true" : "false"}"
        >${iconHtml}<span class="admin-prog-badge-switcher-text">${escapeHtml(b.short)}</span></button>`;
    }).join("");

    const sectionHead = sectionGroups
      .map(
        (g) =>
          `<th class="admin-prog-section-head" colspan="${g.span}" title="${escapeHtml(g.title || g.label)}">
            <span class="admin-prog-section-label">${escapeHtml(g.label)}</span>
          </th>`
      )
      .join("");

    // Merge consecutive same-subsection columns; number appears once, centered across span.
    const subsectionHead = subsectionGroups
      .map(
        (g) =>
          `<th class="admin-prog-subsection-head" colspan="${g.span}" title="${escapeHtml(g.title || g.label)}">
            <span class="admin-prog-subsection-label">${escapeHtml(g.label || "")}</span>
          </th>`
      )
      .join("");

    const itemHead = columns
      .map(
        (col, idx) =>
          `<th class="admin-prog-item-head" scope="col">
            <button type="button" class="admin-prog-item-trigger" data-prog-col-idx="${idx}" aria-label="查看 ${escapeHtml(col.name || col.itemLabel || "考核分項")} 詳情">
              <span class="admin-prog-item-label">${escapeHtml(col.itemLabel || col.short || "")}</span>
            </button>
          </th>`
      )
      .join("");

    const tableWidthRem = (5.5 + columns.length * 3.5 + 3.5 + 3.5).toFixed(1);

    root.innerHTML = `
      <div class="admin-prog-overview-toolbar">
        <div class="admin-prog-badge-switcher att-year-switcher" role="group" aria-label="選擇獎章">
          ${switcher}
        </div>
        <div class="admin-prog-zoom" role="group" aria-label="表格縮放">
          <button type="button" class="admin-prog-zoom-btn" data-prog-zoom="-1" aria-label="縮小表格">−</button>
          <button type="button" class="admin-prog-zoom-label" data-prog-zoom-reset data-prog-zoom-label aria-label="目前縮放 100%，點按重設為 100%">100%</button>
          <button type="button" class="admin-prog-zoom-btn" data-prog-zoom="1" aria-label="放大表格">＋</button>
        </div>
      </div>
      <p class="admin-prog-selected-hint">目前顯示：${escapeHtml(selectedBadge.label)} · 共 ${columns.length} 個考核分項 · 桌機懸停／手機點按分項可看詳情</p>
      <div class="admin-overview-table-wrap admin-prog-table-wrap">
        <div class="admin-prog-table-scale-slot">
          <div class="admin-prog-table-scale">
            <table class="admin-overview-table admin-prog-item-matrix" style="--admin-prog-item-cols: ${columns.length}; --admin-prog-table-width: ${tableWidthRem}rem" aria-label="${escapeHtml(selectedBadge.label)}分項進度總覽">
              <colgroup>
                <col class="admin-prog-col-name" style="width: 5.5rem" />
                ${columns.map(() => `<col class="admin-prog-col-item" style="width: 3.5rem" />`).join("")}
                <col class="admin-prog-col-done" style="width: 3.5rem" />
                <col class="admin-prog-col-pct" style="width: 3.5rem" />
              </colgroup>
              <thead>
                <tr>
                  <th class="admin-prog-name-head" rowspan="3">姓名</th>
                  ${sectionHead}
                  <th class="admin-prog-done-head" rowspan="3">完成項目</th>
                  <th class="admin-prog-pct-head" rowspan="3">完成度</th>
                </tr>
                <tr>
                  ${subsectionHead}
                </tr>
                <tr>
                  ${itemHead}
                </tr>
              </thead>
              <tbody>${bodyRows.join("") || `<tr><td colspan="${colCount}" class="empty-state">暫無成員資料</td></tr>`}</tbody>
            </table>
          </div>
        </div>
      </div>`;

    root.querySelectorAll(".admin-prog-name-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const member = getAdminMembers().find(
          (m) => m.scoutId === btn.dataset.adminMemberId
        );
        if (member) openAdminMemberPreview(member);
      });
    });

    root.querySelectorAll("[data-prog-badge-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        adminProgOverviewBadgeKey = btn.dataset.progBadgeKey;
        hideAdminProgItemHoverTip();
        hideAdminProgCompletedPopover();
        closeAdminProgItemDetail();
        renderAdminProgressiveOverview();
      });
    });

    const tableWrap = root.querySelector(".admin-prog-table-wrap");
    const hideFloatingTips = () => {
      hideAdminProgItemHoverTip();
      hideAdminProgCompletedPopover();
    };
    tableWrap?.addEventListener("scroll", hideFloatingTips, { passive: true });

    root.querySelectorAll("[data-prog-done-mark]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showAdminProgCompletedPopover(btn, btn.dataset.completedDate || "");
      });
    });

    root.querySelectorAll(".admin-prog-item-trigger").forEach((btn) => {
      const idx = Number(btn.dataset.progColIdx);
      const col = columns[idx];
      btn.addEventListener("mouseenter", () => showAdminProgItemHoverTip(btn, col));
      btn.addEventListener("mouseleave", hideAdminProgItemHoverTip);
      btn.addEventListener("focus", () => showAdminProgItemHoverTip(btn, col));
      btn.addEventListener("blur", hideAdminProgItemHoverTip);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Desktop already has hover tip; click opens the same detail sheet (handy on touch / keyboard).
        if (col) openAdminProgItemDetail(col);
      });
    });

    bindAdminProgZoomControls(root);
  }

  function openAdminMemberPreview(member) {
    if (!isAdminSession || !member) return;
    if (DEMO_SCOUT_IDS.has(String(member.scoutId || ""))) return;
    if (adminView) adminView.hidden = true;
    document.body.classList.add("admin-previewing");
    if (adminPreviewBar) {
      adminPreviewBar.hidden = false;
      const label = $("#admin-preview-label");
      if (label) {
        label.textContent = `正在查看：${member.name}（${member.section || ""}）`;
      }
    }
    sessionStorage.setItem(TAB_KEY, "progressive");
    showDashboard(member);
    switchTab("progressive");
  }

  function exitAdminMemberPreview(returnToAdmin = true) {
    document.body.classList.remove("admin-previewing");
    if (adminPreviewBar) adminPreviewBar.hidden = true;
    if (returnToAdmin && isAdminSession) {
      showAdminDashboard();
      switchAdminTab(sessionStorage.getItem(ADMIN_TAB_KEY) || "members");
    }
  }

  /* ---------- Events ---------- */

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loginError.hidden = true;

    const name = $("#member-name").value;
    const scoutId = $("#scout-id").value;

    if (!name.trim() || !scoutId.trim()) {
      loginError.textContent = "請輸入中文姓名及 Scout ID。";
      loginError.hidden = false;
      return;
    }

    const admin = findAdminAccount(name, scoutId);
    if (admin) {
      saveAdminSession(admin);
      sessionStorage.setItem(ADMIN_TAB_KEY, "overview");
      showAdminDashboard(admin);
      return;
    }

    const member = findMember(name, scoutId);
    if (!member) {
      loginError.textContent = "姓名或 Scout ID 不正確，請向領袖確認後再試。";
      loginError.hidden = false;
      return;
    }

    saveSession(member);
    sessionStorage.setItem(TAB_KEY, "progressive");
    showDashboard(member);
  });

  logoutBtn.addEventListener("click", () => {
    clearSession();
    showLogin();
  });

  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener("click", () => {
      clearSession();
      showLogin();
    });
  }

  const adminPreviewBack = $("#admin-preview-back");
  if (adminPreviewBack) {
    adminPreviewBack.addEventListener("click", () => {
      exitAdminMemberPreview(true);
    });
  }

  $("#badge-back-btn").addEventListener("click", () => {
    showProgressiveList();
    if (currentMember) renderProgressive(currentMember);
  });

  $("#activity-back-btn").addEventListener("click", () => {
    showActivityList();
  });

  $("#specialty-back-btn").addEventListener("click", () => {
    if (specialtyDetailReturnTo === "gallery") {
      showSpecialtyGallery();
    } else {
      showSpecialtyList();
    }
  });

  const specialtyGalleryLink = $("#specialty-gallery-link");
  if (specialtyGalleryLink) {
    specialtyGalleryLink.addEventListener("click", () => {
      showSpecialtyGallery();
    });
  }

  const specialtyGalleryBackBtn = $("#specialty-gallery-back-btn");
  if (specialtyGalleryBackBtn) {
    specialtyGalleryBackBtn.addEventListener("click", () => {
      showSpecialtyList();
    });
  }

  $$(".demo-fill").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("#member-name").value = btn.dataset.name;
      $("#scout-id").value = btn.dataset.id;
      loginError.hidden = true;
      $("#member-name").focus();
    });
  });

  /* ---------- Boot ---------- */

  async function init() {
    initTabs();
    initAdminTabs();
    initAdminDateCombo();

    try {
      await loadData();
    } catch (err) {
      loginError.textContent = "系統暫時無法載入資料，請稍後再試。";
      loginError.hidden = false;
      console.error(err);
      return;
    }

    const session = getSession();
    if (session) {
      if (session.role === "admin" || isAdminCredentials(session.name, session.scoutId)) {
        const admin = findAdminAccount(session.name, session.scoutId);
        if (admin) {
          showAdminDashboard(admin);
          return;
        }
      }
      const member = findMember(session.name, session.scoutId);
      if (member) {
        showDashboard(member);
        return;
      }
      clearSession();
    }

    showLogin();
  }

  init();
})();
