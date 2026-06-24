let currentType = null;
let currentDecadeStart = null;
let currentYear = null;

function updateBreadcrumb() {
    const bc = document.getElementById("breadcrumb");

    bc.innerHTML = `
        <h1 style="color:red;">
            ${currentType || "NO TYPE"} |
            ${currentDecadeStart || "NO DECADE"} |
            ${currentYear || "NO YEAR"}
        </h1>
    `;
}
function goHome() {
    currentType = null;
    currentDecadeStart = null;
    currentYear = null;

    document.getElementById('decade-folders').style.display = 'none';
    document.getElementById('parent-folders').style.display = 'grid';
    document.getElementById('year-folders-section').style.display = 'none';

    updateBreadcrumb();
    filterTable();
}

function goType() {
    currentDecadeStart = null;
    currentYear = null;

    document.getElementById('decade-folders').style.display = 'grid';
    document.getElementById('year-folders-section').style.display = 'none';

    updateBreadcrumb();
    filterTable();
}

function goDecade() {
    currentYear = null;

    document.getElementById('year-folders-section').style.display = 'block';

    updateBreadcrumb();
    filterTable();
}

function selectType(type) {
    currentType = type;
    currentDecadeStart = null;
    updateBreadcrumb();
    currentYear = null;
    
    document.getElementById('parent-folders').style.display = 'none';
    
    const decadeSection = document.getElementById('decade-folders');
    decadeSection.style.display = 'grid';
    decadeSection.innerHTML = '';
    
    // Add "Back" folder
    // const backBtn = document.createElement('div');
    // backBtn.className = 'folder-card doc-type-folder';
    // backBtn.style.cursor = 'pointer';
    // backBtn.onclick = backToParents;
    // backBtn.innerHTML = `
    //     <i class="fa-solid fa-arrow-left"></i>
    //     <p>BACK</p>
    // `;
    // decadeSection.appendChild(backBtn);
    
    // Calculate Decades based on actual data mapped from archive.html inline script
    const typeArchives = archiveData.filter(a => a.type === type);
    const years = [...new Set(typeArchives.map(a => parseInt(a.year, 10)))].filter(y => !isNaN(y));
    
    if (years.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.gridColumn = '1 / -1';
        emptyMsg.innerHTML = '<p style="color: #888; margin-top: 15px;">No archives found for this category.</p>';
        decadeSection.appendChild(emptyMsg);
    } else {
        const decades = new Set();
        years.forEach(y => decades.add(Math.floor(y / 10) * 10));
        const sortedDecades = [...decades].sort((a, b) => b - a); // Descending order
        
        sortedDecades.forEach(decade => {
            const folder = document.createElement('div');
            folder.className = 'folder-card doc-type-folder';
            folder.style.cursor = 'pointer';
            folder.onclick = function() { selectDecade(decade, this); };
            folder.innerHTML = `
                <i class="fa-regular fa-folder"></i>
                <p>${decade} - ${decade + 9}</p>
            `;
            decadeSection.appendChild(folder);
        });
    }
    
    document.getElementById('year-folders-section').style.display = 'none';
    filterTable();
}

function selectDecade(decade, element) {
    if (currentDecadeStart === decade) {
        currentDecadeStart = null;
        currentYear = null;
        element.classList.remove('selected-folder');
        document.getElementById('year-folders-section').style.display = 'none';
    } else {
        currentDecadeStart = decade;
        currentYear = null;
        updateBreadcrumb();
        
        document.querySelectorAll('#decade-folders .folder-card').forEach(el => {
            el.classList.remove('selected-folder');
        });
        element.classList.add('selected-folder');
        
        const yearSection = document.getElementById('year-folders-section');
        yearSection.style.display = 'block';
        document.getElementById('selected-type-label').innerText = `${decade} - ${decade + 9} YEARS`;
        
        const typeArchives = archiveData.filter(a => a.type === currentType);
        const years = [...new Set(typeArchives.map(a => parseInt(a.year, 10)))]
            .filter(y => y >= decade && y <= decade + 9)
            .sort((a, b) => b - a);
            
        const yearGrid = document.getElementById('year-folders-grid');
        yearGrid.innerHTML = '';
        
        if (years.length === 0) {
            yearGrid.innerHTML = '<p style="color: #888; grid-column: 1 / -1;">No archives found for this decade.</p>';
        } else {
            years.forEach(year => {
                const folder = document.createElement('a');
                folder.href = 'javascript:void(0)';
                folder.className = 'year-folder';
                folder.onclick = function() { selectYear(year, this); };
                folder.innerHTML = `
                    <i class="fa-regular fa-folder"></i>
                    <p>${year}</p>
                `;
                yearGrid.appendChild(folder);
            });
        }
    }
    filterTable();
}

