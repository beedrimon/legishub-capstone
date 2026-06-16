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
// ARCHIVE VIEW MODAL HANDLER
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    // Handle view clicks for archived documents
    const viewButtons = document.querySelectorAll('.trigger-view');
    
    viewButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Read data from the icon
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
            
            // Get modal elements
            const modal = document.getElementById('viewModal');
            if (!modal) {
                console.error('View modal not found!');
                return;
            }
            
            // Populate modal fields
            const numberEl = document.getElementById('view-number');
            const titleEl = document.getElementById('view-title');
            const typeEl = document.getElementById('view-type');
            const yearEl = document.getElementById('view-year');
            const dateEl = document.getElementById('view-date');
            const sponsorEl = document.getElementById('view-sponsor');
            const keywordsEl = document.getElementById('view-keywords');
            const enactedEl = document.getElementById('view-enacted');
            const cosponsorsEl = document.getElementById('view-cosponsors');
            const statusEl = document.getElementById('view-status');
            const storageEl = document.getElementById('view-storage');
            
            if (numberEl) numberEl.textContent = docNumber || 'N/A';
            if (titleEl) titleEl.textContent = docTitle || 'N/A';
            if (typeEl) typeEl.textContent = docType || 'N/A';
            if (yearEl) yearEl.textContent = docYear || 'N/A';
            if (dateEl) dateEl.textContent = docDate || 'N/A';
            if (sponsorEl) sponsorEl.textContent = docSponsor || 'N/A';
            if (keywordsEl) keywordsEl.textContent = docKeywords || 'N/A';
            if (enactedEl) enactedEl.textContent = docEnacted || 'N/A';
            if (cosponsorsEl) cosponsorsEl.textContent = docCosponsors || 'N/A';
            if (statusEl) statusEl.innerHTML = `<span style="background: #E8F5E9; color: #2E7D32; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.7rem;">${docStatus || 'Archived'}</span>`;
            if (storageEl) storageEl.textContent = docStorage || 'N/A';
            
            // Handle PDF preview
            const pdfIframe = document.getElementById('view-pdf-iframe');
            const pdfMissing = document.getElementById('view-pdf-missing');
            const downloadBtn = document.getElementById('view-download-btn');
            
            if (fileUrl && fileUrl !== 'None' && fileUrl !== 'null' && fileUrl.trim() !== '') {
                if (pdfIframe) {
                    pdfIframe.src = fileUrl + '#view=FitH';
                    pdfIframe.style.display = 'block';
                }
                if (pdfMissing) pdfMissing.style.display = 'none';
                if (downloadBtn) {
                    downloadBtn.style.display = 'inline-block';
                    downloadBtn.onclick = function() {
                        window.open(fileUrl, '_blank');
                    };
                }
            } else {
                if (pdfIframe) {
                    pdfIframe.src = '';
                    pdfIframe.style.display = 'none';
                }
                if (pdfMissing) pdfMissing.style.display = 'block';
                if (downloadBtn) downloadBtn.style.display = 'none';
            }
            
            // Show the modal
            modal.style.display = 'flex';
        });
    });
    
    // Close modal function
    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    };
});