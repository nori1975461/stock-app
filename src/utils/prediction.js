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

function calcEMA(prices, period) {
  const k = 2 / (period + 1)
  const result = new Array(prices.length)
  result[0] = prices[0]
  for (let i = 1; i < prices.length; i++) {
    result[i] = prices[i] * k + result[i - 1] * (1 - k)
  }
  return result
}

function calcMACD(prices) {
  if (prices.length < 35) return { macd: null, signal: null, histogram: null, prevHistogram: null }
  const ema12 = calcEMA(prices, 12)
  const ema26 = calcEMA(prices, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i])
  const signalLine = calcEMA(macdLine, 9)
  const last = prices.length - 1
  const macd = macdLine[last]
  const signal = signalLine[last]
  const histogram = macd - signal
  const prevHistogram = last > 0 ? macdLine[last - 1] - signalLine[last - 1] : null
  return { macd, signal, histogram, prevHistogram }
}

function calcBollinger(prices, period = 20) {
  const last = prices.length - 1
  if (last < period - 1) return null
  const slice = prices.slice(last - period + 1, last + 1)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
  const std = Math.sqrt(variance)
  const upper = mean + 2 * std
  const lower = mean - 2 * std
  const position = std > 0 ? ((prices[last] - lower) / (upper - lower)) * 100 : 50
  return { upper, middle: mean, lower, position: Math.max(0, Math.min(100, position)), std }
}

function calcROC(prices, period = 20) {
  const last = prices.length - 1
  if (last < period) return null
  const prev = prices[last - period]
  return prev > 0 ? ((prices[last] - prev) / prev) * 100 : null
}

export function predict(allPrices, days, macroAdjust = null) {
  const recent = allPrices.slice(-Math.max(days, 30))
  const closes = recent.map(p => p.close)
  const allCloses = allPrices.map(p => p.close)

  const ma5 = calcMA(closes, 5)
  const ma20 = calcMA(closes, 20)
  const rsiArr = calcRSI(closes, 14)

  const last = closes.length - 1
  const lastMA5 = ma5[last]
  const lastMA20 = ma20[last]
  const lastRSI = rsiArr[last]
  const lastClose = closes[last]
  const prevClose5 = closes[last - 5] ?? closes[0]

  // 拡張指標（全データで精度向上）
  const macdData = calcMACD(allCloses)
  const bollingerData = calcBollinger(allCloses)
  const roc20 = calcROC(allCloses, 20)

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

  // MACD（トレンドの加速度）
  if (macdData.macd !== null) {
    const bullish = macdData.macd > macdData.signal
    const accelerating = macdData.prevHistogram !== null &&
      (bullish
        ? macdData.histogram > macdData.prevHistogram
        : macdData.histogram < macdData.prevHistogram)
    if (bullish && accelerating) {
      score += 2
      signals.push('MACD強気シグナル：上昇加速中（ヒストグラム拡大）')
    } else if (bullish) {
      score += 1
      signals.push('MACD：買いシグナル（MACDがシグナル線を上回る）')
    } else if (!bullish && accelerating) {
      score -= 2
      signals.push('MACD弱気シグナル：下降加速中（ヒストグラム拡大）')
    } else {
      score -= 1
      signals.push('MACD：売りシグナル（MACDがシグナル線を下回る）')
    }
  }

  // ボリンジャーバンド（割安・割高ゾーン）
  if (bollingerData !== null) {
    const pos = bollingerData.position
    if (pos < 20) {
      score += 1
      signals.push(`ボリンジャーバンド下限付近 ${pos.toFixed(0)}%（割安ゾーン：反発期待）`)
    } else if (pos > 80) {
      score -= 1
      signals.push(`ボリンジャーバンド上限付近 ${pos.toFixed(0)}%（買われすぎゾーン：調整リスク）`)
    } else {
      signals.push(`ボリンジャーバンド中央付近 ${pos.toFixed(0)}%（適正ゾーン）`)
    }
  }

  // 20日モメンタム（上昇の勢い）
  if (roc20 !== null) {
    if (roc20 > 5) {
      score += 1
      signals.push(`20日モメンタム +${roc20.toFixed(1)}%：強い上昇勢い`)
    } else if (roc20 < -5) {
      score -= 1
      signals.push(`20日モメンタム ${roc20.toFixed(1)}%：下降勢い継続`)
    } else {
      signals.push(`20日モメンタム ${roc20 >= 0 ? '+' : ''}${roc20.toFixed(1)}%：中立`)
    }
  }

  // マクロ調整（セクター別AI・経済環境）
  if (macroAdjust) {
    const adj = Math.max(-2, Math.min(2, macroAdjust.score))
    score += adj
    if (adj > 0) signals.push(`マクロ環境【${macroAdjust.sector}】AI・世界経済が追い風（+${adj}）`)
    else if (adj < 0) signals.push(`マクロ環境【${macroAdjust.sector}】向かい風あり（${adj}）`)
    else signals.push(`マクロ環境【${macroAdjust.sector}】影響は中立（0）`)
  }

  const direction = score > 0 ? 'UP' : 'DOWN'
  // スコアレンジ拡大（旧±5→新±11）に合わせて係数調整
  const confidence = Math.min(50 + Math.abs(score) * 4, 92)

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
    macdBullish: macdData.macd !== null ? macdData.macd > macdData.signal : null,
    macdAccel: macdData.histogram !== null && macdData.prevHistogram !== null
      ? (macdData.macd > macdData.signal
          ? macdData.histogram > macdData.prevHistogram
          : macdData.histogram < macdData.prevHistogram)
      : null,
    bollingerPos: bollingerData !== null ? +bollingerData.position.toFixed(1) : null,
    roc20: roc20 !== null ? +roc20.toFixed(1) : null,
    signals,
    chartData,
    forecast,
  }
}
