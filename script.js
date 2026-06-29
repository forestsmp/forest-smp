// Use the same localStorage key as admin
const STORAGE_KEY = 'store_products';

function getProducts() {
    try {
        // Try to get from localStorage
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
        // If no data, initialize with defaults
        const defaults = [
            { id: 1, title: 'Economy Plugin', price: 19.99, discount: 10, category: 'plugins', image: '', stock: 2 },
            { id: 2, title: 'RPG Plugin', price: 29.99, discount: 0, category: 'plugins', image: '', stock: 0 },
            { id: 3, title: 'Auto Sell Script', price: 14.99, discount: 20, category: 'scripts', image: '', stock: 1 },
            { id: 4, title: 'Rank System', price: 24.99, discount: 15, category: 'projects', image: '', stock: 0 }
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
        return defaults;
    } catch {
        return [];
    }
}

const API_BASE_URL = "https://backend-11zq.onrender.com";

let currentProduct = null;
let countdownInterval = null;
let statusPollInterval = null;

// ===== CATEGORIES =====
const categories = [
    { id: 'plugins', name: 'Plugins', icon: '🔌', color: '#4caf50' },
    { id: 'scripts', name: 'Scripts', icon: '📜', color: '#fbc02d' },
    { id: 'projects', name: 'Projects', icon: '🚀', color: '#e53935' }
];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    renderCategories();
});

// ===== RENDER CATEGORIES =====
function renderCategories() {
    const grid = document.getElementById('categoryGrid');
    if (!grid) return;
    
    const products = getProducts();
    
    grid.innerHTML = categories.map(cat => {
        const count = products.filter(p => p.category === cat.id).length;
        return `
            <div class="category-card" onclick="openCategory('${cat.id}')">
                <div class="cat-icon">${cat.icon}</div>
                <div class="cat-name">${cat.name}</div>
                <div class="cat-count">${count} products</div>
                ${count > 0 ? `<div class="cat-badge">${count}</div>` : ''}
            </div>
        `;
    }).join('');
}

// ===== OPEN CATEGORY =====
function openCategory(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    
    document.getElementById('shop-category-name').textContent = `${category.icon} ${category.name}`;
    
    const products = getProducts().filter(p => p.category === categoryId);
    const grid = document.getElementById('productGrid');
    
    if (products.length === 0) {
        grid.innerHTML = `<p style="color:#a0aec0; text-align:center; padding:40px;">No products in this category yet.</p>`;
    } else {
        grid.innerHTML = products.map(p => `
            <div class="product-card" onclick="openPurchaseModal(${p.id})">
                ${p.image ? `<img src="${p.image}" class="product-img" alt="${p.title}">` : 
                    `<div class="product-img" style="display:flex;align-items:center;justify-content:center;color:#4a5568;font-size:40px;">📦</div>`}
                <div class="product-name">${p.title}</div>
                <div class="product-price">
                    $${p.price.toFixed(2)}
                    ${p.discount > 0 ? `<span class="original">$${(p.price * (1 + p.discount/100)).toFixed(2)}</span>` : ''}
                </div>
                ${p.discount > 0 ? `<div class="product-discount">-${p.discount}%</div>` : ''}
            </div>
        `).join('');
    }
    
    showPage('shop');
}

// ===== PURCHASE MODAL =====
function openPurchaseModal(productId) {
    const products = getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    currentProduct = product;
    document.getElementById('p-product-name').textContent = product.title;
    document.getElementById('p-product-price').textContent = `$${product.price.toFixed(2)}`;
    document.getElementById('p-product-discount').textContent = product.discount > 0 ? `-${product.discount}%` : 'None';
    
    document.getElementById('purchaseModal').style.display = 'flex';
}

function closePurchaseModal() {
    document.getElementById('purchaseModal').style.display = 'none';
}

