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

// ================= ERROR SAFE =================
function getErrorMessage(res) {
    return res?.error || res?.message || "Unknown error";
}

// ================= NAV =================
function showPage(pageId) {
    document.querySelectorAll('.store-page').forEach(p => p.classList.remove('active'));

    const page = document.getElementById(`page-${pageId}`);
    if (page) page.classList.add('active');

    if (pageId === 'rank') backToSelectStep();
}

// ================= SELECT =================
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
        alert("❌ សូមជ្រើសរើស Rank!");
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
        alert("❌ សូមបំពេញព័ត៌មាន!");
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
        "<p style='color:#666;'>Generating QR...</p>";

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

        console.log("CREATE ORDER RESPONSE:", result);

        const isSuccess =
            result?.success === true ||
            result?.status === "success";

        // ================= SAFE transaction_id extraction =================
        const transactionId =
            result?.transaction_id ||
            result?.data?.transaction_id ||
            result?.data?.id ||
            result?.order_id ||
            result?.id;

        console.log("EXTRACTED transactionId:", transactionId);

        if (!isSuccess) {
            alert("⚠️ " + getErrorMessage(result));
            closeModal();
            return;
        }

        if (!transactionId) {
            alert("❌ transaction_id មិនបានទទួលពី API");
            closeModal();
            return;
        }

        // ================= QR =================
        document.getElementById("qrcode-box").innerHTML = "";

        new QRCode(document.getElementById("qrcode-box"), {
            text: result.khqr_string || "",
            width: 190,
            height: 190
        });

        startCountdownTimer(420);
        startPaymentPolling(transactionId);

    } catch (err) {
        console.error(err);
        alert("❌ Server Error");
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
        console.error("Missing transactionId");
        return;
    }

    clearInterval(statusPollInterval);

    statusPollInterval = setInterval(async () => {

        try {
            const res = await fetch(`${API_BASE_URL}/api/check-status/${transactionId}`);
            const data = await res.json().catch(() => null);

            console.log("STATUS RESPONSE:", data);

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

            if (data?.error === "Not found") {
                console.warn("Order not found yet (backend issue or delay)");
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

// ================= CLOSE =================
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
