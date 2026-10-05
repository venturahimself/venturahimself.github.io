(() => {
  "use strict";

  const USER = "venturahimself";
  const API = "https://api.github.com";
  const CACHE_KEY = "gh-cache-v1";
  const CACHE_MS = 10 * 60 * 1000;

  const $ = (sel) => document.querySelector(sel);
  const set = (sel, value) => { const el = $(sel); if (el) el.textContent = value; };

  /* ---------- helpers ---------- */
  function ago(iso) {
    if (!iso) return "–";
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    const units = [["y", 31536000], ["mo", 2592000], ["d", 86400], ["h", 3600], ["m", 60]];
    for (const [label, size] of units) {
      if (s >= size) return Math.floor(s / size) + label + " ago";
    }
    return "just now";
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function readCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && Date.now() - c.t < CACHE_MS) return c.data;
    } catch (e) { /* storage unavailable */ }
    return null;
  }

  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data })); }
    catch (e) { /* ignore */ }
  }

  async function getJSON(path) {
    const res = await fetch(API + path, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(path + " → " + res.status);
    return res.json();
  }

  /* ---------- rendering ---------- */
  function renderStats(user, repos) {
    const own = repos.filter((r) => !r.fork);
    const stars = own.reduce((n, r) => n + r.stargazers_count, 0);
    const lastPush = repos.reduce((a, r) => (r.pushed_at > a ? r.pushed_at : a), "");

    set("#hud-repos", String(user.public_repos));
    set("#hud-stars", String(stars));
    set("#hud-followers", String(user.followers));
    set("#hud-following", String(user.following));
    set("#hud-since", String(new Date(user.created_at).getFullYear()));
    set("#hud-push", ago(lastPush));

    set("#t-repos", String(user.public_repos));
    set("#t-stars", String(stars));
    set("#t-followers", String(user.followers));
    set("#term-state", "profile loaded");
  }

  function renderRepos(repos) {
    const grid = $("#repo-grid");
    grid.replaceChildren();

    const list = repos.filter((r) => !r.fork)
      .sort((a, b) => (b.stargazers_count - a.stargazers_count) || (b.pushed_at > a.pushed_at ? 1 : -1));

    if (!list.length) { grid.append(el("p", "empty", "No public repositories yet.")); return; }

    list.forEach((r, i) => {
      const card = el("a", "project-card" + (i === 0 ? " featured" : ""));
      card.href = r.html_url;
      card.rel = "noopener";

      const meta = el("div", "project-meta");
      meta.append(el("span", "", String(i + 1).padStart(2, "0")));
      meta.append(el("span", "tag", (r.language || "REPO").toUpperCase()));

      const desc = r.description && r.description.trim() ? r.description : "No description.";

      const foot = el("div", "project-footer");
      foot.append(el("span", "", "★ " + r.stargazers_count + "  ·  ⑂ " + r.forks_count + "  ·  " + ago(r.pushed_at)));
      foot.append(el("span", "", "↗"));

      card.append(meta, el("h3", "", r.name), el("p", "", desc), foot);
      grid.append(card);
    });
  }

  function renderActivity(events) {
    const box = $("#activity-list");
    box.replaceChildren();

    const pushes = events.filter((e) => e.type === "PushEvent").slice(0, 8);
    if (!pushes.length) {
      box.append(el("p", "muted", "No public commits in the last 90 days."));
      return;
    }

    pushes.forEach((e) => {
      const row = el("div");
      const commits = e.payload && e.payload.commits ? e.payload.commits : [];
      const msg = commits.length ? commits[commits.length - 1].message.split("\n")[0] : "push";
      row.append(el("span", "cyan", e.repo.name.replace(USER + "/", "")));
      row.append(el("span", "", msg.length > 70 ? msg.slice(0, 67) + "…" : msg));
      row.append(el("span", "muted", ago(e.created_at)));
      box.append(row);
    });
  }

  function setStatus(text, ok) {
    set("#api-status", text);
    const dot = $(".dot");
    if (dot) dot.style.background = ok ? "" : "var(--amber)";
  }

  /* ---------- load ---------- */
  async function load() {
    let data = readCache();
    let live = !!data;

    if (!data) {
      try {
        const [user, repos, events] = await Promise.all([
          getJSON("/users/" + USER),
          getJSON("/users/" + USER + "/repos?per_page=100"),
          getJSON("/users/" + USER + "/events/public?per_page=50").catch(() => [])
        ]);
        data = { user, repos, events };
        writeCache(data);
        live = true;
      } catch (err) {
        console.warn("GitHub API unavailable:", err);
      }
    }

    if (!data) {
      setStatus("GITHUB OFFLINE", false);
      set("#term-state", "GitHub API unavailable (rate limit?)");
      $("#repo-grid").replaceChildren(el("p", "empty", "Could not reach GitHub right now. Try again in a few minutes."));
      $("#activity-list").replaceChildren(el("p", "muted", "Unavailable."));
      return;
    }

    setStatus(live ? "GITHUB LIVE" : "GITHUB", true);
    renderStats(data.user, data.repos);
    renderRepos(data.repos);
    renderActivity(data.events || []);

    const bio = data.user.bio;
    if (bio && bio.trim()) set("#bio", bio.trim());
  }

  /* ---------- typewriter, clock, menu ---------- */
  const target = $("#type-target");
  const message = "git log --oneline";
  let index = 0, deleting = false;

  function typeLoop() {
    if (!target) return;
    target.textContent = message.slice(0, index);
    if (!deleting && index < message.length) { index++; setTimeout(typeLoop, 75); }
    else if (!deleting) { deleting = true; setTimeout(typeLoop, 1800); }
    else if (index > 0) { index--; setTimeout(typeLoop, 35); }
    else { deleting = false; setTimeout(typeLoop, 500); }
  }

  function updateClock() {
    set("#clock", new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    }).format(new Date()));
  }

  set("#year", String(new Date().getFullYear()));
  updateClock();
  setInterval(updateClock, 1000);
  typeLoop();

  const menuToggle = $(".menu-toggle");
  const nav = $("#site-nav");
  if (menuToggle && nav) {
    menuToggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  load();
})();
