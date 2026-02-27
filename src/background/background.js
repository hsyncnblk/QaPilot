chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "qa-pilot-assert",
        title: "✅ QA-Pilot: Bu Elementi Doğrula (Assert)",
        contexts: ["all"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "qa-pilot-assert") {
        chrome.tabs.sendMessage(tab.id, { action: "assert_element" });
    }
});