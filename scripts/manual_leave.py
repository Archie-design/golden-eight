#!/usr/bin/env python3
"""
管理員特例：手動補一筆過去日期的請假紀錄（繞過 /api/checkin/leave 的
「只能請今日或未來」前端限制）。

正常情況下請假一律走 /api/checkin/leave（擋事後追認過去，防月底看苗頭補請假）；
此腳本僅供管理員對個別「確認是合理漏卡/系統問題」的個案做一次性修正，
不應該、也沒有對應的常駐後台按鈕。每次使用都應該有明確的人為判斷與紀錄。

唯讀預覽優先；需加 --apply 才真的寫入。

用法：
  python3 scripts/manual_leave.py M001 2026-10-22 "大堂課請假"              # 預覽
  python3 scripts/manual_leave.py M001 2026-10-22 "大堂課請假" --apply      # 寫入

reason 必須是 leave_reasons 中 active=true 的既有事由（與 API 行為一致）。
若該日已有 checkin_records，腳本會中止並提示（請假與打卡互斥，需人工決定如何處理）。
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
    if len(args) < 3:
        print('用法: python3 scripts/manual_leave.py <member_id> <YYYY-MM-DD> <reason> [--apply]')
        sys.exit(1)
    member_id, date, reason = args[0], args[1], args[2]
    apply = '--apply' in args

    import re
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', date):
        print(f'日期格式錯誤：{date}')
        sys.exit(1)

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

    # 成員存在性
    members = request('GET', url, headers, f'/members?id=eq.{urllib.parse.quote(member_id)}&select=id,name')
    if not members:
        print(f'找不到成員 {member_id}')
        sys.exit(1)
    name = members[0]['name']

    # reason 必須是 active 事由（與 API 行為一致）
    reasons = request('GET', url, headers, f'/leave_reasons?label=eq.{urllib.parse.quote(reason)}&active=eq.true&select=label')
    if not reasons:
        print(f'「{reason}」不是有效（active）的請假事由')
        sys.exit(1)

    # 互斥檢查：該日若已有打卡紀錄，中止
    checkins = request('GET', url, headers,
                        f'/checkin_records?member_id=eq.{urllib.parse.quote(member_id)}&date=eq.{date}&select=id,total_score')
    if checkins:
        print(f'{name}（{member_id}）{date} 已有打卡紀錄（{checkins[0]["total_score"]} 分），'
              f'請假與打卡互斥，請先人工確認如何處理，腳本中止。')
        sys.exit(1)

    # 既有請假檢查
    existing = request('GET', url, headers,
                        f'/leave_records?member_id=eq.{urllib.parse.quote(member_id)}&date=eq.{date}&select=*')
    if existing:
        print(f'{name}（{member_id}）{date} 已經有請假紀錄了（事由：{existing[0]["reason"]}），無需重複建立。')
        return

    print(f'預覽：將為 {name}（{member_id}）補建 {date} 請假紀錄，事由「{reason}」')
    if not apply:
        print('[預覽模式] 加上 --apply 才會真的寫入')
        return

    request('POST', url, headers, '/leave_records', body={'member_id': member_id, 'date': date, 'reason': reason})
    print(f'已補建：{name}（{member_id}）{date} 請假（{reason}）。該日將從計分分母移除。')


if __name__ == '__main__':
    main()
