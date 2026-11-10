// JobPortal Frontend Application (Vanilla JS)
let csrfToken = null;
let currentUser = null;

// Safe DOM builder - prevents XSS by using textContent and text nodes only
function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
        if (key.startsWith('on') && typeof val === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (key === 'className' || key === 'class') {
            node.className = val;
        } else if (key === 'textContent') {
            node.textContent = val;
        } else if (val !== false && val !== null && val !== undefined) {
            node.setAttribute(key, val);
        }
    }
    for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        if (typeof child === 'string' || typeof child === 'number') {
            node.appendChild(document.createTextNode(String(child)));
        } else if (child instanceof Node) {
            node.appendChild(child);
        }
    }
    return node;
}

function clearEl(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
}

function showFlash(msg, isError = false, targetId = 'flash-message') {
    const container = document.getElementById(targetId);
    if (!container) return;
    clearEl(container);
    if (!msg) return;
    container.appendChild(el('div', { class: `alert ${isError ? 'alert-error' : 'alert-success'}`, textContent: msg }));
}

async function fetchCsrf() {
    try {
        const res = await fetch('api/auth.php?action=csrf', { credentials: 'same-origin' });
        const data = await res.json();
        csrfToken = data.csrf_token;
    } catch (e) {
        console.error('Failed to get CSRF token', e);
    }
}

async function api(url, options = {}) {
    const opts = { ...options };
    opts.credentials = 'same-origin';
    const method = (opts.method || 'GET').toUpperCase();
    opts.headers = { ...(opts.headers || {}) };

    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        if (!csrfToken) await fetchCsrf();
        if (csrfToken) opts.headers['X-CSRF-Token'] = csrfToken;
    }

    if (opts.body && !(opts.body instanceof FormData) && typeof opts.body === 'object') {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(opts.body);
    }

    const res = await fetch(url, opts);
    let data;
    try {
        data = await res.json();
    } catch (err) {
        throw new Error('Server returned an unexpected response');
    }

    if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
}

function renderNav() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;
    clearEl(nav);

    const wrap = el('div', { class: 'nav-wrap' });
    wrap.appendChild(el('a', { class: 'brand', href: 'index.html', textContent: 'JobPortal' }));

    const links = el('div', { class: 'nav-links' });
    links.appendChild(el('a', { href: 'index.html', textContent: 'Browse Jobs' }));

    if (!currentUser) {
        links.appendChild(el('a', { href: 'login.html', textContent: 'Login' }));
        links.appendChild(el('a', { href: 'register.html', textContent: 'Register' }));
    } else {
        if (currentUser.role === 'seeker') {
            links.appendChild(el('a', { href: 'my-applications.html', textContent: 'My Applications' }));
        } else if (currentUser.role === 'employer') {
            links.appendChild(el('a', { href: 'post-job.html', textContent: 'Post Job' }));
            links.appendChild(el('a', { href: 'applicants.html', textContent: 'Applicants' }));
        } else if (currentUser.role === 'admin') {
            links.appendChild(el('a', { href: 'admin.html', textContent: 'Admin Console' }));
        }

        links.appendChild(el('span', { class: 'user-tag', textContent: `${currentUser.name} (${currentUser.role})` }));
        links.appendChild(el('button', {
            class: 'btn btn-outline btn-sm',
            textContent: 'Logout',
            onclick: async () => {
                try {
                    await api('api/auth.php?action=logout', { method: 'POST' });
                    window.location.href = 'login.html';
                } catch (e) {
                    alert('Logout error: ' + e.message);
                }
            }
        }));
    }

    wrap.appendChild(links);
    nav.appendChild(wrap);
}

