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
});