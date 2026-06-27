const API_BASE_URL = "https://api.apsara.lol";

// ================= STATE =================
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
let paymentConfirmed = false;

// ================= ERROR HANDLER =================
function getErrorMessage(res) {
    return res?.error || res?.message || "Unknown error";
}

// ================= NAVIGATION =================
function showPage(pageId) {
    document.querySelectorAll('.store-page').forEach(p => p.classList.remove('active'));

    const page = document.getElementById(`page-${pageId}`);
    if (page) page.classList.add('active');

    if (pageId === 'rank') backToSelectStep();
}

// ================= SELECT ITEM =================
function selectItem(category, value, price) {
    currentOrder.category = category;
    currentOrder.value = value;
    currentOrder.price = price;

    document.querySelectorAll('.rank-card').forEach(c => c.classList.remove('selected'));

    const card = document.getElementById(`card-${value}`);
    if (card) card.classList.add('selected');
}

// ================= STEPS =================
function goToFormStep() {
    if (!currentOrder.value) {
        alert("❌ សូមជ្រើសរើស Rank ជាមុនសិន!");
        return;
    }

    document.getElementById('rank-step-select')?.classList.remove('active');
    document.getElementById('rank-step-form')?.classList.add('active');
}

function backToSelectStep() {
    document.getElementById('rank-step-form')?.classList.remove('active');
    document.getElementById('rank-step-checkout')?.classList.remove('active');
    document.getElementById('rank-step-select')?.classList.add('active');
}

// ================= CHECKOUT =================
function goToCheckoutStep() {
    const ign = document.getElementById('input-ign').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const platform = document.getElementById('input-platform').value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!ign || !email) {
        alert("❌ សូមបំពេញ IGN និង Email!");
        return;
    }

    if (!emailRegex.test(email)) {
        alert("❌ Email មិនត្រឹមត្រូវ!");
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
}

// ================= PAYMENT =================
async function confirmAndPay() {

    paymentConfirmed = false;

    const payBtn = document.getElementById('pay-btn');
    if (payBtn) payBtn.disabled = true;

    document.getElementById("paymentModal").style.display = "block";
    document.getElementById("qrcode-box").innerHTML =
        "<p style='color:#666;font-size:13px;'>កំពុងបង្កើត QR...</p>";

    const payload = {
        player_name: currentOrder.ign,
        platform: currentOrder.platform,
        category: currentOrder.category.toLowerCase(),
        value: currentOrder.value
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/create-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await res.json().catch(() => null);

        console.log("CREATE ORDER RESPONSE:", result); // 🔥 DEBUG IMPORTANT

        const isSuccess =
            result?.success === true ||
            result?.status === "success";

        // ================= IMPORTANT FIX =================
        const transactionId = result?.transaction_id;

        if (!transactionId) {
            alert("❌ transaction_id មិនបានទទួលពី API");
            console.error("Missing transaction_id:", result);
            closeModal();
            return;
        }

        if (isSuccess) {

            document.getElementById("qrcode-box").innerHTML = "";

            new QRCode(document.getElementById("qrcode-box"), {
                text: result.khqr_string,
                width: 190,
                height: 190
            });

            startCountdownTimer(420);
            startPaymentPolling(transactionId);

        } else {
            alert("⚠️ " + getErrorMessage(result));
            closeModal();
        }

    } catch (err) {
        console.error(err);
        alert("❌ Server មិនអាចភ្ជាប់បាន");
        closeModal();
    }

    if (payBtn) payBtn.disabled = false;
}

// ================= COUNTDOWN =================
function startCountdownTimer(seconds) {
    clearInterval(countdownInterval);

    let timer = seconds;
    const display = document.getElementById("countdown-timer");

    countdownInterval = setInterval(() => {

        const m = String(Math.floor(timer / 60)).padStart(2, "0");
        const s = String(timer % 60).padStart(2, "0");

        if (display) display.innerText = `${m}:${s}`;

        timer--;

        if (timer < 0) {

            if (paymentConfirmed) return;

            clearInterval(countdownInterval);
            clearInterval(statusPollInterval);

            document.getElementById("qr-timeout-overlay").style.display = "flex";
            closeModal();
        }

    }, 1000);
}

// ================= POLLING =================
function startPaymentPolling(transactionId) {

    if (!transactionId) {
        console.error("❌ Missing transactionId for polling");
        return;
    }

    clearInterval(statusPollInterval);

    statusPollInterval = setInterval(async () => {

        try {
            const res = await fetch(`${API_BASE_URL}/api/check-status/${transactionId}`);
            const data = await res.json().catch(() => null);

            console.log("STATUS RESPONSE:", data); // 🔥 DEBUG

            // ================= FIX: SUPPORT BOTH API TYPES =================
            const isPaid =
                data?.success === true &&
                data?.order_status === "paid";

            if (isPaid) {

                paymentConfirmed = true;

                clearInterval(countdownInterval);
                clearInterval(statusPollInterval);

                closeModal();
                triggerSuccessAlert();
            }

            // ================= HANDLE NOT FOUND =================
            if (data?.error === "Not found") {
                console.warn("Transaction not found yet...");
            }

        } catch (err) {
            console.error("Polling error:", err);
        }

    }, 4000);
}

// ================= SUCCESS =================
function triggerSuccessAlert() {
    const modal = document.getElementById("successAlert");
    modal.style.display = "flex";
    setTimeout(() => modal.classList.add("active"), 50);
}

function closeSuccessAlert() {
    const modal = document.getElementById("successAlert");
    modal.classList.remove("active");

    setTimeout(() => {
        modal.style.display = "none";
        resetOrder();
        showPage("home");
    }, 300);
}

// ================= CLOSE MODAL =================
function closeModal() {
    document.getElementById("paymentModal").style.display = "none";
    clearInterval(countdownInterval);
    clearInterval(statusPollInterval);
}

// ================= RESET =================
function resetOrder() {
    currentOrder = {
        category: '',
        value: '',
        price: 0,
        ign: '',
        email: '',
        platform: ''
    };

    document.querySelectorAll(".rank-card").forEach(c => c.classList.remove("selected"));
}
