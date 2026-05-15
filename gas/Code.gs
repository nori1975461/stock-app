// 株価予測アプリ - GASバックエンド
// Yahoo Finance からデータ取得（日本株・米国株両対応）
//
// デプロイ手順:
//   1. https://script.google.com で新規プロジェクト作成
//   2. このコードを貼り付けて保存（Ctrl+S）
//   3. 「デプロイ」→「新しいデプロイ」をクリック
//   4. 種類: 「ウェブアプリ」を選択
//   5. 次のユーザーとして実行: 「自分」
//   6. アクセスできるユーザー: 「全員」
//   7. 「デプロイ」ボタンを押す
//   8. 表示されたURLをアプリの「GAS URL」欄に貼り付ける

function doGet(e) {
  const ticker = e.parameter.ticker || 'AAPL'
  const days = Math.min(Math.max(parseInt(e.parameter.days) || 120, 1), 365)

  try {
    const endDate = Math.floor(Date.now() / 1000)
    const startDate = endDate - days * 24 * 60 * 60

    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/'
      + encodeURIComponent(ticker)
      + '?interval=1d&period1=' + startDate
      + '&period2=' + endDate
      + '&events=history'

    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })

    const json = JSON.parse(res.getContentText())

    if (!json.chart || !json.chart.result || json.chart.result.length === 0) {
      return makeResponse({ error: '指定された銘柄のデータが見つかりませんでした' })
    }

    const result = json.chart.result[0]
    const timestamps = result.timestamp
    const quote = result.indicators.quote[0]
    const opens   = quote.open
    const highs   = quote.high
    const lows    = quote.low
    const closes  = quote.close
    const volumes = quote.volume
    const meta = result.meta

    const prices = timestamps
      .map(function(ts, i) {
        return {
          date:   new Date(ts * 1000).toISOString().slice(0, 10),
          open:   opens[i]   || null,
          high:   highs[i]   || null,
          low:    lows[i]    || null,
          close:  closes[i]  || null,
          volume: volumes[i] || null
        }
      })
      .filter(function(p) { return p.close !== null && p.close !== undefined })

    var displayName = meta.shortName || meta.longName || ticker
    if (ticker.toUpperCase().slice(-2) === '.T') {
      var jaName = getJapaneseName(ticker)
      if (jaName) displayName = jaName
    }

    return makeResponse({
      ticker: ticker,
      currency: meta.currency,
      name: displayName,
      prices: prices
    })

  } catch (err) {
    console.error(err)
    return makeResponse({ error: 'データの取得に失敗しました。しばらく経ってから再試行してください' })
  }
}

