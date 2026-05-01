// GAS代替バックエンド（Alpha Vantageの代わりに使う場合）
// デプロイ方法:
//   1. Google Apps Script (script.google.com) で新規プロジェクト作成
//   2. このコードを貼り付けて保存
//   3. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
//   4. 「次のユーザーとして実行: 自分」「アクセスできるユーザー: 全員」で公開
//   5. 発行されたURLをsrc/utils/api.jsのGAS_URLに設定

function doGet(e) {
  const ticker = e.parameter.ticker || 'AAPL'
  const days = parseInt(e.parameter.days) || 90

  try {
    const endDate = Math.floor(Date.now() / 1000)
    const startDate = endDate - days * 24 * 60 * 60 * 2

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${startDate}&period2=${endDate}`
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true })
    const json = JSON.parse(res.getContentText())

    const result = json.chart.result[0]
    const timestamps = result.timestamp
    const closes = result.indicators.quote[0].close

    const prices = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: closes[i],
      }))
      .filter(p => p.close !== null)
      .slice(-days)

    const output = { ticker, prices }
    return ContentService
      .createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON)
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}
