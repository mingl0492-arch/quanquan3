(() => {
  "use strict";

  const STORAGE_KEY = "quanquan_goal_manager_v1";
  const qqStorage = window.qqStorage || window.localStorage;

  const levelMeta = {
    1: { icon: "👑", name: "一级目标", defaultText: "起点目标" },
    2: { icon: "💎", name: "二级目标", defaultText: "新目标" },
    3: { icon: "🏆", name: "三级目标", defaultText: "新目标" },
    4: { icon: "🥈", name: "四级目标", defaultText: "新目标" },
    5: { icon: "⬟", name: "五级目标", defaultText: "新目标" },
    6: { icon: "🪵", name: "六级目标", defaultText: "新目标" },
    7: { icon: "🧻", name: "七级目标", defaultText: "新目标" }
  };

  const statusMeta = {
    doing: { label: "进行时", className: "status-doing" },
    done: { label: "已完成", className: "status-done" },
    urgent: { label: "加急中", className: "status-urgent" }
  };

  let appState = loadAppState();
  let selectedId = getActiveTree().id || "root";
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let isPanning = false;
  let panStart = { x: 0, y: 0, tx: 0, ty: 0 };
  let layoutMap = new Map();
  let contentSize = { width: 900, height: 420 };
  let urgentFocus = false;

  let viewport;
  let canvas;
  let links;
  let nodesEl;
  let zoomValue;
  let nameInput;
  let entryList;

  function uid(prefix = "g") {
    return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
  }

  function normalizeStatus(status) {
    return statusMeta[status] ? status : "doing";
  }

  function defaultTree(text = "起点目标") {
    return {
      id: "root_" + uid("tree"),
      text,
      status: "doing",
      children: []
    };
  }

  function defaultEntry(index = 1) {
    const tree = defaultTree(index === 1 ? "起点目标" : `目标条目${index}`);
    return {
      id: uid("entry"),
      name: tree.text,
      tree
    };
  }

  function normalizeNode(node, fallbackText = "起点目标") {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      node = defaultTree(fallbackText);
    }
    if (!node.id) node.id = uid("g");
    if (!node.text) node.text = fallbackText;
    node.status = normalizeStatus(node.status);
    node.children = Array.isArray(node.children) ? node.children : [];
    node.children = node.children.map(child => normalizeNode(child, "新目标"));
    return node;
  }

  function normalizeEntry(entry, index = 1) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return defaultEntry(index);
    }

    const tree = normalizeNode(entry.tree || entry.data || entry.root || defaultTree(entry.name || `目标条目${index}`), entry.name || `目标条目${index}`);
    return {
      id: entry.id || uid("entry"),
      name: entry.name || tree.text || `目标条目${index}`,
      tree
    };
  }

  function normalizeAppState(value) {
    // 旧版本是单棵树，直接迁移为第一个目标条目。
    if (value && typeof value === "object" && !Array.isArray(value) && !Array.isArray(value.entries) && value.text) {
      const tree = normalizeNode(value, value.text || "起点目标");
      const entryId = uid("entry");
      return {
        version: 2,
        activeEntryId: entryId,
        entries: [{ id: entryId, name: tree.text || "起点目标", tree }]
      };
    }

    let state = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    let entries = Array.isArray(state.entries) ? state.entries : [];
    if (entries.length === 0) entries = [defaultEntry(1)];
    entries = entries.map((entry, index) => normalizeEntry(entry, index + 1));

    let activeEntryId = state.activeEntryId;
    if (!entries.some(entry => entry.id === activeEntryId)) {
      activeEntryId = entries[0].id;
    }

    return {
      version: 2,
      activeEntryId,
      entries
    };
  }

  function loadAppState() {
    try {
      const raw = qqStorage && qqStorage.getItem ? qqStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        return normalizeAppState(JSON.parse(raw));
      }
    } catch (error) {
      console.error("读取数据失败，将使用默认数据：", error);
    }
    return normalizeAppState({});
  }

  function saveAppState() {
    try {
      appState = normalizeAppState(appState);
      if (qqStorage && qqStorage.setItem) {
        qqStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      }
    } catch (error) {
      console.error("保存数据失败：", error);
      alert("保存数据失败：" + (error && error.message ? error.message : error));
    }
  }

  function getActiveEntry() {
    appState = normalizeAppState(appState);
    return appState.entries.find(entry => entry.id === appState.activeEntryId) || appState.entries[0];
  }

  function getActiveTree() {
    return getActiveEntry().tree;
  }

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getLines(text) {
    const chars = Array.from(String(text || "未命名"));
    const chunks = [];
    for (let i = 0; i < chars.length; i += 5) {
      chunks.push(chars.slice(i, i + 5).join(""));
    }
    return chunks.length ? chunks : ["未命名"];
  }

  function formatText(text) {
    return getLines(text).join("\n");
  }

  function flatten(root, level = 1, parent = null, arr = []) {
    if (!root || typeof root !== "object") return arr;
    arr.push({ node: root, level, parent });
    (root.children || []).forEach(child => flatten(child, level + 1, root, arr));
    return arr;
  }

  function findNode(root, id, level = 1, parent = null) {
    if (!root || typeof root !== "object") return null;
    if (root.id === id) return { node: root, level, parent };
    for (const child of root.children || []) {
      const found = findNode(child, id, level + 1, root);
      if (found) return found;
    }
    return null;
  }

  function removeNode(root, id) {
    if (!root || !Array.isArray(root.children)) return false;
    const before = root.children.length;
    root.children = root.children.filter(child => child.id !== id);
    if (root.children.length !== before) return true;
    return root.children.some(child => removeNode(child, id));
  }

  function nodeDims(level, text) {
    const lines = getLines(text).length;
    if (level === 1) return { w: 208, h: Math.max(86, 58 + lines * 26) };
    if (level === 2) return { w: 184, h: Math.max(78, 54 + lines * 22) };
    if (level === 3) return { w: 158, h: Math.max(72, 48 + lines * 20) };
    return { w: 140, h: Math.max(68, 44 + lines * 19) };
  }

  function buildLayout() {
    layoutMap = new Map();
    const data = getActiveTree();
    const activeEntry = getActiveEntry();
    activeEntry.tree = normalizeNode(data, activeEntry.name || "起点目标");
    if (!selectedId || !findNode(activeEntry.tree, selectedId)) selectedId = activeEntry.tree.id;

    const depths = [];
    flatten(activeEntry.tree).forEach(item => {
      const dims = nodeDims(item.level, item.node.text);
      depths[item.level] = Math.max(depths[item.level] || 0, dims.h);
    });

    const yByLevel = {};
    let y = 60;
    for (let i = 1; i <= 7; i++) {
      yByLevel[i] = y;
      y += (depths[i] || 76) + 86;
    }

    let leafIndex = 0;
    const leafGap = 300;
    const leftPadding = 140;

    function walk(node, level) {
      const children = node.children || [];
      const dims = nodeDims(level, node.text);
      let centerX;

      if (children.length === 0) {
        centerX = leftPadding + leafIndex * leafGap;
        leafIndex += 1;
      } else {
        const centers = children.map(child => walk(child, level + 1));
        centerX = (Math.min(...centers) + Math.max(...centers)) / 2;
      }

      layoutMap.set(node.id, {
        id: node.id,
        node,
        level,
        x: centerX - dims.w / 2,
        y: yByLevel[level],
        w: dims.w,
        h: dims.h
      });

      return centerX;
    }

    walk(activeEntry.tree, 1);

    const all = Array.from(layoutMap.values());
    let minX = Math.min(...all.map(i => i.x));
    if (minX < 40) {
      const offset = 40 - minX;
      all.forEach(item => item.x += offset);
    }

    const maxX = Math.max(...all.map(i => i.x + i.w));
    const maxY = Math.max(...all.map(i => i.y + i.h));
    contentSize = {
      width: Math.max(760, maxX + 180),
      height: Math.max(420, maxY + 150)
    };
  }

  function renderEntries() {
    if (!entryList) return;

    entryList.innerHTML = appState.entries.map((entry, index) => {
      const tree = normalizeNode(entry.tree, entry.name || `目标条目${index + 1}`);
      const total = flatten(tree).length;
      const done = flatten(tree).filter(item => normalizeStatus(item.node.status) === "done").length;
      const activeClass = entry.id === appState.activeEntryId ? " active" : "";
      const name = entry.name || tree.text || `目标条目${index + 1}`;

      return `
        <button class="entry-tab${activeClass}" type="button" data-entry-id="${safeText(entry.id)}" title="${safeText(name)}">
          <span class="entry-tab-name">${safeText(name)}</span>
          <span class="entry-tab-meta">${done}/${total} 已完成 · ${total} 个目标</span>
        </button>
      `;
    }).join("");

    entryList.querySelectorAll(".entry-tab").forEach(tab => {
      tab.onclick = () => {
        appState.activeEntryId = tab.dataset.entryId;
        selectedId = getActiveTree().id;
        urgentFocus = false;
        saveAppState();
        render();
        setTimeout(fitToView, 60);
      };
    });
  }

  function renderLinks() {
    if (!links) return;
    const data = getActiveTree();
    let html = "";

    function draw(node) {
      const parentBox = layoutMap.get(node.id);
      for (const child of node.children || []) {
        const childBox = layoutMap.get(child.id);
        if (parentBox && childBox) {
          const x1 = parentBox.x + parentBox.w / 2;
          const y1 = parentBox.y + parentBox.h;
          const x2 = childBox.x + childBox.w / 2;
          const y2 = childBox.y;
          const mid = y1 + Math.max(28, (y2 - y1) * 0.45);
          html += `<path d="M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}" />`;
        }
        draw(child);
      }
    }

    draw(data);
    links.innerHTML = html;
  }

  function renderNodes() {
    if (!nodesEl) return;

    const items = flatten(getActiveTree());
    nodesEl.innerHTML = items.map(({ node, level }) => {
      const box = layoutMap.get(node.id);
      const meta = levelMeta[level] || levelMeta[7];
      const status = normalizeStatus(node.status);
      const statusInfo = statusMeta[status];
      const selectedClass = node.id === selectedId ? " selected" : "";
      return `
        <div class="node level-${level} ${statusInfo.className}${selectedClass}" data-id="${safeText(node.id)}"
             style="left:${box.x}px;top:${box.y}px;width:${box.w}px;min-height:${box.h}px">
          <div class="icon">${meta.icon}</div>
          <div class="label">${safeText(formatText(node.text))}</div>
          <div class="status-pill">${statusInfo.label}</div>
        </div>
      `;
    }).join("");

    nodesEl.querySelectorAll(".node").forEach(el => {
      el.addEventListener("click", event => {
        event.stopPropagation();
        selectedId = el.dataset.id;
        render();
      });
    });
  }

  function renderDetails() {
    const data = getActiveTree();
    const found = findNode(data, selectedId) || findNode(data, data.id);
    if (!found) return;

    const meta = levelMeta[found.level] || levelMeta[7];
    const status = normalizeStatus(found.node.status);

    setText("detailIcon", meta.icon);
    setText("detailName", found.node.text);
    setText("detailLv", "Lv." + found.level);
    setText("detailLevel", meta.name);
    setText("detailParent", found.parent ? found.parent.text : "无");
    setText("detailChildren", (found.node.children || []).length + " 个");
    setText("detailStatus", statusMeta[status].label);

    document.querySelectorAll(".status-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.status === status);
    });

    if (nameInput && document.activeElement !== nameInput) {
      nameInput.value = found.node.text;
    }
  }

  function renderProgress() {
    const activeEntry = getActiveEntry();
    const data = activeEntry.tree;
    const items = flatten(data);
    const total = items.length;
    const done = items.filter(item => normalizeStatus(item.node.status) === "done").length;
    const urgent = items.filter(item => normalizeStatus(item.node.status) === "urgent").length;
    const unfinished = total - done;
    const allDone = total > 0 && unfinished === 0;
    const progress = total > 0 ? done / total : 0;
    const percent = allDone ? 100 : Math.round(progress * 100);

    setText("statCurrent", total);
    setText("statDone", done);
    setText("statRate", percent + "%");

    const progressTitle = document.querySelector(".progress-title h3");
    if (progressTitle) {
      progressTitle.textContent = "目标进度总览 · " + (activeEntry.name || data.text || "目标条目");
    }

    const fill = byId("trackFill");
    const runner = byId("runnerMouse");
    const panel = byId("progressPanel");
    const text = byId("progressText");
    const badge = byId("progressBadge");

    if (fill) fill.style.width = percent + "%";
    if (runner) runner.style.setProperty("--mouse-left", percent + "%");
    if (panel) panel.classList.toggle("all-done", allDone);

    if (text) {
      if (allDone) {
        text.innerHTML = "<strong>冲线成功：</strong> 当前目标条目里的所有目标都已完成！";
      } else {
        text.innerHTML = `<strong>小老鼠已出发：</strong> 当前目标条目还有 ${unfinished} 个目标待完成。`;
      }
    }
    if (badge) {
      badge.textContent = allDone ? "已到达终点" : (urgent > 0 ? `加急目标 ${urgent} 个` : "奔跑中");
    }
  }

  function renderLegend() {
    const legend = byId("legend");
    if (!legend) return;
    legend.innerHTML = Object.entries(levelMeta).map(([lv, meta]) =>
      `<div class="legend-item"><span>${meta.icon}</span><span>Lv.${lv} ${meta.name}</span></div>`
    ).join("");
  }

  function render() {
    try {
      appState = normalizeAppState(appState);
      const activeEntry = getActiveEntry();
      activeEntry.tree = normalizeNode(activeEntry.tree, activeEntry.name || "起点目标");
      activeEntry.name = activeEntry.name || activeEntry.tree.text || "起点目标";
      buildLayout();

      if (canvas) {
        canvas.classList.toggle("urgent-focus", urgentFocus);
        canvas.style.width = contentSize.width + "px";
        canvas.style.height = contentSize.height + "px";
      }

      if (links) {
        links.setAttribute("width", contentSize.width);
        links.setAttribute("height", contentSize.height);
        links.setAttribute("viewBox", `0 0 ${contentSize.width} ${contentSize.height}`);
      }

      renderEntries();
      renderLinks();
      renderNodes();
      renderDetails();
      renderProgress();
      updateTransform();
    } catch (error) {
      console.error("渲染失败：", error);
      alert("渲染失败：" + (error && error.message ? error.message : error));
    }
  }

  function addEntry() {
    appState = normalizeAppState(appState);
    const index = appState.entries.length + 1;
    const entry = defaultEntry(index);
    entry.name = `目标条目${index}`;
    entry.tree.text = "起点目标";
    appState.entries.push(entry);
    appState.activeEntryId = entry.id;
    selectedId = entry.tree.id;
    urgentFocus = false;
    saveAppState();
    render();
    setTimeout(() => {
      fitToView();
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
      showToast("已新增目标条目，可在右侧修改起点目标名称");
    }, 80);
  }

  function deleteEntry() {
    appState = normalizeAppState(appState);
    if (appState.entries.length <= 1) {
      alert("至少需要保留一个目标条目。");
      return;
    }

    const activeEntry = getActiveEntry();
    const name = activeEntry.name || activeEntry.tree.text || "当前目标条目";
    if (!confirm("确定删除目标条目“" + name + "”及其中所有目标块吗？")) {
      return;
    }

    const index = appState.entries.findIndex(entry => entry.id === activeEntry.id);
    appState.entries = appState.entries.filter(entry => entry.id !== activeEntry.id);
    const next = appState.entries[Math.max(0, Math.min(index, appState.entries.length - 1))] || appState.entries[0];
    appState.activeEntryId = next.id;
    selectedId = next.tree.id;
    urgentFocus = false;
    saveAppState();
    render();
    setTimeout(fitToView, 80);
    showToast("已删除目标条目");
  }

  function addGoal() {
    const data = getActiveTree();
    const found = findNode(data, selectedId) || findNode(data, data.id);
    if (!found) {
      alert("请先选择一个目标。");
      return;
    }

    if (found.level >= 7) {
      alert("已经是七级目标，不能再添加次级目标。");
      return;
    }

    const childLevel = found.level + 1;
    const child = {
      id: uid("g"),
      text: levelMeta[childLevel].defaultText || "新目标",
      status: "doing",
      children: []
    };

    found.node.children = Array.isArray(found.node.children) ? found.node.children : [];
    found.node.children.push(child);
    selectedId = child.id;

    saveAppState();
    render();
    setTimeout(() => {
      fitToView();
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
      showToast("已添加新目标，可在右侧改名");
    }, 60);
  }

  function deleteGoal() {
    const data = getActiveTree();
    if (selectedId === data.id) {
      alert("起点目标不可删除。你可以删除整个目标条目。");
      return;
    }

    const found = findNode(data, selectedId);
    if (!found) {
      alert("请先选择一个目标。");
      return;
    }

    if (!confirm("确定删除“" + found.node.text + "”及其所有子级目标吗？")) {
      return;
    }

    const parentId = found.parent ? found.parent.id : data.id;
    removeNode(data, selectedId);
    selectedId = parentId;
    saveAppState();
    render();
    setTimeout(fitToView, 60);
  }

  function setStatus(status) {
    const data = getActiveTree();
    const found = findNode(data, selectedId) || findNode(data, data.id);
    if (!found) return;
    found.node.status = normalizeStatus(status);
    saveAppState();
    render();
  }

  function toggleUrgentFocus() {
    urgentFocus = !urgentFocus;
    if (canvas) canvas.classList.toggle("urgent-focus", urgentFocus);
    const alertBtn = byId("alertBtn");
    if (alertBtn) alertBtn.classList.toggle("active", urgentFocus);
  }

  function zoomBy(factor, originX, originY) {
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const ox = originX ?? rect.width / 2;
    const oy = originY ?? rect.height / 2;
    const beforeX = (ox - tx) / scale;
    const beforeY = (oy - ty) / scale;
    scale = clamp(scale * factor, 0.25, 2.8);
    tx = ox - beforeX * scale;
    ty = oy - beforeY * scale;
    updateTransform();
  }

  function updateTransform() {
    if (canvas) {
      canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }
    if (zoomValue) {
      zoomValue.textContent = Math.round(scale * 100) + "%";
    }
  }

  function fitToView() {
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pad = 80;
    const sx = (rect.width - pad * 2) / contentSize.width;
    const sy = (rect.height - pad * 2) / contentSize.height;
    scale = clamp(Math.min(sx, sy), 0.35, 1.12);
    tx = (rect.width - contentSize.width * scale) / 2;
    ty = 36;
    updateTransform();
  }

  function onWheel(event) {
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    zoomBy(event.deltaY < 0 ? 1.08 : 0.92, event.clientX - rect.left, event.clientY - rect.top);
  }

  function onMouseDown(event) {
    if (event.target.closest(".node") || event.target.closest("button") || event.target.closest("textarea")) return;
    isPanning = true;
    panStart = { x: event.clientX, y: event.clientY, tx, ty };
    viewport.style.cursor = "grabbing";
  }

  function onMouseMove(event) {
    if (!isPanning) return;
    tx = panStart.tx + event.clientX - panStart.x;
    ty = panStart.ty + event.clientY - panStart.y;
    updateTransform();
  }

  function onMouseUp() {
    isPanning = false;
    if (viewport) viewport.style.cursor = "";
  }

  function showToast(message) {
    const toast = byId("appToast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1500);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function init() {
    viewport = byId("viewport");
    canvas = byId("canvas");
    links = byId("links");
    nodesEl = byId("nodes");
    zoomValue = byId("zoomValue");
    nameInput = byId("nameInput");
    entryList = byId("entryList");

    const addBtn = byId("addBtn");
    if (addBtn) {
      addBtn.onclick = function(event) {
        event.preventDefault();
        addGoal();
      };
    }

    const deleteBtn = byId("deleteBtn");
    if (deleteBtn) deleteBtn.onclick = deleteGoal;

    const addEntryBtn = byId("addEntryBtn");
    if (addEntryBtn) addEntryBtn.onclick = addEntry;

    const deleteEntryBtn = byId("deleteEntryBtn");
    if (deleteEntryBtn) deleteEntryBtn.onclick = deleteEntry;

    document.querySelectorAll(".status-btn").forEach(btn => {
      btn.onclick = () => setStatus(btn.dataset.status);
    });

    const alertBtn = byId("alertBtn");
    if (alertBtn) alertBtn.onclick = toggleUrgentFocus;

    const zoomIn = byId("zoomIn");
    if (zoomIn) zoomIn.onclick = () => zoomBy(1.12);

    const zoomOut = byId("zoomOut");
    if (zoomOut) zoomOut.onclick = () => zoomBy(0.88);

    const fitBtn = byId("fitBtn");
    if (fitBtn) fitBtn.onclick = fitToView;

    if (nameInput) {
      nameInput.addEventListener("input", () => {
        const data = getActiveTree();
        const found = findNode(data, selectedId);
        if (!found) return;

        found.node.text = nameInput.value || "未命名";

        // 一级目标名称同步为目标条目名称，方便多目标条目识别。
        if (found.level === 1) {
          const activeEntry = getActiveEntry();
          activeEntry.name = found.node.text;
        }

        saveAppState();
        render();
      });
    }

    if (viewport) {
      viewport.addEventListener("wheel", onWheel, { passive: false });
      viewport.addEventListener("mousedown", onMouseDown);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    renderLegend();
    render();
    setTimeout(fitToView, 100);

    console.log("权权目标管理 v1.5.0 multi-entry renderer loaded");
  }

  window.addGoalFromButton = addGoal;
  window.addEntryFromButton = addEntry;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
