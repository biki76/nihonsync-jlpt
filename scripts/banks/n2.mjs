const exp = (en, bn, hi, id, th, vi, zh, ko) => ({
  en, bn, hi, id, th, vi, zh, ko,
});

export const N2_BANK = {
  kanji_reading: [
    {
      stem: "<ruby>新製品<rt>しんせいひん</rt></ruby>の　<u>普及</u>に　むけて　<ruby>宣伝<rt>せんでん</rt></ruby>を　<ruby>強化<rt>きょうか</rt></ruby>する。",
      options: ["ふきゅう", "ふうきゅう", "ぶきゅう", "ふぎゅう"],
      ans: 1,
      explanation: exp("普及 is read ふきゅう (diffusion/spread/popularization).", "普及-এর সঠিক উচ্চারণ ふきゅう (প্রসার)।", "普及 को ふきゅう (प्रसार) पढ़ा जाता है।", "普及 dibaca ふきゅう (penyebaran/populer).", "普及 อ่านว่า ふきゅう (การแพร่หลาย)", "普及 đọc là ふきゅう (phổ cập).", "普及读作 ふきゅう（普及）。", "普及은 ふきゅう(보급)라고 읽습니다."),
    },
    {
      stem: "<ruby>契約<rt>けいやく</rt></ruby>の　<u>詳細</u>に　ついては　<ruby>担当者<rt>たんとうしゃ</rt></ruby>に　ご<ruby>確認<rt>かくにん</rt></ruby>ください。",
      options: ["しょうさい", "じょうさい", "ようさい", "しょうせい"],
      ans: 1,
      explanation: exp("詳細 is read しょうさい (details).", "詳細 অর্থ বিস্তারিত বিবরণ (しょうさい)।", "詳細 का अर्थ विवरण (しょうさい) है।", "詳細 dibaca しょうさい (rincian).", "詳細 อ่านว่า しょうさい (รายละเอียด)", "詳細 đọc là しょうさい (chi tiết).", "詳細读作 しょうさい（详细）。", "詳細는 しょうさい(상세)라고 읽습니다."),
    },
  ],
  orthography: [
    {
      stem: "<ruby>相手<rt>あいて</rt></ruby>の　<ruby>立場<rt>たちば</rt></ruby>を　<u>そんちょう</u>する　<ruby>姿勢<rt>しせい</rt></ruby>が　<ruby>重要<rt>じゅうよう</rt></ruby>だ。",
      options: ["尊重", "尊長", "存重", "尊丁"],
      ans: 1,
      explanation: exp("そんちょう (respect/esteem) is written 尊重.", "そんちょう (সম্মান) কাঞ্জিতে 尊重 লেখা হয়।", "そんちょう (सम्मान) को 尊重 लिखा जाता है।", "そんちょう (menghormati) ditulis 尊重.", "そんちょう (เคารพ) เขียนว่า 尊重", "そんちょう (tôn trọng) viết là 尊重.", "そんちょう（尊重）写作 尊重。", "そんちょう(존중)은 尊重이라고 씁니다."),
    },
  ],
  contextually_defined_expressions: [
    {
      stem: "<ruby>予算<rt>よさん</rt></ruby>の　（　　　）で、イベントの　<ruby>規模<rt>きぼ</rt></ruby>を　<ruby>縮小<rt>しゅくしょう</rt></ruby>せざるをえない。",
      options: ["都合", "機嫌", "様子", "調子"],
      ans: 1,
      explanation: exp("予算の都合で ('due to budget circumstances') is a standard N2 collocation.", "বাজেট সংক্রান্ত কারণে বোঝাতে 予算の都合で বসে।", "बजट की परिस्थितियों के कारण (予算の都合で) सही है।", "予算の都合で berarti 'karena pertimbangan anggaran'.", "予算の都合で แปลว่า 'เนื่องจากเหตุผลด้านงบประมาณ'", "予算の都合で có nghĩa là 'do điều kiện ngân sách'.", "「予算の都合で」意为“由于预算方面的原因”。", "予算の都合で는 '예산 사정으로'라는 관용 표현입니다."),
    },
  ],
  paraphrases: [
    {
      stem: "この　<ruby>計画<rt>けいかく</rt></ruby>は　<u>ただちに</u>　<ruby>実行<rt>じっこう</rt></ruby>すべきだ。",
      options: ["すぐに", "しだいに", "いずれ", "あらかじめ"],
      ans: 1,
      explanation: exp("ただちに (immediately/at once) is synonymous with すぐに.", "ただちに অর্থ অবিলম্বে (すぐに)।", "ただちに का अर्थ तुरंत (すぐに) है।", "ただちに berarti segera (すぐに).", "ただちに แปลว่า ทันที (すぐに)", "ただちに đồng nghĩa với すぐに (ngay lập tức).", "ただちに 意为“立即”（すぐに）。", "ただちに는 '즉시'(すぐに)라는 뜻입니다."),
    },
  ],
  usage: [
    {
      stem: "つぎの　ことばの　つかいかたで　いちばん　いい　ものを　えらんで　ください：　<b><u><ruby>把握<rt>はあく</rt></ruby></u></b>",
      options: [
        "<ruby>現場<rt>げんば</rt></ruby>の　<ruby>状況<rt>じょうきょう</rt></ruby>を　<ruby>正確<rt>せいかく</rt></ruby>に　把握する。",
        "カバンを　しっかり　把握して　歩いた。",
        "おにぎりを　手で　把握して　食べた。",
        "ドアの　ノブを　把握して　開けた。",
      ],
      ans: 1,
      explanation: exp("把握 means to grasp/understand abstract facts or situations (not physically gripping objects).", "পরিস্থিতি বা তথ্য সঠিকভাবে উপলব্ধি করা বোঝাতে 把握 বসে।", "स्थिति या तथ्यों को समझने के लिए 把握 का प्रयोग होता है।", "把握 berarti memahami situasi secara akurat.", "把握 ใช้กับการทำความเข้าใจสถานการณ์", "把握 dùng cho việc nắm bắt tình hình/thông tin.", "把握用于掌握抽象情况或信息。", "把握는 상황이나 내용을 정확히 파악한다는 뜻입니다."),
    },
  ],
  sentence_grammar_1: [
    {
      stem: "<ruby>技術<rt>ぎじゅつ</rt></ruby>の　<ruby>進歩<rt>しんぽ</rt></ruby>（　　　）、<ruby>私<rt>わたし</rt></ruby>たちの　<ruby>生活<rt>せいかつ</rt></ruby>は　<ruby>大<rt>おお</rt></ruby>きく　<ruby>変化<rt>へんか</rt></ruby>した。",
      options: ["にともなって", "をきっかけに", "にかかわらず", "をこめて"],
      ans: 1,
      explanation: exp("〜にともなって ('along with / accompanying the advancement of technology').", "প্রযুক্তির অগ্রগতির সাথে সাথে বোঝাতে 〜にともなって বসে।", "प्रौद्योगिकी की प्रगति के साथ-साथ (〜にともなって) सही है।", "〜にともなって berarti 'seiring dengan kemajuan teknologi'.", "〜にともなって แปลว่า 'ควบคู่ไปกับความก้าวหน้า'", "〜にともなって có nghĩa là 'cùng với sự tiến bộ'.", "「〜にともなって」表示“随着……”。", "〜にともなって는 '~에 수반하여/따라'라는 뜻입니다."),
    },
  ],
  star_questions: [
    {
      stem: "<ruby>環境問題<rt>かんきょうもんだい</rt></ruby>は　＿＿＿　＿＿＿　<u>　★　</u>　＿＿＿　<ruby>課題<rt>かだい</rt></ruby>だ。",
      options: ["一国", "解決できる", "だけでは", "ものではない"],
      seq: [1, 3, 2, 4],
      ans: 2,
      explanation: exp("Order: 一国(1) だけでは(3) 解決できる(2) ものではない(4). ★ is 2 (解決できる).", "সঠিক ক্রম: 一国(1) だけでは(3) 解決できる(2) ものではない(4)। ★ স্থানে 2 বসবে।", "सही क्रम: 一国(1) だけでは(3) 解決できる(2) ものではない(4)। ★ पर 2 आएगा।", "Urutan: 一国(1) だけでは(3) 解決できる(2) ものではない(4). ★ adalah 2.", "ลำดับ: 一国(1) だけでは(3) 解決できる(2) ものではない(4) ★ คือ 2", "Thứ tự: 一国(1) だけでは(3) 解決できる(2) ものではない(4). ★ là 2.", "顺序：一国(1) だけでは(3) 解決できる(2) ものではない(4)。★为 2。", "순서: 一国(1) だけでは(3) 解決できる(2) ものではない(4). ★는 2입니다."),
    },
  ],
  text_grammar: [
    {
      passage:
        "<p><ruby>企業<rt>きぎょう</rt></ruby>が　<ruby>持続的<rt>じぞくてき</rt></ruby>に　<ruby>成長<rt>せいちょう</rt></ruby>する（ 36 ）、<ruby>目先<rt>めさき</rt></ruby>の　<ruby>利益<rt>りえき</rt></ruby>だけでなく、<ruby>長期<rt>ちょうき</rt></ruby>的な　<ruby>視点<rt>してん</rt></ruby>に　立った　<ruby>投資<rt>とうし</rt></ruby>が　<ruby>欠<rt>か</rt></ruby>かせない。（ 37 ）、<ruby>人材育成<rt>じんざいいくせい</rt></ruby>への　<ruby>投資<rt>とうし</rt></ruby>は　<ruby>組織<rt>そしき</rt></ruby>の　<ruby>競争力<rt>きょうそうりょく</rt></ruby>を　<ruby>高<rt>たか</rt></ruby>める　<ruby>上<rt>うえ</rt></ruby>で　<ruby>極<rt>きわ</rt></ruby>めて　（ 38 ）。</p>",
      questions: [
        { stem: "（ 36 ）に　なにを　いれますか。", options: ["うえでは", "どころか", "ものなら", "ばかりか"], ans: 1, explanation: exp("〜うえでは ('in order to / when it comes to sustaining growth').", "টেকসই প্রবৃদ্ধির ক্ষেত্রে বোঝাতে うえでは বসে।", "सतत विकास के संदर्भ में うえでは सही है।", "うえでは berarti 'dalam hal pertumbuhan berkelanjutan'.", "うえでは แปลว่า 'ในแง่ของการเติบโตอย่างยั่งยืน'", "うえでは có nghĩa là 'xét trên phương diện phát triển bền vững'.", "「〜うえでは」表示“在……方面”。", "うえでは는 '~하는 데 있어서는'이라는 뜻입니다.") },
        { stem: "（ 37 ）に　なにを　いれますか。", options: ["とりわけ", "もっとも", "ただし", "したがって"], ans: 1, explanation: exp("とりわけ ('above all / especially') singles out human resource investment.", "বিশেষ করে বোঝাতে とりわけ বসে।", "विशेष रूप से के लिए とりわけ सही है।", "とりわけ berarti 'terutama / khususnya'.", "とりわけ แปลว่า 'โดยเฉพาะอย่างยิ่ง'", "とりわけ có nghĩa là 'đặc biệt là'.", "とりわけ 意为“尤其、特别”。", "とりわけ는 '특히'라는 뜻입니다.") },
        { stem: "（ 38 ）に　なにを　いれますか。", options: ["重要である", "重要にすぎない", "重要どころではない", "重要かねない"], ans: 1, explanation: exp("極めて重要である ('is extremely important') completes the formal academic sentence.", "অত্যন্ত গুরুত্বপূর্ণ বোঝাতে 極めて重要である বসে।", "अत्यंत महत्वपूर्ण है (極めて重要である) सही है।", "極めて重要である berarti 'sangatlah penting'.", "極めて重要である แปลว่า 'มีความสำคัญอย่างยิ่ง'", "極めて重要である có nghĩa là 'vô cùng quan trọng'.", "極めて重要である 意为“极其重要”。", "極めて重要である는 '극히 중요하다'라는 뜻입니다.") },
      ],
    },
  ],
  reading_short: [
    {
      passage: "<p><ruby>情報<rt>じょうほう</rt></ruby>が　あふれる　<ruby>現代<rt>げんだい</rt></ruby>では、<ruby>知識<rt>ちしき</rt></ruby>を　ただ　<ruby>暗記<rt>あんき</rt></ruby>するよりも、<ruby>複数<rt>ふくすう</rt></ruby>の　<ruby>情報源<rt>じょうほうげん</rt></ruby>を　<ruby>比較<rt>ひかく</rt></ruby>し、<ruby>根拠<rt>こんきょ</rt></ruby>を　<ruby>見極<rt>みきわ</rt></ruby>める　<ruby>力<rt>ちから</rt></ruby>が　<ruby>求<rt>もと</rt></ruby>められている。</p>",
      stem: "<ruby>現代<rt>げんだい</rt></ruby>において　<ruby>求<rt>もと</rt></ruby>められている　<ruby>力<rt>ちから</rt></ruby>は　なにか。",
      options: [
        "複数の　情報源を　比較し、根拠を　見極める力",
        "できるだけ　多くの　単語を　暗記する力",
        "一つの　情報源だけを　信じる力",
        "情報を　まったく　見ない力",
      ],
      ans: 1,
      explanation: exp("複数の情報源を比較し、根拠を見極める力 (ability to compare multiple sources and verify evidence).", "একাধিক উৎস তুলনা করে ভিত্তি যাচাই করার ক্ষমতা।", "कई स्रोतों की तुलना कर प्रमाण परखने की क्षमता।", "Kemampuan membandingkan berbagai sumber dan menilai dasarnya.", "ความสามารถในการเปรียบเทียบแหล่งข้อมูลและตรวจสอบหลักฐาน", "Năng lực so sánh nhiều nguồn tin và đánh giá căn cứ.", "比较多个信息源并甄别依据的能力。", "복수의 정보원을 비교하고 근거를 판별하는 힘입니다."),
    },
  ],
  reading_mid: [
    {
      passage: "<p><ruby>対話<rt>たいわ</rt></ruby>とは、<ruby>単<rt>たん</rt></ruby>に　<ruby>自分<rt>じぶん</rt></ruby>の　<ruby>意見<rt>いけん</rt></ruby>を　<ruby>主張<rt>しゅちょう</rt></ruby>し合うことではない。<ruby>相手<rt>あいて</rt></ruby>の　<ruby>背景<rt>はいけい</rt></ruby>や　<ruby>価値観<rt>かちかん</rt></ruby>を　<ruby>想像<rt>そうぞう</rt></ruby>しながら　<ruby>耳<rt>みみ</rt></ruby>を　<ruby>傾<rt>かたむ</rt></ruby>けることで、はじめて　<ruby>新<rt>あたら</rt></ruby>しい　<ruby>視点<rt>してん</rt></ruby>が　<ruby>生<rt>う</rt></ruby>まれるのである。</p>",
      questions: [
        { stem: "<ruby>筆者<rt>ひっしゃ</rt></ruby>が　考える　<ruby>対話<rt>たいわ</rt></ruby>の　<ruby>本質<rt>ほんしつ</rt></ruby>は　なにか。", options: ["相手の背景を想像しながら耳を傾けること", "自分の意見だけを強く主張すること", "相手を論破して勝つこと", "黙って何も言わないこと"], ans: 1, explanation: exp("相手の背景や価値観を想像しながら耳を傾けること (listening while imagining the other person's background and values).", "অপরপক্ষের পটভূমি ও মূল্যবোধ কল্পনা করে মনোযোগ দিয়ে শোনা।", "सामने वाले की पृष्ठभूमि और मूल्यों को समझते हुए ध्यान से सुनना।", "Mendengarkan sambil memahami latar belakang lawan bicara.", "รับฟังโดยคำนึงถึงพื้นฐานและค่านิยมของอีกฝ่าย", "Lắng nghe trong khi thấu hiểu bối cảnh của đối phương.", "在设想对方背景与价值观的同时倾听。", "상대의 배경과 가치관을 상상하며 귀를 기울이는 것입니다.") },
        { stem: "そうすることで　何が　<ruby>生<rt>う</rt></ruby>まれると　述べているか。", options: ["新しい視点", "深い対立", "無駄な時間", "古い慣習"], ans: 1, explanation: exp("はじめて新しい視点が生まれる (a new perspective is born).", "নতুন দৃষ্টিভঙ্গির জন্ম হয়।", "नया दृष्टिकोण उत्पन्न होता है।", "Lahir sudut pandang baru.", "เกิดมุมมองใหม่ๆ ขึ้นมา", "Nảy sinh góc nhìn mới.", "由此诞生新的视角。", "새로운 시각이 생겨납니다.") },
      ],
    },
  ],
  reading_info: [
    {
      passage: "<div class='border p-3 rounded'><p><b><ruby>社内<rt>しゃない</rt></ruby>セキュリティ<ruby>研修<rt>けんしゅう</rt></ruby>の　<ruby>案内<rt>あんない</rt></ruby></b></p><p><ruby>対象<rt>たいしょう</rt></ruby>：全社員（<ruby>受講必須<rt>じゅこうひっす</rt></ruby>）<br/><ruby>期限<rt>きげん</rt></ruby>：12月15日（火）17:00まで<br/>※期限までに修了テストで80点以上を取得すること。</p></div>",
      questions: [
        { stem: "この　<ruby>研修<rt>けんしゅう</rt></ruby>で　<ruby>社員<rt>しゃいん</rt></ruby>が　しなければならない　ことは　なにか。", options: ["12月15日17時までにテストで80点以上取ること", "希望者だけが参加すること", "来年の1月にレポートを出すこと", "60点以上取れば合格すること"], ans: 1, explanation: exp("12月15日17:00までに修了テストで80点以上を取得すること。", "১৫ ডিসেম্বর বিকেল ৫টার মধ্যে পরীক্ষায় ৮০ বা তার বেশি নম্বর পেতে হবে।", "15 दिसंबर शाम 5 बजे तक परीक्षा में 80 या अधिक अंक प्राप्त करना अनिवार्य है।", "Meraih nilai minimal 80 sebelum 15 Desember pukul 17.00.", "ต้องทำคะแนนทดสอบให้ได้ 80 คะแนนขึ้นไปภายในวันที่ 15 ธ.ค. เวลา 17:00 น.", "Đạt từ 80 điểm trở lên trước 17:00 ngày 15/12.", "在12月15日17:00前结业测试取得80分以上。", "12월 15일 17시까지 수료 테스트에서 80점 이상을 취득해야 합니다.") },
        { stem: "この　研修の　対象者は　だれか。", options: ["全社員", "新入社員のみ", "管理職のみ", "外部委託先のみ"], ans: 1, explanation: exp("対象：全社員（受講必須） (all employees, mandatory).", "সকল কর্মচারীর জন্য বাধ্যতামূলক।", "सभी कर्मचारियों के लिए अनिवार्य।", "Wajib bagi seluruh karyawan.", "พนักงานทุกคน (บังคับเข้าอบรม)", "Toàn bộ nhân viên (bắt buộc).", "全体员工（必修）。", "전 사원(수강 필수)입니다.") },
      ],
    },
  ],
  listening: [
    {
      stem: "<ruby>音声<rt>おんせい</rt></ruby>を　<ruby>聞<rt>き</rt></ruby>いて　<ruby>答<rt>こた</rt></ruby>えて　ください。",
      transcript: "男：今度のプレゼン資料、グラフの色使いをもう少しシンプルにしたほうが伝わりやすいんじゃないかな。\n女：確かに情報が多すぎるかもしれませんね。色の数を減らして作り直してみます。",
      options: ["グラフの色の数を減らして作り直す", "グラフのページ数を倍に増やす", "資料の提出を来月に延期する", "文字のサイズを小さくする"],
      ans: 1,
      explanation: exp("She decided to reduce the number of colors in the graphs (色の数を減らして作り直してみます).", "গ্রাফের রঙের সংখ্যা কমিয়ে পুনরায় তৈরি করার সিদ্ধান্ত নেওয়া হয়েছে।", "ग्राफ़ में रंगों की संख्या कम करके दोबारा बनाने का निर्णय लिया गया।", "Mengurangi jumlah warna pada grafik dan membuatnya ulang.", "ลดจำนวนสีของกราฟแล้วทำใหม่", "Giảm số lượng màu của biểu đồ và làm lại.", "决定减少图表的颜色数量并重新制作。", "그래프의 색 수를 줄여서 다시 만들기로 했습니다."),
    },
  ],
};
