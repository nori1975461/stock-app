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
  const code = ticker.replace(/\.T$/i, '')
  const debugInfo = {}

  // 方法1: Yahoo Finance Japan 検索API
  try {
    const url = 'https://query.finance.yahoo.co.jp/v1/finance/search?q='
      + encodeURIComponent(code)
      + '&lang=ja-JP&region=JP&quotesCount=1&newsCount=0'
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja-JP,ja;q=0.9' }
    })
    const json = JSON.parse(res.getContentText())
    debugInfo.search = JSON.stringify(json).substring(0, 200)
    if (json.quotes && json.quotes.length > 0) {
      const name = json.quotes[0].shortname || json.quotes[0].longname
      if (name && /[぀-ヿ一-鿿]/.test(name)) return name
    }
  } catch (e) { debugInfo.searchError = e.toString() }

  // 方法2: 株探スクレイピング
  try {
    const url = 'https://kabutan.jp/stock/?code=' + code
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja-JP,ja;q=0.9' }
    })
    debugInfo.kabutanStatus = res.getResponseCode()
    if (res.getResponseCode() === 200) {
      const html = res.getContentText('UTF-8')
      const titleTag = html.match(/<title>[^<]{1,80}/)
      debugInfo.kabutanTitle = titleTag ? titleTag[0] : 'NO TITLE'
      const match = html.match(/<title>\s*([^（(【|｜<]+)/)
      if (match && match[1].trim() && /[぀-ヿ一-鿿]/.test(match[1])) {
        return match[1].trim()
      }
    }
  } catch (e) { debugInfo.kabutanError = e.toString() }

  console.log('getJapaneseName debug: ' + JSON.stringify(debugInfo))
  return null
}

function makeResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
  output.setMimeType(ContentService.MimeType.JSON)
  return output
}
