
// Get the active tab's hostname and settings
async function getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}

// Initialize the popup's state
async function initializePopup() {
    const tab = await getCurrentTab();
    const hostname = new URL(tab.url).hostname;

    const result = await chrome.storage.local.get(['activeHostnames', 'settings']);
    const activeHostnames = new Set(result.activeHostnames || []);
    const settings = result.settings || {
        copyProtection: false,
        alwaysActive: false,
        dialogRemover: false
    };

    // Update the UI with the stored settings
    document.getElementById('copyProtection').checked = settings.copyProtection;
    document.getElementById('alwaysActive').checked = settings.alwaysActive;
    document.getElementById('dialogRemover').checked = settings.dialogRemover;

    const statusElement = document.getElementById('status');
    if (activeHostnames.has(hostname)) {
        statusElement.textContent = 'Active';
        statusElement.className = 'active';
    } else {
        statusElement.textContent = 'Inactive';
        statusElement.className = 'inactive';
    }
}

// Handle toggling features
async function handleToggle(feature) {
    const tab = await getCurrentTab();
    const hostname = new URL(tab.url).hostname;

    const result = await chrome.storage.local.get(['activeHostnames', 'settings']);
    const activeHostnames = new Set(result.activeHostnames || []);
    const settings = result.settings || {};

    settings[feature] = !settings[feature];
    await chrome.storage.local.set({ settings });

    // Add or remove hostname based on toggled status
    if (settings[feature]) {
        activeHostnames.add(hostname);
    } else {
        activeHostnames.delete(hostname);
    }
    await chrome.storage.local.set({ activeHostnames: [...activeHostnames] });

    // Notify content script
    chrome.tabs.sendMessage(tab.id, { action: 'updateSettings', settings });
    initializePopup(); // Reinitialize the popup
}

// Event Listeners
document.addEventListener('DOMContentLoaded', initializePopup);
document.getElementById('copyProtection').addEventListener('change', () => handleToggle('copyProtection'));
document.getElementById('alwaysActive').addEventListener('change', () => handleToggle('alwaysActive'));
document.getElementById('dialogRemover').addEventListener('change', () => handleToggle('dialogRemover'));