const colors = ['#007aff', '#ff9500', '#34c759', '#ff3b30', '#af52de', '#ff2d55'];
let selectedColor = colors[0];
let selectedDate = null;
let tasks = {};
let templates = {}; // Store task templates for repeating tasks
let selectedDays = new Set();
let editingTaskId = null; // Track if we're editing a task

// Theme Management
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update toggle button icon
    const toggleBtn = document.querySelector('.theme-toggle');
    toggleBtn.textContent = newTheme === 'dark' ? '🌑' : '🌕';;
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = savedTheme === 'dark' ? '🌑' : '🌕';
    }
}

// Initialize
function init() {
    loadTheme();
    const now = new Date();
    document.getElementById('monthYear').textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    renderCalendar();
    renderColorPicker();
    loadTasks();
    loadTemplates();
    setupRepeatListeners();

    // Setup delete button
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function (e) {
            deleteTask(e);
        });
    }

    // Setup form submission
    document.getElementById('taskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Form submitted');
        console.log('selectedDate:', selectedDate);

        const taskData = {
            name: document.getElementById('taskName').value,
            startTime: document.getElementById('startTime').value,
            endTime: document.getElementById('endTime').value,
            color: selectedColor,
        };

        console.log('taskData:', taskData);

        if (editingTaskId) {
            // Edit existing task
            console.log('Editing task:', editingTaskId);
            const taskIndex = tasks[selectedDate].findIndex(t => t.id === editingTaskId);
            if (taskIndex !== -1) {
                tasks[selectedDate][taskIndex] = {
                    ...tasks[selectedDate][taskIndex],
                    ...taskData
                };
                tasks[selectedDate].sort((a, b) => a.startTime.localeCompare(b.startTime));
            }
            editingTaskId = null;
        } else {
            // Add new task
            const repeatOption = document.getElementById('repeatOption').value;
            console.log('Creating new task, repeat option:', repeatOption);

            if (repeatOption === 'none') {
                // Single task
                const task = {
                    ...taskData,
                    id: Date.now(),
                    completed: false,
                    isRepeating: false
                };

                if (!tasks[selectedDate]) {
                    tasks[selectedDate] = [];
                }
                tasks[selectedDate].push(task);
                tasks[selectedDate].sort((a, b) => a.startTime.localeCompare(b.startTime));
                console.log('Single task created:', task);
            } else {
                // Repeating task - create template
                const templateId = Date.now();
                templates[templateId] = {
                    ...taskData,
                    repeatType: repeatOption,
                    customDays: repeatOption === 'custom' ? Array.from(selectedDays) : null
                };

                console.log('Repeating task template created:', templates[templateId]);
                // Generate tasks for current month
                generateRepeatingTasks(templateId);
                saveTemplates();
            }
        }

        saveTasks();
        renderTasks();
        renderCalendar(); // Update calendar to show new task indicators
        closeModal();
    });

    // Close modal when clicking outside
    document.getElementById('taskModal').addEventListener('click', (e) => {
        if (e.target.id === 'taskModal') {
            closeModal();
        }
    });
}

function setupRepeatListeners() {
    const repeatSelect = document.getElementById('repeatOption');
    const customDaysGroup = document.getElementById('customDaysGroup');

    if (repeatSelect) {
        repeatSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customDaysGroup.style.display = 'block';
            } else {
                customDaysGroup.style.display = 'none';
            }
        });
    }

    // Day button toggles
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

function renderCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'day empty';
        calendarDays.appendChild(emptyDay);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'day';

        const dateKey = `${year}-${month + 1}-${day}`;
        const dayTasks = tasks[dateKey] || [];

        // Create day number
        const dayNumber = document.createElement('div');
        dayNumber.textContent = day;
        dayElement.appendChild(dayNumber);

        // Create dots container
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'task-dots';

        // Add colored dots for each task (limit to 4 for space)
        const uniqueColors = [...new Set(dayTasks.map(t => t.color))].slice(0, 4);
        uniqueColors.forEach(color => {
            const dot = document.createElement('div');
            dot.className = 'task-dot';
            dot.style.background = color;
            dotsContainer.appendChild(dot);
        });

        dayElement.appendChild(dotsContainer);
        dayElement.onclick = () => selectDate(year, month, day);
        calendarDays.appendChild(dayElement);
    }
}

