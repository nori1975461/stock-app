function calcMA(prices, period) {
  return prices.map((_, i) => {
    if (i < period - 1) return null
    const slice = prices.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

function calcRSI(prices, period = 14) {
  return prices.map((_, i) => {
    if (i < period) return null
    const changes = prices.slice(i - period + 1, i + 1).map((p, j, arr) => (j === 0 ? 0 : p - arr[j - 1]))
    const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0)
    const losses = changes.filter(c => c < 0).reduce((a, b) => a + Math.abs(b), 0)
    const avgGain = gains / period
    const avgLoss = losses / period
    if (avgLoss === 0) return 100
    const rs = avgGain / avgLoss
    return 100 - 100 / (1 + rs)
  })
}

export function predict(allPrices, days) {
  const recent = allPrices.slice(-Math.max(days, 30))
  const closes = recent.map(p => p.close)

  const ma5 = calcMA(closes, 5)
  const ma20 = calcMA(closes, 20)
  const rsiArr = calcRSI(closes, 14)

  const last = closes.length - 1
  const lastMA5 = ma5[last]
  const lastMA20 = ma20[last]
  const lastRSI = rsiArr[last]
  const lastClose = closes[last]
  const prevClose5 = closes[last - 5] ?? closes[0]

  const signals = []
  let score = 0

  if (lastMA5 > lastMA20) {
    score += 2
    signals.push('短期MA(5) > 長期MA(20)：上昇トレンド')
  } else {
    score -= 2
    signals.push('短期MA(5) < 長期MA(20)：下降トレンド')
  }

  const ma5Trend = ma5[last] - ma5[last - 5 > 0 ? last - 5 : 0]
  if (ma5Trend > 0) {
    score += 1
    signals.push('MA5が上向き')
  } else {
    score -= 1
    signals.push('MA5が下向き')
  }

  if (lastClose > prevClose5) {
    score += 1
    signals.push('直近5日で株価が上昇')
  } else {
    score -= 1
    signals.push('直近5日で株価が下落')
  }

  if (lastRSI !== null) {
    if (lastRSI < 30) {
      score += 1
      signals.push(`RSI ${lastRSI.toFixed(1)}：売られ過ぎ（反発期待）`)
    } else if (lastRSI > 70) {
      score -= 1
      signals.push(`RSI ${lastRSI.toFixed(1)}：買われ過ぎ（調整リスク）`)
    } else {
      signals.push(`RSI ${lastRSI.toFixed(1)}：中立`)
    }
  }

  const direction = score > 0 ? 'UP' : 'DOWN'
  const confidence = Math.min(50 + Math.abs(score) * 10, 85)

  const chartData = recent.slice(-days).map((p, i, arr) => {
    const idx = closes.length - arr.length + i
    return {
      date: p.date.slice(5),
      price: p.close,
      MA5: ma5[idx] != null ? +ma5[idx].toFixed(2) : null,
      MA20: ma20[idx] != null ? +ma20[idx].toFixed(2) : null,
    }
  })

  return {
    direction,
    confidence,
    lastClose,
    ma5: lastMA5 != null ? +lastMA5.toFixed(2) : null,
    ma20: lastMA20 != null ? +lastMA20.toFixed(2) : null,
    rsi: lastRSI != null ? +lastRSI.toFixed(1) : null,
    signals,
    chartData,
  }
}
