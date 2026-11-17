#!/usr/bin/env bash
# the whole balance regression: run from anywhere, takes a few minutes
cd "$(dirname "$0")"
echo "## 卡死局面 × 全部政策 / 整局打法"; node sim5.mjs . '{}' -q
echo "## 动态恢复打法"; node adapt.mjs >/dev/null && node adapt_run.mjs .
echo "## 中途局面能否救回 (随机/贪婪/重度贪婪开局)"
for k in random greedy hard; do node traps.mjs . none 2000 $k 2>&1 | grep -v 不变量 | grep -v 前段 | head -1; done
echo "## 随机玩家 (从不潜水)"; node stress.mjs . random 4000
echo "## 机器人玩家 (从不潜水 / 每季潜水)"; node stress.mjs . bots 0 60; SEA=dive node stress.mjs . bots 0 60 | grep '^\['
