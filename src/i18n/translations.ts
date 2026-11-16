import type { SupportedLang } from "@/types/jlpt";

export interface UiDictionary {
  header: {
    home: string;
    login: string;
    signOut: string;
    dashboard: string;
    langMenuTitle: string;
  };
  landing: {
    badge: string;
    heroTitle: string;
    heroDescBefore: string;
    heroDescAfter: string;
    ctaPrimaryGuest: string;
    ctaPrimaryUser: string;
    ctaSignIn: string;
    freeNote: string;
    f1Title: string;
    f1Desc: string;
    f2Title: string;
    f2Desc: string;
    f3Title: string;
    f3Desc: string;
    f4Title: string;
    f4Desc: string;
    gradingNote: string;
  };
  auth: {
    signInTitle: string;
    signUpTitle: string;
    subtitle: string;
    tabLogin: string;
    tabSignUp: string;
    emailLabel: string;
    passwordLabel: string;
    submitLogin: string;
    submitSignUp: string;
    accountCreatedInfo: string;
    resendBtn: string;
    resendSent: string;
  };
}

export const TRANSLATIONS: Record<SupportedLang, UiDictionary> = {
  en: {
    header: {
      home: "Home",
      login: "Log in",
      signOut: "Sign Out",
      dashboard: "Dashboard",
      langMenuTitle: "Interface & Explanations (8)",
    },
    landing: {
      badge: "Official Exam Simulation • N5 through N1",
      heroTitle: "Practice the JLPT under real exam rules and sectional scoring.",
      heroDescBefore: "Timed Vocabulary, Grammar & Reading, and Listening sections with",
      heroDescAfter: "support, restricted listening playback, and detailed answer reviews in 8 languages.",
      ctaPrimaryGuest: "Take Free Mock Tests (1 & 2)",
      ctaPrimaryUser: "Open Exam Dashboard",
      ctaSignIn: "Sign In to Account",
      freeNote: "Free Tier includes Mock Tests 1–2 for every JLPT level (N5–N1).",
      f1Title: "Server-Synced Timers",
      f1Desc: "Authentic per-section countdowns backed by server timestamps and auto-submission.",
      f2Title: "Warm Porcelain & Sumi",
      f2Desc: "High-legibility Noto Sans JP typography with clean ruby furigana spacing.",
      f3Title: "Exam-Accurate Audio",
      f3Desc: "No scrubbing during live listening tests; full transcripts unlocked in review.",
      f4Title: "8-Language Reviews",
      f4Desc: "Explanations in English, Bangla, Hindi, Indonesian, Thai, Vietnamese, Chinese, and Korean.",
      gradingNote: "Official JLPT dual-condition grading: Total Score + Sectional Minimums.",
    },
    auth: {
      signInTitle: "Sign in to NihonSync",
      signUpTitle: "Create NihonSync Account",
      subtitle: "JLPT N5–N1 Mock Exam Simulator",
      tabLogin: "Log In",
      tabSignUp: "Sign Up",
      emailLabel: "Email Address",
      passwordLabel: "Password",
      submitLogin: "Sign In",
      submitSignUp: "Create Free Account",
      accountCreatedInfo: "Account created! Check your email (and spam folder) for the confirmation link, then sign in.",
      resendBtn: "Resend Confirmation Email",
      resendSent: "Confirmation email resent! Please check your inbox.",
    },
  },
  bn: {
    header: {
      home: "হোম",
      login: "লগ ইন",
      signOut: "সাইন আউট",
      dashboard: "ড্যাশবোর্ড",
      langMenuTitle: "ইন্টারফেস ও ব্যাখ্যার ভাষা (৮টি)",
    },
    landing: {
      badge: "অফিসিয়াল পরীক্ষার সিমুলেশন • N5 থেকে N1",
      heroTitle: "আসল পরীক্ষার নিয়ম ও সেকশনাল স্কোরিংয়ে JLPT অনুশীলন করুন।",
      heroDescBefore: "সময়-নির্ধারিত শব্দভাণ্ডার, ব্যাকরণ ও পঠন এবং শ্রবণ সেকশন সাথে",
      heroDescAfter: "সাপোর্ট, নিয়ন্ত্রিত অডিও প্লেব্যাক এবং ৮টি ভাষায় বিস্তারিত উত্তর পর্যালোচনা।",
      ctaPrimaryGuest: "ফ্রি মক টেস্ট দিন (১ ও ২)",
      ctaPrimaryUser: "পরীক্ষার ড্যাশবোর্ড খুলুন",
      ctaSignIn: "অ্যাকাউন্টে সাইন ইন করুন",
      freeNote: "ফ্রি প্ল্যানে প্রতিটি JLPT লেভেলের (N5–N1) মক টেস্ট ১–২ অন্তর্ভুক্ত রয়েছে।",
      f1Title: "সার্ভার-সিঙ্কড টাইমার",
      f1Desc: "সার্ভার টাইমস্ট্যাম্প এবং অটো-সাবমিশনসহ প্রতিটি সেকশনের নির্ভুল কাউন্টডাউন।",
      f2Title: "ওয়ার্ম পোরসেলিন ও সুমি",
      f2Desc: "স্পষ্ট রুবি ফুরিগানা স্পেসিংসহ উচ্চ-পঠনযোগ্য Noto Sans JP টাইপোগ্রাফি।",
      f3Title: "পরীক্ষা-সম্মত অডিও",
      f3Desc: "লাইভ লিসেনিং টেস্টে স্ক্রাবিং বন্ধ; রিভিউতে সম্পূর্ণ ট্রান্সক্রিপ্ট আনলক।",
      f4Title: "৮ ভাষায় উত্তর পর্যালোচনা",
      f4Desc: "ইংরেজি, বাংলা, হিন্দি, ইন্দোনেশিয়ান, থাই, ভিয়েতনামী, চীনা ও কোরীয় ভাষায় ব্যাখ্যা।",
      gradingNote: "অফিসিয়াল JLPT দ্বৈত-শর্ত গ্রেডিং: মোট স্কোর + সেকশনাল ন্যূনতম নম্বর।",
    },
    auth: {
      signInTitle: "NihonSync-এ সাইন ইন করুন",
      signUpTitle: "NihonSync অ্যাকাউন্ট তৈরি করুন",
      subtitle: "JLPT N5–N1 মক এক্সাম সিমুলেটর",
      tabLogin: "লগ ইন",
      tabSignUp: "সাইন আপ",
      emailLabel: "ইমেইল ঠিকানা",
      passwordLabel: "পাসওয়ার্ড",
      submitLogin: "সাইন ইন করুন",
      submitSignUp: "ফ্রি অ্যাকাউন্ট তৈরি করুন",
      accountCreatedInfo: "অ্যাকাউন্ট তৈরি হয়েছে! কনফার্মেশন লিংকের জন্য আপনার ইমেইল (এবং স্প্যাম ফোল্ডার) চেক করুন।",
      resendBtn: "কনফার্মেশন ইমেইল আবার পাঠান",
      resendSent: "কনফার্মেশন ইমেইল আবার পাঠানো হয়েছে! ইনবক্স চেক করুন।",
    },
  },
  hi: {
    header: {
      home: "होम",
      login: "लॉग इन",
      signOut: "साइन आउट",
      dashboard: "डैशबोर्ड",
      langMenuTitle: "इंटरफ़ेस और व्याख्या भाषा (8)",
    },
    landing: {
      badge: "आधिकारिक परीक्षा सिमुलेशन • N5 से N1 तक",
      heroTitle: "वास्तविक परीक्षा नियमों और सेक्शनल स्कोरिंग के साथ JLPT का अभ्यास करें।",
      heroDescBefore: "समयबद्ध शब्दावली, व्याकरण और पठन, तथा श्रवण अनुभाग",
      heroDescAfter: "सहायता, नियंत्रित ऑडियो प्लेबैक और 8 भाषाओं में विस्तृत उत्तर समीक्षा के साथ।",
      ctaPrimaryGuest: "निःशुल्क मॉक टेस्ट दें (1 और 2)",
      ctaPrimaryUser: "परीक्षा डैशबोर्ड खोलें",
      ctaSignIn: "खाते में साइन इन करें",
      freeNote: "निःशुल्क प्लान में प्रत्येक JLPT स्तर (N5–N1) के लिए मॉक टेस्ट 1–2 शामिल हैं।",
      f1Title: "सर्वर-सिंक टाइमर",
      f1Desc: "सर्वर टाइमस्टैम्प और ऑटो-सबमिशन द्वारा समर्थित सटीक अनुभाग काउंटडाउन।",
      f2Title: "वॉर्म पोर्सिलेन और सुमी",
      f2Desc: "स्पष्ट रूबी फुरिगाना स्पेसिंग के साथ उच्च-पठनीय Noto Sans JP टाइपोग्राफी।",
      f3Title: "परीक्षा-सटीक ऑडियो",
      f3Desc: "लाइव लिसनिंग टेस्ट के दौरान कोई स्क्रबिंग नहीं; समीक्षा में पूर्ण ट्रांसक्रिप्ट उपलब्ध।",
      f4Title: "8-भाषा समीक्षाएँ",
      f4Desc: "अंग्रेजी, बांग्ला, हिंदी, इंडोनेशियाई, थाई, वियतनामी, चीनी और कोरियाई में व्याख्या।",
      gradingNote: "आधिकारिक JLPT दोहरी-शर्त ग्रेडिंग: कुल स्कोर + अनुभागीय न्यूनतम अंक।",
    },
    auth: {
      signInTitle: "NihonSync में साइन इन करें",
      signUpTitle: "NihonSync खाता बनाएँ",
      subtitle: "JLPT N5–N1 मॉक परीक्षा सिमुलेटर",
      tabLogin: "लॉग इन",
      tabSignUp: "साइन अप",
      emailLabel: "ईमेल पता",
      passwordLabel: "पासवर्ड",
      submitLogin: "साइन इन करें",
      submitSignUp: "निःशुल्क खाता बनाएँ",
      accountCreatedInfo: "खाता बन गया! पुष्टिकरण लिंक के लिए अपना ईमेल (और स्पैम फ़ोल्डर) जाँचें, फिर साइन इन करें।",
      resendBtn: "पुष्टिकरण ईमेल पुनः भेजें",
      resendSent: "पुष्टिकरण ईमेल पुनः भेज दिया गया है! कृपया अपना इनबॉक्स जाँचें।",
    },
  },
  id: {
    header: {
      home: "Beranda",
      login: "Masuk",
      signOut: "Keluar",
      dashboard: "Dasbor",
      langMenuTitle: "Bahasa Antarmuka & Penjelasan (8)",
    },
    landing: {
      badge: "Simulasi Ujian Resmi • N5 hingga N1",
      heroTitle: "Latih JLPT dengan aturan ujian asli dan penilaian per bagian.",
      heroDescBefore: "Bagian Kosakata, Tata Bahasa & Membaca, serta Mendengarkan berbatas waktu dengan dukungan",
      heroDescAfter: ", pemutaran audio terbatas, dan pembahasan lengkap dalam 8 bahasa.",
      ctaPrimaryGuest: "Ikuti Tes Simulasi Gratis (1 & 2)",
      ctaPrimaryUser: "Buka Dasbor Ujian",
      ctaSignIn: "Masuk ke Akun",
      freeNote: "Paket Gratis mencakup Tes Simulasi 1–2 untuk setiap level JLPT (N5–N1).",
      f1Title: "Timer Tersinkron Server",
      f1Desc: "Hitung mundur per bagian yang akurat dengan stempel waktu server dan kirim otomatis.",
      f2Title: "Warm Porcelain & Sumi",
      f2Desc: "Tipografi Noto Sans JP yang jelas dengan jarak furigana ruby yang rapi.",
      f3Title: "Audio Akurat Ujian",
      f3Desc: "Tanpa menggeser durasi saat tes berlangsung; transkrip lengkap terbuka saat ulasan.",
      f4Title: "Pembahasan 8 Bahasa",
      f4Desc: "Penjelasan dalam bahasa Inggris, Bangla, Hindi, Indonesia, Thai, Vietnam, Mandarin, dan Korea.",
      gradingNote: "Penilaian resmi JLPT dua syarat: Skor Total + Nilai Minimum Per Bagian.",
    },
    auth: {
      signInTitle: "Masuk ke NihonSync",
      signUpTitle: "Buat Akun NihonSync",
      subtitle: "Simulator Ujian Simulasi JLPT N5–N1",
      tabLogin: "Masuk",
      tabSignUp: "Daftar",
      emailLabel: "Alamat Email",
      passwordLabel: "Kata Sandi",
      submitLogin: "Masuk",
      submitSignUp: "Buat Akun Gratis",
      accountCreatedInfo: "Akun dibuat! Periksa email (dan folder spam) untuk tautan konfirmasi, lalu masuk.",
      resendBtn: "Kirim Ulang Email Konfirmasi",
      resendSent: "Email konfirmasi telah dikirim ulang! Silakan periksa kotak masuk Anda.",
    },
  },
  th: {
    header: {
      home: "หน้าแรก",
      login: "เข้าสู่ระบบ",
      signOut: "ออกจากระบบ",
      dashboard: "แดชบอร์ด",
      langMenuTitle: "ภาษาของระบบและคำอธิบาย (8 ภาษา)",
    },
    landing: {
      badge: "จำลองการสอบจริง • ระดับ N5 ถึง N1",
      heroTitle: "ฝึกทำข้อสอบ JLPT ภายใต้กติกาจริงและการคิดคะแนนแยกพาร์ท",
      heroDescBefore: "จับเวลาจริงทั้งพาร์ทคำศัพท์ ไวยากรณ์และการอ่าน และการฟัง พร้อมระบบ",
      heroDescAfter: "การเล่นเสียงตามกติกาการสอบ และเฉลยละเอียด 8 ภาษา",
      ctaPrimaryGuest: "ทำข้อสอบจำลองฟรี (ชุดที่ 1 และ 2)",
      ctaPrimaryUser: "เปิดแดชบอร์ดการสอบ",
      ctaSignIn: "เข้าสู่ระบบบัญชี",
      freeNote: "แพ็กเกจฟรีรวมข้อสอบจำลองชุดที่ 1–2 สำหรับทุกระดับ JLPT (N5–N1)",
      f1Title: "ตัวจับเวลาซิงค์กับเซิร์ฟเวอร์",
      f1Desc: "นับถอยหลังแยกตามพาร์ทอย่างแม่นยำพร้อมระบบส่งคำตอบอัตโนมัติเมื่อหมดเวลา",
      f2Title: "ดีไซน์ Warm Porcelain & Sumi",
      f2Desc: "ฟอนต์ Noto Sans JP อ่านสบายตาพร้อมระยะห่างฟุริงานะที่ชัดเจน",
      f3Title: "ระบบเสียงเหมือนสนามสอบจริง",
      f3Desc: "ไม่สามารถกรอเสียงระหว่างสอบจริง และปลดล็อกสคริปต์เต็มในหน้าเฉลย",
      f4Title: "เฉลยละเอียด 8 ภาษา",
      f4Desc: "คำอธิบายภาษาอังกฤษ เบงกาลี ฮินดี อินโดนีเซีย ไทย เวียดนาม จีน และเกาหลี",
      gradingNote: "เกณฑ์ผ่าน JLPT อย่างเป็นทางการ: คะแนนรวม + คะแนนขั้นต่ำรายพาร์ท",
    },
    auth: {
      signInTitle: "เข้าสู่ระบบ NihonSync",
      signUpTitle: "สร้างบัญชี NihonSync",
      subtitle: "ระบบจำลองการสอบวัดระดับภาษาญี่ปุ่น JLPT N5–N1",
      tabLogin: "เข้าสู่ระบบ",
      tabSignUp: "สมัครสมาชิก",
      emailLabel: "อีเมล",
      passwordLabel: "รหัสผ่าน",
      submitLogin: "เข้าสู่ระบบ",
      submitSignUp: "สร้างบัญชีฟรี",
      accountCreatedInfo: "สร้างบัญชีสำเร็จ! กรุณาตรวจสอบอีเมล (และโฟลเดอร์สแปม) เพื่อกดลิงก์ยืนยันตัวตน",
      resendBtn: "ส่งอีเมลยืนยันอีกครั้ง",
      resendSent: "ส่งอีเมลยืนยันอีกครั้งแล้ว! กรุณาตรวจสอบกล่องจดหมายของคุณ",
    },
  },
  vi: {
    header: {
      home: "Trang chủ",
      login: "Đăng nhập",
      signOut: "Đăng xuất",
      dashboard: "Bảng điều khiển",
      langMenuTitle: "Ngôn ngữ giao diện & giải thích (8)",
    },
    landing: {
      badge: "Mô phỏng kỳ thi chính thức • N5 đến N1",
      heroTitle: "Luyện thi JLPT theo đúng quy chế thi thật và cách tính điểm từng phần.",
      heroDescBefore: "Các phần thi Từ vựng, Ngữ pháp & Đọc hiểu và Nghe hiểu tính giờ chuẩn với hỗ trợ",
      heroDescAfter: ", phát âm thanh giới hạn lượt nghe và giải thích chi tiết bằng 8 ngôn ngữ.",
      ctaPrimaryGuest: "Làm đề thi thử miễn phí (Đề 1 & 2)",
      ctaPrimaryUser: "Mở bảng điều khiển thi",
      ctaSignIn: "Đăng nhập tài khoản",
      freeNote: "Gói miễn phí bao gồm Đề thi thử 1–2 cho mọi cấp độ JLPT (N5–N1).",
      f1Title: "Đồng hồ đồng bộ máy chủ",
      f1Desc: "Đếm ngược từng phần thi chính xác theo thời gian máy chủ và tự động nộp bài.",
      f2Title: "Giao diện Warm Porcelain & Sumi",
      f2Desc: "Phông chữ Noto Sans JP sắc nét với khoảng cách dòng furigana thoáng đãng.",
      f3Title: "Âm thanh chuẩn phòng thi",
      f3Desc: "Không tua lại khi đang thi nghe; mở khóa toàn bộ lời thoại khi xem đáp án.",
      f4Title: "Giải thích 8 ngôn ngữ",
      f4Desc: "Giải thích bằng tiếng Anh, Bengal, Hindi, Indonesia, Thái, Việt, Trung và Hàn.",
      gradingNote: "Chấm điểm JLPT hai điều kiện: Tổng điểm + Điểm liệt từng phần.",
    },
    auth: {
      signInTitle: "Đăng nhập NihonSync",
      signUpTitle: "Tạo tài khoản NihonSync",
      subtitle: "Hệ thống thi thử JLPT N5–N1",
      tabLogin: "Đăng nhập",
      tabSignUp: "Đăng ký",
      emailLabel: "Địa chỉ Email",
      passwordLabel: "Mật khẩu",
      submitLogin: "Đăng nhập",
      submitSignUp: "Tạo tài khoản miễn phí",
      accountCreatedInfo: "Đã tạo tài khoản! Vui lòng kiểm tra email (và thư mục spam) để xác nhận trước khi đăng nhập.",
      resendBtn: "Gửi lại email xác nhận",
      resendSent: "Đã gửi lại email xác nhận! Vui lòng kiểm tra hộp thư.",
    },
  },
  zh: {
    header: {
      home: "首页",
      login: "登录",
      signOut: "退出登录",
      dashboard: "控制面板",
      langMenuTitle: "界面与解析语言 (8种)",
    },
    landing: {
      badge: "官方全真模拟考试 • N5 至 N1",
      heroTitle: "按照真实考场规则与单项计分标准备考 JLPT。",
      heroDescBefore: "限时词汇、语法与阅读、听力三大科目，支持",
      heroDescAfter: "显示、考场级受限听力播放以及 8 国语言详细答案解析。",
      ctaPrimaryGuest: "免费参加模拟考试（第 1 & 2 套）",
      ctaPrimaryUser: "进入考试控制面板",
      ctaSignIn: "登录账号",
      freeNote: "免费版包含每个 JLPT 级别（N5–N1）的第 1–2 套完整模拟试卷。",
      f1Title: "服务器同步计时器",
      f1Desc: "基于服务器时间戳的精准分科倒计时与到时自动交卷。",
      f2Title: "温润和纸与墨色排版",
      f2Desc: "高清晰 Noto Sans JP 字体与舒适的振假名行距设计。",
      f3Title: "考场级听力还原",
      f3Desc: "正式答题时禁止拖动进度条；交卷后解锁完整听力原文。",
      f4Title: "8 国语言详细解析",
      f4Desc: "提供英语、孟加拉语、印地语、印尼语、泰语、越南语、中文及韩语解析。",
      gradingNote: "JLPT 官方双重合格判定：总分达标 + 各单项最低分达标。",
    },
    auth: {
      signInTitle: "登录 NihonSync",
      signUpTitle: "创建 NihonSync 账号",
      subtitle: "JLPT N5–N1 全真模拟考试平台",
      tabLogin: "登录",
      tabSignUp: "注册",
      emailLabel: "电子邮箱",
      passwordLabel: "密码",
      submitLogin: "登录",
      submitSignUp: "创建免费账号",
      accountCreatedInfo: "账号已创建！请查收邮箱（包括垃圾邮件箱）中的验证链接，然后再登录。",
      resendBtn: "重新发送验证邮件",
      resendSent: "验证邮件已重新发送！请查收您的收件箱。",
    },
  },
  ko: {
    header: {
      home: "홈",
      login: "로그인",
      signOut: "로그아웃",
      dashboard: "대시보드",
      langMenuTitle: "인터페이스 및 해설 언어 (8개국어)",
    },
    landing: {
      badge: "공식 실전 모의고사 시뮬레이션 • N5 ~ N1",
      heroTitle: "실제 시험 규정과 영역별 과락 기준으로 JLPT를 연습하세요.",
      heroDescBefore: "실전 시간제한 어휘, 문법·독해, 청해 영역과",
      heroDescAfter: "지원, 제한된 청해 오디오 재생 및 8개 언어 상세 해설을 제공합니다.",
      ctaPrimaryGuest: "무료 모의고사 응시 (1회 & 2회)",
      ctaPrimaryUser: "시험 대시보드 열기",
      ctaSignIn: "계정 로그인",
      freeNote: "무료 플랜에는 모든 JLPT 레벨(N5–N1)의 모의고사 1–2회가 포함됩니다.",
      f1Title: "서버 동기화 타이머",
      f1Desc: "서버 타임스탬프 기반의 정확한 영역별 카운트다운 및 자동 제출.",
      f2Title: "웜 포슬린 & 수미 디자인",
      f2Desc: "깔끔한 후리가나 줄 간격을 갖춘 고가독성 Noto Sans JP 타이포그래피.",
      f3Title: "실전과 동일한 청해 오디오",
      f3Desc: "시험 중 탐색(되감기) 제한, 결과 리뷰에서 전체 스크립트 잠금 해제.",
      f4Title: "8개 언어 상세 해설",
      f4Desc: "영어, 벵골어, 힌디어, 인도네시아어, 태국어, 베트남어, 중국어, 한국어 해설 지원.",
      gradingNote: "공식 JLPT 이중 합격 판정: 총점 기준 + 영역별 최저 점수(과락) 충족.",
    },
    auth: {
      signInTitle: "NihonSync 로그인",
      signUpTitle: "NihonSync 계정 만들기",
      subtitle: "JLPT N5–N1 실전 모의고사 시뮬레이터",
      tabLogin: "로그인",
      tabSignUp: "회원가입",
      emailLabel: "이메일 주소",
      passwordLabel: "비밀번호",
      submitLogin: "로그인",
      submitSignUp: "무료 계정 만들기",
      accountCreatedInfo: "계정이 생성되었습니다! 이메일(스팸함 포함)에서 인증 링크를 확인한 후 로그인하세요.",
      resendBtn: "인증 이메일 다시 보내기",
      resendSent: "인증 이메일을 다시 보냈습니다! 받은편지함을 확인해 주세요.",
    },
  },
};
