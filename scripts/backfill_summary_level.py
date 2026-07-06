#!/usr/bin/env python3
"""
回填 monthly_summary.level（當月生效階梯快照），並依此校正 passing / penalty。

背景：monthly_summary 原本未存 level，歷史罰金/門檻/顯示只能讀「現在的 members.level」，
一旦成員升降階，歷史月份就會被錯用現在的階梯。本腳本反推每筆 summary 的「當月真實階梯」。

為何連 passing/penalty 一起校正（而非重跑月結）：
  月結 runSettlement 用「現在的 members.level」算罰金，重跑歷史月會再次被現在階梯污染。
  而 rate/total_score 與 level 無關（已由工時修正定案），level 只影響「門檻(passing)」與「罰金」，
  故直接用回填後的 level 就地重算 passing/penalty 最安全，不觸發重跑污染。

反推規則（優先序）：
  1. 未通過月（passing=false 且 penalty>0）：罰金唯一對應 level
       200→黃金戰士、300→白銀戰士、400→青銅戰士（見 lib/constants.ts LEVEL_PENALTIES）
  2. 通過/豁免月（penalty=0，無法從罰金反推）：
       先用同一成員「相鄰較早的已知月」的 level 沿用；
       若整段皆無法反推，fallback 到現在的 members.level。
  3. 手動修正覆蓋（MANUAL_FIX）：明確已知的錯誤，直接指定。
       目前：M003 黃琳貽 2026-06 → 白銀戰士（使用者確認 6 月應為白銀）。

唯讀（dry-run）預設；加 --apply 才實際寫入。使用 .env.local 的 service-role key。
"""

import json
import sys
import urllib.request
from pathlib import Path

ENV_PATH = Path(__file__).parent.parent / '.env.local'

PENALTY_TO_LEVEL = {200: '黃金戰士', 300: '白銀戰士', 400: '青銅戰士'}
# 與 lib/constants.ts 一致
LEVEL_THRESHOLD = {'黃金戰士': 80, '白銀戰士': 70, '青銅戰士': 60}   # rate >= 門檻(%) 即通過
LEVEL_PENALTY   = {'黃金戰士': 200, '白銀戰士': 300, '青銅戰士': 400}  # 未通過罰金

# 明確手動修正：{(member_id, year_month): level}
MANUAL_FIX = {
    ('M003', '2026-06'): '白銀戰士',
    # M028 藍巧憶 4 月：rate 61% 且 passing=True → 門檻必 ≤61%，當時為青銅（60%）。
    # 該月無罰金可反推，且她現在是白銀，故明確指定避免 fallback 猜成白銀。
    ('M028', '2026-04'): '青銅戰士',
}


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


def req(url, headers, path, method='GET', body=None):
    r = urllib.request.Request(f'{url}/rest/v1{path}', headers=headers, method=method)
    if body is not None:
        r.data = json.dumps(body).encode('utf-8')
    with urllib.request.urlopen(r) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None


def main():
    apply = '--apply' in sys.argv
    env = load_env(ENV_PATH)
    url = env.get('NEXT_PUBLIC_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
        sys.exit(1)
    H = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}

    members = {m['id']: m for m in req(url, H, '/members?select=id,name,level')}
    summaries = req(url, H, '/monthly_summary?select=id,member_id,year_month,rate,passing,penalty,level,max_score&order=member_id,year_month')

    by_member = {}
    for s in summaries:
        by_member.setdefault(s['member_id'], []).append(s)

    # updates: dict payload per row，含 level（總是）+ passing/penalty（若因 level 校正而變）
    updates = []      # (id, member_id, ym, old_level, new_level, reason, payload, pen_note)
    for mid, rows in by_member.items():
        rows.sort(key=lambda r: r['year_month'])
        last_known = None
        for s in rows:
            ym = s['year_month']
            manual = MANUAL_FIX.get((mid, ym))
            if manual:
                new_level, reason = manual, 'manual-fix'
            elif not s['passing'] and s['penalty'] in PENALTY_TO_LEVEL:
                new_level, reason = PENALTY_TO_LEVEL[s['penalty']], f'penalty={s["penalty"]}'
            elif last_known:
                new_level, reason = last_known, 'carry-prev'
            else:
                new_level = members.get(mid, {}).get('level')
                reason = 'fallback-now'
            last_known = new_level

            payload = {}
            pen_note = ''
            if s.get('level') != new_level:
                payload['level'] = new_level
            # 依回填後的 level 就地校正 passing/penalty，但僅在「level 有可靠證據」時才動 penalty，
            # 避免用不可靠的猜測階梯回溯性地把某人從通過改成不通過。
            #   - manual-fix / penalty=* : 可靠 → 校正
            #   - carry-prev             : 沿用前月可靠值 → 校正
            #   - fallback-now           : 純猜測 → 只回填 level 供顯示，不動 passing/penalty
            reliable = reason != 'fallback-now'
            if reliable and new_level in LEVEL_THRESHOLD and (s.get('max_score') or 0) > 0:
                exp_pass = float(s['rate']) >= LEVEL_THRESHOLD[new_level]
                exp_pen  = 0 if exp_pass else LEVEL_PENALTY[new_level]
                if bool(s['passing']) != exp_pass:
                    payload['passing'] = exp_pass
                if int(s['penalty']) != exp_pen:
                    payload['penalty'] = exp_pen
                    pen_note = f"  penalty NT${s['penalty']}→NT${exp_pen}"
                    if bool(s['passing']) != exp_pass:
                        pen_note += f"  passing→{exp_pass}"
            if payload:
                updates.append((s['id'], mid, ym, s.get('level'), new_level, reason, payload, pen_note))

    # 報表
    print(f"共 {len(summaries)} 筆 monthly_summary，需更新 {len(updates)} 筆：\n")
    reason_ct = {}
    pen_changes = 0
    for _id, mid, ym, old, new, reason, payload, pen_note in updates:
        reason_ct[reason] = reason_ct.get(reason, 0) + 1
        if 'penalty' in payload:
            pen_changes += 1
        nm = members.get(mid, {}).get('name', mid)
        mark = '  ⚠manual' if reason == 'manual-fix' else ''
        print(f"  {nm:<8}({mid}) {ym}  {old} → {new}  [{reason}]{mark}{pen_note}")
    print(f"\n來源統計：{reason_ct}")
    print(f"其中同時校正 penalty 的列數：{pen_changes}")

    if not apply:
        print("\n（Dry-run）加 --apply 即實際寫入 monthly_summary.level / passing / penalty")
        return

    ok = 0
    for _id, mid, ym, old, new, reason, payload, pen_note in updates:
        req(url, H, f'/monthly_summary?id=eq.{_id}', method='PATCH', body=payload)
        ok += 1
    print(f"\n已更新 {ok} 筆 monthly_summary")


if __name__ == '__main__':
    main()
