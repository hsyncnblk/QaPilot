// --- GLOBAL DEĞİŞKENLER & DURUM ---
let isRecording = false;
let lastRightClickedElement = null;

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

// Helper: Elementin HTML yapısını Gemini için sınırlandırarak al
function getHtmlContext(el) {
    if (!el || !el.outerHTML) return "";
    let html = el.outerHTML;
    // Token tasarrufu ve performans için HTML'i kesiyoruz
    return html.length > 300 ? html.substring(0, 300) + "...>" : html;
}

// --- YENİ: BENZERSİZLİK KONTROLÜ ---
// Bulunan locator sayfada SADECE 1 elementi mi işaret ediyor?
function isUnique(locator) {
    if (!locator) return false;
    try {
        // Eğer XPath ise
        if (locator.startsWith('/') || locator.startsWith('(')) {
            const result = document.evaluate(locator, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            return result.snapshotLength === 1;
        }
        // Eğer CSS Selector ise
        return document.querySelectorAll(locator).length === 1;
    } catch (e) {
        return false; // Geçersiz selector hatasını yut ve false dön
    }
}

// --- GÜNCELLENMİŞ: AKILLI LOCATOR MOTORU ---
function getBestLocator(el) {
    const tag = el.tagName.toLowerCase();
    let candidate = "";

    // 1. En Güvenilir Öncelik: Test Attribute'ları
    const testAttrs = ["data-testid", "data-qa", "data-cy", "data-test"];
    for (let attr of testAttrs) {
        if (el.hasAttribute(attr)) {
            candidate = `[${attr}="${el.getAttribute(attr)}"]`;
            if (isUnique(candidate)) return candidate;
        }
    }

    // 2. ID Stratejisi (Dinamik/Rakam içeren ID'leri reddet)
    if (el.id && !/\d+/.test(el.id) && el.id.length > 2) {
        candidate = `#${el.id}`;
        if (isUnique(candidate)) return candidate;
    }

    // 3. Name Attribute (Form elemanları için kusursuz)
    if (el.name) {
        candidate = `[name="${el.name}"]`;
        if (isUnique(candidate)) return candidate;
    }

    // 4. Placeholder ve Aria-Label (Angular/Material inputları için)
    if (el.placeholder) {
        candidate = `//${tag}[@placeholder='${el.placeholder}']`;
        if (isUnique(candidate)) return candidate;
    }
    if (el.getAttribute("aria-label")) {
        candidate = `//${tag}[@aria-label='${el.getAttribute("aria-label")}']`;
        if (isUnique(candidate)) return candidate;
    }

    // 5. Akıllı Class Filtreleme (Zararlı ve dinamik classları at)
    if (el.className && typeof el.className === "string") {
        const badPrefixes = ['ng-', 'mat-', 'cdk-', 'v-', 'tw-', 'hover:', 'focus:'];
        const cleanClasses = el.className.trim().split(/\s+/).filter(c => {
            if (!c || c.length < 3) return false; // Çok kısa classları at
            if (/\d/.test(c)) return false; // İçinde rakam olanları at
            if (badPrefixes.some(prefix => c.startsWith(prefix))) return false; // Framework çöplerini at
            return true;
        });

        if (cleanClasses.length > 0) {
            candidate = `${tag}.${cleanClasses[0]}`; // Sadece ilk temiz class
            if (isUnique(candidate)) return candidate;
            
            // Eğer tek class yetmiyorsa, hepsini birleştirip dene
            candidate = `${tag}.${cleanClasses.join('.')}`;
            if (isUnique(candidate)) return candidate;
        }
    }

    // 6. Metin İçeriği (Buton ve Linkler için)
    if ((tag === 'button' || tag === 'a') && el.innerText.trim()) {
        const cleanText = el.innerText.trim().substring(0, 30);
        candidate = `//${tag}[normalize-space(text())='${cleanText}']`;
        if (isUnique(candidate)) return candidate;
    }

    // 7. Value Attribute (Örn: submit butonları için)
    if (el.value && el.type !== 'password' && el.type !== 'hidden') {
         candidate = `//${tag}[@value='${el.value}']`;
         if (isUnique(candidate)) return candidate;
    }

    // 8. Son Çare: Göreceli (Relative) CSS Yolu (Absolute XPath silindi!)
    return getRelativeCssPath(el);
}

// --- YENİ: ABSOLUTE XPATH YERİNE RELATIVE CSS PATH ---
function getRelativeCssPath(el) {
    if (!(el instanceof Element)) return;
    const path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.id && !/\d+/.test(el.id)) {
            selector += '#' + el.id;
            path.unshift(selector);
            break; // Güvenilir bir ID bulduk, daha yukarı çıkmaya gerek yok
        } else {
            let sib = el, nth = 1;
            while (sib = sib.previousElementSibling) {
                if (sib.nodeName.toLowerCase() == selector) nth++;
            }
            if (nth != 1) selector += `:nth-of-type(${nth})`;
        }
        path.unshift(selector);
        el = el.parentNode;
    }
    return path.join(' > ');
}

