export async function fetchStockData(symbol, apiKey) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`APIエラー: ${res.status}`)

  const json = await res.json()

  if (json['Error Message']) throw new Error('銘柄コードが見つかりません。ティッカーシンボルを確認してください。')

  const timeSeries = json['Time Series (Daily)']

  if (!timeSeries) {
    if (json['Note']) throw new Error('APIレート制限に達しました（1分5回上限）。しばらく後でお試しください。')
    if (json['Information']) throw new Error('APIキーが無効か、1日の上限（25回）に達しました。キーを確認してください。')
    throw new Error('データを取得できませんでした。')
  }

  return Object.entries(timeSeries)
    .map(([date, v]) => ({ date, close: parseFloat(v['4. close']) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
