// ── State ──────────────────────────────────────────────
const colors = ['#007aff', '#ff9500', '#34c759', '#ff3b30', '#af52de', '#ff2d55'];
let selectedColor = colors[0];
let selectedGeneralColor = colors[0];
let selectedDate = null;
let tasks = {};
let templates = {};
let generalTasks = [];
let selectedDays = new Set();
let editingTaskId = null;
let editingGeneralTaskId = null;

// ── Theme ──────────────────────────────────────────────
function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.querySelector('.theme-toggle').textContent = newTheme === 'dark' ? '🌑' : '🌕';
}

function loadTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.textContent = saved === 'dark' ? '🌑' : '🌕';
}

// ── Init ───────────────────────────────────────────────
function init() {
    loadTheme();
    const now = new Date();
    document.getElementById('monthYear').textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    loadTasks();
    loadTemplates();
    loadGeneralTasks();

    renderCalendar();
    renderColorPicker('colorPicker', (c) => { selectedColor = c; });
    renderColorPicker('generalColorPicker', (c) => { selectedGeneralColor = c; });
    renderGeneralTasks();
    setupRepeatListeners();

    // Timed task delete button
    document.getElementById('deleteBtn').addEventListener('click', deleteTask);

    // General task delete button
    document.getElementById('generalDeleteBtn').addEventListener('click', deleteGeneralTask);

    // Timed task form
    document.getElementById('taskForm').addEventListener('submit', handleTaskSubmit);

    // General task form
    document.getElementById('generalTaskForm').addEventListener('submit', handleGeneralTaskSubmit);

    // Close modals on backdrop click
    document.getElementById('taskModal').addEventListener('click', (e) => {
        if (e.target.id === 'taskModal') closeModal();
    });
    document.getElementById('generalTaskModal').addEventListener('click', (e) => {
        if (e.target.id === 'generalTaskModal') closeGeneralModal();
    });
}

// ── Repeat listeners ───────────────────────────────────
function setupRepeatListeners() {
    const repeatSelect = document.getElementById('repeatOption');
    const customDaysGroup = document.getElementById('customDaysGroup');

    if (repeatSelect) {
        repeatSelect.addEventListener('change', (e) => {
            customDaysGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });
    }

    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const day = parseInt(btn.dataset.day);
            if (selectedDays.has(day)) {
                selectedDays.delete(day);
                btn.classList.remove('selected');
            } else {
                selectedDays.add(day);
                btn.classList.add('selected');
            }
        });
    });
}

// ── Color picker ───────────────────────────────────────
function renderColorPicker(pickerId, onSelect) {
    const picker = document.getElementById(pickerId);
    picker.innerHTML = '';
    colors.forEach((color, i) => {
        const option = document.createElement('div');
        option.className = 'color-option' + (i === 0 ? ' selected' : '');
        option.style.background = color;
        option.addEventListener('click', () => {
            picker.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            onSelect(color);
        });
        picker.appendChild(option);
    });
}

