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
        edit: document.getElementById('editModal')
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

    // 5. Notification Logic
    if (bell && notifDropdown) {
        bell.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isShowing = notifDropdown.style.display === 'block';
            closeAllOverlays();
            notifDropdown.style.display = isShowing ? 'none' : 'block';
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

            // 2. Inject the data into the modal's HTML
            document.getElementById('view-number').innerText = docNumber;
            document.getElementById('view-title').innerHTML = `<strong>${docTitle}</strong>`;
            document.getElementById('view-type').innerText = docType;
            document.getElementById('view-year').innerText = docYear;
            document.getElementById('view-date').innerText = docDate;
            document.getElementById('view-sponsor').innerText = docSponsor;
            document.getElementById('view-keywords').innerText = docKeywords;
            if(document.getElementById('view-enacted')) document.getElementById('view-enacted').innerText = docEnacted;
            if(document.getElementById('view-cosponsors')) document.getElementById('view-cosponsors').innerText = docCosponsors;
            if(document.getElementById('view-status')) document.getElementById('view-status').innerHTML = `<span class="badge ${docStatus ? docStatus.toLowerCase() : ''}">${docStatus}</span>`;
            if(document.getElementById('view-visibility')) document.getElementById('view-visibility').innerText = docVisibility;
            if(document.getElementById('view-storage')) document.getElementById('view-storage').innerText = docStorage;

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
});