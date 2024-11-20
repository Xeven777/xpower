// Store active hostnames
let activeHostnames = new Set();

chrome.storage.local.get(['activeHostnames'], (result) => {
    if (result.activeHostnames) {
        activeHostnames = new Set(result.activeHostnames);
    }
});

// Keep track of intervals to avoid duplicates
const keepAliveIntervals = {};

// Listen for tab updates and send keepAlive messages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        let hostname;
        try {
            hostname = new URL(tab.url).hostname;
        } catch (e) {
            console.error('Invalid URL:', tab.url);
            return;
        }

        if (activeHostnames.has(hostname)) {
            // Clear any existing interval for this tab
            if (keepAliveIntervals[tabId]) {
                clearInterval(keepAliveIntervals[tabId]);
            }

            // Set up a new interval to keep the tab active
            keepAliveIntervals[tabId] = setInterval(() => {
                chrome.tabs.sendMessage(tabId, { action: 'keepAlive' }, (response) => {
                    if (chrome.runtime.lastError) {
                    }
                });
            }, 25000);
        }
    }
});

// Clean up intervals when a tab is removed or updated
chrome.tabs.onRemoved.addListener((tabId) => {
    if (keepAliveIntervals[tabId]) {
        clearInterval(keepAliveIntervals[tabId]);
        delete keepAliveIntervals[tabId];
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && keepAliveIntervals[tabId]) {
        clearInterval(keepAliveIntervals[tabId]);
        delete keepAliveIntervals[tabId];
    }
});

// Listen for tab activations and update badge
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (!tab.url) {
            return;
        }

        let hostname;
        try {
            hostname = new URL(tab.url).hostname;
        } catch (e) {
            console.error('Invalid URL:', tab.url);
            return;
        }

        const result = await chrome.storage.local.get(['activeHostnames']);
        const activeHostnames = new Set(result.activeHostnames || []);

        chrome.action.setBadgeText({
            text: activeHostnames.has(hostname) ? 'ON' : '',
            tabId: tab.id
        });
    } catch (e) {
        console.error('Error in onActivated:', e);
    }
});