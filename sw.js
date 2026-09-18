// Service Worker cho "Sổ hội viên số" — giúp mở được cả khi KHÔNG có mạng,
// sau khi đã mở thành công ít nhất 1 lần lúc có mạng.
//
// Cách hoạt động: lần đầu mở (có mạng), trình duyệt tự lưu lại các file
// chính (trang chính, biểu tượng...) vào bộ nhớ đệm ngay trên máy. Từ lần
// sau, nếu không có mạng, trình duyệt lấy thẳng từ bộ nhớ đệm đó ra dùng.

const TEN_CACHE = "so-hoi-vien-v161";
const CAC_FILE_CAN_LUU = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  // Thư viện tạo file Word (.docx) — trước đây bị bỏ sót khỏi danh sách lưu
  // offline, khiến nút "Xuất báo cáo Word" hỏng khi dùng offline trên máy mới.
  "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
];

// Khi Service Worker được cài đặt lần đầu: lưu sẵn các file chính vào bộ
// nhớ đệm — LƯU TỪNG FILE RIÊNG LẺ (không dùng cache.addAll gộp chung),
// vì nếu 1 file lỗi (đặc biệt file tải từ máy chủ ngoài như thư viện đọc
// Excel) mà gộp chung thì TOÀN BỘ đều không được lưu, kể cả file chính của
// phần mềm — đây chính là nguyên nhân trước đây "mở bình thường lúc có
// mạng nhưng offline lại không vào được".
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(TEN_CACHE).then((cache) =>
      Promise.all(
        CAC_FILE_CAN_LUU.map((url) =>
          cache.add(url).catch((err) => {
            // Chỉ bỏ qua đúng file bị lỗi, không ảnh hưởng các file còn lại
            console.warn("Không lưu được offline (bỏ qua, không ảnh hưởng file khác):", url, err);
          })
        )
      )
    )
  );
  // AUDIT #9 (2026-09-12): TRƯỚC ĐÂY gọi self.skipWaiting() ngay ở đây, khiến
  // bản mới kích hoạt gần như tức thì sau khi cài xong — không có khoảng
  // "đang chờ" (registration.waiting) nào để trang chính phát hiện và báo
  // cho người dùng biết có bản mới. Nay KHÔNG tự gọi nữa — worker mới nằm
  // chờ đúng chuẩn cho tới khi trang chính chủ động gửi thông điệp
  // "SKIP_WAITING" (xem addEventListener("message") bên dưới), tức là sau
  // khi người dùng tự bấm "Tải lại ngay" ở banner thông báo. Không đổi gì
  // khác ở bước cài đặt (vẫn lưu offline y hệt cũ).
});
// AUDIT #9: trang chính gửi thông điệp này khi người dùng tự bấm "Tải lại
// ngay" — CHỈ lúc đó worker mới thật sự bỏ qua bước chờ và kích hoạt.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Dọn bộ nhớ đệm phiên bản cũ nếu có, khi Service Worker mới được kích hoạt
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((tenCacheCu) =>
      Promise.all(
        tenCacheCu
          .filter((ten) => ten !== TEN_CACHE)
          .map((ten) => caches.delete(ten))
      )
    )
  );
  self.clients.claim();
});

// Xử lý khi trang cần tải dữ liệu:
// - Với yêu cầu MỞ/TẢI LẠI TRANG (mở app từ biểu tượng, bấm F5...): LUÔN lấy
//   ngay từ bộ nhớ đệm trước tiên nếu đã có sẵn — không chờ đợi mạng thất
//   bại mới quay lại tìm, và không phụ thuộc việc so khớp CHÍNH XÁC từng
//   ký tự địa chỉ (cách cũ dùng caches.match(event.request) có thể bị lệch
//   khi mở từ biểu tượng Màn hình chính do iOS gửi yêu cầu hơi khác lúc
//   duyệt web thường — đây là nguyên nhân "vẫn không vào được" dù đã lưu
//   offline đúng cách). Vẫn âm thầm tải bản mới nhất cập nhật lại bộ nhớ
//   đệm phía sau nếu đang có mạng.
// - Với các file khác (icon, manifest, thư viện...): ưu tiên mạng trước,
//   lấy bộ nhớ đệm khi mạng lỗi, như trước.
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then((daLuu) => {
        const capNhatNgamPhiaSau = fetch(event.request)
          .then((res) => {
            caches.open(TEN_CACHE).then((cache) => cache.put("./index.html", res.clone()));
            return res;
          })
          .catch(() => null);
        return daLuu || capNhatNgamPhiaSau.then((res) => res || caches.match("./index.html"));
      })
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((phanHoiMoi) => {
        const banSao = phanHoiMoi.clone();
        caches.open(TEN_CACHE).then((cache) => cache.put(event.request, banSao));
        return phanHoiMoi;
      })
      .catch(() =>
        caches.match(event.request).then((banLuu) => banLuu || caches.match("./index.html"))
      )
  );
});
