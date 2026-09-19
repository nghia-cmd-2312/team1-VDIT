const DB_NAME = "ecoaiDB";
const DB_VERSION = 1;
const STORE_NAME = "reports";

let reports = [];
let currentReportId = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: "id",
                });

                store.createIndex("ngayKiemTra", "phien.ngayKiemTra", {
                    unique: false,
                });
                store.createIndex("phong", "phien.phong", {
                    unique: false,
                });
                store.createIndex("lopNhom", "phien.lopNhom", {
                    unique: false,
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getReports() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const request = db
            .transaction(STORE_NAME, "readonly")
            .objectStore(STORE_NAME)
            .getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveReport(report) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const request = db
            .transaction(STORE_NAME, "readwrite")
            .objectStore(STORE_NAME)
            .put(report);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function deleteReport(id) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const request = db
            .transaction(STORE_NAME, "readwrite")
            .objectStore(STORE_NAME)
            .delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function deleteAllReports() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const request = db
            .transaction(STORE_NAME, "readwrite")
            .objectStore(STORE_NAME)
            .clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

const jsonInput = document.getElementById("jsonInput");
const reportList = document.getElementById("list-bao-cao-container");
const status = document.getElementById("status");

function getReportTitle(report) {
    const session = report.phien || {};
    return session.phong || "Không có phòng học";
}

function getReportDate(report) {
    const session = report.phien || {};
    return [session.ngayKiemTra, session.thoiDiemKiemTra]
        .filter(Boolean)
        .join(" · ") || "Chưa có thời gian";
}

function renderReportList() {
    reportList.innerHTML = "";

    if (!reports.length) {
        reportList.innerHTML =
            '<p class="empty-msg">Chưa có dữ liệu báo cáo vi phạm nào được ghi nhận.</p>';
        return;
    }

    reports.forEach((report) => {
        const card = document.createElement("div");
        card.className = "report-card";
        if (report.id === currentReportId) {
            card.classList.add("selected");
        }

        const result = report.ketQua || {};
        card.innerHTML = `
            <div class="report-header">
                <div class="report-title">
                    🏫 <strong>${getReportTitle(report)}</strong>
                    <span class="report-time">⏰ ${getReportDate(report)}</span>
                </div>
                <button class="btn-arrow" type="button">▼</button>
            </div>
            <div class="report-detail" style="display: none;">
                <div class="detail-content">
                    <p><strong>⚡ Mức độ lãng phí:</strong> ${result.mucDoLangPhi || "N/A"}</p>
                    <p><strong>📉 Điểm thi đua:</strong> ${result.diemThiDua ?? "N/A"}</p>
                    <p><strong>📝 Kết luận:</strong> ${report.ketLuan || "Không có dữ liệu"}</p>
                </div>
            </div>
        `;

        card.querySelector(".report-header").addEventListener("click", () => {
            const detail = card.querySelector(".report-detail");
            const arrow = card.querySelector(".btn-arrow");
            const isOpen = detail.style.display === "block";

            openReport(report, card);
            detail.style.display = isOpen ? "none" : "block";
            arrow.textContent = isOpen ? "▼" : "▲";
        });

        reportList.appendChild(card);
    });
}

function openReport(report, card) {
    currentReportId = report.id;
    jsonInput.value = JSON.stringify(report, null, 4);
    document.querySelectorAll(".report-card").forEach((item) => {
        item.classList.remove("selected");
    });
    card.classList.add("selected");
    setStatus(`📄 Đã mở báo cáo ${getReportTitle(report)}`);
}

function setStatus(message) {
    status.textContent = message;
}

async function refreshReportList() {
    reports = (await getReports()).reverse();
    renderReportList();
}

document.getElementById("newReport").addEventListener("click", () => {
    currentReportId = null;
    jsonInput.value = `{
    "phien": {},
    "thietBi": {},
    "ketQua": {}
}`;
    renderReportList();
    setStatus("Đang tạo báo cáo mới.");
});

document.getElementById("saveReport").addEventListener("click", async () => {
    let report;

    try {
        report = JSON.parse(jsonInput.value);
    } catch (error) {
        alert("JSON không hợp lệ!\n\n" + error.message);
        return;
    }

    if (!report || typeof report !== "object" || Array.isArray(report)) {
        alert("Báo cáo phải là một đối tượng JSON.");
        return;
    }

    report.id = currentReportId || report.id || crypto.randomUUID();

    try {
        await saveReport(report);
        currentReportId = report.id;
        jsonInput.value = JSON.stringify(report, null, 4);
        await refreshReportList();
        setStatus(`Đã lưu báo cáo ${getReportTitle(report)}.`);
    } catch (error) {
        console.error(error);
        alert("Không thể lưu báo cáo.\n\n" + error.message);
    }
});

document.getElementById("deleteReport").addEventListener("click", async () => {
    if (!currentReportId) {
        alert("Chưa chọn báo cáo.");
        return;
    }

    if (!confirm("Bạn có chắc chắn muốn xóa báo cáo này không?")) {
        return;
    }

    try {
        await deleteReport(currentReportId);
        currentReportId = null;
        jsonInput.value = "";
        await refreshReportList();
        setStatus("Đã xóa báo cáo.");
    } catch (error) {
        console.error(error);
        alert("Không thể xóa báo cáo.\n\n" + error.message);
    }
});

document.getElementById("btn-xoa-tat-ca").addEventListener("click", async () => {
    if (!reports.length || !confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử báo cáo hiện tại không?")) {
        return;
    }

    try {
        await deleteAllReports();
        currentReportId = null;
        jsonInput.value = "";
        await refreshReportList();
        setStatus("Đã xóa toàn bộ lịch sử báo cáo.");
    } catch (error) {
        console.error(error);
        alert("Không thể xóa toàn bộ báo cáo.\n\n" + error.message);
    }
});

async function init() {
    try {
        await refreshReportList();
    } catch (error) {
        console.error("Không thể mở IndexedDB:", error);
        setStatus("Không thể mở IndexedDB.");
    }
}

init();
