// CLEAR TRADE理論に基づくスクリーニング対象ユニバース（2026年5月調査）
//
// 選定基準：
//  - SECTOR_MACROスコア+2〜+1のセクターを優先
//  - 流動性・時価総額上位（CT理論は規律可能性の高い大型株を推奨）
//  - AI・半導体・デジタルインフラのサプライチェーンに連なる銘柄
//  - 米国「先導株」（NVDA等）の波及先となる国内銘柄を網羅

// ── CT銘柄ユニバース（全スキャン対象：約130銘柄）────────────────────────
export const CT_UNIVERSE = [

  // ━━ 電子部品・半導体（マクロスコア +2 ／ CT最重点セクター）━━━━━━━━━━━
  { ticker: '6857.T', name: 'アドバンテスト',          sector: '電子部品・半導体' },
  { ticker: '285A.T', name: 'キオクシア',              sector: '電子部品・半導体' },
  { ticker: '8035.T', name: '東京エレクトロン',        sector: '電子部品・半導体' },
  { ticker: '6920.T', name: 'レーザーテック',          sector: '電子部品・半導体' },
  { ticker: '6146.T', name: 'ディスコ',                sector: '電子部品・半導体' },
  { ticker: '3132.T', name: 'マクニカHD',              sector: '電子部品・半導体' },
  { ticker: '6861.T', name: 'キーエンス',              sector: '電子部品・半導体' },
  { ticker: '6762.T', name: 'TDK',                     sector: '電子部品・半導体' },
  { ticker: '6981.T', name: '村田製作所',              sector: '電子部品・半導体' },
  { ticker: '6988.T', name: '日東電工',                sector: '電子部品・半導体' },
  { ticker: '6254.T', name: '野村マイクロ・サイエンス', sector: '電子部品・半導体' },
  { ticker: '7735.T', name: 'SCREENホールディングス',  sector: '電子部品・半導体' },
  { ticker: '6525.T', name: 'KOKUSAI ELECTRIC',        sector: '電子部品・半導体' },
  { ticker: '6976.T', name: '太陽誘電',                 sector: '電子部品・半導体' },
  { ticker: '6723.T', name: 'ルネサスエレクトロニクス',  sector: '電子部品・半導体' },
  { ticker: '6971.T', name: '京セラ',                   sector: '電子部品・半導体' },
  { ticker: '4062.T', name: 'イビデン',                  sector: '電子部品・半導体' },
  { ticker: '6963.T', name: 'ローム',                    sector: '電子部品・半導体' },
  { ticker: '6806.T', name: 'ヒロセ電機',                sector: '電子部品・半導体' },
  { ticker: '6996.T', name: 'ニチコン',                  sector: '電子部品・半導体' },
  { ticker: '3436.T', name: 'SUMCO',                     sector: '電子部品・半導体' },
  { ticker: '4186.T', name: '東京応化工業',              sector: '電子部品・半導体' },
  { ticker: '6504.T', name: '富士電機',                  sector: '電子部品・半導体' },

  // ━━ 通信（マクロスコア +2）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '9984.T', name: 'ソフトバンクグループ',    sector: '通信' },
  { ticker: '9433.T', name: 'KDDI',                    sector: '通信' },
  { ticker: '9432.T', name: 'NTT',                     sector: '通信' },
  { ticker: '9434.T', name: 'ソフトバンク',            sector: '通信' },

  // ━━ 電気機器（マクロスコア +1）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '6758.T', name: 'ソニーグループ',          sector: '電気機器' },
  { ticker: '6501.T', name: '日立製作所',              sector: '電気機器' },
  { ticker: '6701.T', name: 'NEC',                     sector: '電気機器' },
  { ticker: '6702.T', name: '富士通',                  sector: '電気機器' },
  { ticker: '6594.T', name: 'ニデック',                sector: '電気機器' },
  { ticker: '6506.T', name: '安川電機',                sector: '電気機器' },
  { ticker: '6752.T', name: 'パナソニック HD',          sector: '電気機器' },

  // ━━ IT・情報サービス（マクロスコア +1）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '4385.T', name: 'メルカリ',                sector: 'IT・情報サービス' },
  { ticker: '4689.T', name: 'LINEヤフー',              sector: 'IT・情報サービス' },
  { ticker: '9613.T', name: 'NTTデータグループ',       sector: 'IT・情報サービス' },
  { ticker: '6098.T', name: 'リクルートHD',            sector: 'IT・情報サービス' },
  { ticker: '4751.T', name: 'サイバーエージェント',    sector: 'IT・情報サービス' },
  { ticker: '4307.T', name: '野村総合研究所',          sector: 'IT・情報サービス' },

  // ━━ 精密機器（光学・半導体関連、マクロスコア +1）━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '7741.T', name: 'HOYA',                    sector: '精密機器' },
  { ticker: '7751.T', name: 'キヤノン',                sector: '精密機器' },
  { ticker: '7731.T', name: 'ニコン',                  sector: '精密機器' },

  // ━━ 医療機器（マクロスコア 0）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '4543.T', name: 'テルモ',                  sector: '医療機器' },
  { ticker: '7733.T', name: 'オリンパス',              sector: '医療機器' },
  { ticker: '6869.T', name: 'シスメックス',            sector: '医療機器' },

  // ━━ 機械（FA・自動化・産業機械、マクロスコア +1）━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '6273.T', name: 'SMC',                     sector: '機械' },
  { ticker: '6367.T', name: 'ダイキン工業',            sector: '機械' },
  { ticker: '6301.T', name: 'コマツ',                  sector: '機械' },
  { ticker: '6326.T', name: 'クボタ',                  sector: '機械' },
  { ticker: '6954.T', name: 'ファナック',              sector: '機械' },
  { ticker: '6841.T', name: '横河電機',                sector: '機械' },
  { ticker: '6645.T', name: 'オムロン',                sector: '機械' },
  { ticker: '6383.T', name: 'ダイフク',                sector: '機械' },
  { ticker: '6305.T', name: '日立建機',                sector: '機械' },
  { ticker: '6141.T', name: 'DMG森精機',               sector: '機械' },
  { ticker: '6268.T', name: 'ナブテスコ',              sector: '機械' },

  // ━━ 重工業（防衛・宇宙需要）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '7011.T', name: '三菱重工業',              sector: '重工業' },
  { ticker: '7012.T', name: '川崎重工業',              sector: '重工業' },
  { ticker: '7013.T', name: 'IHI',                     sector: '重工業' },

  // ━━ 化学（マクロスコア +1）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '4063.T', name: '信越化学工業',            sector: '化学' },
  { ticker: '4901.T', name: '富士フイルムHD',          sector: '化学' },
  { ticker: '3407.T', name: '旭化成',                  sector: '化学' },
  { ticker: '4182.T', name: '三菱ガス化学',            sector: '化学' },
  { ticker: '4203.T', name: '住友ベークライト',        sector: '化学' },
  { ticker: '3402.T', name: '東レ',                    sector: '化学' },
  { ticker: '4205.T', name: '日本ゼオン',              sector: '化学' },

  // ━━ ガラス・セメント（マクロスコア 0）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '3110.T', name: '日東紡績',                sector: 'ガラス・セメント' },
  { ticker: '5214.T', name: '日本電気硝子',            sector: 'ガラス・セメント' },

  // ━━ 総合商社（資源×AI投資）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '8001.T', name: '伊藤忠商事',              sector: '総合商社' },
  { ticker: '8058.T', name: '三菱商事',                sector: '総合商社' },
  { ticker: '8031.T', name: '三井物産',                sector: '総合商社' },
  { ticker: '8053.T', name: '住友商事',                sector: '総合商社' },
  { ticker: '8002.T', name: '丸紅',                    sector: '総合商社' },

  // ━━ 銀行（マクロスコア +1）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '8306.T', name: '三菱UFJ FG',              sector: '銀行' },
  { ticker: '8316.T', name: '三井住友FG',              sector: '銀行' },
  { ticker: '8411.T', name: 'みずほFG',                sector: '銀行' },
  { ticker: '8604.T', name: '野村ホールディングス',    sector: '金融・証券' },
  { ticker: '8601.T', name: '大和証券グループ',        sector: '金融・証券' },

  // ━━ 非鉄金属（マクロスコア +1）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '5713.T', name: '住友金属鉱山',            sector: '非鉄金属' },
  { ticker: '5802.T', name: '住友電気工業',            sector: '非鉄金属' },
  { ticker: '5803.T', name: 'フジクラ',                sector: '非鉄金属' },
  { ticker: '5801.T', name: '古河電工',                sector: '非鉄金属' },

  // ━━ エンタメ・ゲーム（CT先導株候補）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '7974.T', name: '任天堂',                  sector: 'エンタメ・ゲーム' },
  { ticker: '4661.T', name: 'オリエンタルランド',      sector: 'エンタメ・ゲーム' },
  { ticker: '7832.T', name: 'バンダイナムコHD',        sector: 'エンタメ・ゲーム' },
  { ticker: '9766.T', name: 'コナミHD',                sector: 'エンタメ・ゲーム' },
  { ticker: '9697.T', name: 'カプコン',                sector: 'エンタメ・ゲーム' },

  // ━━ 医薬品（バイオAI）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '4519.T', name: '中外製薬',                sector: '医薬品' },
  { ticker: '4568.T', name: '第一三共',                sector: '医薬品' },
  { ticker: '4503.T', name: 'アステラス製薬',           sector: '医薬品' },
  { ticker: '4502.T', name: '武田薬品工業',             sector: '医薬品' },
  { ticker: '4578.T', name: '大塚HD',                  sector: '医薬品' },
  { ticker: '4528.T', name: '小野薬品工業',             sector: '医薬品' },

  // ━━ データセンター・AIインフラ（電力・冷却・建設）━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '9531.T', name: '東京ガス',                sector: 'データセンター・電力' },
  { ticker: '9503.T', name: '関西電力',                sector: 'データセンター・電力' },
  { ticker: '6503.T', name: '三菱電機',                sector: 'データセンター・電力' },
  { ticker: '6302.T', name: '住友重機械工業',          sector: 'データセンター・電力' },
  { ticker: '1801.T', name: '大成建設',                sector: 'データセンター・建設' },
  { ticker: '1803.T', name: '清水建設',                sector: 'データセンター・建設' },
  { ticker: '9502.T', name: '中部電力',                sector: 'データセンター・電力' },
  { ticker: '9532.T', name: '大阪ガス',                sector: 'データセンター・電力' },
  { ticker: '1812.T', name: '鹿島建設',                sector: 'データセンター・建設' },
  { ticker: '1802.T', name: '大林組',                  sector: 'データセンター・建設' },

  // ━━ 蓄電池（AIデータセンターUPS・EV・産業用蓄電）━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '6674.T', name: 'GSユアサ',                sector: '蓄電池' },

  // ━━ AI冷却インフラ（データセンター冷却・超純水処理・ポンプ）━━━━━━━━━━━━━━━━━
  { ticker: '6361.T', name: '荏原製作所',              sector: 'AI冷却インフラ' },
  { ticker: '6370.T', name: '栗田工業',                sector: 'AI冷却インフラ' },

  // ━━ 自動車（EV・自動運転・次世代モビリティ）━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '7203.T', name: 'トヨタ自動車',            sector: '自動車' },
  { ticker: '7267.T', name: 'ホンダ',                  sector: '自動車' },
  { ticker: '6902.T', name: 'デンソー',                sector: '自動車' },
  { ticker: '5108.T', name: 'ブリヂストン',            sector: '自動車' },
  { ticker: '7259.T', name: 'アイシン',                sector: '自動車' },

  // ━━ 不動産（金利感応・相場転換の先行指標）━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { ticker: '8802.T', name: '三菱地所',                sector: '不動産' },
  { ticker: '8801.T', name: '三井不動産',              sector: '不動産' },
  { ticker: '8830.T', name: '住友不動産',              sector: '不動産' },
  { ticker: '1925.T', name: '大和ハウス工業',          sector: '不動産' },
  { ticker: '1928.T', name: '積水ハウス',              sector: '住宅建設' },

  // ━━ 米国株（CT先導株・2024-2026年の市場牽引銘柄）━━━━━━━━━━━━━━━━━━━━━
  { ticker: 'NVDA',   name: 'NVIDIA',                  sector: '米国半導体' },
  { ticker: 'AMD',    name: 'AMD',                     sector: '米国半導体' },
  { ticker: 'AVGO',   name: 'Broadcom',                sector: '米国半導体' },
  { ticker: 'TSM',    name: 'TSMC',                    sector: '米国半導体' },
  { ticker: 'ARM',    name: 'ARM Holdings',            sector: '米国半導体' },
  { ticker: 'AAPL',   name: 'Apple',                   sector: '米国テック' },
  { ticker: 'MSFT',   name: 'Microsoft',               sector: '米国テック' },
  { ticker: 'META',   name: 'Meta',                    sector: '米国テック' },
  { ticker: 'GOOGL',  name: 'Alphabet',                sector: '米国テック' },
  { ticker: 'AMZN',   name: 'Amazon',                  sector: '米国テック' },
  { ticker: 'TSLA',   name: 'Tesla',                   sector: '米国テック' },
  { ticker: 'ORCL',   name: 'Oracle',                  sector: '米国テック' },
  { ticker: 'MU',     name: 'Micron Technology',        sector: '米国半導体' },
]

