#!/usr/bin/env python3
"""
取消誤觸月結：刪除指定 year_month 的 monthly_summary 列，讓該月恢復「未結算」狀態
（isMonthSettled() 判斷該成員該月是否已結，依據就是 monthly_summary 有無該列）。

唯讀預覽優先；需加 --apply 才真的刪除。

用法：
  python3 scripts/unsettle_month.py 2026-10                # 預覽：列出該月所有 monthly_summary 列
  python3 scripts/unsettle_month.py 2026-10 --apply         # 刪除該月所有成員的 monthly_summary 列
  python3 scripts/unsettle_month.py 2026-10 --member M001 --apply   # 只刪除單一成員

不影響 checkin_records / achievements / leave_records，只刪 monthly_summary（月結快照），
不會動到該月已打的卡或已請的假。
"""

import json
import sys
import urllib.parse
import urllib.request
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


def request(method, url, headers, path, body=None):
    req = urllib.request.Request(f'{url}/rest/v1{path}', headers=headers, method=method,
                                  data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def main():
    args = sys.argv[1:]
    if not args or args[0].startswith('--'):
        print('用法: python3 scripts/unsettle_month.py <YYYY-MM> [--member M001] [--apply]')
        sys.exit(1)
    year_month = args[0]
    apply = '--apply' in args
    member_id = None
    if '--member' in args:
        member_id = args[args.index('--member') + 1]

    env = load_env(ENV_PATH)
    url = env.get('NEXT_PUBLIC_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（.env.local）')
        sys.exit(1)
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }

    qs = f'year_month=eq.{year_month}&select=id,member_id,year_month,total_score,max_score,rate,passing,penalty,settled_at'
    if member_id:
        qs += f'&member_id=eq.{urllib.parse.quote(member_id)}'
    rows = request('GET', url, headers, f'/monthly_summary?{qs}')

    if not rows:
        print(f'{year_month} 沒有任何 monthly_summary 列（可能本來就未結算，或已經處理過了）')
        return

    names = {}
    member_ids = list({r['member_id'] for r in rows})
    if member_ids:
        in_list = ','.join(urllib.parse.quote(m) for m in member_ids)
        members = request('GET', url, headers, f'/members?id=in.({in_list})&select=id,name')
        names = {m['id']: m['name'] for m in members}

    print(f'{year_month} 月結快照共 {len(rows)} 筆：')
    for r in rows:
        name = names.get(r['member_id'], r['member_id'])
        print(f"  {r['member_id']} {name:8s}  rate={r['rate']}%  penalty=NT${r['penalty']}  settled_at={r.get('settled_at')}")

    if not apply:
        print('\n[預覽模式] 加上 --apply 才會真的刪除這些列，讓該月恢復未結算狀態')
        return

    ids = [r['id'] for r in rows]
    id_list = ','.join(str(i) for i in ids)
    request('DELETE', url, headers, f'/monthly_summary?id=in.({id_list})')
    print(f'\n已刪除 {len(ids)} 筆 {year_month} monthly_summary 列。該月恢復未結算狀態，請假功能應已可正常使用。')
    print('注意：checkin_records / achievements / leave_records 未受影響；月底仍需重新跑正式月結。')


if __name__ == '__main__':
    main()
