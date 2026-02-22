import { CONFIG } from '../utils/config.js';

document.addEventListener('DOMContentLoaded', () => {
    // UI Elementleri
    const recordBtn = document.getElementById('recordToggleBtn');
    const stepList = document.getElementById('stepList');
    const frameworkSelect = document.getElementById('framework');
    
    // Sekme ve Editor Elementleri
    const tabPageBtn = document.getElementById('tabPageBtn');
    const tabTestBtn = document.getElementById('tabTestBtn');
    const pageCodeEditor = document.getElementById('pageCodeEditor');
    const testCodeEditor = document.getElementById('testCodeEditor');
    
    // Ayarlar & Diğer Butonlar
    const toggleSettings = document.getElementById('toggleSettings');
    const settingsContent = document.getElementById('settingsContent');
    const basePageInput = document.getElementById('basePageInput');
    const baseTestInput = document.getElementById('baseTestInput');
    const clearStepsBtn = document.getElementById('clearStepsBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const copyBtn = document.getElementById('copyBtn');

    // --- AKORDEON MENÜ ---
    toggleSettings.addEventListener('click', () => {
        const isVisible = settingsContent.style.display === 'block';
        settingsContent.style.display = isVisible ? 'none' : 'block';
        toggleSettings.querySelector('span').innerText = isVisible ? '▲' : '▼';
    });

    
    tabPageBtn.addEventListener('click', () => {
        tabPageBtn.classList.add('active');
        tabTestBtn.classList.remove('active');
        pageCodeEditor.classList.add('active');
        testCodeEditor.classList.remove('active');
    });

    tabTestBtn.addEventListener('click', () => {
        tabTestBtn.classList.add('active');
        tabPageBtn.classList.remove('active');
        testCodeEditor.classList.add('active');
        pageCodeEditor.classList.remove('active');
    });

 
    function deleteStep(index) {
        chrome.storage.local.get(['recordedSteps'], (res) => {
            let steps = res.recordedSteps || [];
            steps.splice(index, 1);
            chrome.storage.local.set({ recordedSteps: steps }, () => {
                renderSteps(steps); 
            });
        });
    }

    
    function renderSteps(steps) {
        stepList.innerHTML = ""; 
        if (!steps || steps.length === 0) {
            stepList.innerHTML = "<li>Henüz bir işlem kaydedilmedi.</li>";
            return;
        }
        
        steps.forEach((step, index) => {
            const li = document.createElement('li');
            li.className = "step-item";
            li.style.display = "flex";
            li.style.justifyContent = "space-between";
            li.style.alignItems = "center";
            li.style.borderBottom = "1px solid #f1f2f6";
            li.style.padding = "4px 0";

            // Sol Kısım
            const infoDiv = document.createElement('div');
            infoDiv.style.flexGrow = "1";
            infoDiv.style.overflow = "hidden";
            const actionIcon = step.action === "click" ? "🖱️" : "⌨️";
            const iframeTag = step.iframeId ? `<small style="color:#f39c12;">[Ifr: ${step.iframeId}]</small> ` : '';
            const shortText = step.text ? ` -> "<i>${step.text.substring(0,15)}</i>"` : '';
            infoDiv.innerHTML = `<strong>${index + 1}:</strong> ${actionIcon} ${iframeTag}<code>${step.locator}</code>${shortText}`;

            // Sağ Kısım (X Butonu)
            const delBtn = document.createElement('button');
            delBtn.innerText = "×";
            delBtn.style.cssText = "background:none; border:none; color:#e74c3c; cursor:pointer; font-weight:bold; font-size:18px; padding-left:10px;";
            
            delBtn.addEventListener('click', () => {
                deleteStep(index);
            });

            li.appendChild(infoDiv);
            li.appendChild(delBtn);
            stepList.appendChild(li);
        });
    }

   
    chrome.storage.local.get(['isRecording', 'recordedSteps', 'lastPageCode', 'lastTestCode', 'basePageCode', 'baseTestCode'], (res) => {
        updateButtonUI(res.isRecording || false);
        renderSteps(res.recordedSteps || []);
        
        if (res.lastPageCode) pageCodeEditor.innerText = res.lastPageCode;
        if (res.lastTestCode) testCodeEditor.innerText = res.lastTestCode;
        if (res.basePageCode) basePageInput.value = res.basePageCode;
        if (res.baseTestCode) baseTestInput.value = res.baseTestCode;
    });

    basePageInput.addEventListener('input', () => chrome.storage.local.set({ basePageCode: basePageInput.value }));
    baseTestInput.addEventListener('input', () => chrome.storage.local.set({ baseTestCode: baseTestInput.value }));

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && (changes.recordedSteps || changes.isRecording)) {
            chrome.storage.local.get(['isRecording', 'recordedSteps'], (res) => {
                updateButtonUI(res.isRecording || false);
                renderSteps(res.recordedSteps || []);
            });
        }
    });

    recordBtn.addEventListener('click', () => {
        chrome.storage.local.get(['isRecording'], (res) => {
            chrome.storage.local.set({ isRecording: !res.isRecording });
        });
    });

    clearStepsBtn.addEventListener('click', () => {
        chrome.storage.local.set({ recordedSteps: [], lastPageCode: "", lastTestCode: "" }, () => {
            pageCodeEditor.innerText = "// Adımlar temizlendi.";
            testCodeEditor.innerText = "// Adımlar temizlendi.";
            renderSteps([]);
        });
    });

    clearAllBtn.addEventListener('click', () => {
        if(confirm("Tüm ayarlar ve Base sınıfları silinecek. Emin misin?")) {
            chrome.storage.local.clear(() => location.reload());
        }
    });

  
    document.getElementById('generateBtn').addEventListener('click', async () => {
        const framework = frameworkSelect.options[frameworkSelect.selectedIndex].text;
        
        chrome.storage.local.get(['recordedSteps', 'basePageCode', 'baseTestCode'], async (res) => {
            const steps = res.recordedSteps || [];
            if (steps.length === 0) return;

            pageCodeEditor.innerText = `// 🧠 Gemini AI (${framework}) Page kodunu hazırlıyor...`;
            testCodeEditor.innerText = `// 🧠 Gemini AI (${framework}) Test kodunu hazırlıyor...`;
            
            const prompt = `
            Sen kıdemli bir SDET'sin. Sana verilen adımları KESİNLİKLE "${framework}" framework'ünün kendi sözdizimine (syntax) ve best-practice'lerine uygun olarak yaz.
            
            KATI MİMARİ KURALLAR (POM - Action Based):
            1. PAGE CLASS: 
               - Seçilen framework'ün standartlarına göre Page sınıfını oluştur (Eğer BasePage verilmişse ondan türet).
               - Element tanımlamalarını seçilen framework'e uygun yap (Örn: Selenium ise @FindBy, Playwright ise page.locator() vb.).
               - EN ÖNEMLİSİ: Tüm adımları çalıştıran ve en sonunda DOĞRULAMA (Assert) işlemini yapan tek bir ana "İş Akışı" metodu yaz (Örn: completeWorkflowAndVerify() ). Doğrulama (Assert) KESİNLİKLE bu sınıfın içinde olmalıdır!
            2. TEST CLASS: 
               - Seçilen framework'ün Test koşucusuna (Test Runner) uygun bir test sınıfı üret (Eğer BaseTest verilmişse ondan türet).
               - TEST SINIFI SADECE YÖNETİCİDİR. Test metodunun içinde element seviyesi eylemler (click, fill, sendKeys, getText, Assert vb.) KESİNLİKLE KULLANILAMAZ!
               - Sadece ilgili sayfaya git, Page objesini oluştur ve Page sınıfındaki o ana metodu (completeWorkflowAndVerify) çağır.
            3. ÇIKTI FORMATI: Mutlaka aşağıdaki etiketleri kullanarak kodları ikiye böl. Açıklama yapma:
            <page>
            // Page Class kodları buraya
            </page>
            <test>
            // Test Class kodları buraya
            </test>

            BASE PAGE: ${res.basePageCode || "Yok"}
            BASE TEST: ${res.baseTestCode || "Yok"}
            ADIMLAR: ${JSON.stringify(steps, null, 2)}
            `;

            try {
                const model = "gemini-2.5-flash-lite"; 
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                const data = await response.json();
                let fullText = data.candidates[0].content.parts[0].text;
                
                const pageMatch = fullText.match(/<page>([\s\S]*?)<\/page>/i);
                const testMatch = fullText.match(/<test>([\s\S]*?)<\/test>/i);

                let pageCode = pageMatch ? pageMatch[1].replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim() : "// Page kodu ayrıştırılamadı.\n" + fullText;
                let testCode = testMatch ? testMatch[1].replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim() : "// Test kodu ayrıştırılamadı.";

                pageCodeEditor.innerText = pageCode;
                testCodeEditor.innerText = testCode;
                chrome.storage.local.set({ lastPageCode: pageCode, lastTestCode: testCode });

            } catch (error) {
                pageCodeEditor.innerText = `// ❌ Hata: ${error.message}`;
                testCodeEditor.innerText = `// ❌ Hata: ${error.message}`;
            }
        });
    });

    // --- KOPYALAMA ---
    copyBtn.addEventListener('click', () => {
        const activeEditor = pageCodeEditor.classList.contains('active') ? pageCodeEditor : testCodeEditor;
        navigator.clipboard.writeText(activeEditor.innerText);
        
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = "✅ Kopyalandı!";
        setTimeout(() => copyBtn.innerHTML = originalText, 2000);
    });

    function updateButtonUI(isRecording) {
        recordBtn.innerHTML = isRecording ? "⏹ Durdur" : "🔴 Başlat";
        recordBtn.className = `record-btn ${isRecording ? 'btn-stop' : 'btn-start'}`;
    }
});