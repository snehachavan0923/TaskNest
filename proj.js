(() => {
  "use strict";

  const STORAGE_KEY = "studentTaskManager.tasks.v1";
  const THEME_KEY = "studentTaskManager.theme.v1";
  const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

  const $ = (selector) => document.querySelector(selector);
  const taskForm = $("#taskForm");
  const taskTitle = $("#taskTitle");
  const taskDescription = $("#taskDescription");
  const taskCategory = $("#taskCategory");
  const taskPriority = $("#taskPriority");
  const taskDueDate = $("#taskDueDate");
  const taskList = $("#taskList");
  const emptyState = $("#emptyState");
  const formMessage = $("#formMessage");
  const submitTask = $("#submitTask");
  const cancelEdit = $("#cancelEdit");
  const searchInput = $("#searchInput");
  const clearSearch = $("#clearSearch");
  const sortTasks = $("#sortTasks");
  const priorityFilter = $("#priorityFilter");
  const themeToggle = $("#themeToggle");
  const clearCompleted = $("#clearCompleted");
  const toast = $("#toast");

  let tasks = loadTasks();
  let activeFilter = "All";
  let editingId = null;
  let toastTimeout = null;

  function loadTasks() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      // Discard malformed entries rather than letting one bad record break the app.
      return parsed.filter((task) =>
        task && typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.completed === "boolean"
      ).map((task) => ({
        id: task.id,
        title: task.title,
        description: typeof task.description === "string" ? task.description : "",
        category: ["Study", "Assignment", "Exam", "Project", "Personal"].includes(task.category) ? task.category : "Study",
        priority: ["High", "Medium", "Low"].includes(task.priority) ? task.priority : "Medium",
        dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
        completed: task.completed,
        createdAt: Number(task.createdAt) || Date.now()
      }));
    } catch (error) {
      console.warn("Could not load saved tasks:", error);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      return true;
    } catch (error) {
      console.error("Could not save tasks:", error);
      showToast("Could not save changes. Check your browser storage.");
      return false;
    }
  }

  function createId() {
    return (window.crypto && typeof window.crypto.randomUUID === "function")
      ? window.crypto.randomUUID()
      : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function dateDifference(dateString) {
    if (!dateString) return null;
    const due = new Date(`${dateString}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86400000);
  }

  function isOverdue(task) {
    return Boolean(task.dueDate && !task.completed && dateDifference(task.dueDate) < 0);
  }

  function dueLabel(task) {
    if (!task.dueDate) return "";
    const difference = dateDifference(task.dueDate);
    if (task.completed) return `Due ${formatDate(task.dueDate)}`;
    if (difference < 0) return `Overdue · ${formatDate(task.dueDate)}`;
    if (difference === 0) return "Due today";
    if (difference === 1) return "Due tomorrow";
    return `Due ${formatDate(task.dueDate)}`;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function setFormMessage(message, isSuccess = false) {
    formMessage.textContent = message;
    formMessage.classList.toggle("success", isSuccess);
  }

  function getVisibleTasks() {
    const query = searchInput.value.trim().toLowerCase();
    const priority = priorityFilter.value;
    let result = tasks.filter((task) => {
      const matchesFilter = activeFilter === "All" ||
        (activeFilter === "Completed" && task.completed) ||
        (activeFilter === "Pending" && !task.completed);
      const matchesSearch = !query ||
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.category.toLowerCase().includes(query);
      const matchesPriority = priority === "All" || task.priority === priority;
      return matchesFilter && matchesSearch && matchesPriority;
    });

    switch (sortTasks.value) {
      case "dueDate":
        result = result.slice().sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        });
        break;
      case "priority":
        result = result.slice().sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.createdAt - a.createdAt);
        break;
      case "title":
        result = result.slice().sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        result = result.slice().sort((a, b) => b.createdAt - a.createdAt);
    }
    return result;
  }

  function makeBadge(text, className) {
    const badge = document.createElement("span");
    badge.className = className;
    badge.textContent = text;
    return badge;
  }

  function renderTask(task) {
    const card = document.createElement("article");
    card.className = `task-card${task.completed ? " is-completed" : ""}`;

    const top = document.createElement("div");
    top.className = "task-top";
    const titleWrap = document.createElement("div");
    titleWrap.className = "task-title-wrap";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `${task.completed ? "Mark pending" : "Mark completed"}: ${task.title}`);
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const titleArea = document.createElement("div");
    titleArea.className = "title-area";
    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;
    titleArea.appendChild(title);
    titleWrap.append(checkbox, titleArea);

    top.appendChild(titleWrap);
    top.appendChild(makeBadge(task.priority, `priority-badge priority-${task.priority.toLowerCase()}`));
    card.appendChild(top);

    if (task.description) {
      const description = document.createElement("p");
      description.className = "task-description";
      description.textContent = task.description;
      card.appendChild(description);
    }

    const bottom = document.createElement("div");
    bottom.className = "task-bottom";
    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.appendChild(makeBadge(task.category, "category-badge"));
    const dueText = dueLabel(task);
    if (dueText) {
      let dueClass = "due-badge";
      if (isOverdue(task)) dueClass += " overdue";
      else if (!task.completed && dateDifference(task.dueDate) === 0) dueClass += " today";
      meta.appendChild(makeBadge(dueText, dueClass));
    }

    const actions = document.createElement("div");
    actions.className = "task-actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "small-button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => beginEdit(task.id));
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "small-button delete";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteTask(task.id));
    actions.append(editButton, deleteButton);
    bottom.append(meta, actions);
    card.appendChild(bottom);
    return card;
  }

  function renderTasks() {
    const visibleTasks = getVisibleTasks();
    taskList.replaceChildren();
    visibleTasks.forEach((task) => taskList.appendChild(renderTask(task)));
    emptyState.classList.toggle("hidden", visibleTasks.length > 0);
    taskList.classList.toggle("hidden", visibleTasks.length === 0);
    $("#visibleCount").textContent = String(visibleTasks.length);
    clearSearch.classList.toggle("hidden", searchInput.value.length === 0);
    updateStats();
  }

  function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    const pending = total - completed;
    const overdue = tasks.filter(isOverdue).length;
    const progress = total ? Math.round((completed / total) * 100) : 0;

    $("#totalCount").textContent = String(total);
    $("#pendingCount").textContent = String(pending);
    $("#completedCount").textContent = String(completed);
    $("#overdueCount").textContent = String(overdue);
    $("#allFilterCount").textContent = String(total);
    $("#pendingFilterCount").textContent = String(pending);
    $("#completedFilterCount").textContent = String(completed);
    $("#progressText").textContent = `${progress}%`;
    $("#progressFill").style.width = `${progress}%`;
    $("#progressBar").setAttribute("aria-valuenow", String(progress));

    let message = "Start with one small task.";
    if (total > 0 && completed === 0) message = "A little progress is still progress. Pick one task to start!";
    else if (completed > 0 && completed < total) message = "You're making progress. Keep that momentum going!";
    else if (total > 0 && completed === total) message = "Amazing work — all tasks completed. Enjoy the win!";
    else if (overdue > 0) message = "You can do this. Start with an overdue task.";
    $("#motivation").textContent = message;
    clearCompleted.disabled = completed === 0;
    clearCompleted.style.opacity = completed === 0 ? ".45" : "1";
  }

  function resetForm() {
    taskForm.reset();
    editingId = null;
    $("#formHeading").textContent = "Add a new task";
    submitTask.textContent = "＋ Add task";
    cancelEdit.classList.add("hidden");
    setFormMessage("");
  }

  function beginEdit(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    editingId = id;
    taskTitle.value = task.title;
    taskDescription.value = task.description;
    taskCategory.value = task.category;
    taskPriority.value = task.priority;
    taskDueDate.value = task.dueDate;
    $("#formHeading").textContent = "Edit task";
    submitTask.textContent = "Save changes";
    cancelEdit.classList.remove("hidden");
    setFormMessage("Editing this task. Save or cancel your changes.");
    taskTitle.focus();
    $(".form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function addOrUpdateTask(event) {
    event.preventDefault();
    const title = taskTitle.value.trim();
    const description = taskDescription.value.trim();
    if (!title) {
      setFormMessage("Please enter a task title.");
      taskTitle.focus();
      return;
    }

    const normalizedTitle = title.toLowerCase().replace(/\s+/g, " ");
    const duplicate = tasks.some((task) =>
      task.id !== editingId && task.title.toLowerCase().replace(/\s+/g, " ") === normalizedTitle
    );
    if (duplicate) {
      setFormMessage("A task with this title already exists.");
      taskTitle.focus();
      return;
    }

    const taskData = {
      title,
      description,
      category: taskCategory.value,
      priority: taskPriority.value,
      dueDate: taskDueDate.value
    };

    if (editingId) {
      const index = tasks.findIndex((task) => task.id === editingId);
      if (index !== -1) tasks[index] = { ...tasks[index], ...taskData };
      saveTasks();
      resetForm();
      renderTasks();
      showToast("Task updated successfully.");
    } else {
      tasks.push({
        id: createId(),
        ...taskData,
        completed: false,
        createdAt: Date.now()
      });
      saveTasks();
      resetForm();
      renderTasks();
      showToast("Task added. Nice work!");
    }
  }

  function toggleTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
    showToast(task.completed ? "Task completed. Great job!" : "Task moved back to pending.");
  }

  function deleteTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    tasks = tasks.filter((item) => item.id !== id);
    if (editingId === id) resetForm();
    saveTasks();
    renderTasks();
    showToast("Task deleted.");
  }

  function clearCompletedTasks() {
    const completed = tasks.filter((task) => task.completed);
    if (!completed.length) return;
    if (!window.confirm(`Delete all ${completed.length} completed task(s)? This cannot be undone.`)) return;
    const completedIds = new Set(completed.map((task) => task.id));
    tasks = tasks.filter((task) => !completedIds.has(task.id));
    if (editingId && !tasks.some((task) => task.id === editingId)) resetForm();
    saveTasks();
    renderTasks();
    showToast("Completed tasks cleared.");
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark", isDark);
    themeToggle.innerHTML = isDark ? "☀ <span>Light mode</span>" : "☾ <span>Dark mode</span>";
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    try { localStorage.setItem(THEME_KEY, theme); } catch (error) { console.warn("Could not save theme:", error); }
  }

  taskForm.addEventListener("submit", addOrUpdateTask);
  cancelEdit.addEventListener("click", resetForm);
  searchInput.addEventListener("input", renderTasks);
  clearSearch.addEventListener("click", () => { searchInput.value = ""; renderTasks(); searchInput.focus(); });
  sortTasks.addEventListener("change", renderTasks);
  priorityFilter.addEventListener("change", renderTasks);
  clearCompleted.addEventListener("click", clearCompletedTasks);
  themeToggle.addEventListener("click", () => applyTheme(document.body.classList.contains("dark") ? "light" : "dark"));

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderTasks();
    });
  });

  const today = new Date();
  $("#todayLabel").textContent = today.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    applyTheme(savedTheme === "dark" ? "dark" : "light");
  } catch (error) {
    applyTheme("light");
  }
  renderTasks();
})();
