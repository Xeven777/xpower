let activeTabs = new Set();
let activeHostnames = new Set();

chrome.storage.local.get(['activeHostnames'], (result) => {
    if (result.activeHostnames) {
        activeHostnames = new Set(result.activeHostnames);
    }
});

const keepAliveIntervals = {};

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
            activeTabs.add(tabId);
            sendKeepAlive(tabId);
        } else if (activeTabs.has(tabId)) {
            activeTabs.delete(tabId);
            clearInterval(keepAliveIntervals[tabId]);
            delete keepAliveIntervals[tabId];
        }
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    activeTabs.delete(tabId);
    clearInterval(keepAliveIntervals[tabId]);
    delete keepAliveIntervals[tabId];
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "toggleAlwaysActive") {
        const tabId = sender.tab.id;
        const hostname = new URL(sender.tab.url).hostname;

        if (activeHostnames.has(hostname)) {
            activeHostnames.delete(hostname);
            // Optionally revert changes in content script
        } else {
            activeHostnames.add(hostname);
            chrome.tabs.sendMessage(tabId, { action: 'activateAlwaysActive' });
        }

        // Update storage
        chrome.storage.local.set({ activeHostnames: [...activeHostnames] });
        sendResponse({ active: activeHostnames.has(hostname) });
    }
});

function sendKeepAlive(tabId) {
    keepAliveIntervals[tabId] = setInterval(() => {
        chrome.tabs.sendMessage(tabId, { action: 'keepAlive' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("keepAlive message failed:", chrome.runtime.lastError);
                //Consider clearing the interval if keepAlive fails repeatedly.
                clearInterval(keepAliveIntervals[tabId]);
                delete keepAliveIntervals[tabId];
            }
        });
    }, 10000); // Send every 10 seconds - adjust as needed
}

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