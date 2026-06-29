const API_BASE_URL = "https://backend-11zq.onrender.com"; // Fixed port to match Python backend

// Object សម្រាប់ផ្ទុកទិន្នន័យនៃការទិញបច្ចុប្បន្ន
let currentOrder = {
    category: '',
    value: '',
    price: 0,
    ign: '',
    email: '',
    platform: ''
};

let countdownInterval = null;
let statusPollInterval = null;

// 🔄 មុខងារគ្រប់គ្រងការប្តូរទំព័រ (Navigation Page Switching)
function showPage(pageId) {
    document.querySelectorAll('.store-page').forEach(page => page.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    
    // បើចូលទៅទំព័រ Rank ត្រូវ Reset ទៅកាន់កន្លែងរើសទំនិញដំបូងវិញ
    if(pageId === 'rank') {
        backToSelectStep();
    }
}

// 🛒 មុខងារចុចជ្រើសរើសទំនិញ
function selectItem(category, value, price) {
    currentOrder.category = category;
    currentOrder.value = value;
    currentOrder.price = price;

    // បន្ថែម Class Selected ទៅលើ Card ដែលបានជ្រើសរើស
    document.querySelectorAll('.rank-card').forEach(card => card.classList.remove('selected'));
    document.getElementById(`card-${value}`).classList.add('selected');
}

// ➡️ ទៅកាន់ទម្រង់បំពេញព័ត៌មាន (Step 2)
function goToFormStep() {
    if (!currentOrder.value) {
        alert("❌ សូមមេត្តាជ្រើសរើសយក Rank ណាមួយជាមុនសិន!");
        return;
    }
    document.getElementById('rank-step-select').classList.remove('active');
    document.getElementById('rank-step-form').classList.add('active');
}

function backToSelectStep() {
    document.getElementById('rank-step-form').classList.remove('active');
    document.getElementById('rank-step-checkout').classList.remove('active');
    document.getElementById('rank-step-select').classList.add('active');
}

// ➡️ ទៅកាន់ទំព័រ Checkout (Step 3)
function goToCheckoutStep() {
    const ign = document.getElementById('input-ign').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const platform = document.getElementById('input-platform').value;

    if (!ign || !email) {
        alert("❌ សូមបំពេញព័ត៌មានចាំបាច់ IGN និង Email ឱ្យបានគ្រប់ជ្រុងជ្រោយ!");
        return;
    }

    currentOrder.ign = ign;
    currentOrder.email = email;
    currentOrder.platform = platform;

    // បង្ហាញព័ត៌មាននៅលើទំព័រ Check out ឱ្យអតិថិជនផ្ទៀងផ្ទាត់
    document.getElementById('chk-category').innerText = currentOrder.category.toUpperCase();
    document.getElementById('chk-item').innerText = currentOrder.value;
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
    // បើកផ្ទាំង KHQR Popup រង់ចាំកូដ
    document.getElementById("qrcode-box").innerHTML = "<p style='font-size:13px;color:#666;'>កំពុងបង្កើតកូដទូទាត់...</p>";
    document.getElementById("qr-timeout-overlay").style.display = "none";
    document.getElementById("paymentModal").style.display = "block";

    const payload = {
        player_name: currentOrder.ign,
        platform: currentOrder.platform,
        category: currentOrder.category.toLowerCase(), // Fixed: backend forces lowercase 'rank'
        value: currentOrder.value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/create-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.status === "success") {
            // ១. បង្កើតរូប QR Code
            document.getElementById("qrcode-box").innerHTML = "";
            new QRCode(document.getElementById("qrcode-box"), {
                text: result.khqr_string,
                width: 190,
                height: 190
            });

            // ២. ចាប់ផ្តើមនាឡិការាប់ថយក្រោយ ៧ នាទី (420 វិនាទី)
            startCountdownTimer(420);

            // ៣. ចាប់ផ្តើមយន្តការ Polling តាមដានលុយចូលពី Bank
            startPaymentPolling(result.transaction_id);

        } else {
            alert("⚠️ ដំណើរការខុសប្រក្រតី: " + result.message);
            closeModal();
        }
    } catch (error) {
        alert("❌ មិនអាចតភ្ជាប់ទៅកាន់ API Server បានទេ....................!");
        closeModal();
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
            clearInterval(statusPollInterval); // ឈប់ឆែកស្ថានភាពបង់ប្រាក់
            
            // បង្ហាញ Overlay ប្រាប់ថា QR លែងដំណើរការហើយ (បដិសេធចោល)
            document.getElementById("qr-timeout-overlay").style.display = "flex";
            document.getElementById("payment-spinner").innerHTML = "<p style='color:red;font-weight:bold;'>❌ កូដបង់ប្រាក់នេះត្រូវបានបដិសេធដោយប្រព័ន្ធធនាគារ!</p>";
            
            // បិទផ្ទាំងទូទាត់ក្រោយពេល ៤ វិនាទី
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
                // ឈប់រាប់ម៉ោង និងឈប់ Polling
                clearInterval(countdownInterval);
                clearInterval(statusPollInterval);
                
                // បិទផ្ទាំង KHQR Popup រួចបើក Custom Alert ឡូយៗជំនួសវិញ
                document.getElementById("paymentModal").style.display = "none";
                triggerSuccessAlert();
            }
        } catch (error) {
            console.error("Polling error:", error);
        }
    }, 4000);
}

// <tr> បើក Custom Success Alert
function triggerSuccessAlert() {
    const alertModal = document.getElementById("successAlert");
    alertModal.style.display = "flex";
    setTimeout(() => { alertModal.classList.add("active"); }, 50);
}

// ❌ បិទ Custom Success Alert និងនាំទៅកាន់ទំព័រ Home វិញ
function closeSuccessAlert() {
    const alertModal = document.getElementById("successAlert");
    alertModal.classList.remove("active");
    setTimeout(() => { 
        alertModal.style.display = "none"; 
        showPage('home'); // នាំត្រឡប់មក Home វិញ
    }, 300);
}

function closeModal() {
    document.getElementById("paymentModal").style.display = "none";
    if (countdownInterval) clearInterval(countdownInterval);
    if (statusPollInterval) clearInterval(statusPollInterval);
}
