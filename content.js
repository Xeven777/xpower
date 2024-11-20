// Check if the current hostname is active
let isHostnameActive = false;

chrome.storage.local.get(['activeHostnames', 'settings'], (result) => {
    if (result.activeHostnames) {
        const hostname = window.location.hostname;
        isHostnameActive = result.activeHostnames.includes(hostname);
        if (isHostnameActive) {
            initializeFeatures(result.settings);
        }
    }
});

function initializeFeatures(settings) {
    if (settings.copyProtection) {
        enableRightClickAndCopy();
    }
    if (settings.alwaysActive) {
        spoofVisibilityState();
    }
    if (settings.dialogRemover) {
        removeCopyProtectionDialogs();
    }
}

function enableRightClickAndCopy() {
    // Previous right-click and copy enabling code
    document.addEventListener('contextmenu', function (e) {
        e.stopPropagation();
        return true;
    }, true);

    document.addEventListener('copy', function (e) {
        e.stopPropagation();
        return true;
    }, true);

    document.addEventListener('selectstart', function (e) {
        e.stopPropagation();
        return true;
    }, true);

    const css = `
    *, *::before, *::after {
      -webkit-user-select: auto !important;
      -moz-user-select: auto !important;
      -ms-user-select: auto !important;
      user-select: auto !important;
    }
  `;

    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
}

const ABSOLUTE_MODE = {
    events: [
        'copy', 'cut', 'paste', 'select', 'selectstart', 'contextmenu',
        'dragstart', 'mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup',
        'beforecopy', 'beforecut', 'beforepaste'
    ],
    cssProperties: [
        'user-select', '-webkit-user-select', '-moz-user-select', '-ms-user-select',
        'pointer-events', '-webkit-touch-callout'
    ]
};

function enableAbsoluteMode() {
    // Remove all event listeners that might block copying
    ABSOLUTE_MODE.events.forEach(event => {
        window.removeEventListener(event, preventEvent, true);
        document.removeEventListener(event, preventEvent, true);
        document.documentElement.removeEventListener(event, preventEvent, true);

        // Add our own event handlers
        document.addEventListener(event, allowEvent, true);
    });

    // Override preventDefault to prevent blocking
    const originalPreventDefault = Event.prototype.preventDefault;
    Event.prototype.preventDefault = function () {
        if (ABSOLUTE_MODE.events.includes(this.type)) {
            return false;
        }
        return originalPreventDefault.apply(this, arguments);
    };

    // Override getSelection
    const originalGetSelection = window.getSelection;
    window.getSelection = function () {
        const selection = originalGetSelection.apply(this, arguments);
        if (selection) {
            selection.removeAllRanges = function () { return true; };
        }
        return selection;
    };

    // Inject CSS to enable selection
    injectCopyEnablingStyles();
}

function injectCopyEnablingStyles() {
    const css = `
    *, *::before, *::after {
      ${ABSOLUTE_MODE.cssProperties.map(prop => `${prop}: auto !important`).join(';')}
    }
    
    [style*="user-select"], 
    [style*="pointer-events"], 
    [style*="webkit-user-select"],
    [unselectable="on"] {
      ${ABSOLUTE_MODE.cssProperties.map(prop => `${prop}: auto !important`).join(';')}
    }
    
    input, textarea {
      -webkit-user-select: text !important;
      user-select: text !important;
    }
  `;

    const style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
}

function allowEvent(e) {
    e.stopPropagation();
    return true;
}

function preventEvent(e) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();
}

