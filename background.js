// Store active hostnames
let activeHostnames = new Set();

// Initialize storage
chrome.storage.local.get(['activeHostnames'], (result) => {
    if (result.activeHostnames) {
        activeHostnames = new Set(result.activeHostnames);
    }
});

// Handle icon clicks
chrome.action.onClicked.addListener(async (tab) => {
    const hostname = new URL(tab.url).hostname;
    const isActive = activeHostnames.has(hostname);

    if (isActive) {
        activeHostnames.delete(hostname);
    } else {
        activeHostnames.add(hostname);
    }

    // Update storage
    await chrome.storage.local.set({
        activeHostnames: Array.from(activeHostnames)
    });

    // Update icon
    await chrome.action.setIcon({
        path: {
            48: isActive ? 'icon48_inactive.png' : 'icon48_active.png',
            128: isActive ? 'icon128_inactive.png' : 'icon128_active.png'
        },
        tabId: tab.id
    });

    // Refresh the tab
    chrome.tabs.reload(tab.id);
});

// Keep tabs active
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const hostname = new URL(tab.url).hostname;
        if (activeHostnames.has(hostname)) {
            setInterval(() => {
                chrome.tabs.sendMessage(tabId, { action: 'keepAlive' });
            }, 25000);
        }
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const hostname = new URL(tab.url).hostname;

    const result = await chrome.storage.local.get(['activeHostnames']);
    const activeHostnames = new Set(result.activeHostnames || []);

    chrome.action.setBadgeText({
        text: activeHostnames.has(hostname) ? 'ON' : ''
    });
});