// ===== CONFIRM PURCHASE =====
async function confirmPurchase() {
    const ign = document.getElementById('p-ign').value.trim();
    const email = document.getElementById('p-email').value.trim();
    const platform = document.getElementById('p-platform').value;
    
    if (!ign || !email) {
        alert('❌ Please fill in all required fields!');
        return;
    }
    
    if (!currentProduct) return;
    
    closePurchaseModal();
    
    // Show payment modal
    document.getElementById('qrcode-box').innerHTML = '<p style="font-size:13px;color:#666;">Generating QR...</p>';
    document.getElementById('qr-timeout-overlay').style.display = 'none';
    document.getElementById('paymentModal').style.display = 'flex';
    
    const payload = {
        player_name: ign,
        platform: platform,
        category: currentProduct.category,
        value: currentProduct.title,
        price: currentProduct.price
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.status === 'success') {
            document.getElementById('qrcode-box').innerHTML = '';
            new QRCode(document.getElementById('qrcode-box'), {
                text: result.khqr_string,
                width: 190,
                height: 190
            });
            
            startCountdownTimer(420);
            startPaymentPolling(result.transaction_id);
        } else {
            alert('⚠️ Error: ' + result.message);
            closePaymentModal();
        }
    } catch (error) {
        alert('❌ Cannot connect to server!');
        closePaymentModal();
    }
}

// ===== TIMER =====
function startCountdownTimer(durationInSeconds) {
    if (countdownInterval) clearInterval(countdownInterval);
    
    let timer = durationInSeconds;
    const timerDisplay = document.getElementById('countdown-timer');
    
    countdownInterval = setInterval(() => {
        let minutes = parseInt(timer / 60, 10);
        let seconds = parseInt(timer % 60, 10);
        minutes = minutes < 10 ? '0' + minutes : minutes;
        seconds = seconds < 10 ? '0' + seconds : seconds;
        timerDisplay.innerText = `${minutes}:${seconds}`;
        
        if (--timer < 0) {
            clearInterval(countdownInterval);
            clearInterval(statusPollInterval);
            document.getElementById('qr-timeout-overlay').style.display = 'flex';
            document.getElementById('payment-spinner').innerHTML = '<p style="color:red;font-weight:bold;">❌ QR Code expired!</p>';
            setTimeout(closePaymentModal, 3000);
        }
    }, 1000);
}

// ===== POLLING =====
function startPaymentPolling(transactionId) {
    if (statusPollInterval) clearInterval(statusPollInterval);
    
    statusPollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/check-status/${transactionId}`);
            const result = await response.json();
            
            if (result.status === 'success' && result.order_status === 'paid') {
                clearInterval(countdownInterval);
                clearInterval(statusPollInterval);
                closePaymentModal();
                triggerSuccessAlert();
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 4000);
}

// ===== SUCCESS ALERT =====
function triggerSuccessAlert() {
    const alertModal = document.getElementById('successAlert');
    alertModal.style.display = 'flex';
    setTimeout(() => alertModal.classList.add('active'), 50);
}

function closeSuccessAlert() {
    const alertModal = document.getElementById('successAlert');
    alertModal.classList.remove('active');
    setTimeout(() => {
        alertModal.style.display = 'none';
        showPage('home');
    }, 300);
}

// ===== MODAL CONTROLS =====
function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
    if (countdownInterval) clearInterval(countdownInterval);
    if (statusPollInterval) clearInterval(statusPollInterval);
}

// ===== PAGE NAVIGATION =====
function showPage(pageId) {
    document.querySelectorAll('.store-page').forEach(page => page.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
}

// ===== ADMIN ACCESS =====
function goToAdmin() {
    window.location.href = '../admin/index.html';
}

// ===== KEYBOARD SHORTCUT: Ctrl+Shift+A =====
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        goToAdmin();
    }
});

// ===== REFRESH PRODUCTS WHEN ADMIN MAKES CHANGES =====
// Listen for storage changes from other tabs/windows
window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
        // Products were updated in another tab
        const currentPage = document.querySelector('.store-page.active');
        if (currentPage) {
            const pageId = currentPage.id.replace('page-', '');
            if (pageId === 'home') {
                renderCategories();
            } else if (pageId === 'shop') {
                // Re-render current category
                const categoryName = document.getElementById('shop-category-name').textContent;
                categories.forEach(cat => {
                    if (categoryName.includes(cat.name)) {
                        openCategory(cat.id);
                    }
                });
            }
        }
    }
});
