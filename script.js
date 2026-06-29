const API_BASE_URL = "https://backend-11zq.onrender.com"; 

// 🛑 កន្លែងកំណត់ TELEGRAM BOT (Task 3)
const TELEGRAM_BOT_TOKEN = "8998859713:AAFOvcttVnqZip52L3dhtPFvWFaTrgQ4TGY";
// ⚠️ អ្នកត្រូវដាក់លេខ ID របស់ Group ត្រង់នេះ! (ឧទាហរណ៍: -100123456789)
// របៀបរក: ទាញ @RawDataBot ចូល Group រួចយកលេខ ID ដែលវាលោតប្រាប់ មកដាក់ត្រង់នេះ។
const TELEGRAM_CHAT_ID = "--1004495647556"; 

let currentOrder = { category: '', value: '', price: 0, ign: '', email: '', platform: '' };
let countdownInterval = null;
let statusPollInterval = null;

// 🔄 មុខងារគ្រប់គ្រងការប្តូរទំព័រ 
function showPage(pageId) {
    document.querySelectorAll('.store-page').forEach(page => page.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    if(pageId === 'rank') backToSelectStep();
}

// 🛒 មុខងារចុចជ្រើសរើសទំនិញ
function selectItem(category, value, price) {
    currentOrder.category = category;
    currentOrder.value = value;
    currentOrder.price = price;
    document.querySelectorAll('.rank-card').forEach(card => card.classList.remove('selected'));
    document.getElementById(`card-${value}`).classList.add('selected');
}

// ➡️ ទៅកាន់ទម្រង់បំពេញព័ត៌មាន 
function goToFormStep() {
    if (!currentOrder.value) return alert("❌ សូមមេត្តាជ្រើសរើសយក Rank ណាមួយជាមុនសិន!");
    document.getElementById('rank-step-select').classList.remove('active');
    document.getElementById('rank-step-form').classList.add('active');
}

function backToSelectStep() {
    document.getElementById('rank-step-form').classList.remove('active');
    document.getElementById('rank-step-checkout').classList.remove('active');
    document.getElementById('rank-step-select').classList.add('active');
}

// ➡️ ទៅកាន់ទំព័រ Checkout
function goToCheckoutStep() {
    const ign = document.getElementById('input-ign').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const platform = document.getElementById('input-platform').value;

    if (!ign || !email) return alert("❌ សូមបំពេញព័ត៌មានចាំបាច់ IGN និង Email ឱ្យបានគ្រប់ជ្រុងជ្រោយ!");

    currentOrder.ign = ign;
    currentOrder.email = email;
    currentOrder.platform = platform;

    document.getElementById('chk-category').innerText = currentOrder.category.toUpperCase();
    document.getElementById('chk-item').innerText = currentOrder.value.toUpperCase();
    document.getElementById('chk-ign').innerText = currentOrder.ign;
    document.getElementById('chk-email').innerText = currentOrder.email;
    document.getElementById('chk-platform').innerText = currentOrder.platform;
    document.getElementById('chk-usd').innerText = `$${currentOrder.price.toFixed(2)}`;

    document.getElementById('rank-step-form').classList.remove('active');
    document.getElementById('rank-step-checkout').classList.add('active');
}

function backToFormStep() {
    document.getElementById('rank-step-checkout').classList.remove('active');
    document.getElementById('rank-step-form').classList.add('active');
}

// ✅ យល់ព្រមបង់ប្រាក់ និងហៅទៅ API
async function confirmAndPay() {
    // បង្ហាញ Loading Spinner ពេញអេក្រង់សិន (Task 5)
    document.getElementById("global-loader").style.display = "flex";

    const payload = {
        player_name: currentOrder.ign,
        platform: currentOrder.platform,
        category: currentOrder.category.toLowerCase(), 
        value: currentOrder.value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/create-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        // លាក់ផ្ទាំង Loading វិញពេល API ឆ្លើយតប
        document.getElementById("global-loader").style.display = "none";

        if (result.status === "success") {
            
            // បញ្ចូលតម្លៃលុយទៅក្នុងផ្ទាំង KHQR ថ្មី
            document.getElementById("display-khqr-price").innerText = `$${currentOrder.price.toFixed(2)}`;

            // បង្កើតរូប QR Code
            const qrBox = document.getElementById("qrcode-box");
            qrBox.innerHTML = "";
            new QRCode(qrBox, {
                text: result.khqr_string,
                width: 250, // ធ្វើឱ្យធំច្បាស់សម្រាប់រចនាបថថ្មី
                height: 250,
                colorDark : "#000000",
                colorLight : "#ffffff"
            });

            // លាក់ Overlay កូដខូច រួចបង្ហាញផ្ទាំង KHQR ផ្លូវការ
            document.getElementById("qr-timeout-overlay").style.display = "none";
            document.getElementById("paymentModal").style.display = "flex";

            startCountdownTimer(420); // 7 នាទី
            startPaymentPolling(result.transaction_id);

        } else {
            alert("⚠️ ដំណើរការខុសប្រក្រតី: " + result.message);
        }
    } catch (error) {
        document.getElementById("global-loader").style.display = "none";
        alert("❌ មិនអាចតភ្ជាប់ទៅកាន់ API Server បានទេ!");
    }
}

// ⏰ យន្តការរាប់ថយក្រោយ ៧ នាទី
function startCountdownTimer(durationInSeconds) {
    if (countdownInterval) clearInterval(countdownInterval);
    
    let timer = durationInSeconds;
    const timerDisplay = document.getElementById('countdown-timer');

    countdownInterval = setInterval(() => {
        let minutes = parseInt(timer / 60, 10);
        let seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        timerDisplay.innerText = `${minutes}:${seconds}`;

        if (--timer < 0) {
            clearInterval(countdownInterval);
            clearInterval(statusPollInterval); 
            
            document.getElementById("qr-timeout-overlay").style.display = "flex";
            document.getElementById("qr-timeout-overlay").innerHTML = "<p style='color:red;font-weight:bold;text-align:center;'>❌ លែងមានសុពលភាព!</p>";
            
            setTimeout(closeModal, 4000);
        }
    }, 1000);
}

// 🔍 យន្តការឆែកមើលការបាញ់លុយ (Polling Status)
function startPaymentPolling(transactionId) {
    if (statusPollInterval) clearInterval(statusPollInterval);

    statusPollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/check-status/${transactionId}`);
            const result = await response.json();

            if (result.status === "success" && result.order_status === "paid") {
                clearInterval(countdownInterval);
                clearInterval(statusPollInterval);
                
                document.getElementById("paymentModal").style.display = "none";
                triggerSuccessAlert();
                
                // ផ្ញើសារទៅកាន់ Telegram
                sendTelegramAlert();
            }
        } catch (error) {
            console.error("Polling error:", error);
        }
    }, 4000);
}

// 📩 មុខងារផ្ញើសារទៅកាន់ Telegram Group
async function sendTelegramAlert() {
    if (TELEGRAM_CHAT_ID === "-100XXXXXXXXXX") return; // បើមិនទាន់ប្ដូរ ID ទេ មិនបាច់ផ្ញើ

    const message = `✅ *មានការទូទាត់ប្រាក់ថ្មីជោគជ័យ!*\n\n`
                  + `👤 *ឈ្មោះអ្នកលេង:* ${currentOrder.ign}\n`
                  + `🛍️ *ទំនិញ:* ${currentOrder.category.toUpperCase()} - ${currentOrder.value}\n`
                  + `💰 *តម្លៃ:* $${currentOrder.price.toFixed(2)}\n`
                  + `🎮 *Platform:* ${currentOrder.platform}\n\n`
                  + `⚙️ ប្រព័ន្ធនឹងបញ្ចូលអីវ៉ាន់ទៅក្នុងហ្គេមដោយស្វ័យប្រវត្តិ។`;

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });
    } catch (e) {
        console.error("បញ្ហាក្នុងការផ្ញើសារទៅ Telegram:", e);
    }
}

// 🎉 បើក Custom Success Alert
function triggerSuccessAlert() {
    const alertModal = document.getElementById("successAlert");
    alertModal.style.display = "flex";
    setTimeout(() => { alertModal.classList.add("active"); }, 50);
}

function closeSuccessAlert() {
    const alertModal = document.getElementById("successAlert");
    alertModal.classList.remove("active");
    setTimeout(() => { 
        alertModal.style.display = "none"; 
        showPage('home'); 
    }, 300);
}

function closeModal() {
    document.getElementById("paymentModal").style.display = "none";
    if (countdownInterval) clearInterval(countdownInterval);
    if (statusPollInterval) clearInterval(statusPollInterval);
        }
