// Store active hostnames
let activeHostnames = new Set();

// Load active hostnames from storage
chrome.storage.local.get(['activeHostnames'], (result) => {
    activeHostnames = new Set(result.activeHostnames || []);
});

// Listen for tab updates and send keepAlive messages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const hostname = new URL(tab.url).hostname;
        if (activeHostnames.has(hostname)) {
            setInterval(() => {
                chrome.tabs.sendMessage(tabId, { action: 'keepAlive' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[Always Active] Error sending keepAlive message:', chrome.runtime.lastError);
                    }
                });
            }, 25000);
        }
    }
});

// Listen for tab activations and update badge
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const hostname = new URL(tab.url).hostname;

    const result = await chrome.storage.local.get(['activeHostnames']);
    const activeHostnames = new Set(result.activeHostnames || []);

    chrome.action.setBadgeText({
        text: activeHostnames.has(hostname) ? 'ON' : ''
    });
});