// ── Calendar ───────────────────────────────────────────
function renderCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'day empty';
        calendarDays.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${month + 1}-${day}`;
        const dayTasks = tasks[dateKey] || [];

        const el = document.createElement('div');
        el.className = 'day';

        const num = document.createElement('div');
        num.textContent = day;
        el.appendChild(num);

        const dots = document.createElement('div');
        dots.className = 'task-dots';
        [...new Set(dayTasks.map(t => t.color))].slice(0, 4).forEach(color => {
            const dot = document.createElement('div');
            dot.className = 'task-dot';
            dot.style.background = color;
            dots.appendChild(dot);
        });
        el.appendChild(dots);

        el.onclick = () => selectDate(year, month, day);
        calendarDays.appendChild(el);
    }
}

function selectDate(year, month, day) {
    selectedDate = `${year}-${month + 1}-${day}`;
    document.getElementById('selectedDate').textContent =
        new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    document.getElementById('calendarView').style.display = 'none';
    document.getElementById('tasksView').classList.add('active');
    renderTasks();
}

function showCalendar() {
    document.getElementById('calendarView').style.display = 'block';
    document.getElementById('tasksView').classList.remove('active');
    renderCalendar();
}

// ── Timed Tasks ────────────────────────────────────────
function handleTaskSubmit(e) {
    e.preventDefault();

    const taskData = {
        name: document.getElementById('taskName').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        color: selectedColor,
    };

    if (editingTaskId) {
        const idx = tasks[selectedDate].findIndex(t => t.id === editingTaskId);
        if (idx !== -1) {
            tasks[selectedDate][idx] = { ...tasks[selectedDate][idx], ...taskData };
            tasks[selectedDate].sort((a, b) => a.startTime.localeCompare(b.startTime));
        }
        editingTaskId = null;
    } else {
        const repeatOption = document.getElementById('repeatOption').value;

        if (repeatOption === 'none') {
            if (!tasks[selectedDate]) tasks[selectedDate] = [];
            tasks[selectedDate].push({ ...taskData, id: Date.now(), completed: false, isRepeating: false });
            tasks[selectedDate].sort((a, b) => a.startTime.localeCompare(b.startTime));
        } else {
            const templateId = Date.now();
            templates[templateId] = {
                ...taskData,
                repeatType: repeatOption,
                customDays: repeatOption === 'custom' ? Array.from(selectedDays) : null
            };
            generateRepeatingTasks(templateId);
            saveTemplates();
        }
    }

    saveTasks();
    renderTasks();
    renderCalendar();
    closeModal();
}

function generateRepeatingTasks(templateId) {
    const template = templates[templateId];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const selectedDateObj = parseDate(selectedDate);

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dow = date.getDay();
        const dateKey = `${year}-${month + 1}-${day}`;
        let should = false;

        switch (template.repeatType) {
            case 'daily': should = true; break;
            case 'weekdays': should = dow >= 1 && dow <= 5; break;
            case 'weekends': should = dow === 0 || dow === 6; break;
            case 'weekly': should = dow === selectedDateObj.getDay(); break;
            case 'custom': should = template.customDays && template.customDays.includes(dow); break;
        }

        if (should) {
            if (!tasks[dateKey]) tasks[dateKey] = [];
            if (!tasks[dateKey].some(t => t.templateId === templateId)) {
                tasks[dateKey].push({
                    id: Date.now() + day,
                    name: template.name,
                    startTime: template.startTime,
                    endTime: template.endTime,
                    color: template.color,
                    completed: false,
                    isRepeating: true,
                    templateId
                });
                tasks[dateKey].sort((a, b) => a.startTime.localeCompare(b.startTime));
            }
        }
    }
}

function renderTasks() {
    const timeline = document.getElementById('timeline');
    const dateTasks = tasks[selectedDate] || [];

    if (dateTasks.length === 0) {
        timeline.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><div>No tasks scheduled for this day</div></div>`;
        return;
    }

    timeline.innerHTML = dateTasks.map(task => {
        const badge = task.isRepeating ? getRepeatBadge(task.templateId) : '';
        return `
            <div class="task-block ${task.completed ? 'completed' : ''}" style="--task-color: ${task.color}" onclick="editTask(${task.id}, event)">
                <div class="task-header">
                    <div style="flex: 1;">
                        <div class="task-title">${task.name}</div>
                        <div class="task-time">${formatTime(task.startTime)} – ${formatTime(task.endTime)}</div>
                        ${badge}
                    </div>
                    <div class="checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTask(${task.id}, event)"></div>
                </div>
            </div>`;
    }).join('');
}

function editTask(taskId, event) {
    if (event && event.target.classList.contains('checkbox')) return;
    openModal(taskId);
}

function toggleTask(taskId, event) {
    if (event) event.stopPropagation();
    const task = tasks[selectedDate].find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderTasks();
    }
}

function deleteTask(e) {
    if (e) e.preventDefault();
    if (!editingTaskId) return;

    const task = tasks[selectedDate].find(t => t.id === editingTaskId);
    if (!task) return;

    if (task.isRepeating && task.templateId) {
        const tid = task.templateId;
        Object.keys(tasks).forEach(dateKey => {
            tasks[dateKey] = tasks[dateKey].filter(t => t.templateId !== tid);
            if (tasks[dateKey].length === 0) delete tasks[dateKey];
        });
        delete templates[tid];
        saveTemplates();
    } else {
        const idx = tasks[selectedDate].findIndex(t => t.id === editingTaskId);
        if (idx !== -1) tasks[selectedDate].splice(idx, 1);
    }

    editingTaskId = null;
    saveTasks();
    renderTasks();
    renderCalendar();
    closeModal();
}

function getRepeatBadge(templateId) {
    const t = templates[templateId];
    if (!t) return '';
    const labels = { daily: 'Daily', weekdays: 'Weekdays', weekends: 'Weekends', weekly: 'Weekly', custom: 'Custom' };
    return `<span class="repeat-badge">🔁 ${labels[t.repeatType]}</span>`;
}

// ── Timed Task Modal ───────────────────────────────────
function openModal(taskId = null) {
    editingTaskId = taskId;
    const deleteBtn = document.getElementById('deleteBtn');
    const modalButtons = document.querySelector('#taskModal .modal-buttons');

    if (taskId) {
        const task = tasks[selectedDate].find(t => t.id === taskId);
        if (!task) return;
        document.querySelector('#taskModal h2').textContent = 'Edit Task';
        document.getElementById('taskName').value = task.name;
        document.getElementById('startTime').value = task.startTime;
        document.getElementById('endTime').value = task.endTime;
        selectedColor = task.color;
        document.querySelectorAll('#colorPicker .color-option').forEach(o => {
            o.classList.toggle('selected', o.style.background === task.color);
        });
        deleteBtn.style.display = 'block';
        modalButtons.classList.add('has-delete');
        const repeatEl = document.getElementById('repeatOption');
        if (task.isRepeating && templates[task.templateId]) {
            repeatEl.value = templates[task.templateId].repeatType;
            repeatEl.disabled = true;
        } else {
            repeatEl.value = 'none';
            repeatEl.disabled = false;
        }
    } else {
        document.querySelector('#taskModal h2').textContent = 'Add Task';
        document.getElementById('taskForm').reset();
        document.getElementById('repeatOption').disabled = false;
        selectedColor = colors[0];
        document.querySelectorAll('#colorPicker .color-option').forEach((o, i) => o.classList.toggle('selected', i === 0));
        deleteBtn.style.display = 'none';
        modalButtons.classList.remove('has-delete');
    }

    document.getElementById('customDaysGroup').style.display = 'none';
    selectedDays.clear();
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('taskModal').classList.add('active');
}

