/**
 * Marikina LegisHub - UI Interactions
 * Handles Upload Modals and Notification Dropdowns
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Elements
    const modal = document.getElementById('uploadModal');
    const notifDropdown = document.getElementById('notificationDropdown');
    const bell = document.getElementById('notifBell');
    const openModalButtons = document.querySelectorAll('.trigger-modal');
    const closeBtn = document.getElementById('closeModal');
    const discardBtn = document.getElementById('discardBtn');

    // 2. Helper to close all UI overlays
    const closeAllOverlays = () => {
        if (modal) modal.style.display = 'none';
        if (notifDropdown) notifDropdown.style.display = 'none';
    };

    // 3. Modal Logic
    if (openModalButtons.length > 0) {
        openModalButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeAllOverlays();
                if (modal) modal.style.display = 'flex';
            });
        });
    }

    // Close Modal buttons
    if (closeBtn) closeBtn.onclick = closeAllOverlays;
    if (discardBtn) discardBtn.onclick = closeAllOverlays;

    // 4. Notification Logic
    if (bell && notifDropdown) {
        bell.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isShowing = notifDropdown.style.display === 'block';
            closeAllOverlays();
            notifDropdown.style.display = isShowing ? 'none' : 'block';
        });
    }

    // 5. Global Click Listener (Close when clicking outside)
    window.addEventListener('click', (event) => {
        // If clicking the modal background
        if (event.target === modal) {
            closeAllOverlays();
        }
        // If clicking outside the notification dropdown and not the bell
        if (notifDropdown && 
            !notifDropdown.contains(event.target) && 
            event.target !== bell) {
            notifDropdown.style.display = 'none';
        }
    });
});