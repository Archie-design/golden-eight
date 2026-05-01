#!/usr/bin/env python3
"""
依序重跑所有成員的打卡紀錄，補發遺漏的成就。
邏輯對齊 lib/scoring.ts:calcNewAchievementsFromAggregates。

成就類型：
  - FIRST_CHECKIN          第 1 次打卡
  - DAILY_PERFECT          當日 base_score=8
  - CHECKIN_30/100/365     累計打卡 ≥ target
  - PERFECT_10/30          累計大滿貫 ≥ target
  - T1~T8_STREAK_3/7/30/100 該任務連續天數 ≥ target

Dry-run 為預設；加 --apply 才實際 INSERT。
"""

import json
import sys
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

ENV_PATH = Path(__file__).parent.parent / '.env.local'
STREAK_WINDOW_DAYS = 105

CHECKIN_TARGETS = [(30, 'CHECKIN_30'), (100, 'CHECKIN_100'), (365, 'CHECKIN_365')]
PERFECT_TARGETS = [(10, 'PERFECT_10'), (30, 'PERFECT_30')]
STREAK_DAYS = [3, 7, 30, 100]


def load_env(path):
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, _, v = line.partition('=')
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def calc_task_streak(sorted_recs, task_idx, end_date):
    """從尾端往前數，date 必須連續且 tasks[task_idx]=true"""
    streak = 0
    check_date = end_date
    for r in reversed(sorted_recs):
        if r['date'] != check_date:
            break
        if not r['tasks'][task_idx]:
            break
        streak += 1
        check_date = (date.fromisoformat(check_date) - __import__('datetime').timedelta(days=1)).isoformat()
    return streak


def replay_member(recs):
    """重跑該成員的打卡紀錄，回傳「該不該擁有」的成就 code 集合"""
    should_have = set()
    sorted_recs = sorted(recs, key=lambda r: r['date'])
    total = 0
    perfect = 0

    for i, today in enumerate(sorted_recs):
        total += 1
        if today['base_score'] == 8:
            perfect += 1

        # FIRST_CHECKIN
        if total == 1:
            should_have.add('FIRST_CHECKIN')
        # DAILY_PERFECT
        if today['base_score'] == 8:
            should_have.add('DAILY_PERFECT')

        # 累計
        for tgt, code in CHECKIN_TARGETS:
            if total >= tgt:
                should_have.add(code)
        for tgt, code in PERFECT_TARGETS:
            if perfect >= tgt:
                should_have.add(code)

        # 各任務 streak（限制 105 日視窗）
        window_start_idx = max(0, i - STREAK_WINDOW_DAYS + 1)
        recent = sorted_recs[window_start_idx:i + 1]
        for task_idx in range(8):
            streak = calc_task_streak(recent, task_idx, today['date'])
            for days in STREAK_DAYS:
                if streak >= days:
                    should_have.add(f'T{task_idx + 1}_STREAK_{days}')

    return should_have


def main():
    apply_changes = '--apply' in sys.argv

    env = load_env(ENV_PATH)
    url = env.get('NEXT_PUBLIC_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        sys.exit('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 缺失')

    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    }

    members_req = urllib.request.Request(
        f'{url}/rest/v1/members?select=id,name&order=id',
        headers=headers,
    )
    with urllib.request.urlopen(members_req) as r:
        members = json.loads(r.read())
    name_by_id = {m['id']: m['name'] for m in members}

    recs_req = urllib.request.Request(
        f'{url}/rest/v1/checkin_records?select=member_id,date,tasks,base_score&order=member_id,date&limit=100000',
        headers=headers,
    )
    with urllib.request.urlopen(recs_req) as r:
        records = json.loads(r.read())

    achs_req = urllib.request.Request(
        f'{url}/rest/v1/achievements?select=member_id,code',
        headers=headers,
    )
    with urllib.request.urlopen(achs_req) as r:
        achs = json.loads(r.read())

    by_member = defaultdict(list)
    for r in records:
        by_member[r['member_id']].append(r)

    existing = defaultdict(set)
    for a in achs:
        existing[a['member_id']].add(a['code'])

    to_insert = []
    summary = []
    for mid, recs in by_member.items():
        should = replay_member(recs)
        missing = should - existing[mid]
        if missing:
            for code in missing:
                to_insert.append({'member_id': mid, 'code': code})
            summary.append((name_by_id.get(mid, mid), len(missing), sorted(missing)))

    print('═' * 60)
    print(f'  重算成就（{len(records)} 筆紀錄、{len(members)} 位成員）')
    print('═' * 60)

    if not to_insert:
        print('✓ 全部成就已正確發放，無遺漏')
        return

    print(f'發現 {len(to_insert)} 筆遺漏：\n')
    for name, n, codes in sorted(summary, key=lambda x: -x[1]):
        print(f'  {name}: {n} 筆')
        for code in codes:
            print(f'    + {code}')

    print()
    if not apply_changes:
        print('（Dry-run）加 --apply 即實際 INSERT')
        return

    print(f'\n▶ 開始寫入…')
    body = json.dumps(to_insert).encode()
    insert_req = urllib.request.Request(
        f'{url}/rest/v1/achievements',
        data=body,
        headers=headers,
        method='POST',
    )
    try:
        with urllib.request.urlopen(insert_req):
            print(f'✓ 完成，新增 {len(to_insert)} 筆成就')
    except urllib.error.HTTPError as e:  # noqa: F821
        print(f'✗ INSERT 失敗：{e.code} {e.reason}')
        print(e.read().decode())


if __name__ == '__main__':
    main()