// ── 先導株リスト（市場を牽引する銘柄・CT理論研究に基づく 2026年5月調査）────
//
// CT理論「先導株」の定義：
//   相場全体を先行して動かし、他の銘柄の方向性を決定づける「市場の司令塔」。
//   先導株を特定し、その流れに乗ることがCT理論の最重要戦略。
//   先導株は全体の2〜3%しか存在せず、90%以上の個人投資家が見落としている。
//
// leaderRank:
//   'S' = 確定先導株（市場全体を支配するレベル）
//   'A' = 有力先導株（セクター・地域で主導的）
//   'B' = 先導株候補（先導株に連動する次の波）

export const CT_LEADERS = [
  {
    ticker: 'NVDA',
    name: 'NVIDIA',
    sector: '米国半導体',
    leaderRank: 'S',
    leaderReason:
      'AI GPU市場の事実上の独占企業。H100/H200/Blackwellの爆発的需要で2024年から世界市場を牽引。' +
      'CLEAR TRADE理論でいう「真の先導株」の条件を完全に満たす。NVDAが上昇する日は日本の半導体関連株も上昇するという因果関係が確立している。',
  },
  {
    ticker: '6857.T',
    name: 'アドバンテスト',
    sector: '電子部品・半導体',
    leaderRank: 'A',
    leaderReason:
      'NVIDIA向けAI半導体の最終検査を担う「日本のNVIDIA」的存在。NVDAの受注増がそのまま売上に直結する構造。' +
      'ただし年間騰落率+126%/+91%級の超高ボラティリティにより、相場バロメーターには不適。' +
      'トレンドが明確に確立した局面での参入に限定すること。A-rankとして先導株候補に残す。',
  },
  {
    ticker: '8035.T',
    name: '東京エレクトロン',
    sector: '電子部品・半導体',
    leaderRank: 'A',
    leaderReason:
      '半導体製造装置の日本最大手。TSMC・Samsung・IntelのAI向け設備投資増強が直接売上に反映される。' +
      '日経平均に占める比率が高く、指数全体の動きを先行する「日本株先導株」の一角。',
  },
  {
    ticker: '6920.T',
    name: 'レーザーテック',
    sector: '電子部品・半導体',
    leaderRank: 'A',
    leaderReason:
      'EUV露光機用マスク検査装置で世界独占。次世代半導体（2nm以下）の「入口の門番」として代替不可能。' +
      '超高成長・高ボラティリティ銘柄で、CT理論の「初速が速い銘柄」の典型例。',
  },
  {
    ticker: '285A.T',
    name: 'キオクシア',
    sector: '電子部品・半導体',
    leaderRank: 'A',
    leaderReason:
      '2026年5月決算で純利益が予想の約48倍を記録。NANDフラッシュの市況回復＋AI向けストレージ需要急増が直撃。' +
      '時価総額の急上昇により日経平均への寄与度が高まり、日本株市場を先行して動かす「先導株」の条件を満たし始めた。' +
      '超高ボラティリティのためトレンドが明確に確立した局面（初速＋2日目確認）でのみ参入すること。',
  },
  {
    ticker: 'TSM',
    name: 'TSMC',
    sector: '米国半導体',
    leaderRank: 'A',
    leaderReason:
      'NVIDIA・AMD・Apple・Qualcommの全チップを製造。AI半導体の「唯一の工場」として代替不可能な地位を確立。' +
      '半導体サプライチェーン全体の基盤であり、TSMの出来高と方向性は業界全体の先行指標となる。',
  },
  {
    ticker: 'AVGO',
    name: 'Broadcom',
    sector: '米国半導体',
    leaderRank: 'A',
    leaderReason:
      'Google・Meta・Appleのカスタム（専用）AIチップを独占受注。NVIDIAに依存しない独自のAI半導体市場を創出。' +
      '汎用GPUからカスタムチップへのトレンド転換の最大の恩恵者。',
  },
  {
    ticker: '9984.T',
    name: 'ソフトバンクグループ',
    sector: '通信',
    leaderRank: 'B',
    leaderReason:
      'ARM保有（世界半導体設計の95%が使用）＋AIファンド投資で日本最大のAI純粋プレイ。' +
      '孫正義氏が「2030年AGI実現・知性爆発」を掲げ10兆円規模のAIインフラ投資を発表。日本版NVIDIA的ポジション。',
  },
  {
    ticker: 'AMD',
    name: 'AMD',
    sector: '米国半導体',
    leaderRank: 'B',
    leaderReason:
      'AI GPU市場でNVIDIAを追走する最有力挑戦者。MI300X/MI350がMicrosoftやMetaに採用拡大中。' +
      'NVIDIAの供給不足の受皿として急成長。「第2の先導株」として機能するタイミングを狙う。',
  },
]

