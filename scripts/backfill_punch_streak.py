#!/usr/bin/env python3
"""
重算所有成員的 punch_streak。

邏輯（與 app/api/checkin/submit/route.ts 一致）：
- tasks[1] = false → streak = 0
- tasks[1] = true：
    - 若前一個「日曆日」有紀錄且該紀錄 punch_streak > 0 → streak = prev.punch_streak + 1
    - 否則（含跨日 gap、前一日沒打拳）→ streak = 1

Dry-run 為預設；加 --apply 才實際 PATCH。
"""

import json
import sys
import urllib.request
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ENV_PATH = Path(__file__).parent.parent / '.env.local'


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

    # 撈所有紀錄
    req = urllib.request.Request(
        f'{url}/rest/v1/checkin_records?select=id,member_id,date,tasks,punch_streak&order=member_id,date&limit=100000',
        headers=headers,
    )
    with urllib.request.urlopen(req) as r:
        records = json.loads(r.read())

    members_req = urllib.request.Request(
        f'{url}/rest/v1/members?select=id,name&order=id',
        headers=headers,
    )
    with urllib.request.urlopen(members_req) as r:
        members = json.loads(r.read())
    name_by_id = {m['id']: m['name'] for m in members}

    # 依 member 分組，已按 date 排序
    by_member = defaultdict(list)
    for r in records:
        by_member[r['member_id']].append(r)

    fixes = []  # (id, member, date, old, new)
    for mid, recs in by_member.items():
        prev_date = None
        prev_streak = 0
        for r in recs:
            d = r['date']
            tasks = r['tasks']
            current = r['punch_streak'] or 0

            if not tasks[1]:
                expected = 0
            elif prev_date and (date.fromisoformat(d) - date.fromisoformat(prev_date)).days == 1 and prev_streak > 0:
                expected = prev_streak + 1
            else:
                expected = 1

            if current != expected:
                fixes.append((r['id'], name_by_id.get(mid, mid), d, current, expected))

            prev_date = d
            prev_streak = expected

    print('═' * 60)
    print(f'  punch_streak 重算（{len(records)} 筆紀錄掃描完成）')
    print('═' * 60)
    if not fixes:
        print('✓ 全部一致，無需修正')
        return

    print(f'發現 {len(fixes)} 筆需修正：\n')
    by_member_count = defaultdict(int)
    for _, name, _, _, _ in fixes:
        by_member_count[name] += 1
    for name, n in sorted(by_member_count.items(), key=lambda x: -x[1]):
        print(f'  {name}: {n} 筆')

    print()
    if not apply_changes:
        print('（Dry-run）加 --apply 即實際寫入')
        return

    print(f'\n▶ 開始寫入…')
    ok = 0
    for rid, name, d, old, new in fixes:
        body = json.dumps({'punch_streak': new}).encode()
        patch_req = urllib.request.Request(
            f'{url}/rest/v1/checkin_records?id=eq.{rid}',
            data=body,
            headers=headers,
            method='PATCH',
        )
        try:
            with urllib.request.urlopen(patch_req):
                pass
            ok += 1
        except urllib.error.HTTPError as e:  # noqa: F821
            print(f'  ✗ {name} {d}: {e.code} {e.reason}')
    print(f'\n✓ 完成 {ok}/{len(fixes)} 筆')
    print('\n下一步：到 admin 後台跑「重算成就」（POST /api/admin/backfill-achievements），')
    print('       讓 T*_STREAK_* 連續成就重新發放遺漏的部分。')


if __name__ == '__main__':
    main()