function selectYear(year, element) {
    if (currentYear === year) {
        currentYear = null;
        element.classList.remove('selected-year');
    } else {
        currentYear = year;
        updateBreadcrumb();
        document.querySelectorAll('.year-folder').forEach(el => {
            el.classList.remove('selected-year');
        });
        element.classList.add('selected-year');
    }
    filterTable();
}

function backToParents() {
    currentType = null;
    currentDecadeStart = null;
    currentYear = null;
    updateBreadcrumb();
    
    document.getElementById('decade-folders').style.display = 'none';
    document.getElementById('parent-folders').style.display = 'grid';
    document.getElementById('year-folders-section').style.display = 'none';
    
    filterTable();
}

function filterTable() {
    const rows = document.querySelectorAll('tbody tr.archive-row');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const rowType = row.getAttribute('data-type');
        const rowYear = parseInt(row.getAttribute('data-year'), 10);
        
        let show = true;    
        if (currentType && rowType !== currentType) show = false;
        if (currentDecadeStart !== null && (rowYear < currentDecadeStart || rowYear > currentDecadeStart + 9)) show = false;
        if (currentYear && rowYear !== currentYear) show = false;

        if (show) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const emptyRow = document.getElementById('empty-row');
    if (emptyRow) {
        emptyRow.style.display = visibleCount === 0 ? '' : 'none';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    filterTable();
    updateBreadcrumb();

    // Add Folder Modal Trigger
    const addFolderBtn = document.getElementById('btn-add-folder');
    const addFolderModal = document.getElementById('addFolderModal');
    if (addFolderBtn && addFolderModal) {
        addFolderBtn.addEventListener('click', () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
            addFolderModal.style.display = 'flex';
        });
    }
});

console.log("archive.js loaded");
// ==========================================
// ARCHIVE VIEW MODAL HANDLER (Combined Sponsors - PDF Fixed)
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    const viewButtons = document.querySelectorAll('.trigger-view');
    
    viewButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Read data attributes
            const docId = this.getAttribute('data-id');
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
            const docStorage = this.getAttribute('data-storage');
            const fileUrl = this.getAttribute('data-file');
            const retention = this.getAttribute('data-retention') || 'Permanent';
            
            const modal = document.getElementById('viewModal');
            if (!modal) return;
            
            // Combine primary and additional sponsors
            let allSponsors = '';
            const primary = (docSponsor || '').trim();
            const additional = (docCosponsors || '').trim();
            
            if (primary && primary !== 'Not specified' && primary !== 'None' && primary !== 'No Sponsor Listed') {
                allSponsors = primary;
            }
            if (additional && additional !== 'Not specified' && additional !== 'None' && additional !== 'No Sponsor Listed') {
                if (allSponsors) {
                    allSponsors += ', ' + additional;
                } else {
                    allSponsors = additional;
                }
            }
            if (!allSponsors) {
                allSponsors = 'Not specified';
            }
            
            // Populate left metadata
            document.getElementById('view-number').textContent = docNumber || 'N/A';
            document.getElementById('view-title').textContent = docTitle || 'Untitled';
            document.getElementById('view-type').textContent = docType || 'N/A';
            document.getElementById('view-year').textContent = docYear || 'N/A';
            document.getElementById('view-date').textContent = docDate || 'N/A';
            document.getElementById('view-enacted').textContent = docEnacted || 'N/A';
            document.getElementById('view-sponsor').textContent = allSponsors;
            document.getElementById('view-storage').textContent = docStorage || 'Not specified';
            document.getElementById('view-keywords').textContent = docKeywords || 'No keywords';
            
            // Status & retention
            const statusEl = document.getElementById('view-status');
            if (statusEl) {
                statusEl.innerHTML = `<span class="badge archived">${docStatus || 'Archived'}</span>`;
            }
            document.getElementById('view-retention').textContent = retention;
            
            // ---- PDF preview - FIXED ----
            const pdfIframe = document.getElementById('view-pdf-iframe');
            const pdfMissing = document.getElementById('view-pdf-missing');
            const downloadBtn = document.getElementById('view-download-btn');
            
            if (fileUrl && fileUrl !== 'None' && fileUrl !== 'null' && fileUrl.trim() !== '') {
                // Use URL as-is – no cache buster (preserves S3 signature)
                pdfIframe.src = fileUrl + '#view=FitH';
                pdfIframe.style.display = 'block';
                pdfMissing.style.display = 'none';
                if (downloadBtn) {
                    downloadBtn.style.display = 'inline-block';
                    downloadBtn.onclick = function() {
                        window.open(fileUrl, '_blank');
                    };
                }
            } else {
                pdfIframe.src = '';
                pdfIframe.style.display = 'none';
                pdfMissing.style.display = 'block';
                if (downloadBtn) {
                    downloadBtn.style.display = 'none';
                }
            }
            
            // Load progress timeline
            if (typeof loadArchivedProgressTimeline === 'function') {
                loadArchivedProgressTimeline(docId);
            }
            
            // Store for sharing
            modal.setAttribute('data-current-doc-id', docId || '');
            modal.setAttribute('data-current-doc-number', docNumber || '');
            modal.setAttribute('data-current-doc-title', docTitle || '');
            modal.setAttribute('data-current-file-url', fileUrl || '');
            
            // Clear share status
            const statusMsg = document.getElementById('share-email-status');
            const emailInput = document.getElementById('share-recipient-email');
            if (statusMsg) statusMsg.innerText = '';
            if (emailInput) emailInput.value = '';
            
            modal.style.display = 'flex';
        });
    });
    
    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    };
    
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) this.style.display = 'none';
        });
    });
});