function closeModal() {
    document.getElementById('taskModal').classList.remove('active');
    editingTaskId = null;
    const modalButtons = document.querySelector('#taskModal .modal-buttons');
    modalButtons.classList.remove('has-delete');
    document.getElementById('deleteBtn').style.display = 'none';
}

// ── General Tasks ──────────────────────────────────────
function handleGeneralTaskSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('generalTaskName').value.trim();
    if (!name) return;

    if (editingGeneralTaskId !== null) {
        const idx = generalTasks.findIndex(t => t.id === editingGeneralTaskId);
        if (idx !== -1) {
            generalTasks[idx].name = name;
            generalTasks[idx].color = selectedGeneralColor;
        }
        editingGeneralTaskId = null;
    } else {
        generalTasks.push({ id: Date.now(), name, color: selectedGeneralColor, completed: false });
    }

    saveGeneralTasks();
    renderGeneralTasks();
    closeGeneralModal();
}

function renderGeneralTasks() {
    const list = document.getElementById('generalTasksList');

    if (generalTasks.length === 0) {
        list.innerHTML = '<div class="empty-state-small">No general tasks yet</div>';
        return;
    }

    list.innerHTML = generalTasks.map(task => `
        <div class="general-task-item ${task.completed ? 'completed' : ''}"
             style="--item-color: ${task.color}"
             onclick="editGeneralTask(${task.id}, event)">
            <span class="general-task-name">${task.name}</span>
            <div class="checkbox ${task.completed ? 'checked' : ''}" onclick="toggleGeneralTask(${task.id}, event)"></div>
        </div>
    `).join('');
}

function toggleGeneralTask(taskId, event) {
    if (event) event.stopPropagation();
    const task = generalTasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        saveGeneralTasks();
        renderGeneralTasks();
    }
}

function editGeneralTask(taskId, event) {
    if (event && event.target.classList.contains('checkbox')) return;
    openGeneralModal(taskId);
}

function deleteGeneralTask(e) {
    if (e) e.preventDefault();
    if (editingGeneralTaskId === null) return;
    generalTasks = generalTasks.filter(t => t.id !== editingGeneralTaskId);
    editingGeneralTaskId = null;
    saveGeneralTasks();
    renderGeneralTasks();
    closeGeneralModal();
}

function openGeneralModal(taskId = null) {
    editingGeneralTaskId = taskId;
    const deleteBtn = document.getElementById('generalDeleteBtn');
    const modalButtons = document.querySelector('#generalTaskModal .modal-buttons');

    if (taskId !== null) {
        const task = generalTasks.find(t => t.id === taskId);
        if (!task) return;
        document.getElementById('generalModalTitle').textContent = 'Edit Task';
        document.getElementById('generalTaskName').value = task.name;
        selectedGeneralColor = task.color;
        document.querySelectorAll('#generalColorPicker .color-option').forEach(o => {
            o.classList.toggle('selected', o.style.background === task.color);
        });
        deleteBtn.style.display = 'block';
        modalButtons.classList.add('has-delete');
    } else {
        document.getElementById('generalModalTitle').textContent = 'Add General Task';
        document.getElementById('generalTaskForm').reset();
        selectedGeneralColor = colors[0];
        document.querySelectorAll('#generalColorPicker .color-option').forEach((o, i) => o.classList.toggle('selected', i === 0));
        deleteBtn.style.display = 'none';
        modalButtons.classList.remove('has-delete');
    }

    document.getElementById('generalTaskModal').classList.add('active');
}

function closeGeneralModal() {
    document.getElementById('generalTaskModal').classList.remove('active');
    editingGeneralTaskId = null;
    document.querySelector('#generalTaskModal .modal-buttons').classList.remove('has-delete');
    document.getElementById('generalDeleteBtn').style.display = 'none';
}

// ── Helpers ────────────────────────────────────────────
function formatTime(time) {
    const [h, m] = time.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function parseDate(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// ── Persistence ────────────────────────────────────────
function saveTasks() { localStorage.setItem('habitTasks', JSON.stringify(tasks)); }
function loadTasks() { const s = localStorage.getItem('habitTasks'); if (s) tasks = JSON.parse(s); }
function saveTemplates() { localStorage.setItem('habitTemplates', JSON.stringify(templates)); }
function loadTemplates() { const s = localStorage.getItem('habitTemplates'); if (s) templates = JSON.parse(s); }
function saveGeneralTasks() { localStorage.setItem('generalTasks', JSON.stringify(generalTasks)); }
function loadGeneralTasks() { const s = localStorage.getItem('generalTasks'); if (s) generalTasks = JSON.parse(s); }

init();
