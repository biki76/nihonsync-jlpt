const exp = (en, bn, hi, id, th, vi, zh, ko) => ({
  en, bn, hi, id, th, vi, zh, ko,
});

export const N3_BANK = {
  kanji_reading: [
    {
      stem: "この　<ruby>地域<rt>ちいき</rt></ruby>の　<u>環境</u>を　<ruby>守<rt>まも</rt></ruby>る　<ruby>活動<rt>かつどう</rt></ruby>に　<ruby>参加<rt>さんか</rt></ruby>した。",
      options: ["かんきょう", "かんぎょう", "けんきょう", "かんけい"],
      ans: 1,
      explanation: exp("環境 is read かんきょう (environment).", "環境-এর সঠিক উচ্চারণ かんきょう (পরিবেশ)।", "環境 को かんきょう (पर्यावरण) पढ़ा जाता है।", "環境 dibaca かんきょう (lingkungan).", "環境 อ่านว่า かんきょう (สิ่งแวดล้อม)", "環境 đọc là かんきょう (môi trường).", "環境读作 かんきょう（环境）。", "環境은 かんきょう(환경)이라고 읽습니다."),
    },
    {
      stem: "<u>複雑</u>な　<ruby>問題<rt>もんだい</rt></ruby>を　わかりやすく　<ruby>説明<rt>せつめい</rt></ruby>する。",
      options: ["ふくざつ", "ふくさつ", "ぶくざつ", "ふくぞう"],
      ans: 1,
      explanation: exp("複雑 is read ふくざつ (complicated/complex).", "複雑 অর্থ জটিল (ふくざつ)।", "複雑 का अर्थ जटिल (ふくざつ) है।", "複雑 dibaca ふくざつ (rumit).", "複雑 อ่านว่า ふくざつ (ซับซ้อน)", "複雑 đọc là ふくざつ (phức tạp).", "複雑读作 ふくざつ（复杂）。", "複雑는 ふくざつ(복잡)이라고 읽습니다."),
    },
    {
      stem: "<u>予算</u>が　<ruby>足<rt>た</rt></ruby>りなくて、<ruby>計画<rt>けいかく</rt></ruby>を　<ruby>変更<rt>へんこう</rt></ruby>した。",
      options: ["よさん", "よざん", "よそう", "よそん"],
      ans: 1,
      explanation: exp("予算 is read よさん (budget).", "予算 অর্থ বাজেট (よさん)।", "予算 का अर्थ बजट (よさん) है।", "予算 dibaca よさん (anggaran).", "予算 อ่านว่า よさん (งบประมาณ)", "予算 đọc là よさん (ngân sách).", "予算读作 よさん（预算）。", "予算은 よさん(예산)이라고 읽습니다."),
    },
    {
      stem: "<ruby>事故<rt>じこ</rt></ruby>の　<u>原因</u>を　くわしく　<ruby>調<rt>しら</rt></ruby>べている。",
      options: ["げんいん", "げんい", "けんいん", "げいいん"],
      ans: 1,
      explanation: exp("原因 is read げんいん (cause/origin).", "原因 অর্থ কারণ (げんいん)।", "原因 का अर्थ कारण (げんいん) है।", "原因 dibaca げんいん (penyebab).", "原因 อ่านว่า げんいん (สาเหตุ)", "原因 đọc là げんいん (nguyên nhân).", "原因读作 げんいん（原因）。", "原因은 げんいん(원인)이라고 읽습니다."),
    },
  ],
  orthography: [
    {
      stem: "<ruby>面接<rt>めんせつ</rt></ruby>では　<ruby>自分<rt>じぶん</rt></ruby>の　<u>ちょうしょ</u>を　アピールした。",
      options: ["長所", "張所", "場処", "長処"],
      ans: 1,
      explanation: exp("ちょうしょ (strong point/merit) is written 長所.", "ちょうしょ (গুণ/শক্তিশালী দিক) কাঞ্জিতে 長所 লেখা হয়।", "ちょうしょ (खूबी) को 長所 लिखा जाता है।", "ちょうしょ (kelebihan) ditulis 長所.", "ちょうしょ (ข้อดี) เขียนว่า 長所", "ちょうしょ (điểm mạnh) viết là 長所.", "ちょうしょ（优点/长处）写作 長所。", "ちょうしょ(장점)는 長所라고 씁니다."),
    },
    {
      stem: "<ruby>健康<rt>けんこう</rt></ruby>の　ために　<ruby>毎日<rt>まいにち</rt></ruby>　<u>うんどう</u>を　つづけている。",
      options: ["運動", "運働", "遠動", "転動"],
      ans: 1,
      explanation: exp("うんどう (exercise/movement) is written 運動.", "うんどう (ব্যায়াম) কাঞ্জিতে 運動 লেখা হয়।", "うんどう (व्यायाम) को 運動 लिखा जाता है।", "うんどう (olahraga) ditulis 運動.", "うんどう (ออกกำลังกาย) เขียนว่า 運動", "うんどう (vận động) viết là 運動.", "うんどう（运动）写作 運動。", "うんどう(운동)은 運動이라고 씁니다."),
    },
  ],
  contextually_defined_expressions: [
    {
      stem: "この　<ruby>薬<rt>くすり</rt></ruby>は　<ruby>食後<rt>しょくご</rt></ruby>に　（　　　）　のんで　ください。",
      options: ["かならず", "けっして", "まったく", "めったに"],
      ans: 1,
      explanation: exp("かならず ('without fail / certainly') is used in affirmative instructions; けっして and めったに require negatives.", "হ্যাঁ-বোধক নির্দেশে 'অবশ্যই' বোঝাতে かならず বসে।", "सकारात्मक निर्देश में 'अवश्य' के लिए かならず सही है।", "かならず ('pastikan/selalu') digunakan dalam kalimat positif.", "かならず ('อย่างแน่นอน') ใช้ในประโยคบอกเล่า", "かならず ('nhất định') dùng trong câu khẳng định.", "かならず（务必）用于肯定祈使句。", "かならず(반드시)는 긍정 명령문에 씁니다."),
    },
    {
      stem: "<ruby>努力<rt>どりょく</rt></ruby>の　（　　　）、<ruby>希望<rt>きぼう</rt></ruby>の　<ruby>大学<rt>だいがく</rt></ruby>に　<ruby>合格<rt>ごうかく</rt></ruby>できた。",
      options: ["おかげで", "せいで", "くせに", "わりに"],
      ans: 1,
      explanation: exp("〜おかげで expresses gratitude for a positive outcome ('thanks to effort'), whereas 〜せいで is for negative outcomes.", "ইতিবাচক ফলাফলের কারণ বোঝাতে 〜おかげで বসে।", "सकारात्मक परिणाम का श्रेय देने के लिए 〜おかげで सही है।", "〜おかげで digunakan untuk hasil positif ('berkat usaha').", "〜おかげで ใช้กับผลลัพธ์ด้านบวก ('เพราะความพยายาม')", "〜おかげで dùng cho kết quả tích cực ('nhờ có nỗ lực').", "「〜おかげで」用于积极的结果（多亏了努力）。", "긍정적인 결과의 원인을 나타낼 때 〜おかげで를 씁니다."),
    },
  ],
  paraphrases: [
    {
      stem: "<ruby>電車<rt>でんしゃ</rt></ruby>が　<u>まもなく</u>　<ruby>到着<rt>とうちゃく</rt></ruby>します。",
      options: ["もうすぐ", "さっき", "ずっと", "ようやく"],
      ans: 1,
      explanation: exp("まもなく (shortly/soon) is synonymous with もうすぐ.", "まもなく এবং もうすぐ উভয়ের অর্থ 'শীঘ্রই'।", "まもなく और もうすぐ दोनों का अर्थ 'शीघ्र ही' है।", "まもなく (sebentar lagi) bersinonim dengan もうすぐ.", "まもなく และ もうすぐ แปลว่า 'อีกสักครู่'", "まもなく đồng nghĩa với もうすぐ (sắp sửa).", "まもなく 与 もうすぐ 同义，表示“即将”。", "まもなく와 もうすぐ는 모두 '곧'이라는 뜻입니다."),
    },
  ],
  usage: [
    {
      stem: "つぎの　ことばの　つかいかたで　いちばん　いい　ものを　えらんで　ください：　<b><u>せっかく</u></b>",
      options: [
        "せっかく　<ruby>日本<rt>にほん</rt></ruby>に　来たのだから、<ruby>富士山<rt>ふじさん</rt></ruby>に　のぼりたい。",
        "きのうは　せっかく　雨が　ふって　こまった。",
        "まいにち　せっかく　ごはんを　食べます。",
        "この　ペンは　せっかく　書きやすい。",
      ],
      ans: 1,
      explanation: exp("せっかく highlights a rare/valuable opportunity ('since I went to the trouble of coming to Japan...').", "বিরল বা কষ্টার্জিত সুযোগ বোঝাতে せっかく ব্যবহৃত হয়।", "दुर्लभ या विशेष अवसर व्यक्त करने के लिए せっかく सही है।", "せっかく menekankan kesempatan berharga yang sayang dilewatkan.", "せっかく ใช้เน้นโอกาสพิเศษที่อุตส่าห์ได้มา", "せっかく nhấn mạnh cơ hội quý giá/cất công.", "せっかく 表示难得的机会（好不容易来到日本……）。", "せっかく는 모처럼 얻은 소중한 기회를 강조합니다."),
    },
  ],
  sentence_grammar_1: [
    {
      stem: "<ruby>日本<rt>にほん</rt></ruby>に　<ruby>住<rt>す</rt></ruby>み<ruby>始<rt>はじ</rt></ruby>めた　（　　　）の　ころは、<ruby>言葉<rt>ことば</rt></ruby>が　わからなくて　<ruby>困<rt>こま</rt></ruby>った。",
      options: ["ばかり", "ところ", "まま", "はず"],
      ans: 1,
      explanation: exp("〜たばかり ('just did ~') modifies ころ to mean 'around the time I had just started living in Japan'.", "সবেমাত্র শুরু করার সময় বোঝাতে たばかりのころ বসে।", "अभी-अभी शुरू करने के समय के लिए たばかりのころ सही है।", "〜たばかりのころ berarti 'saat baru saja mulai tinggal'.", "たばかりのころ แปลว่า ช่วงที่เพิ่งเริ่มอาศัยอยู่", "たばかりのころ có nghĩa là 'khoảng thời gian vừa mới bắt đầu sống'.", "「〜たばかりのころ」表示“刚……的时候”。", "たばかりのころ는 '막 ~하기 시작했을 무렵'이라는 뜻입니다."),
    },
    {
      stem: "<ruby>彼<rt>かれ</rt></ruby>は　<ruby>忙しい<rt>いそがしい</rt></ruby>（　　　）、いつも　<ruby>笑顔<rt>えがお</rt></ruby>で　<ruby>対応<rt>たいおう</rt></ruby>して　くれる。",
      options: ["にもかかわらず", "おかげで", "にしたがって", "にたいして"],
      ans: 1,
      explanation: exp("〜にもかかわらず means 'despite / in spite of being busy'.", "ব্যস্ত থাকা সত্ত্বেও বোঝাতে 〜にもかかわらず বসে।", "व्यस्त होने के बावजूद के अर्थ में 〜にもかかわらず सही है।", "〜にもかかわらず berarti 'meskipun sibuk'.", "〜にもかかわらず แปลว่า 'ทั้งๆ ที่ยุ่ง'", "〜にもかかわらず có nghĩa là 'mặc dù bận rộn'.", "「〜にもかかわらず」表示“尽管……却……”。", "〜にもかかわらず는 '~임에도 불구하고'라는 뜻입니다."),
    },
  ],
  star_questions: [
    {
      stem: "この　<ruby>小説<rt>しょうせつ</rt></ruby>は　＿＿＿　＿＿＿　<u>　★　</u>　＿＿＿　<ruby>人気<rt>にんき</rt></ruby>が　ある。",
      options: ["だけでなく", "おとな", "子ども", "にも"],
      seq: [3, 1, 2, 4],
      ans: 2,
      explanation: exp("Order: 子ども(3) だけでなく(1) おとな(2) にも(4) 人気がある. ★ is 2 (おとな).", "সঠিক ক্রম: 子ども(3) だけでなく(1) おとな(2) にも(4)। ★ স্থানে 2 (おとな) বসবে।", "सही क्रम: 子ども(3) だけでなく(1) おとな(2) にも(4)। ★ पर 2 (おとな) आएगा।", "Urutan: 子ども(3) だけでなく(1) おとな(2) にも(4). ★ adalah 2 (おとな).", "ลำดับ: 子ども(3) だけでなく(1) おとな(2) にも(4) ★ คือ 2 (おとな)", "Thứ tự: 子ども(3) だけでなく(1) おとな(2) にも(4). ★ là 2 (おとな).", "顺序：子ども(3) だけでなく(1) おとな(2) にも(4)。★为 2（おとな）。", "순서: 子ども(3) だけでなく(1) おとな(2) にも(4). ★는 2(おとな)입니다."),
    },
  ],
  text_grammar: [
    {
      passage:
        "<p><ruby>最近<rt>さいきん</rt></ruby>は　リモートワークが　（ 36 ）、<ruby>通勤<rt>つうきん</rt></ruby>の　<ruby>時間<rt>じかん</rt></ruby>が　へった　人が　多い。<ruby>一方<rt>いっぽう</rt></ruby>で、<ruby>運動不足<rt>うんどうぶそく</rt></ruby>に　なる　ケースも　（ 37 ）。そのため、いえで　できる　ストレッチを　はじめる　人が　（ 38 ）。</p>",
      questions: [
        {
          stem: "（ 36 ）に　なにを　いれますか。",
          options: ["ふえたことで", "ふえるのに", "ふえたせいで", "ふえながら"],
          ans: 1,
          explanation: exp("〜たことで ('as a result of increasing') neutrally explains the cause of reduced commute times.", "বৃদ্ধি পাওয়ার ফলে বোঝাতে ふえたことで বসে।", "बढ़ने के कारण के अर्थ में ふえたことで सही है।", "ふえたことで menjelaskan sebab berkurangnya waktu komuter.", "ふえたことで แสดงสาเหตุที่เวลาเดินทางลดลง", "ふえたことで nêu nguyên nhân khách quan.", "ふえたことで 表示由于远程办公增多。", "ふえたことで는 늘어남으로써라는 객관적 원인을 나타냅니다."),
        },
        {
          stem: "（ 37 ）に　なにを　いれますか。",
          options: ["すくなくない", "ありえない", "かぎらない", "ちがいない"],
          ans: 1,
          explanation: exp("すくなくない ('not a few / quite common') matches 'on the other hand, cases of lack of exercise are also not uncommon'.", "কম নয় (অর্থাৎ অনেক দেখা যায়) বোঝাতে すくなくない বসে।", "कम नहीं हैं (काफी आम हैं) के लिए すくなくない सही है।", "すくなくない berarti 'tidak sedikit'.", "すくなくない แปลว่า 'ไม่น้อย'", "すくなくない có nghĩa là 'không ít'.", "すくなくない 表示“并不少见”。", "すくなくない는 '적지 않다'는 뜻입니다."),
        },
        {
          stem: "（ 38 ）に　なにを　いれますか。",
          options: ["ふえているようだ", "ふえるはずがない", "ふえたばかりだ", "ふえそうもない"],
          ans: 1,
          explanation: exp("〜ているようだ ('it seems that people are increasingly starting...') states an observed trend.", "প্রবণতা পর্যবেক্ষণ বোঝাতে ふえているようだ বসে।", "बढ़ती प्रवृत्ति दर्शाने के लिए ふえているようだ सही है।", "ふえているようだ menyatakan tren yang tampak meningkat.", "ふえているようだ แสดงแนวโน้มที่ดูเหมือนจะเพิ่มขึ้น", "ふえているようだ diễn tả xu hướng đang gia tăng.", "ふえているようだ 表示观察到的趋势。", "ふえているようだ는 늘어나고 있는 듯하다는 추세를 나타냅니다."),
        },
      ],
    },
  ],
  reading_short: [
    {
      passage:
        "<p><ruby>仕事<rt>しごと</rt></ruby>の　<ruby>効率<rt>こうりつ</rt></ruby>を　<ruby>上<rt>あ</rt></ruby>げるには、すべての　タスクを　<ruby>同時<rt>どうじ</rt></ruby>に　すすめるのではなく、<ruby>優先順位<rt>ゆうせんじゅんい</rt></ruby>を　きめて　一つずつ　かたづける　ことが　<ruby>大切<rt>たいせつ</rt></ruby>だ。</p>",
      stem: "<ruby>筆者<rt>ひっしゃ</rt></ruby>に　よると、<ruby>効率<rt>こうりつ</rt></ruby>を　<ruby>上<rt>あ</rt></ruby>げるには　どうすれば　いいか。",
      options: [
        "優先順位を　きめて　一つずつ　すすめる。",
        "すべての　タスクを　同時に　すすめる。",
        "かんたんな　仕事だけを　えらぶ。",
        "ほかの　人に　すべて　まかせる。",
      ],
      ans: 1,
      explanation: exp("優先順位をきめて一つずつかたづけることが大切だ (decide priority order and finish one by one).", "অগ্রাধিকার ঠিক করে একে একে শেষ করাই গুরুত্বপূর্ণ।", "प्राथमिकता तय करके एक-एक करके पूरा करना महत्वपूर्ण है।", "Menentukan skala prioritas lalu menyelesaikan satu per satu.", "จัดลำดับความสำคัญแล้วทำทีละอย่าง", "Xác định thứ tự ưu tiên rồi giải quyết từng việc một.", "确定优先顺序并逐一完成。", "우선순위를 정해 하나씩 처리하는 것이 중요합니다."),
    },
  ],
  reading_mid: [
    {
      passage:
        "<p><ruby>読書<rt>どくしょ</rt></ruby>の　<ruby>習慣<rt>しゅうかん</rt></ruby>を　身につけたいと　思いながら、<ruby>忙<rt>いそが</rt></ruby>しくて　読めない　人が　多い。しかし、1日に　1時間　読もうと　するから　つづかないのだ。まずは　寝るまえに　5分だけ　ページを　ひらく　ことから　はじめれば、しぜんに　習慣に　なる。</p>",
      questions: [
        {
          stem: "なぜ　<ruby>読書<rt>どくしょ</rt></ruby>が　つづかないと　<ruby>筆者<rt>ひっしゃ</rt></ruby>は　言っているか。",
          options: [
            "最初から　1時間　読もうと　するから",
            "おもしろい　本が　すくないから",
            "本の　ねだんが　たかいから",
            "夜　ねむく　なるから",
          ],
          ans: 1,
          explanation: exp("1日に1時間読もうとするからつづかないのだ (trying to read 1 hour a day causes people to quit).", "শুরুতেই প্রতিদিন ১ ঘণ্টা পড়ার লক্ষ্য নেওয়ার কারণে ধারাবাহিকতা থাকে না।", "प्रतिदिन 1 घंटा पढ़ने का लक्ष्य रखने के कारण यह जारी नहीं रह पाता।", "Karena mencoba langsung membaca 1 jam per hari.", "เพราะพยายามอ่านวันละ 1 ชั่วโมงตั้งแต่แรก", "Vì cố đọc 1 tiếng mỗi ngày ngay từ đầu.", "因为一开始就试图每天读1小时才难以坚持。", "하루에 1시간씩 읽으려고 하기 때문에 계속되지 못합니다."),
        },
        {
          stem: "<ruby>習慣<rt>しゅうかん</rt></ruby>に　するために　なにを　すすめているか。",
          options: [
            "寝るまえに　5分だけ　本を　ひらくこと",
            "週末に　まとめて　5時間　読むこと",
            "むずかしい　本を　えらぶこと",
            "テレビを　ぜんぶ　けすこと",
          ],
          ans: 1,
          explanation: exp("寝るまえに5分だけページをひらくことからはじめれば (start by opening a book for just 5 minutes before bed).", "ঘুমানোর আগে মাত্র ৫ মিনিট বই খোলার পরামর্শ দেওয়া হয়েছে।", "सोने से पहले केवल 5 मिनट किताब खोलने की सलाह दी गई है।", "Mulai dengan membuka buku 5 menit sebelum tidur.", "เริ่มจากเปิดหนังสืออ่านแค่ 5 นาทีก่อนนอน", "Bắt đầu bằng việc mở sách đọc 5 phút trước khi ngủ.", "从睡前只翻开书读5分钟开始。", "자기 전에 5분만 책장을 펼치는 것부터 시작하라고 권합니다."),
        },
      ],
    },
  ],
  reading_info: [
    {
      passage:
        "<div class='border p-3 rounded'><p><b><ruby>図書館<rt>としょかん</rt></ruby>　システム<ruby>点検<rt>てんけん</rt></ruby>の　お<ruby>知<rt>し</rt></ruby>らせ</b></p><p>11月20日（金）22:00〜翌7:00の間、ホームページからの<ruby>予約<rt>よやく</rt></ruby>・<ruby>延長<rt>えんちょう</rt></ruby>ができません。<ruby>返却<rt>へんきゃく</rt></ruby>ポストは24時間利用できます。</p></div>",
      questions: [
        {
          stem: "11月20日の　23時に　できる　ことは　どれか。",
          options: [
            "返却ポストに　本を　かえすこと",
            "ホームページで　本を　予約すること",
            "ホームページで　貸出期間を　延長すること",
            "カウンターで　カードを　つくること",
          ],
          ans: 1,
          explanation: exp("返却ポストは24時間利用できます (the book return drop-box is available 24 hours).", "রিটার্ন বক্স ২৪ ঘণ্টা খোলা থাকে।", "रिटर्न बॉक्स 24 घंटे उपलब्ध है।", "Kotak pengembalian buku tersedia 24 jam.", "ตู้คืนหนังสือใช้งานได้ตลอด 24 ชั่วโมง", "Hòm trả sách hoạt động 24/24.", "还书箱24小时均可使用。", "반납함은 24시간 이용 가능합니다."),
        },
        {
          stem: "点検の　あいだ　使えない　サービスは　どれか。",
          options: [
            "ホームページからの　予約と　延長",
            "返却ポストの　利用",
            "館内の　トイレ",
            "駐車場の　利用",
          ],
          ans: 1,
          explanation: exp("ホームページからの予約・延長ができません (online reservation and renewal are unavailable).", "ওয়েবসাইট থেকে রিজার্ভেশন ও মেয়াদ বাড়ানো বন্ধ থাকবে।", "वेबसाइट से आरक्षण और नवीनीकरण बंद रहेगा।", "Reservasi dan perpanjangan online tidak tersedia.", "ไม่สามารถจองและต่ออายุผ่านเว็บไซต์ได้", "Không thể đặt trước và gia hạn qua trang web.", "无法通过主页进行预约和续借。", "홈페이지 예약 및 연장이 불가능합니다."),
        },
      ],
    },
  ],
  listening: [
    {
      stem: "<ruby>音声<rt>おんせい</rt></ruby>を　<ruby>聞<rt>き</rt></ruby>いて　<ruby>答<rt>こた</rt></ruby>えて　ください。",
      transcript:
        "女：すみません、明日の打ち合わせ、10時からでしたが、11時に変更してもいいでしょうか。\n男：11時ですね。午後は予定が入っていますが、11時なら大丈夫ですよ。",
      options: [
        "明日の　11時",
        "明日の　10時",
        "明日の　午後1時",
        "あさっての　11時",
      ],
      ans: 1,
      explanation: exp("They agreed to move the meeting to 11:00 tomorrow (11時なら大丈夫ですよ).", "আগামীকাল ১১টায় মিটিং নির্ধারিত হয়েছে।", "कल 11 बजे की बैठक तय हुई है।", "Rapat dipindah ke pukul 11.00 besok.", "ตกลงเลื่อนประชุมเป็นพรุ่งนี้ 11 โมง", "Cuộc họp được dời sang 11 giờ sáng mai.", "商定将明天的会议改到11点。", "내일 11시로 회의를 변경하기로 했습니다."),
    },
  ],
};