// --- ORTAK ADIM KAYDETME FONKSİYONU ---
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
            } catch (e) { }
            
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

// --- EVENT LİSTENER'LAR ---

// 3. Tıklamaları Yakala
document.addEventListener("click", function(event) {
    if (!isRecording) return; 

    const element = event.target;
    saveStep({
        action: "click",
        locator: getBestLocator(element),
        tag: element.tagName.toLowerCase(),
        text: element.innerText ? element.innerText.substring(0, 50).trim() : "",
        htmlContext: getHtmlContext(element)
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
            text: value.substring(0, 100),
            htmlContext: getHtmlContext(element)
        });
    }
}, true);

// 5. Dropdown (Select) Seçimlerini Yakala
document.addEventListener("change", function(event) {
    if (!isRecording) return;

    const element = event.target;
    if (element.tagName === 'SELECT') {
        const selectedText = element.options[element.selectedIndex] ? element.options[element.selectedIndex].text : "";
        saveStep({
            action: "selectOption",
            locator: getBestLocator(element),
            tag: "select",
            text: selectedText.substring(0, 50),
            value: element.value,
            htmlContext: getHtmlContext(element)
        });
    }
}, true);

// 6. Kritik Klavye Tuşlarını Yakala (Enter vb.)
document.addEventListener("keydown", function(event) {
    if (!isRecording) return;

    if (event.key === "Enter") {
        const element = event.target;
        saveStep({
            action: "pressKey",
            locator: getBestLocator(element),
            tag: element.tagName.toLowerCase(),
            text: "Enter",
            htmlContext: getHtmlContext(element)
        });
    }
}, true);

// --- SAĞ TIK ASSERTION YÖNETİMİ ---
// Sağ tıklanan elementi takip et
document.addEventListener("contextmenu", function(event) {
    if (!isRecording) return;
    lastRightClickedElement = event.target;
}, true);

// Background script'ten gelen Assertion mesajını dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "assert_element" && lastRightClickedElement && isRecording) {
        
        const textToAssert = lastRightClickedElement.innerText ? 
                             lastRightClickedElement.innerText.trim() : 
                             lastRightClickedElement.value;
        
        if (textToAssert) {
            saveStep({
                action: "assertText",
                locator: getBestLocator(lastRightClickedElement),
                tag: lastRightClickedElement.tagName.toLowerCase(),
                text: textToAssert.substring(0, 100),
                htmlContext: getHtmlContext(lastRightClickedElement)
            });
            
            // Görsel geri bildirim (Yeşil parlama)
            let originalOutline = lastRightClickedElement.style.outline;
            lastRightClickedElement.style.outline = "3px solid #27ae60";
            setTimeout(() => { lastRightClickedElement.style.outline = originalOutline; }, 1000);
        }
    }
});