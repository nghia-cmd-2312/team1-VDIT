// Xử lý sự kiện Xóa toàn bộ dữ liệu báo cáo
document.getElementById('btn-xoa-tat-ca').addEventListener('click', async function() {
    if (!folderHandle) {
        alert("Chưa chọn thư mục.");
        return;
    }

    const xacNhan = confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử báo cáo hiện tại không?");

    if (!xacNhan) {
        return;
    }

    let soFileDaXoa = 0;

    try {
        for await (const [name, handle] of folderHandle.entries()) {
            if (
                handle.kind === "file" &&
                name.toLowerCase().endsWith(".json")
            ) {
                await folderHandle.removeEntry(name);
                soFileDaXoa++;
            }
        }

        // Cập nhật danh sách file
        await refreshFileList();
        await hienThiDanhSachBaoCao();

        // Reset file hiện tại
        currentFileHandle = null;

        document.getElementById("fileName").value = "";
        document.getElementById("jsonInput").value = "";

        alert(`🗑️ Đã xóa ${soFileDaXoa} báo cáo.`);
    } catch (error) {
        console.error(error);
        setStatus("Có lỗi xảy ra khi xóa file JSON.");
    }
});

let folderHandle = null;
let currentFileHandle = null;

// CHỌN THƯ MỤC

document.getElementById("chooseFolder").onclick = async () => {
    try {
        folderHandle = await window.showDirectoryPicker();
        currentFileHandle = null;
        await refreshFileList();
        setStatus("📁 Đã chọn thư mục.");
    } catch (error) {
        // Người dùng bấm Cancel hoặc lỗi gì đó idk
        console.log(error);
    }
};

// Mảng lưu trữ danh sách file báo cáo để phục vụ truy xuất đồng bộ
let dsBaoCaoHandles = [];

// ==========================
// HIỂN THỊ DANH SÁCH BÁO CÁO
// ==========================

async function renderReportList() {
    const container = document.getElementById("list-bao-cao-container");
    if (!container) return;

    container.innerHTML = "";

    if (!folderHandle) {
        container.innerHTML = '<p class="empty-msg">Chưa chọn thư mục.</p>';
        return;
    }

    let found = false;

    // Duyệt qua tất cả các file JSON trong thư mục
    for await (const [name, handle] of folderHandle.entries()) {
        if (
            handle.kind === "file" &&
            name.toLowerCase().endsWith(".json")
        ) {
            try {
                const file = await handle.getFile();
                const text = await file.text();
                const item = JSON.parse(text);

                found = true;

                const card = document.createElement("div");
                card.className = "report-card";

                card.innerHTML = `
                    <div class="report-header">
                        <div class="report-title">
                            🏫 <strong>${item.phien.phong || 'Phòng Học Không Tên'}</strong> 
                            <span class="report-time">⏰ ${item.phien.thoiDiemKiemTra || 'Chưa rõ thời gian'}</span>
                        </div>
                        <button class="btn-arrow">▼</button>
                    </div>

                    <div class="report-detail" style="display: none;">
                        <div class="detail-content">
                            <p>
                                <strong>⚡ Thiết bị quên tắt:</strong>
                                ${item.dieuHoaQuenTat || 0} Điều hòa,
                                ${item.quatQuenTat || 0} Quạt/Đèn
                            </p>

                            <p>
                                <strong>📉 Điểm thi đua trừ:</strong>
                                <span class="badge-red">
                                    -${item.diemTru || 0} điểm
                                </span>
                            </p>

                            <p>
                                <strong>💰 Ước tính lãng phí:</strong>
                                <span class="badge-green">
                                    ${item.langPhiUocTinh || '0 VNĐ'}
                                </span>
                            </p>

                            <p>
                                <strong>📝 Ghi chú từ AI / GV:</strong>
                                ${item.ghiChu || 'Không có ghi chú'}
                            </p>
                        </div>
                    </div>
                `;

                // Gán sự kiện trực tiếp vào thẻ header của report-card
                const header = card.querySelector(".report-header");
                header.onclick = async (e) => {
                    e.stopPropagation();
                    await toggleReportDetail(handle, name, card);
                };

                container.appendChild(card);
            } catch (error) {
                console.error(`Không thể mở hoặc parse file ${name}:`, error);
            }
        }
    }

    if (!found) {
        container.innerHTML =
            '<p class="empty-msg">Chưa có dữ liệu báo cáo vi phạm nào được ghi nhận.</p>';
    }
}

async function toggleReportDetail(handle, name, cardElement) {
    const detailEl = cardElement.querySelector(".report-detail");
    const arrowEl = cardElement.querySelector(".btn-arrow");

    // 1. Mở file lên Editor
    try {
        const file = await handle.getFile();
        const text = await file.text();

        document.getElementById("fileName").value = name;
        document.getElementById("jsonInput").value = text;

        currentFileHandle = handle;

        // Bỏ active của các phần tử cũ
        document.querySelectorAll("#fileList li, .report-card")
            .forEach(el => el.classList.remove("selected"));

        cardElement.classList.add("selected");

        setStatus("📄 Đã mở " + name);
    } catch (error) {
        console.error("Không thể mở file vào editor:", error);
        setStatus("Không thể mở file.");
    }

    // 2. Toggle trạng thái hiển thị của Viewer
    if (detailEl.style.display === "block") {
        detailEl.style.display = "none";
        if (arrowEl) arrowEl.innerText = "▼";
    } else {
        detailEl.style.display = "block";
        if (arrowEl) arrowEl.innerText = "▲";
    }
}

