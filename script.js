const API_BASE_URL = "https://payment.forestsmp.site";

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = "8996279246:AAGsmktthEDXL92gqrMKwcqGY-r7b_oIpes";
const TELEGRAM_GROUP_ID = "-1003768957328";

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

// 🍞 Toast Notification System
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const icons = {
        success: '<i class="fas fa-check-circle"></i>',
        error: '<i class="fas fa-times-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        info: '<i class="fas fa-info-circle"></i>'
    };
    
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 4000);
}

// 🍔 Hamburger Menu Toggle
function toggleMenu() {
    document.getElementById('navLinks').classList.toggle('open');
}

function closeMenu() {
    document.getElementById('navLinks').classList.remove('open');
}

// 🔄 Page Navigation
function showPage(pageId) {
    document.querySelectorAll('.store-page').forEach(page => page.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 🛒 Open Buy Form Modal
function openBuyForm(category, value, price) {
    currentOrder.category = category;
    currentOrder.value = value;
    currentOrder.price = price;
    
    // Update selected item info
    const infoDiv = document.getElementById('selectedItemInfo');
    infoDiv.innerHTML = `
        <h3><i class="fas fa-shopping-cart"></i> Selected Item</h3>
        <p><strong>Rank:</strong> ${value.toUpperCase()}</p>
        <p><strong>Price:</strong> $${price.toFixed(2)} (≈ ${(price * 4100).toFixed(0)} ៛)</p>
    `;
    
    // Clear form fields
    document.getElementById('input-ign').value = '';
    document.getElementById('input-email').value = '';
    
    // Show modal
    document.getElementById('buyFormModal').classList.add('active');
}

// ❌ Close Buy Form Modal
function closeBuyForm() {
    document.getElementById('buyFormModal').classList.remove('active');
}

// ➡️ Proceed to Payment
function proceedToPayment() {
    const ign = document.getElementById('input-ign').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const platform = document.getElementById('input-platform').value;
    
    if (!ign || !email) {
        showToast("សូមបំពេញ IGN និង Email ឱ្យបានគ្រប់ជ្រុងជ្រោយ!", 'error');
        return;
    }
    
    // Email validation
    if (!email.includes('@') || !email.includes('.')) {
        showToast("Email របស់អ្នកមិនត្រឹមត្រូវទេ!", 'error');
        return;
    }
    
    currentOrder.ign = ign;
    currentOrder.email = email;
    currentOrder.platform = platform;
    
    // Close form and open payment modal
    closeBuyForm();
    confirmAndPay();
}

// ✅ Confirm & Pay
async function confirmAndPay() {
    document.getElementById("qrcode-box").innerHTML = "<p style='font-size:13px;color:#666;'><i class='fas fa-spinner fa-spin'></i> កំពុងបង្កើតកូដទូទាត់...</p>";
    document.getElementById("qr-timeout-overlay").style.display = "none";
    document.getElementById("paymentModal").classList.add('active');
    
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
            showToast("QR Code បានបង្កើតដោយជោគជ័យ!", 'success');
            
            document.getElementById("qrcode-box").innerHTML = "";
            new QRCode(document.getElementById("qrcode-box"), {
                text: result.khqr_string,
                width: 190,
                height: 190
            });
            
            startCountdownTimer(420);
            startPaymentPolling(result.transaction_id);
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
            document.getElementById("payment-spinner").innerHTML = "<p style='color:red;font-weight:bold;'><i class='fas fa-times-circle'></i> កូដបង់ប្រាក់នេះត្រូវបានបដិសេធដោយប្រព័ន្ធ!</p>";
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
                document.getElementById("paymentModal").classList.remove('active');
                
                // Send Telegram notification
                await sendTelegramNotification();
                
                // Show success alert
                triggerSuccessAlert();
            }
        } catch (error) {
            console.error("Polling error:", error);
        }
    }, 4000);
}

// 📱 Send Telegram Notification
async function sendTelegramNotification() {
    const message = `
🎉 <b>PAYMENT SUCCESSFUL!</b>

👤 <b>Player:</b> ${currentOrder.ign}
📧 <b>Email:</b> ${currentOrder.email}
🎮 <b>Platform:</b> ${currentOrder.platform.toUpperCase()}
🏆 <b>Rank:</b> ${currentOrder.value.toUpperCase()}
💰 <b>Price:</b> $${currentOrder.price.toFixed(2)}

⏰ <b>Time:</b> ${new Date().toLocaleString('km-KH')}
    `.trim();
    
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: TELEGRAM_GROUP_ID,
                text: message,
                parse_mode: "HTML"
            })
        });
        console.log("✅ Telegram notification sent successfully");
    } catch (error) {
        console.error("❌ Failed to send Telegram notification:", error);
    }
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
    document.getElementById("paymentModal").classList.remove('active');
    if (countdownInterval) clearInterval(countdownInterval);
    if (statusPollInterval) clearInterval(statusPollInterval);
}

// ❓ FAQ Toggle
function toggleFaq(element) {
    const faqItem = element.parentElement;
    faqItem.classList.toggle('open');
}

// Close modal when clicking outside
window.onclick = function(event) {
    const buyModal = document.getElementById('buyFormModal');
    if (event.target === buyModal) {
        closeBuyForm();
    }
    }
