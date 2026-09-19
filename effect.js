// Toggle mobile menu
document.getElementById('menu-toggle')?.addEventListener('click', function() {
    document.getElementById('nav-menu').classList.toggle('active');
});

// Hiển thị file báo cáo di cư hết sang json_manager.js rồi

// Link PartyRock dành riêng cho Giáo viên
const partyRockURL = 'https://partyrock.aws/u/khanh1104/M7J5-3r33';

// Xử lý sự kiện mở link PartyRock
document.getElementById('btn-mo-partyrock-admin')?.addEventListener('click', function() {
    window.open(partyRockURL, '_blank');
});

// --- KÍCH HOẠT HIỆU ỨNG CHUYỂN ĐỘNG KHI CUỘN TRANG (SCROLL REVEAL) ---
function revealOnScroll() {
    const reveals = document.querySelectorAll('.reveal');
    const windowHeight = window.innerHeight;

    reveals.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        const revealPoint = 100; // Khoảng cách tới viền dưới màn hình để bắt đầu hiện

        if (elementTop < windowHeight - revealPoint) {
            element.classList.add('active');
        }
    });
}

// Bắt sự kiện cuộn trang & kích hoạt khi load lần đầu
window.addEventListener('scroll', revealOnScroll);
window.addEventListener('load', revealOnScroll);