// ── 次元1：セクターバロメーター（業種代表銘柄）────────────────────────────────
//
// 相場環境判断の2段階プロセス：
//   Step1: 各業種の代表銘柄をスキャンして「強いセクター」を選定
//   Step2: 強いセクターの中から最もCTスコアが高い銘柄をS-rank候補とする
//
// 選定基準（日本株）：
//   - 業種内で時価総額最大 + 出来高安定 + 複数顧客（単一顧客依存リスクを排除）
//   - アドバンテスト除外理由：ボラティリティが大きく業種バロメーターには不適
export const SECTOR_BAROMETERS = [
  // 米国バロメーター（市場全体・ハイテク・半導体の3軸）
  { ticker: 'SPY',    name: 'S&P500 ETF',        sector: '米国市場全体',     region: 'US' },
  { ticker: 'QQQ',    name: 'NASDAQ-100 ETF',     sector: '米国ハイテク',     region: 'US' },
  { ticker: 'SOXX',   name: '半導体ETF',           sector: '米国半導体',      region: 'US' },
  // 日本セクター代表（各業種2銘柄：需要ドライバーが異なる補完的ペアで選定）
  // 電子部品・半導体：製造装置（広域）× 精密切断（後工程）
  { ticker: '8035.T', name: '東京エレクトロン',    sector: '電子部品・半導体', region: 'JP' },
  { ticker: '6146.T', name: 'ディスコ',            sector: '電子部品・半導体', region: 'JP' },
  // 電気機器：社会インフラ × 消費・エンタメ
  { ticker: '6501.T', name: '日立製作所',           sector: '電気機器',         region: 'JP' },
  { ticker: '6758.T', name: 'ソニーグループ',        sector: '電気機器',         region: 'JP' },
  // IT・情報サービス：B2C人材・消費 × B2C法人IT
  { ticker: '6098.T', name: 'リクルートHD',         sector: 'IT・情報サービス', region: 'JP' },
  { ticker: '9613.T', name: 'NTTデータグループ',    sector: 'IT・情報サービス', region: 'JP' },
  // 精密機器：半導体材料・光学 × 光学・半導体露光装置
  { ticker: '7741.T', name: 'HOYA',                sector: '精密機器',          region: 'JP' },
  { ticker: '7751.T', name: 'キヤノン',              sector: '精密機器',          region: 'JP' },
  // 機械：空圧・制御（国内工場向け）× 空調（グローバル需要）
  { ticker: '6273.T', name: 'SMC',                 sector: '機械',              region: 'JP' },
  { ticker: '6367.T', name: 'ダイキン工業',          sector: '機械',              region: 'JP' },
  // 重工業：総合重工（防衛・エネルギー） × 航空エンジン・宇宙
  { ticker: '7011.T', name: '三菱重工業',           sector: '重工業',            region: 'JP' },
  { ticker: '7013.T', name: 'IHI',                 sector: '重工業',            region: 'JP' },
  // 化学：半導体材料 × 医療・イメージング多角化
  { ticker: '4063.T', name: '信越化学工業',          sector: '化学',              region: 'JP' },
  { ticker: '4901.T', name: '富士フイルムHD',        sector: '化学',              region: 'JP' },
  // 総合商社：消費向け × 資源向け
  { ticker: '8001.T', name: '伊藤忠商事',            sector: '総合商社',          region: 'JP' },
  { ticker: '8058.T', name: '三菱商事',              sector: '総合商社',          region: 'JP' },
  // 銀行：3大メガバンクから2行
  { ticker: '8306.T', name: '三菱UFJ FG',           sector: '銀行',              region: 'JP' },
  { ticker: '8316.T', name: '三井住友FG',            sector: '銀行',              region: 'JP' },
  // 通信：モバイル+法人 × インフラ+海外
  { ticker: '9433.T', name: 'KDDI',                 sector: '通信',              region: 'JP' },
  { ticker: '9432.T', name: 'NTT',                  sector: '通信',              region: 'JP' },
  // 非鉄金属：電線・光ファイバー × 採掘・製錬（需要ドライバーが異なる）
  { ticker: '5803.T', name: 'フジクラ',              sector: '非鉄金属',          region: 'JP' },
  { ticker: '5713.T', name: '住友金属鉱山',           sector: '非鉄金属',          region: 'JP' },
  // エンタメ・ゲーム：デジタル娯楽 × リアル体験消費
  { ticker: '7974.T', name: '任天堂',                sector: 'エンタメ・ゲーム',   region: 'JP' },
  { ticker: '4661.T', name: 'オリエンタルランド',     sector: 'エンタメ・ゲーム',   region: 'JP' },
  // 医薬品：がん・抗体薬（ロシュ系） × グローバル抗体薬（異なる疾患領域）
  { ticker: '4519.T', name: '中外製薬',              sector: '医薬品',             region: 'JP' },
  { ticker: '4568.T', name: '第一三共',              sector: '医薬品',             region: 'JP' },
]

// 先導ランクの表示ラベル
export const LEADER_RANK_LABEL = {
  S: '★★★ 確定先導株',
  A: '★★ 有力先導株',
  B: '★ 先導株候補',
}

export const LEADER_RANK_CLASS = {
  S: 'leader-s',
  A: 'leader-a',
  B: 'leader-b',
}
