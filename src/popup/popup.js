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
            
            // Aksiyon İkonları
            let actionIcon = "🖱️";
            if (step.action === "sendKeys") actionIcon = "⌨️";
            if (step.action === "selectOption") actionIcon = "🔽";
            if (step.action === "pressKey") actionIcon = "↩️";
            if (step.action === "assertText") actionIcon = "✅"; 

            const iframeTag = step.iframeId && step.iframeId !== "null" ? `<small style="color:#f39c12;">[Ifr: ${step.iframeId}]</small> ` : '';
            const shortText = step.text ? ` -> "<i>${step.text.substring(0,15)}</i>"` : '';
            
            let displayLocator = "";
            if (step.locator) {
                displayLocator = step.locator.length > 30 ? step.locator.substring(0, 30) + "..." : step.locator;
            } else {
                displayLocator = "Locator Yok"; 
            }
            
            infoDiv.innerHTML = `<strong>${index + 1}:</strong> ${actionIcon} ${iframeTag}<code>${displayLocator}</code>${shortText}`;

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
            
            // YENİ PROMPT: Loglama (Element İsimlendirme) özelliği eklendi!
            const prompt = `
            Sen kıdemli bir SDET'sin. Sana verilen adımları KESİNLİKLE "${framework}" framework'ünün kendi sözdizimine (syntax) ve best-practice'lerine uygun olarak yaz.
            
            KATI MİMARİ KURALLAR (POM - Action Based):
            1. ELEMENT TANIMLAMA (HAYATİ ÖNEMDE): 
               - Tüm elementleri KESİNLİKLE sınıfın en üstünde, seçilen framework'e uygun olarak tanımla (Örn: Selenium için @FindBy, Playwright için sayfa başında locator).
               - YASAK: Sınıf içinde 'driver.findElement()' kullanan veya element bulan yardımcı metodlar (örn: findElementByXPath) KESİNLİKLE YAZMAYACAKSIN!
            2. KESİN TEK METOD KURALI: 
               - Page sınıfı içinde tüm adımları çalıştıran tek bir ana metod oluşturacaksın.
               - YASAK: Her element için ayrı ayrı gibi metodlar OLUŞTURMAYACAKSIN. Etkileşimler doğrudan oluşturduğun tek metod içinde olacak.
            3. DİNAMİK BASE CLASS ADAPTASYONU VE LOGLAMA (YENİ KURAL): 
               - Sana gönderilen varsa 'BASE PAGE' kodundaki özel metodları kullan.
               - DİKKAT: Bu metodlar loglama ve raporlama (Allure, Extent vb.) için fazladan bir parametre alıyorsa, ORAYA 'null' YAZMA!
               - Adımlardaki 'text', 'tag' veya HTML içeriğini analiz ederek o elementin ne olduğunu anlatan KISA ve TÜRKÇE BİR İSİM üret ve o parametreye gönder. (Örn: "Araba Sat Butonu", "Plaka Giriş Alanı", "Yıl Seçimi").
            4. LOCATOR STRATEJİSİ: 
               - Sana her adım için 'locator' ve 'htmlContext' gönderiyorum. Absolute XPath KESİNLİKLE KULLANMA.
               - 'htmlContext' verisine bakarak EN STABİL, EN BENZERSİZ locator'ı (id, data-*, name, benzersiz class/XPath) SEN OLUŞTUR.
                Bir element için locator seçerken şu sırayı takip et:
                a) Varsa benzersiz ID (Örn: @FindBy(id = "login-button"))
                b) Varsa Test ID'leri (data-testid, data-qa, data-cy vb.)
                c) Varsa benzersiz Name veya Placeholder.
                d) Eğer yukarıdakiler yoksa, METİN içeren XPath (Örn: //button[contains(text(),'Kaydet')]).
                e) ASLA ama ASLA '__next' veya 'div/div/div' gibi kırılgan, uzun ve mutlak (absolute) yolları kullanma. 
                f) Eğer element bir ikon ise, yanındaki metni veya 'title'/'aria-label' niteliğini kullan.

            5. TEST CLASS & DOĞRULAMA (ASSERTION): 
               - EĞER adımların içinde 'assertText' action'ı varsa, bunu Page sınıfındaki  metodunun sonuna ekle (örn: Assert.assertEquals).

            ÖRNEK BEKLENEN PAGE CLASS YAPISI (BUNU BAZ AL):
            public class OrnekPage extends BasePage {
                @FindBy(id = "username") private WebElement usernameInput;
                @FindBy(xpath = "//button[text()='Login']") private WebElement loginBtn;
                
                public OrnekPage(WebDriver driver) { super(driver); }
                
                public void executeWorkflow() {
                    
                    sendText(usernameInput, "testuser", "Kullanıcı Adı Alanı");
                    // Eğer assertText adımı buradaysa, tam sırasına koy:
        Assert.assertEquals(welcomeMsg.getText(), "Hoşgeldin", "Giriş mesajı hatalı!"
                    clickElement(loginBtn, "Giriş Yap Butonu");
                }
            }
            
            ÇIKTI FORMATI: Mutlaka aşağıdaki etiketleri kullanarak kodları ikiye böl. Açıklama yapma:
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