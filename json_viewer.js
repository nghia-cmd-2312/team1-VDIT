// ===============================
// INDEXEDDB
// ===============================

const DB_NAME = "ecoaiDB";
const DB_VERSION = 1;
const STORE_NAME = "reports";

let reports = [];
const reportsChannel = typeof BroadcastChannel !== "undefined"
  ? new BroadcastChannel("green-viet-duc-reports")
  : null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });

        // Có thể thêm index nếu sau này cần tìm kiếm
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

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// ===============================
// LẤY TOÀN BỘ REPORT
// ===============================

async function getReports() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
// ===============================
// DOM
// ===============================

const jsonInput = document.getElementById("jsonInput");
const btn = document.getElementById("btn");
const reportList = document.getElementById("reportList");

// ===============================
// RENDER REPORTS
// ===============================

function formatEnergy(wh) {
  const kwh = Number(wh || 0) / 1000;
  return `${kwh.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} kWh`;
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function getReportTimestamp(report) {
  const session = report.phien || {};
  const date = String(session.ngayKiemTra || "").trim();
  const time = String(session.thoiDiemKiemTra || "00:00").trim();
  const match = date.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (!match) {
    return 0;
  }

  const [, day, month, year] = match;
  const [hours = "0", minutes = "0"] = time.split(":");
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)).getTime();
}

function sortReportsNewestFirst(reportItems) {
  return [...reportItems].sort((first, second) => {
    const timestampDifference = getReportTimestamp(second) - getReportTimestamp(first);
    return timestampDifference || String(second.id || "").localeCompare(String(first.id || ""));
  });
}

function updateEnergyHighlights(reportItems) {
  const savedWh = reportItems.reduce(
    (total, report) => total + Number(report.ketQua?.uocTinhTietKiem_Wh || 0),
    0,
  );
  const savedVnd = reportItems.reduce(
    (total, report) => total + Number(report.ketQua?.uocTinhTietKiem_VND || 0),
    0,
  );
  const savedKwh = document.getElementById("energy-saved-kwh") || document.getElementById("student-saved-kwh");
  const studentKwh = document.getElementById("student-saved-kwh");
  const studentVnd = document.getElementById("student-saved-vnd");
  const savedVndLabel = document.getElementById("energy-saved-vnd");
  const reportCountLabel = document.getElementById("energy-report-count");
  const scoreLabel = document.getElementById("energy-score");
  const meterFill = document.getElementById("energy-meter-fill");
  const classCountLabel = document.getElementById("energy-class-count");
  const scoredReports = reportItems
    .map((report) => {
      const result = report.ketQua || {};
      if (result.diemThiDua !== undefined) return Number(result.diemThiDua);
      if (result.diemBiTru !== undefined) return 100 - Number(result.diemBiTru);
      return null;
    })
    .filter((score) => Number.isFinite(score));
  const averageScore = scoredReports.length
    ? Math.round(scoredReports.reduce((total, score) => total + score, 0) / scoredReports.length)
    : 0;
  const classCount = new Set(
    reportItems
      .map((report) => String(report.phien?.lopNhom || "").trim().toLocaleLowerCase("vi-VN"))
      .filter(Boolean),
  ).size;

  if (savedKwh) savedKwh.textContent = formatEnergy(savedWh);
  if (studentKwh) studentKwh.textContent = formatEnergy(savedWh);
  if (studentVnd) studentVnd.textContent = formatCurrency(savedVnd);
  if (savedVndLabel) savedVndLabel.textContent = `Tiết kiệm ${formatCurrency(savedVnd)}`;
  if (reportCountLabel) reportCountLabel.textContent = `${reportItems.length} báo cáo`;
  if (scoreLabel) scoreLabel.textContent = averageScore;
  if (meterFill) meterFill.style.width = `${averageScore}%`;
  if (classCountLabel) classCountLabel.textContent = `${classCount} lớp`;
}