// ==========================================
// PROGRESS TIMELINE FUNCTIONS
// ==========================================

function escapeHtmlAttribute(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function loadArchivedProgressTimeline(archivedId) {
    console.log('loadArchivedProgressTimeline called with ID:', archivedId);
    const timeline = document.getElementById('archiveProgressTimeline');
    const detailDisplay = document.getElementById('progressDetailDisplay');
    if (detailDisplay) detailDisplay.style.display = 'none';
    if (!timeline) {
        console.warn('Timeline container #archiveProgressTimeline not found');
        return;
    }
    
    timeline.innerHTML = `
        <div style="color: var(--text-light); font-size: 0.75rem; padding: 20px 10px; text-align: center;">
            <i class="fa-solid fa-spinner fa-spin"></i> Loading...
        </div>
    `;
    
    fetch(`/api/archived-progress/?archived_id=${archivedId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Progress data received:', data);
            if (data.progress && data.progress.length > 0) {
                timeline.innerHTML = '';
                const sorted = [...data.progress].sort((a, b) => new Date(a.update_date) - new Date(b.update_date));
                const latest = sorted[sorted.length - 1];
                
                const darkBrown = '#7c5c35';
                const lightBrown = '#d9c8ac';
                const textLight = '#6b5a4a';
                
                sorted.forEach((item, index) => {
                    const isCurrent = index === sorted.length - 1;
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
                    button.dataset.status = item.status;
                    button.dataset.updateDate = item.update_date;
                    button.dataset.note = item.note;
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
                    
                    button.addEventListener('click', () => showArchivedProgressDetail(button));
                    wrapper.appendChild(button);
                    
                    const marker = document.createElement('div');
                    marker.style.width = isCurrent ? '6px' : '4px';
                    marker.style.background = isCurrent ? darkBrown : lightBrown;
                    marker.style.borderRadius = isCurrent ? '0 4px 4px 0' : '0 3px 3px 0';
                    marker.style.flexShrink = '0';
                    wrapper.appendChild(marker);
                    
                    timeline.appendChild(wrapper);
                });
                
                // Auto‑show details of the latest progress
                if (latest) {
                    const detailDisplay = document.getElementById('progressDetailDisplay');
                    if (detailDisplay) {
                        detailDisplay.style.display = 'block';
                        document.getElementById('pd-date').textContent = latest.update_date;
                        document.getElementById('pd-status').textContent = latest.status.toUpperCase();
                        document.getElementById('pd-note').textContent = latest.note || 'No note provided.';
                        const fileContainer = document.getElementById('pd-file');
                        if (fileContainer) {
                            if (latest.file_attachment) {
                                const safeUrl = escapeHtmlAttribute(latest.file_attachment);
                                fileContainer.innerHTML = `
                                    <a href="${safeUrl}" target="_blank" style="color: var(--sidebar-bg); text-decoration: none; font-weight: 600;">
                                        <i class="fa-regular fa-file-pdf"></i> View Attached File
                                    </a>
                                `;
                            } else {
                                fileContainer.innerHTML = `<span style="color: var(--text-light); font-style: italic;">No file attached.</span>`;
                            }
                        }
                    }
                }
            } else {
                timeline.innerHTML = `
                    <div style="color: var(--text-light); font-size: 0.75rem; padding: 20px 10px; text-align: center;">
                        <i class="fa-regular fa-clock"></i> No progress history available.
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading archived progress:', error);
            timeline.innerHTML = `
                <div style="color: #dc3545; font-size: 0.75rem; padding: 10px; text-align: center;">
                    <i class="fa-solid fa-exclamation-triangle"></i> Failed to load progress.
                </div>
            `;
        });
}

