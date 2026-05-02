## ADDED Requirements

### Requirement: 送出夥伴邀請
成員 SHALL 能搜尋其他成員姓名並送出邀請。系統 SHALL 以 `partner_requests(requester_id, target_id)` UNIQUE 約束防止重複邀請。送出邀請後，若對方已先邀請自己，系統 SHALL 回傳 409 並提示「對方已邀請你，請至邀請管理頁接受」。每位成員 SHALL 最多保有 20 個待發出邀請。

#### Scenario: 成功送出邀請
- **WHEN** 成員 A 對尚無夥伴關係的成員 B 送出邀請
- **THEN** `partner_requests` 新增一筆 `status='pending'` 記錄，API 回傳 200

#### Scenario: 重複邀請被拒
- **WHEN** 成員 A 對已有 pending 邀請的成員 B 再次送出邀請
- **THEN** DB UNIQUE 約束觸發，API 回傳 409

#### Scenario: 對方已先邀請我
- **WHEN** 成員 B 已邀請 A（pending），A 嘗試邀請 B
- **THEN** API 偵測到反向 pending 記錄，回傳 409 + 提示接受邀請

#### Scenario: 超過待發邀請上限
- **WHEN** 成員已有 20 筆 pending 邀請，嘗試再送出
- **THEN** API 回傳 400，拒絕邀請

---

### Requirement: 接受或拒絕邀請
被邀請方 SHALL 能接受或拒絕收到的邀請。接受時，系統 SHALL 檢查雙方現有夥伴數（已接受的關係），若任一方超過 10 人則拒絕並回傳 400。

#### Scenario: 成功接受邀請
- **WHEN** 成員 B 接受 A 的邀請，且雙方夥伴數均未達 10 人
- **THEN** `partner_requests.status` 更新為 `'accepted'`，雙方夥伴清單互相出現對方

#### Scenario: 夥伴數已達上限時接受
- **WHEN** 成員 B 已有 10 位夥伴，嘗試接受新邀請
- **THEN** API 回傳 400，status 不變

#### Scenario: 拒絕邀請
- **WHEN** 成員 B 拒絕 A 的邀請
- **THEN** `partner_requests.status` 更新為 `'rejected'`，A 的待發邀請清單移除該筆

---

### Requirement: 解除夥伴關係
成員 SHALL 能主動解除任一夥伴關係。解除後雙方夥伴清單立即移除對方。

#### Scenario: 成功解除
- **WHEN** 成員 A 呼叫 DELETE `/api/partners/[id]`（id 為 partner_requests.id）
- **THEN** 該記錄從 `partner_requests` 刪除，雙方清單不再顯示對方

#### Scenario: 非關係成員嘗試解除
- **WHEN** 成員 C 嘗試刪除 A 與 B 之間的關係
- **THEN** API 驗證失敗，回傳 403

---

### Requirement: 查詢待處理邀請
成員 SHALL 能查看自己送出（pending）及收到（pending）的所有邀請清單。

#### Scenario: 取得邀請清單
- **WHEN** 成員呼叫 GET `/api/partners/invitations`
- **THEN** 回傳 `{ sent: [...], received: [...] }`，各含對方姓名與邀請時間
