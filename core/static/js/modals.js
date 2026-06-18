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
    const setupTrigger = (selector, modalKey, formId = null) => {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest(selector);
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                closeAllOverlays();
                if (modals[modalKey]) {
                    modals[modalKey].style.display = 'flex';
                    if (formId) {
                        setTimeout(() => loadDraft(formId), 50);
                    }
                }
            }
        });
    };

    // ==========================================
    // AUTO-SAVE DRAFTS (Upload & Edit)
    // ==========================================
    const DRAFT_KEYS = {
        'uploadNewForm': 'draft_uploadNew',
        'uploadExistingForm': 'draft_uploadExisting',
        'editDocumentForm': 'draft_edit'
    };

    function saveDraft(formId, docId = null) {
        const form = document.getElementById(formId);
        if (!form) return;
        
        let key = DRAFT_KEYS[formId];
        if (!key) return;
        
        if (formId === 'editDocumentForm' && docId) {
            key = `${key}_${docId}`;
        }
        
        const formData = new FormData(form);
        const data = {};
        let hasData = false;
        formData.forEach((value, name) => {
            if (name !== 'csrfmiddlewaretoken' && name !== 'file_attachment') {
                if (value.trim() !== '') hasData = true;
                data[name] = value;
            }
        });
        if (hasData) {
            localStorage.setItem(key, JSON.stringify(data));
        } else {
            localStorage.removeItem(key);
        }
    }

    function loadDraft(formId, docId = null) {
        const form = document.getElementById(formId);
        if (!form) return false;

        let key = DRAFT_KEYS[formId];
        if (!key) return false;

        if (formId === 'editDocumentForm' && docId) {
            key = `${key}_${docId}`;
        }

        const draftStr = localStorage.getItem(key);
        
        if (draftStr) {
            try {
                const data = JSON.parse(draftStr);
                
                if(confirm("A saved draft was found for this form. Do you want to restore it?")) {
                    for (const name in data) {
                        const input = form.querySelector(`[name="${name}"]`);
                        if (input && input.type !== 'file') {
                            input.value = data[name];
                            if (name === 'status') {
                                input.dispatchEvent(new Event('change'));
                            }
                        }
                    }
                    return true;
                } else {
                    localStorage.removeItem(key);
                }
            } catch(e) {
                localStorage.removeItem(key);
            }
        }
        return false;
    }

    function clearDraft(formId, docId = null) {
        let key = DRAFT_KEYS[formId];
        if (!key) return;
        if (formId === 'editDocumentForm' && docId) {
            key = `${key}_${docId}`;
        }
        localStorage.removeItem(key);
    }

    ['uploadNewForm', 'uploadExistingForm', 'editDocumentForm'].forEach(formId => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('input', (e) => {
                if (e.target.type !== 'file') {
                    const docId = formId === 'editDocumentForm' ? document.getElementById('edit-doc-id')?.value : null;
                    saveDraft(formId, docId);
                }
            });
            form.addEventListener('change', (e) => {
                if (e.target.type !== 'file') {
                    const docId = formId === 'editDocumentForm' ? document.getElementById('edit-doc-id')?.value : null;
                    saveDraft(formId, docId);
                }
            });
            
            form.addEventListener('submit', () => {
                const docId = formId === 'editDocumentForm' ? document.getElementById('edit-doc-id')?.value : null;
                clearDraft(formId, docId);
            });
        }
    });

    setupTrigger('.trigger-upload-new', 'uploadNew', 'uploadNewForm');
    setupTrigger('.trigger-upload-existing', 'uploadExisting', 'uploadExistingForm');
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

                const formId = activeUploadForm.id;
                const docId = formId === 'editDocumentForm' ? document.getElementById('edit-doc-id')?.value : null;
                clearDraft(formId, docId);

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
    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.close-modal, .btn-discard, #discardBtn, #closeModal');
        
        if (closeBtn) {
            // Prevent "Back to Edit" or "Clear Data" from triggering a full close
            if (closeBtn.id === 'backToEditBtn' || closeBtn.innerText.includes('Clear Data')) return;

            // SMART CONFIRMATION LOGIC FOR UPLOADS
            const parentModal = closeBtn.closest('.modal-overlay');
            if (parentModal && (parentModal.id === 'uploadNewModal' || parentModal.id === 'uploadExistingModal')) {
                
                const form = parentModal.querySelector('form');
                let isDirty = false;
                
                if (form) {
                    const inputs = form.querySelectorAll('input[type="text"], input[type="date"], input[type="file"]');
                    inputs.forEach(input => {
                        if (input.value && input.value.trim() !== '') isDirty = true;
                    });
                    
                    const selects = form.querySelectorAll('select');
                    selects.forEach(select => {
                        if (select.value && select.value !== '') isDirty = true;
                    });
                }

                // If they have data, ask for confirmation!
                if (isDirty) {
                    // FIXED: Updated the warning message since data is no longer erased!
                    if (!confirm("Are you sure you want to close? Your inputs will be kept here in the background.")) {
                        return; // Cancel the close action
                    }
                }
                
                // FIXED: Completely removed form.reset() and clearDraft() so the data stays!
                
            } else if (parentModal && parentModal.id === 'editModal') {
                // FIXED: Removed form.reset() and clearDraft() here too!
            }

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

            // The red badge count will now persist until notifications are individually marked as read
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
                    const individuallyReadIds = JSON.parse(localStorage.getItem('individuallyReadIds')) || [];

                    // Track the highest ID in this current batch so we can save it later
                    window.highestNotifId = data.notifications.length > 0 ? Math.max(...data.notifications.map(n => n.id)) : 0;

                    if (data.notifications.length > 0) {
                        htmlContent += `<div class="notif-section-title">Recent Activity</div>`;

                        data.notifications.forEach((notif) => {
                            let iconClass = 'fa-desktop';
                            if (notif.message.includes('Upload')) iconClass = 'fa-file-invoice';
                            else if (notif.message.includes('Updated') || notif.message.includes('modified')) iconClass = 'fa-file-signature';

                            // Determine if THIS specific notification is unread
                            const isUnread = notif.id > lastReadId && !individuallyReadIds.includes(notif.id);
                            const unreadClass = isUnread ? 'unread' : 'read';
                            const redDotHtml = isUnread ? '<span class="red-dot"></span>' : '';
                            const blueDotHtml = isUnread ? '<div class="unread-dot"></div>' : '';

                            htmlContent += `
                            <div class="notif-list-item ${unreadClass}" data-id="${notif.id}" style="cursor: pointer;">
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

                        // Calculate the exact number of unread items and display in the badge
                        const unreadItemsCount = data.notifications.filter(n => n.id > lastReadId && !individuallyReadIds.includes(n.id)).length;
                        if (notifBadge) {
                            if (unreadItemsCount > 0) {
                                notifBadge.style.display = 'flex';
                                notifBadge.innerText = unreadItemsCount > 99 ? '99+' : unreadItemsCount;
                            } else {
                                notifBadge.style.display = 'none';
                            }
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

    // ==========================================
    // NOTIFICATION CLICK TO MARK AS READ
    // ==========================================
    const notifModalBody = document.getElementById('notifModalBody');
    if (notifModalBody) {
        notifModalBody.addEventListener('click', function(e) {
            const notifItem = e.target.closest('.notif-list-item');

            if (notifItem && notifItem.classList.contains('unread')) {
                const notifId = parseInt(notifItem.dataset.id);
                if (notifId) {
                    // 1. Update localStorage
                    let individuallyReadIds = JSON.parse(localStorage.getItem('individuallyReadIds')) || [];
                    if (!individuallyReadIds.includes(notifId)) {
                        individuallyReadIds.push(notifId);
                        localStorage.setItem('individuallyReadIds', JSON.stringify(individuallyReadIds));
                    }

                    // 2. Update UI instantly
                    notifItem.classList.remove('unread');
                    notifItem.classList.add('read');
                    const blueDot = notifItem.querySelector('.unread-dot');
                    if (blueDot) blueDot.style.display = 'none';
                    const redDot = notifItem.querySelector('.red-dot');
                    if (redDot) redDot.style.display = 'none';

                    // 3. Update main bell badge
                    const remainingUnread = notifModalBody.querySelectorAll('.notif-list-item.unread').length;
                    const notifBadge = document.querySelector('.notif-badge');
                    if (notifBadge) {
                        if (remainingUnread === 0) {
                            notifBadge.style.display = 'none';
                        } else {
                            notifBadge.innerText = remainingUnread > 99 ? '99+' : remainingUnread;
                        }
                    }

                    // 4. Hide from unread tab if active
                    const activeTab = document.querySelector('.notif-tab.active');
                    if (activeTab && activeTab.getAttribute('data-tab') === 'unread') {
                        notifItem.style.display = 'none';
                        const visibleItems = Array.from(notifModalBody.querySelectorAll('.notif-list-item')).filter(item => item.style.display !== 'none').length;
                        if (visibleItems === 0 && document.getElementById('emptyNotifState')) {
                            document.getElementById('emptyNotifState').style.display = 'block';
                        }
                    }
                }
            }
        });
    }

    // 5.5 Upload Dropdown Logic
    if (uploadDropdownBtn && uploadDropdownWrapper) {
        uploadDropdownBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadDropdownWrapper.classList.toggle('show');
        });
    }

    // 5.6 Profile Dropdown Logic
    const profileBtn = document.getElementById('profileDropdownBtn');
    const profileDropdownContent = document.getElementById('profileDropdown');

    if (profileBtn && profileDropdownContent) {
        profileBtn.addEventListener('click', (e) => {
            // Only toggle if we didn't click a link inside the dropdown
            if (e.target.closest('a')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            profileBtn.classList.toggle('show');
        });
    }

    // 6. Global Click Listener (Close when clicking outside)
    window.addEventListener('click', (event) => {
        // Close modal if clicking the dark background overlay
        if (event.target.classList.contains('modal-overlay')) {
            
            // SMART CONFIRMATION LOGIC FOR BACKGROUND CLICKS
            if (event.target.id === 'uploadNewModal' || event.target.id === 'uploadExistingModal') {
                const form = event.target.querySelector('form');
                let isDirty = false;
                
                if (form) {
                    const inputs = form.querySelectorAll('input[type="text"], input[type="date"], input[type="file"]');
                    inputs.forEach(input => {
                        if (input.value && input.value.trim() !== '') isDirty = true;
                    });
                    
                    const selects = form.querySelectorAll('select');
                    selects.forEach(select => {
                        if (select.value && select.value !== '') isDirty = true;
                    });
                }

                if (isDirty) {
                    // FIXED: Updated the warning message since data is no longer erased!
                    if (!confirm("Are you sure you want to close? Your inputs will be kept here in the background.")) {
                        return; // Cancel the close action
                    }
                }
                
                // FIXED: Completely removed form.reset() and clearDraft() so the data stays!
                
            } else if (event.target.id === 'editModal') {
                // FIXED: Removed form.reset() and clearDraft() here too!
            }
            
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
        
        // Close profile dropdown if clicking outside
        if (profileBtn && !profileBtn.contains(event.target)) {
            profileBtn.classList.remove('show');
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
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.trigger-view');
        if (btn) {
            // 1. Read the data from the icon we clicked
            const docNumber = btn.getAttribute('data-number');
            const docTitle = btn.getAttribute('data-title');
            const docType = btn.getAttribute('data-type');
            const docYear = btn.getAttribute('data-year');
            const docDate = btn.getAttribute('data-date');
            const docSponsor = btn.getAttribute('data-sponsor');
            const docKeywords = btn.getAttribute('data-keywords');
            const docEnacted = btn.getAttribute('data-enacted');
            const docCosponsors = btn.getAttribute('data-cosponsors');
            const docStatus = btn.getAttribute('data-status');
            const docVisibility = btn.getAttribute('data-visibility');
            const docStorage = btn.getAttribute('data-storage');
            const fileUrl = btn.getAttribute('data-file');
            const vetoReason = btn.getAttribute('data-vetoreason');

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

            const docVetoReason = btn.getAttribute('data-vetoreason');
            
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
        }
    });

    // ==========================================
    // POPULATE EDIT MODAL
    // ==========================================
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.trigger-edit');
        if (btn) {
            // 1. Read data from the pencil icon
            const docId = btn.getAttribute('data-id');
            const docNumber = btn.getAttribute('data-number');
            const docTitle = btn.getAttribute('data-title');
            const docType = btn.getAttribute('data-type');
            const docYear = btn.getAttribute('data-year');
            const docDate = btn.getAttribute('data-date');
            const docSponsor = btn.getAttribute('data-sponsor');
            const docCoSponsors = btn.getAttribute('data-cosponsors');
            const docKeywords = btn.getAttribute('data-keywords');
            const docStatus = btn.getAttribute('data-status');
            const docVisibility = btn.getAttribute('data-visibility');
            const docStorage = btn.getAttribute('data-storage');
            const fileName = btn.getAttribute('data-file');
            const vetoReason = btn.getAttribute('data-vetoreason');

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

            setTimeout(() => {
                loadDraft('editDocumentForm', docId);
            }, 50);
        }
    });

    // ==========================================
    // POPULATE EDIT USER MODAL
    // ==========================================
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.trigger-edit-user');
        if (btn) {
            const userId = btn.getAttribute('data-id');
            const userFirst = btn.getAttribute('data-first');
            const userLast = btn.getAttribute('data-last');
            const userEmail = btn.getAttribute('data-email');
            const userUsername = btn.getAttribute('data-username');
            const userRole = btn.getAttribute('data-role');

            document.getElementById('edit-user-id').value = userId;
            document.getElementById('edit-user-first').value = userFirst;
            document.getElementById('edit-user-last').value = userLast;
            document.getElementById('edit-user-email').value = userEmail;
            document.getElementById('edit-user-username').value = userUsername;
            if (document.getElementById('edit-user-role')) {
                document.getElementById('edit-user-role').value = userRole;
            }
        }
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
                localStorage.removeItem('individuallyReadIds');
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
    // GLOBAL SEARCH AUTOCOMPLETE
    // ==========================================
    const globalSearchInput = document.querySelector('.search-bar input');
    const searchContainer = document.querySelector('.search-bar');
    
    if (globalSearchInput && searchContainer) {
        searchContainer.classList.add('search-container');
        
        const searchDropdown = document.createElement('div');
        searchDropdown.className = 'search-dropdown';
        searchContainer.appendChild(searchDropdown);
        
        let searchTimeout = null;
        
        globalSearchInput.addEventListener('input', function() {
            const query = this.value.trim();
            
            clearTimeout(searchTimeout);
            
            if (query.length < 2) {
                searchDropdown.classList.remove('show');
                return;
            }
            
            searchTimeout = setTimeout(() => {
                fetch(`/api/global-search/?q=${encodeURIComponent(query)}`)
                    .then(response => response.json())
                    .then(data => {
                        searchDropdown.innerHTML = '';
                        
                        if (Object.keys(data.results).length === 0) {
                            searchDropdown.innerHTML = `
                                <div class="search-no-results">
                                    <i class="fa-solid fa-magnifying-glass" style="font-size: 1.5rem; margin-bottom: 10px; opacity: 0.5;"></i><br>
                                    No results found for "${query}"
                                </div>
                            `;
                        } else {
                            for (const [category, items] of Object.entries(data.results)) {
                                const categoryHeader = document.createElement('div');
                                categoryHeader.className = 'search-category';
                                categoryHeader.textContent = category;
                                searchDropdown.appendChild(categoryHeader);
                                
                                items.forEach(item => {
                                    const itemEl = document.createElement('a');
                                    itemEl.href = item.url;
                                    itemEl.className = 'search-item';
                                    itemEl.innerHTML = `
                                        <div class="search-item-icon">
                                            <i class="fa-solid ${item.icon}"></i>
                                        </div>
                                        <div class="search-item-text">
                                            <div class="search-item-title">${item.title}</div>
                                            <div class="search-item-subtitle">${item.subtitle}</div>
                                        </div>
                                    `;
                                    searchDropdown.appendChild(itemEl);
                                });
                            }
                        }
                        
                        searchDropdown.classList.add('show');
                    })
                    .catch(err => console.error('Search error:', err));
            }, 300);
        });
        
        document.addEventListener('click', function(e) {
            if (!searchContainer.contains(e.target)) {
                searchDropdown.classList.remove('show');
            }
        });
    }

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

    // ==========================================
    // REAL-TIME WEBSOCKET LISTENER
    // ==========================================
    
    window.createToast = function(message, type = 'info') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        if (type === 'error') iconClass = 'fa-exclamation-circle';

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fa-solid ${iconClass}"></i>
            </div>
            <div class="toast-content">${message}</div>
            <button class="close-toast"><i class="fa-solid fa-xmark"></i></button>
            <div class="toast-progress"></div>
        `;
        
        container.appendChild(toast);
        
        const autoDismissTimer = setTimeout(() => {
            if (!toast.classList.contains('hiding')) {
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);

        const closeBtn = toast.querySelector('.close-toast');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                clearTimeout(autoDismissTimer);
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300);
            });
        }
    };

    let refreshTimeout = null;
    function triggerSmoothRefresh() {
        // Debounce allows multiple rapid real-time updates to batch into a single smooth refresh
        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
            fetch(window.location.href)
                .then(res => res.text())
                .then(html => {
                    const parser = new DOMParser();
                    const newDoc = parser.parseFromString(html, 'text/html');
                    
                    const sections = [
                        '.table-container', '.stats-grid', '.audit-list', 
                        '.table-card', '.iam-grid', '.folder-grid', '.pagination'
                    ];
                    
                    sections.forEach(selector => {
                        const currentEl = document.querySelector(selector);
                        const newEl = newDoc.querySelector(selector);
                        if (currentEl && newEl) {
                            currentEl.innerHTML = newEl.innerHTML;
                        }
                    });
                })
                .catch(err => console.error("Error smoothly updating content:", err));
        }, 500); 
    }

    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const documentSocket = new WebSocket(wsProtocol + window.location.host + '/ws/documents/');

        documentSocket.onopen = function() {
            console.log('✅ Real-time WebSocket connected successfully!');
        };

        documentSocket.onmessage = function(e) {
            const response = JSON.parse(e.data);
            
            if (response.type === 'new_document' || response.type === 'system_update') {
                
                let msg = '';
                if (response.type === 'new_document') {
                    msg = `A new document (${response.data.document_number}) was just uploaded!`;
                } else if (response.type === 'system_update') {
                    const action = response.data.action || 'updated';
                    const user = response.data.user || 'System';
                    msg = `System update by ${user}: ${response.data.details || action}`;
                }
                
                createToast(msg, 'info');
                
                // Trigger smooth UI refresh
                triggerSmoothRefresh();
                
                // Optionally, trigger a fetch for notifications so the bell icon updates instantly
                if (typeof fetchNotifications === 'function') {
                    fetchNotifications();
                }
            }
        };

        documentSocket.onclose = function(e) {
            console.error('❌ WebSocket closed unexpectedly. Retrying in 3 seconds...');
            setTimeout(connectWebSocket, 3000); // Auto-reconnect if it fails
        };
    }

    // Initialize the connection
    connectWebSocket();
});