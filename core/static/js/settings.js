/**
 * Settings Page JavaScript - Marikina LegisHub
 * Handles change summary modal and form validation
 */

document.addEventListener('DOMContentLoaded', function() {
    // Only run on settings pages
    if (!document.querySelector('.settings-container')) return;
    
    // Store original values when page loads
    window.originalValues = {};
    
    // Capture original values from form inputs
    const form = document.getElementById('profileForm');
    if (form) {
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'checkbox') {
                    window.originalValues[input.name] = input.checked;
                } else {
                    window.originalValues[input.name] = input.value;
                }
            }
        });
    }
});

function getRoleText(roleValue) {
    const roles = {
        'admin': 'System Administrator (CRUD)',
        'staff': 'Legislative Staff (CRU)',
        'legislator': 'Legislator (Read only)'
    };
    return roles[roleValue] || roleValue;
}

function showChangeSummary() {
    const changes = [];
    
    // Check First Name
    const firstName = document.getElementById('first_name');
    if (firstName && firstName.value !== window.originalValues.first_name) {
        changes.push({
            field: 'First Name',
            oldValue: window.originalValues.first_name || '(empty)',
            newValue: firstName.value || '(empty)',
            italic: true
        });
    }
    
    // Check Last Name
    const lastName = document.getElementById('last_name');
    if (lastName && lastName.value !== window.originalValues.last_name) {
        changes.push({
            field: 'Last Name',
            oldValue: window.originalValues.last_name || '(empty)',
            newValue: lastName.value || '(empty)',
            italic: true
        });
    }
    
    // Check Email
    const email = document.getElementById('email');
    if (email && email.value !== window.originalValues.email) {
        changes.push({
            field: 'Email Address',
            oldValue: window.originalValues.email,
            newValue: email.value,
            italic: true
        });
    }
    
    // Check Username
    const username = document.getElementById('username');
    if (username && username.value !== window.originalValues.username) {
        changes.push({
            field: 'Username',
            oldValue: window.originalValues.username,
            newValue: username.value,
            italic: true
        });
    }
    
    // Check Role
    const roleSelect = document.getElementById('roleSelect');
    if (roleSelect && roleSelect.value !== window.originalValues.role) {
        changes.push({
            field: 'Role / Designation',
            oldValue: getRoleText(window.originalValues.role),
            newValue: getRoleText(roleSelect.value),
            danger: true
        });
    }
    
    // Check System Name
    const systemName = document.getElementById('system_name');
    if (systemName && systemName.value !== window.originalValues.system_name) {
        changes.push({
            field: 'System Name',
            oldValue: window.originalValues.system_name,
            newValue: systemName.value,
            italic: true
        });
    }
    
    // Check Session Timeout
    const sessionTimeout = document.getElementById('session_timeout');
    if (sessionTimeout && sessionTimeout.value !== window.originalValues.session_timeout) {
        const timeoutText = sessionTimeout.value === '15' ? '15 minutes' : (sessionTimeout.value === '30' ? '30 minutes' : '60 minutes');
        const oldTimeoutText = window.originalValues.session_timeout === '15' ? '15 minutes' : (window.originalValues.session_timeout === '30' ? '30 minutes' : '60 minutes');
        changes.push({
            field: 'Session Timeout',
            oldValue: oldTimeoutText,
            newValue: timeoutText,
            italic: true
        });
    }
    
    // Check Support Email
    const supportEmail = document.getElementById('support_email');
    if (supportEmail && supportEmail.value !== window.originalValues.support_email) {
        changes.push({
            field: 'Support Contact Email',
            oldValue: window.originalValues.support_email,
            newValue: supportEmail.value,
            italic: true
        });
    }
    
    // Check Maintenance Mode
    const maintenanceMode = document.getElementById('maintenance_mode');
    if (maintenanceMode && maintenanceMode.checked !== window.originalValues.maintenance_mode) {
        changes.push({
            field: 'Maintenance Mode',
            oldValue: window.originalValues.maintenance_mode ? 'Enabled' : 'Disabled',
            newValue: maintenanceMode.checked ? 'Enabled' : 'Disabled',
            italic: true
        });
    }
    
    // Show modal or submit directly if no changes
    if (changes.length === 0) {
        alert('No changes were made.');
        return;
    }
    
    // Build the changes list HTML
    const changesList = document.getElementById('changesList');
    let changesHtml = '<ul style="margin: 0; padding-left: 20px;">';
    
    changes.forEach(change => {
        let style = '';
        if (change.danger) {
            style = 'color: #dc3545; font-weight: bold;';
        } else if (change.italic) {
            style = 'font-style: italic;';
        }
        
        changesHtml += `<li style="margin-bottom: 10px; ${style}">
            <strong>${change.field}:</strong><br>
            <span style="margin-left: 20px; font-size: 0.85rem;">
                from "${change.oldValue}" → to "${change.newValue}"
            </span>
        </li>`;
    });
    
    changesHtml += '</ul>';
    changesList.innerHTML = changesHtml;
    
    // Show modal
    document.getElementById('changeSummaryModal').style.display = 'flex';
}

function closeSummaryModal() {
    document.getElementById('changeSummaryModal').style.display = 'none';
}

function submitForm() {
    const form = document.getElementById('profileForm');
    const roleSelect = document.getElementById('roleSelect');
    
    // If role changed, add hidden input
    if (roleSelect && roleSelect.value !== window.originalValues.role) {
        const roleInput = document.createElement('input');
        roleInput.type = 'hidden';
        roleInput.name = 'new_role';
        roleInput.value = roleSelect.value;
        form.appendChild(roleInput);
    }
    
    closeSummaryModal();
    form.submit();
}

function resetForm() {
    if (confirm('Discard all unsaved changes?')) {
        location.reload();
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('changeSummaryModal');
    if (e.target === modal) {
        closeSummaryModal();
    }
});