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

  // 1か月後の見通し（線形回帰による長期トレンド分析）
  let forecast = null
  const longData = allPrices.slice(-Math.min(90, allPrices.length))
  if (longData.length >= 20) {
    const longCloses = longData.map(p => p.close)
    const longSlope = linearRegressionSlope(longCloses)
    const midPrice = longCloses[Math.floor(longCloses.length / 2)]
    // 約20営業日（1か月）後の予測変化率
    const projectedChangePct = midPrice > 0 ? (longSlope * 20) / midPrice * 100 : 0

    const shortCloses = allPrices.slice(-Math.min(20, allPrices.length)).map(p => p.close)
    const isShortUp = linearRegressionSlope(shortCloses) > 0
    const isLongUp = projectedChangePct > 2
    const isLongDown = projectedChangePct < -2

    let outlook, text
    if (lastRSI !== null && lastRSI < 28) {
      outlook = 'LIKELY_UP'
      text = `この株は最近、売られすぎの状態にあります（RSI: ${lastRSI.toFixed(0)}）。売られすぎた後は値段が戻ることが多いため、1か月後には値上がりする可能性があります。ただし、あくまで参考の目安です。`
    } else if (lastRSI !== null && lastRSI > 72) {
      outlook = 'LIKELY_DOWN'
      text = `この株は最近、買われすぎの状態にあります（RSI: ${lastRSI.toFixed(0)}）。買われすぎると、利益を確定しようとする売りが増えることが多く、1か月後には値下がりする可能性があります。ただし、あくまで参考の目安です。`
    } else if (isLongUp && isShortUp) {
      outlook = 'LIKELY_UP'
      text = `最近も、長い目でみても値段が上がり続けています。このまま上がる流れが続けば、1か月後もさらに値上がりする可能性があります。`
    } else if (isLongUp && !isShortUp) {
      outlook = 'LIKELY_UP'
      text = `最近は少し値下がりしていますが、長い目でみると上がる流れが続いています。一時的な値下がりの後、1か月後には値段が回復して上がる可能性があります。`
    } else if (isLongDown && isShortUp) {
      outlook = 'UNCERTAIN'
      text = `最近は少し値上がりしていますが、長い目でみると値下がりの流れが続いています。1か月後も値段が下がるリスクがあるため、注意が必要です。`
    } else if (isLongDown && !isShortUp) {
      outlook = 'LIKELY_DOWN'
      text = `最近も、長い目でみても値段が下がり続けています。1か月後も引き続き値下がりする可能性があります。投資する場合は十分に慎重に判断してください。`
    } else if (score > 0) {
      outlook = 'UNCERTAIN'
      text = `はっきりした値動きのパターンは見られませんが、短期的な指標はやや上向きです。1か月後は小幅に値上がりする可能性があります。`
    } else {
      outlook = 'UNCERTAIN'
      text = `はっきりした値動きのパターンが見られず、1か月後の動きを予測しにくい状況です。もう少し様子を見てから判断するのもよいかもしれません。`
    }
    // RSI詳細説明（基準・この株の値・結論の3項目）
    let rsiDetail = null
    if (lastRSI !== null) {
      const rsiValue = lastRSI.toFixed(1)
      let rsiLabel, rsiConclusion
      if (lastRSI < 30) {
        rsiLabel = `${rsiValue}（売られすぎ水準）`
        rsiConclusion = '売られすぎの状態が続いた後は値段が戻ることが多く、1か月後は値上がりのチャンスと判断できます。'
      } else if (lastRSI > 70) {
        rsiLabel = `${rsiValue}（買われすぎ水準）`
        rsiConclusion = '買われすぎの状態では、利益を確定しようとする売りが増えやすく、1か月後は値下がりに注意が必要です。'
      } else {
        rsiLabel = `${rsiValue}（適正水準）`
        rsiConclusion = '過熱感も売られすぎ感もなく、現時点ではRSIからの強い売買シグナルはありません。'
      }
      rsiDetail = {
        standard: 'RSIは0〜100の数値で、株が「売られすぎ」か「買われすぎ」かを示す指標です。一般的に30以下で売られすぎ（割安の可能性）、70以上で買われすぎ（割高の可能性）と判断します。',
        value: rsiLabel,
        conclusion: rsiConclusion,
      }
    }
    forecast = { outlook, text, projectedChangePct: +projectedChangePct.toFixed(1), rsiDetail }
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