// Remove copy protection dialogs
function removeCopyProtectionDialogs() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    // Check if it might be a dialog
                    if (
                        node.tagName === 'DIV' &&
                        (
                            node.style.position === 'fixed' ||
                            node.style.position === 'absolute'
                        ) &&
                        (
                            node.textContent.toLowerCase().includes('copy') ||
                            node.textContent.toLowerCase().includes('right') ||
                            node.textContent.toLowerCase().includes('click')
                        )
                    ) {
                        node.remove();
                    }
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Override common protection methods
function overrideProtectionMethods() {
    // Disable debug protection
    Object.defineProperty(window, 'debugger', {
        get: function () { return function () { }; }
    });

    // Override console methods that might be used for protection
    const noopFunc = function () { };
    ['debug', 'clear', 'error'].forEach(method => {
        console[method] = noopFunc;
    });

    // Override clipboard events
    document.oncopy = null;
    document.oncut = null;
    document.onpaste = null;

    // Clear intervals that might refresh protection
    const highestId = window.setInterval(() => { }, 0);
    for (let i = 0; i < highestId; i++) {
        window.clearInterval(i);
    }
}

// Initialize all features
function initializeFeatures() {
    enableAbsoluteMode();
    removeCopyProtectionDialogs();
    overrideProtectionMethods();

    // Force enable selection on dynamically added elements
    new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    node.removeAttribute('unselectable');
                    node.removeAttribute('oncopy');
                    node.removeAttribute('oncut');
                    node.removeAttribute('onpaste');
                    node.removeAttribute('oncontextmenu');
                    node.removeAttribute('onselectstart');
                }
            });
        });
    }).observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

// Start as soon as possible
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFeatures);
} else {
    initializeFeatures();
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateSettings') {
        const { settings } = message;
        initializeFeatures(settings);
        sendResponse({ success: true });
    }
});

// Create custom context menu
document.addEventListener('contextmenu', function (e) {
    const selectedText = window.getSelection().toString();
    if (selectedText) {
        chrome.runtime.sendMessage({
            action: 'updateContextMenu',
            selectedText: selectedText
        });
    }
});

function spoofVisibilityState() {
    // Override visibility state properties
    Object.defineProperty(document, 'hidden', {
        get: function () {
            return false;
        }
    });

    Object.defineProperty(document, 'visibilityState', {
        get: function () {
            return 'visible';
        }
    });

    // Chrome-specific
    Object.defineProperty(document, 'webkitHidden', {
        get: function () {
            return false;
        }
    });

    // Firefox-specific
    Object.defineProperty(document, 'mozHidden', {
        get: function () {
            return false;
        }
    });

    // Spoof visibility change events
    const nullifyEvent = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Create a fake visible state event
    const fakeVisibleEvent = new Event('visibilitychange');
    Object.defineProperty(fakeVisibleEvent, 'target', {
        get: function () {
            return {
                visibilityState: 'visible',
                hidden: false
            };
        }
    });

    // Override visibility change events
    document.addEventListener('visibilitychange', nullifyEvent, true);
    document.addEventListener('webkitvisibilitychange', nullifyEvent, true);
    document.addEventListener('mozvisibilitychange', nullifyEvent, true);

    // Override blur and mouseleave events
    window.addEventListener('blur', nullifyEvent, true);
    document.addEventListener('mouseleave', nullifyEvent, true);

    // Dispatch fake visible state
    document.dispatchEvent(fakeVisibleEvent);
}

// Keep the tab active by responding to background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'keepAlive') {
        sendResponse({ status: 'alive' });
    }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateSettings') {
        const { settings } = message;

        // Apply the settings dynamically
        if (settings.copyProtection) {
            document.addEventListener('contextmenu', preventDefault);
        } else {
            document.removeEventListener('contextmenu', preventDefault);
        }

        if (settings.alwaysActive) {
            const observer = new MutationObserver(() => document.title = "Active");
            observer.observe(document, { subtree: true, childList: true });
        }

        if (settings.dialogRemover) {
            const removePopups = () => {
                const dialogs = document.querySelectorAll('div[role="dialog"], .popup');
                dialogs.forEach(dialog => dialog.remove());
            };
            setInterval(removePopups, 1000);
        }

        sendResponse({ success: true });
    }
});

function preventDefault(event) {
    event.preventDefault();
}
