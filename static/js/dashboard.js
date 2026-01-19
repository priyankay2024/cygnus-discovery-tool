// Smooth Device List Update without Flickering
let previousDeviceData = null;
let previousCardData = null;
let allDevices = []; // Store all devices for filtering

// View Management
function initViewSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const viewName = this.getAttribute('data-view');
            switchView(viewName);
            
            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function switchView(viewName) {
    const views = document.querySelectorAll('.view-content');
    views.forEach(view => view.classList.remove('active'));
    
    const targetView = document.getElementById(viewName + '-view');
    if (targetView) {
        targetView.classList.add('active');
    }
}

function fetchAndUpdateDevices() {
    fetch('/api/devices')
        .then(response => response.json())
        .then(devices => {
            const currentData = JSON.stringify(devices);
            
            // Store all devices for filtering
            allDevices = devices;
            
            // Apply current search filter
            const searchTerm = document.getElementById('searchFilter')?.value || '';
            const filteredDevices = filterDevices(devices, searchTerm);
            
            // Update table view only if data changed
            if (currentData !== previousDeviceData) {
                updateDeviceTable(filteredDevices);
                previousDeviceData = currentData;
            }
            
            // Update card view only if data changed
            if (currentData !== previousCardData) {
                updateDeviceCards(filteredDevices);
                updateDeviceCounts(devices);
                previousCardData = currentData;
            }
            
            // Update refresh timestamp
            updateRefreshInfo();
        })
        .catch(error => {
            console.error('Error fetching devices:', error);
        });
}

function filterDevices(devices, searchTerm) {
    if (!searchTerm) return devices;
    
    const term = searchTerm.toLowerCase();
    return devices.filter(device => {
        const hostname = (device.hostname || '').toLowerCase();
        const ip = (device.ip || '').toLowerCase();
        return hostname.includes(term) || ip.includes(term);
    });
}

function updateDeviceCounts(devices) {
    const total = devices.length;
    const online = devices.filter(d => d.status === 'online').length;
    
    const totalEl = document.getElementById('totalCount');
    const onlineEl = document.getElementById('onlineCount');
    
    if (totalEl) totalEl.textContent = total;
    if (onlineEl) onlineEl.textContent = online;
}

function updateDeviceCards(devices) {
    const container = document.getElementById('deviceCardsContainer');
    if (!container) return;
    
    if (devices.length === 0) {
        container.innerHTML = `
            <div class="no-devices">
                <h2>No devices found</h2>
                <p>Make sure Cygnus IoT devices are powered on and connected to the network</p>
            </div>
        `;
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    devices.forEach(device => {
        const card = createDeviceCard(device);
        fragment.appendChild(card);
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
}

function createDeviceCard(device) {
    const card = document.createElement('div');
    card.className = 'device-card';
    
    const hostname = device.hostname || 'Unknown';
    const hostnameShort = hostname.replace(/\..*/, ''); // Remove domain suffix
    const ip = device.ip || 'N/A';
    const imei = device.imei || 'N/A';
    const model = device.model || 'N/A';
    const status = device.status || 'offline';
    const services = device.services || {};
    const deviceName = device.device_name || '';
    
    // Build service buttons HTML
    let serviceButtonsHTML = '';
    
    // Always add Cygnus Admin button first
    serviceButtonsHTML += `
        <a href="http://${hostname}" target="_blank" class="service-btn" title="Cygnus Admin">
            Cygnus Admin
        </a>
    `;
    
    // Then add all other services
    for (const [serviceName, port] of Object.entries(services)) {
        const url = port ? `http://${hostname}:${port}` : `http://${hostname}`;
        serviceButtonsHTML += `
            <a href="${url}" target="_blank" class="service-btn" title="${escapeHtml(serviceName)}${port ? ' - Port ' + port : ''}">
                ${escapeHtml(serviceName)}
            </a>
        `;
    }
    
    const statusIndicatorClass = status === 'online' ? 'status-online' : 'status-offline';
    const statusText = status === 'online' ? 'Online' : 'Offline';
    
    card.innerHTML = `
        <div class="device-status-indicator ${statusIndicatorClass}" title="${statusText}">
            <span class="status-dot"></span>
            <span>${statusText}</span>
        </div>
        <div class="device-card-header">
            <div class="device-card-name">${escapeHtml(hostnameShort)}</div>
            <div class="device-card-ip">${escapeHtml(ip)}</div>
        </div>
        <div class="device-card-details">
            <div class="detail-row">
                <span class="detail-label">IMEI:</span>
                <span class="detail-value">${escapeHtml(imei)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Hostname:</span>
                <span class="detail-value">${escapeHtml(hostnameShort)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Device Name:</span>
                <span class="detail-value">${escapeHtml(deviceName || '-')}</span>
            </div>
        </div>
        <div class="device-card-services">
            ${serviceButtonsHTML}
        </div>
    `;
    
    return card;
}

function saveDeviceName(deviceId, deviceName, button) {
    // Show loading state
    const originalText = button.textContent;
    button.textContent = '...';
    button.disabled = true;
    
    fetch('/api/device/update-name', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: deviceId,
            device_name: deviceName
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            button.textContent = '✓';
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 1500);
        } else {
            button.textContent = '✗';
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 1500);
        }
    })
    .catch(error => {
        console.error('Error saving device name:', error);
        button.textContent = '✗';
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 1500);
    });
}

