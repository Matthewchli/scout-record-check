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
    for (const section of syl.sections) {
      const sp = sectionProgress(section, completed);
      done += sp.done;
      total += sp.total;
    }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
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
    for (const sub of section.subsections) {
      if (sub.elective) {
        // 4／5／6 選修：完成其中一項即可，進度只計 1 項
        total += 1;
        if (sub.items.some((item) => completedSet.has(item.id))) done += 1;
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
    $("#profile-avatar").textContent = initials(member.name);
    $("#profile-heading").textContent = member.name;
    $("#profile-troop").textContent = member.troop;
    $("#profile-section").textContent = member.section;
    $("#profile-rank").textContent = member.rank;
    const joinEl = $("#profile-join");
    joinEl.textContent = formatDate(member.joinDate);
    joinEl.setAttribute("datetime", member.joinDate);
  }

  function showProgressiveList() {
    const listView = $("#progressive-list-view");
    const detailView = $("#progressive-detail-view");
    if (listView) listView.hidden = false;
    if (detailView) detailView.hidden = true;
  }

  function showActivityList() {
    const listView = $("#activity-list-view");
    const detailView = $("#activity-detail-view");
    if (listView) listView.hidden = false;
    if (detailView) detailView.hidden = true;
  }

  function showActivityDetail(kind) {
    if (!currentMember) return;
    const titles = {
      attendance: { title: "出席率", subtitle: "集會與活動出席明細" },
      service: { title: "服務時數", subtitle: "服務活動明細" },
      camping: { title: "露營次數", subtitle: "露營活動明細" },
      outdoor: { title: "戶外活動", subtitle: "參與過的戶外活動明細" },
    };
    const meta = titles[kind];
    if (!meta) return;

    $("#activity-list-view").hidden = true;
    $("#activity-detail-view").hidden = false;
    $("#activity-detail-title").textContent = meta.title;
    $("#activity-detail-subtitle").textContent = meta.subtitle;
    $("#activity-detail-content").innerHTML = renderActivityDetailContent(
      currentMember,
      kind
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getAttendanceStats(member) {
    const records = member.attendance || [];
    const counts = { present: 0, absent: 0 };
    for (const r of records) {
      const status = normalizeAttendanceStatus(r);
      if (counts[status] !== undefined) counts[status]++;
    }
    const total = records.length;
    const rate = total
      ? Math.round((counts.present / total) * 100)
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
      const { records, counts, total, rate } = getAttendanceStats(member);
      const summary = `
        <div class="detail-meta">
          <span>出席率 <strong>${rate}%</strong></span>
          <span>出席 ${counts.present}</span>
          <span>缺席 ${counts.absent}</span>
          <span>共 ${total} 次</span>
        </div>`;
      if (!records.length) {
        return `${summary}<p class="empty-state">暫無出席紀錄</p>`;
      }
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
      return `${summary}
        <div class="attendance-table-wrap">
          <table class="attendance-table" aria-label="出席明細">
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
            <td class="att-note">${r.note ? escapeHtml(r.note) : "—"}</td>
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
                <th scope="col">備註</th>
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
                <th scope="col">備註</th>
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
      const items = records
        .map(
          (act) => `
          <li class="activity-item">
            <span class="activity-type type-${act.type}">${escapeHtml(act.type)}</span>
            <span class="activity-name">${escapeHtml(act.name)}</span>
            <time class="activity-date" datetime="${act.date}">${formatDate(act.date)}</time>
          </li>`
        )
        .join("");
      return `${summary}<ul class="activity-list">${items}</ul>`;
    }

    return `<p class="empty-state">暫無資料</p>`;
  }

  function showBadgeDetail(badgeKey) {
    if (!currentMember || !syllabus || !syllabus[badgeKey]) return;
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
    $("#badge-detail-progress-text").textContent =
      progress.status === "completed" && progress.completedDate
        ? `${done} / ${total} 項完成（${pct}%）· 完成日期：${formatDate(progress.completedDate)}`
        : `${done} / ${total} 項完成（${pct}%）`;

    requestAnimationFrame(() => {
      $("#badge-detail-fill").style.width = `${pct}%`;
    });

    const sectionsEl = $("#badge-detail-sections");
    sectionsEl.innerHTML = syl.sections
      .map((section) => {
        const sp = sectionProgress(section, completed);
        const subsHtml = section.subsections
          .map((sub) => {
            const itemsHtml = sub.items
              .map((it) => {
                const isDone = completed.has(it.id);
                const details = (it.details || [])
                  .map((d) => `<li>${escapeHtml(d)}</li>`)
                  .join("");
                return `
                  <li class="syllabus-item ${isDone ? "done" : "pending"}">
                    <div class="syllabus-item-head">
                      <span class="item-status ${isDone ? "is-done" : "is-pending"}">${isDone ? "已完成" : "未完成"}</span>
                      <span class="syllabus-item-title">${escapeHtml(it.title)}</span>
                    </div>
                    ${details ? `<ul class="syllabus-details">${details}</ul>` : ""}
                  </li>`;
              })
              .join("");

            const titleHtml = sub.elective
              ? `<aside class="elective-tip" role="note">
                  <p class="elective-tip-label">選修提示</p>
                  <p class="elective-tip-text">${escapeHtml(sub.title).replace(/\n/g, "<br>")}</p>
                  <p class="elective-tip-count">進度計算：完成其中一項即計 1 項</p>
                </aside>`
              : `<h4 class="syllabus-sub-title">${escapeHtml(sub.title)}</h4>`;

            return `
              <div class="syllabus-sub">
                ${titleHtml}
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

  function renderProgressive(member) {
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
                <div class="prog-progress-fill" data-pct="${pct}"></div>
              </div>
              <p class="prog-progress-text">${done} / ${total} 項完成（${pct}%）</p>
            </div>
            <p class="prog-open-hint">查看完整分項考核內容 →</p>
          </div>
        </div>
      `;

      card.addEventListener("click", () => showBadgeDetail(badge.key));
      container.appendChild(card);
    }

    requestAnimationFrame(() => {
      $$(".prog-progress-fill", container).forEach((el) => {
        el.style.width = `${el.dataset.pct}%`;
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
                      <span class="item-status is-done">已完成</span>
                      <span class="syllabus-item-title">${escapeHtml(it.title)}</span>
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

    summary.innerHTML = `
      <button type="button" class="att-stat" data-activity-detail="attendance">
        <span class="att-stat-value">${rate}%</span>
        <span class="att-stat-label">出席率</span>
        <span class="att-stat-hint">查看明細</span>
      </button>
      <button type="button" class="att-stat" data-activity-detail="service">
        <span class="att-stat-value">${activity.serviceHours || 0}</span>
        <span class="att-stat-label">服務時數</span>
        <span class="att-stat-hint">查看明細</span>
      </button>
      <button type="button" class="att-stat" data-activity-detail="camping">
        <span class="att-stat-value">${activity.campingCount || 0}</span>
        <span class="att-stat-label">露營次數</span>
        <span class="att-stat-hint">查看明細</span>
      </button>
      <button type="button" class="att-stat" data-activity-detail="outdoor">
        <span class="att-stat-value">${outdoorCount}</span>
        <span class="att-stat-label">戶外活動</span>
        <span class="att-stat-hint">查看明細</span>
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
          <dd>${escapeHtml(item.value)}</dd>
        </div>`
      )
      .join("");

    const contactsHtml = (resources.contacts || [])
      .map(
        (c) => `
        <li class="contact-item">
          <div class="contact-main">
            <span class="contact-role">${escapeHtml(c.role)}</span>
            <span class="contact-name">${escapeHtml(c.name)}</span>
          </div>
          <a class="contact-phone" href="tel:${c.phone.replace(/\s/g, "")}">${escapeHtml(c.phone)}</a>
          <span class="contact-note">${escapeHtml(c.note)}</span>
        </li>`
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

    const noticesHtml = (resources.notices || [])
      .map(
        (n) => `
        <article class="notice-item">
          <time class="notice-date" datetime="${n.date}">${formatDate(n.date)}</time>
          <h4 class="notice-title">${escapeHtml(n.title)}</h4>
          <p class="notice-content">${escapeHtml(n.content)}</p>
        </article>`
      )
      .join("");

    container.innerHTML = `
      <div class="resource-grid">
        <section class="resource-block">
          <h3 class="subsection-title">旅團資訊</h3>
          <dl class="info-list">${infoHtml}</dl>
        </section>
        <section class="resource-block">
          <h3 class="subsection-title">聯絡領袖</h3>
          <ul class="contact-list">${contactsHtml || `<li class="empty-state">暫無聯絡資料</li>`}</ul>
        </section>
      </div>
      <section class="resource-block">
        <h3 class="subsection-title">常用連結</h3>
        <ul class="link-list">${linksHtml || `<li class="empty-state">暫無連結</li>`}</ul>
      </section>
      <section class="resource-block">
        <h3 class="subsection-title">旅團通告</h3>
        <div class="notice-list">${noticesHtml || `<p class="empty-state">暫無通告</p>`}</div>
      </section>
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