function getJapaneseName(ticker) {
  const code = ticker.replace(/\.T$/i, '')

  // 日本株銘柄コード → 日本語会社名マッピング（主要銘柄）
  var names = {
    '1301':'極洋','1332':'日本水産','1333':'マルハニチロ','1605':'INPEX',
    '1801':'大成建設','1802':'大林組','1803':'清水建設','1812':'鹿島建設',
    '1925':'大和ハウス工業','1928':'積水ハウス',
    '2002':'日清製粉グループ','2269':'明治ホールディングス','2282':'日本ハム',
    '2413':'エムスリー','2432':'DeNA',
    '2502':'アサヒグループホールディングス','2503':'キリンホールディングス',
    '2801':'キッコーマン','2802':'味の素','2914':'日本たばこ産業',
    '285A':'キオクシア',
    '3382':'セブン＆アイ・ホールディングス','3401':'帝人','3402':'東レ',
    '3407':'旭化成','3659':'ネクソン','3861':'王子ホールディングス',
    '4063':'信越化学工業','4183':'三井化学','4188':'三菱ケミカルグループ',
    '4307':'野村総合研究所','4385':'メルカリ','4452':'花王',
    '4502':'武田薬品工業','4503':'アステラス製薬','4507':'塩野義製薬',
    '4519':'中外製薬','4523':'エーザイ','4543':'テルモ',
    '4568':'第一三共','4578':'大塚ホールディングス',
    '4661':'オリエンタルランド','4689':'LINEヤフー',
    '4751':'サイバーエージェント','4755':'楽天グループ',
    '4901':'富士フイルムホールディングス',
    '5019':'出光興産','5020':'ENEOSホールディングス',
    '5108':'ブリヂストン','5201':'AGC',
    '5301':'東海カーボン','5332':'TOTO','5401':'日本製鉄',
    '5406':'神戸製鋼所','5411':'JFEホールディングス',
    '5706':'三井金属鉱業','5707':'東邦亜鉛',
    '5711':'三菱マテリアル','5713':'住友金属鉱山','5714':'DOWAホールディングス',
    '5801':'古河電気工業','5802':'住友電気工業','5803':'フジクラ',
    '6098':'リクルートホールディングス','6146':'ディスコ','6178':'日本郵政',
    '6201':'豊田自動織機','6254':'野村マイクロ・サイエンス',
    '6273':'SMC','6301':'コマツ','6302':'住友重機械工業','6326':'クボタ',
    '6367':'ダイキン工業','6501':'日立製作所','6502':'東芝',
    '6503':'三菱電機','6506':'安川電機','6586':'マキタ',
    '6594':'ニデック','6645':'オムロン','6701':'NEC',
    '6702':'富士通','6752':'パナソニックホールディングス',
    '6753':'シャープ','6758':'ソニーグループ','6762':'TDK',
    '6841':'横河電機','6857':'アドバンテスト','6861':'キーエンス',
    '6902':'デンソー','6920':'レーザーテック',
    '6954':'ファナック','6971':'京セラ',
    '6981':'村田製作所','6988':'日東電工',
    '7011':'三菱重工業','7012':'川崎重工業','7013':'IHI',
    '7182':'ゆうちょ銀行',
    '7201':'日産自動車','7202':'いすゞ自動車','7203':'トヨタ自動車',
    '7261':'マツダ','7267':'ホンダ','7269':'スズキ',
    '7270':'SUBARU','7272':'ヤマハ発動機',
    '7731':'ニコン','7733':'オリンパス',
    '7735':'SCREENホールディングス','7741':'HOYA','7751':'キヤノン',
    '7752':'リコー','7832':'バンダイナムコホールディングス',
    '7974':'任天堂',
    '8001':'伊藤忠商事','8002':'丸紅','8031':'三井物産',
    '8035':'東京エレクトロン','8053':'住友商事','8058':'三菱商事',
    '8267':'イオン',
    '8306':'三菱UFJフィナンシャル・グループ',
    '8308':'りそなホールディングス',
    '8316':'三井住友フィナンシャルグループ',
    '8331':'千葉銀行',
    '8411':'みずほフィナンシャルグループ',
    '8591':'オリックス','8601':'大和証券グループ本社',
    '8604':'野村ホールディングス',
    '8630':'SOMPOホールディングス',
    '8750':'第一生命ホールディングス',
    '8766':'東京海上ホールディングス',
    '8802':'三菱地所','8804':'東京建物',
    '9020':'JR東日本','9021':'JR西日本','9022':'JR東海',
    '9064':'ヤマトホールディングス',
    '9101':'日本郵船','9104':'商船三井','9107':'川崎汽船',
    '9202':'ANAホールディングス','9301':'三菱倉庫',
    '9432':'日本電信電話','9433':'KDDI','9434':'ソフトバンク',
    '9501':'東京電力ホールディングス','9502':'中部電力','9503':'関西電力',
    '9531':'東京ガス','9532':'大阪ガス',
    '9613':'NTTデータグループ','9735':'セコム',
    '9984':'ソフトバンクグループ'
  }

  if (names[code]) return names[code]

  // マッピングにない場合は株探からスクレイピングを試みる
  try {
    const url = 'https://kabutan.jp/stock/?code=' + code
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja-JP,ja;q=0.9' }
    })
    if (res.getResponseCode() === 200) {
      const html = res.getContentText('UTF-8')
      const match = html.match(/<title>\s*([^（(【|｜<]+)/)
      if (match && match[1].trim() && /[぀-ヿ一-鿿]/.test(match[1])) {
        return match[1].trim()
      }
    }
  } catch (e) { console.log('kabutan error: ' + e) }

  return null
}

function makeResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
  output.setMimeType(ContentService.MimeType.JSON)
  return output
}