function updateStudentRanking(reportItems) {
  const rankingList = document.getElementById("rankingList");

  if (!rankingList) {
    return;
  }

  const groups = new Map();
  reportItems.forEach((report) => {
    const groupName = String(report.phien?.lopNhom || "").trim();
    const result = report.ketQua || {};
    const score = result.diemThiDua !== undefined
      ? Number(result.diemThiDua)
      : result.diemBiTru !== undefined
        ? 100 - Number(result.diemBiTru)
        : null;

    if (!groupName || !Number.isFinite(score)) {
      return;
    }

    const current = groups.get(groupName) || { total: 0, count: 0 };
    current.total += score;
    current.count += 1;
    groups.set(groupName, current);
  });

  const ranking = [...groups.entries()]
    .map(([name, value]) => ({ name, score: Math.round(value.total / value.count), count: value.count }))
    .sort((first, second) => second.score - first.score || first.name.localeCompare(second.name, "vi"));

  if (!ranking.length) {
    rankingList.innerHTML = '<div class="ranking-empty">Bảng xếp hạng sẽ xuất hiện khi có báo cáo được xác nhận.</div>';
    return;
  }

  rankingList.innerHTML = ranking
    .map((item, index) => `
      <div class="ranking-row">
        <span class="ranking-rank">${String(index + 1).padStart(2, "0")}</span>
        <div class="ranking-name"><strong>${item.name}</strong><small>${item.count} báo cáo đã xác nhận</small></div>
        <div class="ranking-score">${item.score}<span>/100</span></div>
        <div class="ranking-trend">● Đang theo dõi</div>
      </div>
    `)
    .join("");
}

async function refreshViewerData() {
  reports = sortReportsNewestFirst(await getReports());
  updateEnergyHighlights(reports);
  updateStudentRanking(reports);
  renderReports();
}

reportsChannel?.addEventListener("message", () => {
  refreshViewerData().catch((error) => console.error("Không thể đồng bộ báo cáo:", error));
});

window.addEventListener("storage", (event) => {
  if (event.key === "green-viet-duc-reports-updated") {
    refreshViewerData().catch((error) => console.error("Không thể đồng bộ báo cáo:", error));
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshViewerData().catch((error) => console.error("Không thể làm mới báo cáo:", error));
  }
});

