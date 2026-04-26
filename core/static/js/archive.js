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