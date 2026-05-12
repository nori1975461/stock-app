// CLEAR TRADE理論（Mr.K）に基づく出来高＋純粋チャート分析
// MA/RSI/MACD/ボリンジャー等の従来指標はスコアリングに使用しない

function calcRelativeVolume(volumes, period = 20) {
  const n = volumes.length
  if (n < 2) return null
  const today = volumes[n - 1]
  if (today == null || today === 0) return null
  const history = volumes.slice(Math.max(0, n - 1 - period), n - 1).filter(v => v > 0)
  if (history.length < 3) return null
  const avg = history.reduce((a, b) => a + b, 0) / history.length
  return avg > 0 ? today / avg : null
}

function calcOBV(closes, volumes) {
  const obv = [0]
  for (let i = 1; i < closes.length; i++) {
    const vol = volumes[i] || 0
    if (closes[i] > closes[i - 1])      obv.push(obv[i - 1] + vol)
    else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - vol)
    else                                 obv.push(obv[i - 1])
  }
  return obv
}

function calcOBVTrend(closes, volumes, period = 10) {
  if (closes.length < period + 1) return 'FLAT'
  const obv = calcOBV(closes, volumes)
  const last = obv.length - 1
  const diff = obv[last] - obv[last - period]
  const scale = (Math.abs(obv[last]) + Math.abs(obv[last - period])) / 2 + 1
  const ratio = diff / scale
  if (ratio > 0.03)  return 'UP'
  if (ratio < -0.03) return 'DOWN'
  return 'FLAT'
}

function calcDisciplinaryPossibility(closes, period = 15) {
  const n = closes.length
  if (n < period + 1) return null
  const slice = closes.slice(n - period - 1)
  const overallDir = slice[slice.length - 1] > slice[0] ? 1 : -1
  let aligned = 0
  for (let i = 1; i < slice.length; i++) {
    if ((slice[i] - slice[i - 1]) * overallDir > 0) aligned++
  }
  return (aligned / period) * 100
}

function detectStagnation(closes, volumes, period = 5) {
  const n = closes.length
  if (n < period + 10) return false
  const recentCloses = closes.slice(n - period)
  const max = Math.max(...recentCloses)
  const min = Math.min(...recentCloses)
  if (max === 0 || (max - min) / min * 100 > 3) return false
  const recentVols = volumes.slice(n - period).filter(v => v > 0)
  const priorVols  = volumes.slice(n - period - 10, n - period).filter(v => v > 0)
  if (recentVols.length < 2 || priorVols.length < 3) return false
  const recentAvg = recentVols.reduce((a, b) => a + b, 0) / recentVols.length
  const priorAvg  = priorVols.reduce((a, b) => a + b, 0) / priorVols.length
  if (priorAvg === 0 || recentAvg / priorAvg > 0.65) return false
  const priorCloses = closes.slice(n - period - 10, n - period)
  return closes[n - period] > Math.min(...priorCloses) * 1.02
}

function calcMagnetEffect(closes, lookback = 90) {
  const n = closes.length
  const lastClose = closes[n - 1]
  const history = closes.slice(Math.max(0, n - lookback - 1), n - 1)
  if (history.length < 5) return { status: 'UNKNOWN', distancePct: null, historicalHigh: null }
  const historicalHigh = Math.max(...history)
  const distancePct = ((lastClose - historicalHigh) / historicalHigh) * 100
  let status
  if (distancePct > 3)       status = 'NEW_HIGH'
  else if (distancePct > 0)  status = 'BREAKOUT'
  else if (distancePct > -5) status = 'RESISTANCE'
  else                       status = 'BELOW'
  return { status, distancePct: +distancePct.toFixed(1), historicalHigh: +historicalHigh.toFixed(2) }
}

function countTrendDays(closes) {
  const n = closes.length
  if (n < 2) return 0
  const lastDir = closes[n - 1] > closes[n - 2] ? 1 : closes[n - 1] < closes[n - 2] ? -1 : 0
  if (lastDir === 0) return 0
  let count = 1
  for (let i = n - 2; i > 0; i--) {
    const d = closes[i] > closes[i - 1] ? 1 : closes[i] < closes[i - 1] ? -1 : 0
    if (d === lastDir) count++
    else break
  }
  return lastDir * count
}

function analyzeCandlePattern(prices, period = 5) {
  const recent = prices.slice(-period)
  let bullish = 0, bearish = 0
  for (const p of recent) {
    if (p.open != null && p.close != null) {
      if (p.close > p.open)      bullish++
      else if (p.close < p.open) bearish++
    }
  }
  return { bullishCount: bullish, bearishCount: bearish, total: bullish + bearish }
}

