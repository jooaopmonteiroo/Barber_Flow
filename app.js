// --- SUPABASE CONFIGURATION ---
const supabaseClient = supabase.createClient('https://ugrmbncehorqpfeuqyva.supabase.co', 'sb_publishable_4tCjxVkFUp9YEL1JqKKN3w_Em38bjRI');

/* ==========================================================================
   BARBERFLOW - APPLICATION CORE LOGIC
   ========================================================================== */

// --- STATE MANAGEMENT ---
let state = {
    users: [],
    services: [],
    appointments: [],
    blockedSlots: [],
    currentUser: null
};

// --- CONFIGURATION ---
const BUSINESS_HOURS = [
    "09:00", "09:45", "10:30", "11:15", "13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30"
];

// --- WHATSAPP CLOUD API CONFIGURATION ---
const WHATSAPP_CONFIG = {
    accessToken: "SEU_META_ACCESS_TOKEN",
    phoneNumberId: "SEU_PHONE_NUMBER_ID",
    recipientPhone: "5511963826328",
    templateName: "agendamento_barberflow",
    useTemplate: false
};

// --- SEED INITIAL DATA ---
function seedDatabase() {
    const existingUsers = localStorage.getItem('bf_users');
    if (existingUsers) {
        try {
            const users = JSON.parse(existingUsers);
            const hasExamples = users.some(u => u.name === "Renan degradê" || u.name === "Felipe Navalha");
            if (hasExamples) {
                localStorage.removeItem('bf_users');
                localStorage.removeItem('bf_appointments');
                localStorage.removeItem('bf_currentUser');
                localStorage.removeItem('bf_blockedSlots');
            }
        } catch (e) {
            console.error("Migration error", e);
        }
    }

    if (!localStorage.getItem('bf_users')) {
        const initialUsers = [];
        localStorage.setItem('bf_users', JSON.stringify(initialUsers));
    }

    if (!localStorage.getItem('bf_services')) {
        const initialServices = [
            { id: "s-1", name: "Corte Degradê Moderno", description: "Corte de cabelo com degradê suave nas laterais, acabamento perfeito, lavagem com shampoo premium and finalização com pomada modeladora.", price: 50.00, duration: 45, icon: "scissors" },
            { id: "s-2", name: "Barboterapia Real", description: "Design de barba desenhada, toalha quente aromática, massagem facial, barbear clássico com navalha e óleo de hidratação pós-barba.", price: 40.00, duration: 30, icon: "brush" },
            { id: "s-3", name: "Combo VIP (Cabelo + Barba)", description: "O pacote completo para o homem de negócios. Inclui Corte Degradê, Barboterapia Completa, lavagem especial e massagem capilar.", price: 80.00, duration: 60, icon: "crown" },
            { id: "s-4", name: "Selagem Redutora / Alisamento", description: "Tratamento de redução de volume e alinhamento capilar. Proporciona brilho intenso e cabelos disciplinados.", price: 120.00, duration: 90, icon: "sparkles" }
        ];
        localStorage.setItem('bf_services', JSON.stringify(initialServices));
    }

    if (!localStorage.getItem('bf_appointments')) {
        const initialAppointments = [];
        localStorage.setItem('bf_appointments', JSON.stringify(initialAppointments));
    }

    if (!localStorage.getItem('bf_blockedSlots')) {
        const initialBlockedSlots = [];
        localStorage.setItem('bf_blockedSlots', JSON.stringify(initialBlockedSlots));
    }
}

// --- STATE LOADER ---
function loadState() {
    state.users = JSON.parse(localStorage.getItem('bf_users')) || [];
    state.services = JSON.parse(localStorage.getItem('bf_services')) || [];
    state.appointments = JSON.parse(localStorage.getItem('bf_appointments')) || [];
    state.blockedSlots = JSON.parse(localStorage.getItem('bf_blockedSlots')) || [];

    const cachedUser = localStorage.getItem('bf_currentUser');
    if (cachedUser) {
        state.currentUser = JSON.parse(cachedUser);
    }
}

function saveStateToStorage() {
    localStorage.setItem('bf_users', JSON.stringify(state.users));
    localStorage.setItem('bf_services', JSON.stringify(state.services));
    localStorage.setItem('bf_appointments', JSON.stringify(state.appointments));
    localStorage.setItem('bf_blockedSlots', JSON.stringify(state.blockedSlots || []));
    if (state.currentUser) {
        localStorage.setItem('bf_currentUser', JSON.stringify(state.currentUser));
    } else {
        localStorage.removeItem('bf_currentUser');
    }
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    seedDatabase();
    loadState();

    // Buscar agendamentos salvos na nuvem logo na inicialização
    carregarAgendamentosDaNuvem();

    if (state.currentUser) {
        enterApp();
    } else {
        navigateToView('view-auth');
    }

    lucide.createIcons();
});

// --- DATE HELPER FUNCTIONS ---
function getTodayDateString() {
    const today = new Date();
    return formatDateString(today);
}

function getDateOffsetString(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return formatDateString(d);
}

function formatDateString(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function formatLocalDate(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <div>${message}</div>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- ROUTING / VIEW SWITCHER ---
function navigateToView(viewId) {
    const views = document.querySelectorAll('.view-route, .view-route-flex');
    views.forEach(v => {
        v.classList.remove('active');
    });

    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
    }
}

// --- AUTHENTICATION FLOWS ---
let currentRegisterType = 'cliente';

function switchAuthTab(tab) {
    const loginForm = document.getElementById('form-login');
    const registerForm = document.getElementById('form-register');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const subtitle = document.getElementById('auth-subtitle');

    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        subtitle.innerText = "Entre na sua conta para gerenciar seus agendamentos";
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        subtitle.innerText = "Crie sua conta para agendar ou disponibilizar horários";
    }
}