function showArchivedProgressDetail(btn) {
    console.log('showArchivedProgressDetail called');
    const status = btn.dataset.status;
    const updateDate = btn.dataset.updateDate;
    const note = btn.dataset.note;
    const progressId = btn.dataset.progressId;
    
    // Set active progress details on viewModal
    const modal = document.getElementById('viewModal');
    if (modal) {
        modal.setAttribute('data-active-progress-id', progressId || '');
    }
    
    // Highlight clicked bookmark
    document.querySelectorAll('#archiveProgressTimeline .progress-bookmark').forEach(b => {
        b.style.background = '#d9c8ac';
        b.style.color = '#6b5a4a';
        b.style.boxShadow = 'none';
        b.style.borderRight = '3px solid transparent';
        b.style.fontWeight = '600';
    });
    btn.style.background = '#7c5c35';
    btn.style.color = 'white';
    btn.style.boxShadow = '0 2px 8px rgba(124,92,53,0.35)';
    btn.style.borderRight = '4px solid #5c4330';
    btn.style.fontWeight = '700';
    
    const detailDisplay = document.getElementById('progressDetailDisplay');
    if (detailDisplay) {
        detailDisplay.style.display = 'block';
        document.getElementById('pd-date').textContent = updateDate;
        document.getElementById('pd-status').textContent = status.toUpperCase();
        document.getElementById('pd-note').textContent = note || 'No note provided.';
        
        const fileContainer = document.getElementById('pd-file');
        const pdfIframe = document.getElementById('view-pdf-iframe');
        const pdfMissing = document.getElementById('view-pdf-missing');
        
        // Show loading indicator
        if (pdfIframe && pdfMissing) {
            pdfIframe.src = '';
            pdfIframe.style.display = 'none';
            pdfMissing.style.display = 'block';
            pdfMissing.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 4rem; color: var(--sidebar-bg);"></i>
                <p style="margin-top: 10px; font-size: 0.9rem;">Loading progress file...</p>
            `;
        }

        if (fileContainer) {
            // Fetch detail to get file URL
            fetch(`/api/archived-progress-detail/?id=${progressId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.progress.file_attachment) {
                        const safeUrl = escapeHtmlAttribute(data.progress.file_attachment);
                        if (modal) {
                            modal.setAttribute('data-current-file-url', data.progress.file_attachment || '');
                        }
                        fileContainer.innerHTML = `
                            <a href="${safeUrl}" target="_blank" style="color: var(--sidebar-bg); text-decoration: none; font-weight: 600;">
                                <i class="fa-regular fa-file-pdf"></i> View Attached File
                            </a>
                        `;
                        if (pdfIframe && pdfMissing) {
                            pdfIframe.src = data.progress.file_attachment + '#view=FitH';
                            pdfIframe.style.display = 'block';
                            pdfMissing.style.display = 'none';
                        }
                    } else {
                        if (modal) {
                            modal.setAttribute('data-current-file-url', '');
                        }
                        fileContainer.innerHTML = `<span style="color: var(--text-light); font-style: italic;">No file attached.</span>`;
                        if (pdfIframe && pdfMissing) {
                            pdfIframe.src = '';
                            pdfIframe.style.display = 'none';
                            pdfMissing.style.display = 'block';
                            pdfMissing.innerHTML = `
                                <i class="fa-regular fa-file-pdf" style="font-size: 4rem;"></i>
                                <p style="margin-top: 10px; font-size: 0.9rem;">No file attached to this progress update.</p>
                            `;
                        }
                    }
                })
                .catch(() => {
                    if (modal) {
                        modal.setAttribute('data-current-file-url', '');
                    }
                    fileContainer.innerHTML = `<span style="color: var(--text-light); font-style: italic;">Error loading file.</span>`;
                    if (pdfIframe && pdfMissing) {
                        pdfIframe.src = '';
                        pdfIframe.style.display = 'none';
                        pdfMissing.style.display = 'block';
                        pdfMissing.innerHTML = `
                            <i class="fa-solid fa-exclamation-triangle" style="font-size: 4rem; color: #dc3545;"></i>
                            <p style="margin-top: 10px; font-size: 0.9rem; color: #dc3545;">Error loading progress attachment.</p>
                        `;
                    }
                });
        }
    }
}