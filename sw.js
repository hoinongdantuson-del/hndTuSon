// Service Worker cho "Sổ hội viên số" — bản phát hành TS148 ngày 18/10/2026 (gói _pkg148-18-10).
// Nội dung từ sw-TEST-dot2.js (bản thử Đợt 2, đã kiểm ở các đợt 2–3C); chỉ đổi phần đầu này và tên bộ đệm.
//
// Cách hoạt động: lần đầu mở (có mạng), trình duyệt tự lưu lại các file chính (trang chính, biểu tượng, thư
// viện...) vào bộ nhớ đệm ngay trên máy. Từ lần sau, mở được cả khi mất mạng hoặc mạng rất yếu.
//
// ĐỢT 2 / 3.1 (L05): trước đây thư viện CDN (Excel, ZIP, QR) và phông chữ được tải theo kiểu "ƯU TIÊN MẠNG" —
// mạng chập chờn (có sóng nhưng gần như không chạy) thì trang phải CHỜ mạng tới khi hết giờ, màn hình trắng suốt
// thời gian đó (đo: treo 20 giây -> trắng 21 giây). Các URL thư viện đều có SỐ PHIÊN BẢN cố định (xlsx@0.18.5...)
// nên nội dung KHÔNG BAO GIỜ đổi -> nay lấy TỪ BỘ ĐỆM TRƯỚC, chỉ ra mạng khi bộ đệm chưa có.
// ĐỢT 2 / 3.2 (L06): trước đây mọi phản hồi khi mở trang đều được ghi đè vào bộ đệm, kể cả trang đăng nhập Wi-Fi
// công cộng, trang lỗi 404/500 -> lần sau mất mạng thì mở ra trang Wi-Fi thay vì phần mềm (đã tái hiện). Nay
// CHỈ lưu khi phản hồi hợp lệ (200, cùng nguồn, là HTML) VÀ đúng là trang phần mềm (có dấu nhận diện bên trong).
// Đồng thời KHÔNG còn trả trang chính thay cho file script/ảnh bị lỗi (trước đây gây "SyntaxError: '<'").

const TEN_CACHE = "so-hoi-vien-v193"; // TS148 phát hành 18/10/2026 (bản 2-10 là v192) — đổi tên để máy đã cài tự lấy bản mới và xoá bộ đệm cũ
const CAC_FILE_CAN_LUU = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
  "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js",
  // ĐỢT 2: phông chữ — lưu sẵn bảng kiểu (CSS); tệp phông thật (fonts.gstatic.com) tự lưu ở lần dùng đầu.
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap",
];
// Dấu nhận diện "đúng là trang phần mềm" — chuỗi có sẵn trong mã trang chính (biến hiển thị phiên bản).
const DAU_NHAN_DIEN_TRANG = "PHIEN_BAN_HIEN_THI";

// Lưu TỪNG FILE RIÊNG LẺ (không dùng cache.addAll gộp chung): 1 file lỗi (đặc biệt file ở máy chủ ngoài) không
// được làm hỏng việc lưu các file còn lại — đây từng là nguyên nhân "có mạng mở được nhưng offline không vào được".
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(TEN_CACHE).then((cache) =>
      Promise.all(CAC_FILE_CAN_LUU.map((url) =>
        cache.add(url).catch((err) => { console.warn("Không lưu được offline (bỏ qua, không ảnh hưởng file khác):", url, err); })
      ))
    )
  );
  // AUDIT #9 (2026-09-12): KHÔNG tự skipWaiting — chờ người dùng bấm "Tải lại ngay" ở banner (thông điệp SKIP_WAITING).
});
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
// Dọn bộ nhớ đệm phiên bản cũ khi bản mới được kích hoạt.
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((ds) => Promise.all(ds.filter((t) => t !== TEN_CACHE).map((t) => caches.delete(t)))));
  self.clients.claim();
});

// Thư viện/phông chữ có phiên bản cố định -> lấy từ bộ đệm trước.
function laTaiNguyenBatBien(url) {
  return (url.hostname === "cdn.jsdelivr.net" && /@\d+\.\d+\.\d+\//.test(url.pathname))
    || url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com";
}
// Phản hồi trang chính có đáng lưu không: 200, cùng nguồn (không phải trang của máy chủ khác do chuyển hướng),
// đúng kiểu HTML, và trong nội dung có dấu nhận diện của phần mềm.
async function laTrangPhanMemHopLe(res) {
  try {
    if (!res || !res.ok || res.status !== 200) return false;
    if (res.type !== "basic" && res.type !== "default") return false;
    if (res.redirected) { const u = new URL(res.url); if (u.origin !== self.location.origin) return false; }
    const kieu = (res.headers.get("content-type") || "").toLowerCase();
    if (kieu && !kieu.includes("text/html")) return false;
    const noiDung = await res.clone().text();
    return noiDung.includes(DAU_NHAN_DIEN_TRANG);
  } catch (e) { return false; }
}
// Lưu phản hồi thường (không phải trang chính): chỉ khi hợp lệ.
function luuNeuHopLe(req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    const banSao = res.clone();
    caches.open(TEN_CACHE).then((c) => c.put(req, banSao)).catch(() => {});
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url; try { url = new URL(req.url); } catch (e) { return; }

  // 1) MỞ/TẢI LẠI TRANG: lấy bản đã lưu NGAY (không chờ mạng — iOS mở từ màn hình chính có thể gửi địa chỉ hơi
  //    khác, nên luôn dùng đúng khoá "./index.html"); đồng thời âm thầm tải bản mới, CHỈ ghi đè khi là trang
  //    phần mềm hợp lệ. Chưa có bản lưu (lần đầu) thì dùng mạng như bình thường.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const daLuu = await caches.match("./index.html");
      const taiMoi = fetch(req).then(async (res) => {
        if (await laTrangPhanMemHopLe(res)) { const banSao = res.clone(); caches.open(TEN_CACHE).then((c) => c.put("./index.html", banSao)).catch(() => {}); }
        return res;
      }).catch(() => null);
      if (daLuu) { event.waitUntil(taiMoi); return daLuu; }
      const res = await taiMoi;
      return res || new Response("<meta charset=utf-8><p style='font-family:sans-serif;padding:20px'>Chưa mở được phần mềm: máy đang mất mạng và chưa từng mở phần mềm này khi có mạng. Hãy kết nối mạng rồi mở lại.</p>", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    })());
    return;
  }

  // 2) THƯ VIỆN / PHÔNG CHỮ có phiên bản cố định: BỘ ĐỆM TRƯỚC.
  if (laTaiNguyenBatBien(url)) {
    event.respondWith(caches.match(req).then((daLuu) => daLuu || fetch(req).then((res) => luuNeuHopLe(req, res))));
    return;
  }

  // 3) File khác CÙNG NGUỒN (manifest, biểu tượng...): ưu tiên mạng, lỗi thì lấy bộ đệm. KHÔNG trả trang chính
  //    thay cho file khác (trước đây trả index.html cho mọi file lỗi -> trình duyệt đọc nhầm HTML thành script).
  if (url.origin === self.location.origin) {
    event.respondWith(fetch(req).then((res) => luuNeuHopLe(req, res)).catch(() => caches.match(req).then((r) => r || Response.error())));
    return;
  }
  // 4) Máy chủ khác (không thuộc phần mềm): để trình duyệt tự xử lý, không lưu, không can thiệp.
});
