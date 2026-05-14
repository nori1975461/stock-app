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

// 直近3日平均 vs 過去20日平均（1日の異常値に左右されない安定版）
function calcRelativeVolumeStable(volumes, recentDays = 3, period = 20) {
  const n = volumes.length
  if (n < recentDays + period + 1) return null
  const recentSlice = volumes.slice(n - recentDays, n).filter(v => v > 0)
  if (recentSlice.length === 0) return null
  const recentAvg = recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length
  const histSlice = volumes.slice(n - recentDays - period, n - recentDays).filter(v => v > 0)
  if (histSlice.length < 5) return null
  const histAvg = histSlice.reduce((a, b) => a + b, 0) / histSlice.length
  return histAvg > 0 ? recentAvg / histAvg : null
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

// ── 初速判定（Initial Velocity）──────────────────────────────────────────────
// CT理論：トレンド開始時の最初の2日間の速度でそのトレンドの持続力を予測する
// 速いスタートダッシュ = 機関投資家の本格参入 = 持続力が高い
function calcInitialVelocity(closes, volumes, lookback = 25) {
  const n = closes.length
  if (n < 10) return null

  // 現在のトレンド方向（直近10日比較）
  const windowSize = Math.min(10, n - 1)
  const currentDir = closes[n - 1] > closes[n - 1 - windowSize] ? 1 : -1

  // ピボット（トレンド開始点）を探索
  // 上昇トレンド → 直近lookback日の最安値、下降トレンド → 最高値
  // 末尾3バー以内は除外（初速測定に2日分が必要）
  const searchFrom = Math.max(0, n - lookback)
  const searchTo   = n - 3
  if (searchTo <= searchFrom) return null

  let pivotIdx   = searchFrom
  let pivotClose = closes[searchFrom]

  if (currentDir === 1) {
    // 上昇トレンド：最も安い日を探す（同値なら後ろ優先）
    for (let i = searchFrom; i <= searchTo; i++) {
      if (closes[i] <= pivotClose) { pivotClose = closes[i]; pivotIdx = i }
    }
  } else {
    // 下降トレンド：最も高い日を探す（同値なら後ろ優先）
    for (let i = searchFrom; i <= searchTo; i++) {
      if (closes[i] >= pivotClose) { pivotClose = closes[i]; pivotIdx = i }
    }
  }

  const daysAfterPivot = (n - 1) - pivotIdx
  if (daysAfterPivot < 2) return null

  // 初速 = ピボットから2日後の価格変化率
  const earlyClose  = closes[pivotIdx + 2]
  const velocityPct = ((earlyClose - pivotClose) / pivotClose) * 100

  // 方向の整合性チェック（初速の向きが現在のトレンドと一致するか）
  const isAligned = (currentDir === 1 && velocityPct > 0) ||
                    (currentDir === -1 && velocityPct < 0)

  // ピボット直前10日の平均出来高との比（初速時の出来高強度）
  const priorVols    = volumes.slice(Math.max(0, pivotIdx - 10), pivotIdx).filter(v => v > 0)
  const volAvg       = priorVols.length > 0 ? priorVols.reduce((a, b) => a + b, 0) / priorVols.length : 0
  const vol1         = volumes[pivotIdx + 1] || 0
  const vol2         = volumes[pivotIdx + 2] || 0
  const initialVolRatio = volAvg > 0 ? ((vol1 + vol2) / 2) / volAvg : null

  // 速度分類
  const absVel = Math.abs(velocityPct)
  let level
  if      (absVel >= 4.0) level = 'VERY_HIGH'
  else if (absVel >= 2.0) level = 'HIGH'
  else if (absVel >= 0.8) level = 'MEDIUM'
  else                    level = 'LOW'

  return {
    velocityPct:      +velocityPct.toFixed(2),
    level,
    isAligned,
    daysAfterPivot,
    pivotClose:       +pivotClose.toFixed(2),
    initialVolRatio:  initialVolRatio !== null ? +initialVolRatio.toFixed(2) : null,
    currentDir,
  }
}

// ── 2日目確認の法則（Day 2 Confirmation Rule）────────────────────────────────
// CT理論：1日目の動きが翌日も継続すれば信頼度4倍 / 反転は「騙し」シグナル
// Day1 = 前日（n-2 vs n-3）、Day2 = 本日（n-1 vs n-2）
function checkDay2Confirmation(closes, prices) {
  const n = closes.length
  if (n < 3) return null

  const day0Close = closes[n - 3]
  const day1Close = closes[n - 2]
  const day2Close = closes[n - 1]

  // Day1の変化率（close-to-close）
  const day1ChangePct = ((day1Close - day0Close) / day0Close) * 100

  // Day1がシグナル日として有効か（0.8%以上の動き、またはローソク足実体0.8%以上）
  const p1      = prices[n - 2]
  const bodyPct = (p1?.open != null && p1.open !== 0)
    ? Math.abs((p1.close - p1.open) / p1.open * 100) : 0
  const isSignificant = Math.abs(day1ChangePct) >= 0.8 || bodyPct >= 0.8

  if (!isSignificant) {
    return { status: 'NO_SIGNAL', day1ChangePct: +day1ChangePct.toFixed(2) }
  }

  const day1Dir      = day1Close > day0Close ? 1 : -1
  const day2Dir      = day2Close > day1Close ? 1 : -1
  const day2ChangePct = ((day2Close - day1Close) / day1Close) * 100
  const isConfirmed  = day1Dir === day2Dir

  return {
    status:        isConfirmed ? 'CONFIRMED' : 'REJECTED',
    day1Dir,
    day2Dir,
    day1ChangePct: +day1ChangePct.toFixed(2),
    day2ChangePct: +day2ChangePct.toFixed(2),
    isConfirmed,
  }
}

// ── 分散エグジット判断（Distributed Exit Judgment）──────────────────────────
// CT理論：流れ・加速度・ボラティリティの3指標の悪化を1つずつ検知し
// 悪化シグナル1つごとに1/3ずつ段階的に手仕舞いを促すリスク管理手法
function calcExitJudgment(closes, volumes, prices) {
  const n = closes.length
  if (n < 20) return null

  // ──────────────────────────────────────────────────────────────────
  // Signal 1: 流れの悪化（OBV乖離 ＋ 出来高配分の逆転）
  // OBV 20日窓・出来高配分 15日窓に拡張（単日ノイズを除去）
  // 閾値を1.5倍に引き上げ（1.3倍だと通常の揺れでも発動する）
  // ──────────────────────────────────────────────────────────────────
  const priceTrend15 = closes[n - 1] > closes[n - 16] ? 1 : -1
  const obvTrend20   = calcOBVTrend(closes, volumes, 20)

  let upVol = 0, upDays = 0, downVol = 0, downDays = 0
  for (let i = n - 15; i < n; i++) {
    const vol = volumes[i] || 0
    if      (closes[i] > closes[i - 1]) { upVol   += vol; upDays++ }
    else if (closes[i] < closes[i - 1]) { downVol += vol; downDays++ }
  }
  const avgUpVol   = upDays   > 0 ? upVol   / upDays   : 0
  const avgDownVol = downDays > 0 ? downVol / downDays : 0
  // 閾値 1.3→1.5：売り圧力が買いの1.5倍以上で初めて警告
  const volImbalance = avgUpVol > 0 && avgDownVol > avgUpVol * 1.5

  const obvDivergence        = priceTrend15 > 0 && obvTrend20 === 'DOWN'
  const flowDeteriorating    = obvDivergence || volImbalance

  let flowDetail = ''
  if (obvDivergence && volImbalance) {
    flowDetail = `OBV乖離（価格↑・資金フロー↓）＋売り日の出来高が買い日の${(avgDownVol / avgUpVol * 100).toFixed(0)}%→機関投資家が本格的に売りに転じている`
  } else if (obvDivergence) {
    flowDetail = '価格は上昇しているがOBV（資金フロー）が低下→機関投資家が徐々に売り始めている'
  } else if (volImbalance) {
    flowDetail = `売り日の出来高が買い日の${(avgDownVol / avgUpVol * 100).toFixed(0)}%→売り圧力が買い圧力を大幅に上回っている`
  } else {
    flowDetail = '資金フロー正常・出来高配分に異常なし'
  }

  // ──────────────────────────────────────────────────────────────────
  // Signal 2: 加速度の悪化（上昇モメンタムの減速・反転）
  // 8日窓比較に拡張し閾値を強化（1日の小幅下落では発動しない）
  // priorChangePct > 3%・recentChangePct < -1.0% に引き上げ
  // ──────────────────────────────────────────────────────────────────
  const recentChangePct = n >= 9  ? ((closes[n - 1] - closes[n - 9])  / closes[n - 9])  * 100 : 0
  const priorChangePct  = n >= 17 ? ((closes[n - 9] - closes[n - 17]) / closes[n - 17]) * 100 : 0

  // 閾値強化：priorChangePct > 3（旧:1）、recentChangePct < -1.0（旧:-0.5）
  const isDecelerating      = priorChangePct > 3 && recentChangePct < priorChangePct * 0.3
  const isMomentumReversing = priorChangePct > 2 && recentChangePct < -1.0
  const accelerationDeteriorating = isDecelerating || isMomentumReversing

  let accDetail = ''
  if (isMomentumReversing) {
    accDetail = `直前8日 ${priorChangePct > 0 ? '+' : ''}${priorChangePct.toFixed(1)}% → 直近8日 ${recentChangePct.toFixed(1)}%：上昇モメンタムが明確に反転→トレンド終了の可能性`
  } else if (isDecelerating) {
    accDetail = `加速度低下：直前8日 +${priorChangePct.toFixed(1)}% → 直近8日 +${recentChangePct.toFixed(1)}%（${(recentChangePct / priorChangePct * 100).toFixed(0)}%に急減速）`
  } else {
    accDetail = `モメンタム正常（直前8日 ${priorChangePct > 0 ? '+' : ''}${priorChangePct.toFixed(1)}% / 直近8日 ${recentChangePct > 0 ? '+' : ''}${recentChangePct.toFixed(1)}%）`
  }

  // ──────────────────────────────────────────────────────────────────
  // Signal 3: ボラティリティの悪化（日中レンジ拡大 ＋ 規律可能性急落）
  // ATR（日中レンジ）が50%以上拡大 または 規律可能性が20pt以上急低下
  // ──────────────────────────────────────────────────────────────────
  let recentATR = null, priorATR = null
  const hasHL = prices.some(p => p.high != null && p.low != null && p.low > 0)

  if (hasHL) {
    const recentRanges = [], priorRanges = []
    for (let i = n - 5; i < n; i++) {
      if (prices[i]?.high != null && prices[i]?.low != null && prices[i].low > 0)
        recentRanges.push((prices[i].high - prices[i].low) / prices[i].low * 100)
    }
    for (let i = Math.max(0, n - 10); i < n - 5; i++) {
      if (prices[i]?.high != null && prices[i]?.low != null && prices[i].low > 0)
        priorRanges.push((prices[i].high - prices[i].low) / prices[i].low * 100)
    }
    if (recentRanges.length >= 3) recentATR = recentRanges.reduce((a, b) => a + b, 0) / recentRanges.length
    if (priorRanges.length  >= 3) priorATR  = priorRanges.reduce( (a, b) => a + b, 0) / priorRanges.length
  }

  const atrExpanding = recentATR !== null && priorATR !== null && priorATR > 0 && recentATR > priorATR * 1.5

  let recentDisc = null, priorDisc = null
  if (n >= 16) {
    recentDisc = calcDisciplinaryPossibility(closes.slice(n - 8), 7)
    priorDisc  = calcDisciplinaryPossibility(closes.slice(n - 15, n - 7), 7)
  }
  const discDropping = recentDisc !== null && priorDisc !== null && recentDisc < priorDisc - 20

  const volatilityDeteriorating = atrExpanding || discDropping

  let volDetail = ''
  if (atrExpanding && discDropping) {
    volDetail = `ATR拡大（${priorATR?.toFixed(1)}%→${recentATR?.toFixed(1)}%）＋規律可能性急落（${priorDisc?.toFixed(0)}%→${recentDisc?.toFixed(0)}%）→値動きが大幅に荒れている`
  } else if (atrExpanding) {
    volDetail = `日中レンジ（ATR）が${((recentATR / priorATR - 1) * 100).toFixed(0)}%拡大→ボラティリティが上昇中`
  } else if (discDropping) {
    volDetail = `規律可能性が${priorDisc?.toFixed(0)}%→${recentDisc?.toFixed(0)}%に急低下→値動きが不規則になっている`
  } else {
    const atrStr = recentATR != null ? `ATR ${recentATR.toFixed(1)}%` : ''
    const discStr = recentDisc != null ? `規律可能性 ${recentDisc.toFixed(0)}%` : ''
    volDetail = `ボラティリティ安定${atrStr && discStr ? `（${atrStr}・${discStr}）` : ''}`
  }

  // ──────────────────────────────────────────────────────────────────
  // 総合エグジット判定（悪化シグナルの数 = 手仕舞い水準）
  // ──────────────────────────────────────────────────────────────────
  const exitLevel = [flowDeteriorating, accelerationDeteriorating, volatilityDeteriorating]
    .filter(Boolean).length

  const exitRecommendation = ['HOLD', 'EXIT_1_3', 'EXIT_2_3', 'EXIT_ALL'][exitLevel]

  return {
    exitLevel,
    exitRecommendation,
    flow:         { deteriorating: flowDeteriorating,         detail: flowDetail },
    acceleration: { deteriorating: accelerationDeteriorating, detail: accDetail },
    volatility:   { deteriorating: volatilityDeteriorating,   detail: volDetail },
    recentChangePct: +recentChangePct.toFixed(1),
    priorChangePct:  +priorChangePct.toFixed(1),
    recentATR:       recentATR  != null ? +recentATR.toFixed(2)  : null,
    priorATR:        priorATR   != null ? +priorATR.toFixed(2)   : null,
    recentDisc:      recentDisc != null ? +recentDisc.toFixed(0) : null,
    priorDisc:       priorDisc  != null ? +priorDisc.toFixed(0)  : null,
  }
}

// macroAdjust は受け入れるが無視（CT理論はセクターマクロをスコアに含めない）
export function predict(allPrices, days, macroAdjust = null) {
  const n        = allPrices.length
  const closes   = allPrices.map(p => p.close)
  const volumes  = allPrices.map(p => p.volume || 0)
  const hasVolume = volumes.some(v => v > 0)
  const lastClose = closes[n - 1]
  const signals  = []
  let score = 0
  let stableScore = 0  // ランキング用安定スコア（2日目確認・初速を除く7指標）

  // ── 出来高分析（量＋方向）────────────────────────────────
  // 3日平均 vs 過去20日平均で安定化（1日の異常値に左右されない）
  const relativeVolume = hasVolume
    ? (calcRelativeVolumeStable(volumes, 3, 20) ?? calcRelativeVolume(volumes, 20))
    : null
  const priceUp = n >= 2 && closes[n - 1] > closes[n - 2]

  if (relativeVolume !== null) {
    if (relativeVolume > 2.5) {
      score -= 2; stableScore -= 2
      signals.push(`出来高が平均の${relativeVolume.toFixed(1)}倍：急増は反転シグナル（高値つかみのリスク）`)
    } else if (relativeVolume > 1.3 && priceUp) {
      score += 2; stableScore += 2
      signals.push(`出来高${(relativeVolume * 100).toFixed(0)}%で株価上昇：資金が流入している強い買い`)
    } else if (relativeVolume > 1.3 && !priceUp) {
      score -= 1; stableScore -= 1
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
      score += 2; stableScore += 2
      signals.push(`規律可能性 ${disciplinaryPct.toFixed(0)}%：非常に予測しやすい動きをしている`)
    } else if (disciplinaryPct >= 60) {
      score += 1; stableScore += 1
      signals.push(`規律可能性 ${disciplinaryPct.toFixed(0)}%：ある程度の方向感がある`)
    } else if (disciplinaryPct < 40) {
      score -= 2; stableScore -= 2
      signals.push(`規律可能性 ${disciplinaryPct.toFixed(0)}%：値動きがランダムで取引不向き`)
    } else {
      signals.push(`規律可能性 ${disciplinaryPct.toFixed(0)}%：やや不規則な動き`)
    }
  }

  // ── OBV（On Balance Volume）────────────────────────────────
  // 15日窓でノイズを軽減（10日だと1日の外れ値で反転しやすい）
  const obvTrend = hasVolume ? calcOBVTrend(closes, volumes, 15) : 'FLAT'

  if (hasVolume) {
    if (obvTrend === 'UP') {
      score += 1; stableScore += 1
      signals.push('OBV（資金フロー）上昇：大口・機関投資家の買いが継続中')
    } else if (obvTrend === 'DOWN') {
      score -= 1; stableScore -= 1
      signals.push('OBV（資金フロー）下降：大口の資金が流出している')
    } else {
      signals.push('OBV（資金フロー）横ばい：大口の方向感なし')
    }
  }

  // ── 停滞シグナル（上昇後の出来高減少＋価格安定＝強気）──────
  const isStagnating = hasVolume ? detectStagnation(closes, volumes, 5) : false

  if (isStagnating) {
    score += 1; stableScore += 1
    signals.push('停滞シグナル検出：上昇後に出来高が減り価格が安定→売り手不在で上昇継続の可能性')
  }

  // ── マグネット効果（過去高値との位置関係）─────────────────
  const magnetEffect = calcMagnetEffect(closes, 90)

  if (magnetEffect.status === 'NEW_HIGH') {
    score += 2; stableScore += 2
    signals.push(`過去高値を大きく上回る（+${magnetEffect.distancePct}%）：慣性の法則が働き上昇継続しやすい`)
  } else if (magnetEffect.status === 'BREAKOUT') {
    score += 2; stableScore += 2
    signals.push(`過去の壁（高値）を突破（+${magnetEffect.distancePct}%）：次の上昇ステージへの移行シグナル`)
  } else if (magnetEffect.status === 'RESISTANCE') {
    score -= 1; stableScore -= 1
    signals.push(`過去高値（${magnetEffect.historicalHigh}）に接近（${magnetEffect.distancePct}%）：高値の壁（抵抗）に注意`)
  } else if (magnetEffect.distancePct !== null) {
    signals.push(`過去高値より${Math.abs(magnetEffect.distancePct)}%下：上昇には高値の壁を超える必要あり`)
  }

  // ── 連続日数（慣性の法則）─────────────────────────────────
  const trendDays = countTrendDays(closes)

  if (trendDays >= 5) {
    score += 1; stableScore += 1
    signals.push(`${trendDays}日連続上昇：慣性の法則—強いトレンドは続く`)
  } else if (trendDays <= -5) {
    score -= 1; stableScore -= 1
    signals.push(`${Math.abs(trendDays)}日連続下落：下降トレンドが継続中`)
  } else if (trendDays > 0) {
    signals.push(`${trendDays}日連続上昇（勢い確認中）`)
  } else if (trendDays < 0) {
    signals.push(`${Math.abs(trendDays)}日連続下落（反転待ち）`)
  } else {
    signals.push('前日と同値（方向感なし）')
  }

  // ── ローソク足パターン（陽線・陰線の比率）────────────────
  // 10日窓に拡張（5日だと1〜2本の差でスコアが反転しやすい）
  const candle = analyzeCandlePattern(allPrices, 10)

  if (candle.total >= 6) {
    if (candle.bullishCount >= 7) {
      score += 1; stableScore += 1
      signals.push(`直近10本のうち${candle.bullishCount}本が陽線：買い優勢`)
    } else if (candle.bearishCount >= 7) {
      score -= 1; stableScore -= 1
      signals.push(`直近10本のうち${candle.bearishCount}本が陰線：売り優勢`)
    } else {
      signals.push(`直近10本：陽線${candle.bullishCount}本・陰線${candle.bearishCount}本（拮抗）`)
    }
  }

  // ── 初速判定（Initial Velocity）─────────────────────────────
  const initialVelocity = calcInitialVelocity(closes, volumes, 25)

  if (initialVelocity !== null && initialVelocity.isAligned) {
    const iv   = initialVelocity
    const sign = iv.velocityPct > 0 ? '+' : ''
    const velStr = `${sign}${iv.velocityPct}%/2日`

    if (iv.level === 'VERY_HIGH') {
      score += iv.currentDir > 0 ? 2 : -2
      const volNote = iv.initialVolRatio !== null && iv.initialVolRatio > 1.2
        ? `出来高${(iv.initialVolRatio * 100).toFixed(0)}%増を伴い` : ''
      if (iv.currentDir > 0) {
        signals.push(`初速 超高速（${velStr}）：${iv.daysAfterPivot}日前の底から${volNote}急騰スタート→機関投資家の本格参入、トレンド持続力が非常に高い`)
      } else {
        signals.push(`初速 超高速（${velStr}）：急落の出だしが速すぎる→下降トレンドが長引く可能性が高い`)
      }
    } else if (iv.level === 'HIGH') {
      score += iv.currentDir > 0 ? 1 : -1
      if (iv.currentDir > 0) {
        signals.push(`初速 高速（${velStr}）：力強いスタート—上昇トレンドの持続性あり`)
      } else {
        signals.push(`初速 高速（${velStr}）：下落の勢いが強い—反転には時間がかかる可能性`)
      }
    } else if (iv.level === 'MEDIUM') {
      signals.push(`初速 中速（${velStr}）：普通のスタート—トレンドの持続性は中程度`)
    } else {
      score -= 1
      signals.push(`初速 低速（${velStr}）：動き出しが遅い—トレンドが途中で失速する可能性あり`)
    }
  }

  // ── 2日目確認の法則（Day 2 Confirmation Rule）──────────────
  const day2Confirmation = checkDay2Confirmation(closes, allPrices)

  if (day2Confirmation !== null && day2Confirmation.status !== 'NO_SIGNAL') {
    const d    = day2Confirmation
    const d1s  = d.day1ChangePct > 0 ? '+' : ''
    const d2s  = d.day2ChangePct > 0 ? '+' : ''

    if (d.isConfirmed) {
      score += d.day1Dir > 0 ? 2 : -2
      if (d.day1Dir > 0) {
        signals.push(`2日目確認：前日の上昇（${d1s}${d.day1ChangePct}%）が翌日も継続（${d2s}${d.day2ChangePct}%）→CT理論「信頼度4倍」の確定シグナル`)
      } else {
        signals.push(`2日目確認（下落）：前日の下落（${d.day1ChangePct}%）が翌日も継続（${d.day2ChangePct}%）→下降トレンド確定、買いは待機`)
      }
    } else {
      score += d.day1Dir > 0 ? -1 : 1
      if (d.day1Dir > 0) {
        signals.push(`2日目否定：前日上昇したが翌日に反転（${d.day2ChangePct}%）→騙しシグナルの可能性、慎重に`)
      } else {
        signals.push(`2日目否定：前日の下落が翌日に反転（${d2s}${d.day2ChangePct}%）→底打ちの可能性あり`)
      }
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
    const iv = initialVelocity
    const d2 = day2Confirmation

    // CT最強シグナル：初速超高速 + 2日目確認
    if (iv?.level === 'VERY_HIGH' && iv.isAligned && iv.currentDir > 0
        && d2?.isConfirmed && d2.day1Dir > 0) {
      outlook = 'LIKELY_UP'
      text = `初速超高速（${iv.velocityPct > 0 ? '+' : ''}${iv.velocityPct}%/2日）かつ2日目確認済みという「CT理論最強シグナル」が揃っています。トレンド開始時の速度が速く、翌日も継続したことは機関投資家の本格参入を示します。慣性の法則が強く発動しており、1か月後の上昇継続が非常に期待できます。`
    // 騙しシグナル警告：前日上昇→今日反転
    } else if (d2?.status === 'REJECTED' && d2.day1Dir > 0 && score < 4) {
      outlook = 'UNCERTAIN'
      text = `前日の上昇が翌日に否定される「騙しシグナル」が出ています。CLEAR TRADE理論では「2日目に方向が反転した場合、Day1の動きは信頼できない」とします。他のシグナルが強くても、この2日目否定は慎重な姿勢をとるべき警告です。もう数日様子を見てから判断することをお勧めします。`
    } else if (relativeVolume !== null && relativeVolume > 2.5) {
      outlook = 'LIKELY_DOWN'
      text = `出来高が通常の${relativeVolume.toFixed(1)}倍という急増は、CLEAR TRADE理論では「天井シグナル」の一つです。大量の売りが出た後に値段が下がることが多く、1か月後の値下がりに注意が必要です。`
    } else if (isStagnating && score >= 0) {
      outlook = 'LIKELY_UP'
      text = `上昇後に出来高が減り値動きが静まっています。CLEAR TRADE理論では「停滞＝売り手がいない証拠」と解釈します。売り手不在の静かな状態は次の上昇への準備段階であることが多く、1か月後の上昇が期待できます。${iv?.isAligned && iv.currentDir > 0 && iv.level !== 'LOW' ? `初速も${iv.level === 'VERY_HIGH' ? '超高速' : '高速'}でトレンドの持続力も確認できています。` : ''}`
    } else if ((magnetEffect.status === 'NEW_HIGH' || magnetEffect.status === 'BREAKOUT') && obvTrend === 'UP') {
      outlook = 'LIKELY_UP'
      text = `過去の高値の壁を突破し、資金フロー（OBV）も上昇しています。CLEAR TRADE理論では「オールタイムハイ近辺の銘柄を、資金流入を確認して買う」が基本戦略です。慣性の法則により上昇が続く可能性があります。${relativeVolume != null && relativeVolume > 1 ? `出来高も平均の${(relativeVolume * 100).toFixed(0)}%で健全です。` : ''}${d2?.isConfirmed && d2.day1Dir > 0 ? ' さらに2日目確認済みで信頼度が一段と高まっています。' : ''}`
    } else if (disciplinaryPct !== null && disciplinaryPct >= 70 && score > 0) {
      outlook = 'LIKELY_UP'
      text = `規律可能性が${disciplinaryPct.toFixed(0)}%と高く、比較的予測しやすい動きをしています。CLEAR TRADE理論では、予測しやすい銘柄の上昇局面では「慣性の法則」が強く働くとされています。${iv?.isAligned && iv.currentDir > 0 && (iv.level === 'VERY_HIGH' || iv.level === 'HIGH') ? `初速も${iv.level === 'VERY_HIGH' ? '超高速' : '高速'}でトレンドの持続力も確認できています。` : '現在の上昇傾向が続く可能性があります。'}`
    } else if (obvTrend === 'DOWN') {
      outlook = 'LIKELY_DOWN'
      text = `OBV（資金フロー指標）が低下しており、大口・機関投資家の資金が流出しています。CLEAR TRADE理論では「資金の流れが最も重要」とされており、資金が流出している間は上昇が難しい局面です。`
    } else if (disciplinaryPct !== null && disciplinaryPct < 40) {
      outlook = 'UNCERTAIN'
      text = `この株の規律可能性は${disciplinaryPct.toFixed(0)}%と低く、値動きがランダムに近い状態です。CLEAR TRADE理論では「規律可能性の低い銘柄は取引しない」という鉄則があります。1か月後の方向性を予測しにくい状況です。`
    } else if (score >= 4) {
      outlook = 'LIKELY_UP'
      text = `複数のCLEAR TRADE指標が上昇を示しています。${trendDays > 0 ? `${trendDays}日連続上昇で慣性の法則が発動中です。` : ''}${obvTrend === 'UP' ? '資金フロー（OBV）も上昇中で機関投資家の買いが続いています。' : ''}${d2?.isConfirmed && d2.day1Dir > 0 ? '2日目確認も取れており信頼度が高い状態です。' : ''}1か月後も上昇傾向が継続する可能性があります。`
    } else if (score <= -3) {
      outlook = 'LIKELY_DOWN'
      text = `複数のCLEAR TRADE指標が下落リスクを示しています。${trendDays < 0 ? `${Math.abs(trendDays)}日連続下落で下降トレンドが継続中です。` : ''}${iv?.isAligned && iv.currentDir < 0 ? `初速も${iv.level === 'VERY_HIGH' ? '超高速' : '高速'}で下落の勢いが強く、` : ''}1か月後も値下がりが続く可能性があり、購入は見送るか少額にとどめることをお勧めします。`
    } else {
      outlook = 'UNCERTAIN'
      text = `現時点では方向性の判断が難しい局面です。CLEAR TRADE理論では、明確なシグナルが揃うまで待つことが重要です。「規律可能性の高い銘柄を、出来高と方向性が揃うタイミングで買う」という原則に従い、もう少し様子を見てから判断することをお勧めします。`
    }

    forecast = { outlook, text }
  }

  const exitJudgment = calcExitJudgment(closes, volumes, allPrices)

  return {
    direction,
    confidence,
    score,
    stableScore,
    lastClose,
    relativeVolume:   relativeVolume  !== null ? +relativeVolume.toFixed(2)  : null,
    disciplinaryPct:  disciplinaryPct !== null ? +disciplinaryPct.toFixed(0) : null,
    trendDays,
    obvTrend,
    isStagnating,
    magnetEffect,
    hasVolume,
    lastVolume:       volumes[n - 1] || null,
    initialVelocity,
    day2Confirmation,
    exitJudgment,
    signals,
    chartData,
    forecast,
  }
}