function updateDeviceTable(devices) {
    const tbody = document.getElementById('device-table-body');
    
    if (!tbody) return;
    
    // If no devices, show empty state
    if (devices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div class="loading-spinner"></div>
                    <h3>No devices found</h3>
                    <p>Waiting for Cygnus IoT devices to appear on the network...</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Create a document fragment for smooth rendering
    const fragment = document.createDocumentFragment();
    
    devices.forEach(device => {
        const row = document.createElement('tr');
        const hostname = device.hostname || 'Unknown';
        const hostnameShort = hostname.replace(/\..*/, ''); // Remove domain suffix
        const ip = device.ip || 'N/A';
        const status = device.status || 'offline';
        const services = device.services || {};
        const deviceName = device.device_name || '-';
        const deviceNameId = device.name || '';
        
        // Build service buttons for table
        let serviceButtonsHTML = '';
        
        // Always add Cygnus Admin button first
        serviceButtonsHTML += `<a href="http://${hostname}" target="_blank" class="table-service-btn" title="Cygnus Admin">Cygnus Admin</a>`;
        
        // Then add all other services
        for (const [serviceName, port] of Object.entries(services)) {
            const url = port ? `http://${hostname}:${port}` : `http://${hostname}`;
            serviceButtonsHTML += `<a href="${url}" target="_blank" class="table-service-btn" title="${escapeHtml(serviceName)}">${escapeHtml(serviceName)}</a>`;
        }
        
        const statusClass = status === 'online' ? 'status-badge-online' : 'status-badge-offline';
        const statusText = status === 'online' ? 'Online' : 'Offline';
        
        row.innerHTML = `
            <td>
                <div class="table-hostname">
                    <span class="status-dot ${statusClass}" title="${statusText}"></span>
                    ${escapeHtml(hostnameShort)}
                </div>
            </td>
            <td>${escapeHtml(ip)}</td>
            <td>${escapeHtml(device.imei || 'N/A')}</td>
            <td>${escapeHtml(device.model || 'N/A')}</td>
            <td>
                <span class="device-name-display" data-device-id="${escapeHtml(deviceNameId)}">${escapeHtml(deviceName)}</span>
                <input type="text" class="device-name-edit" data-device-id="${escapeHtml(deviceNameId)}" value="${escapeHtml(deviceName)}" style="display:none;">
            </td>
            <td>
                <div class="table-service-btns">
                    ${serviceButtonsHTML}
                </div>
            </td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit-btn" data-device-id="${escapeHtml(deviceNameId)}" title="Edit device name">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="action-btn delete-btn" data-device-id="${escapeHtml(deviceNameId)}" title="Delete device">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </td>
        `;
        
        fragment.appendChild(row);
    });
    
    // Replace content in one operation to minimize reflow
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    
    // Add event listeners for action buttons
    attachActionListeners();
}

function attachActionListeners() {
    // Edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const deviceId = this.getAttribute('data-device-id');
            const row = this.closest('tr');
            const displaySpan = row.querySelector('.device-name-display');
            const editInput = row.querySelector('.device-name-edit');
            
            if (displaySpan.style.display !== 'none') {
                // Enter edit mode
                displaySpan.style.display = 'none';
                editInput.style.display = 'inline-block';
                editInput.focus();
                this.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                this.title = 'Save';
            } else {
                // Save mode
                const newName = editInput.value.trim();
                saveDeviceNameInline(deviceId, newName, displaySpan, editInput, this);
            }
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const deviceId = this.getAttribute('data-device-id');
            if (confirm('Are you sure you want to delete this device?')) {
                deleteDevice(deviceId);
            }
        });
    });
    
    // Handle Enter key in edit input
    document.querySelectorAll('.device-name-edit').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const deviceId = this.getAttribute('data-device-id');
                const row = this.closest('tr');
                const editBtn = row.querySelector('.edit-btn');
                editBtn.click();
            }
        });
    });
}

