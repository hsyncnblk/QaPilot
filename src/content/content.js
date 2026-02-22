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

// 5. Gelişmiş Kayıt Fonksiyonu (Iframe Destekli)
function saveStep(actionData) {
    chrome.storage.local.get(['recordedSteps'], (result) => {
        let steps = result.recordedSteps || [];

        // 🚀 Iframe Bilgisini Ekle
        // Eğer bu script bir iframe içinde çalışıyorsa frame'in ID veya Name'ini alır
        const iframeId = window.self !== window.top ? 
            (window.name || window.frameElement?.id || "active-iframe") : null;

        const enrichedData = {
            ...actionData,
            iframeId: iframeId, // Iframe bilgisi buraya ekleniyor
            timestamp: new Date().getTime()
        };

        steps.push(enrichedData);
        chrome.storage.local.set({ recordedSteps: steps });
        console.log("✅ QA-Pilot Adım Kaydedildi:", enrichedData);
    });
}

// 6. Akıllı Seçici Bulma
function getBestLocator(el) {
    if (el.getAttribute("data-testid")) return `[data-testid="${el.getAttribute("data-testid")}"]`;
    if (el.getAttribute("data-cy")) return `[data-cy="${el.getAttribute("data-cy")}"]`;
    if (el.id) return `#${el.id}`;
    if (el.getAttribute("name")) return `[name="${el.getAttribute("name")}"]`;
    
    // Klas isimlerini daha temiz yakala
    if (el.className && typeof el.className === "string") {
        const classes = el.className.trim().split(/\s+/).filter(c => c).join('.');
        if (classes) return `.${classes}`;
    }
    
    // XPath fallback (Eğer üsttekiler yoksa)
    return getXPath(el);
}

// Yardımcı: XPath Oluşturucu
function getXPath(element) {
    if (element.id !== '') return `//*[@id="${element.id}"]`;
    if (element === document.body) return '/html/body';

    let ix = 0;
    let siblings = element.parentNode.childNodes;
    for (let i = 0; i < siblings.length; i++) {
        let sibling = siblings[i];
        if (sibling === element) return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
    }
}