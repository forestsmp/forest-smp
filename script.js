const API_BASE_URL = "https://payment.forestsmp.site";

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

// 🍞 Toast Notification System (ជំនួស alert)
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// 🍔 Hamburger Menu Toggle
function toggleMenu() {
    document.getElementById('navLinks').classList.toggle('open');
}
function closeMenu() {
    document.getElementById('navLinks').classList.remove('open');
}

// 📊 Update Stepper Progress
function updateStepper(currentStep) {
    // Reset all
    for (let i = 1; i <= 3; i++) {
        const step = document.getElementById(`step-${i}`);
        step.classList.remove('active', 'completed');
    }
    document.getElementById('line-1').classList.remove('active');
    document.getElementById('line-2').classList.remove('active');
    
    // Mark completed
    for (let i = 1; i < currentStep; i++) {
        document.getElementById(`step-${i}`).classList.add('completed');
    }
    // Mark active
    document.getElementById(`step-${currentStep}`).classList.add('active');
    // Activate lines
    if (currentStep >= 2) document.getElementById('line-1').classList.add('active');
    if (currentStep >= 3) document.getElementById('line-2').classList.add('active');
}

// 🔄 Page Navigation
function showPage(pageId) {
    document.querySelectorAll('.store-page').forEach(page => page.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    
    if (pageId === 'rank') {
        backToSelectStep();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 🛒 Select Item
function selectItem(category, value, price) {
    currentOrder.category = category;
    currentOrder.value = value;
    currentOrder.price = price;
    
    document.querySelectorAll('.rank-card').forEach(card => card.classList.remove('selected'));
    document.getElementById(`card-${value}`).classList.add('selected');
    showToast(`✓ ${value.toUpperCase()} rank selected!`, 'info');
}

// ➡️ Step 1 → Step 2
function goToFormStep() {
    if (!currentOrder.value) {
        showToast("សូមមេត្តាជ្រើសរើសយក Rank ណាមួយជាមុនសិន!", 'error');
        return;
    }
    document.getElementById('rank-step-select').classList.remove('active');
    document.getElementById('rank-step-form').classList.add('active');
    updateStepper(2);
}

function backToSelectStep() {
    document.getElementById('rank-step-form').classList.remove('active');
    document.getElementById('rank-step-checkout').classList.remove('active');
    document.getElementById('rank-step-select').classList.add('active');
    updateStepper(1);
}

// ➡️ Step 2 → Step 3
function goToCheckoutStep() {
    const ign = document.getElementById('input-ign').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const platform = document.getElementById('input-platform').value;
    
    if (!ign || !email) {
        showToast("សូមបំពេញព័ត៌មានចាំបាច់ IGN និង Email ឱ្យបានគ្រប់ជ្រុងជ្រោយ!", 'error');
        return;
    }
    
    // Email validation
    if (!email.includes('@') || !email.includes('.')) {
        showToast("Email របស់អ្នកមិនត្រឹមត្រូវទេ!", 'warning');
        return;
    }
    
    currentOrder.ign = ign;
    currentOrder.email = email;
    currentOrder.platform = platform;
    
    document.getElementById('chk-category').innerText = currentOrder.category.toUpperCase();
    document.getElementById('chk-item').innerText = currentOrder.value;
    document.getElementById('chk-ign').innerText = currentOrder.ign;
    document.getElementById('chk-email').innerText = currentOrder.email;
    document.getElementById('chk-platform').innerText = currentOrder.platform;
    document.getElementById('chk-usd').innerText = `$${currentOrder.price.toFixed(2)}`;
    
    document.getElementById('rank-step-form').classList.remove('active');
    document.getElementById('rank-step-checkout').classList.add('active');
    updateStepper(3);
}

function backToFormStep() {
    document.getElementById('rank-step-checkout').classList.remove('active');
    document.getElementById('rank-step-form').classList.add('active');
    updateStepper(2);
}

// ❓ FAQ Toggle
function toggleFaq(element) {
    const faqItem = element.parentElement;
    faqItem.classList.toggle('open');
}

// ✅ Confirm & Pay
async function confirmAndPay() {
    document.getElementById("qrcode-box").innerHTML = "<p style='font-size:13px;color:#666;'>កំពុងបង្កើតកូដទូទាត់...</p>";
    document.getElementById("qr-timeout-overlay").style.display = "none";
    document.getElementById("paymentModal").style.display = "block";
    
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
        
        if (result.status === "success") {
            document.getElementById("qrcode-box").innerHTML = "";
            new QRCode(document.getElementById("qrcode-box"), {
                text: result.khqr_string,
                width: 190,
                height: 190
            });
            startCountdownTimer(420);
            startPaymentPolling(result.transaction_id);
            showToast("✓ QR Code បានបង្កើតដោយជោគជ័យ!", 'success');
        } else {
            showToast("⚠️ ដំណើរការខុសប្រក្រតី: " + result.message, 'error');
            closeModal();
        }
    } catch (error) {
        showToast("❌ មិនអាចតភ្ជាប់ទៅកាន់ API Server បានទេ!", 'error');
        closeModal();
    }
}

// ⏰ Countdown Timer
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
            document.getElementById("payment-spinner").innerHTML = "<p style='color:red;font-weight:bold;'>❌ កូដបង់ប្រាក់នេះត្រូវបានបដិសេធដោយប្រព័ន្ធធនាគារ!</p>";
            showToast("⏰ QR Code បានផុតកំណត់ហើយ!", 'error');
            setTimeout(closeModal, 4000);
        }
    }, 1000);
}

// 🔍 Payment Polling
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
            }
        } catch (error) {
            console.error("Polling error:", error);
        }
    }, 4000);
}

// 🎉 Success Alert
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

// 🎬 Initial Load
document.addEventListener('DOMContentLoaded', () => {
    updateStepper(1);
});