// macroAdjust は受け入れるが無視（CT理論はセクターマクロをスコアに含めない）
export function predict(allPrices, days, macroAdjust = null) {
  const n = allPrices.length
  const closes  = allPrices.map(p => p.close)
  const volumes = allPrices.map(p => p.volume || 0)
  const hasVolume = volumes.some(v => v > 0)
  const lastClose = closes[n - 1]
  const signals = []
  let score = 0

  // ── 出来高分析（量＋方向）────────────────────────────────
  const relativeVolume = hasVolume ? calcRelativeVolume(volumes, 20) : null
  const priceUp = n >= 2 && closes[n - 1] > closes[n - 2]

  if (relativeVolume !== null) {
    if (relativeVolume > 2.5) {
      score -= 2
      signals.push(`出来高が平均の${relativeVolume.toFixed(1)}倍：急増は反転シグナル（高値つかみのリスク）`)
    } else if (relativeVolume > 1.3 && priceUp) {
      score += 2
      signals.push(`出来高${(relativeVolume * 100).toFixed(0)}%で株価上昇：資金が流入している強い買い`)
    } else if (relativeVolume > 1.3 && !priceUp) {
      score -= 1
      signals.push('出来高増加で株価下落：売り圧力が強い')
    } else if (relativeVolume < 0.5) {
      signals.push(`出来高が平均の${(relativeVolume * 100).toFixed(0)}%：売買が少ない（様子見）`)
    } else {
      signals.push(`出来高：平均の${(relativeVolume * 100).toFixed(0)}%（通常水準）`)
    }
  }

  // ── 規律可能性（Disciplinary Possibility）─────────────────
  const disciplinaryPct = calcDisciplinaryPossibility(closes, 15)

  if (disciplinaryPct !== null) {
    if (disciplinaryPct >= 80) {
      score += 2
      signals.push(`規律可能性 ${disciplinaryPct.toFixed(0)}%：非常に予測しやすい動きをしている`)
    } else if (disciplinaryPct >= 60) {
      score += 1
      signals.push(`規律可能性 ${disciplinaryPct.toFixed(0)}%：ある程度の方向感がある`)
    } else if (disciplinaryPct < 40) {
      score -= 2
      signals.push(`規律可能性 ${disciplinaryPct.toFixed(0)}%：値動きがランダムで取引不向き`)
    } else {
      signals.push(`規律可能性 ${disciplinaryPct.toFixed(0)}%：やや不規則な動き`)
    }
  }

  // ── OBV（On Balance Volume）────────────────────────────────
  const obvTrend = hasVolume ? calcOBVTrend(closes, volumes, 10) : 'FLAT'

  if (hasVolume) {
    if (obvTrend === 'UP') {
      score += 1
      signals.push('OBV（資金フロー）上昇：大口・機関投資家の買いが継続中')
    } else if (obvTrend === 'DOWN') {
      score -= 1
      signals.push('OBV（資金フロー）下降：大口の資金が流出している')
    } else {
      signals.push('OBV（資金フロー）横ばい：大口の方向感なし')
    }
  }

  // ── 停滞シグナル（上昇後の出来高減少＋価格安定＝強気）──────
  const isStagnating = hasVolume ? detectStagnation(closes, volumes, 5) : false

  if (isStagnating) {
    score += 1
    signals.push('停滞シグナル検出：上昇後に出来高が減り価格が安定→売り手不在で上昇継続の可能性')
  }

  // ── マグネット効果（過去高値との位置関係）─────────────────
  const magnetEffect = calcMagnetEffect(closes, 90)

  if (magnetEffect.status === 'NEW_HIGH') {
    score += 2
    signals.push(`過去高値を大きく上回る（+${magnetEffect.distancePct}%）：慣性の法則が働き上昇継続しやすい`)
  } else if (magnetEffect.status === 'BREAKOUT') {
    score += 2
    signals.push(`過去の壁（高値）を突破（+${magnetEffect.distancePct}%）：次の上昇ステージへの移行シグナル`)
  } else if (magnetEffect.status === 'RESISTANCE') {
    score -= 1
    signals.push(`過去高値（${magnetEffect.historicalHigh}）に接近（${magnetEffect.distancePct}%）：高値の壁（抵抗）に注意`)
  } else if (magnetEffect.distancePct !== null) {
    signals.push(`過去高値より${Math.abs(magnetEffect.distancePct)}%下：上昇には高値の壁を超える必要あり`)
  }

  // ── 連続日数（慣性の法則）─────────────────────────────────
  const trendDays = countTrendDays(closes)

  if (trendDays >= 5) {
    score += 1
    signals.push(`${trendDays}日連続上昇：慣性の法則—強いトレンドは続く`)
  } else if (trendDays <= -5) {
    score -= 1
    signals.push(`${Math.abs(trendDays)}日連続下落：下降トレンドが継続中`)
  } else if (trendDays > 0) {
    signals.push(`${trendDays}日連続上昇（勢い確認中）`)
  } else if (trendDays < 0) {
    signals.push(`${Math.abs(trendDays)}日連続下落（反転待ち）`)
  } else {
    signals.push('前日と同値（方向感なし）')
  }

  // ── ローソク足パターン（陽線・陰線の比率）────────────────
  const candle = analyzeCandlePattern(allPrices, 5)

  if (candle.total >= 3) {
    if (candle.bullishCount >= 4) {
      score += 1
      signals.push(`直近5本のうち${candle.bullishCount}本が陽線：買い優勢`)
    } else if (candle.bearishCount >= 4) {
      score -= 1
      signals.push(`直近5本のうち${candle.bearishCount}本が陰線：売り優勢`)
    } else {
      signals.push(`直近5本：陽線${candle.bullishCount}本・陰線${candle.bearishCount}本（拮抗）`)
    }
  }

  const direction  = score > 0 ? 'UP' : 'DOWN'
  const confidence = Math.min(50 + Math.abs(score) * 5, 92)

  // ── チャートデータ（出来高バー付き）──────────────────────
  const chartPeriod = Math.max(days, 30)
  const chartSlice  = allPrices.slice(-chartPeriod)
  const chartData   = chartSlice.map(p => ({
    date:   p.date.slice(5),
    price:  p.close,
    volume: p.volume || null,
  }))

  // ── 1か月後の見通し（CLEAR TRADE理論による）────────────────
  let forecast = null
  if (n >= 20) {
    let outlook, text

    if (relativeVolume !== null && relativeVolume > 2.5) {
      outlook = 'LIKELY_DOWN'
      text = `出来高が通常の${relativeVolume.toFixed(1)}倍という急増は、CLEAR TRADE理論では「天井シグナル」の一つです。大量の売りが出た後に値段が下がることが多く、1か月後の値下がりに注意が必要です。`
    } else if (isStagnating && score >= 0) {
      outlook = 'LIKELY_UP'
      text = `上昇後に出来高が減り値動きが静まっています。CLEAR TRADE理論では「停滞＝売り手がいない証拠」と解釈します。売り手が不在の静かな状態は次の上昇への準備段階であることが多く、1か月後の上昇が期待できます。`
    } else if ((magnetEffect.status === 'NEW_HIGH' || magnetEffect.status === 'BREAKOUT') && obvTrend === 'UP') {
      outlook = 'LIKELY_UP'
      text = `過去の高値の壁を突破し、資金フロー（OBV）も上昇しています。CLEAR TRADE理論では「オールタイムハイ近辺の銘柄を、資金流入を確認して買う」が基本戦略です。慣性の法則により上昇が続く可能性があります。${relativeVolume != null && relativeVolume > 1 ? `出来高も平均の${(relativeVolume * 100).toFixed(0)}%で健全です。` : ''}`
    } else if (disciplinaryPct !== null && disciplinaryPct >= 70 && score > 0) {
      outlook = 'LIKELY_UP'
      text = `規律可能性が${disciplinaryPct.toFixed(0)}%と高く、比較的予測しやすい動きをしています。CLEAR TRADE理論では、予測しやすい銘柄の上昇局面では「慣性の法則」が強く働くとされています。現在の上昇傾向が続く可能性があります。`
    } else if (obvTrend === 'DOWN') {
      outlook = 'LIKELY_DOWN'
      text = `OBV（資金フロー指標）が低下しており、大口・機関投資家の資金が流出しています。CLEAR TRADE理論では「資金の流れが最も重要」とされており、資金が流出している間は上昇が難しい局面です。`
    } else if (disciplinaryPct !== null && disciplinaryPct < 40) {
      outlook = 'UNCERTAIN'
      text = `この株の規律可能性は${disciplinaryPct.toFixed(0)}%と低く、値動きがランダムに近い状態です。CLEAR TRADE理論では「規律可能性の低い銘柄は取引しない」という鉄則があります。1か月後の方向性を予測しにくい状況です。`
    } else if (score >= 4) {
      outlook = 'LIKELY_UP'
      text = `複数のCLEAR TRADE指標が上昇を示しています。${trendDays > 0 ? `${trendDays}日連続上昇で慣性の法則が発動中です。` : ''}${obvTrend === 'UP' ? '資金フロー（OBV）も上昇中で機関投資家の買いが続いています。' : ''}1か月後も上昇傾向が継続する可能性があります。`
    } else if (score <= -3) {
      outlook = 'LIKELY_DOWN'
      text = `複数のCLEAR TRADE指標が下落リスクを示しています。${trendDays < 0 ? `${Math.abs(trendDays)}日連続下落で下降トレンドが継続中です。` : ''}1か月後も値下がりが続く可能性があり、購入は見送るか少額にとどめることをお勧めします。`
    } else {
      outlook = 'UNCERTAIN'
      text = `現時点では方向性の判断が難しい局面です。CLEAR TRADE理論では、明確なシグナルが揃うまで待つことが重要です。「規律可能性の高い銘柄を、出来高と方向性が揃うタイミングで買う」という原則に従い、もう少し様子を見てから判断することをお勧めします。`
    }

    forecast = { outlook, text }
  }

  return {
    direction,
    confidence,
    score,
    lastClose,
    relativeVolume:  relativeVolume  !== null ? +relativeVolume.toFixed(2)  : null,
    disciplinaryPct: disciplinaryPct !== null ? +disciplinaryPct.toFixed(0) : null,
    trendDays,
    obvTrend,
    isStagnating,
    magnetEffect,
    hasVolume,
    lastVolume: volumes[n - 1] || null,
    signals,
    chartData,
    forecast,
  }
}
