// Smooth Device List Update without Flickering
let previousDeviceData = null;
let previousCardData = null;

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
            
            // Update table view only if data changed
            if (currentData !== previousDeviceData) {
                updateDeviceTable(devices);
                previousDeviceData = currentData;
            }
            
            // Update card view only if data changed
            if (currentData !== previousCardData) {
                updateDeviceCards(devices);
                updateDeviceCount(devices.length);
                previousCardData = currentData;
            }
            
            // Update refresh timestamp
            updateRefreshInfo();
        })
        .catch(error => {
            console.error('Error fetching devices:', error);
        });
}

function updateDeviceCount(count) {
    const countEl = document.getElementById('deviceCount');
    if (countEl) {
        const plural = count === 1 ? 'device' : 'devices';
        countEl.innerHTML = `<strong>${count}</strong> ${plural}`;
    }
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
    const ip = device.ip || 'N/A';
    const imei = device.imei || 'N/A';
    const model = device.model || 'N/A';
    const status = device.status || 'offline';
    const services = device.services || {};
    const deviceName = device.device_name || '';
    const deviceNameId = device.name || '';
    
    // Debug: Log services to console
    console.log('Device:', hostname, 'Services:', services);
    
    // Build service buttons HTML - Cygnus Admin first
    let serviceButtonsHTML = '';
    
    // Add Cygnus Admin first if it exists (even if port is null)
    if ('Cygnus Admin' in services) {
        serviceButtonsHTML += `
            <a href="http://${escapeHtml(ip)}" target="_blank" class="service-btn" title="Cygnus Admin">
                Cygnus Admin
            </a>
        `;
    }
    
    // Then add all other services
    for (const [serviceName, port] of Object.entries(services)) {
        console.log('Service:', serviceName, 'Port:', port);
        if (serviceName !== 'Cygnus Admin' && port !== null && port !== undefined) {
            serviceButtonsHTML += `
                <a href="http://${escapeHtml(ip)}:${port}" target="_blank" class="service-btn" title="${escapeHtml(serviceName)} - Port ${port}">
                    ${escapeHtml(serviceName)}
                </a>
            `;
        }
    }
    
    // If no services are enabled, show a message
    if (Object.keys(services).length === 0) {
        serviceButtonsHTML = '<span class="no-services">No services enabled</span>';
    }
    
    const statusIndicatorClass = status === 'online' ? 'status-online' : 'status-offline';
    const statusText = status === 'online' ? 'Online' : 'Offline';
    
    card.innerHTML = `
        <div class="device-status-indicator ${statusIndicatorClass}" title="${statusText}">
            <span class="status-dot"></span>            <span>${statusText}</span>        </div>
        <div class="device-card-header">
            <div class="device-card-name">${escapeHtml(hostname)}</div>
            <div class="device-card-ip">${escapeHtml(ip)}</div>
        </div>
        <div class="device-card-details">
            <div class="detail-row">
                <span class="detail-label">IMEI:</span>
                <span class="detail-value">${escapeHtml(imei)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Model:</span>
                <span class="detail-value">${escapeHtml(model)}</span>
            </div>
            <div class="detail-row device-name-row">
                <span class="detail-label">Device Name:</span>
                <div class="device-name-input-wrapper">
                    <input type="text" class="device-name-input" value="${escapeHtml(deviceName)}" placeholder="Add name..." data-device-id="${escapeHtml(deviceNameId)}">
                    <button class="save-name-btn" data-device-id="${escapeHtml(deviceNameId)}">Save</button>
                </div>
            </div>
        </div>
        <div class="device-card-services">
            ${serviceButtonsHTML}
        </div>
    `;
    
    // Add event listener for save button
    const saveBtn = card.querySelector('.save-name-btn');
    const nameInput = card.querySelector('.device-name-input');
    
    if (saveBtn && nameInput) {
        saveBtn.addEventListener('click', function() {
            const deviceId = this.getAttribute('data-device-id');
            const newName = nameInput.value.trim();
            saveDeviceName(deviceId, newName, saveBtn);
        });
        
        // Also save on Enter key
        nameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const deviceId = this.getAttribute('data-device-id');
                const newName = this.value.trim();
                saveDeviceName(deviceId, newName, saveBtn);
            }
        });
    }
    
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
                <td colspan="6" class="empty-state">
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
        const ip = device.ip || 'N/A';
        const status = device.status || 'offline';
        const services = device.services || {};
        const deviceName = device.device_name || '-';
        
        // Build service buttons for table - Cygnus Admin first
        let serviceButtonsHTML = '';
        
        // Add Cygnus Admin first if it exists (even if port is null)
        if ('Cygnus Admin' in services) {
            serviceButtonsHTML += `<a href="http://${escapeHtml(ip)}" target="_blank" class="table-service-btn" title="Cygnus Admin">Cygnus Admin</a>`;
        }
        
        // Then add all other services
        for (const [serviceName, port] of Object.entries(services)) {
            if (serviceName !== 'Cygnus Admin' && port !== null && port !== undefined) {
                serviceButtonsHTML += `<a href="http://${escapeHtml(ip)}:${port}" target="_blank" class="table-service-btn" title="${escapeHtml(serviceName)}">${escapeHtml(serviceName)}</a>`;
            }
        }
        
        if (serviceButtonsHTML === '') {
            serviceButtonsHTML = '<span class="no-services-small">None</span>';
        }
        
        const statusClass = status === 'online' ? 'status-badge-online' : 'status-badge-offline';
        const statusText = status === 'online' ? 'Online' : 'Offline';
        
        row.innerHTML = `
            <td>
                <div class="table-hostname">
                    ${escapeHtml(device.hostname || 'Unknown')}
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
            </td>
            <td>${escapeHtml(ip)}</td>
            <td>${escapeHtml(device.imei || 'N/A')}</td>
            <td>${escapeHtml(device.model || 'N/A')}</td>
            <td>${escapeHtml(deviceName)}</td>
            <td>
                <div class="table-service-btns">
                    ${serviceButtonsHTML}
                </div>
            </td>
        `;
        
        fragment.appendChild(row);
    });
    
    // Replace content in one operation to minimize reflow
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize view switching
    initViewSwitching();
    
    // Initial fetch
    fetchAndUpdateDevices();
    
    // Auto-refresh every 10 seconds
    setInterval(fetchAndUpdateDevices, 10000);
});
