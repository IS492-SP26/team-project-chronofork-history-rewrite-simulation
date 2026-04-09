# WebSocket API 规范

## 1. 连接与传输

- 协议：WebSocket
- 路径：`/ws`
- 数据格式：JSON
- 通用包结构：

```json
{
  "type": "string",
  "data": {}
}
```

## 2. 初始化与生命周期

1. 前端连接 `/ws` 后，服务端立即发送：
   - `system_init`
   - （若可用）`graph_update`
2. 前端发送 `start_experience` 后，主流程启动。
3. 运行中通过 `stream_token` 增量输出对话文本。
4. Stage1 结束后服务端发送 `stage_update(stage=2)`，进入回溯/干预阶段。

## 3. 关键数据结构

### 3.1 `config`（`system_init.data.config`）

典型字段：

```json
{
  "episode": {
    "emoji": "☢️",
    "title": "Cuban Missile Crisis (1962)",
    "desc": "..."
  },
  "storyline": [
    {
      "title": "...",
      "choice": "None",
      "desc": "..."
    }
  ],
  "cast_data": [
    {
      "name": "John F. Kennedy",
      "title": "U.S. President",
      "desc": "...",
      "avatar": "🇺🇸"
    }
  ],
  "user_role": {
    "name": "...",
    "title": "...",
    "desc": "...",
    "avatar": "..."
  },
  "prompt_lang": "zh"
}
```

说明：`prompt_lang` 由服务端启动参数 `--lang` 注入。

### 3.2 `graph_update.data`

```json
{
  "nodes": [
    {
      "id": "1.0",
      "label_id": "1.0",
      "hover_title": "...",
      "hover_desc": "...",
      "status": "IN_PROGRESS"
    }
  ],
  "edges": [["0.0", "1.0"]],
  "pos": {
    "1.0": [0, -1]
  },
  "edge_label_data": [
    { "x": 0, "y": -1.5, "text": "choice text" }
  ],
  "active_id": "1.0",
  "current_path": ["0.0", "1.0"]
}
```

字段约束：
- `nodes[].status` 取值：`UNFINISHED | IN_PROGRESS | COMPLETED | SUSPENDED`
- `pos` 在 JSON 中为数组坐标 `[x, y]`

## 4. 服务端 -> 前端（Server Push）

| type | data | 说明 |
| --- | --- | --- |
| `system_init` | `{ "config": object, "status": "ready" \| "error_no_config" }` | 建连后的首包 |
| `graph_update` | 见 3.2 | 图结构与当前节点更新 |
| `stage_update` | `{ "stage": 1 \| 2 }` | 当前阶段（观察/干预） |
| `node_update` | `{ "from_id": "2.0", "to_id": "3.0" }` | 节点切换提示；边界值可能为 `start` 或 `end` |
| `agent_thinking` | `{ "agent": "角色名" }` | 某角色即将调用 LLM |
| `stream_token` | `{ "agent": "说话方", "token": "增量文本", "target": "目标角色" }` | 对话流式增量 |
| `input_request` | `{ "msg": "提示语", "from_name": "角色名" }` | 请求用户输入 |
| `facilitator_stream` | `{ "token": "增量文本或<END>" }` | 并行反思流；`<END>` 表示一段结束 |
| `complete_history_review` | `{}` | Stage2 历史回放结束分隔信号 |
| `action_update` | 动态结构（见下） | 动作状态通知 |
| `enable_reflection` | `{}` | 可请求导出 Reflection 报告 |
| `reflection_report` | `{ "report": "<html...>" }` | Reflection HTML |
| `save_complete` | `{ "filename": "saves/xx.json", "json_content": "{...}" }` | 导出存档完成 |
| `tip_data` | 见 4.2 | 回复建议生成成功 |
| `tip_error` | `{ "msg": "错误信息" }` | 回复建议生成失败 |

### 4.1 `action_update.data`

```json
{ "action": "backtrack_complete", "new_node_id": "2.1", "new_role": "John F. Kennedy" }
```

```json
{ "action": "divergence_in_progress" }
```

```json
{ "action": "divergence_complete", "report": "<html...>" }
```

### 4.2 `tip_data.data`

```json
{
  "situation_analysis": "一句话局势判断",
  "options": [
    {
      "label": "短标签",
      "target_agent": "目标角色名（cast 内精确名字，且非用户）",
      "example_response": "建议台词",
      "rationale": "收益/动机",
      "risks": "风险/代价",
      "intent_type": "Escalation"
    }
  ]
}
```

`intent_type` 预期值：`Escalation | De-escalation | Alliance Building | Info Gathering`

## 5. 前端 -> 服务端（Client Request）

| type | data | 说明 |
| --- | --- | --- |
| `start_experience` | `{}` | 启动主流程 |
| `user_message` | `{ "content": "...", "target": "角色名" }` | 用户发送消息 |
| `backtrack_to` | `{ "target_id": "2.1", "perspective_agent": "角色名" }` | Stage2 回溯到指定节点并切换用户视角 |
| `export_save` | `{}` | 请求导出存档 |
| `request_reflection` | `{}` | 请求导出 Reflection 报告 |
| `request_tip` | `{}` | 请求生成回复建议 |

说明：
- `user_message.data.from_name` 即使传入，当前服务端也不读取（以服务端 `user_role_name` 为准）。
- 未识别的 `type` 仅在服务端日志打印，不会返回错误包。

## 6. 前端实现建议

- 对 `stream_token`、`facilitator_stream` 使用增量拼接渲染。
- 以 `agent + target` 作为对话流分段键，避免串流错位。
- `graph_update` 与 `node_update` 可能连续到达，UI 应允许幂等刷新。
- 仅在收到 `enable_reflection` 后展示 Reflection 导出入口。