// Page Handlers
async function initIndexPage() {
    const form = document.getElementById('search-form');
    const jobsList = document.getElementById('jobs-list');
    const pagination = document.getElementById('pagination');
    let currentPage = 1;

    async function loadJobs(page = 1) {
        currentPage = page;
        clearEl(jobsList);
        jobsList.appendChild(el('p', { textContent: 'Loading jobs...' }));

        const kw = document.getElementById('search-keyword')?.value.trim() || '';
        const loc = document.getElementById('search-location')?.value.trim() || '';
        const type = document.getElementById('search-type')?.value.trim() || '';

        const params = new URLSearchParams({ action: 'list', page: String(page), limit: '5' });
        if (kw) params.append('keyword', kw);
        if (loc) params.append('location', loc);
        if (type) params.append('type', type);

        try {
            const data = await api(`api/jobs.php?${params.toString()}`);
            clearEl(jobsList);

            if (data.jobs.length === 0) {
                jobsList.appendChild(el('div', { class: 'card' }, el('p', { textContent: 'No jobs found matching your criteria.' })));
                clearEl(pagination);
                return;
            }

            for (const job of data.jobs) {
                const card = el('div', { class: 'card' });
                const header = el('div', { class: 'job-header' },
                    el('div', {},
                        el('h3', { textContent: job.title }),
                        el('div', { class: 'meta-row' },
                            el('span', { textContent: job.company }),
                            el('span', { textContent: `• ${job.location}` }),
                            el('span', { class: 'badge badge-type', textContent: job.type }),
                            el('span', { textContent: `• ${job.salary_range}` })
                        )
                    ),
                    el('a', { class: 'btn btn-sm', href: `job.html?id=${job.id}`, textContent: 'View Job' })
                );

                const snippet = job.description.length > 160 ? job.description.slice(0, 160) + '...' : job.description;
                card.appendChild(header);
                card.appendChild(el('p', { textContent: snippet }));
                jobsList.appendChild(card);
            }

            // Pagination
            clearEl(pagination);
            if (data.pages > 1) {
                if (data.page > 1) {
                    pagination.appendChild(el('button', {
                        class: 'btn btn-outline btn-sm',
                        textContent: 'Previous',
                        onclick: () => loadJobs(data.page - 1)
                    }));
                }
                pagination.appendChild(el('span', { textContent: `Page ${data.page} of ${data.pages}` }));
                if (data.page < data.pages) {
                    pagination.appendChild(el('button', {
                        class: 'btn btn-outline btn-sm',
                        textContent: 'Next',
                        onclick: () => loadJobs(data.page + 1)
                    }));
                }
            }
        } catch (e) {
            clearEl(jobsList);
            showFlash(e.message, true);
        }
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            loadJobs(1);
        });
        document.getElementById('search-reset')?.addEventListener('click', () => {
            form.reset();
            loadJobs(1);
        });
    }

    loadJobs(1);
}

async function initLoginPage() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showFlash('');
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            const data = await api('api/auth.php?action=login', {
                method: 'POST',
                body: { email, password }
            });
            currentUser = data.user;
            if (currentUser.role === 'employer') {
                window.location.href = 'post-job.html';
            } else if (currentUser.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'index.html';
            }
        } catch (err) {
            showFlash(err.message, true);
        }
    });

    // Quick demo login helpers
    document.querySelectorAll('.demo-login-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('login-email').value = btn.dataset.email;
            document.getElementById('login-password').value = btn.dataset.password;
            form.requestSubmit();
        });
    });
}

async function initRegisterPage() {
    const form = document.getElementById('register-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showFlash('');
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const role = document.getElementById('reg-role').value;

        try {
            const data = await api('api/auth.php?action=register', {
                method: 'POST',
                body: { name, email, password, role }
            });
            currentUser = data.user;
            window.location.href = 'index.html';
        } catch (err) {
            showFlash(err.message, true);
        }
    });
}

