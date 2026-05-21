/**
 Upload, View, Edit, and Notifications
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Elements
    const bell = document.querySelector('.notification-wrapper');
    const notifDropdown = document.getElementById('notificationDropdown');
    const uploadDropdownBtn = document.querySelector('.btn-upload-dropdown');
    const uploadDropdownWrapper = document.querySelector('.upload-dropdown');

    // Select all potential modals
    const modals = {
        uploadNew: document.getElementById('uploadNewModal'),
        uploadExisting: document.getElementById('uploadExistingModal'),
        view: document.getElementById('viewModal'),
        edit: document.getElementById('editModal'),
        user: document.getElementById('userModal'),
        editUser: document.getElementById('editUserModal'),
        reviewUpload: document.getElementById('reviewUploadModal')
    };

    // 2. Helper to close all UI overlays
    const closeAllOverlays = () => {
        Object.values(modals).forEach(m => {
            if (m) {
                m.style.display = 'none';

                // Reset file inputs and their visual states to avoid caching old files across modals
                const fileInputs = m.querySelectorAll('input[type="file"]');
                fileInputs.forEach(input => {
                    input.value = ''; // clear physical file selection
                    const uploadArea = input.closest('.upload-area');
                    if (uploadArea && uploadArea.hasAttribute('data-default-html')) {
                        const p = uploadArea.querySelector('p');
                        const span = uploadArea.querySelector('span');
                        if (p) p.innerHTML = uploadArea.getAttribute('data-default-html');
                        if (span) span.innerText = uploadArea.getAttribute('data-default-span');
                        uploadArea.removeAttribute('data-default-html');
                        uploadArea.removeAttribute('data-default-span');
                    }
                });
            }
        });
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

    setupTrigger('.trigger-upload-new', 'uploadNew');
    setupTrigger('.trigger-upload-existing', 'uploadExisting');
    setupTrigger('.trigger-view', 'view');
    setupTrigger('.trigger-edit', 'edit');
    setupTrigger('.trigger-user', 'user');
    setupTrigger('.trigger-edit-user', 'editUser');

    // ==========================================
    // REVIEW UPLOAD MODAL LOGIC
    // ==========================================
    const reviewUploadBtns = document.querySelectorAll('.btn-review-upload');
    let activeUploadForm = null;
    let currentPdfUrl = null;

    reviewUploadBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            const form = this.closest('form');
            if (!form.reportValidity()) return;

            activeUploadForm = form;

            // Gather values
            const title = form.querySelector('[name="title"]')?.value || 'N/A';
            const docNum = form.querySelector('[name="document_number"]')?.value || 'N/A';
            const docType = form.querySelector('[name="doc_type"]')?.value || 'N/A';
            const year = form.querySelector('[name="year"]')?.value || 'N/A';
            const dateEnacted = form.querySelector('[name="date_enacted"]')?.value || '';
            const sponsor = form.querySelector('[name="sponsor"]')?.value || '';
            const keywords = form.querySelector('[name="keywords"]')?.value || '';
            const coSponsors = form.querySelector('[name="co_sponsors"]')?.value || '';
            const status = form.querySelector('[name="status"]')?.value || 'N/A';
            const visibility = form.querySelector('[name="visibility"]')?.value || 'N/A';
            const storage = form.querySelector('[name="physical_storage"]')?.value || '';

            // Populate Review Modal
            if (document.getElementById('review-title')) document.getElementById('review-title').innerText = title;
            if (document.getElementById('review-number')) document.getElementById('review-number').innerText = docNum;
            if (document.getElementById('review-type')) document.getElementById('review-type').innerText = docType;
            if (document.getElementById('review-year')) document.getElementById('review-year').innerText = year;
            if (document.getElementById('review-date-enacted')) document.getElementById('review-date-enacted').innerText = dateEnacted || 'N/A';
            if (document.getElementById('review-sponsor')) document.getElementById('review-sponsor').innerText = sponsor || 'N/A';
            if (document.getElementById('review-keywords')) document.getElementById('review-keywords').innerText = keywords || 'N/A';
            if (document.getElementById('review-cosponsors')) document.getElementById('review-cosponsors').innerText = coSponsors || 'N/A';
            if (document.getElementById('review-status')) document.getElementById('review-status').innerHTML = `<span class="badge ${status.toLowerCase()}">${status}</span>`;
            if (document.getElementById('review-visibility')) document.getElementById('review-visibility').innerText = visibility;
            if (document.getElementById('review-storage')) document.getElementById('review-storage').innerText = storage || 'N/A';

            // Handle PDF Preview
            const fileInput = form.querySelector('input[type="file"]');
            const pdfIframe = document.getElementById('review-pdf-iframe');
            const pdfMissing = document.getElementById('review-pdf-missing');
            
            if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);

            if (fileInput && fileInput.files && fileInput.files[0]) {
                currentPdfUrl = URL.createObjectURL(fileInput.files[0]);
                if (pdfIframe) {
                    pdfIframe.src = currentPdfUrl + '#view=FitH';
                    pdfIframe.style.display = 'block';
                }
                if (pdfMissing) pdfMissing.style.display = 'none';
            } else {
                if (pdfIframe) {
                    pdfIframe.src = '';
                    pdfIframe.style.display = 'none';
                }
                if (pdfMissing) pdfMissing.style.display = 'block';
            }

            // Hide current overlay and show review modal
            const parentOverlay = form.closest('.modal-overlay');
            if (parentOverlay) parentOverlay.style.display = 'none';
            if (modals.reviewUpload) modals.reviewUpload.style.display = 'flex';
        });
    });

    const confirmUploadBtn = document.getElementById('confirmUploadBtn');
    if (confirmUploadBtn) {
        confirmUploadBtn.addEventListener('click', function() {
            if (activeUploadForm) {
                this.innerHTML = 'Uploading... <i class="fa-solid fa-spinner fa-spin"></i>';
                this.style.pointerEvents = 'none';
                this.style.opacity = '0.7';
                activeUploadForm.submit();
            }
        });
    }

    const backToEditBtn = document.getElementById('backToEditBtn');
    if (backToEditBtn) {
        backToEditBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevents the global discard script from clearing the files
            if (modals.reviewUpload) modals.reviewUpload.style.display = 'none';
            // Re-open the form that was being edited
            if (activeUploadForm) {
                const parentOverlay = activeUploadForm.closest('.modal-overlay');
                if (parentOverlay) parentOverlay.style.display = 'flex';
            }
        });
    }

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

    // 5. Notification Logic & Real-Time Polling
    if (bell && notifDropdown) {
        bell.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isShowing = notifDropdown.style.display === 'block';
            closeAllOverlays();
            notifDropdown.style.display = isShowing ? 'none' : 'block';

            // Hide the red badge when the user clicks the bell
            const badge = document.querySelector('.notif-badge');
            if (badge) badge.style.display = 'none';
        });
    }

    // ==========================================
    // UNIFIED AJAX FETCH LOGIC & INFINITE SCROLL
    // ==========================================
    let currentNotifLimit = 10; // Start by loading 10 items
    let isInitialNotifLoad = true; // Track first load for skeleton

    function fetchNotifications() {
        const notifBody = document.getElementById('notifModalBody');

        // Inject animated skeleton loader on the first fetch
        if (isInitialNotifLoad && notifBody) {
            let skeletonHtml = `
            <style>
                @keyframes pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                }
                .skeleton-bg { background: #e0e0e0; animation: pulse 1.5s infinite; border-radius: 4px; }
            </style>
            <div class="notif-section-title">Recent Activity</div>`;
            
            for (let i = 0; i < 4; i++) {
                skeletonHtml += `
                <div class="notif-list-item" style="display: flex; align-items: center; padding: 12px 15px; border-bottom: 1px solid #eee;">
                    <div class="skeleton-bg" style="width: 35px; height: 35px; border-radius: 50%; margin-right: 15px;"></div>
                    <div style="flex: 1;">
                        <div class="skeleton-bg" style="width: 85%; height: 12px; margin-bottom: 8px;"></div>
                        <div class="skeleton-bg" style="width: 40%; height: 10px;"></div>
                    </div>
                </div>`;
            }
            notifBody.innerHTML = skeletonHtml;
        }

        return fetch(`/api/notifications/?limit=${currentNotifLimit}`)
            .then(response => response.json())
            .then(data => {
                const notifBadge = document.querySelector('.notif-badge');

                isInitialNotifLoad = false; // Mark initial load as complete

                if (notifBody && data.notifications) {
                    let htmlContent = '';

                    // Grab the last read ID from browser memory (default to 0 if never clicked)
                    const lastReadId = parseInt(localStorage.getItem('lastReadNotifId')) || 0;

                    // Track the highest ID in this current batch so we can save it later
                    window.highestNotifId = data.notifications.length > 0 ? Math.max(...data.notifications.map(n => n.id)) : 0;

                    if (data.notifications.length > 0) {
                        htmlContent += `<div class="notif-section-title">Recent Activity</div>`;

                        data.notifications.forEach((notif) => {
                            let iconClass = 'fa-desktop';
                            if (notif.message.includes('Upload')) iconClass = 'fa-file-invoice';
                            else if (notif.message.includes('Updated') || notif.message.includes('modified')) iconClass = 'fa-file-signature';

                            // Determine if THIS specific notification is unread
                            const isUnread = notif.id > lastReadId;
                            const unreadClass = isUnread ? 'unread' : 'read';
                            const redDotHtml = isUnread ? '<span class="red-dot"></span>' : '';
                            const blueDotHtml = isUnread ? '<div class="unread-dot"></div>' : '';

                            htmlContent += `
                            <div class="notif-list-item ${unreadClass}">
                                <div class="notif-icon">
                                    <i class="fa-solid ${iconClass}"></i>
                                    ${redDotHtml}
                                </div>
                                <div style="flex: 1;">
                                    <p>${notif.message}</p>
                                    <span class="notif-time">${notif.time}</span>
                                </div>
                                ${blueDotHtml}
                            </div>`;
                        });

                        // Only show the red bell badge if there are ACTUALLY unread items
                        const hasUnreadItems = data.notifications.some(n => n.id > lastReadId);
                        if (notifBadge) {
                            notifBadge.style.display = hasUnreadItems ? 'block' : 'none';
                        }
                    }

                    htmlContent += `
                    <div id="emptyNotifState" class="empty-notif-state" style="display: ${data.notifications.length === 0 ? 'block' : 'none'};">
                        <i class="fa-solid fa-bell-slash"></i>
                        <p>You have no notifications.</p>
                    </div>`;

                    notifBody.innerHTML = htmlContent;

                    // ... (keep the rest of the button toggle logic here)
                    const loadMoreBtn = document.getElementById('loadMoreNotifsBtn');
                    const goToAuditLogsBtn = document.getElementById('goToAuditLogsBtn');

                    if (loadMoreBtn && goToAuditLogsBtn) {
                        if (data.has_more) {
                            loadMoreBtn.style.display = 'inline-block';
                            goToAuditLogsBtn.style.display = 'none';
                        } else {
                            loadMoreBtn.style.display = 'none';
                            goToAuditLogsBtn.style.display = 'inline-block';
                        }
                    }

                    const activeTab = document.querySelector('.notif-tab.active');
                    if (activeTab) activeTab.click();
                }
            })
            .catch(error => console.error('Error fetching notifications:', error));
    }

    // Only fetch notifications if the notifications modal exists on the current page
    if (document.getElementById('notifModalBody')) {
        fetchNotifications();
        setInterval(fetchNotifications, 30000);
    }

    // 5.5 Upload Dropdown Logic
    if (uploadDropdownBtn && uploadDropdownWrapper) {
        uploadDropdownBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadDropdownWrapper.classList.toggle('show');
        });
    }

    // 6. Global Click Listener (Close when clicking outside)
    window.addEventListener('click', (event) => {
        // Close modal if clicking the background overlay
        if (event.target.classList.contains('modal-overlay')) {
            closeAllOverlays();
        }

        // Close upload dropdown if clicking outside
        if (uploadDropdownWrapper && !uploadDropdownWrapper.contains(event.target)) {
            uploadDropdownWrapper.classList.remove('show');
        }

        // Close notification if clicking outside
        if (notifDropdown &&
            !notifDropdown.contains(event.target) &&
            bell && !bell.contains(event.target)) {
            notifDropdown.style.display = 'none';
        }
    });

    // ==========================================
    // FILE UPLOAD UI FEEDBACK (Upload Modal)
    // ==========================================
    // Use event delegation to catch ALL file inputs across the entire application.
    // This completely ignores IDs and safely finds the input no matter what it's named.
    document.addEventListener('change', function (e) {
        if (e.target && e.target.type === 'file') {
            const fileInput = e.target;
            // Pinpoint the exact visual box directly surrounding this specific input
            const uploadArea = fileInput.closest('.upload-area');

            if (uploadArea) {
                const uploadText = uploadArea.querySelector('p');
                const uploadSpan = uploadArea.querySelector('span');

                if (uploadText) {
                    if (fileInput.files && fileInput.files.length > 0) {
                        // Use innerHTML to preserve <strong> tags utilized by Edit Modals
                        if (!uploadArea.hasAttribute('data-default-html')) {
                            uploadArea.setAttribute('data-default-html', uploadText.innerHTML);
                            if (uploadSpan) uploadArea.setAttribute('data-default-span', uploadSpan.innerText);
                        }

                        uploadText.innerHTML = `File attached: <strong style="color: #22C55E;">${fileInput.files[0].name}</strong>`;
                        if (uploadSpan) uploadSpan.innerText = 'Ready to upload';
                    } else {
                        // Revert to original text/formatting if user clicks "Cancel"
                        if (uploadArea.hasAttribute('data-default-html')) {
                            uploadText.innerHTML = uploadArea.getAttribute('data-default-html');
                            if (uploadSpan) uploadSpan.innerText = uploadArea.getAttribute('data-default-span');
                        }
                    }
                }
            }
        }
    });

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
            const docEnacted = this.getAttribute('data-enacted');
            const docCosponsors = this.getAttribute('data-cosponsors');
            const docStatus = this.getAttribute('data-status');
            const docVisibility = this.getAttribute('data-visibility');
            const docStorage = this.getAttribute('data-storage');
            const fileUrl = this.getAttribute('data-file');
            const vetoReason = this.getAttribute('data-vetoreason');

            // 2. Inject the data into the modal's HTML
            document.getElementById('view-number').innerText = docNumber;
            document.getElementById('view-title').innerHTML = `<strong>${docTitle}</strong>`;
            document.getElementById('view-type').innerText = docType;
            document.getElementById('view-year').innerText = docYear;
            document.getElementById('view-date').innerText = docDate;
            document.getElementById('view-sponsor').innerText = docSponsor;
            document.getElementById('view-keywords').innerText = docKeywords;
            if (document.getElementById('view-enacted')) document.getElementById('view-enacted').innerText = docEnacted;
            if (document.getElementById('view-cosponsors')) document.getElementById('view-cosponsors').innerText = docCosponsors;
            if (document.getElementById('view-status')) document.getElementById('view-status').innerHTML = `<span class="badge ${docStatus ? docStatus.toLowerCase() : ''}">${docStatus}</span>`;
            if (document.getElementById('view-visibility')) document.getElementById('view-visibility').innerText = docVisibility;
            if (document.getElementById('view-storage')) document.getElementById('view-storage').innerText = docStorage;

            const docVetoReason = this.getAttribute('data-vetoreason');
            
            if (document.getElementById('view-veto-reason')) {
                document.getElementById('view-veto-reason').innerText = docVetoReason;
            }

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

            // Safe check for valid URL
            const hasFile = fileUrl && fileUrl.trim() !== '' && fileUrl !== 'None' && fileUrl !== 'null';

            if (hasFile) {
                // Set iframe source and force PDF to fit horizontal width smoothly
                pdfIframe.src = fileUrl + '#view=FitH';
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

            // --- ADDED THIS BLOCK ---
            if (document.getElementById('edit-veto-reason')) {
                document.getElementById('edit-veto-reason').value = vetoReason || '';
            }
            // ------------------------

            // 3. Update the File Text UI
            const fileText = document.getElementById('edit-file-text');
            const uploadArea = fileText ? fileText.closest('.upload-area') : null;
            const uploadSpan = uploadArea ? uploadArea.querySelector('span') : null;

            if (fileName && fileName !== 'None' && fileName !== 'null' && fileName.trim() !== '') {
                // Extract just the filename from the folder path
                const cleanName = fileName.split('/').pop();
                fileText.innerHTML = `Current File: <strong>${cleanName}</strong>`;
                if (uploadSpan) uploadSpan.innerText = 'Click to browse or replace file';
            } else {
                fileText.innerHTML = `Current File: <strong style="color: #888;">No file attached</strong>`;
                if (uploadSpan) uploadSpan.innerText = 'Click to browse or drag and drop';
            }
        });
    });

    // ==========================================
    // POPULATE EDIT USER MODAL
    // ==========================================
    const editUserButtons = document.querySelectorAll('.trigger-edit-user');

    editUserButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const userId = this.getAttribute('data-id');
            const userFirst = this.getAttribute('data-first');
            const userLast = this.getAttribute('data-last');
            const userEmail = this.getAttribute('data-email');
            const userUsername = this.getAttribute('data-username');
            const userRole = this.getAttribute('data-role');

            document.getElementById('edit-user-id').value = userId;
            document.getElementById('edit-user-first').value = userFirst;
            document.getElementById('edit-user-last').value = userLast;
            document.getElementById('edit-user-email').value = userEmail;
            document.getElementById('edit-user-username').value = userUsername;
            if (document.getElementById('edit-user-role')) {
                document.getElementById('edit-user-role').value = userRole;
            }
        });
    });

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
    // UNIFIED DROPDOWN UI LOGIC (Tabs, Ellipsis)
    // ==========================================
    const notifTabs = document.querySelectorAll('.notif-tab');
    const emptyState = document.getElementById('emptyNotifState');
    const sectionTitles = document.querySelectorAll('.notif-section-title');
    const loadMoreBtn = document.getElementById('loadMoreNotifsBtn');

    // Tabs
    notifTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            notifTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const tabType = this.getAttribute('data-tab');
            let visibleCount = 0;
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

    // Ellipsis Menu
    const notifEllipsis = document.getElementById('notifEllipsis');
    const notifOptionsMenu = document.getElementById('notifOptionsMenu');
    if (notifEllipsis && notifOptionsMenu) {
        notifEllipsis.addEventListener('click', function (e) {
            e.stopPropagation();
            notifOptionsMenu.style.display = notifOptionsMenu.style.display === 'block' ? 'none' : 'block';
        });
        // Added to the global click listener
    }

    // Mark All Read
    const markAllReadBtn = document.querySelector('.mark-all-read-btn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', function (e) {
            e.stopPropagation();

            // 1. SAVE TO MEMORY: Remember that we have read everything up to the current highest ID!
            if (window.highestNotifId) {
                localStorage.setItem('lastReadNotifId', window.highestNotifId);
            }

            // 2. Hide the red bell badge instantly
            const notifBadge = document.querySelector('.notif-badge');
            if (notifBadge) notifBadge.style.display = 'none';

            // 3. Clear the visual dots from the current list
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
            if (activeTab && activeTab.getAttribute('data-tab') === 'unread') activeTab.click();
        });
    }

    // ==========================================
    // LOAD MORE BUTTON (SYNCHRONIZED SCROLL)
    // ==========================================
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const originalText = this.innerHTML;
            this.innerHTML = 'Loading... <i class="fa-solid fa-spinner fa-spin" style="margin-left: 5px;"></i>';
            this.style.pointerEvents = 'none';
            this.style.opacity = '0.7';

            currentNotifLimit += 10;

            // Append skeleton loader to the bottom before fetching the next page
            const notifBody = document.getElementById('notifModalBody');
            if (notifBody) {
                const moreSkeleton = `
                <div class="notif-list-item" style="display: flex; align-items: center; padding: 12px 15px; border-bottom: 1px solid #eee;">
                    <div class="skeleton-bg" style="width: 35px; height: 35px; border-radius: 50%; background: #e0e0e0; animation: pulse 1.5s infinite; margin-right: 15px;"></div>
                    <div style="flex: 1;">
                        <div class="skeleton-bg" style="width: 85%; height: 12px; background: #e0e0e0; animation: pulse 1.5s infinite; margin-bottom: 8px; border-radius: 4px;"></div>
                        <div class="skeleton-bg" style="width: 40%; height: 10px; background: #e0e0e0; animation: pulse 1.5s infinite; border-radius: 4px;"></div>
                    </div>
                </div>`;
                notifBody.insertAdjacentHTML('beforeend', moreSkeleton.repeat(2));
                notifBody.scrollTo({ top: notifBody.scrollHeight, behavior: 'smooth' });
            }

            // Use .then() to wait exactly until the fetch is 100% finished!
            fetchNotifications().then(() => {
                this.innerHTML = originalText;
                this.style.pointerEvents = 'auto';
                this.style.opacity = '1';

                const notifBody = document.getElementById('notifModalBody');
                if (notifBody) {
                    notifBody.scrollTo({
                        top: notifBody.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // ==========================================
    // TOAST NOTIFICATION LOGIC (Auto-dismiss)
    // ==========================================
    const toasts = document.querySelectorAll('.toast');
    toasts.forEach(toast => {
        // Auto dismiss after 5 seconds
        const autoDismissTimer = setTimeout(() => {
            if (toast && !toast.classList.contains('hiding')) {
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300); // Wait for transition
            }
        }, 5000);

        // Manual dismiss
        const closeBtn = toast.querySelector('.close-toast');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                clearTimeout(autoDismissTimer); // Stop the auto-dismiss if closed manually
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300);
            });
        }
    });

    // ==========================================
    // PAGE TRANSITION SKELETON LOADER
    // ==========================================
    const navLinks = document.querySelectorAll('.nav-links a:not(.logout-link a)');
    
    // Create the overlay once and append to body
    const skeletonOverlay = document.createElement('div');
    skeletonOverlay.className = 'page-skeleton-overlay';
    skeletonOverlay.innerHTML = `
        <div class="skel-header"></div>
        <div class="skel-grid">
            <div class="skel-card"></div>
            <div class="skel-card"></div>
            <div class="skel-card"></div>
            <div class="skel-card"></div>
        </div>
        <div class="skel-table"></div>
    `;
    document.body.appendChild(skeletonOverlay);

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.target !== '_blank' && !this.getAttribute('href').startsWith('#') && !this.classList.contains('active')) {
                skeletonOverlay.classList.add('show');
            }
        });
    });
});