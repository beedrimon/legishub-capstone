/**
 Upload, View, Edit, and Notifications
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Elements
    const bell = document.getElementById('notifBell');
    const notifDropdown = document.getElementById('notificationDropdown');

    // Select all potential modals
    const modals = {
        upload: document.getElementById('uploadModal'),
        view: document.getElementById('viewModal'),
<<<<<<< Updated upstream
        edit: document.getElementById('editModal')
=======
        edit: document.getElementById('editModal'),
        user: document.getElementById('userModal'),
        editUser: document.getElementById('editUserModal'),
        allNotifs: document.getElementById('allNotificationsModal') // <--- ADD THIS LINE
>>>>>>> Stashed changes
    };

    // 2. Helper to close all UI overlays
    const closeAllOverlays = () => {
        Object.values(modals).forEach(m => { if (m) m.style.display = 'none'; });
        if (notifDropdown) notifDropdown.style.display = 'none';
    };

    // 3. Generic Modal Trigger Logic
    // This looks for specific classes and opens the matching modal ID
    const setupTrigger = (selector, modalKey) => {
        const buttons = document.querySelectorAll(selector);
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeAllOverlays();
                if (modals[modalKey]) modals[modalKey].style.display = 'flex';
            });
        });
    };

    setupTrigger('.trigger-modal', 'upload');
    setupTrigger('.trigger-view', 'view');
    setupTrigger('.trigger-edit', 'edit');
<<<<<<< Updated upstream
=======
    setupTrigger('.trigger-user', 'user');
    setupTrigger('.trigger-edit-user', 'editUser');
    setupTrigger('.trigger-all-notifs', 'allNotifs'); // <--- ADD THIS
>>>>>>> Stashed changes

    // 4. Close Buttons Logic
    // Handles any button with class 'close-modal' or 'btn-discard' inside any modal
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-modal') ||
            e.target.classList.contains('btn-discard') ||
            e.target.id === 'discardBtn' ||
            e.target.id === 'closeModal') {
            closeAllOverlays();
        }
    });

<<<<<<< Updated upstream
    // 5. Notification Logic
=======
    // ==========================================
    // STANDARD NOTIFICATION BELL LOGIC
    // ==========================================
>>>>>>> Stashed changes
    if (bell && notifDropdown) {
        bell.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isShowing = notifDropdown.style.display === 'block';
            closeAllOverlays();
            notifDropdown.style.display = isShowing ? 'none' : 'block';
<<<<<<< Updated upstream
=======

            const badge = document.querySelector('.notif-badge');
            if (badge) badge.style.display = 'none';
        });
    }

    // Global Click Listener (Close when clicking outside)
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal-overlay')) {
            closeAllOverlays();
        }
        if (uploadDropdownWrapper && !uploadDropdownWrapper.contains(event.target)) {
            uploadDropdownWrapper.classList.remove('show');
        }
        if (bell && !bell.contains(event.target) && notifDropdown && !notifDropdown.contains(event.target)) {
            notifDropdown.style.display = 'none';
        }
    });

    // --- UPGRADED: AJAX FETCH LOGIC (BOTH DROPDOWNS) ---
    function fetchNotifications() {
        fetch('/api/notifications/')
            .then(response => response.json())
            .then(data => {
                // Find BOTH containers
                const miniBody = document.querySelector('#notificationDropdown .notif-body');
                const expandedBody = document.getElementById('notifModalBody');
                const notifBadge = document.querySelector('.notif-badge');

                if (data.notifications) {
                    let miniHtml = '';
                    let expandedHtml = '';

                    if (data.notifications.length > 0) {
                        // Add the section title for the expanded view
                        expandedHtml += `<div class="notif-section-title" style="padding: 15px 20px 5px; font-weight: bold; font-size: 0.9rem; color: #333;">Recent Activity</div>`;

                        data.notifications.forEach((notif, index) => {

                            // ==========================================
                            // 1. BUILD THE MINI DROPDOWN HTML
                            // ==========================================
                            let borderClass = (index === data.notifications.length - 1) ? 'border-none' : '';
                            miniHtml += `
                                <div class="notif-item ${borderClass}">
                                    <div class="notif-content">
                                        <p>${notif.message}</p>
                                        <span class="notif-time">${notif.time}</span>
                                    </div>
                                </div>
                            `;

                            // ==========================================
                            // 2. BUILD THE EXPANDED FIGMA HTML (CLEANED)
                            // ==========================================
                            let iconClass = 'fa-desktop';
                            if (notif.message.includes('Upload')) iconClass = 'fa-file-invoice';
                            else if (notif.message.includes('Updated') || notif.message.includes('modified')) iconClass = 'fa-file-signature';

                            expandedHtml += `
                            <div class="notif-list-item unread">
                                <div class="notif-icon">
                                    <i class="fa-solid ${iconClass}"></i>
                                    <span class="red-dot"></span>
                                </div>
                                <div style="flex: 1;">
                                    <p>${notif.message}</p>
                                    <span class="notif-time">${notif.time}</span>
                                </div>
                                <div class="unread-dot"></div>
                            </div>`;
                        });

                        if (notifBadge && notifBadge.style.display !== 'none') {
                            notifBadge.style.display = 'block';
                        }
                    } else {
                        miniHtml = `
                            <div class="notif-item border-none">
                                <div class="notif-content" style="text-align: center; padding: 15px;">
                                    <p style="color: #888;">No recent activities found.</p>
                                </div>
                            </div>`;
                    }

                    // Empty state using clean CSS classes
                    expandedHtml += `
                    <div id="emptyNotifState" class="empty-notif-state" style="display: ${data.notifications.length === 0 ? 'block' : 'none'};">
                        <i class="fa-solid fa-bell-slash"></i>
                        <p>You have no notifications.</p>
                    </div>`;

                    // Inject the live HTML into BOTH boxes!
                    if (miniBody) miniBody.innerHTML = miniHtml;
                    if (expandedBody) expandedBody.innerHTML = expandedHtml;

                    // Automatically apply the active tab filters (All/Unread) to the newly loaded data
                    const activeTab = document.querySelector('.notif-tab.active');
                    if (activeTab) activeTab.click();
                }
            })
            .catch(error => console.error('Error fetching notifications:', error));
    }

    // Fetch immediately, then check again every 30 seconds
    fetchNotifications();
    setInterval(fetchNotifications, 30000);

    // 5.5 Upload Dropdown Logic
    if (uploadDropdownBtn && uploadDropdownWrapper) {
        uploadDropdownBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadDropdownWrapper.classList.toggle('show');
>>>>>>> Stashed changes
        });
    }

    // 6. Global Click Listener (Close when clicking outside)
    window.addEventListener('click', (event) => {
        // Close modal if clicking the background overlay
        if (event.target.classList.contains('modal-overlay')) {
            closeAllOverlays();
        }

        // Close notification if clicking outside
        if (notifDropdown &&
            !notifDropdown.contains(event.target) &&
            event.target !== bell) {
            notifDropdown.style.display = 'none';
        }
    });

    // Add to modals.js
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', function () {
            const uploadText = this.parentElement.querySelector('p');
            if (this.files && this.files.length > 0) {
                // Change the text to the name of the file!
                uploadText.innerText = 'File selected: ' + this.files[0].name;
                uploadText.style.color = '#22C55E'; // Make it green
            }
        });
    }

    // ==========================================
    // POPULATE DETAILED VIEW MODAL
    // ==========================================
    const viewButtons = document.querySelectorAll('.trigger-view');

    viewButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            // 1. Read the data from the icon we clicked
            const docNumber = this.getAttribute('data-number');
            const docTitle = this.getAttribute('data-title');
            const docType = this.getAttribute('data-type');
            const docYear = this.getAttribute('data-year');
            const docDate = this.getAttribute('data-date');
            const docSponsor = this.getAttribute('data-sponsor');
            const docKeywords = this.getAttribute('data-keywords');
            const fileUrl = this.getAttribute('data-file');

            // 2. Inject the data into the modal's HTML
            document.getElementById('view-number').innerText = docNumber;
            document.getElementById('view-title').innerHTML = `<strong>${docTitle}</strong>`;
            document.getElementById('view-type').innerText = docType;
            document.getElementById('view-year').innerText = docYear;
            document.getElementById('view-date').innerText = docDate;
            document.getElementById('view-sponsor').innerText = docSponsor;
            document.getElementById('view-keywords').innerText = docKeywords;

            // 3. Update the Download Button
            const downloadBtn = document.getElementById('view-download-btn');
            if (fileUrl) {
                downloadBtn.style.display = 'inline-block';
                // If they click it, open the PDF in a new tab!
                downloadBtn.onclick = function () { window.open(fileUrl, '_blank'); };
            } else {
                // Hide the button if there is no PDF uploaded
                downloadBtn.style.display = 'none';
            }

            // ==========================================
            // 4. Update the PDF Preview Iframe
            // ==========================================
            const pdfIframe = document.getElementById('view-pdf-iframe');
            const pdfMissing = document.getElementById('view-pdf-missing');

            if (fileUrl) {
                // If there is a file, set the iframe source to the file URL and show it
                pdfIframe.src = fileUrl;
                pdfIframe.style.display = 'block';
                pdfMissing.style.display = 'none';
            } else {
                // If there is no file, hide the iframe and show the "missing" message
                pdfIframe.src = '';
                pdfIframe.style.display = 'none';
                pdfMissing.style.display = 'block';
            }
        });
    });

    // ==========================================
    // POPULATE EDIT MODAL
    // ==========================================
    const editButtons = document.querySelectorAll('.trigger-edit');

    editButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            // 1. Read data from the pencil icon
            const docId = this.getAttribute('data-id');
            const docNumber = this.getAttribute('data-number');
            const docTitle = this.getAttribute('data-title');
            const docType = this.getAttribute('data-type');
            const docYear = this.getAttribute('data-year');
            const docDate = this.getAttribute('data-date');
            const docSponsor = this.getAttribute('data-sponsor');
            const docCoSponsors = this.getAttribute('data-cosponsors');
            const docKeywords = this.getAttribute('data-keywords');
            const docStatus = this.getAttribute('data-status');
            const docVisibility = this.getAttribute('data-visibility');
            const docStorage = this.getAttribute('data-storage');
            const fileName = this.getAttribute('data-file');

            // 2. Inject data into the Edit form inputs
            document.getElementById('edit-doc-id').value = docId;
            document.getElementById('edit-number').value = docNumber;
            document.getElementById('edit-title').value = docTitle;
            document.getElementById('edit-type').value = docType;
            document.getElementById('edit-year').value = docYear;
            document.getElementById('edit-date').value = docDate;
            document.getElementById('edit-sponsor').value = docSponsor || '';
            document.getElementById('edit-co-sponsors').value = docCoSponsors || '';
            document.getElementById('edit-keywords').value = docKeywords || '';
            document.getElementById('edit-status').value = docStatus || 'Pending';
            document.getElementById('edit-visibility').value = docVisibility || 'Public Access';
            document.getElementById('edit-physical-storage').value = docStorage || '';

            // 3. Update the File Text UI
            const fileText = document.getElementById('edit-file-text');
            if (fileName) {
                // Extract just the filename from the folder path
                const cleanName = fileName.split('/').pop();
                fileText.innerHTML = `Current File: <strong>${cleanName}</strong>`;
            } else {
                fileText.innerHTML = `Current File: <strong style="color: #888;">No file attached</strong>`;
            }
        });
    });

    // 4. Change UI text when a new file is selected during edit
    const editFileInput = document.getElementById('editFileInput');
    if (editFileInput) {
        editFileInput.addEventListener('change', function () {
            const uploadText = document.getElementById('edit-file-text');
            if (this.files && this.files.length > 0) {
                uploadText.innerHTML = `New file selected: <strong style="color: #22C55E;">${this.files[0].name}</strong>`;
            }
        });
    }

    // ==========================================
    // 5. PASSWORD VISIBILITY TOGGLE
    // ==========================================
    const togglePassword = document.querySelector('#togglePassword');
    // Renamed to passwordInput to avoid conflicts with other variables
    const passwordInput = document.querySelector('#password');

    // Safety check: Only run this code if we are actually on the Login page!
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
            this.classList.toggle('fa-eye');
        });
    }

    // ==========================================
    // SEE ALL NOTIFICATIONS MODAL LOGIC
    // ==========================================
    const notifTabs = document.querySelectorAll('.notif-tab');
    const emptyState = document.getElementById('emptyNotifState');
    const sectionTitles = document.querySelectorAll('.notif-section-title');

    // 1. Tab Switching (All vs Unread)
    notifTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            notifTabs.forEach(t => {
                t.classList.remove('active');
                t.style.background = 'transparent';
                t.style.color = '#888';
            });
            this.classList.add('active');
            this.style.background = '#EFEBE9';
            this.style.color = '#5D4037';

            const tabType = this.getAttribute('data-tab');
            let visibleCount = 0;

            // Re-select items dynamically inside the click!
            const dynamicNotifItems = document.querySelectorAll('.notif-list-item');

            dynamicNotifItems.forEach(item => {
                if (tabType === 'all') {
                    item.style.display = 'flex';
                    visibleCount++;
                } else if (tabType === 'unread') {
                    if (item.classList.contains('unread')) {
                        item.style.display = 'flex';
                        visibleCount++;
                    } else {
                        item.style.display = 'none';
                    }
                }
            });

            if (emptyState) emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
            sectionTitles.forEach(title => {
                title.style.display = (tabType === 'unread' || visibleCount === 0) ? 'none' : 'block';
            });
        });
    });

    // 2. Ellipsis Menu Logic
    const notifEllipsis = document.getElementById('notifEllipsis');
    const notifOptionsMenu = document.getElementById('notifOptionsMenu');
    const markAllReadBtn = document.querySelector('.mark-all-read-btn');

    if (notifEllipsis && notifOptionsMenu) {
        // Toggle the menu when clicking the 3 dots
        notifEllipsis.addEventListener('click', function (e) {
            e.stopPropagation();
            notifOptionsMenu.style.display = notifOptionsMenu.style.display === 'block' ? 'none' : 'block';
        });

        // Close the menu if user clicks anywhere else on the screen
        window.addEventListener('click', function (e) {
            if (e.target !== notifEllipsis && !notifOptionsMenu.contains(e.target)) {
                notifOptionsMenu.style.display = 'none';
            }
        });
    }

    // 3. Mark All As Read Logic
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', function () {
            // Re-select items dynamically inside the click!
            const dynamicNotifItems = document.querySelectorAll('.notif-list-item');

            dynamicNotifItems.forEach(item => {
                item.classList.remove('unread');
                item.classList.add('read');

                const blueDot = item.querySelector('.unread-dot');
                if (blueDot) blueDot.style.display = 'none';

                const redDot = item.querySelector('.red-dot');
                if (redDot) redDot.style.display = 'none';
            });

            notifOptionsMenu.style.display = 'none';

            const activeTab = document.querySelector('.notif-tab.active');
            if (activeTab && activeTab.getAttribute('data-tab') === 'unread') {
                activeTab.click();
            }
        });
    }
});