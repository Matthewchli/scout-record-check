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

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const loginView = $("#login-view");
  const dashboardView = $("#dashboard-view");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const logoutBtn = $("#logout-btn");

  let members = [];
  let resources = null;
  let syllabus = null;
  let specialtySyllabus = null;
  let currentMember = null;

  /* ---------- Data ---------- */

  async function loadData() {
    const [membersRes, syllabusRes, specialtyRes] = await Promise.all([
      fetch("data/members.json", { cache: "no-store" }),
      fetch("data/progressive-syllabus.json", { cache: "no-store" }),
      fetch("data/specialty-syllabus.json", { cache: "no-store" }),
    ]);
    if (!membersRes.ok) throw new Error("無法載入成員資料");
    if (!syllabusRes.ok) throw new Error("無法載入獎章綱要");
    if (!specialtyRes.ok) throw new Error("無法載入專科徽章綱要");
    const data = await membersRes.json();
    members = data.members || [];
    resources = data.resources || null;
    syllabus = await syllabusRes.json();
    specialtySyllabus = await specialtyRes.json();
  }

  function findMember(name, scoutId) {
    const n = name.trim();
    const id = scoutId.trim().toUpperCase();
    return members.find(
      (m) => m.name === n && m.scoutId.toUpperCase() === id
    );
  }

  /* ---------- Session ---------- */

  function saveSession(member) {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ name: member.name, scoutId: member.scoutId })
    );
  }

  function clearSession() {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TAB_KEY);
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
    dashboardView.hidden = true;
    loginView.hidden = false;
    loginError.hidden = true;
    loginForm.reset();
    showProgressiveList();
    showActivityList();
    showSpecialtyList();
  }

  function showDashboard(member) {
    currentMember = member;
    loginView.hidden = true;
    dashboardView.hidden = false;
    showProgressiveList();
    showActivityList();
    showSpecialtyList();
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
      avatar.innerHTML = `<img src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.name)}的成員照片" width="120" height="150" />`;
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
            <td><time datetime="${r.date}">${formatDate(r.date)}</time></td>
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
            <td><time datetime="${r.date}">${formatDate(r.date)}</time></td>
            <td>${escapeHtml(r.name)}</td>
            <td>${r.hours != null && r.hours !== "" ? `${r.hours} 小時` : "—"}</td>
          </tr>`
        )
        .join("");
      return `${summary}
        <div class="attendance-table-wrap">
          <table class="attendance-table" aria-label="服務時數明細">
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
            <td><time datetime="${r.date}">${formatDate(r.date)}</time></td>
            <td>${escapeHtml(r.name)}</td>
            <td>${r.nights != null && r.nights !== "" ? `${r.nights} 晚` : "—"}</td>
            <td class="att-note">${r.note ? escapeHtml(r.note) : "—"}</td>
          </tr>`
        )
        .join("");
      return `${summary}
        <div class="attendance-table-wrap">
          <table class="attendance-table" aria-label="露營明細">
            <thead>
              <tr>
                <th scope="col">日期</th>
                <th scope="col">露營活動</th>
                <th scope="col">晚數</th>
                <th scope="col">地點</th>
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
            <td><time datetime="${r.date}">${formatDate(r.date)}</time></td>
            <td>${escapeHtml(r.name)}</td>
            <td class="att-note">${r.note ? escapeHtml(r.note) : "—"}</td>
          </tr>`
        )
        .join("");
      return `${summary}
        <div class="attendance-table-wrap">
          <table class="attendance-table" aria-label="戶外活動明細">
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
   * Animate progress fill + optional text from 0 → target over 1.5s.
   * textFormatter(doneShown, pctShown) → string
   */
  function animateProgressBar(fillEl, textEl, { done, total, pct, textFormatter }) {
    if (!fillEl) return;
    fillEl.style.width = "0%";
    if (textEl && textFormatter) {
      textEl.textContent = textFormatter(0, 0);
    }

    const duration = 1500;
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
    { key: "other", label: "其他獎章及徽章", selector: "#specialty-other" },
  ];

  const SPECIALTY_CATEGORY_MAP = {
    興趣組: "interest",
    技能組: "skill",
    服務組: "service",
    教導組: "instructor",
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
      other: [],
    };

    for (const badge of badges) {
      grouped[normalizeSpecialtyGroup(badge)].push(badge);
    }

    for (const group of SPECIALTY_GROUPS) {
      $(group.selector).innerHTML = renderBadgeItems(
        grouped[group.key],
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

  function resolveSpecialtyIcon(badge) {
    if (badge.icon) return badge.icon;
    const group = normalizeSpecialtyGroup(badge);
    const raw = String(badge.name || "")
      .replace(/（教導組）/g, "")
      .replace(/\(教導組\)/g, "")
      .trim();
    const candidates = [
      raw,
      raw.replace(/章$/, ""),
      raw.replace(/獎章$/, ""),
      raw.replace(/徽章$/, ""),
    ];
    for (const base of candidates) {
      if (!base) continue;
      return `assets/specialty/${group}/${base}.png`;
    }
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

  function showSpecialtyList() {
    const listView = $("#specialty-list-view");
    const detailView = $("#specialty-detail-view");
    if (listView) listView.hidden = false;
    if (detailView) detailView.hidden = true;
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

    $("#specialty-list-view").hidden = true;
    $("#specialty-detail-view").hidden = false;

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

    $("#specialty-meta-activity").textContent =
      badge.activityName || badge.name || "—";
    $("#specialty-meta-organizer").textContent = badge.organizer || "—";
    const dateIso = badge.assessmentDate || badge.earnedDate || "";
    $("#specialty-meta-date").textContent = formatDate(dateIso);
    const noticeEl = $("#specialty-meta-notice");
    if (badge.noticeUrl) {
      const label = badge.noticeTitle || "查看通告";
      noticeEl.innerHTML = `<a class="specialty-notice-link" href="${escapeHtml(badge.noticeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    } else {
      noticeEl.textContent = "—";
    }
    $("#specialty-meta-examiner").textContent =
      badge.examiner || badge.assessor || "—";

    const sectionsEl = $("#specialty-detail-sections");
    const items = (syl && syl.items) || [];
    if (!items.length) {
      sectionsEl.innerHTML = `<p class="empty-state">暫無綱要分項資料</p>`;
    } else {
      sectionsEl.innerHTML = `
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
                  <li class="syllabus-item done">
                    <div class="syllabus-item-head">
                      <span class="syllabus-item-title">${escapeHtml(it.title)}</span>
                      <div class="item-status-block">
                        <span class="item-status is-done">已完成</span>
                      </div>
                    </div>
                    ${details ? `<ul class="syllabus-details">${details}</ul>` : ""}
                  </li>`;
              })
              .join("")}
          </ul>
        </section>`;
    }

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

  function renderResources() {
    const container = $("#resources-content");
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

    const linksHtml = (resources.links || [])
      .map(
        (l) => `
        <li class="link-item">
          <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
            <span class="link-title">${escapeHtml(l.title)}</span>
            <span class="link-desc">${escapeHtml(l.desc)}</span>
          </a>
        </li>`
      )
      .join("");

    container.innerHTML = `
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
    `;
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

  $("#badge-back-btn").addEventListener("click", () => {
    showProgressiveList();
    if (currentMember) renderProgressive(currentMember);
  });

  $("#activity-back-btn").addEventListener("click", () => {
    showActivityList();
  });

  $("#specialty-back-btn").addEventListener("click", () => {
    showSpecialtyList();
  });

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