function selectUserType(type) {
    currentRegisterType = type;
    const clientSelector = document.getElementById('selector-client');
    const barberSelector = document.getElementById('selector-barber');

    if (type === 'cliente') {
        clientSelector.classList.add('selected');
        barberSelector.classList.remove('selected');
    } else {
        barberSelector.classList.add('selected');
        clientSelector.classList.remove('selected');
    }
}

function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;

    const exists = state.users.find(u => u.email === email || u.phone === phone);
    if (exists) {
        showToast("E-mail ou Telefone já cadastrados!", "error");
        return;
    }

    const newUser = {
        id: 'u-' + Date.now(),
        name,
        email,
        phone,
        password,
        role: currentRegisterType
    };

    state.users.push(newUser);
    state.currentUser = newUser;
    saveStateToStorage();

    showToast(`Conta criada com sucesso! Bem-vindo, ${name}`, "success");
    document.getElementById('form-register').reset();
    enterApp();
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    const user = state.users.find(u => u.email === email && u.password === password);
    if (!user) {
        showToast("E-mail ou senha incorretos!", "error");
        return;
    }

    state.currentUser = user;
    saveStateToStorage();
    showToast(`Bem-vindo de volta, ${user.name}!`, "success");

    document.getElementById('form-login').reset();
    enterApp();
}

function handleLogout() {
    state.currentUser = null;
    localStorage.removeItem('bf_currentUser');

    navigateToView('view-auth');
    switchAuthTab('login');
    showToast("Sessão encerrada.", "info");
}

// --- ENTER APP MAIN SHELL ---
function enterApp() {
    navigateToView('view-app-shell');

    const avatarLetter = state.currentUser.name.charAt(0).toUpperCase();
    document.getElementById('user-avatar').innerText = avatarLetter;
    document.getElementById('user-display-name').innerText = state.currentUser.name;
    document.getElementById('user-display-role').innerText = state.currentUser.role === 'barbeiro' ? 'Barbeiro' : 'Cliente';

    buildSidebarNavigation();

    if (state.currentUser.role === 'barbeiro') {
        navigateTo('subview-barber-dashboard');
    } else {
        navigateTo('subview-client-appointments');
    }
}

// --- SIDEBAR BUILDER ---
function buildSidebarNavigation() {
    const menu = document.getElementById('sidebar-nav-menu');
    menu.innerHTML = '';

    if (state.currentUser.role === 'barbeiro') {
        menu.innerHTML = `
            <li>
                <a id="nav-barber-dash" class="nav-link active" onclick="navigateTo('subview-barber-dashboard')">
                    <i data-lucide="calendar"></i>
                    <span>Agenda e Painel</span>
                </a>
            </li>
            <li>
                <a id="nav-barber-serv" class="nav-link" onclick="navigateTo('subview-barber-services')">
                    <i data-lucide="package"></i>
                    <span>Criar Serviços</span>
                </a>
            </li>
            <li>
                <a class="nav-link" onclick="handleLogout()" style="color: var(--danger);">
                    <i data-lucide="log-out"></i>
                    <span>Sair</span>
                </a>
            </li>
        `;
    } else {
        menu.innerHTML = `
            <li>
                <a id="nav-client-apts" class="nav-link active" onclick="navigateTo('subview-client-appointments')">
                    <i data-lucide="clock"></i>
                    <span>Meus Horários</span>
                </a>
            </li>
            <li>
                <a id="nav-client-book" class="nav-link" onclick="navigateTo('subview-client-book')">
                    <i data-lucide="plus-circle"></i>
                    <span>Agendar Serviço</span>
                </a>
            </li>
            <li>
                <a class="nav-link" onclick="handleLogout()" style="color: var(--danger);">
                    <i data-lucide="log-out"></i>
                    <span>Sair</span>
                </a>
            </li>
        `;
    }
    lucide.createIcons();
}

// --- SUB-NAVIGATION ---
let activeSubview = '';
function navigateTo(subviewId) {
    const subviews = ['subview-barber-dashboard', 'subview-barber-services', 'subview-client-book', 'subview-client-appointments'];
    subviews.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active');
            el.style.display = 'none';
        }
    });

    const target = document.getElementById(subviewId);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    }

    activeSubview = subviewId;

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(lnk => lnk.classList.remove('active'));

    if (subviewId === 'subview-barber-dashboard') {
        const item = document.getElementById('nav-barber-dash');
        if (item) item.classList.add('active');
        updateBarberDashboard();
    } else if (subviewId === 'subview-barber-services') {
        const item = document.getElementById('nav-barber-serv');
        if (item) item.classList.add('active');
        updateBarberServicesList();
    } else if (subviewId === 'subview-client-book') {
        const item = document.getElementById('nav-client-book');
        if (item) item.classList.add('active');
        initBookingWizard();
    } else if (subviewId === 'subview-client-appointments') {
        const item = document.getElementById('nav-client-apts');
        if (item) item.classList.add('active');
        updateClientAppointmentsList();
    }

    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    const headerAction = document.getElementById('header-action-container');
    headerAction.innerHTML = '';

    if (subviewId === 'subview-barber-dashboard') {
        titleEl.innerText = `Painel do Barbeiro`;
        subtitleEl.innerText = `Olá, ${state.currentUser.name}. Acompanhe e valide seus agendamentos diários.`;
    } else if (subviewId === 'subview-barber-services') {
        titleEl.innerText = `Meus Serviços`;
        subtitleEl.innerText = `Crie e gerencie o catálogo de serviços oferecido aos seus clientes.`;
    } else if (subviewId === 'subview-client-book') {
        titleEl.innerText = `Novo Agendamento`;
        subtitleEl.innerText = `Selecione as opções desejadas e garanta sua vaga na barbearia.`;
    } else if (subviewId === 'subview-client-appointments') {
        titleEl.innerText = `Meus Agendamentos`;
        subtitleEl.innerText = `Consulte abaixo o histórico e os próximos horários reservados.`;
    }

    lucide.createIcons();
}

