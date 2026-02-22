let isRecording = false;

// 1. Durumu hafızadan al
chrome.storage.local.get(['isRecording'], (result) => {
    isRecording = result.isRecording || false;
});

// 2. Canlı durum takibi
chrome.storage.onChanged.addListener((changes) => {
    if (changes.isRecording) {
        isRecording = changes.isRecording.newValue;
    }
});

// 3. Tıklamaları Yakala
document.addEventListener("click", function(event) {
    if (!isRecording) return; 

    const element = event.target;
    
    saveStep({
        action: "click",
        locator: getBestLocator(element),
        tag: element.tagName.toLowerCase(),
        text: element.innerText ? element.innerText.substring(0, 50).trim() : ""
    });
}, true);

// 4. Metin Girişlerini Yakala
document.addEventListener("blur", function(event) {
    if (!isRecording) return;

    const element = event.target;
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable) {
        const value = element.value || element.innerText;
        if (!value) return; 

        saveStep({
            action: "sendKeys",
            locator: getBestLocator(element),
            tag: element.tagName.toLowerCase(),
            text: value.substring(0, 100) 
        });
    }
}, true);

function saveStep(actionData) {
    chrome.storage.local.get(['recordedSteps'], (result) => {
        let steps = result.recordedSteps || [];

        let isInsideIframe = false;
        try {
            isInsideIframe = window.self !== window.top;
        } catch (e) {
            isInsideIframe = true; 
        }

        let finalIframeId = null; 

        if (isInsideIframe) {
            try {
                finalIframeId = (window.frameElement && window.frameElement.id) ? window.frameElement.id : window.name;
            } catch (e) {
               
            }
            
            if (!finalIframeId || finalIframeId.trim() === "") {
                finalIframeId = "active-iframe";
            }
        }

        const enrichedData = {
            ...actionData,
            iframeId: finalIframeId, 
            timestamp: new Date().getTime()
        };

        steps.push(enrichedData);
        chrome.storage.local.set({ recordedSteps: steps });
        console.log("✅ QA-Pilot Adım Kaydedildi:", enrichedData);
    });
}

function getBestLocator(el) {
    if (el.getAttribute("data-testid")) return `[data-testid="${el.getAttribute("data-testid")}"]`;
    if (el.getAttribute("data-cy")) return `[data-cy="${el.getAttribute("data-cy")}"]`;
    if (el.id) return `#${el.id}`;
    if (el.getAttribute("name")) return `[name="${el.getAttribute("name")}"]`;
    
    if (el.className && typeof el.className === "string") {
        const classes = el.className.trim().split(/\s+/).filter(c => c && !c.includes(':') && !c.includes('['));
        if (classes.length > 0) return `.${classes.join('.')}`;
    }
    
    return getXPath(el);
}


function getXPath(element) {
    if (!element || element === document.body) return '/html/body';
    if (element.id && element.id !== '') return `//*[@id="${element.id}"]`;

    let ix = 0;
    let siblings = element.parentNode ? element.parentNode.childNodes : [];
    for (let i = 0; i < siblings.length; i++) {
        let sibling = siblings[i];
        if (sibling === element) return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
    }
    return '';
}