async function initJobDetailPage() {
    const container = document.getElementById('job-detail-container');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('id');
    if (!jobId) {
        showFlash('Job ID is missing', true);
        return;
    }

    try {
        const data = await api(`api/jobs.php?action=detail&id=${jobId}`);
        const job = data.job;
        const app = data.application;

        clearEl(container);

        const card = el('div', { class: 'card' });
        const header = el('div', { class: 'job-header' },
            el('div', {},
                el('h1', { textContent: job.title }),
                el('div', { class: 'meta-row' },
                    el('strong', { textContent: job.company }),
                    el('span', { textContent: `• ${job.location}` }),
                    el('span', { class: 'badge badge-type', textContent: job.type }),
                    el('span', { textContent: `• Salary: ${job.salary_range}` }),
                    el('span', { textContent: `• Posted: ${new Date(job.created_at).toLocaleDateString()}` })
                )
            )
        );

        // Employer Actions
        if (currentUser && currentUser.role === 'employer' && currentUser.id === job.employer_id) {
            const actions = el('div', { style: 'display:flex; gap:0.5rem; margin-bottom:1rem;' },
                el('a', { class: 'btn btn-outline btn-sm', href: `post-job.html?id=${job.id}`, textContent: 'Edit Job' }),
                el('a', { class: 'btn btn-outline btn-sm', href: `applicants.html?job_id=${job.id}`, textContent: 'View Applicants' }),
                el('button', {
                    class: 'btn btn-danger btn-sm',
                    textContent: 'Delete Job',
                    onclick: async () => {
                        if (!confirm('Are you sure you want to delete this job posting?')) return;
                        try {
                            await api('api/jobs.php?action=delete', {
                                method: 'POST',
                                body: { id: job.id }
                            });
                            window.location.href = 'index.html';
                        } catch (e) {
                            alert(e.message);
                        }
                    }
                })
            );
            card.appendChild(actions);
        }

        card.appendChild(header);
        card.appendChild(el('h3', { textContent: 'Job Description', style: 'margin: 1rem 0 0.5rem;' }));
        card.appendChild(el('p', { textContent: job.description, style: 'white-space: pre-wrap; line-height: 1.6;' }));
        container.appendChild(card);

        // Application section
        const appSection = el('div', { class: 'card' });
        if (app) {
            appSection.appendChild(el('div', { class: 'alert alert-info' },
                el('strong', { textContent: 'Application Status: ' }),
                el('span', { class: `badge badge-${app.status}`, textContent: app.status }),
                el('p', { textContent: `You applied for this position on ${new Date(app.created_at).toLocaleDateString()}.`, style: 'margin-top:0.5rem;' })
            ));
            container.appendChild(appSection);
        } else if (currentUser && currentUser.role === 'seeker') {
            appSection.appendChild(el('h3', { textContent: 'Apply for this position' }));
            const form = el('form', { id: 'apply-form', style: 'margin-top: 1rem;' });
            const flash = el('div', { id: 'apply-flash' });
            form.appendChild(flash);

            form.appendChild(el('div', { class: 'form-group' },
                el('label', { textContent: 'Cover Note *' }),
                el('textarea', { id: 'apply-note', required: true, placeholder: 'Tell the employer why you are a great fit...' })
            ));

            form.appendChild(el('div', { class: 'form-group' },
                el('label', { textContent: 'Resume (PDF only, max 2MB)' }),
                el('input', { type: 'file', id: 'apply-resume', accept: '.pdf,application/pdf' })
            ));

            const submitBtn = el('button', { type: 'submit', class: 'btn', textContent: 'Submit Application' });
            form.appendChild(submitBtn);

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                clearEl(flash);
                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting...';

                const fd = new FormData();
                fd.append('job_id', job.id);
                fd.append('cover_note', document.getElementById('apply-note').value.trim());

                const fileInput = document.getElementById('apply-resume');
                if (fileInput.files.length > 0) {
                    fd.append('resume', fileInput.files[0]);
                }

                try {
                    await api('api/apply.php', { method: 'POST', body: fd });
                    initJobDetailPage();
                } catch (err) {
                    flash.appendChild(el('div', { class: 'alert alert-error', textContent: err.message }));
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Application';
                }
            });

            appSection.appendChild(form);
            container.appendChild(appSection);
        } else if (!currentUser) {
            appSection.appendChild(el('p', { textContent: 'Log in as a job seeker to submit an application.' }));
            appSection.appendChild(el('a', { class: 'btn btn-sm', href: 'login.html', textContent: 'Log In', style: 'margin-top: 0.5rem;' }));
            container.appendChild(appSection);
        }
    } catch (e) {
        showFlash(e.message, true);
    }
}

async function initPostJobPage() {
    if (!currentUser || currentUser.role !== 'employer') {
        window.location.href = 'login.html';
        return;
    }

    const form = document.getElementById('post-job-form');
    const titleEl = document.getElementById('page-title');
    const submitBtn = document.getElementById('post-submit-btn');
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('id');

    if (jobId) {
        if (titleEl) titleEl.textContent = 'Edit Job Posting';
        if (submitBtn) submitBtn.textContent = 'Save Changes';
        try {
            const data = await api(`api/jobs.php?action=detail&id=${jobId}`);
            const job = data.job;
            document.getElementById('job-title').value = job.title;
            document.getElementById('job-company').value = job.company;
            document.getElementById('job-location').value = job.location;
            document.getElementById('job-type').value = job.type;
            document.getElementById('job-salary').value = job.salary_range;
            document.getElementById('job-desc').value = job.description;
        } catch (e) {
            showFlash(e.message, true);
        }
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            showFlash('');

            const payload = {
                title: document.getElementById('job-title').value.trim(),
                company: document.getElementById('job-company').value.trim(),
                location: document.getElementById('job-location').value.trim(),
                type: document.getElementById('job-type').value.trim(),
                salary_range: document.getElementById('job-salary').value.trim(),
                description: document.getElementById('job-desc').value.trim(),
            };

            try {
                if (jobId) {
                    payload.id = jobId;
                    await api('api/jobs.php?action=update', { method: 'POST', body: payload });
                    showFlash('Job updated successfully!');
                    setTimeout(() => window.location.href = `job.html?id=${jobId}`, 600);
                } else {
                    const res = await api('api/jobs.php?action=create', { method: 'POST', body: payload });
                    showFlash('Job posted successfully!');
                    setTimeout(() => window.location.href = `job.html?id=${res.job_id}`, 600);
                }
            } catch (err) {
                showFlash(err.message, true);
            }
        });
    }
}

