#!/usr/bin/env python3
"""
打卡紀錄全量掃描：檢查資料一致性、異常值、成就對齊、月結缺口。
唯讀，不寫入任何資料。
"""

import json
import sys
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ENV_PATH = Path(__file__).parent.parent / '.env.local'
TZ_TAIPEI = timezone(timedelta(hours=8))


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


def get(url, headers, path):
    req = urllib.request.Request(f'{url}/rest/v1{path}', headers=headers)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    env = load_env(ENV_PATH)
    url = env.get('NEXT_PUBLIC_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        sys.exit('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 缺失')

    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
    }

    print('▶ 撈取資料中…')
    members  = get(url, headers, '/members?select=id,name,status,join_date,effective_start_date,level&order=id')
    records  = get(url, headers, '/checkin_records?select=id,member_id,date,tasks,base_score,punch_bonus,total_score,punch_streak,work_hours,submit_time&order=member_id,date&limit=100000')
    achs     = get(url, headers, '/achievements?select=member_id,code,unlocked_at')
    summary  = get(url, headers, '/monthly_summary?select=member_id,year_month,passing,is_dawn_king,rate,max_streak')
    today    = datetime.now(TZ_TAIPEI).date().isoformat()

    print(f'  members={len(members)}  records={len(records)}  achs={len(achs)}  summary={len(summary)}\n')

    name_by_id   = {m['id']: m['name'] for m in members}
    active_ids   = {m['id'] for m in members if m['status'] == '活躍'}
    member_by_id = {m['id']: m for m in members}

    recs_by_member = defaultdict(list)
    for r in records:
        recs_by_member[r['member_id']].append(r)
    for mid in recs_by_member:
        recs_by_member[mid].sort(key=lambda r: r['date'])

    achs_by_member = defaultdict(set)
    for a in achs:
        achs_by_member[a['member_id']].add(a['code'])

    issues = defaultdict(list)

    # ─── A. 資料一致性 ──────────────────────────────────────────
    for r in records:
        mid   = r['member_id']
        name  = name_by_id.get(mid, mid)
        d     = r['date']
        tasks = r['tasks']

        # A1：base_score ≠ tasks 計數
        true_count = sum(1 for t in tasks if t)
        if r['base_score'] != true_count:
            issues['A1_base_score_mismatch'].append(
                f'{name} {d}: base_score={r["base_score"]} 但 tasks 有 {true_count} 個 true'
            )

        # A2：total_score ≠ base_score + punch_bonus
        expected_total = r['base_score'] + (r['punch_bonus'] or 0)
        if abs(r['total_score'] - expected_total) > 0.01:
            issues['A2_total_score_mismatch'].append(
                f'{name} {d}: total={r["total_score"]} ≠ base({r["base_score"]}) + bonus({r["punch_bonus"]})'
            )

        # A3：tasks[4] (工作 8 小時) vs work_hours
        wh = r.get('work_hours')
        if tasks[4] is True and (wh is None or wh == 0):
            issues['A3_task4_but_no_hours'].append(
                f'{name} {d}: tasks[4]=true 但 work_hours={wh}'
            )
        if tasks[4] is False and wh is not None and wh > 0:
            issues['A4_hours_but_no_task4'].append(
                f'{name} {d}: tasks[4]=false 但 work_hours={wh}'
            )

        # B1：work_hours 異常
        if wh is not None and (wh < 0 or wh > 24):
            issues['B1_work_hours_out_of_range'].append(
                f'{name} {d}: work_hours={wh}'
            )

        # B2：punch_streak 異常大
        if r['punch_streak'] and r['punch_streak'] > 1000:
            issues['B2_punch_streak_huge'].append(
                f'{name} {d}: punch_streak={r["punch_streak"]}'
            )

        # B3：submit_time 早於打卡日（理論不可能）
        try:
            st = datetime.fromisoformat(r['submit_time'].replace('Z', '+00:00'))
            if st.astimezone(TZ_TAIPEI).date().isoformat() < d:
                issues['B3_submit_before_date'].append(
                    f'{name} {d}: submit_time={r["submit_time"]}'
                )
        except Exception:
            pass

    # ─── A5：punch_streak 連續性 ───────────────────────────────
    for mid, recs in recs_by_member.items():
        prev_streak  = 0
        prev_punched = False
        prev_date    = None
        for r in recs:
            d = r['date']
            tasks = r['tasks']
            cur_streak = r['punch_streak']

            if not prev_date:
                expected = 1 if tasks[1] else 0
            else:
                # 檢查是否「相鄰一日」(prev_date + 1 == d)。非相鄰不檢查（多日 gap 後重新打卡 streak 應為 1）。
                pd = date.fromisoformat(prev_date)
                cd = date.fromisoformat(d)
                gap_days = (cd - pd).days
                if not tasks[1]:
                    expected = 0
                elif gap_days == 1 and prev_punched:
                    expected = prev_streak + 1
                else:
                    expected = 1

            if cur_streak != expected:
                issues['A5_streak_inconsistent'].append(
                    f'{name_by_id[mid]} {d}: streak={cur_streak} 但邏輯應為 {expected}（前日 {prev_date} streak={prev_streak} punched={prev_punched}）'
                )

            prev_date    = d
            prev_streak  = cur_streak
            prev_punched = bool(tasks[1])

    # ─── C. 資料缺口 ──────────────────────────────────────────
    for mid in active_ids:
        m = member_by_id[mid]
        if not recs_by_member.get(mid):
            issues['C1_active_no_records'].append(f'{m["name"]} ({mid})：啟用成員但完全無打卡紀錄')

        # 起算日異常
        es = m.get('effective_start_date') or m.get('join_date')
        if not es:
            issues['C2_no_start_date'].append(f'{m["name"]} ({mid})：effective_start_date 與 join_date 皆 NULL')
        elif es > today:
            issues['C3_future_start_date'].append(f'{m["name"]} ({mid})：起算日 {es} 在今天之後')

    # ─── D. 成就一致性 ────────────────────────────────────────
    PERFECT_TARGETS  = {'PERFECT_10': 10, 'PERFECT_30': 30}
    CHECKIN_TARGETS  = {'CHECKIN_30': 30, 'CHECKIN_100': 100, 'CHECKIN_365': 365}
    STREAK_DAYS      = {3, 7, 30, 100}

    def calc_max_punch_streak(recs):
        m = c = 0
        for r in recs:
            if r['tasks'][1]:
                c += 1
                m = max(m, c)
            else:
                c = 0
        return m

    def calc_max_task_streak(recs, task_idx):
        m = c = 0
        for r in recs:
            if r['tasks'][task_idx]:
                c += 1
                m = max(m, c)
            else:
                c = 0
        return m

    for mid, codes in achs_by_member.items():
        name = name_by_id.get(mid, mid)
        recs = recs_by_member.get(mid, [])
        total = len(recs)
        perfect = sum(1 for r in recs if r['base_score'] == 8)

        # D1：FIRST_CHECKIN 但無紀錄
        if 'FIRST_CHECKIN' in codes and total == 0:
            issues['D1_first_no_records'].append(f'{name}: 有 FIRST_CHECKIN 但無打卡紀錄')

        # D2：CHECKIN_X 但實際數不夠
        for code, target in CHECKIN_TARGETS.items():
            if code in codes and total < target:
                issues['D2_checkin_count_short'].append(f'{name}: 有 {code} 但實際打卡 {total} < {target}')

        # D3：PERFECT_X 但實際大滿貫不夠
        for code, target in PERFECT_TARGETS.items():
            if code in codes and perfect < target:
                issues['D3_perfect_count_short'].append(f'{name}: 有 {code} 但大滿貫 {perfect} < {target}')

        # D4：T*_STREAK_X 但歷史最長不夠
        for task_idx in range(8):
            max_st = calc_max_task_streak(recs, task_idx)
            for days in STREAK_DAYS:
                code = f'T{task_idx + 1}_STREAK_{days}'
                if code in codes and max_st < days:
                    issues['D4_streak_short'].append(
                        f'{name}: 有 {code} 但歷史最長連續 {max_st} < {days}'
                    )

        # D5：殘留已移除的成就
        if 'DAILY_PERFECT_BONUS' in codes:
            issues['D5_orphan_bonus'].append(f'{name}: 殘留 DAILY_PERFECT_BONUS（已從系統移除）')

    # ─── E. 月結與破曉王 ──────────────────────────────────────
    summary_by_member_ym = {(s['member_id'], s['year_month']): s for s in summary}

    for s in summary:
        mid = s['member_id']
        ym  = s['year_month']
        name = name_by_id.get(mid, mid)
        if s.get('is_dawn_king'):
            recs_in_month = [r for r in recs_by_member.get(mid, []) if r['date'].startswith(ym)]
            # 應打卡天數（從 effective_start 或 join_date 起到月底）
            m = member_by_id.get(mid, {})
            es = m.get('effective_start_date') or m.get('join_date')
            ym_first = ym + '-01'
            ym_last  = (date.fromisoformat(ym + '-01').replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
            ym_last_str = ym_last.isoformat()
            eff_start = es if es and es > ym_first else ym_first
            if eff_start > ym_last_str:
                expected = 0
            else:
                expected = (date.fromisoformat(ym_last_str) - date.fromisoformat(eff_start)).days + 1

            if expected == 0:
                issues['E1_dawn_king_exempted'].append(f'{name} {ym}: is_dawn_king 但起算日尚未開始')
            elif len(recs_in_month) < expected:
                issues['E2_dawn_king_missing_days'].append(
                    f'{name} {ym}: is_dawn_king 但實際打卡 {len(recs_in_month)} < 應打卡 {expected}（漏打卡）'
                )
            elif not all(r['tasks'][1] for r in recs_in_month):
                issues['E3_dawn_king_no_punch'].append(f'{name} {ym}: is_dawn_king 但有日子未打拳')

    # 月結缺口：對每位活躍成員、每個過去月份檢查是否有 summary
    months_seen = set()
    for r in records:
        months_seen.add(r['date'][:7])
    current_month = today[:7]
    past_months = sorted(m for m in months_seen if m < current_month)

    for mid in active_ids:
        m = member_by_id[mid]
        es = m.get('effective_start_date') or m.get('join_date')
        if not es:
            continue
        for ym in past_months:
            ym_first = ym + '-01'
            if (es and es > ym_first) and not (es <= ym + '-31'):
                # 起算日晚於該月，可能不參與
                ym_last = (date.fromisoformat(ym + '-01').replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
                if es > ym_last.isoformat():
                    continue
            # 只看在該月有打卡的成員，避免噪音
            has_recs = any(r['date'].startswith(ym) and r['member_id'] == mid for r in recs_by_member.get(mid, []))
            if has_recs and (mid, ym) not in summary_by_member_ym:
                issues['E4_unsettled_month'].append(f'{name_by_id[mid]} {ym}: 有打卡但無 monthly_summary')

    # ─── 輸出報告 ──────────────────────────────────────────────
    print('═' * 60)
    print('  打卡紀錄掃描報告')
    print('═' * 60)

    categories = [
        ('A1_base_score_mismatch',   'A1 base_score ≠ tasks 計數'),
        ('A2_total_score_mismatch',  'A2 total_score ≠ base + bonus'),
        ('A3_task4_but_no_hours',    'A3 tasks[4]=true 但 work_hours=0/null'),
        ('A4_hours_but_no_task4',    'A4 work_hours>0 但 tasks[4]=false'),
        ('A5_streak_inconsistent',   'A5 punch_streak 邏輯不一致'),
        ('B1_work_hours_out_of_range', 'B1 work_hours 超出 [0,24]'),
        ('B2_punch_streak_huge',     'B2 punch_streak > 1000'),
        ('B3_submit_before_date',    'B3 submit_time 早於打卡日'),
        ('C1_active_no_records',     'C1 啟用成員無打卡紀錄'),
        ('C2_no_start_date',         'C2 起算日皆 NULL'),
        ('C3_future_start_date',     'C3 起算日在未來'),
        ('D1_first_no_records',      'D1 有 FIRST_CHECKIN 但無紀錄'),
        ('D2_checkin_count_short',   'D2 累計成就達標數不足'),
        ('D3_perfect_count_short',   'D3 大滿貫成就達標數不足'),
        ('D4_streak_short',          'D4 連續成就歷史最長不足'),
        ('D5_orphan_bonus',          'D5 殘留 DAILY_PERFECT_BONUS'),
        ('E1_dawn_king_exempted',   'E1 破曉王但起算日未開始'),
        ('E2_dawn_king_missing_days','E2 破曉王但漏打卡'),
        ('E3_dawn_king_no_punch',    'E3 破曉王但有日未打拳'),
        ('E4_unsettled_month',       'E4 該月有打卡但未月結'),
    ]

    total_issues = 0
    for code, label in categories:
        items = issues.get(code, [])
        total_issues += len(items)
        if not items:
            print(f'✓ {label}：無')
            continue
        print(f'\n✗ {label}（{len(items)} 筆）')
        for s in items[:20]:
            print(f'    · {s}')
        if len(items) > 20:
            print(f'    … 另有 {len(items) - 20} 筆')

    print('\n' + '═' * 60)
    print(f'  總計 {total_issues} 筆問題')
    print('═' * 60)


if __name__ == '__main__':
    main()