function selectDate(year, month, day) {
    selectedDate = `${year}-${month + 1}-${day}`;
    const dateObj = new Date(year, month, day);
    document.getElementById('selectedDate').textContent = dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });

    document.getElementById('calendarView').style.display = 'none';
    document.getElementById('tasksView').classList.add('active');

    renderTasks();
}

function showCalendar() {
    document.getElementById('calendarView').style.display = 'block';
    document.getElementById('tasksView').classList.remove('active');
    renderCalendar();
}

function renderColorPicker() {
    const picker = document.getElementById('colorPicker');
    colors.forEach(color => {
        const option = document.createElement('div');
        option.className = 'color-option';
        option.style.background = color;
        if (color === selectedColor) {
            option.classList.add('selected');
        }
        option.onclick = () => {
            selectedColor = color;
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        };
        picker.appendChild(option);
    });
}

function openModal(taskId = null) {
    editingTaskId = taskId;
    document.getElementById('taskModal').classList.add('active');
    const deleteBtn = document.getElementById('deleteBtn');
    const modalButtons = document.querySelector('.modal-buttons');

    if (taskId) {
        // Edit mode
        const task = tasks[selectedDate].find(t => t.id === taskId);
        if (task) {
            document.querySelector('.modal h2').textContent = 'Edit Task';
            document.getElementById('taskName').value = task.name;
            document.getElementById('startTime').value = task.startTime;
            document.getElementById('endTime').value = task.endTime;

            // Set color
            selectedColor = task.color;
            document.querySelectorAll('.color-option').forEach(option => {
                option.classList.toggle('selected', option.style.background === task.color);
            });

            // Show delete button
            deleteBtn.style.display = 'block';
            modalButtons.classList.add('has-delete');

            // For repeating tasks, show repeat info but make it read-only
            if (task.isRepeating) {
                const template = templates[task.templateId];
                if (template) {
                    document.getElementById('repeatOption').value = template.repeatType;
                    document.getElementById('repeatOption').disabled = true;
                }
            } else {
                document.getElementById('repeatOption').value = 'none';
                document.getElementById('repeatOption').disabled = false;
            }
        }
    } else {
        // Add mode
        document.querySelector('.modal h2').textContent = 'Add Task';
        document.getElementById('taskForm').reset();
        document.getElementById('repeatOption').disabled = false;
        deleteBtn.style.display = 'none';
        modalButtons.classList.remove('has-delete');
        document.querySelectorAll('.color-option').forEach((o, i) => {
            o.classList.toggle('selected', i === 0);
        });
        selectedColor = colors[0];
    }

    // Reset repeat options
    document.getElementById('customDaysGroup').style.display = 'none';
    selectedDays.clear();
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
}

function deleteTask(e) {
    if (e) e.preventDefault();
    if (!editingTaskId) return;

    const task = tasks[selectedDate].find(t => t.id === editingTaskId);
    if (!task) return;

    if (task.isRepeating && task.templateId) {
        // Delete all instances of this repeating task across all dates
        const templateId = task.templateId;

        // Remove from all dates
        Object.keys(tasks).forEach(dateKey => {
            tasks[dateKey] = tasks[dateKey].filter(t => t.templateId !== templateId);
            // Clean up empty date entries
            if (tasks[dateKey].length === 0) {
                delete tasks[dateKey];
            }
        });

        // Remove the template
        delete templates[templateId];
        saveTemplates();
    } else {
        // Delete single task
        const taskIndex = tasks[selectedDate].findIndex(t => t.id === editingTaskId);
        if (taskIndex !== -1) {
            tasks[selectedDate].splice(taskIndex, 1);
        }
    }

    editingTaskId = null;
    saveTasks();
    renderTasks();
    renderCalendar();
    closeModal();
}