function saveDeviceNameInline(deviceId, deviceName, displaySpan, editInput, button) {
    const originalIcon = button.innerHTML;
    button.innerHTML = '...';
    button.disabled = true;
    
    fetch('/api/device/update-name', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: deviceId,
            device_name: deviceName
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            displaySpan.textContent = deviceName || '-';
            displaySpan.style.display = 'inline';
            editInput.style.display = 'none';
            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            `;
            button.title = 'Edit device name';
            button.disabled = false;
            
            // Refresh devices to update card view
            fetchAndUpdateDevices();
        } else {
            alert('Failed to save device name');
            button.innerHTML = originalIcon;
            button.disabled = false;
        }
    })
    .catch(error => {
        console.error('Error saving device name:', error);
        alert('Error saving device name');
        button.innerHTML = originalIcon;
        button.disabled = false;
    });
}

function deleteDevice(deviceId) {
    fetch('/api/device/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: deviceId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Refresh device list
            fetchAndUpdateDevices();
        } else {
            alert('Failed to delete device: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error deleting device:', error);
        alert('Error deleting device');
    });
}

function updateRefreshInfo() {
    const refreshInfo = document.getElementById('refresh-info');
    if (refreshInfo) {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        refreshInfo.textContent = `Last updated: ${timeString}`;
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Refresh button handler
function handleRefresh() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (!refreshBtn) return;
    
    // Disable button and show loading state
    refreshBtn.disabled = true;
    refreshBtn.classList.add('refreshing');
    
    // Send refresh request
    fetch('/api/refresh', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Active mDNS query sent');
            // Wait a moment for devices to respond, then fetch updated list
            setTimeout(() => {
                fetchAndUpdateDevices();
            }, 2000);
        } else {
            console.error('Refresh failed:', data.error);
            alert('Failed to refresh: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error triggering refresh:', error);
        alert('Error triggering refresh. Please check console.');
    })
    .finally(() => {
        // Re-enable button after 3 seconds
        setTimeout(() => {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('refreshing');
        }, 3000);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize view switching
    initViewSwitching();
    
    // Initialize refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefresh);
    }
    
    // Initialize search filter
    const searchFilter = document.getElementById('searchFilter');
    if (searchFilter) {
        searchFilter.addEventListener('input', function() {
            const searchTerm = this.value;
            const filteredDevices = filterDevices(allDevices, searchTerm);
            updateDeviceCards(filteredDevices);
            updateDeviceTable(filteredDevices);
        });
    }
    
    // Initial fetch
    fetchAndUpdateDevices();
    
    // Auto-refresh every 10 seconds
    setInterval(fetchAndUpdateDevices, 10000);
});