// ==========================================================================
// BARBER DASHBOARD LOGIC
// ==========================================================================
let currentCalendarDate = new Date();
let selectedAgendaDateStr = getTodayDateString();

function updateBarberDashboard() {
    renderBarberStats();
    renderBarberCalendar();
    renderBarberAgendaList();
}

function renderBarberStats() {
    const todayStr = getTodayDateString();
    const barberApts = state.appointments.filter(ap => ap.barberId === state.currentUser.id);

    const todayApts = barberApts.filter(ap => ap.date === todayStr && ap.status !== 'cancelled');
    document.getElementById('stat-today-count').innerText = todayApts.length;

    const validRevenueApts = barberApts.filter(ap => ap.status === 'confirmed' || ap.status === 'completed');
    const totalRev = validRevenueApts.reduce((sum, ap) => sum + parseFloat(ap.servicePrice), 0);
    document.getElementById('stat-revenue').innerText = `R$ ${totalRev.toFixed(2)}`;

    const completedApts = barberApts.filter(ap => ap.status === 'completed');
    document.getElementById('stat-clients-count').innerText = completedApts.length;

    document.getElementById('stat-services-count').innerText = state.services.length;
}

function renderBarberCalendar() {
    const grid = document.getElementById('calendar-days-grid');
    grid.innerHTML = '';

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    document.getElementById('calendar-month-year').innerText = `${monthNames[month]} ${year}`;

    const dayHeaders = ["D", "S", "T", "Q", "Q", "S", "S"];
    dayHeaders.forEach(day => {
        const dh = document.createElement('div');
        dh.className = 'calendar-day-name';
        dh.innerText = day;
        grid.appendChild(dh);
    });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    for (let x = firstDayIndex; x > 0; x--) {
        const dayNum = prevLastDay - x + 1;
        const cell = document.createElement('div');
        cell.className = 'calendar-day other-month';
        cell.innerText = dayNum;
        grid.appendChild(cell);
    }

    for (let i = 1; i <= lastDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.innerText = i;

        const tempMonthStr = String(month + 1).padStart(2, '0');
        const tempDayStr = String(i).padStart(2, '0');
        const dateString = `${year}-${tempMonthStr}-${tempDayStr}`;

        if (dateString === selectedAgendaDateStr) {
            cell.classList.add('active');
        }

        const barberHasAppointments = state.appointments.some(ap =>
            (ap.barberId === state.currentUser.id || ap.customerId === state.currentUser.id) && ap.date === dateString && ap.status !== 'cancelled'
        );
        if (barberHasAppointments) {
            cell.classList.add('has-appointments');
        }

        cell.onclick = () => {
            selectedAgendaDateStr = dateString;
            renderBarberCalendar();
            renderBarberAgendaList();
        };

        grid.appendChild(cell);
    }
}

function prevMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderBarberCalendar();
}

function nextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderBarberCalendar();
}

