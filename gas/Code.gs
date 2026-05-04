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
    const closes = result.indicators.quote[0].close
    const meta = result.meta

    const prices = timestamps
      .map(function(ts, i) {
        return {
          date: new Date(ts * 1000).toISOString().slice(0, 10),
          close: closes[i]
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
  try {
    const code = ticker.replace(/\.T$/i, '')
    const url = 'https://finance.yahoo.co.jp/quote/' + code
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9'
      }
    })
    if (res.getResponseCode() !== 200) return null
    const html = res.getContentText('UTF-8')

    // og:title から取得: <meta property="og:title" content="三井金属鉱業(5706)...">
    const ogMatch = html.match(/property="og:title"\s+content="([^"(（【\[]+)/)
      || html.match(/content="([^"(（【\[]+)"\s+property="og:title"/)
    if (ogMatch && ogMatch[1].trim()) return ogMatch[1].trim()

    // title タグから取得: <title>三井金属鉱業(5706) 株価...</title>
    const titleMatch = html.match(/<title>([^<(（【\[]+)/)
    if (titleMatch && titleMatch[1].trim()) return titleMatch[1].trim()

  } catch (e) {
    console.error('日本語名取得エラー:', e)
  }
  return null
}

function makeResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
  output.setMimeType(ContentService.MimeType.JSON)
  return output
}
