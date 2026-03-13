/**
 * Calculates Estimated 1-Rep Max (e1RM) using the Epley formula
 * e1RM = Weight × (1 + 0.0333 × Reps)
 * Works best for reps ≤ 12.
 */
export function calculateEpley1RM(weight, reps) {
    if (!weight || weight <= 0)
        return 0;
    if (!reps || reps <= 0)
        return 0;
    if (reps === 1)
        return weight;
    return weight * (1 + 0.0333 * reps);
}
export function analyzeProgression(historySets) {
    if (!historySets || historySets.length === 0)
        return [];
    const sessionsMap = new Map();
    for (const set of historySets) {
        if (!sessionsMap.has(set.date)) {
            sessionsMap.set(set.date, {
                date: set.date,
                sets: [],
                maxE1rm: 0,
                volumeLoad: 0,
                maxReps: 0,
                totalReps: 0,
            });
        }
        const session = sessionsMap.get(set.date);
        session.sets.push(set);
        const e1rm = calculateEpley1RM(set.weight, set.reps);
        if (e1rm > session.maxE1rm) {
            session.maxE1rm = e1rm;
        }
        session.volumeLoad += (set.weight * set.reps);
        session.totalReps += set.reps;
        if (set.reps > session.maxReps) {
            session.maxReps = set.reps;
        }
    }
    // Convert map to sorted array (oldest to newest)
    return Array.from(sessionsMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
/**
 * Detects signs of injury or regression by comparing recent sessions.
 * Returns an object with detection flags and percentage changes.
 *
 * Heuristics (based on strength & conditioning literature):
 *  - e1RM drop ≥ 10%  → likely pain / injury / extended layoff
 *  - Volume drop ≥ 20% → fatigue accumulation, possible overtraining or injury avoidance
 *  - Consecutive session drops → sustained regression trend
 */
export function detectRegression(analyzedSessions) {
    if (analyzedSessions.length < 2) {
        return { detected: false, e1rmChange: 0, volumeChange: 0, sustained: false };
    }
    const last = analyzedSessions[analyzedSessions.length - 1];
    const prev = analyzedSessions[analyzedSessions.length - 2];
    const e1rmChange = prev.maxE1rm > 0
        ? ((last.maxE1rm - prev.maxE1rm) / prev.maxE1rm) * 100
        : 0;
    const volumeChange = prev.volumeLoad > 0
        ? ((last.volumeLoad - prev.volumeLoad) / prev.volumeLoad) * 100
        : 0;
    const E1RM_DROP_THRESHOLD = -10; // ≥ 10% drop
    const VOLUME_DROP_THRESHOLD = -20; // ≥ 20% drop
    const e1rmDrop = e1rmChange <= E1RM_DROP_THRESHOLD;
    const volumeDrop = volumeChange <= VOLUME_DROP_THRESHOLD;
    const detected = e1rmDrop || volumeDrop;
    // Check if the drop is sustained across 3+ sessions
    let sustained = false;
    if (detected && analyzedSessions.length >= 3) {
        const prevPrev = analyzedSessions[analyzedSessions.length - 3];
        const prevE1rmChange = prevPrev.maxE1rm > 0
            ? ((prev.maxE1rm - prevPrev.maxE1rm) / prevPrev.maxE1rm) * 100
            : 0;
        sustained = prevE1rmChange <= E1RM_DROP_THRESHOLD;
    }
    return {
        detected,
        e1rmDrop,
        volumeDrop,
        e1rmChange: Math.round(e1rmChange * 10) / 10,
        volumeChange: Math.round(volumeChange * 10) / 10,
        sustained,
    };
}
/**
 * Generates an actionable recommendation based on the standard "Double Progression" model,
 * with injury/regression awareness.
 *
 * Priority order:
 *  1. Sustained regression → strongly recommend rest / professional assessment
 *  2. Single-session regression → recommend deload / caution
 *  3. Normal double progression logic
 */
export function generateRecommendation(analyzedSessions, exercise) {
    if (analyzedSessions.length === 0)
        return null;
    // ── Injury / Regression Check ──────────────────────────────────
    const regression = detectRegression(analyzedSessions);
    if (regression.detected) {
        if (regression.sustained) {
            return `⚠️ Sustained performance decline detected (e1RM ${regression.e1rmChange}% over last session). Your strength has been dropping for multiple sessions. This may indicate injury, overtraining, or inadequate recovery. Consider taking a deload week (reduce volume by 40-50%) and consult a professional if you're experiencing pain.`;
        }
        const reasons = [];
        if (regression.e1rmDrop)
            reasons.push(`e1RM dropped ${regression.e1rmChange}%`);
        if (regression.volumeDrop)
            reasons.push(`volume dropped ${regression.volumeChange}%`);
        return `⚠️ Performance regression detected (${reasons.join(', ')}). This could signal fatigue, a minor injury, or coming back from a break. Recommendation: keep the weight the same or reduce by 10-20%, focus on controlled reps, and monitor how your body feels. Do NOT push for progressive overload until performance stabilizes.`;
    }
    // ── Normal Double Progression Logic ────────────────────────────
    const lastSession = analyzedSessions[analyzedSessions.length - 1];
    const topSet = lastSession.sets.reduce((best, current) => {
        if (current.weight > best.weight)
            return current;
        if (current.weight === best.weight && current.reps > best.reps)
            return current;
        return best;
    }, lastSession.sets[0]);
    if ((!topSet || !topSet.weight) && exercise?.equipment !== 'band') {
        return "Keep logging weights to see recommendations.";
    }
    const upperRepTarget = exercise?.equipment === 'band' ? 15 : 12;
    const lowerRepTarget = exercise?.equipment === 'band' ? 10 : 8;
    if (exercise?.equipment === 'band') {
        if (topSet.reps >= upperRepTarget) {
            return `Awesome! You hit ${topSet.reps} reps at Band Level ${topSet.weight || 0}. It's time to progress! For your next session, increase the resistance to the next band level and aim for ${lowerRepTarget} reps.`;
        }
        else if (topSet.reps < lowerRepTarget) {
            return `You hit ${topSet.reps} reps at Band Level ${topSet.weight || 0}. Keep the resistance exactly the same next session and try to push for ${topSet.reps + 1}-${topSet.reps + 2} reps to build capacity.`;
        }
        else {
            return `Solid work hitting ${topSet.reps} reps at Band Level ${topSet.weight || 0}. Keep the resistance the same and try to push closer to ${upperRepTarget} reps next time to master this level!`;
        }
    }
    const standardIncrease = 2.5; // kg
    if (topSet.reps >= upperRepTarget) {
        return `You crushed ${topSet.reps} reps at ${topSet.weight}kg! It's time to apply progressive overload. Increase the weight to ${topSet.weight + standardIncrease}kg next session and aim for ${lowerRepTarget} reps.`;
    }
    else if (topSet.reps < lowerRepTarget) {
        return `You hit ${topSet.reps} reps at ${topSet.weight}kg. Keep the weight exactly the same next session and try to push for ${topSet.reps + 1}-${topSet.reps + 2} reps to build volume capacity.`;
    }
    else {
        return `Solid work hitting ${topSet.reps} reps at ${topSet.weight}kg. You are in the sweet spot. Keep the weight the same and try to push closer to ${upperRepTarget} reps next time!`;
    }
}