function renderBarberAgendaList() {
    const listContainer = document.getElementById('barber-appointments-list');
    listContainer.innerHTML = '';

    document.getElementById('agenda-date-display').innerText = formatLocalDate(selectedAgendaDateStr);

    const dayAppointments = state.appointments.filter(ap => ap.date === selectedAgendaDateStr);
    const dayBlockedSlots = (state.blockedSlots || []).filter(bs => bs.barberId === state.currentUser.id && bs.date === selectedAgendaDateStr);

    const agendaItems = [];

    dayAppointments.forEach(ap => {
        agendaItems.push({ type: 'appointment', time: ap.time, data: ap });
    });

    dayBlockedSlots.forEach(bs => {
        agendaItems.push({ type: 'blocked', time: bs.time, data: bs });
    });

    agendaItems.sort((a, b) => a.time.localeCompare(b.time));

    if (agendaItems.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="calendar-x"></i>
                <p>Nenhum agendamento ou bloqueio para este dia.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    agendaItems.forEach(item => {
        if (item.type === 'appointment') {
            const ap = item.data;
            const element = document.createElement('div');
            element.className = 'appointment-item';

            let actionsHtml = '';
            if (ap.status === 'pending') {
                actionsHtml = `
                    <button class="btn btn-secondary btn-sm" onclick="changeAppointmentStatus('${ap.id}', 'confirmed')" title="Confirmar">
                        <i data-lucide="check" style="color: var(--success);"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="changeAppointmentStatus('${ap.id}', 'cancelled')" title="Cancelar">
                        <i data-lucide="x" style="color: var(--danger);"></i>
                    </button>
                `;
            } else if (ap.status === 'confirmed') {
                actionsHtml = `
                    <button class="btn btn-secondary btn-sm" onclick="changeAppointmentStatus('${ap.id}', 'completed')" title="Concluir Atendimento">
                        <i data-lucide="check-square" style="color: var(--success);"></i> Concluir
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="changeAppointmentStatus('${ap.id}', 'cancelled')" title="Cancelar">
                        <i data-lucide="slash" style="color: var(--danger);"></i> Cancelar
                    </button>
                `;
            }

            let badgeClass = 'pending';
            let badgeLabel = 'Pendente';
            if (ap.status === 'confirmed') { badgeClass = 'confirmed'; badgeLabel = 'Confirmado'; }
            if (ap.status === 'completed') { badgeClass = 'completed'; badgeLabel = 'Concluído'; }
            if (ap.status === 'cancelled') { badgeClass = 'cancelled'; badgeLabel = 'Cancelado'; }

            element.innerHTML = `
                <div class="appointment-time">
                    <div class="hour">${ap.time}</div>
                    <div class="date-label">${ap.serviceDuration || 45} min</div>
                </div>
                
                <div class="appointment-details">
                    <h4>
                        ${ap.serviceName}
                        <span class="status-badge ${badgeClass}">${badgeLabel}</span>
                    </h4>
                    <div class="customer-info-tag">
                        <span><i data-lucide="user" style="width: 12px;"></i> ${ap.customerName}</span>
                        <span><i data-lucide="phone" style="width: 12px;"></i> ${ap.customerPhone || 'N/A'}</span>
                        <span><i data-lucide="dollar-sign" style="width: 12px;"></i> R$ ${parseFloat(ap.servicePrice || 0).toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="appointment-actions">
                    ${actionsHtml}
                </div>
            `;
            listContainer.appendChild(element);
        } else {
            const bs = item.data;
            const element = document.createElement('div');
            element.className = 'appointment-item blocked-item';

            element.innerHTML = `
                <div class="appointment-time" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: var(--danger);">
                    <div class="hour">${bs.time}</div>
                    <div class="date-label">BLOQUEADO</div>
                </div>
                
                <div class="appointment-details">
                    <h4 style="color: var(--danger); display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="lock" style="width: 16px; height: 16px;"></i> Horário Bloqueado
                        <span class="status-badge cancelled" style="background: var(--danger-bg); color: var(--danger);">Indisponível</span>
                    </h4>
                    <div class="customer-info-tag">
                        <span>Bloqueado pelo barbeiro para intervalos ou compromissos.</span>
                    </div>
                </div>
                
                <div class="appointment-actions">
                    <button class="btn btn-secondary btn-sm" onclick="toggleBlockSlot('${bs.time}')" title="Desbloquear Horário">
                        <i data-lucide="unlock" style="color: var(--success);"></i> Desbloquear
                    </button>
                </div>
            `;
            listContainer.appendChild(element);
        }
    });

    lucide.createIcons();
}

function changeAppointmentStatus(aptId, newStatus) {
    const apt = state.appointments.find(ap => ap.id === aptId);
    if (!apt) return;

    apt.status = newStatus;
    saveStateToStorage();

    const statusMsgs = {
        'confirmed': 'Agendamento confirmado com sucesso!',
        'completed': 'Atendimento concluído com sucesso!',
        'cancelled': 'Agendamento cancelado.'
    };

    showToast(statusMsgs[newStatus] || "Agendamento updated.", newStatus === 'cancelled' ? 'info' : 'success');
    updateBarberDashboard();
}

// ==========================================================================
// BARBER SERVICE CATALOG LOGIC
// ==========================================================================
function updateBarberServicesList() {
    const grid = document.getElementById('barber-services-grid');
    grid.innerHTML = '';

    if (state.services.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i data-lucide="package-open"></i>
                <p>Nenhum serviço cadastrado na barbearia.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    state.services.forEach(serv => {
        const card = document.createElement('div');
        card.className = 'service-card';

        card.innerHTML = `
            <div class="service-icon-wrapper">
                <i data-lucide="${serv.icon || 'scissors'}"></i>
            </div>
            <h3>${serv.name}</h3>
            <p class="service-desc">${serv.description}</p>
            
            <div class="service-meta">
                <div class="service-price">R$ ${parseFloat(serv.price).toFixed(2)}</div>
                <div class="service-duration">
                    <i data-lucide="clock" style="width: 14px; height: 14px;"></i>
                    <span>${serv.duration} min</span>
                </div>
            </div>
            
            <div class="service-card-actions">
                <button class="btn btn-secondary btn-sm" onclick="editService('${serv.id}')">
                    <i data-lucide="edit"></i> Editar
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteService('${serv.id}')">
                    <i data-lucide="trash-2"></i> Excluir
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    lucide.createIcons();
}

function openNewServiceModal() {
    document.getElementById('modal-service-title').innerText = "Criar Novo Serviço";
    document.getElementById('service-id-field').value = '';
    document.getElementById('form-service').reset();

    const modal = document.getElementById('modal-service');
    modal.classList.add('active');
}

function closeServiceModal() {
    const modal = document.getElementById('modal-service');
    modal.classList.remove('active');
}

function closeServiceModalOnOverlay(e) {
    if (e.target.id === 'modal-service') {
        closeServiceModal();
    }
}

function saveService(e) {
    e.preventDefault();

    const serviceId = document.getElementById('service-id-field').value;
    const name = document.getElementById('service-name').value.trim();
    const description = document.getElementById('service-description').value.trim();
    const price = parseFloat(document.getElementById('service-price').value);
    const duration = parseInt(document.getElementById('service-duration').value);
    const icon = document.getElementById('service-icon').value;

    if (serviceId) {
        const service = state.services.find(s => s.id === serviceId);
        if (service) {
            service.name = name;
            service.description = description;
            service.price = price;
            service.duration = duration;
            service.icon = icon;
            showToast("Serviço editado com sucesso!", "success");
        }
    } else {
        const newService = {
            id: 's-' + Date.now(),
            name,
            description,
            price,
            duration,
            icon
        };
        state.services.push(newService);
        showToast("Novo serviço adicionado ao catálogo!", "success");
    }

    saveStateToStorage();
    closeServiceModal();
    updateBarberServicesList();
}

function editService(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;

    document.getElementById('modal-service-title').innerText = "Editar Serviço";
    document.getElementById('service-id-field').value = service.id;
    document.getElementById('service-name').value = service.name;
    document.getElementById('service-description').value = service.description;
    document.getElementById('service-price').value = service.price;
    document.getElementById('service-duration').value = service.duration;
    document.getElementById('service-icon').value = service.icon || 'scissors';

    const modal = document.getElementById('modal-service');
    modal.classList.add('active');
}

function deleteService(serviceId) {
    if (confirm("Tem certeza que deseja excluir este serviço?")) {
        state.services = state.services.filter(s => s.id !== serviceId);
        saveStateToStorage();
        showToast("Serviço removido.", "info");
        updateBarberServicesList();
    }
}

function openBlockSlotsModal() {
    const modal = document.getElementById('modal-block-slots');
    document.getElementById('block-slots-date-label').innerText = `Data selecionada: ${formatLocalDate(selectedAgendaDateStr)}`;
    renderModalBlockSlotsGrid();
    modal.classList.add('active');
}

function closeBlockSlotsModal() {
    const modal = document.getElementById('modal-block-slots');
    modal.classList.remove('active');
    updateBarberDashboard();
}

function closeBlockSlotsModalOnOverlay(e) {
    if (e.target.id === 'modal-block-slots') {
        closeBlockSlotsModal();
    }
}

function renderModalBlockSlotsGrid() {
    const grid = document.getElementById('modal-block-slots-grid');
    grid.innerHTML = '';

    const dayAppointments = state.appointments.filter(ap =>
        ap.barberId === state.currentUser.id && ap.date === selectedAgendaDateStr && ap.status !== 'cancelled'
    );

    const dayBlocked = (state.blockedSlots || []).filter(bs =>
        bs.barberId === state.currentUser.id && bs.date === selectedAgendaDateStr
    );

    BUSINESS_HOURS.forEach(time => {
        const row = document.createElement('div');
        row.className = 'block-slot-row';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.padding = '0.75rem 1rem';
        row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        row.style.borderRadius = 'var(--radius-sm)';
        row.style.marginBottom = '0.5rem';
        row.style.background = 'rgba(0, 0, 0, 0.15)';

        const timeLabel = document.createElement('div');
        timeLabel.style.fontWeight = '600';
        timeLabel.style.fontFamily = 'var(--font-heading)';
        timeLabel.style.fontSize = '1.1rem';
        timeLabel.innerText = time;

        const statusContainer = document.createElement('div');
        statusContainer.style.flexGrow = '1';
        statusContainer.style.marginLeft = '1.5rem';
        statusContainer.style.fontSize = '0.85rem';
        statusContainer.style.color = 'var(--text-secondary)';

        const actionBtn = document.createElement('button');
        actionBtn.className = 'btn btn-sm';
        actionBtn.style.width = '120px';

        const appointment = dayAppointments.find(ap => ap.time === time);
        const isBlocked = dayBlocked.some(bs => bs.time === time);

        if (appointment) {
            statusContainer.innerHTML = `<span style="color: var(--gold); font-weight: 500;"><i data-lucide="user" style="width: 14px; height: 14px; vertical-align: middle;"></i> Agendado: ${appointment.customerName}</span>`;
            actionBtn.innerText = 'Ocupado';
            actionBtn.disabled = true;
            actionBtn.className = 'btn btn-secondary btn-sm';
            actionBtn.style.opacity = '0.5';
        } else if (isBlocked) {
            statusContainer.innerHTML = `<span style="color: var(--danger);"><i data-lucide="lock" style="width: 14px; height: 14px; vertical-align: middle;"></i> Bloqueado</span>`;
            actionBtn.innerHTML = '<i data-lucide="unlock"></i> Liberar';
            actionBtn.className = 'btn btn-secondary btn-sm';
            actionBtn.style.borderColor = 'var(--success)';
            actionBtn.style.color = 'var(--success)';
            actionBtn.onclick = () => {
                toggleBlockSlot(time);
                renderModalBlockSlotsGrid();
            };
        } else {
            statusContainer.innerHTML = `<span style="color: var(--success);"><i data-lucide="check" style="width: 14px; height: 14px; vertical-align: middle;"></i> Disponível</span>`;
            actionBtn.innerHTML = '<i data-lucide="lock"></i> Bloquear';
            actionBtn.className = 'btn btn-primary btn-sm';
            actionBtn.style.background = 'linear-gradient(135deg, var(--danger), #b91c1c)';
            actionBtn.style.color = '#fff';
            actionBtn.onclick = () => {
                toggleBlockSlot(time);
                renderModalBlockSlotsGrid();
            };
        }

        row.appendChild(timeLabel);
        row.appendChild(statusContainer);
        row.appendChild(actionBtn);
        grid.appendChild(row);
    });

    lucide.createIcons();
}

function toggleBlockSlot(time) {
    if (!state.blockedSlots) {
        state.blockedSlots = [];
    }

    const index = state.blockedSlots.findIndex(bs =>
        bs.barberId === state.currentUser.id && bs.date === selectedAgendaDateStr && bs.time === time
    );

    if (index > -1) {
        state.blockedSlots.splice(index, 1);
        showToast(`Horário ${time} liberado.`, 'success');
    } else {
        state.blockedSlots.push({
            id: 'block-' + Date.now(),
            barberId: state.currentUser.id,
            date: selectedAgendaDateStr,
            time: time
        });
        showToast(`Horário ${time} bloqueado.`, 'info');
    }

    saveStateToStorage();

    if (!document.getElementById('modal-block-slots').classList.contains('active')) {
        updateBarberDashboard();
    }
}

// ==========================================================================
// CLIENT APPOINTMENTS HISTORIC & LIST LOGIC
// ==========================================================================
function updateClientAppointmentsList() {
    const listContainer = document.getElementById('client-appointments-list');
    listContainer.innerHTML = '';

    const clientApts = state.appointments.filter(ap => ap.customerName === state.currentUser.name || ap.customerId === state.currentUser.id);

    clientApts.sort((a, b) => {
        const dateA = `${a.date}T${a.time}`;
        const dateB = `${b.date}T${b.time}`;
        return dateB.localeCompare(dateA);
    });

    if (clientApts.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="calendar-plus"></i>
                <p>Você ainda não realizou nenhum agendamento.</p>
                <button class="btn btn-primary btn-sm" onclick="navigateTo('subview-client-book')" style="margin-top: 1rem;">
                    Agendar Meu Primeiro Horário
                </button>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    clientApts.forEach(ap => {
        const item = document.createElement('div');
        item.className = 'appointment-item';

        let badgeClass = 'pending';
        let badgeLabel = 'Pendente';
        if (ap.status === 'confirmed') { badgeClass = 'confirmed'; badgeLabel = 'Confirmado'; }
        if (ap.status === 'completed') { badgeClass = 'completed'; badgeLabel = 'Concluído'; }
        if (ap.status === 'cancelled') { badgeClass = 'cancelled'; badgeLabel = 'Cancelado'; }

        let cancelActionHtml = '';
        if (ap.status === 'pending' || ap.status === 'confirmed') {
            cancelActionHtml = `
                <button class="btn btn-danger btn-sm" onclick="cancelClientAppointment('${ap.id}')">
                    Cancelar
                </button>
            `;
        }

        item.innerHTML = `
            <div class="appointment-time">
                <div class="hour">${ap.time}</div>
                <div class="date-label">${formatLocalDate(ap.date)}</div>
            </div>
            
            <div class="appointment-details">
                <h4>
                    ${ap.serviceName}
                    <span class="status-badge ${badgeClass}">${badgeLabel}</span>
                </h4>
                <div class="customer-info-tag">
                    <span><i data-lucide="user" style="width: 12px;"></i> Profissional: ${ap.barberName || 'Barbeiro'}</span>
                    <span><i data-lucide="dollar-sign" style="width: 12px;"></i> R$ ${parseFloat(ap.servicePrice || 0).toFixed(2)}</span>
                    <span><i data-lucide="clock" style="width: 12px;"></i> ${ap.serviceDuration || 45} minutos</span>
                </div>
            </div>
            
            <div class="appointment-actions">
                ${cancelActionHtml}
            </div>
        `;
        listContainer.appendChild(item);
    });

    lucide.createIcons();
}

function cancelClientAppointment(aptId) {
    if (confirm("Tem certeza que deseja cancelar este agendamento?")) {
        const apt = state.appointments.find(ap => ap.id === aptId);
        if (apt) {
            apt.status = 'cancelled';
            saveStateToStorage();
            showToast("Agendamento cancelado.", "info");
            updateClientAppointmentsList();
        }
    }
}

// ==========================================================================
// CLIENT BOOKING WIZARD LOGIC (STEP-BY-STEP)
// ==========================================================================
let bookingData = {
    step: 1,
    barberId: null,
    barberName: null,
    serviceId: null,
    serviceName: null,
    servicePrice: 0,
    serviceDuration: 0,
    date: null,
    time: null
};

let clientCalendarDate = new Date();

function initBookingWizard() {
    bookingData = {
        step: 1,
        barberId: null,
        barberName: null,
        serviceId: null,
        serviceName: null,
        servicePrice: 0,
        serviceDuration: 0,
        date: null,
        time: null
    };
    clientCalendarDate = new Date();
    updateBookingStepView();
}

function updateBookingStepView() {
    const steps = [1, 2, 3, 4];
    steps.forEach(s => {
        document.getElementById(`booking-step-${s}`).style.display = 'none';
        document.getElementById(`indicator-step-${s}`).className = 'booking-step-indicator';
    });

    document.getElementById(`booking-step-${bookingData.step}`).style.display = 'block';

    for (let s = 1; s <= 4; s++) {
        const ind = document.getElementById(`indicator-step-${s}`);
        if (s < bookingData.step) {
            ind.classList.add('completed');
            ind.innerHTML = '<i data-lucide="check" style="width:16px;height:16px;"></i>';
        } else if (s === bookingData.step) {
            ind.classList.add('active');
            ind.innerText = s;
        } else {
            ind.innerText = s;
        }
    }

    const prevBtn = document.getElementById('btn-booking-prev');
    prevBtn.style.display = bookingData.step > 1 ? 'inline-flex' : 'none';

    validateBookingNextButton();

    if (bookingData.step === 1) {
        loadBarbersGrid();
    } else if (bookingData.step === 2) {
        loadServicesSelectionList();
    } else if (bookingData.step === 3) {
        loadClientCalendarSelector();
    } else if (bookingData.step === 4) {
        loadBookingConfirmationSummary();
    }

    lucide.createIcons();
}

function validateBookingNextButton() {
    const nextBtn = document.getElementById('btn-booking-next');
    nextBtn.disabled = true;

    if (bookingData.step === 1 && bookingData.barberId) {
        nextBtn.disabled = false;
    } else if (bookingData.step === 2 && bookingData.serviceId) {
        nextBtn.disabled = false;
    } else if (bookingData.step === 3 && bookingData.date && bookingData.time) {
        nextBtn.disabled = false;
    } else if (bookingData.step === 4) {
        nextBtn.disabled = false;
        nextBtn.innerHTML = 'Confirmar Agendamento <i data-lucide="check-circle"></i>';
        return;
    }

    nextBtn.innerHTML = 'Avançar <i data-lucide="arrow-right"></i>';
}

function prevBookingStep() {
    if (bookingData.step > 1) {
        bookingData.step--;
        updateBookingStepView();
    }
}

function nextBookingStep() {
    if (bookingData.step < 4) {
        bookingData.step++;
        updateBookingStepView();
    } else {
        finalizeClientBooking();
    }
}

function loadBarbersGrid() {
    const grid = document.getElementById('booking-barbers-grid');
    grid.innerHTML = '';

    const barbers = state.users.filter(u => u.role === 'barbeiro');

    if (barbers.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1">
                <i data-lucide="users"></i>
                <p>Nenhum barbeiro cadastrado no momento.</p>
            </div>
        `;
        return;
    }

    barbers.forEach(b => {
        const card = document.createElement('div');
        card.className = `barber-selection-card ${bookingData.barberId === b.id ? 'selected' : ''}`;

        card.innerHTML = `
            <div class="avatar">${b.name.charAt(0).toUpperCase()}</div>
            <h4>${b.name}</h4>
            <p>Especialista</p>
        `;

        card.onclick = () => {
            bookingData.barberId = b.id;
            bookingData.barberName = b.name;
            loadBarbersGrid();
            validateBookingNextButton();
        };

        grid.appendChild(card);
    });
}

function loadServicesSelectionList() {
    const list = document.getElementById('booking-services-list');
    list.innerHTML = '';

    if (state.services.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i data-lucide="package-x"></i>
                <p>Nenhum serviço oferecido nesta barbearia.</p>
            </div>
        `;
        return;
    }

    state.services.forEach(s => {
        const item = document.createElement('div');
        item.className = `service-selection-item ${bookingData.serviceId === s.id ? 'selected' : ''}`;

        item.innerHTML = `
            <div class="service-icon-wrapper" style="width: 40px; height: 40px; font-size: 1.1rem;">
                <i data-lucide="${s.icon || 'scissors'}"></i>
            </div>
            <div class="service-selection-details">
                <h4>${s.name}</h4>
                <p>${s.description}</p>
            </div>
            <div style="text-align: right;">
                <div style="color: var(--gold); font-weight: 700;">R$ ${parseFloat(s.price).toFixed(2)}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem;">${s.duration} min</div>
            </div>
        `;

        item.onclick = () => {
            bookingData.serviceId = s.id;
            bookingData.serviceName = s.name;
            bookingData.servicePrice = s.price;
            bookingData.serviceDuration = s.duration;

            loadServicesSelectionList();
            validateBookingNextButton();
        };

        list.appendChild(item);
    });

    lucide.createIcons();
}

function loadClientCalendarSelector() {
    renderClientCalendarGrid();
    renderTimeSlots();
}

function renderClientCalendarGrid() {
    const grid = document.getElementById('client-calendar-days-grid');
    grid.innerHTML = '';

    const year = clientCalendarDate.getFullYear();
    const month = clientCalendarDate.getMonth();

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    document.getElementById('client-calendar-month-year').innerText = `${monthNames[month]} ${year}`;

    const dayHeaders = ["D", "S", "T", "Q", "Q", "S", "S"];
    dayHeaders.forEach(day => {
        const dh = document.createElement('div');
        dh.className = 'calendar-day-name';
        dh.innerText = day;
        grid.appendChild(dh);
    });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    for (let x = firstDayIndex; x > 0; x--) {
        const dayNum = prevLastDay - x + 1;
        const cell = document.createElement('div');
        cell.className = 'calendar-day other-month';
        cell.innerText = dayNum;
        grid.appendChild(cell);
    }

    const todayStr = getTodayDateString();

    for (let i = 1; i <= lastDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.innerText = i;

        const tempMonthStr = String(month + 1).padStart(2, '0');
        const tempDayStr = String(i).padStart(2, '0');
        const dateString = `${year}-${tempMonthStr}-${tempDayStr}`;

        const isPast = dateString < todayStr;
        if (isPast) {
            cell.style.opacity = '0.25';
            cell.style.cursor = 'not-allowed';
        } else {
            if (dateString === bookingData.date) {
                cell.classList.add('active');
            }

            cell.onclick = () => {
                bookingData.date = dateString;
                bookingData.time = null;
                renderClientCalendarGrid();
                renderTimeSlots();
                validateBookingNextButton();
            };
        }
        grid.appendChild(cell);
    }
}

function prevClientMonth() {
    clientCalendarDate.setMonth(clientCalendarDate.getMonth() - 1);
    renderClientCalendarGrid();
}

function nextClientMonth() {
    clientCalendarDate.setMonth(clientCalendarDate.getMonth() + 1);
    renderClientCalendarGrid();
}

function renderTimeSlots() {
    const slotsGrid = document.getElementById('booking-time-slots');
    slotsGrid.innerHTML = '';

    const label = document.getElementById('client-selected-date-label');

    if (!bookingData.date) {
        label.innerText = "Selecione uma data no calendário";
        return;
    }

    label.innerText = `Horários livres para ${formatLocalDate(bookingData.date)}`;

    const dayBookings = state.appointments.filter(ap =>
        ap.barberId === bookingData.barberId && ap.date === bookingData.date && ap.status !== 'cancelled'
    );

    const dayBlocked = (state.blockedSlots || []).filter(bs =>
        bs.barberId === bookingData.barberId && bs.date === bookingData.date
    );

    let availableSlotsCount = 0;
    const todayStr = getTodayDateString();

    BUSINESS_HOURS.forEach(time => {
        const slotBtn = document.createElement('button');
        slotBtn.className = `time-slot-btn ${bookingData.time === time ? 'selected' : ''}`;
        slotBtn.innerText = time;

        const isTaken = dayBookings.some(ap => ap.time === time);
        const isBlocked = dayBlocked.some(bs => bs.time === time);

        let isPastTime = false;
        if (bookingData.date === todayStr) {
            const now = new Date();
            const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            isPastTime = time <= currentHourMin;
        }

        if (isTaken || isBlocked || isPastTime) {
            slotBtn.disabled = true;
        } else {
            availableSlotsCount++;
            slotBtn.onclick = () => {
                bookingData.time = time;
                renderTimeSlots();
                validateBookingNextButton();
            };
        }
        slotsGrid.appendChild(slotBtn);
    });

    if (availableSlotsCount === 0) {
        const msg = document.createElement('div');
        msg.style.gridColumn = "1 / -1";
        msg.style.color = "var(--warning)";
        msg.style.fontSize = "0.9rem";
        msg.style.background = "var(--warning-bg)";
        msg.style.padding = "1rem";
        msg.style.borderRadius = "var(--radius-sm)";
        msg.innerHTML = `<span>Todos os horários estão reservados. Escolha outra data.</span>`;
        slotsGrid.appendChild(msg);
    }
}

function loadBookingConfirmationSummary() {
    document.getElementById('confirm-barber-name').innerText = bookingData.barberName;
    document.getElementById('confirm-service-name').innerText = bookingData.serviceName;
    document.getElementById('confirm-service-duration').innerText = `${bookingData.serviceDuration} minutos`;
    document.getElementById('confirm-datetime').innerText = `${formatLocalDate(bookingData.date)} às ${bookingData.time}`;
    document.getElementById('confirm-service-price').innerText = `R$ ${parseFloat(bookingData.servicePrice).toFixed(2)}`;
}

// --- INTEGRAÇÃO COM SUPABASE AO FINALIZAR ---
async function finalizeClientBooking() {
    const newApt = {
        id: 'ap-' + Date.now(),
        customerId: state.currentUser.id,
        customerName: state.currentUser.name,
        customerPhone: state.currentUser.phone,
        customerEmail: state.currentUser.email,
        barberId: bookingData.barberId,
        barberName: bookingData.barberName,
        serviceId: bookingData.serviceId,
        serviceName: bookingData.serviceName,
        servicePrice: bookingData.servicePrice,
        serviceDuration: bookingData.serviceDuration,
        date: bookingData.date,
        time: bookingData.time,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    // Salva na estrutura local
    state.appointments.push(newApt);
    saveStateToStorage();

    // Salva na nuvem (Supabase)
    const { error } = await supabaseClient
        .from('Agendamentos')
        .insert([{
            name: newApt.customerName,
            data: newApt.date,
            servico: newApt.serviceName
        }]);

    if (error) {
        console.error("Erro ao sincronizar com o Supabase:", error.message);
    } else {
        console.log("Sincronizado com o banco na nuvem!");
    }

    showToast("Agendamento solicitado com sucesso!", "success");
    navigateTo('subview-client-appointments');

    sendWhatsAppNotification(newApt);
}

// --- FUNÇÃO PARA BUSCAR AGENDAMENTOS NA NUVEM ---
async function carregarAgendamentosDaNuvem() {
    const { data, error } = await supabaseClient
        .from('Agendamentos')
        .select('*');

    if (error) {
        console.error("Erro ao buscar dados do Supabase:", error.message);
    } else if (data && data.length > 0) {
        const agendamentosNuvem = data.map(item => ({
            id: item.id || 'ap-nuvem-' + Math.random(),
            customerName: item.name,
            date: item.data,
            serviceName: item.servico,
            barberName: "Profissional",
            servicePrice: 50.00,
            serviceDuration: 45,
            status: 'confirmed'
        }));

        state.appointments = agendamentosNuvem;

        if (state.currentUser) {
            if (state.currentUser.role === 'barbeiro') {
                updateBarberDashboard();
            } else {
                updateClientAppointmentsList();
            }
        }
        console.log("Agendamentos sincronizados vindos da nuvem.");
    }
}

// --- NOTIFICAÇÃO WHATSAPP ---
async function sendWhatsAppNotification(apt) {
    if (WHATSAPP_CONFIG.accessToken === "SEU_META_ACCESS_TOKEN" || WHATSAPP_CONFIG.phoneNumberId === "SEU_PHONE_NUMBER_ID") {
        const messageText = `Olá! Gostaria de confirmar um agendamento:\n\n` +
            `👤 *Cliente:* ${apt.customerName}\n` +
            `✂️ *Serviço:* ${apt.serviceName}\n` +
            `📅 *Data/Hora:* ${formatLocalDate(apt.date)} às ${apt.time}`;

        const whatsappUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_CONFIG.recipientPhone}&text=${encodeURIComponent(messageText)}`;

        setTimeout(() => {
            window.open(whatsappUrl, '_blank');
        }, 1500);
        return;
    }

    const url = `https://graph.facebook.com/v20.0/${WHATSAPP_CONFIG.phoneNumberId}/messages`;
    let body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: WHATSAPP_CONFIG.recipientPhone,
        type: "text",
        text: { preview_url: false, body: `Novo agendamento criado para ${apt.customerName}` }
    };

    try {
        await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_CONFIG.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    } catch (error) {
        console.error("Erro WhatsApp API:", error);
    }
}