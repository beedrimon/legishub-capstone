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
        reviewUpload: document.getElementById('reviewUploadModal'),
        progress: document.getElementById('progressModal'),
        progressDetail: document.getElementById('progressDetailModal'),
        editProgress: document.getElementById('editProgressModal')
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
                            if (name === 'co_sponsors') {
                                const container = input.closest('.form-group');
                                if (container && typeof container.setCoSponsors === 'function') {
                                    container.setCoSponsors(data[name]);
                                }
                            }
                        }
                    }
                    if (typeof handleDateInputs === 'function') {
                        handleDateInputs();
                    }
                    return true;
                } else {
                    localStorage.removeItem(key);
                }
            } catch(e) {
                localStorage.removeItem(key);
            }
        }
        if (typeof handleDateInputs === 'function') {
            handleDateInputs();
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

    // Style date inputs like placeholders when empty
    const handleDateInputs = () => {
        document.querySelectorAll('input[type="date"]').forEach(input => {
            const toggleDateColor = () => {
                if (input.value) {
                    input.classList.add('has-value');
                } else {
                    input.classList.remove('has-value');
                }
            };
            if (!input.dataset.colorBound) {
                input.addEventListener('change', toggleDateColor);
                input.addEventListener('input', toggleDateColor);
                input.dataset.colorBound = 'true';
            }
            toggleDateColor();
        });
    };
    handleDateInputs();

    setupTrigger('.trigger-upload-new', 'uploadNew', 'uploadNewForm');
    setupTrigger('.trigger-upload-existing', 'uploadExisting', 'uploadExistingForm');
    setupTrigger('.trigger-edit', 'edit');
    setupTrigger('.trigger-user', 'user');
    setupTrigger('.trigger-edit-user', 'editUser');
    setupTrigger('.trigger-progress', 'progress');


    // Add this function to modals.js
function clearDraftAndReset(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    // Clear the draft from localStorage
    clearDraft(formId);
    
    // Reset the form to its initial state
    form.reset();
    
    // Reset date input colors
    if (typeof handleDateInputs === 'function') {
        handleDateInputs();
    }
    
    // Reset file inputs
    const fileInputs = form.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.value = '';
        const uploadArea = input.closest('.upload-area');
        if (uploadArea) {
            const uploadText = uploadArea.querySelector('p');
            const uploadSpan = uploadArea.querySelector('span');
            if (uploadText) {
                uploadText.innerHTML = 'Upload Certified PDF Copy';
            }
            if (uploadSpan) {
                uploadSpan.innerText = 'Click here to browse files (Max 20MB)';
            }
        }
    });
    
    // Reset co-sponsors if any
    const container = form.querySelector('[id$="-sponsors-container"]');
    if (container && typeof container.setCoSponsors === 'function') {
        container.setCoSponsors('');
    }
    
    // Reset select fields
    const selects = form.querySelectorAll('select');
    selects.forEach(select => {
        // Reset to the first option (which should be the placeholder)
        const firstOption = select.querySelector('option[selected]');
        if (firstOption) {
            select.value = firstOption.value;
        } else {
            select.selectedIndex = 0;
        }
        // Trigger change event to update any dependent UI
        select.dispatchEvent(new Event('change'));
    });
}
window.clearDraftAndReset = clearDraftAndReset;

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
        // In the confirmUploadBtn click handler, update to clear drafts:
    confirmUploadBtn.addEventListener('click', function() {
    if (activeUploadForm) {
        this.innerHTML = 'Uploading... <i class="fa-solid fa-spinner fa-spin"></i>';
        this.style.pointerEvents = 'none';
        this.style.opacity = '0.7';

        const formId = activeUploadForm.id;
        const docId = formId === 'editDocumentForm' ? document.getElementById('edit-doc-id')?.value : null;
        
        // Clear the draft before submitting
        clearDraft(formId, docId);
        
        // Also clear any localStorage for this form
        const key = DRAFT_KEYS[formId];
        if (key) {
            const storageKey = docId ? `${key}_${docId}` : key;
            localStorage.removeItem(storageKey);
        }

        activeUploadForm.submit();
    }
});

    const backToEditBtn = document.getElementById('backToEditBtn');
    if (backToEditBtn) {
        backToEditBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (modals.reviewUpload) modals.reviewUpload.style.display = 'none';
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
            if (closeBtn.id === 'backToEditBtn' || closeBtn.innerText.includes('Clear Data')) return;

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

                if (isDirty) {
                // Ask user if they want to discard the draft
                if (confirm("Are you sure you want to discard this draft? Any unsaved changes will be lost.")) {
                    // Clear the draft from localStorage
                    const formId = form ? form.id : null;
                    if (formId && DRAFT_KEYS[formId]) {
                        clearDraft(formId);
                        // Reset the form
                        form.reset();
                    }
                    closeAllOverlays();
                }
                // If they click Cancel, don't close the modal
                return;
            }
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
        });
    }

    // ==========================================
    // UNIFIED AJAX FETCH LOGIC & INFINITE SCROLL
    // ==========================================
    let currentNotifLimit = 10;
    let isInitialNotifLoad = true;

    function fetchNotifications() {
        const notifBody = document.getElementById('notifModalBody');

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

                isInitialNotifLoad = false;

                if (notifBody && data.notifications) {
                    let htmlContent = '';

                    const lastReadId = parseInt(localStorage.getItem('lastReadNotifId')) || 0;
                    const individuallyReadIds = JSON.parse(localStorage.getItem('individuallyReadIds')) || [];

                    window.highestNotifId = data.notifications.length > 0 ? Math.max(...data.notifications.map(n => n.id)) : 0;

                    if (data.notifications.length > 0) {
                        htmlContent += `<div class="notif-section-title">Recent Activity</div>`;

                        data.notifications.forEach((notif) => {
                            let iconClass = 'fa-desktop';
                            if (notif.message.includes('Upload')) iconClass = 'fa-file-invoice';
                            else if (notif.message.includes('Updated') || notif.message.includes('modified')) iconClass = 'fa-file-signature';

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

                        const unreadItemsCount = data.notifications.filter(n => n.id > lastReadId && !individuallyReadIds.includes(n.id)).length;
                        if (notifBadge) {
                            if (unreadItemsCount > 0) {
                                notifBadge.style.display = 'flex';
                                notifBadge.innerText = unreadItemsCount >= 10 ? '10+' : unreadItemsCount;
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
                    let individuallyReadIds = JSON.parse(localStorage.getItem('individuallyReadIds')) || [];
                    if (!individuallyReadIds.includes(notifId)) {
                        individuallyReadIds.push(notifId);
                        localStorage.setItem('individuallyReadIds', JSON.stringify(individuallyReadIds));
                    }

                    notifItem.classList.remove('unread');
                    notifItem.classList.add('read');
                    const blueDot = notifItem.querySelector('.unread-dot');
                    if (blueDot) blueDot.style.display = 'none';
                    const redDot = notifItem.querySelector('.red-dot');
                    if (redDot) redDot.style.display = 'none';

                    const remainingUnread = notifModalBody.querySelectorAll('.notif-list-item.unread').length;
                    const notifBadge = document.querySelector('.notif-badge');
                    if (notifBadge) {
                        if (remainingUnread === 0) {
                            notifBadge.style.display = 'none';
                        } else {
                            notifBadge.innerText = remainingUnread >= 10 ? '10+' : remainingUnread;
                        }
                    }

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
            if (e.target.closest('a')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            profileBtn.classList.toggle('show');
        });
    }

    // 6. Global Click Listener
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal-overlay')) {
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
                    if (!confirm("Are you sure you want to close? Your inputs will be kept here in the background.")) {
                        return;
                    }
                }
            }
            closeAllOverlays();
        }

        if (uploadDropdownWrapper && !uploadDropdownWrapper.contains(event.target)) {
            uploadDropdownWrapper.classList.remove('show');
        }

        if (notifDropdown &&
            !notifDropdown.contains(event.target) &&
            bell && !bell.contains(event.target)) {
            notifDropdown.style.display = 'none';
        }
        
        if (profileBtn && !profileBtn.contains(event.target)) {
            profileBtn.classList.remove('show');
        }
    });

    // ==========================================
    // FILE UPLOAD UI FEEDBACK
    // ==========================================
    document.addEventListener('change', function (e) {
        if (e.target && e.target.type === 'file') {
            const fileInput = e.target;
            const uploadArea = fileInput.closest('.upload-area');

            if (uploadArea) {
                const uploadText = uploadArea.querySelector('p');
                const uploadSpan = uploadArea.querySelector('span');

                if (uploadText) {
                    if (fileInput.files && fileInput.files.length > 0) {
                        if (!uploadArea.hasAttribute('data-default-html')) {
                            uploadArea.setAttribute('data-default-html', uploadText.innerHTML);
                            if (uploadSpan) uploadArea.setAttribute('data-default-span', uploadSpan.innerText);
                        }

                        uploadText.innerHTML = `File attached: <strong style="color: #22C55E;">${fileInput.files[0].name}</strong>`;
                        if (uploadSpan) uploadSpan.innerText = 'Ready to upload';
                    } else {
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
// CUSTOM VIEW MODAL HANDLER
// ==========================================
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.trigger-view');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    // Close all other overlays
    closeAllOverlays();

    // Show the view modal
    const viewModal = document.getElementById('viewModal');
    if (!viewModal) return;
    viewModal.style.display = 'flex';

    // ---- Populate left‑side metadata ----
    const docId = btn.getAttribute('data-id');
    const docNumber = btn.getAttribute('data-number');
    const docTitle = btn.getAttribute('data-title');
    const docType = btn.getAttribute('data-type');
    const docYear = btn.getAttribute('data-year');
    const docDate = btn.getAttribute('data-date');
    const docSponsor = btn.getAttribute('data-sponsor');
    const docKeywords = btn.getAttribute('data-keywords');
    const docCosponsors = btn.getAttribute('data-cosponsors');

    document.getElementById('view-number').textContent = docNumber || 'N/A';
    document.getElementById('view-title').textContent = docTitle || 'Untitled';
    document.getElementById('view-type').textContent = docType || 'N/A';
    document.getElementById('view-ref-no').textContent = docNumber || 'N/A';
    document.getElementById('view-year').textContent = docYear || 'N/A';
    document.getElementById('view-date').textContent = docDate || 'N/A';
    document.getElementById('view-sponsor').textContent = docSponsor || 'Not specified';
    document.getElementById('view-committee').textContent = docCosponsors || 'Not specified';
    document.getElementById('view-abstract').textContent = docKeywords || 'No abstract provided.';

    // ---- Store basic details for sharing ----
    viewModal.setAttribute('data-current-doc-id', docId || '');
    viewModal.setAttribute('data-current-doc-number', docNumber || '');
    viewModal.setAttribute('data-current-doc-title', docTitle || '');
    viewModal.removeAttribute('data-active-progress-id');
    viewModal.removeAttribute('data-active-progress-status');
    viewModal.removeAttribute('data-active-progress-date');
    viewModal.removeAttribute('data-active-progress-note');

    const statusMsg = document.getElementById('share-email-status');
    const emailInput = document.getElementById('share-recipient-email');
    if (statusMsg) statusMsg.innerText = '';
    if (emailInput) emailInput.value = '';

    // ---- Load progress timeline and auto‑show latest details ----
    const pdfIframe = document.getElementById('view-pdf-iframe');
    const pdfMissing = document.getElementById('view-pdf-missing');
    const mainFileUrl = btn.getAttribute('data-file');

    // Fetch progress data to build timeline and auto‑show latest
    fetch(`/api/document-progress/?doc_id=${docId}`)
        .then(response => response.json())
        .then(data => {
            let latestProgress = null;
            let latestWithFile = null;

            if (data.progress && data.progress.length > 0) {
                // Sort by ID descending to get the most recent first
                const sorted = [...data.progress].sort((a, b) => b.id - a.id);
                latestProgress = sorted[0]; // the newest overall
                // Find the first with a file attachment (for PDF)
                latestWithFile = sorted.find(p => p.file_attachment && p.file_attachment.trim() !== '' && p.file_attachment !== 'null');
            }

            // ---- Build the timeline (bookmarks) ----
            const timeline = document.getElementById('progressTimeline');
            if (timeline) {
                if (data.progress && data.progress.length > 0) {
                    timeline.innerHTML = '';
                    const sorted = [...data.progress].sort((a, b) => b.id - a.id); // descending
                    const currentStatus = latestProgress ? latestProgress.status : null;
                    const darkBrown = '#7c5c35';
                    const lightBrown = '#d9c8ac';
                    const textLight = '#6b5a4a';

                    sorted.forEach((item) => {
                        const isCurrent = item.id === (latestProgress ? latestProgress.id : null);
                        const wrapper = document.createElement('div');
                        wrapper.className = 'bookmark-item';
                        wrapper.style.display = 'flex';
                        wrapper.style.alignItems = 'stretch';
                        wrapper.style.marginBottom = '0';
                        wrapper.style.position = 'relative';

                        const button = document.createElement('button');
                        button.type = 'button';
                        button.className = 'progress-bookmark';
                        button.dataset.progressId = item.id;
                        button.dataset.status = item.status || '';
                        button.dataset.updateDate = item.update_date || '';
                        button.dataset.note = item.note || 'No note provided.';
                        button.style.display = 'flex';
                        button.style.flexDirection = 'column';
                        button.style.alignItems = 'flex-start';
                        button.style.justifyContent = 'center';
                        button.style.background = isCurrent ? darkBrown : lightBrown;
                        button.style.color = isCurrent ? 'white' : textLight;
                        button.style.border = 'none';
                        button.style.borderRadius = '4px 0 0 4px';
                        button.style.padding = '8px 14px 8px 16px';
                        button.style.fontSize = '0.75rem';
                        button.style.fontWeight = isCurrent ? '700' : '600';
                        button.style.cursor = 'pointer';
                        button.style.transition = 'all 0.2s';
                        button.style.width = '100%';
                        button.style.textAlign = 'left';
                        button.style.boxShadow = isCurrent ? '0 2px 8px rgba(124,92,53,0.25)' : 'none';
                        button.style.position = 'relative';
                        button.style.minHeight = '48px';
                        button.style.flex = '1';
                        button.style.borderRight = `3px solid ${isCurrent ? darkBrown : 'transparent'}`;

                        const statusText = document.createElement('span');
                        statusText.style.fontSize = '0.8rem';
                        statusText.style.fontWeight = isCurrent ? '700' : '600';
                        statusText.style.marginBottom = '2px';
                        statusText.textContent = item.status.toUpperCase();
                        button.appendChild(statusText);

                        const dateText = document.createElement('span');
                        dateText.style.fontSize = '0.55rem';
                        dateText.style.opacity = '0.8';
                        dateText.style.fontWeight = '400';
                        dateText.textContent = item.update_date;
                        button.appendChild(dateText);

                        button.addEventListener('click', () => showProgressDetail(button));
                        wrapper.appendChild(button);

                        const marker = document.createElement('div');
                        marker.style.width = isCurrent ? '6px' : '4px';
                        marker.style.background = isCurrent ? darkBrown : lightBrown;
                        marker.style.borderRadius = isCurrent ? '0 4px 4px 0' : '0 3px 3px 0';
                        marker.style.flexShrink = '0';
                        wrapper.appendChild(marker);

                        timeline.appendChild(wrapper);
                    });

                    // Scroll to top to show latest
                    const firstBookmark = timeline.querySelector('.bookmark-item:first-child');
                    if (firstBookmark) {
                        setTimeout(() => {
                            firstBookmark.scrollIntoView({ block: 'start', behavior: 'smooth' });
                        }, 100);
                    }
                } else {
                    timeline.innerHTML = `
                        <div style="color: var(--text-light); font-size: 0.75rem; padding: 20px 10px; text-align: center;">
                            <i class="fa-regular fa-clock"></i> No progress yet.
                        </div>
                    `;
                }
            }

            // ---- Auto‑show details for the latest progress ----
            if (latestProgress) {
                // Populate the detail display panel
                const detailDisplay = document.getElementById('progressDetailDisplay');
                if (detailDisplay) {
                    detailDisplay.style.display = 'block';
                    document.getElementById('pd-date').textContent = latestProgress.update_date || 'N/A';
                    document.getElementById('pd-status').textContent = latestProgress.status ? latestProgress.status.toUpperCase() : 'N/A';
                    document.getElementById('pd-note').textContent = latestProgress.note || 'No note provided.';
                }

                // Set active progress ID on modal
                viewModal.setAttribute('data-active-progress-id', latestProgress.id);
                viewModal.setAttribute('data-active-progress-status', latestProgress.status);
                viewModal.setAttribute('data-active-progress-date', latestProgress.update_date);
                viewModal.setAttribute('data-active-progress-note', latestProgress.note);

                // Show file attachment (if any)
                const fileContainer = document.getElementById('pd-file');
                if (fileContainer) {
                    if (latestProgress.file_attachment) {
                        const safeUrl = escapeHtmlAttribute(latestProgress.file_attachment);
                        fileContainer.innerHTML = `
                            <a href="${safeUrl}" target="_blank" style="color: var(--sidebar-bg); text-decoration: none; font-weight: 600;">
                                <i class="fa-regular fa-file-pdf"></i> View Attached File
                            </a>
                        `;
                    } else {
                        fileContainer.innerHTML = `<span style="color: var(--text-light); font-style: italic;">No file attached.</span>`;
                    }
                }

                // Highlight the corresponding bookmark (already done via isCurrent logic)
                // No need to call showProgressDetail, details are already shown.
            } else {
                // No progress at all – hide detail panel
                const detailDisplay = document.getElementById('progressDetailDisplay');
                if (detailDisplay) detailDisplay.style.display = 'none';
            }

            // ---- PDF preview: use the latest progress with a file, or fallback to main ----
            const fileUrl = latestWithFile ? latestWithFile.file_attachment : mainFileUrl;
            viewModal.setAttribute('data-current-file-url', fileUrl || '');

            if (pdfIframe && pdfMissing) {
                if (fileUrl && fileUrl.trim() !== '' && fileUrl !== 'None' && fileUrl !== 'null') {
                    pdfIframe.src = fileUrl + '#view=FitH';
                    pdfIframe.style.display = 'block';
                    pdfMissing.style.display = 'none';
                    console.log('PDF loaded from:', fileUrl);
                } else {
                    pdfIframe.src = '';
                    pdfIframe.style.display = 'none';
                    pdfMissing.style.display = 'block';
                    pdfMissing.innerHTML = '<i class="fa-regular fa-file-pdf"></i> No PDF document attached.';
                }
            }
        })
        .catch(error => {
            console.error('Error loading progress:', error);
            // Fallback: show main PDF if progress fetch fails
            if (pdfIframe && pdfMissing) {
                if (mainFileUrl && mainFileUrl.trim() !== '' && mainFileUrl !== 'None' && mainFileUrl !== 'null') {
                    pdfIframe.src = mainFileUrl + '#view=FitH';
                    pdfIframe.style.display = 'block';
                    pdfMissing.style.display = 'none';
                    viewModal.setAttribute('data-current-file-url', mainFileUrl);
                } else {
                    pdfIframe.src = '';
                    pdfIframe.style.display = 'none';
                    pdfMissing.style.display = 'block';
                    pdfMissing.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Failed to load PDF.';
                }
            }
            // Show empty timeline
            const timeline = document.getElementById('progressTimeline');
            if (timeline) {
                timeline.innerHTML = `
                    <div style="color: #dc3545; font-size: 0.75rem; padding: 10px; text-align: center;">
                        <i class="fa-solid fa-exclamation-triangle"></i> Failed to load.
                    </div>
                `;
            }
        });
});
    
    // ==========================================
    // POPULATE EDIT MODAL
    // ==========================================
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.trigger-edit');
        if (btn) {
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

            const editDocId = document.getElementById('edit-doc-id');
            const editNumber = document.getElementById('edit-number');
            const editTitle = document.getElementById('edit-title');
            const editType = document.getElementById('edit-type');
            const editYear = document.getElementById('edit-year');
            const editDate = document.getElementById('edit-date');
            const editSponsor = document.getElementById('edit-sponsor');
            const editCoSponsors = document.getElementById('edit-co-sponsors');
            const editKeywords = document.getElementById('edit-keywords');
            const editStatus = document.getElementById('edit-status');
            const editVisibility = document.getElementById('edit-visibility');
            const editPhysicalStorage = document.getElementById('edit-physical-storage');

            if (editDocId) editDocId.value = docId;
            if (editNumber) editNumber.value = docNumber;
            if (editTitle) editTitle.value = docTitle;
            if (editType) editType.value = docType;
            if (editYear) editYear.value = docYear;
            if (editDate) editDate.value = docDate;
            if (editSponsor) editSponsor.value = docSponsor || '';
            if (editCoSponsors) editCoSponsors.value = docCoSponsors || '';
            if (editKeywords) editKeywords.value = docKeywords || '';
            if (editStatus) editStatus.value = docStatus || 'Pending';
            if (editVisibility) editVisibility.value = docVisibility || 'Public Access';
            if (editPhysicalStorage) editPhysicalStorage.value = docStorage || '';

            // Populate co-sponsors dynamically in the Edit modal
            const editDocSponsorsContainer = document.getElementById('edit-doc-sponsors-container');
            if (editDocSponsorsContainer && typeof editDocSponsorsContainer.setCoSponsors === 'function') {
                editDocSponsorsContainer.setCoSponsors(docCoSponsors || '');
            }
            const editVetoSponsorsContainer = document.getElementById('edit-veto-sponsors-container');
            if (editVetoSponsorsContainer && typeof editVetoSponsorsContainer.setCoSponsors === 'function') {
                editVetoSponsorsContainer.setCoSponsors(docCoSponsors || '');
            }

            // Disable already used statuses in Edit Modal, except current status (with grayed-out styles)
            const editStatusSelect = document.getElementById('edit-status');
            if (editStatusSelect) {
                // Enable all first
                Array.from(editStatusSelect.options).forEach(opt => {
                    opt.disabled = false;
                    opt.style.color = '';
                });

                fetch(`/api/document-progress/?doc_id=${docId}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.progress) {
                            const usedStatuses = data.progress.map(p => p.status.toLowerCase().trim());
                            Array.from(editStatusSelect.options).forEach(opt => {
                                const optValue = opt.value.toLowerCase().trim();
                                if (optValue && opt.value !== docStatus && usedStatuses.includes(optValue)) {
                                    opt.disabled = true;
                                    opt.style.color = '#a0a0a0';
                                }
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching progress for edit validation:', err));
            }

            if (document.getElementById('edit-veto-reason')) {
                document.getElementById('edit-veto-reason').value = vetoReason || '';
            }

            const fileText = document.getElementById('edit-file-text');
            const uploadArea = fileText ? fileText.closest('.upload-area') : null;
            const uploadSpan = uploadArea ? uploadArea.querySelector('span') : null;

            if (fileText) {
                if (fileName && fileName !== 'None' && fileName !== 'null' && fileName.trim() !== '') {
                    const cleanName = fileName.split('/').pop();
                    fileText.innerHTML = `Current File: <strong>${cleanName}</strong>`;
                    if (uploadSpan) uploadSpan.innerText = 'Click to browse or replace file';
                } else {
                    fileText.innerHTML = `Current File: <strong style="color: #888;">No file attached</strong>`;
                    if (uploadSpan) uploadSpan.innerText = 'Click to browse or drag and drop';
                }
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

            const editUserId = document.getElementById('edit-user-id');
            const editUserFirst = document.getElementById('edit-user-first');
            const editUserLast = document.getElementById('edit-user-last');
            const editUserEmail = document.getElementById('edit-user-email');
            const editUserUsername = document.getElementById('edit-user-username');

            if (editUserId) editUserId.value = userId;
            if (editUserFirst) editUserFirst.value = userFirst;
            if (editUserLast) editUserLast.value = userLast;
            if (editUserEmail) editUserEmail.value = userEmail;
            if (editUserUsername) editUserUsername.value = userUsername;
            if (document.getElementById('edit-user-role')) {
                document.getElementById('edit-user-role').value = userRole;
            }
        }
    });

    // ==========================================
    // PASSWORD VISIBILITY TOGGLE
    // ==========================================
    const togglePassword = document.querySelector('#togglePassword');
    const passwordInput = document.querySelector('#password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
            this.classList.toggle('fa-eye');
        });
    }

    // ==========================================
    // UNIFIED DROPDOWN UI LOGIC
    // ==========================================
    const notifTabs = document.querySelectorAll('.notif-tab');
    const emptyState = document.getElementById('emptyNotifState');
    const sectionTitles = document.querySelectorAll('.notif-section-title');
    const loadMoreBtn = document.getElementById('loadMoreNotifsBtn');

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

    const notifEllipsis = document.getElementById('notifEllipsis');
    const notifOptionsMenu = document.getElementById('notifOptionsMenu');
    if (notifEllipsis && notifOptionsMenu) {
        notifEllipsis.addEventListener('click', function (e) {
            e.stopPropagation();
            notifOptionsMenu.style.display = notifOptionsMenu.style.display === 'block' ? 'none' : 'block';
        });
    }

    const markAllReadBtn = document.querySelector('.mark-all-read-btn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', function (e) {
            e.stopPropagation();

            if (window.highestNotifId) {
                localStorage.setItem('lastReadNotifId', window.highestNotifId);
                localStorage.removeItem('individuallyReadIds');
            }

            const notifBadge = document.querySelector('.notif-badge');
            if (notifBadge) notifBadge.style.display = 'none';

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

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const originalText = this.innerHTML;
            this.innerHTML = 'Loading... <i class="fa-solid fa-spinner fa-spin" style="margin-left: 5px;"></i>';
            this.style.pointerEvents = 'none';
            this.style.opacity = '0.7';

            currentNotifLimit += 10;

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
    // TOAST NOTIFICATION LOGIC
    // ==========================================
    const toasts = document.querySelectorAll('.toast');
    toasts.forEach(toast => {
        const autoDismissTimer = setTimeout(() => {
            if (toast && !toast.classList.contains('hiding')) {
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

    // Hide skeleton loader on page load/show
    window.addEventListener('pageshow', function() {
        if (skeletonOverlay && skeletonOverlay.classList.contains('show')) {
            skeletonOverlay.classList.remove('show');
        }
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
    function triggerSmoothRefresh(onCompleteCallback) {
        return new Promise((resolve) => {
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
                        
                        if (typeof onCompleteCallback === 'function') {
                            onCompleteCallback();
                        }
                        resolve();
                    })
                    .catch(err => {
                        console.error("Error smoothly updating content:", err);
                        resolve();
                    });
            }, 500); 
        });
    }

    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const documentSocket = new WebSocket(wsProtocol + window.location.host + '/ws/documents/');

        documentSocket.onopen = function() {
            console.log('Real-time WebSocket connected successfully!');
        };

        documentSocket.onmessage = function(e) {
            const response = JSON.parse(e.data);
            
            if (['new_document', 'document_updated', 'document_deleted', 'system_update'].includes(response.type)) {
                let msg = '';
                let toastType = 'info';
                
                if (response.type === 'new_document') {
                    msg = `A new document (${response.data.document_number}) was just uploaded!`;
                    toastType = 'success';
                    createToast(msg, toastType);
                    
                    triggerSmoothRefresh(() => {
                        const newRow = document.querySelector(`tr[data-doc-number="${response.data.document_number}"], tr[data-doc-id="${response.data.id}"]`);
                        if (newRow) {
                            newRow.classList.add('realtime-flash-success');
                        }
                    });
                } 
                else if (response.type === 'document_updated') {
                    msg = `Document (${response.data.document_number}) was updated.`;
                    createToast(msg, 'info');
                    
                    triggerSmoothRefresh(() => {
                        const updatedRow = document.querySelector(`tr[data-doc-number="${response.data.document_number}"], tr[data-doc-id="${response.data.id}"]`);
                        if (updatedRow) {
                            updatedRow.classList.add('realtime-flash-info');
                        }
                    });
                }
                else if (response.type === 'document_deleted') {
                    msg = `Document (${response.data.document_number}) was archived/removed.`;
                    createToast(msg, 'error');
                    
                    const rowToDelete = document.querySelector(`tr[data-doc-number="${response.data.document_number}"], tr[data-doc-id="${response.data.id}"]`);
                    if (rowToDelete) {
                        rowToDelete.classList.add('realtime-fade-out');
                        setTimeout(() => {
                            triggerSmoothRefresh();
                        }, 600);
                    } else {
                        triggerSmoothRefresh();
                    }
                }
                else if (response.type === 'system_update') {
                    const action = response.data.action || 'updated';
                    const user = response.data.user || 'System';
                    msg = `System update by ${user}: ${response.data.details || action}`;
                    
                    if (action === 'Backup') {
                        toastType = response.data.details.includes('success') || response.data.details.includes('Success') ? 'success' : 'error';
                    }
                    createToast(msg, toastType);
                    
                    triggerSmoothRefresh();
                }
                
                if (typeof fetchNotifications === 'function') {
                    fetchNotifications();
                }
            }
        };

        documentSocket.onclose = function(e) {
            console.error('WebSocket closed unexpectedly. Retrying in 3 seconds...');
            setTimeout(connectWebSocket, 3000);
        };
    }

    // Initialize WebSocket
    connectWebSocket();

    // ==========================================
    // SHARE VIA EMAIL LOGIC
    // ==========================================
    document.addEventListener('click', function(e) {
        const shareBtn = e.target.closest('#btn-share-email');
        if (shareBtn) {
            e.preventDefault();
            e.stopPropagation();

            const viewModal = document.getElementById('viewModal');
            if (!viewModal) return;

            const emailInput = document.getElementById('share-recipient-email');
            const statusMsg = document.getElementById('share-email-status');
            if (!emailInput || !statusMsg) return;

            const email = emailInput.value.trim();
            const docId = viewModal.getAttribute('data-current-doc-id');
            const docNumber = viewModal.getAttribute('data-current-doc-number');
            const fileUrl = viewModal.getAttribute('data-current-file-url');

            // Client side validation
            if (!email) {
                showShareStatus('Please enter a recipient email address.', 'error');
                return;
            }

            // Simple email regex validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showShareStatus('Please enter a valid email address.', 'error');
                return;
            }

            if (!docId) {
                showShareStatus('Error: Document details not found.', 'error');
                return;
            }

            // Check if document has a PDF file
            const hasFile = fileUrl && fileUrl.trim() !== '' && fileUrl !== 'None' && fileUrl !== 'null';
            if (!hasFile) {
                showShareStatus('This document does not have a PDF file attached to it.', 'error');
                return;
            }

            // Disable button during send
            shareBtn.disabled = true;
            const originalText = shareBtn.innerHTML;
            shareBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sharing...';
            showShareStatus('Sending request...', 'info');

            // Retrieve CSRF token
            const csrfTokenInput = document.querySelector('[name=csrfmiddlewaretoken]');
            const csrfToken = csrfTokenInput ? csrfTokenInput.value : '';

            fetch('/api/share-document/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    email: email,
                    doc_id: docId,
                    doc_number: docNumber
                })
            })
            .then(response => {
                return response.json().then(data => {
                    if (response.ok) {
                        return data;
                    } else {
                        throw new Error(data.message || 'Failed to share document.');
                    }
                });
            })
            .then(data => {
                showShareStatus(data.message || 'Email has been queued and will be sent shortly.', 'success');
                emailInput.value = '';
            })
            .catch(error => {
                console.error('Error sharing document:', error);
                showShareStatus(error.message || 'An error occurred while sharing the document.', 'error');
            })
            .finally(() => {
                shareBtn.disabled = false;
                shareBtn.innerHTML = originalText;
            });

            function showShareStatus(message, type) {
                statusMsg.innerText = message;
                if (type === 'success') {
                    statusMsg.style.color = '#22C55E'; // green
                } else if (type === 'error') {
                    statusMsg.style.color = '#EF4444'; // red
                } else {
                    statusMsg.style.color = '#6B7280'; // gray (info)
                }
            }
        }
    });

    // Auto-open detailed view modal if view_doc_id is present in URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const viewDocId = urlParams.get('view_doc_id');
    if (viewDocId) {
        // Wait briefly for all click listeners to be bound before clicking
        setTimeout(() => {
            const viewButton = document.querySelector(`.trigger-view[data-id="${viewDocId}"]`);
            if (viewButton) {
                viewButton.click();
            }
        }, 100);
    }

    // Initialize dynamic sponsor rows
    initDynamicSponsors('upload-new-sponsors-container', '.btn-add-sponsor-row', '.additional-sponsors-wrapper', 'upload-new-co-sponsors');
    initDynamicSponsors('upload-existing-sponsors-container', '.btn-add-sponsor-row', '.additional-sponsors-wrapper', 'upload-existing-co-sponsors');
    initDynamicSponsors('edit-doc-sponsors-container', '.btn-add-sponsor-row', '.additional-sponsors-wrapper', 'edit-co-sponsors');
    initDynamicSponsors('edit-veto-sponsors-container', '.btn-add-sponsor-row', '.additional-sponsors-wrapper', 'edit-co-sponsors');

    ['uploadNewForm', 'uploadExistingForm', 'editDocumentForm', 'editVetoedForm'].forEach(formId => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('reset', () => {
                const container = form.querySelector('[id$="-sponsors-container"]');
                if (container && typeof container.setCoSponsors === 'function') {
                    setTimeout(() => container.setCoSponsors(''), 10);
                }
            });
        }
    });
}
}); // END OF DOMContentLoaded


// ==========================================
// GLOBAL FUNCTIONS OUTSIDE DOMContentLoaded
// ==========================================

// ==========================================
// LOAD PROGRESS TIMELINE (Bookmark Style)
// ==========================================
function escapeHtmlAttribute(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function loadProgressTimeline(docId) {
    const timeline = document.getElementById('progressTimeline');
    const detailDisplay = document.getElementById('progressDetailDisplay');
    
    if (detailDisplay) detailDisplay.style.display = 'none';
    if (!timeline) return;
    
    timeline.innerHTML = `
        <div style="color: var(--text-light); font-size: 0.75rem; padding: 20px 10px; text-align: center;">
            <i class="fa-solid fa-spinner fa-spin"></i> Loading...
        </div>
    `;
    
    fetch(`/api/document-progress/?doc_id=${docId}`)
        .then(response => response.json())
        .then(data => {
            console.log('Progress list API response:', data);
            
            if (data.progress && data.progress.length > 0) {
                timeline.innerHTML = '';

                // Sort by ID descending – newest (most recent ID) at top
                const sorted = [...data.progress].sort((a, b) => b.id - a.id);
                const latest = sorted[0]; // the first is the most recent
                const currentStatus = latest ? latest.status : null;
                
                console.log('Sorted progress items (by ID descending):', sorted);
                console.log('Latest/current status:', currentStatus);
                
                const darkBrown = '#7c5c35';
                const lightBrown = '#d9c8ac';
                const textLight = '#6b5a4a';

                sorted.forEach((item) => {
                    const isCurrent = item.status === currentStatus;
                    console.log(`Creating button for progress ID ${item.id}: status=${item.status}, hasFile=${!!item.file_attachment}`);
                    
                    const wrapper = document.createElement('div');
                    wrapper.className = 'bookmark-item';
                    wrapper.style.display = 'flex';
                    wrapper.style.alignItems = 'stretch';
                    wrapper.style.marginBottom = '0';
                    wrapper.style.position = 'relative';

                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'progress-bookmark';
                    button.dataset.progressId = item.id;
                    button.dataset.status = item.status || '';
                    button.dataset.updateDate = item.update_date || '';
                    button.dataset.note = item.note || 'No note provided.';
                    button.style.display = 'flex';
                    button.style.flexDirection = 'column';
                    button.style.alignItems = 'flex-start';
                    button.style.justifyContent = 'center';
                    button.style.background = isCurrent ? darkBrown : lightBrown;
                    button.style.color = isCurrent ? 'white' : textLight;
                    button.style.border = 'none';
                    button.style.borderRadius = '4px 0 0 4px';
                    button.style.padding = '8px 14px 8px 16px';
                    button.style.fontSize = '0.75rem';
                    button.style.fontWeight = isCurrent ? '700' : '600';
                    button.style.cursor = 'pointer';
                    button.style.transition = 'all 0.2s';
                    button.style.width = '100%';
                    button.style.textAlign = 'left';
                    button.style.boxShadow = isCurrent ? '0 2px 8px rgba(124,92,53,0.25)' : 'none';
                    button.style.position = 'relative';
                    button.style.minHeight = '48px';
                    button.style.flex = '1';
                    button.style.borderRight = `3px solid ${isCurrent ? darkBrown : 'transparent'}`;

                    // No "CURRENT - " prefix – just the status
                    const statusText = document.createElement('span');
                    statusText.style.fontSize = '0.8rem';
                    statusText.style.fontWeight = isCurrent ? '700' : '600';
                    statusText.style.marginBottom = '2px';
                    statusText.textContent = item.status.toUpperCase();
                    button.appendChild(statusText);

                    const dateText = document.createElement('span');
                    dateText.style.fontSize = '0.55rem';
                    dateText.style.opacity = '0.8';
                    dateText.style.fontWeight = '400';
                    dateText.textContent = item.update_date;
                    button.appendChild(dateText);

                    button.addEventListener('click', () => showProgressDetail(button));
                    wrapper.appendChild(button);

                    const marker = document.createElement('div');
                    marker.style.width = isCurrent ? '6px' : '4px';
                    marker.style.background = isCurrent ? darkBrown : lightBrown;
                    marker.style.borderRadius = isCurrent ? '0 4px 4px 0' : '0 3px 3px 0';
                    marker.style.flexShrink = '0';
                    wrapper.appendChild(marker);

                    timeline.appendChild(wrapper);
                });

                // Scroll to the top to show the latest (current) bookmark
                const currentBookmark = timeline.querySelector('.bookmark-item:first-child');
                if (currentBookmark) {
                    setTimeout(() => {
                        currentBookmark.scrollIntoView({ block: 'start', behavior: 'smooth' });
                    }, 100);
                }
            } else {
                timeline.innerHTML = `
                    <div style="color: var(--text-light); font-size: 0.75rem; padding: 20px 10px; text-align: center;">
                        <i class="fa-regular fa-clock"></i> No progress yet.
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading progress:', error);
            timeline.innerHTML = `
                <div style="color: #dc3545; font-size: 0.75rem; padding: 10px; text-align: center;">
                    <i class="fa-solid fa-exclamation-triangle"></i> Failed to load.
                </div>
            `;
        });
}

// ==========================================
// SHOW PROGRESS DETAIL - GLOBAL FUNCTION
// ==========================================
function showProgressDetail(btn) {
    console.log('Bookmark clicked! Function is working!');
    
    const darkBrown = '#7c5c35';
    const lightBrown = '#d9c8ac';
    const textLight = '#6b5a4a';
    
    // Reset all bookmarks – remove any "CURRENT - " prefix and reset styles
    document.querySelectorAll('.progress-bookmark').forEach(b => {
        b.style.background = lightBrown;
        b.style.color = textLight;
        b.style.boxShadow = 'none';
        b.style.borderRight = '3px solid transparent';
        b.style.transform = 'translateX(0)';
        b.style.fontWeight = '600';
        b.style.borderRadius = '4px 0 0 4px';
        
        const span = b.querySelector('span:first-child');
        if (span) {
            if (span.textContent.includes('CURRENT - ')) {
                span.textContent = span.textContent.replace('CURRENT - ', '');
            }
        }
    });
    
    // Highlight clicked bookmark – no "CURRENT" text added
    btn.style.background = darkBrown;
    btn.style.color = 'white';
    btn.style.boxShadow = '0 2px 8px rgba(124,92,53,0.35)';
    btn.style.borderRight = '4px solid #5c4330';
    btn.style.fontWeight = '700';
    btn.style.transform = 'translateX(-2px)';
    btn.style.borderRadius = '4px 0 0 4px';
    
    // Get data from button
    const status = btn.dataset.status || btn.getAttribute('data-status');
    const updateDate = btn.dataset.updateDate || btn.getAttribute('data-update-date');
    const note = btn.dataset.note || btn.getAttribute('data-note');
    const progressId = btn.dataset.progressId || btn.getAttribute('data-progress-id');
    
    // Update detail display
    const detailDisplay = document.getElementById('progressDetailDisplay');
    if (detailDisplay) {
        detailDisplay.style.display = 'block';
        document.getElementById('pd-date').textContent = updateDate || 'N/A';
        document.getElementById('pd-status').textContent = status ? status.toUpperCase() : 'N/A';
        document.getElementById('pd-note').textContent = note || 'No note provided.';
    }

    // Set active progress details on viewModal
    const viewModal = document.getElementById('viewModal');
    if (viewModal) {
        viewModal.setAttribute('data-active-progress-id', progressId || '');
        viewModal.setAttribute('data-active-progress-status', status || '');
        viewModal.setAttribute('data-active-progress-date', updateDate || '');
        viewModal.setAttribute('data-active-progress-note', note || '');
    }
    
    // Show loading placeholder while the API resolves the progress file URL
    const fileContainer = document.getElementById('pd-file');
    if (fileContainer) {
        fileContainer.innerHTML = `<span style="color: var(--text-light); font-style: italic;">Loading file preview...</span>`;
    }
    
    const pdfIframe = document.getElementById('view-pdf-iframe');
    const pdfMissing = document.getElementById('view-pdf-missing');
    const mainFileUrl = viewModal ? viewModal.getAttribute('data-current-file-url') : '';
    const hasMainFile = mainFileUrl && mainFileUrl.trim() !== '' && mainFileUrl !== 'None' && mainFileUrl !== 'null';

    if (pdfIframe && pdfMissing) {
        if (hasMainFile) {
            pdfIframe.src = mainFileUrl + '#view=FitH';
            pdfIframe.style.display = 'block';
            pdfMissing.style.display = 'none';
        } else {
            pdfIframe.src = '';
            pdfIframe.style.display = 'none';
            pdfMissing.style.display = 'block';
        }
    }

    console.log('Fetching progress detail for ID:', progressId);
    fetch(`/api/progress-detail/?id=${progressId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const fileUrl = data.progress.file_attachment;
                const fileContainer = document.getElementById('pd-file');
                const pdfIframe = document.getElementById('view-pdf-iframe');
                const pdfMissing = document.getElementById('view-pdf-missing');

                if (fileContainer) {
                    if (fileUrl) {
                        const safeFileUrl = escapeHtmlAttribute(fileUrl);
                        fileContainer.innerHTML = `
                            <a href="${safeFileUrl}" target="_blank" style="color: var(--sidebar-bg); text-decoration: none; font-weight: 600;">
                                <i class="fa-regular fa-file-pdf"></i> View Attached File
                            </a>
                        `;
                    } else {
                        fileContainer.innerHTML = `<span style="color: var(--text-light); font-style: italic;">No file attached.</span>`;
                    }
                }

                if (pdfIframe && pdfMissing) {
                    if (fileUrl) {
                        pdfIframe.src = fileUrl + '#view=FitH';
                        pdfIframe.style.display = 'block';
                        pdfMissing.style.display = 'none';
                        console.log('PDF loaded from progress detail:', fileUrl);
                    } else {
                        // Fallback to the main document PDF if progress has no file
                        if (hasMainFile) {
                            pdfIframe.src = mainFileUrl + '#view=FitH';
                            pdfIframe.style.display = 'block';
                            pdfMissing.style.display = 'none';
                            console.log('Fallback to main document PDF:', mainFileUrl);
                        } else {
                            pdfIframe.src = '';
                            pdfIframe.style.display = 'none';
                            pdfMissing.style.display = 'block';
                        }
                    }
                }
            } else {
                console.error('API error:', data.error);
            }
        })
        .catch(error => {
            console.error('Error loading progress detail:', error);
            if (fileContainer) {
                fileContainer.innerHTML = `<span style="color: #dc3545; font-style: italic;">Error loading file.</span>`;
            }
        });
}

// Helper to initialize dynamic sponsors row inputs
function initDynamicSponsors(containerId, plusBtnClass, wrapperClass, hiddenInputId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const plusBtn = container.querySelector(plusBtnClass);
    const wrapper = container.querySelector(wrapperClass);
    const hiddenInput = document.getElementById(hiddenInputId);
    const primaryInput = container.querySelector('input[name="sponsor"]');

    if (!plusBtn || !wrapper || !hiddenInput || !primaryInput) return;

    function updateHiddenField() {
        const inputs = wrapper.querySelectorAll('.additional-sponsor-input');
        const values = Array.from(inputs)
            .map(inp => inp.value.trim())
            .filter(val => val !== '');
        hiddenInput.value = values.join(', ');
        // Dispatch input and change events on the hidden input to trigger draft save
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Listen for input changes in the wrapper to update the hidden field
    wrapper.addEventListener('input', (e) => {
        if (e.target.classList.contains('additional-sponsor-input')) {
            updateHiddenField();
        }
    });

    // Also listen to primary input changes to update
    primaryInput.addEventListener('input', updateHiddenField);

    plusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const row = document.createElement('div');
        row.className = 'sponsor-input-row';
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.marginBottom = '8px';
        row.style.alignItems = 'center';

        row.innerHTML = `
            <input type="text" class="additional-sponsor-input" placeholder="Hon. Name of Sponsor" style="flex: 1;">
            <button type="button" class="btn-remove-sponsor-row" style="background: #EF4444; color: white; border: none; border-radius: 4px; padding: 0 12px; height: 38px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem;" title="Remove"><i class="fa-solid fa-xmark"></i></button>
        `;

        const removeBtn = row.querySelector('.btn-remove-sponsor-row');
        removeBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            row.remove();
            updateHiddenField();
            primaryInput.dispatchEvent(new Event('change', { bubbles: true }));
        });

        wrapper.appendChild(row);
        row.querySelector('.additional-sponsor-input').focus();
        updateHiddenField();
    });

    container.setCoSponsors = function(coSponsorsString) {
        wrapper.innerHTML = ''; // Clear existing
        if (!coSponsorsString || coSponsorsString.trim() === '' || coSponsorsString === 'None' || coSponsorsString === 'null') {
            hiddenInput.value = '';
            return;
        }

        hiddenInput.value = coSponsorsString;
        const sponsorsList = coSponsorsString.split(',').map(s => s.trim()).filter(s => s !== '');
        sponsorsList.forEach(sponsorName => {
            const row = document.createElement('div');
            row.className = 'sponsor-input-row';
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.marginBottom = '8px';
            row.style.alignItems = 'center';

            row.innerHTML = `
                <input type="text" class="additional-sponsor-input" placeholder="Hon. Name of Sponsor" style="flex: 1;" value="${escapeHtmlAttribute(sponsorName)}">
                <button type="button" class="btn-remove-sponsor-row" style="background: #EF4444; color: white; border: none; border-radius: 4px; padding: 0 12px; height: 38px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem;" title="Remove"><i class="fa-solid fa-xmark"></i></button>
            `;

            const removeBtn = row.querySelector('.btn-remove-sponsor-row');
            removeBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                row.remove();
                updateHiddenField();
                primaryInput.dispatchEvent(new Event('change', { bubbles: true }));
            });

            wrapper.appendChild(row);
        });
    };
}

// Expose functions to global scope explicitly
window.showProgressDetail = showProgressDetail;
window.loadProgressTimeline = loadProgressTimeline;
window.initDynamicSponsors = initDynamicSponsors;