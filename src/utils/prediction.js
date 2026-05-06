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

function linearRegressionSlope(values) {
  const n = values.length
  if (n < 2) return 0
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  values.forEach((v, i) => {
    num += (i - xMean) * (v - yMean)
    den += (i - xMean) ** 2
  })
  return den !== 0 ? num / den : 0
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

  // 3か月後の見通し（線形回帰による長期トレンド分析）
  let forecast = null
  const longData = allPrices.slice(-Math.min(90, allPrices.length))
  if (longData.length >= 20) {
    const longCloses = longData.map(p => p.close)
    const longSlope = linearRegressionSlope(longCloses)
    const midPrice = longCloses[Math.floor(longCloses.length / 2)]
    // 約60営業日（3か月）後の予測変化率
    const projectedChangePct = midPrice > 0 ? (longSlope * 60) / midPrice * 100 : 0

    const shortCloses = allPrices.slice(-Math.min(20, allPrices.length)).map(p => p.close)
    const isShortUp = linearRegressionSlope(shortCloses) > 0
    const isLongUp = projectedChangePct > 2
    const isLongDown = projectedChangePct < -2

    let outlook, text
    if (lastRSI !== null && lastRSI < 28) {
      outlook = 'LIKELY_UP'
      text = `RSIが${lastRSI.toFixed(0)}と極端な売られ過ぎ水準にあります。大幅な下落の反動として、3か月後には反発・上昇する可能性があります。`
    } else if (lastRSI !== null && lastRSI > 72) {
      outlook = 'LIKELY_DOWN'
      text = `RSIが${lastRSI.toFixed(0)}と買われ過ぎの過熱水準にあります。3か月後は利益確定売りによる調整・下落となる可能性があります。`
    } else if (isLongUp && isShortUp) {
      outlook = 'LIKELY_UP'
      text = `直近・長期ともに上昇基調が継続しており、3か月後もさらなる上昇が見込まれます。`
    } else if (isLongUp && !isShortUp) {
      outlook = 'LIKELY_UP'
      text = `直近は下降局面ですが、長期トレンドは上向きを維持しています。3か月後には調整一巡後の回復・上昇の可能性があります。`
    } else if (isLongDown && isShortUp) {
      outlook = 'UNCERTAIN'
      text = `直近は反発上昇中ですが、長期的な下降トレンドが続いています。3か月後も軟調な展開となるリスクがあります。`
    } else if (isLongDown && !isShortUp) {
      outlook = 'LIKELY_DOWN'
      text = `直近・長期ともに下降基調が続いており、3か月後も下落圧力が続く可能性があります。底打ちの兆候が見えるまで注意が必要です。`
    } else if (score > 0) {
      outlook = 'UNCERTAIN'
      text = `明確なトレンドは見られませんが、短期指標はやや上向きです。3か月後は小幅な上昇となる可能性があります。`
    } else {
      outlook = 'UNCERTAIN'
      text = `明確なトレンドが読み取りにくい状況です。3か月後の方向性は不透明で、様子見が無難かもしれません。`
    }
    forecast = { outlook, text, projectedChangePct: +projectedChangePct.toFixed(1) }
  }

  return {
    direction,
    confidence,
    score,
    lastClose,
    ma5: lastMA5 != null ? +lastMA5.toFixed(2) : null,
    ma20: lastMA20 != null ? +lastMA20.toFixed(2) : null,
    rsi: lastRSI != null ? +lastRSI.toFixed(1) : null,
    signals,
    chartData,
    forecast,
  }
}
