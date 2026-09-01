# level-recommendation Specification

## Purpose
TBD - created by archiving change add-level-recommendation. Update Purpose after archive.

## Requirements

### Requirement: 依上月完成率推薦下月階梯
系統 SHALL 依學員上月完成率，推薦「能穩穩達標的最高階」作為下月階梯建議：上月完成率 ≥80% → 黃金；70–79% → 白銀；<70% → 青銅。推薦以 `LEVEL_THRESHOLDS` 的門檻對照，取完成率所能達標的最高階，MUST NOT 推薦完成率達不到門檻的階（避免建議必被罰的階）。

#### Scenario: 高完成率推黃金
- **WHEN** 上月完成率 ≥ 80%
- **THEN** 建議黃金

#### Scenario: 中完成率推白銀
- **WHEN** 上月完成率介於 70–79%
- **THEN** 建議白銀（他做到白銀水準，非盲目推更高的黃金）

#### Scenario: 低完成率推青銅
- **WHEN** 上月完成率 < 70%
- **THEN** 建議青銅（含 <60% 者，先站穩）

---

### Requirement: 無上月資料與豁免不推薦
無上月完成率資料（新進、剝選、或上月豁免不計分 `max_score<=0`）的學員，系統 MUST NOT 顯示推薦階，改顯「首月自由選」之類提示。MUST NOT 將豁免者的 rate=0 誤判為「完成率 0% → 青銅」。

#### Scenario: 新進無資料
- **WHEN** 學員無上月已月結資料
- **THEN** 不顯推薦，顯「首月自由選」

#### Scenario: 上月豁免不計分
- **WHEN** 上月 monthly_summary 為豁免 stub（max_score<=0）
- **THEN** 視為無有效資料，不推薦，MUST NOT 因 rate=0 建議青銅

---

### Requirement: 成長文案（依情境）
推薦 SHALL 附一句情境化文案，體現「循序成長」而非評判：
- **升階**（建議階高於現階）：鼓勵挑戰語（如「上月 X%，可挑戰黃金」）。
- **維持**（建議階等於現階）：肯定穩定語（如「上月 X%，穩住白銀」）。
- **青銅站穩**（建議青銅且離白銀有距離）：給成長方向（如「離白銀差 Y%，穩住這月、下月衝」）。
- **降階**（建議階低於現階）：婉轉措辭（如「先把基礎打穩」），MUST NOT 使用「退步／降級」等評判字眼。

#### Scenario: 升階鼓勵
- **WHEN** 建議階高於學員現階
- **THEN** 文案為鼓勵挑戰語氣

#### Scenario: 降階婉轉
- **WHEN** 建議階低於學員現階
- **THEN** 文案為建設性語氣（打穩基礎），不含「退步／降級」字眼

---

### Requirement: 標建議但三階可選
推薦 MUST 於既有下月階梯選擇區呈現，於建議的那一階標示「建議」，但三階選項 MUST 全部維持可選——推薦為引導，MUST NOT 限制或鎖定學員只能選建議階。

#### Scenario: 建議階可被覆蓋
- **WHEN** 系統建議白銀，學員選了黃金
- **THEN** 系統接受學員的選擇，不阻擋

#### Scenario: 只標建議不展開預估
- **WHEN** 顯示推薦
- **THEN** 標建議階 + 一句理由；MUST NOT 堆疊各階達標機率／罰金預估等展開資訊
