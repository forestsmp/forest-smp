const API_BASE_URL = "https://api.apsara.lol";

let currentOrder = {
    category: "",
    value: "",
    price: 0,
    ign: "",
    email: "",
    platform: ""
};

let countdownInterval = null;
let statusPollInterval = null;
let paymentConfirmed = false;

// ================= PAYMENT =================
async function confirmAndPay() {
    paymentConfirmed = false;

    document.getElementById("paymentModal").style.display = "block";
    document.getElementById("qrcode-box").innerHTML =
        "<p>Generating QR Code...</p>";

    const payload = {
        player_name: currentOrder.ign,
        platform: currentOrder.platform,
        category: currentOrder.category.toLowerCase(),
        value: currentOrder.value
    };

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/create-order`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        const result = await response.json();

        console.log("CREATE ORDER:", result);

        if (!result.success) {
            alert("⚠️ " + (result.error || "Unknown Error"));
            closeModal();
            return;
        }

        const transactionId = result.transaction_id;

        if (!transactionId) {
            alert("❌ transaction_id missing from API");
            closeModal();
            return;
        }

        document.getElementById("qrcode-box").innerHTML = "";

        new QRCode(
            document.getElementById("qrcode-box"),
            {
                text: result.khqr_string,
                width: 190,
                height: 190
            }
        );

        startCountdownTimer(420);
        startPaymentPolling(transactionId);

    } catch (err) {
        console.error(err);
        alert("❌ Cannot connect to server");
        closeModal();
    }
}

// ================= POLLING =================
function startPaymentPolling(transactionId) {
    clearInterval(statusPollInterval);

    statusPollInterval = setInterval(async () => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/check-status/${transactionId}`
            );

            const data = await response.json();

            console.log("STATUS:", data);

            if (
                data.success &&
                data.order_status === "paid"
            ) {
                paymentConfirmed = true;

                clearInterval(statusPollInterval);
                clearInterval(countdownInterval);

                closeModal();
                triggerSuccessAlert();
                return;
            }

            if (
                data.success &&
                data.order_status === "expired"
            ) {
                clearInterval(statusPollInterval);
                clearInterval(countdownInterval);

                alert("❌ QR Code Expired");
                closeModal();
                return;
            }

            if (!data.success) {
                console.warn(
                    "Waiting for transaction...",
                    data.error
                );
            }

        } catch (err) {
            console.error(
                "Polling Error:",
                err
            );
        }
    }, 4000);
}

// ================= COUNTDOWN =================
function startCountdownTimer(seconds) {
    clearInterval(countdownInterval);

    let timer = seconds;

    const display =
        document.getElementById(
            "countdown-timer"
        );

    countdownInterval = setInterval(() => {
        const minutes = String(
            Math.floor(timer / 60)
        ).padStart(2, "0");

        const secs = String(
            timer % 60
        ).padStart(2, "0");

        if (display) {
            display.innerText =
                `${minutes}:${secs}`;
        }

        timer--;

        if (timer < 0) {
            clearInterval(countdownInterval);
            clearInterval(statusPollInterval);

            if (!paymentConfirmed) {
                document.getElementById(
                    "qr-timeout-overlay"
                ).style.display = "flex";

                setTimeout(() => {
                    closeModal();
                }, 3000);
            }
        }
    }, 1000);
}

// ================= SUCCESS =================
function triggerSuccessAlert() {
    const modal =
        document.getElementById(
            "successAlert"
        );

    modal.style.display = "flex";

    setTimeout(() => {
        modal.classList.add("active");
    }, 50);
}

function closeSuccessAlert() {
    const modal =
        document.getElementById(
            "successAlert"
        );

    modal.classList.remove("active");

    setTimeout(() => {
        modal.style.display = "none";
    }, 300);
}

// ================= CLOSE =================
function closeModal() {
    document.getElementById(
        "paymentModal"
    ).style.display = "none";

    clearInterval(countdownInterval);
    clearInterval(statusPollInterval);
}
