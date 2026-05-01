#!/usr/bin/env python3
"""
舊紀錄 work_hours=NULL 的 backfill：
- tasks[4]=true 且 work_hours=NULL → 設為 8（推測值，與 settlement fallback 邏輯一致）
- tasks[4]=false 不動（NULL 與 0 在統計上等價）

Settlement 已有 fallback（lib/settlement.ts:78），所以分數計算不受影響；
此 backfill 僅讓畫面「本月工時」統計正確、減少未來判斷分支。

Dry-run 為預設；加 --apply 才實際 PATCH。
"""

import json
import sys
import urllib.request
from collections import defaultdict
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

    req = urllib.request.Request(
        f'{url}/rest/v1/checkin_records?select=id,member_id,date,tasks,work_hours&work_hours=is.null&order=member_id,date&limit=100000',
        headers=headers,
    )
    with urllib.request.urlopen(req) as r:
        records = json.loads(r.read())

    members_req = urllib.request.Request(
        f'{url}/rest/v1/members?select=id,name',
        headers=headers,
    )
    with urllib.request.urlopen(members_req) as r:
        members = json.loads(r.read())
    name_by_id = {m['id']: m['name'] for m in members}

    # 篩 tasks[4]=true 且 work_hours 為 NULL
    targets = [r for r in records if r['tasks'][4] is True]

    print('═' * 60)
    print(f'  work_hours backfill（NULL 紀錄共 {len(records)} 筆，其中 tasks[4]=true 為 {len(targets)} 筆）')
    print('═' * 60)

    if not targets:
        print('✓ 無需修正')
        return

    by_member = defaultdict(int)
    for r in targets:
        by_member[name_by_id.get(r['member_id'], r['member_id'])] += 1
    for name, n in sorted(by_member.items(), key=lambda x: -x[1]):
        print(f'  {name}: {n} 筆')

    print()
    if not apply_changes:
        print('（Dry-run）加 --apply 即實際寫入 work_hours=8')
        return

    print(f'\n▶ 開始寫入…')
    ok = 0
    for r in targets:
        body = json.dumps({'work_hours': 8}).encode()
        patch_req = urllib.request.Request(
            f'{url}/rest/v1/checkin_records?id=eq.{r["id"]}',
            data=body,
            headers=headers,
            method='PATCH',
        )
        try:
            with urllib.request.urlopen(patch_req):
                pass
            ok += 1
        except urllib.error.HTTPError as e:  # noqa: F821
            name = name_by_id.get(r['member_id'], r['member_id'])
            print(f'  ✗ {name} {r["date"]}: {e.code} {e.reason}')
    print(f'\n✓ 完成 {ok}/{len(targets)} 筆')


if __name__ == '__main__':
    main()