// Giữ nguyên tương thích tên hàm cũ (tôi lười đổi tên)
async function refreshFileList() {
    await renderReportList();
}

window.onload = renderReportList;

// MỞ FILE

async function openFile(handle, name) {
    try {
        const file = await handle.getFile();
        const text = await file.text();

        document.getElementById("fileName").value = name;
        document.getElementById("jsonInput").value = text;

        // ====================
        // Phần này của code cũ để highlight file đang chọn, chưa được lắp vào code mới

        // currentFileHandle = handle;

        // // Xóa trạng thái selected cũ
        // document.querySelectorAll("#fileList li")
        //     .forEach(li => li.classList.remove("selected"));

        // element.classList.add("selected");

        // ====================

        setStatus("📄 Đã mở " + name);
    } catch (error) {
        console.error(error);
        setStatus("Không thể mở file.");
    }
}


// FILE MỚI

document.getElementById("newFile").onclick = () => {
    currentFileHandle = null;

    document.getElementById("fileName").value = "";
    document.getElementById("jsonInput").value =
    `{
        "name": "",
        "value": 0
    }`;

    document.querySelectorAll("#fileList li")
        .forEach(li => li.classList.remove("selected"));

    setStatus("Đang tạo file mới.");
};


// LƯU FILE

document.getElementById("saveFile").onclick = async () => {
    if (!folderHandle) {
        alert("Hãy chọn thư mục trước.");
        return;
    }

    const fileNameInput =
        document.getElementById("fileName");
    const jsonInput =
        document.getElementById("jsonInput");

    let fileName = fileNameInput.value.trim();

    const text = jsonInput.value;


    // Kiểm tra tên
    if (fileName === "") {
        alert("Hãy nhập tên file.");
        return;
    }

    // Tự thêm .json
    if (!fileName.toLowerCase().endsWith(".json")) {
        fileName += ".json";
    }

    // Kiểm tra JSON
    try {
        JSON.parse(text);
    } catch (error) {
        alert("JSON không hợp lệ!\n\n" + error.message);
        return;
    }


    // Tạo / mở file
    try {
        const fileHandle =
            await folderHandle.getFileHandle(
                fileName,
                { create: true }
            );

        // Ghi file
        const writable =
            await fileHandle.createWritable();
        await writable.write(text);
        await writable.close();

        // Cập nhật trạng thái
        currentFileHandle = fileHandle;
        fileNameInput.value = fileName;

        await refreshFileList();

        setStatus("Đã lưu " + fileName);
    } catch (error) {
        console.error(error);
        alert(
            "Không thể lưu file.\n\n" +
            error.message
        );
    }
};


// XÓA FILE

document.getElementById("deleteFile").onclick = async () => {
    if (!folderHandle) {
        alert("Hãy chọn thư mục trước.");
        return;
    }
    if (!currentFileHandle) {
        alert("Chưa chọn file.");
        return;
    }
    const fileName =
        document.getElementById("fileName").value;

    const confirmed =
        confirm(`Xóa "${fileName}"?`);

    if (!confirmed) {
        return;
    }

    try {
        await folderHandle.removeEntry(fileName);

        currentFileHandle = null;

        document.getElementById("fileName").value = "";
        document.getElementById("jsonInput").value = "";

        await refreshFileList();

        setStatus("Đã xóa " + fileName);
    } catch (error) {
        console.error(error);
        alert(
            "Không thể xóa file.\n\n" +
            error.message
        );
    }
};


// STATUS (dòng chữ nhỏ ở dưới)

function setStatus(message) {
    document.getElementById("status").textContent =
        message;
}

// ====================
// -----
// Cái thứ này là code cũ hiển thị danh sách file JSON, không cần quan tâm đâu
// -----

// async function refreshFileList() {
//     const fileList = document.getElementById("fileList");

//     fileList.innerHTML = "";

//     if (!folderHandle) {
//         fileList.innerHTML = "<li>Chưa chọn thư mục</li>";
//         return;
//     }

//     let found = false;

//     for await (const [name, handle] of folderHandle.entries()) {
//         if (
//             handle.kind === "file" &&
//             name.toLowerCase().endsWith(".json")
//         ) {
//             found = true;

//             const li = document.createElement("li");
//             li.textContent = "📄 " + name;
//             li.onclick = () => openFile(handle, name, li);

//             fileList.appendChild(li);
//         }
//     }

//     if (!found) {
//         fileList.innerHTML = "<li>Không có file JSON</li>";
//     }
// }

// ====================