async function initMyApplicationsPage() {
    if (!currentUser || currentUser.role !== 'seeker') {
        window.location.href = 'login.html';
        return;
    }

    const container = document.getElementById('my-apps-list');
    if (!container) return;

    try {
        const data = await api('api/applications.php?action=my');
        clearEl(container);

        if (data.applications.length === 0) {
            container.appendChild(el('div', { class: 'card' },
                el('p', { textContent: 'You have not submitted any applications yet.' }),
                el('a', { class: 'btn btn-sm', href: 'index.html', textContent: 'Browse Available Jobs', style: 'margin-top: 0.5rem;' })
            ));
            return;
        }

        const tableWrap = el('div', { class: 'table-responsive card' });
        const table = el('table', {});
        const thead = el('thead', {},
            el('tr', {},
                el('th', { textContent: 'Job Title' }),
                el('th', { textContent: 'Company' }),
                el('th', { textContent: 'Applied Date' }),
                el('th', { textContent: 'Status' }),
                el('th', { textContent: 'Resume' }),
                el('th', { textContent: 'Cover Note' })
            )
        );
        const tbody = el('tbody', {});

        for (const app of data.applications) {
            const tr = el('tr', {},
                el('td', {}, el('a', { href: `job.html?id=${app.job_id}`, textContent: app.title })),
                el('td', { textContent: app.company }),
                el('td', { textContent: new Date(app.created_at).toLocaleDateString() }),
                el('td', {}, el('span', { class: `badge badge-${app.status}`, textContent: app.status })),
                el('td', {}, app.resume_path ?
                    el('a', { href: `api/resume.php?application_id=${app.id}`, target: '_blank', class: 'btn btn-outline btn-sm', textContent: 'View PDF' }) :
                    el('span', { textContent: 'None' })
                ),
                el('td', { textContent: app.cover_note })
            );
            tbody.appendChild(tr);
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        tableWrap.appendChild(table);
        container.appendChild(tableWrap);
    } catch (e) {
        showFlash(e.message, true);
    }
}

async function initApplicantsPage() {
    if (!currentUser || currentUser.role !== 'employer') {
        window.location.href = 'login.html';
        return;
    }

    const container = document.getElementById('applicants-list');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('job_id') || '';

    try {
        const query = jobId ? `action=job_applicants&job_id=${jobId}` : 'action=job_applicants';
        const data = await api(`api/applications.php?${query}`);
        clearEl(container);

        if (data.applicants.length === 0) {
            container.appendChild(el('div', { class: 'card' }, el('p', { textContent: 'No applicants found.' })));
            return;
        }

        const tableWrap = el('div', { class: 'table-responsive card' });
        const table = el('table', {});
        const thead = el('thead', {},
            el('tr', {},
                el('th', { textContent: 'Applicant' }),
                el('th', { textContent: 'Email' }),
                el('th', { textContent: 'Job' }),
                el('th', { textContent: 'Date' }),
                el('th', { textContent: 'Resume' }),
                el('th', { textContent: 'Cover Note' }),
                el('th', { textContent: 'Status / Action' })
            )
        );
        const tbody = el('tbody', {});

        for (const app of data.applicants) {
            const select = el('select', { style: 'width: auto; padding: 0.25rem 0.5rem; font-size: 0.85rem;' },
                el('option', { value: 'pending', textContent: 'Pending' }),
                el('option', { value: 'shortlisted', textContent: 'Shortlisted' }),
                el('option', { value: 'rejected', textContent: 'Rejected' })
            );
            select.value = app.status;

            const updateBtn = el('button', {
                class: 'btn btn-outline btn-sm',
                textContent: 'Save',
                style: 'margin-left: 0.35rem;',
                onclick: async () => {
                    try {
                        await api('api/applications.php?action=set_status', {
                            method: 'POST',
                            body: { application_id: app.id, status: select.value }
                        });
                        showFlash('Applicant status updated!');
                    } catch (err) {
                        alert(err.message);
                    }
                }
            });

            const actionCell = el('td', {}, select, updateBtn);

            const tr = el('tr', {},
                el('td', { textContent: app.seeker_name }),
                el('td', { textContent: app.seeker_email }),
                el('td', { textContent: app.job_title }),
                el('td', { textContent: new Date(app.created_at).toLocaleDateString() }),
                el('td', {}, app.resume_path ?
                    el('a', { href: `api/resume.php?application_id=${app.id}`, target: '_blank', class: 'btn btn-outline btn-sm', textContent: 'PDF' }) :
                    el('span', { textContent: 'None' })
                ),
                el('td', { textContent: app.cover_note }),
                actionCell
            );
            tbody.appendChild(tr);
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        tableWrap.appendChild(table);
        container.appendChild(tableWrap);
    } catch (e) {
        showFlash(e.message, true);
    }
}

async function initAdminPage() {
    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    const usersContainer = document.getElementById('admin-users-list');
    const jobsContainer = document.getElementById('admin-jobs-list');

    async function loadAdminData() {
        try {
            const [usersData, jobsData] = await Promise.all([
                api('api/admin.php?action=users'),
                api('api/admin.php?action=jobs')
            ]);

            // Render Users
            if (usersContainer) {
                clearEl(usersContainer);
                const tableWrap = el('div', { class: 'table-responsive' });
                const table = el('table', {});
                table.appendChild(el('thead', {},
                    el('tr', {},
                        el('th', { textContent: 'ID' }),
                        el('th', { textContent: 'Name' }),
                        el('th', { textContent: 'Email' }),
                        el('th', { textContent: 'Role' }),
                        el('th', { textContent: 'Joined' })
                    )
                ));
                const tbody = el('tbody', {});
                for (const u of usersData.users) {
                    tbody.appendChild(el('tr', {},
                        el('td', { textContent: u.id }),
                        el('td', { textContent: u.name }),
                        el('td', { textContent: u.email }),
                        el('td', {}, el('span', { class: 'badge', textContent: u.role })),
                        el('td', { textContent: new Date(u.created_at).toLocaleDateString() })
                    ));
                }
                table.appendChild(tbody);
                tableWrap.appendChild(table);
                usersContainer.appendChild(tableWrap);
            }

            // Render Jobs
            if (jobsContainer) {
                clearEl(jobsContainer);
                const tableWrap = el('div', { class: 'table-responsive' });
                const table = el('table', {});
                table.appendChild(el('thead', {},
                    el('tr', {},
                        el('th', { textContent: 'ID' }),
                        el('th', { textContent: 'Title' }),
                        el('th', { textContent: 'Company' }),
                        el('th', { textContent: 'Location' }),
                        el('th', { textContent: 'Employer' }),
                        el('th', { textContent: 'Applicants' }),
                        el('th', { textContent: 'Action' })
                    )
                ));
                const tbody = el('tbody', {});
                for (const j of jobsData.jobs) {
                    const delBtn = el('button', {
                        class: 'btn btn-danger btn-sm',
                        textContent: 'Delete',
                        onclick: async () => {
                            if (!confirm(`Delete job "${j.title}"?`)) return;
                            try {
                                await api('api/admin.php?action=delete_job', {
                                    method: 'POST',
                                    body: { id: j.id }
                                });
                                loadAdminData();
                            } catch (e) {
                                alert(e.message);
                            }
                        }
                    });

                    tbody.appendChild(el('tr', {},
                        el('td', { textContent: j.id }),
                        el('td', {}, el('a', { href: `job.html?id=${j.id}`, textContent: j.title })),
                        el('td', { textContent: j.company }),
                        el('td', { textContent: j.location }),
                        el('td', { textContent: `${j.employer_name} (${j.employer_email})` }),
                        el('td', { textContent: j.applicant_count }),
                        el('td', {}, delBtn)
                    ));
                }
                table.appendChild(tbody);
                tableWrap.appendChild(table);
                jobsContainer.appendChild(tableWrap);
            }
        } catch (e) {
            showFlash(e.message, true);
        }
    }

    loadAdminData();
}

// App Bootstrapper
document.addEventListener('DOMContentLoaded', async () => {
    await fetchCsrf();
    try {
        const me = await api('api/auth.php?action=me');
        currentUser = me.user;
    } catch (e) {
        currentUser = null;
    }
    renderNav();

    const page = document.body.dataset.page;
    if (page === 'index') initIndexPage();
    else if (page === 'login') initLoginPage();
    else if (page === 'register') initRegisterPage();
    else if (page === 'job') initJobDetailPage();
    else if (page === 'post-job') initPostJobPage();
    else if (page === 'my-applications') initMyApplicationsPage();
    else if (page === 'applicants') initApplicantsPage();
    else if (page === 'admin') initAdminPage();
});
