export async function fetchStockData(symbol, apiKey) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=full`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`APIエラー: ${res.status}`)

  const json = await res.json()

  if (json['Error Message']) throw new Error('銘柄コードが見つかりません。ティッカーシンボルを確認してください。')
  if (json['Note'] || json['Information']) throw new Error('APIレート制限に達しました。しばらく後でお試しください（無料枠: 25回/日）。')

  const timeSeries = json['Time Series (Daily)']
  if (!timeSeries) throw new Error('データを取得できませんでした。')

  return Object.entries(timeSeries)
    .map(([date, v]) => ({ date, close: parseFloat(v['4. close']) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
