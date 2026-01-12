// Smooth Device List Update without Flickering
let previousDeviceData = null;
let previousCardData = null;

// View Management
function initViewSwitching() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const viewName = this.getAttribute('data-view');
            switchView(viewName);
            
            // Update active nav link
            navLinks.forEach(l => l.classList.remove('active'));
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
        countEl.innerHTML = `<strong>${count}</strong> ${plural} discovered`;
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
    const fw = device.fw || 'N/A';
    const deviceId = device.device_id || 'N/A';
    
    card.innerHTML = `
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
                <span class="detail-label">Device ID:</span>
                <span class="detail-value">${escapeHtml(deviceId)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Model:</span>
                <span class="detail-value">${escapeHtml(model)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Firmware:</span>
                <span class="detail-value">${escapeHtml(fw)}</span>
            </div>
        </div>
        <div class="device-card-actions">
            <a href="http://${escapeHtml(ip)}:5001" target="_blank" class="port-btn port-btn-5001">
                Port 5001
            </a>
            <a href="http://${escapeHtml(ip)}:5002" target="_blank" class="port-btn port-btn-5002">
                Port 5002
            </a>
            <a href="http://${escapeHtml(ip)}:8081" target="_blank" class="port-btn port-btn-8081">
                Port 8081
            </a>
        </div>
    `;
    
    return card;
}

function updateDeviceTable(devices) {
    const tbody = document.getElementById('device-table-body');
    
    if (!tbody) return;
    
    // If no devices, show empty state
    if (devices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">

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
        
        row.innerHTML = `
            <td>${escapeHtml(device.hostname || 'Unknown')}</td>
            <td>${escapeHtml(device.ip || 'N/A')}</td>
            <td>${escapeHtml(device.port || 'N/A')}</td>
            <td>${escapeHtml(device.imei || 'N/A')}</td>
            <td>${escapeHtml(device.device_id || 'N/A')}</td>
            <td>${escapeHtml(device.model || 'N/A')}</td>
            <td>${escapeHtml(device.fw || 'N/A')}</td>
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
    
    // Auto-refresh every 5 seconds
    setInterval(fetchAndUpdateDevices, 5000);
});
