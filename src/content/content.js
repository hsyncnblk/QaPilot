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
    const locator = getBestLocator(element);
    
    saveStep({
        action: "click",
        locator: locator,
        tag: element.tagName.toLowerCase(),
        text: element.innerText ? element.innerText.substring(0, 50).trim() : ""
    });
}, true);

// 4. Metin Girişlerini (sendKeys) Yakala
document.addEventListener("blur", function(event) {
    if (!isRecording) return;

    const element = event.target;
    // Sadece yazı yazılabilir alanları dinle
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

// Yardımcı Fonksiyon: Hafızaya Kaydet
function saveStep(actionData) {
    chrome.storage.local.get(['recordedSteps'], (result) => {
        let steps = result.recordedSteps || [];
        steps.push(actionData);
        chrome.storage.local.set({ recordedSteps: steps });
        console.log("✅ QA-Pilot Adım Kaydedildi:", actionData);
    });
}

// Akıllı Seçici Bulma
function getBestLocator(el) {
    if (el.getAttribute("data-testid")) return `[data-testid="${el.getAttribute("data-testid")}"]`;
    if (el.getAttribute("data-cy")) return `[data-cy="${el.getAttribute("data-cy")}"]`;
    if (el.id) return `#${el.id}`;
    if (el.getAttribute("name")) return `[name="${el.getAttribute("name")}"]`;
    if (el.className && typeof el.className === "string") {
        const classes = el.className.trim().split(/\s+/).join('.');
        if (classes) return `.${classes}`;
    }
    return el.tagName.toLowerCase();
}