function closeModal() {
    document.getElementById('taskModal').classList.remove('active');
    editingTaskId = null;
    const modalButtons = document.querySelector('.modal-buttons');
    modalButtons.classList.remove('has-delete');
    document.getElementById('deleteBtn').style.display = 'none';
}

function generateRepeatingTasks(templateId) {
    const template = templates[templateId];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        const dateKey = `${year}-${month + 1}-${day}`;

        let shouldCreate = false;

        switch (template.repeatType) {
            case 'daily':
                shouldCreate = true;
                break;
            case 'weekdays':
                shouldCreate = dayOfWeek >= 1 && dayOfWeek <= 5;
                break;
            case 'weekends':
                shouldCreate = dayOfWeek === 0 || dayOfWeek === 6;
                break;
            case 'weekly':
                const selectedDateObj = parseDate(selectedDate);
                shouldCreate = dayOfWeek === selectedDateObj.getDay();
                break;
            case 'custom':
                shouldCreate = template.customDays && template.customDays.includes(dayOfWeek);
                break;
        }

        if (shouldCreate) {
            if (!tasks[dateKey]) {
                tasks[dateKey] = [];
            }

            // Check if this template task already exists for this date
            const exists = tasks[dateKey].some(t => t.templateId === templateId);
            if (!exists) {
                tasks[dateKey].push({
                    id: Date.now() + day,
                    name: template.name,
                    startTime: template.startTime,
                    endTime: template.endTime,
                    color: template.color,
                    completed: false,
                    isRepeating: true,
                    templateId: templateId
                });
                tasks[dateKey].sort((a, b) => a.startTime.localeCompare(b.startTime));
            }
        }
    }
}

function parseDate(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function renderTasks() {
    const timeline = document.getElementById('timeline');
    const dateTasks = tasks[selectedDate] || [];

    if (dateTasks.length === 0) {
        timeline.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📅</div>
                        <div>No tasks scheduled for this day</div>
                    </div>
                `;
        return;
    }

    timeline.innerHTML = dateTasks.map(task => {
        const repeatBadge = task.isRepeating ? getRepeatBadge(task.templateId) : '';
        return `
                    <div class="task-block ${task.completed ? 'completed' : ''}" style="--task-color: ${task.color}" onclick="editTask(${task.id}, event)">
                        <div class="task-header">
                            <div style="flex: 1;">
                                <div class="task-title">${task.name}</div>
                                <div class="task-time">${formatTime(task.startTime)} - ${formatTime(task.endTime)}</div>
                                ${repeatBadge}
                            </div>
                            <div class="checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTask(${task.id}, event)"></div>
                        </div>
                    </div>
                `;
    }).join('');
}

function editTask(taskId, event) {
    // Don't open edit if clicking on checkbox
    if (event && event.target.classList.contains('checkbox')) {
        return;
    }
    openModal(taskId);
}

function getRepeatBadge(templateId) {
    const template = templates[templateId];
    if (!template) return '';

    const labels = {
        'daily': 'Daily',
        'weekdays': 'Weekdays',
        'weekends': 'Weekends',
        'weekly': 'Weekly',
        'custom': 'Custom'
    };

    return `<span class="repeat-badge">🔁 ${labels[template.repeatType]}</span>`;
}

function toggleTask(taskId, event) {
    if (event) {
        event.stopPropagation(); // Prevent edit modal from opening
    }
    const dateTasks = tasks[selectedDate];
    const task = dateTasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderTasks();
    }
}

function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

function saveTasks() {
    localStorage.setItem('habitTasks', JSON.stringify(tasks));
}

function loadTasks() {
    const saved = localStorage.getItem('habitTasks');
    if (saved) {
        tasks = JSON.parse(saved);
    }
}

function saveTemplates() {
    localStorage.setItem('habitTemplates', JSON.stringify(templates));
}

function loadTemplates() {
    const saved = localStorage.getItem('habitTemplates');
    if (saved) {
        templates = JSON.parse(saved);
    }
}

init();