function renderReports() {
  if (!reportList) {
    return;
  }

  reportList.innerHTML = reports
    .map((report, index) => {
      const p = report.phien || {};
      const tb = report.thietBi || {};
      const kq = report.ketQua || {};

      const reportId = report.id || "N/A";

      const reportDate = p.ngayKiemTra || "N/A";

      const reportTime = p.thoiDiemKiemTra || "N/A";

      const actions = [
        ...(report.hanhDong?.hocSinh || []),
        ...(report.hanhDong?.giaoVien || []),
        ...(report.hanhDong?.clb || []),
        ...(report.hanhDong?.nhom || []),
        ...(report.hanhDong?.khac || []),
      ];

      const badgeClass =
        kq.mucDoLangPhi === "CAO"
          ? "bg-danger-subtle text-danger"
          : kq.mucDoLangPhi === "TRUNG BÌNH"
            ? "bg-warning-subtle text-warning-emphasis"
            : kq.mucDoLangPhi === "THẤP"
              ? "bg-primary-subtle text-primary-emphasis"
              : "bg-success-subtle text-success";

      return `
        <div class="col-12 mb-4">

          <div
            class="card border-0 overflow-hidden report-card-modern"
            style="
              border-radius:20px;
              box-shadow:
                0 2px 4px rgba(0,0,0,.04),
                0 8px 20px rgba(0,0,0,.06),
                0 20px 45px rgba(0,0,0,.08);
            "
          >

            <!-- HEADER -->

            <div
              class="card-header border-0 bg-white px-4 py-3 report-card-header"
              data-bs-toggle="collapse"
              data-bs-target="#report-${index}"
              role="button"
              style="cursor:pointer;"
            >

              <div
                class="d-flex justify-content-between align-items-center"
              >

                <div
                  class="d-flex align-items-center gap-3"
                >

                  <div
                    class="report-icon
                      d-flex
                      align-items-center
                      justify-content-center
                    "
                    style="
                      width:46px;
                      height:46px;
                      border-radius:14px;
                      background:#f4f5f7;
                      box-shadow:
                        inset 0 1px 2px rgba(0,0,0,.04),
                        0 4px 12px rgba(0,0,0,.06);
                    "
                  >
                    ⚡
                  </div>

                  <div>

                    <div class="report-eyebrow">NHẬT KÝ TIẾT KIỆM ĐIỆN</div>
                    <h5 class="mb-1 fw-semibold report-room">
                      ${p.phong || "Không có dữ liệu"}
                    </h5>

                    <div class="text-muted small report-context">
                      ${p.lopNhom || "N/A"}
                      ·
                      ${p.donViSuDung || "N/A"}
                    </div>

                    <div
                      class="text-muted report-meta"
                      style="font-size:.7rem;"
                    >
                      ${reportDate}
                      ·
                      ${reportTime}
                      ·
                      ID: ${reportId.slice(0, 8)}
                    </div>

                  </div>

                </div>


                <!-- MỨC ĐỘ -->

                <span
                  class="report-level
                    badge
                    rounded-pill
                    px-3
                    py-2
                    ${badgeClass}
                  "
                  style="
                    font-size:.7rem;
                    font-weight:600;
                  "
                >
                  ${kq.mucDoLangPhi || "N/A"}
                </span>

              </div>

            </div>


            <!-- CONTENT -->

            <div
              id="report-${index}"
              class="collapse"
            >

              <div
                class="
                  card-body report-card-content
                  bg-light-subtle
                  px-4
                  pb-4
                  pt-2
                "
              >

                <!-- THÔNG TIN PHIÊN -->

                <div
                  class="
                    bg-white
                    rounded-4
                    p-4
                    mb-3
                  "
                  style="
                    box-shadow:
                      0 1px 3px rgba(0,0,0,.03),
                      0 6px 18px rgba(0,0,0,.04);
                  "
                >

                  <h6 class="fw-semibold mb-3">
                    Thông tin phiên
                  </h6>

                  <div class="row g-3">

                    <div class="col-md-6">
                      <div class="text-muted small">
                        Giáo viên quản lí
                      </div>

                      <div class="fw-medium">
                        ${p.giaoVienQuanLi || "N/A"}
                      </div>
                    </div>


                    <div class="col-md-6">
                      <div class="text-muted small">
                        Đơn vị sử dụng
                      </div>

                      <div class="fw-medium">
                        ${p.donViSuDung || "N/A"}
                      </div>
                    </div>


                    <div class="col-md-6">
                      <div class="text-muted small">
                        Thời gian sử dụng
                      </div>

                      <div class="fw-medium">
                        ${p.thoiGianBatDau || "N/A"}
                        –
                        ${p.thoiGianKetThuc || "N/A"}
                      </div>
                    </div>


                    <div class="col-md-6">
                      <div class="text-muted small">
                        Thời điểm kiểm tra
                      </div>

                      <div class="fw-medium">
                        ${p.thoiDiemKiemTra || "Không có dữ liệu"}
                      </div>
                    </div>


                    <div class="col-md-6">
                      <div class="text-muted small">
                        Mục đích sử dụng
                      </div>

                      <div class="fw-medium">
                        ${p.mucDichSuDung || "N/A"}
                      </div>
                    </div>


                    <div class="col-md-6">
                      <div class="text-muted small">
                        Số người có mặt
                      </div>

                      <div class="fw-medium">
                        ${p.soNguoiCoMat ?? "N/A"}
                      </div>
                    </div>

                  </div>


                  ${p.ghiChuThem
          ? `
                        <div
                          class="
                            mt-3
                            pt-3
                            border-top
                          "
                        >

                          <div
                            class="
                              text-muted
                              small
                              mb-1
                            "
                          >
                            Ghi chú
                          </div>

                          <div>
                            ${p.ghiChuThem}
                          </div>

                        </div>
                      `
          : ""
        }

                </div>


                <!-- THIẾT BỊ -->

                <div
                  class="
                    bg-white
                    rounded-4
                    p-4
                    mb-3
                  "
                  style="
                    box-shadow:
                      0 1px 3px rgba(0,0,0,.03),
                      0 6px 18px rgba(0,0,0,.04);
                  "
                >

                  <h6 class="fw-semibold mb-3">
                    Trạng thái thiết bị
                  </h6>

                  <div class="row g-3">

                    ${createDevice("Đèn", tb.den)}

                    ${createDevice("Máy chiếu", tb.mayChieu)}

                    ${createDevice("Điều hòa", tb.dieuHoa)}

                    ${createDevice("Quạt", tb.quat)}

                    ${createDevice("Máy tính", tb.mayTinh, tb.mayTinhConBat)}

                    ${tb.thietBiKhac
          ? `
                          <div class="col-6 col-md-4">

                            <div
                              class="rounded-3 p-3"
                              style="
                                background:
                                  rgba(108,117,125,.07);

                                box-shadow:
                                  0 4px 12px
                                  rgba(108,117,125,.08);
                              "
                            >

                              <small
                                class="
                                  text-muted
                                  d-block
                                  mb-1
                                "
                              >
                                Thiết bị khác
                              </small>

                              <strong>
                                ${tb.thietBiKhac}
                              </strong>

                            </div>

                          </div>
                        `
          : ""
        }

                  </div>

                </div>


                <!-- ĐÁNH GIÁ -->

                <div
                  class="
                    bg-white
                    rounded-4
                    p-4
                    mb-3
                  "
                  style="
                    box-shadow:
                      0 1px 3px rgba(0,0,0,.03),
                      0 8px 22px rgba(0,0,0,.05);
                  "
                >

                  <div
                    class="
                      d-flex
                      justify-content-between
                      align-items-center
                      mb-3
                    "
                  >

                    <h6 class="fw-semibold mb-0">
                      Đánh giá
                    </h6>

                    <span
                      class="
                        badge
                        rounded-pill
                        ${badgeClass}
                      "
                      style="font-size:.7rem;"
                    >
                      ${kq.mucDoLangPhi || "N/A"}
                    </span>

                  </div>


                  <div class="row g-3">

                    <div class="col-md-4">

                      <div class="text-muted small">
                        Điểm thi đua
                      </div>

                      <div class="fs-3 fw-bold">
                        ${kq.diemThiDua ?? "N/A"}
                      </div>

                    </div>


                    <div class="col-md-8">

                      <div class="text-muted small">
                        Loại điểm
                      </div>

                      <div class="fw-medium">
                        ${kq.loaiDiem || "N/A"}
                      </div>

                    </div>

                    ${kq.uocTinhTietKiem_Wh !== undefined || kq.uocTinhLangPhi_Wh !== undefined || kq.uocTinhTietKiem_VND !== undefined
          ? `
                      <div class="col-12">
                        <div class="report-impact-grid">
                          ${kq.uocTinhTietKiem_Wh !== undefined
            ? `<div class="report-impact-item"><span>Điện có thể tiết kiệm</span><strong>${formatEnergy(kq.uocTinhTietKiem_Wh)}</strong></div>`
            : ""}
                          ${kq.uocTinhLangPhi_Wh !== undefined
            ? `<div class="report-impact-item report-impact-waste"><span>Điện đang lãng phí</span><strong>${formatEnergy(kq.uocTinhLangPhi_Wh)}</strong></div>`
            : ""}
                          ${kq.uocTinhTietKiem_VND !== undefined
            ? `<div class="report-impact-item report-impact-money"><span>Chi phí tiết kiệm ước tính</span><strong>${formatCurrency(kq.uocTinhTietKiem_VND)}</strong></div>`
            : ""}
                        </div>
                      </div>
                    `
          : ""}

                  </div>


                  ${kq.canCu
          ? `
                        <div
                          class="
                            mt-3
                            pt-3
                            border-top
                          "
                        >

                          <div
                            class="
                              text-muted
                              small
                              mb-1
                            "
                          >
                            Căn cứ đánh giá
                          </div>

                          <div class="text-secondary">
                            ${kq.canCu}
                          </div>

                        </div>
                      `
          : ""
        }


                  ${kq.viphamLapLai !== undefined
          ? `
                        <div class="mt-3">

                          <span class="text-muted small">
                            Vi phạm lặp lại:
                          </span>

                          <strong>
                            ${kq.viphamLapLai ? "Có" : "Không"}
                          </strong>

                        </div>
                      `
          : ""
        }

                </div>


                <!-- HÀNH ĐỘNG -->

                <div
                  class="
                    bg-white
                    rounded-4
                    p-4
                    mb-3
                  "
                  style="
                    box-shadow:
                      0 1px 3px rgba(0,0,0,.03),
                      0 6px 18px rgba(0,0,0,.04);
                  "
                >

                  <h6 class="fw-semibold mb-3">
                    Hành động khuyến nghị
                  </h6>

                  ${actions.length
          ? `
                        <div
                          class="
                            d-flex
                            flex-column
                            gap-2
                          "
                        >

                          ${actions
            .map(
              (action) => `
                                <div
                                  class="
                                    d-flex
                                    gap-2
                                    align-items-start
                                  "
                                >

                                  <span class="text-success">
                                    ✓
                                  </span>

                                  <span>
                                    ${action}
                                  </span>

                                </div>
                              `,
            )
            .join("")}

                        </div>
                      `
          : `
                        <div class="text-muted">
                          Không có hành động.
                        </div>
                      `
        }

                </div>


                <!-- THÔNG ĐIỆP VẬN ĐỘNG -->

                ${report.thongDiepVanDong
          ? `
                      <div
                        class="
                          rounded-4
                          p-4
                          mb-3
                        "
                        style="
                          background:
                            linear-gradient(
                              135deg,
                              rgba(13,110,253,.06),
                              rgba(25,135,84,.05)
                            );

                          box-shadow:
                            0 1px 3px
                            rgba(0,0,0,.03),

                            0 8px 24px
                            rgba(13,110,253,.08);
                        "
                      >

                        <div
                          class="
                            d-flex
                            align-items-center
                            gap-2
                            mb-3
                          "
                        >

                          <div
                            class="
                              d-flex
                              align-items-center
                              justify-content-center
                            "
                            style="
                              width:36px;
                              height:36px;
                              border-radius:11px;
                              background:
                                rgba(13,110,253,.10);
                            "
                          >
                            💡
                          </div>

                          <h6 class="fw-semibold mb-0">
                            Thông điệp vận động
                          </h6>

                        </div>


                        ${report.thongDiepVanDong.tieuDe
            ? `
                              <h5
                                class="
                                  fw-semibold
                                  mb-2
                                "
                              >
                                ${report.thongDiepVanDong.tieuDe}
                              </h5>
                            `
            : ""
          }


                        ${report.thongDiepVanDong.thongDiep
            ? `
                              <p
                                class="
                                  text-secondary
                                  mb-3
                                "
                              >
                                ${report.thongDiepVanDong.thongDiep}
                              </p>
                            `
            : ""
          }


                        ${report.thongDiepVanDong.viecNhoMoiNgay?.length
            ? `
                              <div class="mb-3">

                                <div
                                  class="
                                    text-muted
                                    small
                                    fw-semibold
                                    mb-2
                                  "
                                >
                                  Việc nhỏ mỗi ngày
                                </div>

                                <div
                                  class="
                                    d-flex
                                    flex-column
                                    gap-2
                                  "
                                >

                                  ${report.thongDiepVanDong.viecNhoMoiNgay
              .map(
                (item) => `
                                        <div
                                          class="
                                            d-flex
                                            gap-2
                                            align-items-start
                                          "
                                        >

                                          <span
                                            class="
                                              text-success
                                              fw-bold
                                            "
                                          >
                                            ✓
                                          </span>

                                          <span>
                                            ${item}
                                          </span>

                                        </div>
                                      `,
              )
              .join("")}

                                </div>

                              </div>
                            `
            : ""
          }


                        ${report.thongDiepVanDong.loiKeuGoi
            ? `
                              <div
                                class="
                                  pt-3
                                  border-top
                                "
                              >

                                <strong>
                                  ${report.thongDiepVanDong.loiKeuGoi}
                                </strong>

                              </div>
                            `
            : ""
          }

                      </div>
                    `
          : ""
        }


                <!-- KẾT LUẬN -->

                <div
                  class="
                    rounded-4
                    p-4
                  "
                  style="
                    background:#f8f9fa;

                    box-shadow:
                      inset 0 1px 2px
                      rgba(0,0,0,.03),

                      0 4px 14px
                      rgba(0,0,0,.04);
                  "
                >

                  <h6 class="fw-semibold mb-2">
                    Kết luận
                  </h6>

                  <p
                    class="
                      mb-0
                      text-secondary
                    "
                  >
                    ${report.ketLuan || "Không có dữ liệu"}
                  </p>

                </div>

              </div>

            </div>

          </div>

        </div>
      `;
    })
    .join("");
}

// ===============================
// DEVICE CARD
// ===============================

function createDevice(name, status, count = null) {
  const isOn = status === "Bật";

  return `
    <div class="col-6 col-md-4">

      <div
        class="rounded-3 p-3"
        style="
          background:
            ${isOn ? "rgba(25,135,84,.08)" : "rgba(108,117,125,.07)"};

          box-shadow:
            0 4px 12px
            ${isOn ? "rgba(25,135,84,.12)" : "rgba(108,117,125,.08)"};
        "
      >

        <small
          class="
            text-muted
            d-block
            mb-1
          "
        >
          ${name}
        </small>

        <strong>
          ${status || "Không có dữ liệu"}
        </strong>

        ${count
      ? `
              <small
                class="
                  text-muted
                  ms-1
                "
              >
                (${count} máy)
              </small>
            `
      : ""
    }

      </div>

    </div>
  `;
}

// ===============================
// KHỞI ĐỘNG
// ===============================

async function init() {
  try {
    // Đọc toàn bộ dữ liệu từ IndexedDB
    await refreshViewerData();
  } catch (error) {
    console.error("Không thể mở IndexedDB:", error);

    alert("Không thể tải dữ liệu báo cáo!");
  }
}

init();