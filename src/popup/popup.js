import { CONFIG } from '../utils/config.js';

const recordBtn = document.getElementById('recordToggleBtn');
const stepList = document.getElementById('stepList');
const clearBtn = document.getElementById('clearBtn');
const codeEditor = document.getElementById('codeEditor');
const frameworkSelect = document.getElementById('framework');

// 1. Sayfa açıldığında: Kaydedilen adımları VE daha önce üretilmiş kodu yükle
chrome.storage.local.get(['isRecording', 'recordedSteps', 'lastGeneratedCode'], (result) => {
    updateButtonUI(result.isRecording || false);
    renderSteps(result.recordedSteps || []);
    
    // Eğer önceden üretilmiş bir kod varsa onu ekrana geri getir
    if (result.lastGeneratedCode) {
        codeEditor.innerText = result.lastGeneratedCode;
    }
});

// 2. Canlı hafıza takibi
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.recordedSteps || changes.isRecording)) {
        chrome.storage.local.get(['isRecording', 'recordedSteps'], (res) => {
            updateButtonUI(res.isRecording || false);
            renderSteps(res.recordedSteps || []);
        });
    }
});

// 3. Kayıt buton mantığı
recordBtn.addEventListener('click', () => {
    chrome.storage.local.get(['isRecording'], (result) => {
        chrome.storage.local.set({ isRecording: !result.isRecording });
    });
});

// 4. Adımları Listeleme
function renderSteps(steps) {
    stepList.innerHTML = ""; 
    if (!steps || steps.length === 0) {
        stepList.innerHTML = "<li>Henüz bir işlem kaydedilmedi.</li>";
        return;
    }
    steps.forEach((step, index) => {
        const li = document.createElement('li');
        const isClick = step.action === "click";
        const actionIcon = isClick ? "🖱️" : "⌨️";
        const shortText = step.text ? ` -> "<i>${step.text.substring(0,20)}</i>"` : '';
        li.innerHTML = `<strong>${index + 1}:</strong> ${actionIcon} -> <code>${step.locator}</code>${shortText}`;
        stepList.appendChild(li);
    });
}

// 5. Temizle Butonu: Hem adımları hem de üretilen kodu siler
clearBtn.addEventListener('click', () => {
    chrome.storage.local.set({ 
        recordedSteps: [], 
        lastGeneratedCode: "" // Üretilen kodu da temizle
    }, () => {
        codeEditor.innerText = "// Seçtiğiniz framework'e uygun test kodu buraya yazılacak...";
    });
});

// 6. 🧠 AI KOD ÜRETME VE KAYDETME
document.getElementById('generateBtn').addEventListener('click', async () => {
    const frameworkName = frameworkSelect.options[frameworkSelect.selectedIndex].text;
    
    chrome.storage.local.get(['recordedSteps'], async (result) => {
        const steps = result.recordedSteps || [];
        if (steps.length === 0) return;

        codeEditor.innerText = `// 🧠 Gemini AI analiz ediyor...`;
        
        const prompt = `
        Sen kıdemli bir SDET Mühendisisin. Aşağıdaki JSON adımlarını profesyonel "${frameworkName}" koduna çevir.
        
        Kurallar:
        1. Action "click" ise .click(), "sendKeys" ise .sendKeys() kullan.
        2. Selenium Java POM ise @FindBy kullan.
        3. Sadece kodu ver, açıklama yapma.

        Adımlar:
        ${JSON.stringify(steps, null, 2)}
        `;

        try {
            const modelName = "gemini-2.5-flash-lite"; 
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            let generatedCode = data.candidates[0].content.parts[0].text;
            generatedCode = generatedCode.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();

            // KODU EKRANA YAZ VE HAFIZAYA KAYDET
            codeEditor.innerText = generatedCode;
            chrome.storage.local.set({ lastGeneratedCode: generatedCode });

        } catch (error) {
            codeEditor.innerText = `// ❌ AI Hatası: ${error.message}`;
        }
    });
});

// UI Güncelleme
function updateButtonUI(isRecording) {
    recordBtn.innerHTML = isRecording ? "⏹ Kaydı Durdur" : "🔴 Kaydı Başlat";
    recordBtn.className = isRecording ? "record-btn btn-stop" : "record-btn btn-start";
}

// Kopyalama
document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(codeEditor.innerText);
    const originalText = document.getElementById('copyBtn').innerHTML;
    document.getElementById('copyBtn').innerHTML = "✅ Kopyalandı!";
    setTimeout(() => document.getElementById('copyBtn').innerHTML = originalText, 2000);
});